package combined

import (
	"context"
	"encoding/json"

	"github.com/Open-MBEE/OpenSysML/internal/frontend/engine"
)

// listDocuments resolves document definitions in the cached model.
func (s *Server) listDocuments(ctx context.Context, params []byte) ([]byte, error) {
	body, err := s.engine.Call(ctx, "ListDocuments", params)
	if err == nil {
		s.touchRequest(params)
	}
	return body, err
}

// renderDocument validates the same cached revision before rendering a
// document from it, as evaluateView does for named views.
func (s *Server) renderDocument(ctx context.Context, params []byte) ([]byte, error) {
	var req engine.JRenderDocumentRequest
	if err := json.Unmarshal(params, &req); err != nil {
		return nil, err
	}
	body, err := s.core.Call(ctx, "GetDiagnostics", params)
	if err != nil {
		return nil, err
	}
	var validation struct {
		Diagnostics []struct {
			Severity string `json:"severity"`
		} `json:"diagnostics"`
	}
	if err := json.Unmarshal(body, &validation); err != nil {
		return nil, err
	}
	for _, diagnostic := range validation.Diagnostics {
		if diagnostic.Severity == "error" {
			form := req.Form
			if form == "" {
				form = "html"
			}
			return json.Marshal(engine.RenderedDocument{
				SchemaVersion: 1,
				ModelHash:     req.ModelHash,
				Document:      req.Document,
				Form:          form,
				Status:        "invalid",
				References:    []engine.DocumentReference{},
				Contents:      []engine.DocumentContent{},
				Diagnostics: []engine.DocumentDiagnostic{{
					Stage:    "request",
					Kind:     "modelInvalid",
					Severity: "error",
					Message:  "Model validation failed; correct source diagnostics before rendering documents.",
					Document: req.Document,
				}},
			})
		}
	}
	body, err = s.engine.Call(ctx, "RenderDocument", params)
	if err == nil {
		s.touchRequest(params)
	}
	return body, err
}
