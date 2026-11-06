package combined

import (
	"context"
	"encoding/json"
	"testing"
)

func TestStudioExploration(t *testing.T) {
	server, err := New("v0.12.0")
	if err != nil {
		t.Fatal(err)
	}
	call := func(method string, params any) map[string]any {
		t.Helper()
		raw, _ := json.Marshal(params)
		body, err := server.Call(context.Background(), method, raw)
		if err != nil {
			t.Fatal(err)
		}
		var out map[string]any
		if err := json.Unmarshal(body, &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	documents := []any{
		map[string]any{"name": "model.sysml", "content": "package P { /* 🔧 */ part def Motor; part def System { part primary : Motor; part standby : Motor; } part system : System; }"},
		map[string]any{"name": "other.sysml", "content": "package Q { part def Other; part other : Other; }"},
	}
	parsed := call("ParseSources", map[string]any{"documents": documents, "strictConformance": true})
	for _, tc := range []struct {
		kind, subject, representation string
		count                         int
	}{
		{"project", "", "tree", 9}, {"package", "P", "tree", 6},
		{"element", "P::system", "tree", 1}, {"element", "P::System", "interconnection", 3}, {"element", "P::system", "interconnection", 1},
	} {
		scope := map[string]any{"kind": tc.kind}
		if tc.subject != "" {
			scope["subject"] = tc.subject
		}
		result := call("Explore", map[string]any{"modelHash": parsed["modelHash"], "request": map[string]any{"scope": scope, "representation": tc.representation}})
		if result["status"] != "complete" || result["renderStatus"] != "available" || result["view"] != nil {
			t.Fatalf("%v", result)
		}
		artifact := result["artifact"].(map[string]any)
		if artifact["kind"] != tc.representation || len(artifact["nodes"].([]any)) != tc.count {
			t.Fatalf("%v", artifact)
		}
		if _, ok := artifact["edges"].([]any); !ok {
			t.Fatalf("Missing empty edge array: %v", artifact)
		}
		for _, raw := range result["correspondence"].([]any) {
			item := raw.(map[string]any)
			if item["subject"].(map[string]any)["origin"] == nil {
				t.Fatalf("Missing origin: %v", item)
			}
		}
	}
	for _, scope := range []map[string]any{{"kind": "package", "subject": "P::Motor"}, {"kind": "element", "subject": "Missing"}, {"kind": "element", "subject": "Base::Anything"}} {
		result := call("Explore", map[string]any{"modelHash": parsed["modelHash"], "request": map[string]any{"scope": scope, "representation": "tree"}})
		if result["status"] != "invalid" || result["artifact"] != nil {
			t.Fatalf("%v", result)
		}
	}
	after := call("ParseSources", map[string]any{"documents": documents, "strictConformance": true})
	if after["modelHash"] != parsed["modelHash"] {
		t.Fatal("Exploration changed source")
	}
	invalid := call("ParseSources", map[string]any{"documents": []any{map[string]any{"name": "bad.sysml", "content": "package Bad { part p : Missing; }"}}, "strictConformance": true})
	rejected := call("Explore", map[string]any{"modelHash": invalid["modelHash"], "request": map[string]any{"scope": map[string]any{"kind": "project"}, "representation": "tree"}})
	if rejected["status"] != "invalid" || rejected["artifact"] != nil {
		t.Fatalf("%v", rejected)
	}
}
