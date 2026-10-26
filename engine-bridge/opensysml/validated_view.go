package combined

import (
	"context"
	"encoding/json"

	"github.com/Open-MBEE/OpenSysML/internal/frontend/engine"
)

// Validate the same cached revision before exposing evaluated content.
func (s *Server) evaluateView(ctx context.Context, params []byte) ([]byte, error) {
	var req engine.JRenderViewRequest
	if err := json.Unmarshal(params, &req); err != nil {
		return nil, err
	}
	body, err := s.core.Call(ctx, "GetDiagnostics", params)
	if err != nil {
		return nil, err
	}
	var validation struct {
		Diagnostics []json.RawMessage `json:"diagnostics"`
	}
	if err = json.Unmarshal(body, &validation); err != nil {
		return nil, err
	}
	for _, diagnostic := range validation.Diagnostics {
		var item struct {
			Severity string `json:"severity"`
		}
		if err = json.Unmarshal(diagnostic, &item); err != nil {
			return nil, err
		}
		if item.Severity == "error" {
			return json.Marshal(map[string]any{"schemaVersion": 1, "modelHash": req.ModelHash, "view": req.View, "status": "invalid", "selected": []any{}, "diagnostics": []string{"Model validation failed; correct source diagnostics before evaluating views."}, "renderStatus": "unavailable", "correspondence": []any{}})
		}
	}
	body, err = s.engine.Call(ctx, "EvaluateView", params)
	if err == nil {
		s.touchRequest(params)
	}
	return body, err
}

func (s *Server) evaluateRelationships(ctx context.Context, params []byte) ([]byte, error) {
	var req engine.JRenderViewRequest
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
			return json.Marshal(map[string]any{"schemaVersion": 1, "modelHash": req.ModelHash, "status": "invalid", "relationships": []any{}, "diagnostics": []string{"Model validation failed; relationship endpoints are unavailable."}})
		}
	}
	body, err = s.engine.Call(ctx, "EvaluateRelationships", params)
	if err == nil {
		s.touchRequest(params)
	}
	return body, err
}
