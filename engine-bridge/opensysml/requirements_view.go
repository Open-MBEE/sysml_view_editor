package engine

import (
	"encoding/json"

	"github.com/Open-MBEE/OpenSysML/internal/ir/view"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/symbols"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/ast"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/source"
)

// requirementNotation enriches the native graph by its recorded origins. It
// does not change the native exposed set, related context, topology or order.
func (m *cachedModel) requirementNotation(raw json.RawMessage, data view.Data, selected []ViewSubject, declarations map[string]*symbols.Symbol) (json.RawMessage, error) {
	var base JRenderViewResponse
	if err := json.Unmarshal(raw, &base); err != nil {
		return nil, err
	}
	type node struct {
		JRenderNode
		ShortName     string   `json:"shortName,omitempty"`
		Documentation []string `json:"documentation,omitempty"`
		Exposure      string   `json:"exposure"`
	}
	type edge struct {
		JRenderEdge
		Negated   *bool  `json:"negated,omitempty"`
		Asserted  *bool  `json:"asserted,omitempty"`
		Ownership string `json:"ownership,omitempty"`
	}
	out := struct {
		*JRenderViewResponse
		Nodes []node `json:"nodes"`
		Edges []edge `json:"edges"`
	}{JRenderViewResponse: &base, Nodes: []node{}, Edges: []edge{}}
	exposed := map[string]bool{}
	for _, item := range selected {
		exposed[item.ID] = true
	}
	// Anonymous satisfy/assert declarations are scope members but are not
	// registered by a qualified name. Resolve their recorded origins as well.
	seen := map[*symbols.Symbol]bool{}
	var visit func(*symbols.Symbol)
	visit = func(sym *symbols.Symbol) {
		if sym == nil || seen[sym] || m.Index.IsLibraryDocument(sym.DocName) {
			return
		}
		seen[sym] = true
		key := originKey(sym.Origin())
		if key != "" && declarations[key] == nil {
			declarations[key] = sym
		}
		if sym.Scope != nil {
			for _, member := range sym.Scope.AllMembers() {
				visit(member)
			}
		}
	}
	m.Index.Registered(func(_ string, syms []*symbols.Symbol) {
		for _, sym := range syms {
			visit(sym)
		}
	})
	text := m.sourceText()
	origins := map[string]string{}
	for i, native := range data.Nodes {
		origin := originKey(native.Origin)
		origins[native.ID] = origin
		item := node{JRenderNode: base.Nodes[i], Exposure: "contextual"}
		if exposed[origin] {
			item.Exposure = "selected"
		}
		if sym := declarations[origin]; sym != nil {
			item.ShortName = sym.ShortName
			if sym.Scope != nil && text != nil {
				sym.Scope.ForEachMember(func(member *symbols.Symbol) bool {
					if doc, ok := member.Decl.(*ast.Documentation); ok {
						if body := source.CommentProse(text(member.DocName, doc.BodySpan)); body != "" {
							item.Documentation = append(item.Documentation, body)
						}
					}
					return true
				})
			}
		}
		out.Nodes = append(out.Nodes, item)
	}
	for i, native := range data.Edges {
		item := edge{JRenderEdge: base.Edges[i]}
		sym := declarations[originKey(native.Origin)]
		if sym != nil {
			if usage, ok := sym.Decl.(*ast.Usage); ok {
				switch item.Kind {
				case "satisfy":
					negated, asserted := usage.IsNegated, usage.PrefixKeyword == "assert"
					item.Negated, item.Asserted = &negated, &asserted
				case "composition", "reference":
					item.Ownership = "via-type"
					if origins[item.To] == originKey(native.Origin) {
						item.Ownership = "direct"
					}
				}
			}
		}
		out.Edges = append(out.Edges, item)
	}
	return json.Marshal(out)
}
