package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"

	"github.com/Open-MBEE/OpenSysML/internal/ir/view"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/semantics"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/symbols"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/ast"
)

type ViewSubject struct {
	ID            string      `json:"id"`
	QualifiedName string      `json:"qualifiedName,omitempty"`
	Origin        *ViewOrigin `json:"origin,omitempty"`
}
type ViewOrigin struct {
	File       string `json:"file"`
	Offset     int    `json:"offset"`
	Length     int    `json:"length"`
	NameOffset int    `json:"nameOffset"`
	NameLength int    `json:"nameLength"`
}
type ViewCorrespondence struct {
	Symbol  string      `json:"symbol"`
	Subject ViewSubject `json:"subject"`
	Context []string    `json:"context"`
}
type EvaluatedView struct {
	SchemaVersion  int                  `json:"schemaVersion"`
	ModelHash      string               `json:"modelHash"`
	View           string               `json:"view"`
	Status         string               `json:"status"`
	Selected       []ViewSubject        `json:"selected"`
	Diagnostics    []string             `json:"diagnostics"`
	Artifact       json.RawMessage      `json:"artifact,omitempty"`
	RenderStatus   string               `json:"renderStatus"`
	Correspondence []ViewCorrespondence `json:"correspondence"`
}

// evaluateView keeps selection independent from renderer support and preserves
// revision-scoped origins. It is a local bridge, not an upstream wire contract.
func (e *Engine) evaluateView(req *JRenderViewRequest) ([]byte, error) {
	cached, ok := e.get(req.ModelHash)
	if !ok {
		return nil, statusErrorf(codeNotFound, msgModelNotFound, req.ModelHash)
	}
	out := EvaluatedView{SchemaVersion: 1, ModelHash: req.ModelHash, View: req.View, Status: "invalid", Selected: []ViewSubject{}, Diagnostics: []string{}, RenderStatus: "unavailable", Correspondence: []ViewCorrespondence{}}
	matches := lookupNamed(cached.Index, req.View)
	if len(matches) != 1 || matches[0].Kind != symbols.SymbolViewUsage {
		out.Diagnostics = append(out.Diagnostics, "Expected one unambiguous native view usage")
		return marshal(out)
	}
	// A fresh resolver prevents cached import admission hiding predicate failures.
	cached.typed = nil
	typed := cached.typedModel()
	// Capture predicate failures even though the semantic engine conservatively
	// retains their candidates. Never label that retained set complete.
	failures := map[string]bool{}
	cached.resolver.SetModel(&viewFilterJudge{Model: typed, failures: failures})
	defer cached.resolver.SetModel(typed)
	selected, err := typed.ExposedElements(matches[0])
	if err != nil {
		return nil, err
	}
	for _, candidate := range selected {
		for _, condition := range typed.ViewExposureConditions(matches[0]) {
			if _, err := typed.EvalElementFilter(condition, candidate); err != nil {
				failures[err.Error()] = true
			}
		}
	}
	if len(failures) > 0 {
		out.Status = "indeterminate"
		for reason := range failures {
			out.Diagnostics = append(out.Diagnostics, reason)
		}
		sort.Strings(out.Diagnostics)
		return marshal(out)
	}
	out.Status = "complete"
	out.Selected = cached.selectedSubjects(selected)
	renderer := view.NewRenderer(typed, cached.resolver, cached.sourceText())
	rendering, err := renderer.Render(matches[0])
	if err != nil {
		var unsupported *view.UnsupportedKindError
		if errors.As(err, &unsupported) && unsupported.Kind == view.KindGeometry {
			return e.studioGeometry(req, selected, typed, out)
		}
		out.RenderStatus = "unsupported"
		out.Diagnostics = append(out.Diagnostics, err.Error())
		return marshal(out)
	}
	if len(failures) > 0 {
		out.Status = "indeterminate"
		out.Selected = []ViewSubject{}
		for reason := range failures {
			out.Diagnostics = append(out.Diagnostics, reason)
		}
		sort.Strings(out.Diagnostics)
		return marshal(out)
	}
	return cached.normalizedRendering(out, selected, rendering, true)
}

func (cached *cachedModel) normalizedRendering(out EvaluatedView, selected []*symbols.Symbol, rendering *view.Rendering, authored bool) ([]byte, error) {
	var err error
	byOrigin := map[string]string{}
	declarations := map[string]*symbols.Symbol{}
	cached.Index.Registered(func(fqn string, syms []*symbols.Symbol) {
		for _, sym := range syms {
			origin := sym.Origin()
			if origin.Located() {
				byOrigin[originKey(origin)] = cached.Index.GetFQN(sym)
				declarations[originKey(origin)] = sym
			}
		}
	})
	// The semantic index also owns anonymous members (including synthesized
	// satisfy subjects). Inspect their AST kind, never their rendered text.
	seenDeclarations := map[*symbols.Symbol]bool{}
	var visitDeclaration func(*symbols.Symbol)
	visitDeclaration = func(sym *symbols.Symbol) {
		if sym == nil || seenDeclarations[sym] || cached.Index.IsLibraryDocument(sym.DocName) {
			return
		}
		seenDeclarations[sym] = true
		key := originKey(sym.Origin())
		if key != "" && declarations[key] == nil {
			declarations[key] = sym
		}
		if sym.Scope != nil {
			for _, member := range sym.Scope.AllMembers() {
				visitDeclaration(member)
			}
		}
	}
	cached.Index.Registered(func(_ string, syms []*symbols.Symbol) {
		for _, sym := range syms {
			visitDeclaration(sym)
		}
	})
	subject := func(origin symbols.Origin) ViewSubject {
		id := originKey(origin)
		ref := ViewSubject{ID: id, QualifiedName: byOrigin[id]}
		if origin.Located() {
			ref.Origin = &ViewOrigin{File: origin.Doc, Offset: origin.Span.Offset, Length: origin.Span.Len, NameOffset: origin.Name.Offset, NameLength: origin.Name.Len}
		}
		return ref
	}
	out.Selected = cached.selectedSubjects(selected)
	// Keep complete semantic labels in the bridge; our renderer owns presentation.
	shown := view.Shown{}
	for _, element := range view.Elements() {
		shown[element] = true
	}
	data := rendering.DataWith(view.Options{Ports: view.PortsFull, Show: shown})
	legacyIDs := map[string]string{}
	// Exploration and trees retain declaration ownership. Authored structural
	// views retain native effective structural occurrences; inherited attributes
	// remain source-backed compartments. Native traversal supplies the bounds.
	if data.Kind == view.KindTree || data.Kind == view.KindInterconnection {
		kept := map[string]bool{}
		redirect := map[string]string{}
		original := map[string]view.NodeData{}
		for _, node := range data.Nodes {
			original[node.ID] = node
		}
		exposed := map[string]bool{}
		for _, sym := range selected {
			exposed[originKey(sym.Origin())] = true
		}
		nodes := data.Nodes[:0]
		for _, node := range data.Nodes {
			syntheticSubject := false
			unsupportedConstraint := false
			if sym := declarations[originKey(node.Origin)]; sym != nil {
				if rel, ok := sym.Decl.(*ast.Relationship); ok && rel.Kind == ast.RelSubject {
					syntheticSubject = true
				}
				unsupportedConstraint = data.Kind == view.KindInterconnection && (sym.Kind == symbols.SymbolConstraintDef || sym.Kind == symbols.SymbolConstraintUsage)
			}
			inheritedOutOfScope := node.Inherited
			if authored && data.Kind == view.KindInterconnection {
				if sym := declarations[originKey(node.Origin)]; sym != nil {
					inheritedOutOfScope = node.Inherited && (sym.Kind == symbols.SymbolAttributeUsage || sym.Kind == symbols.SymbolAttributeDef)
				}
			}
			if !node.Inherited && !syntheticSubject && !unsupportedConstraint && (node.Parent == "" || legacyIDs[node.Parent] != "") {
				legacyIDs[node.ID] = fmt.Sprintf("n%d", len(legacyIDs))
			}
			if inheritedOutOfScope || syntheticSubject || unsupportedConstraint || (node.Parent != "" && !kept[node.Parent]) {
				redirect[node.ID] = redirect[node.Parent]
				continue
			}
			redirect[node.ID] = node.ID
			kept[node.ID] = true
			nodes = append(nodes, node)
		}
		data.Nodes = nodes
		edges := data.Edges[:0]
		for _, edge := range data.Edges {
			if data.Kind == view.KindInterconnection {
				// Keep connectors declared in a visible occurrence, or explicitly
				// exposed. Do not leak a type's inherited internal connections.
				if declaration := declarations[originKey(edge.Origin)]; declaration != nil && !exposed[originKey(edge.Origin)] {
					owner := declaration.Owner()
					visibleOwner := false
					for _, endpoint := range []string{edge.From, edge.To} {
						for id := endpoint; id != ""; id = original[id].Parent {
							if owner != nil && kept[id] && originKey(original[id].Origin) == originKey(owner.Origin()) {
								visibleOwner = true
								break
							}
						}
					}
					if !visibleOwner {
						continue
					}
				}
				// Native hierarchy records the nearest retained boundary. A
				// hidden internal pin cannot become a pin on that boundary.
				if from := redirect[edge.From]; from != "" && from != edge.From {
					edge.From, edge.FromPort = from, ""
				}
				if to := redirect[edge.To]; to != "" && to != edge.To {
					edge.To, edge.ToPort = to, ""
				}
			}
			if kept[edge.From] && kept[edge.To] {
				edges = append(edges, edge)
			}
		}
		data.Edges = edges
	}
	// Keep version-1 IDs for every occurrence the legacy projection retained.
	// Allocate newly visible occurrences after them without reordering the native
	// parent-first array, then rewrite all dependent endpoints and port IDs.
	if data.Kind == view.KindTree || data.Kind == view.KindInterconnection {
		ids := map[string]string{"": ""}
		next := len(legacyIDs)
		for _, node := range data.Nodes {
			id := legacyIDs[node.ID]
			if id == "" {
				id = fmt.Sprintf("n%d", next)
				next++
			}
			ids[node.ID] = id
			for j, port := range node.Ports {
				ids[port.ID] = fmt.Sprintf("%s.%d", id, j)
			}
		}
		for i := range data.Nodes {
			node := &data.Nodes[i]
			node.ID = ids[node.ID]
			node.Parent = ids[node.Parent]
			for j := range node.Ports {
				node.Ports[j].ID = ids[node.Ports[j].ID]
			}
		}
		for i := range data.Edges {
			edge := &data.Edges[i]
			edge.From = ids[edge.From]
			edge.To = ids[edge.To]
			edge.FromPort = ids[edge.FromPort]
			edge.ToPort = ids[edge.ToPort]
		}
	}
	// Requirement edge keywords are presentation; polarity and kind travel
	// separately and the browser supplies their accessible labels.
	for i := range data.Edges {
		if data.Edges[i].Kind == view.EdgeSatisfy {
			data.Edges[i].Label = data.Edges[i].Name
		}
	}
	// 0.12 separates association end labels from the edge label. The
	// browser's tree contract exposes the composed member as its label.
	if data.Kind == view.KindTree {
		names := map[string]string{}
		for _, node := range data.Nodes {
			names[node.ID] = node.Name
		}
		for i := range data.Edges {
			edge := &data.Edges[i]
			if (edge.Kind == view.EdgeComposition || edge.Kind == view.EdgeReference) && edge.Label == "" {
				edge.Label = names[edge.To]
			}
		}
	}
	out.Artifact, err = marshalRenderView(cached, data)
	if err != nil {
		return nil, err
	}
	if data.Kind == view.KindInterconnection {
		out.Artifact, err = cached.structuralNotation(out.Artifact, data, declarations)
		if err != nil {
			return nil, err
		}
	}
	if data.Kind == view.KindRequirement {
		out.Artifact, err = cached.requirementNotation(out.Artifact, data, out.Selected, declarations)
		if err != nil {
			return nil, err
		}
	}
	// Native JSON omits empty collections; available empty graphs keep arrays.
	var artifact map[string]json.RawMessage
	if err = json.Unmarshal(out.Artifact, &artifact); err != nil {
		return nil, err
	}
	for _, key := range []string{"nodes", "edges"} {
		if len(artifact[key]) == 0 || string(artifact[key]) == "null" {
			artifact[key] = json.RawMessage(`[]`)
		}
	}
	var nodeObjects []map[string]json.RawMessage
	if err = json.Unmarshal(artifact["nodes"], &nodeObjects); err != nil {
		return nil, err
	}
	for _, node := range nodeObjects {
		if len(node["name"]) == 0 {
			node["name"] = json.RawMessage(`""`)
		}
		if len(node["ports"]) > 0 {
			var ports []map[string]json.RawMessage
			if err = json.Unmarshal(node["ports"], &ports); err != nil {
				return nil, err
			}
			for _, port := range ports {
				if len(port["name"]) == 0 {
					port["name"] = json.RawMessage(`""`)
				}
			}
			node["ports"], err = json.Marshal(ports)
			if err != nil {
				return nil, err
			}
		}
	}
	artifact["nodes"], err = json.Marshal(nodeObjects)
	if err != nil {
		return nil, err
	}
	out.Artifact, err = json.Marshal(artifact)
	if err != nil {
		return nil, err
	}
	out.RenderStatus = "available"
	contexts := map[string][]string{}
	for _, node := range data.Nodes {
		context := append([]string{}, contexts[node.Parent]...)
		if node.Origin.Located() {
			context = append(context, originKey(node.Origin))
		}
		contexts[node.ID] = context
		out.Correspondence = append(out.Correspondence, ViewCorrespondence{Symbol: node.ID, Subject: subject(node.Origin), Context: context})
		for _, port := range node.Ports {
			portContext := append(append([]string{}, context...), originKey(port.Origin))
			out.Correspondence = append(out.Correspondence, ViewCorrespondence{Symbol: port.ID, Subject: subject(port.Origin), Context: portContext})
		}
	}
	for i, edge := range data.Edges {
		out.Correspondence = append(out.Correspondence, ViewCorrespondence{Symbol: fmt.Sprintf("edge:%d", i), Subject: subject(edge.Origin), Context: []string{}})
	}
	if err := cached.sourceValues(&out, declarations); err != nil {
		return nil, err
	}
	return marshal(out)
}

func (cached *cachedModel) selectedSubjects(selected []*symbols.Symbol) []ViewSubject {
	byOrigin := map[string]string{}
	cached.Index.Registered(func(_ string, syms []*symbols.Symbol) {
		for _, sym := range syms {
			if sym.Origin().Located() {
				byOrigin[originKey(sym.Origin())] = cached.Index.GetFQN(sym)
			}
		}
	})
	out := []ViewSubject{}
	for _, sym := range selected {
		origin := sym.Origin()
		ref := ViewSubject{ID: originKey(origin), QualifiedName: byOrigin[originKey(origin)]}
		if ref.QualifiedName == "" {
			ref.QualifiedName = cached.Index.GetFQN(sym)
		}
		if origin.Located() {
			ref.Origin = &ViewOrigin{File: origin.Doc, Offset: origin.Span.Offset, Length: origin.Span.Len, NameOffset: origin.Name.Offset, NameLength: origin.Name.Len}
		}
		if ref.ID == "" {
			ref.ID = "unlocated:" + ref.QualifiedName
		}
		out = append(out, ref)
	}
	return out
}

// The pinned renderer leaves structural pins undirected and omits reference
// modifiers. Carry only explicit declaration modifiers, using recorded origins;
// do not infer flow direction from port types, conjugation or connector order.
func (cached *cachedModel) structuralNotation(raw []byte, data view.Data, declarations map[string]*symbols.Symbol) ([]byte, error) {
	var base JRenderViewResponse
	if err := json.Unmarshal(raw, &base); err != nil {
		return nil, err
	}
	type node struct {
		JRenderNode
		Reference             bool     `json:"reference,omitempty"`
		Direction             string   `json:"direction,omitempty"`
		AttributeDeclarations []string `json:"attributeDeclarations,omitempty"`
	}
	out := struct {
		*JRenderViewResponse
		Nodes []node `json:"nodes"`
	}{JRenderViewResponse: &base, Nodes: []node{}}
	usage := func(origin symbols.Origin) *ast.Usage {
		if sym := declarations[originKey(origin)]; sym != nil {
			decl, _ := sym.Decl.(*ast.Usage)
			return decl
		}
		return nil
	}
	for i, original := range data.Nodes {
		item := node{JRenderNode: base.Nodes[i]}
		if sym := declarations[originKey(original.Origin)]; sym != nil {
			text := cached.sourceText()
			for _, member := range cached.typedModel().MembersOf(sym) {
				if member.Kind == symbols.SymbolAttributeUsage && member.Decl != nil && !cached.Index.IsLibraryDocument(member.DocName) {
					item.AttributeDeclarations = append(item.AttributeDeclarations, text(member.DocName, member.Decl.Span()))
				}
			}
		}
		if decl := usage(original.Origin); decl != nil {
			item.Reference = decl.IsReference
			if decl.Direction != ast.DirNone {
				item.Direction = decl.Direction.String()
			}
		}
		for j, port := range original.Ports {
			if decl := usage(port.Origin); decl != nil && decl.Direction != ast.DirNone {
				item.Ports[j].Direction = decl.Direction.String()
			}
		}
		out.Nodes = append(out.Nodes, item)
	}
	return json.Marshal(out)
}
func originKey(origin symbols.Origin) string {
	if !origin.Located() {
		return ""
	}
	return fmt.Sprintf("%s@%d:%d", origin.Doc, origin.Span.Offset, origin.Span.Len)
}

type viewFilterJudge struct {
	*semantics.Model
	failures map[string]bool
}

func (judge *viewFilterJudge) SatisfiesElementFilter(filter symbols.ElementFilter, candidate *symbols.Symbol) bool {
	admitted, err := judge.Model.EvalElementFilter(filter, candidate)
	if err != nil {
		judge.failures[err.Error()] = true
		return true
	}
	return admitted
}

// Geometry v1 previews evaluated solid Box dimensions and coordinate-frame poses.
// It deliberately does not infer assembly placement from declaration order.
func (e *Engine) studioGeometry(req *JRenderViewRequest, selected []*symbols.Symbol, typed *semantics.Model, out EvaluatedView) ([]byte, error) {
	type box struct {
		Length float64 `json:"length"`
		Width  float64 `json:"width"`
		Height float64 `json:"height"`
	}
	type node struct {
		ID        string                  `json:"id"`
		Kind      string                  `json:"kind"`
		Name      string                  `json:"name"`
		Type      string                  `json:"type"`
		Solid     box                     `json:"solid"`
		Placement *studioSpatialPlacement `json:"placement,omitempty"`
	}
	type artifact struct {
		View    string   `json:"view"`
		Kind    string   `json:"kind"`
		Nodes   []node   `json:"nodes"`
		Edges   []any    `json:"edges"`
		Notices []string `json:"notices"`
	}
	drawing := artifact{View: req.View, Kind: "geometry", Nodes: []node{}, Edges: []any{}, Notices: []string{"Dimensions and coordinate-frame poses evaluated in metres. Boxes are centered on their frame origins. Solids are inspected separately; meshes and void subtraction are unsupported."}}
	cached, _ := e.get(req.ModelHash)

	evaluate := func(subject, expression string) (*JValue, error) {
		body, err := e.evaluate(context.Background(), &JEvaluateRequest{ModelHash: req.ModelHash, SubjectSymbolId: subject, Expression: expression})
		if err != nil {
			return nil, err
		}
		var response JEvaluateResponse
		if err = json.Unmarshal(body, &response); err != nil {
			return nil, err
		}
		if response.Error != "" {
			return nil, fmt.Errorf("%s", response.Error)
		}
		if response.Result == nil {
			return nil, fmt.Errorf("no evaluated value")
		}
		return response.Result, nil
	}
	metres := func(subject, name string) (float64, error) {
		value, err := evaluate(subject, name)
		if err != nil {
			return 0, err
		}
		q := value.Quantity
		if q == nil || q.UnitTerm == nil || len(q.UnitTerm.Factors) != 1 || q.UnitTerm.Factors[0].UnitId != "SI::metre" || float64(q.UnitTerm.Factors[0].Exponent) != 1 || float64(q.UnitTerm.ScaleDen) <= 0 {
			return 0, fmt.Errorf("%s is not a resolved length quantity", name)
		}
		var magnitude float64
		switch {
		case q.IntMagnitude != nil:
			magnitude = float64(*q.IntMagnitude)
		case q.RealMagnitude != nil:
			magnitude = float64(*q.RealMagnitude)
		case q.RationalMagnitude != nil:
			numerator, a := strconv.ParseFloat(q.RationalMagnitude.Numerator, 64)
			denominator, b := strconv.ParseFloat(q.RationalMagnitude.Denominator, 64)
			if a != nil || b != nil || denominator == 0 {
				return 0, fmt.Errorf("invalid rational length")
			}
			magnitude = numerator / denominator
		default:
			return 0, fmt.Errorf("unsupported length magnitude")
		}
		length := magnitude * float64(q.UnitTerm.ScaleNum) / float64(q.UnitTerm.ScaleDen)
		if length <= 0 || math.IsInf(length, 0) || math.IsNaN(length) {
			return 0, fmt.Errorf("%s must be finite and positive", name)
		}
		return length, nil
	}
	for index, sym := range selected {
		fqn := cached.Index.GetFQN(sym)
		isBox := false
		for _, candidate := range append([]*symbols.Symbol{sym}, typed.AllSupertypes(sym)...) {
			if cached.Index.GetFQN(candidate) == "ShapeItems::RectangularCuboid" && cached.Index.Library(candidate) {
				isBox = true
				break
			}
		}
		if !isBox {
			drawing.Notices = append(drawing.Notices, fqn+": unsupported shape; expose a solid ShapeItems::Box usage directly.")
			continue
		}
		solid, err := evaluate(fqn, "isSolid")
		if err != nil || solid.BoolValue == nil || !*solid.BoolValue {
			drawing.Notices = append(drawing.Notices, fqn+": solidness could not be established; voids are unsupported.")
			continue
		}
		dimensions := box{}
		for _, entry := range []struct {
			name   string
			target *float64
		}{{"length", &dimensions.Length}, {"width", &dimensions.Width}, {"height", &dimensions.Height}} {
			*entry.target, err = metres(fqn, entry.name)
			if err != nil {
				drawing.Notices = append(drawing.Notices, fmt.Sprintf("%s: %v", fqn, err))
				break
			}
		}
		if err != nil {
			continue
		}
		placement, placementErr := e.studioPlacement(cached, sym)
		if placementErr != nil {
			drawing.Notices = append(drawing.Notices, fmt.Sprintf("%s: coordinate-frame placement unavailable: %v", fqn, placementErr))
			continue
		}
		id := fmt.Sprintf("solid:%d", index)
		drawing.Nodes = append(drawing.Nodes, node{ID: id, Kind: "box", Name: fqn, Type: "ShapeItems::Box", Solid: dimensions, Placement: placement})
		ref := out.Selected[index]
		out.Correspondence = append(out.Correspondence, ViewCorrespondence{Symbol: id, Subject: ref, Context: []string{ref.ID}})
	}
	if len(drawing.Nodes) == 0 && len(selected) > 0 {
		out.RenderStatus = "unsupported"
		out.Diagnostics = append(out.Diagnostics, drawing.Notices...)
		return marshal(out)
	}
	var err error
	out.Artifact, err = json.Marshal(drawing)
	if err != nil {
		return nil, err
	}
	out.RenderStatus = "available"
	return marshal(out)
}
