package combined

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"testing"
)

func TestIssue20Origins(t *testing.T) {
	s, err := New("v0.12.0")
	if err != nil {
		t.Fatal(err)
	}
	call := func(method string, p any) map[string]any {
		t.Helper()
		b, _ := json.Marshal(p)
		raw, e := s.Call(context.Background(), method, b)
		if e != nil {
			t.Fatal(e)
		}
		var v map[string]any
		if e = json.Unmarshal(raw, &v); e != nil {
			t.Fatal(e)
		}
		return v
	}
	source := `package ReviewSource { public part def Visible; private part def Hidden; }
 package Mid { %s import %sReviewSource::*; private part def OwnHidden; }
 package Probe { private import Mid::*; }
 package Issue20Views { view focused : StandardViewDefinitions::GeneralView { expose %s; } }`
	cases := []struct {
		name, vis, all, target string
		want                   []string
	}{
		{"private-mid", "private", "", "Mid::*", []string{"Mid::OwnHidden", "ReviewSource::Visible"}},
		{"public-mid", "public", "", "Mid::*", []string{"Mid::OwnHidden", "ReviewSource::Visible"}},
		{"all-mid", "private", "all ", "Mid::*", []string{"Mid::OwnHidden", "ReviewSource::Hidden", "ReviewSource::Visible"}},
		{"private-probe", "private", "", "Probe::*", nil},
		{"public-probe", "public", "", "Probe::*", []string{"ReviewSource::Visible"}},
		{"private-all-probe", "private", "all ", "Probe::*", nil},
		{"public-all-probe", "public", "all ", "Probe::*", []string{"ReviewSource::Hidden", "ReviewSource::Visible"}},
		{"explicit", "private", "", "Mid::OwnHidden", []string{"Mid::OwnHidden"}},
		{"named", "private", "", "Mid::*", []string{"Mid::OwnHidden", "ReviewSource::Visible"}},
		{"no-import", "private", "", "Mid::*", []string{"Mid::OwnHidden"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			text := fmt.Sprintf(source, c.vis, c.all, c.target)
			if c.name == "named" {
				text = strings.Replace(text, "import ReviewSource::*", "import ReviewSource::Visible", 1)
			}
			if c.name == "no-import" {
				text = strings.Replace(text, "private import ReviewSource::*;", "", 1)
			}
			p := call("ParseSources", map[string]any{"strictConformance": true, "documents": []any{map[string]any{"name": "issue20.sysml", "content": text}}})
			params := map[string]any{"modelHash": p["modelHash"], "view": "Issue20Views::focused"}
			v := call("EvaluateView", params)
			d := call("GetDiagnostics", map[string]any{"modelHash": p["modelHash"]})
			if ds, ok := d["diagnostics"].([]any); ok && len(ds) != 0 {
				t.Fatalf("fixture diagnostics: %v", d)
			}
			raw, _ := json.Marshal(map[string]any{"source": text, "evaluation": v, "diagnostics": d})
			t.Log(string(raw))
			if v["status"] != "complete" {
				t.Fatalf("invalid fixture: %v", v)
			}
			var got []string
			for _, x := range v["selected"].([]any) {
				m := x.(map[string]any)
				name := m["qualifiedName"].(string)
				o := m["origin"].(map[string]any)
				start := int(o["offset"].(float64))
				length := int(o["length"].(float64))
				leaf := name[strings.LastIndex(name, "::")+2:]
				visibility := "private "
				if leaf == "Visible" {
					visibility = "public "
				}
				decl := visibility + "part def " + leaf + ";"
				if o["file"] != "issue20.sysml" || text[start:start+length] != decl {
					t.Errorf("wrong origin %v: %q", o, text[start:start+length])
				}
				got = append(got, name)
			}
			sort.Strings(got)
			sort.Strings(c.want)
			if !reflect.DeepEqual(got, c.want) {
				t.Errorf("selected origins=%v want=%v", got, c.want)
			}
		})
	}
}

func TestIssue20Controls(t *testing.T) {
	s, e := New("v0.12.0")
	if e != nil {
		t.Fatal(e)
	}
	call := func(method string, p any) map[string]any {
		t.Helper()
		b, _ := json.Marshal(p)
		raw, e := s.Call(context.Background(), method, b)
		if e != nil {
			t.Fatal(e)
		}
		var v map[string]any
		if e = json.Unmarshal(raw, &v); e != nil {
			t.Fatal(e)
		}
		return v
	}
	for _, tc := range []struct {
		name, src string
		bad       []string
	}{
		{"outside-private", `package ReviewSource { public part def Visible; private part def Hidden; } package Mid { private import ReviewSource::*; private part def OwnHidden; } package Outside { part a : Mid::OwnHidden; part b : Mid::Visible; part c : ReviewSource::Hidden; }`, []string{"Mid::OwnHidden", "Mid::Visible", "ReviewSource::Hidden"}},
		{"qualified-type-no-import", `package ReviewSource { public part def Visible; } package Outside { part a : ReviewSource::Visible; }`, nil},
		{"outside-public", `package ReviewSource { public part def Visible; } package Mid { public import ReviewSource::*; } package Outside { part a : Mid::Visible; }`, nil},
		{"ordinary-import", `package ReviewSource { public part def Visible; private part def Hidden; } package Mid { private import ReviewSource::*; private part def OwnHidden; } package Outside { private import Mid::*; part a : OwnHidden; part b : Visible; }`, []string{"OwnHidden", "Visible"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := call("ParseSources", map[string]any{"strictConformance": true, "documents": []any{map[string]any{"name": "control.sysml", "content": tc.src}}})
			d := call("GetDiagnostics", map[string]any{"modelHash": p["modelHash"]})
			b, _ := json.Marshal(d)
			t.Log(string(b))
			if tc.bad == nil && strings.Contains(string(b), "severity") {
				t.Fatalf("positive control diagnostics: %s", b)
			}
			for _, ref := range tc.bad {
				if !strings.Contains(string(b), "unresolved reference: "+ref) {
					t.Errorf("missing unresolved reference %s: %s", ref, b)
				}
			}
		})
	}
	text := `package Fixture { part def Device { part child; } part p : Device; } package Issue20Views { view focused : StandardViewDefinitions::GeneralView { expose Fixture::p; } }`
	p := call("ParseSources", map[string]any{"strictConformance": true, "documents": []any{map[string]any{"name": "traversal.sysml", "content": text}}})
	params := map[string]any{"modelHash": p["modelHash"], "view": "Issue20Views::focused"}
	v := call("EvaluateView", params)
	native := call("RenderView", params)
	raw, _ := json.Marshal(map[string]any{"evaluation": v, "native": native})
	t.Log(string(raw))
	selected := v["selected"].([]any)
	if len(selected) != 1 || selected[0].(map[string]any)["qualifiedName"] != "Fixture::p" {
		t.Fatalf("selection changed: %v", selected)
	}
	o := selected[0].(map[string]any)["origin"].(map[string]any)
	start := int(o["offset"].(float64))
	length := int(o["length"].(float64))
	if o["file"] != "traversal.sysml" || text[start:start+length] != "part p : Device;" {
		t.Fatalf("wrong selected origin %v", o)
	}
	found := false
	childStart := strings.Index(text, "part child;") + 1
	for _, x := range native["nodes"].([]any) {
		n := x.(map[string]any)
		if n["name"] == "child" {
			o := n["origin"].(map[string]any)
			found = o["file"] == "traversal.sysml" && int(o["startLine"].(float64)) == 1 && int(o["startCol"].(float64)) == childStart && int(o["endCol"].(float64)) == childStart+len("part child;")
		}
	}
	if !found {
		t.Fatalf("native traversal lacks exact child origin: %s", raw)
	}
}

// A namespace may be declared across documents. Discarding every index
// re-export merely because one declaration has a scope is not safe.
func TestIssue20SplitNamespace(t *testing.T) {
 s,e:=New("v0.12.0");if e!=nil {t.Fatal(e)}
 call:=func(method string,p any) map[string]any {t.Helper();b,_:=json.Marshal(p);raw,e:=s.Call(context.Background(),method,b);if e!=nil {t.Fatal(e)};var v map[string]any;if e=json.Unmarshal(raw,&v);e!=nil {t.Fatal(e)};return v}
 p:=call("ParseSources",map[string]any{"strictConformance":true,"documents":[]any{
 map[string]any{"name":"a.sysml","content":`package SourceA { part def A; } package Mid { public import SourceA::*; }`},
 map[string]any{"name":"b.sysml","content":`package SourceB { part def B; } package Mid { public import SourceB::*; }`},
 map[string]any{"name":"v.sysml","content":`package Issue20Views { view focused : StandardViewDefinitions::GeneralView { expose Mid::*; } }`},
 }})
 v:=call("EvaluateView",map[string]any{"modelHash":p["modelHash"],"view":"Issue20Views::focused"});raw,_:=json.Marshal(v);t.Log(string(raw));if v["status"]!="complete" {t.Fatalf("invalid fixture: %s",raw)}
 var got []string;for _,x:=range v["selected"].([]any) {got=append(got,x.(map[string]any)["qualifiedName"].(string))};sort.Strings(got);if !reflect.DeepEqual(got,[]string{"SourceA::A","SourceB::B"}) {t.Errorf("split namespace origins=%v want SourceA::A, SourceB::B",got)}
}
