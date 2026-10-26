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
	subject := func(origin symbols.Origin) ViewSubject {
		id := originKey(origin)
		ref := ViewSubject{ID: id, QualifiedName: byOrigin[id]}
		if origin.Located() {
			ref.Origin = &ViewOrigin{File: origin.Doc, Offset: origin.Span.Offset, Length: origin.Span.Len, NameOffset: origin.Name.Offset, NameLength: origin.Name.Len}
		}
		return ref
	}
	for _, sym := range selected {
		ref := subject(sym.Origin())
		if ref.QualifiedName == "" {
			ref.QualifiedName = cached.Index.GetFQN(sym)
		}
		if ref.ID == "" {
			ref.ID = "unlocated:" + ref.QualifiedName
		}
		out.Selected = append(out.Selected, ref)
	}
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
	data := rendering.DataFor(view.PortsFull)
	out.Artifact, err = marshalRenderView(data)
	if err != nil {
		return nil, err
	}
	if data.Kind == view.KindInterconnection {
		out.Artifact, err = structuralNotation(out.Artifact, data, declarations)
		if err != nil {
			return nil, err
		}
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
	return marshal(out)
}

// The pinned renderer leaves structural pins undirected and omits reference
// modifiers. Carry only explicit declaration modifiers, using recorded origins;
// do not infer flow direction from port types, conjugation or connector order.
func structuralNotation(raw []byte, data view.Data, declarations map[string]*symbols.Symbol) ([]byte, error) {
	var base JRenderViewResponse
	if err := json.Unmarshal(raw, &base); err != nil {
		return nil, err
	}
	type node struct {
		JRenderNode
		Reference bool   `json:"reference,omitempty"`
		Direction string `json:"direction,omitempty"`
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
