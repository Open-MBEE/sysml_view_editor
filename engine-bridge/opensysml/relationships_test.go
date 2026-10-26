package combined

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"
)

func TestStudioRelationships(t *testing.T) {
	server, err := New("v0.10.0")
	if err != nil {
		t.Fatal(err)
	}
	call := func(method string, params any) map[string]any {
		t.Helper()
		p, _ := json.Marshal(params)
		body, err := server.Call(context.Background(), method, p)
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
		map[string]any{"name": "requirements.sysml", "content": `package Requirements { requirement safety; alias Safe for safety; }`},
		map[string]any{"name": "system.sysml", "content": `package System {
   private import Requirements::*;
   part pump { satisfy Safe; }
   part controller;
   allocation assigned allocate controller to pump;
   verification def Check;
   verification proof : Check { objective { verify safety; } }
  }`},
	}
	parsed := call("ParseSources", map[string]any{"documents": documents, "strictConformance": true})
	result := call("EvaluateRelationships", map[string]any{"modelHash": parsed["modelHash"]})
	if result["status"] != "complete" {
		t.Fatalf("%v", result)
	}
	pairs := map[string][][2]string{}
	for _, raw := range result["relationships"].([]any) {
		edge := raw.(map[string]any)
		from := edge["source"].(map[string]any)
		to := edge["target"].(map[string]any)
		kind := edge["kind"].(string)
		pairs[kind] = append(pairs[kind], [2]string{from["qualifiedName"].(string), to["qualifiedName"].(string)})
		for _, field := range []string{"declaration", "source", "target"} {
			subject := edge[field].(map[string]any)
			if subject["id"] == "" || subject["origin"] == nil {
				t.Fatalf("Missing exact source: %v", edge)
			}
		}
	}
	want := map[string][][2]string{
		"allocation":   {{"System::controller", "System::pump"}},
		"satisfaction": {{"System::pump", "Requirements::safety"}},
		"verification": {{"System::proof", "Requirements::safety"}},
	}
	if !reflect.DeepEqual(pairs, want) {
		t.Fatalf("%v, want %v", pairs, want)
	}
	// Identical calls must not repeat scope aliases or depend on map iteration order.
	again := call("EvaluateRelationships", map[string]any{"modelHash": parsed["modelHash"]})
	if !reflect.DeepEqual(result, again) {
		t.Fatal("Relationship extraction is not deterministic")
	}
	bad := call("ParseSources", map[string]any{"documents": []any{map[string]any{"name": "bad.sysml", "content": "package P { part a { satisfy Missing; } }"}}, "strictConformance": true})
	refused := call("EvaluateRelationships", map[string]any{"modelHash": bad["modelHash"]})
	if refused["status"] != "invalid" || len(refused["relationships"].([]any)) != 0 {
		t.Fatalf("Unresolved model exposed edges: %v", refused)
	}

	empty := call("ParseSources", map[string]any{"documents": []any{map[string]any{"name": "empty.sysml", "content": "package Empty { part pump; }"}}, "strictConformance": true})
	noLinks := call("EvaluateRelationships", map[string]any{"modelHash": empty["modelHash"]})
	if noLinks["status"] != "complete" || len(noLinks["relationships"].([]any)) != 0 {
		t.Fatalf("Valid empty relation set: %v", noLinks)
	}
	unspecified := call("ParseSources", map[string]any{"documents": []any{map[string]any{"name": "allocation.sysml", "content": "package P { allocation unspecified; }"}}, "strictConformance": true})
	noEnds := call("EvaluateRelationships", map[string]any{"modelHash": unspecified["modelHash"]})
	if noEnds["status"] == "complete" || len(noEnds["relationships"].([]any)) != 0 {
		t.Fatalf("Missing endpoints were called complete: %v", noEnds)
	}
	if _, err := server.Call(context.Background(), "EvaluateRelationships", []byte(`{"modelHash":"absent"}`)); err == nil {
		t.Fatal("Missing revision was accepted")
	}
}
