package engine

import (
	"fmt"
	"sort"

	"github.com/Open-MBEE/OpenSysML/internal/semantic/semantics"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/symbols"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/ast"
)

type StudioRelationship struct {
	Kind        string      `json:"kind"`
	Declaration ViewSubject `json:"declaration"`
	Source      ViewSubject `json:"source"`
	Target      ViewSubject `json:"target"`
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
	diagnostics := []string{}
	seen := map[*symbols.Symbol]bool{}
	var visit func(*symbols.Symbol)
	visit = func(sym *symbols.Symbol) {
		if sym == nil || seen[sym] || cached.Index.IsLibraryDocument(sym.DocName) {
			return
		}
		seen[sym] = true
		before := len(edges)
		for _, kind := range []semantics.RelationshipKind{semantics.RelationshipAllocation, semantics.RelationshipSatisfaction, semantics.RelationshipVerification} {
			for _, edge := range typed.RelationshipEdgesOf(sym, kind) {
				if edge.Source != nil && edge.Target != nil {
					edges = append(edges, StudioRelationship{Kind: string(kind), Declaration: subject(sym), Source: subject(edge.Source), Target: subject(edge.Target)})
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
	status := "complete"
	if len(diagnostics) > 0 {
		status = "indeterminate"
		edges = []StudioRelationship{}
		sort.Strings(diagnostics)
	}
	return marshal(map[string]any{"schemaVersion": 1, "modelHash": req.ModelHash, "status": status, "relationships": edges, "diagnostics": diagnostics})
}
