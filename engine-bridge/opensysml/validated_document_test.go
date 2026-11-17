package combined

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

const studioDocumentModel = `package Demo {
	private import DocumentQueries::*;
	private import KerML::Root::Element;
	private import ScalarValues::*;
	private import StandardViewDefinitions::*;

	part def Subsystem {
		attribute mass : Real;
	}
	part vehicle {
		part motor : Subsystem {
			attribute redefines mass = 2.0;
		}
		part chassis : Subsystem {
			attribute redefines mass = 5.0;
		}
	}
	requirement massLimit {
		doc /* Keep the vehicle light. */
	}
	view structureView : InterconnectionView {
		expose vehicle;
	}

	calc def Parts :> Query {
		in root : Element;
		Project(
			source = WhereType(
				source = Descendants(source = root, maxDepth = 2),
				type = "PartUsage"
			),
			properties = ("name", "mass")
		)
	}

	part def Report :> Document {
		attribute redefines title = "Demo Report";
		part intro : Paragraph {
			part lead : Span {
				:>> text = "The vehicle is bounded by";
			}
			part limit : Ref {
				ref redefines target = massLimit;
			}
		}
		part structure : Section {
			attribute redefines title = "Structure";
			part parts : Table {
				attribute redefines caption = "Parts by mass";
				calc rows : Parts {
					in root = vehicle;
				}
			}
		}
		part diagrams : Section {
			attribute redefines title = "Diagrams";
			part layout : Diagram {
				attribute redefines caption = "Vehicle interconnection";
				ref redefines source = structureView;
			}
		}
	}
}`

const studioBrokenDocumentModel = `package Demo {
	private import DocumentQueries::*;

	part def Broken :> Document {
		attribute redefines title = "Broken Report";
		part orphan : Table {
			attribute redefines caption = "No query";
		}
	}
}`

type studioCall = func(method string, params any) (map[string]any, error)

// studioDocumentServer parses one model and returns callers for the validated
// combined surface and for the engine behind it.
func studioDocumentServer(t *testing.T, content string) (call, direct studioCall, hash string) {
	t.Helper()
	server, err := New("v0.12.0")
	if err != nil {
		t.Fatal(err)
	}
	caller := func(invoke func(context.Context, string, []byte) ([]byte, error)) studioCall {
		return func(method string, params any) (map[string]any, error) {
			p, _ := json.Marshal(params)
			body, err := invoke(context.Background(), method, p)
			if err != nil {
				return nil, err
			}
			var out map[string]any
			if err := json.Unmarshal(body, &out); err != nil {
				t.Fatal(err)
			}
			return out, nil
		}
	}
	call, direct = caller(server.Call), caller(server.engine.Call)
	parsed, err := call("ParseSources", map[string]any{
		"documents":         []any{map[string]any{"name": "model.sysml", "content": content}},
		"strictConformance": true,
	})
	if err != nil {
		t.Fatal(err)
	}
	return call, direct, parsed["modelHash"].(string)
}

func TestStudioListDocuments(t *testing.T) {
	call, _, hash := studioDocumentServer(t, studioDocumentModel)
	result, err := call("ListDocuments", map[string]any{"modelHash": hash})
	if err != nil {
		t.Fatal(err)
	}
	if result["schemaVersion"] != float64(1) || result["modelHash"] != hash {
		t.Fatalf("Envelope mismatch: %v", result)
	}
	documents := result["documents"].([]any)
	if len(documents) != 1 {
		t.Fatalf("Expected the one document definition, got %v", documents)
	}
	names := []string{}
	for _, raw := range documents {
		item := raw.(map[string]any)
		names = append(names, item["qualifiedName"].(string))
		origin, ok := item["origin"].(map[string]any)
		if !ok || origin["file"] != "model.sysml" || origin["length"].(float64) <= 0 || origin["nameLength"].(float64) <= 0 {
			t.Fatalf("Document lost its declaring location: %v", item)
		}
	}
	if strings.Join(names, ",") != "Demo::Report" {
		t.Fatalf("Unexpected document order: %v", names)
	}
}

func TestStudioRenderDocumentHTML(t *testing.T) {
	call, _, hash := studioDocumentServer(t, studioDocumentModel)
	result, err := call("RenderDocument", map[string]any{"modelHash": hash, "document": "Demo::Report", "form": "html"})
	if err != nil {
		t.Fatal(err)
	}
	if result["status"] != "complete" || result["form"] != "html" || result["document"] != "Demo::Report" || result["title"] != "Demo Report" {
		t.Fatalf("%v", result)
	}
	content := result["content"].(string)
	for _, fragment := range []string{
		`class="sysml-document"`,
		`class="sysml-section"`,
		`data-name="structure"`,
		`Demo Report`,
		`data-element="Demo::vehicle::motor"`,
		`data-element="Demo::massLimit"`,
		`class="sysml-diagram"`,
		`data-view="Demo::structureView"`,
	} {
		if !strings.Contains(content, fragment) {
			t.Fatalf("HTML lacks %s:\n%s", fragment, content)
		}
	}
	if strings.Contains(content, "<script") || strings.Contains(content, "<!DOCTYPE") || strings.Contains(content, "<style") {
		t.Fatalf("Fragment rendering leaked a page or script:\n%s", content)
	}
	references := map[string]map[string]any{}
	for _, raw := range result["references"].([]any) {
		item := raw.(map[string]any)
		references[item["qualifiedName"].(string)] = item
	}
	for _, name := range []string{"Demo::vehicle::motor", "Demo::vehicle::chassis", "Demo::massLimit"} {
		item, ok := references[name]
		if !ok {
			t.Fatalf("Reference %s missing from %v", name, references)
		}
		origin := item["origin"].(map[string]any)
		if origin["file"] != "model.sysml" || origin["length"].(float64) <= 0 {
			t.Fatalf("Reference %s lost its origin: %v", name, item)
		}
	}
	if references["Demo::massLimit"]["kind"] != "requirementUsage" || references["Demo::vehicle::motor"]["kind"] != "partUsage" {
		t.Fatalf("Reference kinds were not resolved: %v", references)
	}
	contents := map[string]map[string]any{}
	for _, raw := range result["contents"].([]any) {
		item := raw.(map[string]any)
		contents[item["path"].(string)] = item
	}
	table, ok := contents["structure/parts"]
	if !ok || table["kind"] != "table" || table["origin"].(map[string]any)["file"] != "model.sysml" {
		t.Fatalf("Table content lost its declaration: %v", contents)
	}
	diagram, ok := contents["diagrams/layout"]
	if !ok || diagram["kind"] != "diagram" || diagram["view"] != "Demo::structureView" {
		t.Fatalf("Diagram content lost its view: %v", contents)
	}
	if len(result["diagnostics"].([]any)) != 0 {
		t.Fatalf("Unexpected diagnostics: %v", result["diagnostics"])
	}
}

func TestStudioRenderDocumentMarkdown(t *testing.T) {
	call, _, hash := studioDocumentServer(t, studioDocumentModel)
	result, err := call("RenderDocument", map[string]any{"modelHash": hash, "document": "Demo::Report", "form": "markdown"})
	if err != nil {
		t.Fatal(err)
	}
	if result["status"] != "complete" || result["form"] != "markdown" {
		t.Fatalf("%v", result)
	}
	content := result["content"].(string)
	for _, fragment := range []string{"# Demo Report", "## Structure", "| name | mass |", "| motor | 2", "```mermaid"} {
		if !strings.Contains(content, fragment) {
			t.Fatalf("Markdown lacks %s:\n%s", fragment, content)
		}
	}
	if strings.Contains(content, "<article") {
		t.Fatalf("Markdown form returned HTML:\n%s", content)
	}
}

func TestStudioRenderDocumentUnknown(t *testing.T) {
	call, _, hash := studioDocumentServer(t, studioDocumentModel)
	if _, err := call("RenderDocument", map[string]any{"modelHash": hash, "document": "Demo::Missing", "form": "html"}); err == nil || !strings.Contains(err.Error(), "document not found: Demo::Missing") {
		t.Fatalf("Expected a not-found error, got %v", err)
	}
	if _, err := call("RenderDocument", map[string]any{"modelHash": hash, "document": "Demo::Report", "form": "pdf"}); err == nil || !strings.Contains(err.Error(), "unknown document form") {
		t.Fatalf("Expected a form error, got %v", err)
	}
	if _, err := call("RenderDocument", map[string]any{"modelHash": "stale", "document": "Demo::Report", "form": "html"}); err == nil || !strings.Contains(err.Error(), "model not found") {
		t.Fatalf("Expected a stale-model error, got %v", err)
	}
	result, err := call("RenderDocument", map[string]any{"modelHash": hash, "document": "Demo::vehicle", "form": "html"})
	if err != nil {
		t.Fatal(err)
	}
	diagnostics := result["diagnostics"].([]any)
	if result["status"] != "invalid" || len(diagnostics) != 1 || diagnostics[0].(map[string]any)["kind"] != "notDocumentDefinition" {
		t.Fatalf("A part usage must be refused as a document: %v", result)
	}
}

func TestStudioRenderDocumentPlanningError(t *testing.T) {
	call, direct, hash := studioDocumentServer(t, studioBrokenDocumentModel)
	listed, err := call("ListDocuments", map[string]any{"modelHash": hash})
	if err != nil || len(listed["documents"].([]any)) != 1 {
		t.Fatalf("An unplannable document is still listed: %v %v", listed, err)
	}
	// The pinned checks report the planning failure as a model diagnostic, so
	// the validated surface refuses the revision before planning.
	gated, err := call("RenderDocument", map[string]any{"modelHash": hash, "document": "Demo::Broken", "form": "html"})
	if err != nil {
		t.Fatal(err)
	}
	if gated["status"] != "invalid" || gated["diagnostics"].([]any)[0].(map[string]any)["stage"] != "request" {
		t.Fatalf("Validation must gate rendering: %v", gated)
	}
	// The bridge itself types the planning failure for the diagnostics surface.
	result, err := direct("RenderDocument", map[string]any{"modelHash": hash, "document": "Demo::Broken", "form": "html"})
	if err != nil {
		t.Fatal(err)
	}
	if result["status"] != "invalid" || result["content"] != "" {
		t.Fatalf("A planning failure must not publish content: %v", result)
	}
	diagnostics := result["diagnostics"].([]any)
	if len(diagnostics) != 1 {
		t.Fatalf("Expected one typed diagnostic, got %v", diagnostics)
	}
	item := diagnostics[0].(map[string]any)
	if item["stage"] != "planning" || item["kind"] != "missingQuery" || item["severity"] != "error" || item["file"] != "model.sysml" || item["line"].(float64) <= 1 || item["content"] != "Demo::Broken::orphan" {
		t.Fatalf("Planning diagnostic lost its typing or location: %v", item)
	}
	if !strings.Contains(item["message"].(string), "orphan") {
		t.Fatalf("Planning diagnostic lost its message: %v", item)
	}
}

func TestStudioRenderDocumentInvalidModel(t *testing.T) {
	call, _, hash := studioDocumentServer(t, `package Broken {
	private import DocumentQueries::*;
	part def Report :> Document {
		attribute redefines title = "Report";
	}
	part p : Missing;
}`)
	result, err := call("RenderDocument", map[string]any{"modelHash": hash, "document": "Broken::Report"})
	if err != nil {
		t.Fatal(err)
	}
	diagnostics := result["diagnostics"].([]any)
	if result["status"] != "invalid" || result["form"] != "html" || len(diagnostics) != 1 || diagnostics[0].(map[string]any)["stage"] != "request" {
		t.Fatalf("An invalid model must be refused before planning: %v", result)
	}
}
