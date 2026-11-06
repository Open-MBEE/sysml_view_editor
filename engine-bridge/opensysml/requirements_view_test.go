package combined

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestStudioRequirementsNotation(t *testing.T) {
	server, err := New("v0.12.0")
	if err != nil {
		t.Fatal(err)
	}
	call := func(method string, params any) map[string]any {
		t.Helper()
		body, _ := json.Marshal(params)
		raw, err := server.Call(context.Background(), method, body)
		if err != nil {
			t.Fatal(err)
		}
		var out map[string]any
		if err = json.Unmarshal(raw, &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	prose := "The capacity requirement shall retain its full café documentation even when it exceeds sixty characters."
	model := `package P {
 part def Device; part a : Device;
 requirement def <'REQ-BASE'> Base { doc /* ` + prose + ` */ }
 requirement spec { requirement <'REQ-ONE'> one : Base; requirement two : Base; }
 satisfy spec.one by a;
 assert not satisfy spec.two by a;
}
package V { private import StandardViewDefinitions::*;
 view complete : GeneralView { filter @SysML::RequirementDefinition or @SysML::RequirementUsage; expose P::**; }
 view compact : GeneralView { filter @SysML::RequirementDefinition or @SysML::RequirementUsage; expose P::Base; expose P::spec; }
}`
	parsed := call("ParseSources", map[string]any{"documents": []any{map[string]any{"name": "requirements.sysml", "content": model}}, "strictConformance": true})
	for _, view := range []string{"V::complete", "V::compact"} {
		result := call("EvaluateView", map[string]any{"modelHash": parsed["modelHash"], "view": view})
		if result["status"] != "complete" || result["renderStatus"] != "available" {
			t.Fatalf("%v", result)
		}
		artifact := result["artifact"].(map[string]any)
		if artifact["kind"] != "requirement" {
			t.Fatalf("%v", artifact)
		}
		names := map[string]string{}
		for _, raw := range artifact["nodes"].([]any) {
			node := raw.(map[string]any)
			names[node["id"].(string)] = node["name"].(string)
			if node["name"] == "P::Base" {
				if node["shortName"] != "REQ-BASE" || node["documentation"].([]any)[0] != prose {
					t.Fatalf("Full own AST metadata missing: %v", node)
				}
				if !strings.Contains(node["detail"].(string), "...") {
					t.Fatalf("Expected native truncated detail separately: %v", node)
				}
			}
			if node["name"] == "P::a" && node["exposure"] != "contextual" {
				t.Fatalf("Satisfier falsely selected: %v", node)
			}
			if strings.HasPrefix(node["name"].(string), "P::") && node["name"] != "P::a" && node["exposure"] != "selected" {
				t.Fatalf("Requirement selection lost: %v", node)
			}
		}
		direct, via, positive, negative := false, false, false, false
		for _, raw := range artifact["edges"].([]any) {
			edge := raw.(map[string]any)
			if edge["kind"] == "composition" {
				if edge["ownership"] == "direct" {
					direct = true
				}
				if edge["ownership"] == "via-type" {
					via = true
				}
			}
			if edge["kind"] == "satisfy" {
				switch names[edge["to"].(string)] {
				case "P::spec::one":
					positive = edge["negated"] == false && edge["asserted"] == false
				case "P::spec::two":
					negative = edge["negated"] == true && edge["asserted"] == true
				}
			}
		}
		if view == "V::complete" && (!direct || via || !positive || !negative) {
			t.Fatalf("Lost hierarchy/polarity: %v", artifact)
		}
		if view == "V::compact" && !via {
			t.Fatalf("Hidden member to type was not distinguished: %v", artifact)
		}
	}
}
