package engine

import (
	"encoding/json"
	"fmt"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/semantics"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/symbols"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/ast"
)

type SourceExpressionOrigin struct {
	File   string `json:"file"`
	Offset int    `json:"offset"`
	Length int    `json:"length"`
}
type SourceValue struct {
	Status           string                  `json:"status"`
	Expression       string                  `json:"expression,omitempty"`
	ExpressionOrigin *SourceExpressionOrigin `json:"expressionOrigin,omitempty"`
	Provider         *ViewSubject            `json:"provider,omitempty"`
	IsDefault        *bool                   `json:"isDefault,omitempty"`
	IsInitial        *bool                   `json:"isInitial,omitempty"`
	Provenance       string                  `json:"provenance,omitempty"`
	Reason           string                  `json:"reason,omitempty"`
}
type SourceAttribute struct {
	Subject     ViewSubject `json:"subject"`
	Name        string      `json:"name"`
	Type        string      `json:"type,omitempty"`
	Context     []string    `json:"context"`
	Declaration string      `json:"declaration"`
	Value       SourceValue `json:"value"`
}

// Symbol identity is already semantic here; avoid rescanning the entire library
// index for every compartment row.
func (c *cachedModel) sourceSubject(s *symbols.Symbol) ViewSubject {
	o := s.Origin()
	ref := ViewSubject{ID: originKey(o), QualifiedName: c.Index.GetFQN(s)}
	if o.Located() {
		ref.Origin = &ViewOrigin{File: o.Doc, Offset: o.Span.Offset, Length: o.Span.Len, NameOffset: o.Name.Offset, NameLength: o.Name.Len}
	}
	return ref
}

func sourceUnsupported(reason string) SourceValue {
	return SourceValue{Status: "unsupported", Reason: reason}
}

// Walk the complete provider graph. An own expression terminates that branch;
// diamond paths collapse by symbol identity, never by text or traversal order.
// The injectable edge function also allows adversarial cycle/ambiguity controls.
func sourceProviders(sym *symbols.Symbol, edges func(*symbols.Symbol) []*symbols.Symbol) ([]*symbols.Symbol, string) {
	found := map[*symbols.Symbol]bool{}
	active := map[*symbols.Symbol]bool{}
	done := map[*symbols.Symbol]bool{}
	var visit func(*symbols.Symbol) string
	visit = func(s *symbols.Symbol) string {
		if s == nil || s.Decl == nil {
			return "missing AST"
		}
		if active[s] {
			return "cyclic source providers"
		}
		if done[s] {
			return ""
		}
		active[s] = true
		defer delete(active, s)
		if _, _, _, ok := ast.ValuePartOf(s.Decl); ok {
			found[s] = true
		} else {
			targets := edges(s)
			if len(targets) == 0 {
				for _, rel := range semantics.RelationshipsOf(s) {
					if rel.Kind == ast.RelRedefines {
						return "unresolved source redefinition"
					}
				}
			}
			for _, r := range targets {
				if why := visit(r); why != "" {
					return why
				}
			}
		}
		done[s] = true
		return ""
	}
	if why := visit(sym); why != "" {
		return nil, why
	}
	out := []*symbols.Symbol{}
	for s := range found {
		out = append(out, s)
	}
	if len(out) > 1 {
		return nil, "ambiguous source providers"
	}
	return out, ""
}
func (c *cachedModel) sourceDeclaration(s *symbols.Symbol) (string, bool) {
	if s == nil || s.Decl == nil {
		return "", false
	}
	span := s.Decl.Span()
	for _, d := range c.Documents {
		if d.Source != nil && d.Source.Name() == s.DocName && span.Offset >= 0 && span.Len > 0 && span.Offset <= d.Source.Len()-span.Len {
			return d.Source.Text(span), true
		}
	}
	return "", false
}
func (c *cachedModel) sourceValue(selected, provider *symbols.Symbol) SourceValue {
	implicit := false
	m := c.typedModel()
	providers, why := sourceProviders(provider, func(s *symbols.Symbol) []*symbols.Symbol {
		explicit := m.RedefinedFeatures(s)
		for _, target := range m.DirectRedefinedFeatures(s) {
			found := false
			for _, known := range explicit {
				if known == target {
					found = true
				}
			}
			if !found {
				implicit = true
			}
		}
		return explicit
	})
	if implicit {
		return sourceUnsupported("implicit source-provider precedence unsupported")
	}
	if why != "" {
		return sourceUnsupported(why)
	}
	if len(providers) == 0 {
		return SourceValue{Status: "absent"}
	}
	p := providers[0]
	if _, ok := c.sourceDeclaration(p); !ok {
		return sourceUnsupported("missing applied provider source")
	}
	value, def, initial, _ := ast.ValuePartOf(p.Decl)
	sp := value.Span()
	decl := p.Decl.Span()
	if sp.Len <= 0 || sp.Offset < decl.Offset || sp.Offset > decl.Offset+decl.Len-sp.Len {
		return sourceUnsupported("expression outside provider declaration")
	}
	expression := c.sourceText()(p.DocName, sp)
	if len(expression) != sp.Len {
		return sourceUnsupported("missing expression source")
	}
	ref := c.sourceSubject(p)
	provenance := "redefined"
	if p == selected {
		provenance = "own"
	}
	return SourceValue{Status: "available", Expression: expression, ExpressionOrigin: &SourceExpressionOrigin{p.DocName, sp.Offset, sp.Len}, Provider: &ref, IsDefault: &def, IsInitial: &initial, Provenance: provenance}
}

// Identity equivalence is directed specialization, not matching short names.
func sourceSpecializes(m *semantics.Model, actual, target *symbols.Symbol) bool {
	if actual == target {
		return true
	}
	for _, s := range m.AllRedefinedFeatures(actual) {
		if s == target {
			return true
		}
	}
	return false
}
func (c *cachedModel) sourceBinding(owner *symbols.Symbol) string {
	m := c.typedModel()
	for _, scope := range append([]*symbols.Symbol{owner}, m.MemberSources(owner)...) {
		if c.Index.IsLibraryDocument(scope.DocName) {
			continue
		}
		for _, node := range ast.DeclMembers(scope.Decl) {
			if member, ok := node.(*ast.Membership); ok {
				node = member.Member
			}
			if u, ok := node.(*ast.Usage); ok && u.Kind == ast.UsageBinding {
				sp := u.Span()
				for _, doc := range c.Documents {
					if doc.Source != nil && doc.Source.Name() == scope.DocName && sp.Offset >= 0 && sp.Len > 0 && sp.Offset <= doc.Source.Len()-sp.Len {
						return fmt.Sprintf("%s@%d:%d: %s", scope.DocName, sp.Offset, sp.Len, doc.Source.Text(sp))
					}
				}
				return "binding source unavailable"
			}
		}
	}
	return ""
}

// Source scopes and renderer occurrence contexts are different. Inventory authored
// declarations once per rendering, including anonymous bindings and split namespaces.
// External effects remain unsupported rather than being assigned invented precedence.
type sourceEffect struct {
	declaration *symbols.Symbol
	paths       [][]*symbols.Symbol
	kind        string
	relative    []bool
}

func (c *cachedModel) sourceEffects() []sourceEffect {
	m := c.typedModel()
	effects := []sourceEffect{}
	seen := map[*symbols.Symbol]bool{}
	var walk func(*symbols.Scope)
	walk = func(scope *symbols.Scope) {
		if scope == nil {
			return
		}
		scope.ForEachMember(func(s *symbols.Symbol) bool {
			if seen[s] || s.Decl == nil {
				return true
			}
			seen[s] = true
			if kind, ok := s.UsageKind(); ok && kind == ast.UsageBinding {
				paths := m.ConnectorEndFeaturePaths(s)
				if len(paths) == 0 {
					paths = [][]*symbols.Symbol{nil}
				}
				ends := m.ConnectorObjectEnds(s)
				relative := make([]bool, len(paths))
				for i, path := range paths {
					if i < len(ends) {
						relative[i] = sourceRelativeEffect(m, s.Owner(), path, ends[i].Attachment)
					}
				}
				effects = append(effects, sourceEffect{declaration: s, paths: paths, kind: "binding", relative: relative})
			} else {
				for _, rel := range semantics.RelationshipsOf(s) {
					if rel.Kind != ast.RelRedefines {
						continue
					}
					if _, chain := rel.Target.(*ast.FeatureChainExpr); chain {
						path := m.ChainTargetPath(s, rel.Kind, rel.Target)
						effects = append(effects, sourceEffect{declaration: s, paths: [][]*symbols.Symbol{path}, kind: "qualified assignment", relative: []bool{sourceRelativeEffect(m, s.Owner(), path, rel.Target)}})
					} else if s.Kind.IsAttributeLike() {
						// Non-chain attribute redefinitions do not carry a
						// complete occurrence path. Internal declarations are
						// still resolved normally; external scope ambiguity
						// must not make a default appear proven.
						effects = append(effects, sourceEffect{declaration: s, paths: [][]*symbols.Symbol{nil}, kind: "attribute redefinition"})
					}
				}
			}
			return true
		})
		for _, child := range scope.Children() {
			walk(child)
		}
	}
	for _, doc := range c.Index.WorkspaceDocuments() {
		walk(c.Index.DocumentRoot(doc))
	}
	return effects
}

// A resolved endpoint loses namespace qualification. Keep the AST reference
// form so an unqualified local member is relative to the binding's usage,
// while an explicit P::b.number or P::Base::number stays an external target.
func sourceRelativeEffect(m *semantics.Model, lexical *symbols.Symbol, path []*symbols.Symbol, node ast.Node) bool {
	if lexical == nil || !(lexical.IsFeature() || lexical.Kind.IsDefinition()) || len(path) == 0 {
		return false
	}
	for {
		if chain, ok := node.(*ast.FeatureChainExpr); ok {
			node = chain.Operand
			continue
		}
		break
	}
	var name *ast.QualifiedName
	switch n := node.(type) {
	case *ast.QualifiedName:
		name = n
	case *ast.FeatureReference:
		name = n.Name
	}
	if name == nil || name.Global || len(name.Parts) != 1 {
		return false
	}
	for _, member := range m.MembersOf(lexical) {
		if sourceSpecializes(m, member, path[0]) {
			return true
		}
	}
	return false
}

func sourceMemberSource(m *semantics.Model, occurrence, source *symbols.Symbol) bool {
	if occurrence == source {
		return true
	}
	for _, base := range m.MemberSources(occurrence) {
		if base == source {
			return true
		}
	}
	return false
}

// Prefix a root exposed from inside an owned feature with its actual lexical
// feature owners. This never appends or rewrites the portable renderer context.
func sourceLexicalPath(path []*symbols.Symbol) []*symbols.Symbol {
	if len(path) == 0 {
		return nil
	}
	prefix := []*symbols.Symbol{}
	for owner := path[0].Owner(); owner != nil && (owner.IsFeature() || owner.Kind.IsDefinition()); owner = owner.Owner() {
		prefix = append([]*symbols.Symbol{owner}, prefix...)
	}
	return append(prefix, path...)
}
func sourcePathEqual(m *semantics.Model, actual, target []*symbols.Symbol) bool {
	if len(actual) != len(target) || len(actual) == 0 {
		return false
	}
	for i, step := range target {
		if !sourceSpecializes(m, actual[i], step) {
			return false
		}
	}
	return true
}

// An unresolved semantic path cannot prove that a same-scope declaration is
// irrelevant. Fail closed within that source scope, never across the whole project.
func sourceEffectScopeApplies(c *cachedModel, m *semantics.Model, occurrence []*symbols.Symbol, lexical *symbols.Symbol) bool {
	if lexical == nil {
		return true
	}
	featureScope := lexical.IsFeature() || lexical.Kind.IsDefinition()
	for _, step := range occurrence {
		if featureScope && sourceMemberSource(m, step, lexical) {
			return true
		}
		if !featureScope {
			for owner := step.Owner(); owner != nil; owner = owner.Owner() {
				// Split namespace declarations share semantic namespace identity but have
				// different source origins. This compares the index's FQN, not local names.
				if owner == lexical || c.Index.GetFQN(owner) == c.Index.GetFQN(lexical) {
					return true
				}
			}
		}
	}
	return false
}

func (c *cachedModel) externalSourceEffect(s *symbols.Symbol, owners []*symbols.Symbol, effects []sourceEffect) string {
	m := c.typedModel()
	occurrence := append(append([]*symbols.Symbol{}, owners...), s)
	full := sourceLexicalPath(occurrence)
	for _, effect := range effects {
		lexical := effect.declaration.Owner()
		internal := false
		for _, owner := range owners {
			if sourceMemberSource(m, owner, lexical) {
				internal = true
				break
			}
		}
		if internal {
			continue
		} // The existing occurrence resolver owns these scopes.
		for i, path := range effect.paths {
			if len(path) == 0 && sourceEffectScopeApplies(c, m, full, lexical) {
				text, _ := c.sourceDeclaration(effect.declaration)
				o := effect.declaration.Origin()
				return fmt.Sprintf("external %s target path unresolved in relevant source scope; source-value precedence unsupported; %s@%d:%d: %s", effect.kind, o.Doc, o.Span.Offset, o.Span.Len, text)
			}
			target := path
			if i < len(effect.relative) && effect.relative[i] && (len(path) == 0 || path[0] != lexical) {
				target = append([]*symbols.Symbol{lexical}, path...)
			}
			matches := sourcePathEqual(m, full, sourceLexicalPath(target))
			// An enclosing definition may be reached through a concrete typed usage;
			// apply its relative path only inside that exact semantic owner occurrence.
			if !matches && lexical != nil && (lexical.IsFeature() || lexical.Kind.IsDefinition()) {
				for i, owner := range full[:len(full)-1] {
					if sourceMemberSource(m, owner, lexical) && sourcePathEqual(m, full[i+1:], path) {
						matches = true
						break
					}
				}
			}
			if !matches {
				continue
			}
			text, ok := c.sourceDeclaration(effect.declaration)
			if !ok {
				return "external " + effect.kind + "; applied source unavailable"
			}
			o := effect.declaration.Origin()
			return fmt.Sprintf("external %s affects this occurrence; source-value precedence unsupported; %s@%d:%d: %s", effect.kind, o.Doc, o.Span.Offset, o.Span.Len, text)
		}
	}
	return ""
}

func (c *cachedModel) sourceAttribute(s *symbols.Symbol, owners []*symbols.Symbol, context []string, effects []sourceEffect) SourceAttribute {
	m := c.typedModel()
	a := SourceAttribute{Subject: c.sourceSubject(s), Name: m.EffectiveNameOf(s), Context: append([]string{}, context...)}
	var ok bool
	a.Declaration, ok = c.sourceDeclaration(s)
	if !ok {
		a.Value = sourceUnsupported("missing applied attribute source")
		return a
	}
	types := m.FeatureTypes(s)
	if len(types) == 1 {
		a.Type = c.Index.GetFQN(types[0])
	}
	if why := c.externalSourceEffect(s, owners, effects); why != "" {
		a.Value = sourceUnsupported(why)
		return a
	}
	// An assigned/reference owner may denote another occurrence. Its type's
	// default is not evidence of that object's member values; resolving owner
	// expressions is outside this source-expression projection.
	for _, owner := range owners {
		if _, _, _, assigned := ast.ValuePartOf(owner.Decl); assigned {
			o := owner.Origin()
			a.Value = sourceUnsupported(fmt.Sprintf("owner has an authored value expression; bound-owner member values unsupported; %s@%d:%d", o.Doc, o.Span.Offset, o.Span.Len))
			return a
		}
	}
	// Bindings may override a default without supplying an attribute ValuePart.
	// Until their precedence/provenance is implemented, fail closed for this scope.
	for _, owner := range owners {
		if binding := c.sourceBinding(owner); binding != "" {
			a.Value = sourceUnsupported("standalone binding in usage context; source-value precedence unsupported; " + binding)
			return a
		}
	}
	candidates := map[*symbols.Symbol]bool{}
	for i, owner := range owners {
		relative := append(append([]*symbols.Symbol{}, owners[i+1:]...), s)
		for _, member := range m.MembersOf(owner) {
			for _, rel := range semantics.RelationshipsOf(member) {
				if rel.Kind != ast.RelRedefines {
					continue
				}
				path := m.ChainTargetPath(member, rel.Kind, rel.Target)
				if _, chain := rel.Target.(*ast.FeatureChainExpr); chain && len(path) == 0 {
					a.Value = sourceUnsupported("unresolved contextual redefinition path")
					return a
				}

				if len(path) < 2 || len(path) != len(relative) {
					continue
				}
				match := true
				for j, step := range path {
					if !sourceSpecializes(m, relative[j], step) {
						match = false
						break
					}
				}
				if match {
					candidates[member] = true
				}
			}
		}
	}
	if len(candidates) > 1 {
		a.Value = sourceUnsupported("ambiguous contextual source providers")
		return a
	}
	provider := s
	for candidate := range candidates {
		// A simultaneous nested override and outer chain assignment requires a
		// precedence rule; neither traversal order nor an own default proves it.
		if _, _, _, own := ast.ValuePartOf(s.Decl); own {
			_, def, _, _ := ast.ValuePartOf(s.Decl)
			if !def {
				a.Value = sourceUnsupported("competing own and contextual assignments")
				return a
			}
		}
		provider = candidate
	}
	a.Value = c.sourceValue(s, provider)
	return a
}

// Enrich only after full correspondence exists. IDs, selection, edges, legacy
// declaration strings, and correspondence remain untouched, including Explore.
func (c *cachedModel) sourceValues(out *EvaluatedView, declarations map[string]*symbols.Symbol) error {
	var artifact map[string]json.RawMessage
	if err := json.Unmarshal(out.Artifact, &artifact); err != nil {
		return err
	}
	var nodes []map[string]json.RawMessage
	if err := json.Unmarshal(artifact["nodes"], &nodes); err != nil {
		return err
	}
	refs := map[string]ViewCorrespondence{}
	for _, ref := range out.Correspondence {
		refs[ref.Symbol] = ref
	}
	m := c.typedModel()
	effects := c.sourceEffects()
	for _, node := range nodes {
		var id string
		json.Unmarshal(node["id"], &id)
		ref, ok := refs[id]
		if !ok {
			continue
		}
		sym := declarations[ref.Subject.ID]
		if sym == nil || c.Index.IsLibraryDocument(sym.DocName) {
			continue
		}
		owners := []*symbols.Symbol{}
		valid := true
		for _, key := range ref.Context {
			next := declarations[key]
			if next == nil {
				valid = false
				break
			}
			if len(owners) > 0 {
				matches := []*symbols.Symbol{}
				for _, member := range m.MembersOf(owners[len(owners)-1]) {
					if sourceSpecializes(m, member, next) {
						matches = append(matches, member)
					}
				}
				if len(matches) != 1 {
					valid = false
					break
				}
				next = matches[0]
			}
			owners = append(owners, next)
		}
		if sym.Kind.IsAttributeLike() {
			a := c.sourceAttribute(sym, nil, ref.Context, effects)
			if valid && len(owners) > 0 {
				a = c.sourceAttribute(sym, owners[:len(owners)-1], ref.Context, effects)
				if owners[len(owners)-1] != sym {
					a.Value = sourceUnsupported("attribute occurrence resolves to a different effective member; contextual projection unsupported")
				}
			} else {
				a.Value = sourceUnsupported("usage context cannot be resolved uniquely")
			}
			encoded, err := json.Marshal(a)
			if err != nil {
				return err
			}
			node["sourceAttribute"] = encoded
		}
		effectiveOwner := sym
		if valid && len(owners) > 0 {
			effectiveOwner = owners[len(owners)-1]
		}
		attributes := []SourceAttribute{}
		for _, member := range m.MembersOf(effectiveOwner) {
			if !member.Kind.IsAttributeLike() || c.Index.IsLibraryDocument(member.DocName) {
				continue
			}
			context := append(append([]string{}, ref.Context...), originKey(member.Origin()))
			a := c.sourceAttribute(member, owners, context, effects)
			if !valid {
				a.Value = sourceUnsupported("usage context cannot be resolved uniquely")
			}
			attributes = append(attributes, a)
		}
		if len(attributes) > 0 {
			encoded, err := json.Marshal(attributes)
			if err != nil {
				return err
			}
			node["sourceAttributes"] = encoded
		}
	}
	encoded, err := json.Marshal(nodes)
	if err != nil {
		return err
	}
	artifact["nodes"] = encoded
	out.Artifact, err = json.Marshal(artifact)
	return err
}
