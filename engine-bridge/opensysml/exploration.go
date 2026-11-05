package engine

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/Open-MBEE/OpenSysML/internal/ir/view"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/symbols"
)

type ExplorationScope struct {
	Kind    string `json:"kind"`
	Subject string `json:"subject,omitempty"`
}
type ExplorationRequest struct {
	Scope          ExplorationScope `json:"scope"`
	Representation string           `json:"representation"`
}
type JExploreRequest struct {
	ModelHash string             `json:"modelHash"`
	Request   ExplorationRequest `json:"request"`
}

// Exploration has no authored view identity. Only normalized artifact data is
// shared with named views; the wire envelope cannot become a presentation key.
func (e *Engine) explore(req *JExploreRequest) ([]byte, error) {
	cached, ok := e.get(req.ModelHash)
	if !ok {
		return nil, statusErrorf(codeNotFound, msgModelNotFound, req.ModelHash)
	}
	out := EvaluatedView{SchemaVersion: 1, ModelHash: req.ModelHash, Status: "complete", Selected: []ViewSubject{}, Diagnostics: []string{}, RenderStatus: "unavailable", Correspondence: []ViewCorrespondence{}}
	invalid := func(message string) ([]byte, error) {
		out.Status = "invalid"
		out.Diagnostics = append(out.Diagnostics, message)
		return marshalExploration(out, req.Request)
	}
	scope := req.Request.Scope
	if req.Request.Representation != "tree" && req.Request.Representation != "interconnection" {
		return invalid("Unsupported exploration representation.")
	}
	if scope.Kind != "element" && req.Request.Representation != "tree" {
		return invalid("Project and package exploration require an overview tree.")
	}
	selected := []*symbols.Symbol{}
	if scope.Kind == "project" && scope.Subject == "" {
		seen := map[*symbols.Symbol]bool{}
		for _, doc := range cached.Documents {
			root := cached.Index.DocumentRoot(doc.Source.Name())
			if root == nil {
				continue
			}
			for _, sym := range root.AllMembers() {
				if sym.Origin().Located() && !cached.Index.IsLibraryDocument(sym.DocName) && !seen[sym] {
					seen[sym] = true
					selected = append(selected, sym)
				}
			}
		}
		sort.Slice(selected, func(i, j int) bool {
			return originKey(selected[i].Origin()) < originKey(selected[j].Origin())
		})
	} else if (scope.Kind == "package" || scope.Kind == "element") && scope.Subject != "" {
		matches := lookupNamed(cached.Index, scope.Subject)
		if len(matches) != 1 || !matches[0].Origin().Located() || cached.Index.IsLibraryDocument(matches[0].DocName) {
			return invalid("Choose one unambiguous project declaration.")
		}
		sym := matches[0]
		if scope.Kind == "package" && sym.Kind != symbols.SymbolPackage {
			return invalid("Package exploration requires a package declaration.")
		}
		if req.Request.Representation == "interconnection" && sym.Kind != symbols.SymbolPartDef && sym.Kind != symbols.SymbolPartUsage {
			return invalid("Structural exploration requires an explicit part definition or usage.")
		}
		selected = append(selected, sym)
	} else {
		return invalid("Invalid exploration scope.")
	}
	cached.typed = nil
	typed := cached.typedModel()
	renderer := view.NewRenderer(typed, cached.resolver, cached.sourceText())
	rendering, err := renderer.RenderExposed(selected, view.Kind(req.Request.Representation), "Read-only exploration")
	if err != nil {
		out.RenderStatus = "unsupported"
		out.Diagnostics = append(out.Diagnostics, err.Error())
		return marshalExploration(out, req.Request)
	}
	raw, err := cached.normalizedRendering(out, selected, rendering)
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("normalize exploration: %w", err)
	}
	return marshalExploration(out, req.Request)
}

func marshalExploration(out EvaluatedView, request ExplorationRequest) ([]byte, error) {
	// Drop the named-view field rather than serialize an invented view identity.
	raw, err := json.Marshal(out)
	if err != nil {
		return nil, err
	}
	var result map[string]json.RawMessage
	if err = json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	delete(result, "view")
	result["request"], err = json.Marshal(request)
	if err != nil {
		return nil, err
	}
	return json.Marshal(result)
}
