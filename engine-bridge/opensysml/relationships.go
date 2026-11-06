package engine

import (
	"fmt"
	"sort"

	"github.com/Open-MBEE/OpenSysML/internal/semantic/semantics"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/symbols"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/ast"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/source"
)

type StudioRelationship struct {
	Kind        string      `json:"kind"`
	Negated     bool        `json:"negated"`
	Asserted    bool        `json:"asserted"`
	Declaration ViewSubject `json:"declaration"`
	Source      ViewSubject `json:"source"`
	Target      ViewSubject `json:"target"`
}

type StudioRequirement struct {
	Subject       ViewSubject `json:"subject"`
	Kind          string      `json:"kind"`
	ShortName     string      `json:"shortName"`
	Documentation []string    `json:"documentation"`
}

// These are declared, resolved relationships, not satisfaction or verification verdicts.
func (e *Engine) studioRelationships(req *JRenderViewRequest) ([]byte, error) {
	cached, ok := e.get(req.ModelHash)
	if !ok {
		return nil, statusErrorf(codeNotFound, msgModelNotFound, req.ModelHash)
	}
	typed := cached.typedModel()
	subject := func(sym *symbols.Symbol) ViewSubject {
		origin := sym.Origin()
		ref := ViewSubject{ID: originKey(origin), QualifiedName: cached.Index.GetFQN(sym)}
		if origin.Located() {
			ref.Origin = &ViewOrigin{File: origin.Doc, Offset: origin.Span.Offset, Length: origin.Span.Len, NameOffset: origin.Name.Offset, NameLength: origin.Name.Len}
		}
		if ref.ID == "" {
			ref.ID = "unlocated:" + ref.QualifiedName
		}
		return ref
	}
	edges := []StudioRelationship{}
	requirements := []StudioRequirement{}
	diagnostics := []string{}
	seen := map[*symbols.Symbol]bool{}
	var visit func(*symbols.Symbol)
	visit = func(sym *symbols.Symbol) {
		if sym == nil || seen[sym] || cached.Index.IsLibraryDocument(sym.DocName) {
			return
		}
		seen[sym] = true
		isRequirement := sym.Kind == symbols.SymbolRequirementDef
		if usage, ok := sym.Decl.(*ast.Usage); ok && usage.Kind == ast.UsageRequirement {
			isRequirement = true
		}
		if isRequirement {
			row := StudioRequirement{Subject: subject(sym), Kind: sym.Kind.String(), ShortName: sym.ShortName, Documentation: []string{}}
			if sym.Scope != nil {
				sym.Scope.ForEachMember(func(member *symbols.Symbol) bool {
					if doc, ok := member.Decl.(*ast.Documentation); ok {
						if body := source.CommentProse(cached.sourceText()(member.DocName, doc.BodySpan)); body != "" {
							row.Documentation = append(row.Documentation, body)
						}
					}
					return true
				})
			}
			requirements = append(requirements, row)
		}
		before := len(edges)
		for _, kind := range []semantics.RelationshipKind{semantics.RelationshipAllocation, semantics.RelationshipSatisfaction, semantics.RelationshipVerification} {
			for _, edge := range typed.RelationshipEdgesOf(sym, kind) {
				if edge.Source != nil && edge.Target != nil {
					link := StudioRelationship{Kind: string(kind), Declaration: subject(sym), Source: subject(edge.Source), Target: subject(edge.Target)}
					if usage, ok := sym.Decl.(*ast.Usage); ok {
						link.Negated = usage.IsNegated
						link.Asserted = usage.PrefixKeyword == "assert"
					}
					edges = append(edges, link)
				}
			}
		}
		if usage, ok := sym.Decl.(*ast.Usage); ok && (usage.Kind == ast.UsageAllocation || usage.Kind == ast.UsageSatisfy) && before == len(edges) {
			diagnostics = append(diagnostics, fmt.Sprintf("No resolved supported endpoints for declaration %s", subject(sym).ID))
		}
		if sym.Scope != nil {
			for _, member := range sym.Scope.AllMembers() {
				visit(member)
			}
		}
	}
	cached.Index.Registered(func(_ string, syms []*symbols.Symbol) {
		for _, sym := range syms {
			visit(sym)
		}
	})
	sort.Slice(edges, func(i, j int) bool {
		a, b := edges[i], edges[j]
		if a.Declaration.ID != b.Declaration.ID {
			return a.Declaration.ID < b.Declaration.ID
		}
		if a.Kind != b.Kind {
			return a.Kind < b.Kind
		}
		if a.Source.ID != b.Source.ID {
			return a.Source.ID < b.Source.ID
		}
		return a.Target.ID < b.Target.ID
	})
	sort.Slice(requirements, func(i, j int) bool { return requirements[i].Subject.ID < requirements[j].Subject.ID })
	status := "complete"
	if len(diagnostics) > 0 {
		status = "indeterminate"
		edges = []StudioRelationship{}
		requirements = []StudioRequirement{}
		sort.Strings(diagnostics)
	}
	return marshal(map[string]any{"schemaVersion": 1, "modelHash": req.ModelHash, "status": status, "relationships": edges, "requirements": requirements, "diagnostics": diagnostics})
}
