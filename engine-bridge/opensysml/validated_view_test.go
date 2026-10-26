package combined

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestStudioStructuralAssembly(t *testing.T) {
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
		var result map[string]any
		if err := json.Unmarshal(body, &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	documents := []any{}
	for _, name := range []string{"model.sysml", "views.sysml"} {
		content, err := os.ReadFile("testdata/studio-assembly/" + name)
		if err != nil {
			t.Fatal(err)
		}
		documents = append(documents, map[string]any{"name": name, "content": string(content)})
	}
	parsed := call("ParseSources", map[string]any{"strictConformance": true, "documents": documents})
	result := call("EvaluateView", map[string]any{"modelHash": parsed["modelHash"], "view": "AssemblyViews::structure"})
	if result["status"] != "complete" || result["renderStatus"] != "available" {
		t.Fatalf("%v", result)
	}
	artifact := result["artifact"].(map[string]any)
	nodes := map[string]map[string]any{}
	for _, raw := range artifact["nodes"].([]any) {
		node := raw.(map[string]any)
		nodes[node["name"].(string)] = node
	}
	if nodes["bay"]["parent"] != nodes["Assembly::Station"]["id"] || nodes["primary"]["parent"] != nodes["bay"]["id"] || nodes["standby"]["parent"] != nodes["bay"]["id"] {
		t.Fatalf("Incorrect nested ownership: %v", artifact)
	}
	if nodes["monitor"]["reference"] != true {
		t.Fatal("Reference modifier was lost")
	}
	ports := map[string]map[string]map[string]any{}
	for _, name := range []string{"primary", "standby", "monitor"} {
		ports[name] = map[string]map[string]any{}
		for _, raw := range nodes[name]["ports"].([]any) {
			port := raw.(map[string]any)
			ports[name][port["name"].(string)] = port
		}
		for port, direction := range map[string]string{"input": "in", "output": "out", "service": "inout"} {
			if ports[name][port]["direction"] != direction {
				t.Fatalf("Lost %s.%s direction: %v", name, port, ports[name][port])
			}
		}
	}
	edges := artifact["edges"].([]any)
	if len(edges) != 1 {
		t.Fatalf("Expected one resolved connector: %v", edges)
	}
	edge := edges[0].(map[string]any)
	if edge["from"] != nodes["primary"]["id"] || edge["fromPort"] != ports["primary"]["output"]["id"] || edge["to"] != nodes["standby"]["id"] || edge["toPort"] != ports["standby"]["input"]["id"] {
		t.Fatalf("Wrong port endpoints: %v", edge)
	}
	contexts := map[string]string{}
	for _, raw := range result["correspondence"].([]any) {
		item := raw.(map[string]any)
		if item["subject"].(map[string]any)["qualifiedName"] == "Assembly::Device::output" {
			data, _ := json.Marshal(item["context"])
			contexts[item["symbol"].(string)] = string(data)
		}
	}
	left := contexts[ports["primary"]["output"]["id"].(string)]
	right := contexts[ports["standby"]["output"]["id"].(string)]
	if left == "" || right == "" || left == right {
		t.Fatalf("Repeated ports lost their usage contexts: %v", contexts)
	}
	other := call("EvaluateView", map[string]any{"modelHash": parsed["modelHash"], "view": "AssemblyViews::devices"})
	if other["status"] != "complete" || other["renderStatus"] != "available" {
		t.Fatalf("%v", other)
	}
	notices := other["artifact"].(map[string]any)["notices"].([]any)
	found := false
	for _, raw := range notices {
		if strings.Contains(raw.(string), "Inspect") && strings.Contains(raw.(string), "not shown") {
			found = true
		}
	}
	if !found {
		t.Fatalf("Unsupported exposed behavior was not reported: %v", notices)
	}
}

func TestStudioEvaluatedView(t *testing.T) {
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
		var value map[string]any
		if err = json.Unmarshal(body, &value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	model := `metadata def Safety;
 package Lib { #Safety part def A; part def B; port def Signal;
 part def Motor {inout port bus : Signal;}
 part def Rig {part left : Motor; part right : Motor; connection link connect left.bus to right.bus;}}
 `
	for _, test := range []struct {
		name, view, status, render string
		selected                   int
	}{
		{"wildcard", "view candidate : StandardViewDefinitions::GeneralView {expose Lib::*;}", "complete", "available", 5},
		{"filter", "view candidate : StandardViewDefinitions::GeneralView {filter @Safety; expose Lib::*;}", "complete", "available", 1},
		{"empty", "view candidate : StandardViewDefinitions::GeneralView {filter false; expose Lib::*;}", "complete", "available", 0},
		{"invalid-filter", "view candidate : StandardViewDefinitions::GeneralView {filter 7; expose Lib::*;}", "invalid", "unavailable", 0},
		{"missing-exposure", "view candidate : StandardViewDefinitions::GeneralView {expose Missing::Thing;}", "invalid", "unavailable", 0},
		{"geometry", "view candidate : StandardViewDefinitions::GeometryView {expose Lib::Rig;}", "complete", "unsupported", 1},
		{"pair", "view candidate : StandardViewDefinitions::InterconnectionView {expose Lib::Rig;}", "complete", "available", 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			parsed := call("ParseSources", map[string]any{"strictConformance": true, "documents": []any{map[string]any{"name": "model.sysml", "content": model}, map[string]any{"name": "view.sysml", "content": test.view}}})
			result := call("EvaluateView", map[string]any{"modelHash": parsed["modelHash"], "view": "candidate"})
			if result["status"] != test.status || result["renderStatus"] != test.render {
				t.Fatalf("%v", result)
			}
			selected := result["selected"].([]any)
			if len(selected) != test.selected {
				t.Fatalf("selected %d: %v", len(selected), result)
			}
			if test.name == "pair" {
				correspondence := result["correspondence"].([]any)
				contexts := map[string]bool{}
				for _, raw := range correspondence {
					item := raw.(map[string]any)
					subject := item["subject"].(map[string]any)
					if subject["qualifiedName"] == "Lib::Motor::bus" {
						context, _ := json.Marshal(item["context"])
						contexts[string(context)] = true
						if subject["origin"] == nil {
							t.Fatal("Missing inherited port origin")
						}
					}
				}
				if len(contexts) != 2 {
					t.Fatalf("Expected distinct port contexts: %v", correspondence)
				}
			}
		})
	}
}

func TestStudioGeometryDimensions(t *testing.T) {
	server, err := New("v0.10.0")
	if err != nil {
		t.Fatal(err)
	}
	call := func(method string, params any) map[string]any {
		t.Helper()
		data, _ := json.Marshal(params)
		body, err := server.Call(context.Background(), method, data)
		if err != nil {
			t.Fatal(err)
		}
		var result map[string]any
		if err = json.Unmarshal(body, &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	for _, test := range []struct {
		name, body string
		available  bool
	}{
		{"box", `item crate : ShapeItems::Box { :>> length = 200 [SI::cm]; :>> width = 1 [SI::m]; :>> height = 0.5 [SI::m]; }`, true},
		{"missing", `item crate : ShapeItems::Box;`, false},
		{"not-box", `part def Crate; part crate : Crate;`, false},
		{"void", `item crate : ShapeItems::Box { :>> length = 2 [SI::m]; :>> width = 1 [SI::m]; :>> height = 1 [SI::m]; item :>> voids : ShapeItems::Cylinder { :>> radius = 0.1 [SI::m]; :>> height = 1 [SI::m]; } }`, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			source := `package GeometryDemo { ` + test.body + ` view scene : StandardViewDefinitions::GeometryView { expose crate; } }`
			parsed := call("ParseSources", map[string]any{"strictConformance": true, "documents": []any{map[string]any{"name": "geometry.sysml", "content": source}}})
			result := call("EvaluateView", map[string]any{"modelHash": parsed["modelHash"], "view": "GeometryDemo::scene"})
			if test.available {
				if result["status"] != "complete" || result["renderStatus"] != "available" {
					t.Fatalf("%v", result)
				}
				artifact := result["artifact"].(map[string]any)
				nodes := artifact["nodes"].([]any)
				solid := nodes[0].(map[string]any)["solid"].(map[string]any)
				if solid["length"] != float64(2) || solid["width"] != float64(1) || solid["height"] != 0.5 {
					t.Fatalf("Expected normalized metre dimensions: %v", solid)
				}
				if len(result["correspondence"].([]any)) != 1 {
					t.Fatal("Missing solid source correspondence")
				}
			} else if result["renderStatus"] == "available" {
				t.Fatalf("Unsupported geometry was rendered: %v", result)
			}
		})
	}
}

func TestStudioGeometryPlacement(t *testing.T) {
	server, err := New("v0.10.0")
	if err != nil {
		t.Fatal(err)
	}
	call := func(method string, params any) map[string]any {
		t.Helper()
		data, _ := json.Marshal(params)
		body, err := server.Call(context.Background(), method, data)
		if err != nil {
			t.Fatal(err)
		}
		var result map[string]any
		if err = json.Unmarshal(body, &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	model := `package GeometryDemo {
 attribute datum : ISQ::CartesianSpatial3dCoordinateFrame { :>> mRefs = (SI::mm, SI::mm, SI::mm); }
 item crate : ShapeItems::Box {
 :>> length = 200 [SI::cm]; :>> width = 1 [SI::m]; :>> height = 0.5 [SI::m];
 attribute coordinateFrame : ISQ::CartesianSpatial3dCoordinateFrame {
 :>> mRefs = (SI::m, SI::m, SI::m);
 :>> transformation : MeasurementReferences::CoordinateFramePlacement {
 :>> source = datum; :>> origin = (3000.0, 2000.0, 1000.0) [datum];
 :>> basisDirections = ((0.0,1.0,0.0) [datum],(-1.0,0.0,0.0) [datum],(0.0,0.0,1.0) [datum]);
 }
 }
 }
 view scene : StandardViewDefinitions::GeometryView { expose crate; }
 }`
	parsed := call("ParseSources", map[string]any{"strictConformance": true, "documents": []any{map[string]any{"name": "geometry.sysml", "content": model}}})
	result := call("EvaluateView", map[string]any{"modelHash": parsed["modelHash"], "view": "GeometryDemo::scene"})
	if result["status"] != "complete" || result["renderStatus"] != "available" {
		t.Fatalf("%v", result)
	}
	node := result["artifact"].(map[string]any)["nodes"].([]any)[0].(map[string]any)
	placement, ok := node["placement"].(map[string]any)
	if !ok {
		t.Fatalf("No modeled placement: %v", node)
	}
	if placement["frame"] != "GeometryDemo::datum" {
		t.Fatalf("%v", placement)
	}
	origin := placement["origin"].([]any)
	if origin[0] != float64(3) || origin[1] != float64(2) || origin[2] != float64(1) {
		t.Fatalf("Unnormalized origin: %v", origin)
	}
	basis := placement["basis"].([]any)
	if basis[0].([]any)[1] != float64(-1) || basis[1].([]any)[0] != float64(1) {
		t.Fatalf("Incorrect evaluated orientation: %v", basis)
	}

	for _, invalid := range []string{
		strings.Replace(model, "(0.0,1.0,0.0) [datum]", "(0.0,0.0,0.0) [datum]", 1),
		strings.Replace(model, ":>> mRefs = (SI::m, SI::m, SI::m);", ":>> mRefs = (SI::s, SI::s, SI::s);", 1),
	} {
		parsed := call("ParseSources", map[string]any{"strictConformance": true, "documents": []any{map[string]any{"name": "geometry.sysml", "content": invalid}}})
		rejected := call("EvaluateView", map[string]any{"modelHash": parsed["modelHash"], "view": "GeometryDemo::scene"})
		if rejected["renderStatus"] == "available" {
			t.Fatalf("Invalid placement was rendered: %v", rejected)
		}
	}
}
