package engine

import (
	"context"
	"encoding/json"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/semantics"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/symbols"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/ast"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/source"
	"strings"
	"testing"
)

// This black-box assertion intentionally compiles against the unchanged bridge
// too: missing metadata must fail rather than being mistaken for absence.
func TestSourceValuesMetadataRegression(t *testing.T) {
	e, err := New()
	if err != nil {
		t.Fatal(err)
	}
	text := sourceValuesFixture
	raw, err := e.parseSources(context.Background(), &JParseSourcesRequest{Documents: []*JSourceDocument{{Name: "controls.sysml", Language: "sysml", Content: &text}}, StrictConformance: true})
	if err != nil {
		t.Fatal(err)
	}
	var parsed JParseSourcesResponse
	if err = json.Unmarshal(raw, &parsed); err != nil {
		t.Fatal(err)
	}
	for _, d := range parsed.Diagnostics {
		if d.Severity == "error" {
			t.Fatalf("invalid fixture: %+v", d)
		}
	}
	c, _ := e.get(parsed.ModelHash)
	type attribute struct {
		Subject     ViewSubject `json:"subject"`
		Name        string      `json:"name"`
		Context     []string    `json:"context"`
		Declaration string      `json:"declaration"`
		Value       struct {
			Status           string `json:"status"`
			Expression       string `json:"expression"`
			ExpressionOrigin *struct {
				File   string `json:"file"`
				Offset int    `json:"offset"`
				Length int    `json:"length"`
			} `json:"expressionOrigin"`
			Provider   *ViewSubject `json:"provider"`
			IsDefault  bool         `json:"isDefault"`
			IsInitial  bool         `json:"isInitial"`
			Provenance string       `json:"provenance"`
			Reason     string       `json:"reason"`
		} `json:"value"`
	}
	attrs := map[string]attribute{}
	nodeAttrs := map[string]attribute{}
	for _, view := range []string{"V::tree", "V::structure", "explore"} {
		raw, err = e.evaluateView(&JRenderViewRequest{ModelHash: parsed.ModelHash, View: view})
		if view == "explore" {
			raw, err = e.explore(&JExploreRequest{ModelHash: parsed.ModelHash, Request: ExplorationRequest{Scope: ExplorationScope{Kind: "element", Subject: "P::Base"}, Representation: "interconnection"}})
		}
		if err != nil {
			t.Fatal(err)
		}
		var out struct {
			Correspondence []ViewCorrespondence `json:"correspondence"`
			Artifact       struct {
				Nodes []struct {
					ID               string      `json:"id"`
					Name             string      `json:"name"`
					SourceAttribute  *attribute  `json:"sourceAttribute"`
					SourceAttributes []attribute `json:"sourceAttributes"`
				} `json:"nodes"`
			} `json:"artifact"`
		}
		if err = json.Unmarshal(raw, &out); err != nil {
			t.Fatal(err)
		}
		refs := map[string]ViewCorrespondence{}
		for _, ref := range out.Correspondence {
			refs[ref.Symbol] = ref
		}
		for _, node := range out.Artifact.Nodes {
			ref := refs[node.ID]
			owner := ref.Subject.QualifiedName
			all := append([]attribute{}, node.SourceAttributes...)
			if node.SourceAttribute != nil {
				all = append(all, *node.SourceAttribute)
				nodeAttrs[owner] = *node.SourceAttribute
			}
			for _, a := range all {
				key := owner + "/" + a.Name
				attrs[key] = a
				if a.Subject.Origin == nil {
					t.Fatalf("%s missing subject origin", key)
				}
				o := a.Subject.Origin
				if a.Declaration != text[o.Offset:o.Offset+o.Length] {
					t.Fatalf("%s declaration byte mismatch", key)
				}
				expected := append(append([]string{}, ref.Context...), a.Subject.ID)
				if node.SourceAttribute != nil && a.Subject.ID == ref.Subject.ID {
					expected = ref.Context
				}
				x, _ := json.Marshal(a.Context)
				y, _ := json.Marshal(expected)
				if string(x) != string(y) {
					t.Fatalf("%s context %s != %s", key, x, y)
				}
				if a.Value.Status == "available" {
					v := a.Value
					if v.Provider == nil || v.Provider.Origin == nil || v.ExpressionOrigin == nil {
						t.Fatalf("%s missing source provenance", key)
					}
					p := v.Provider.Origin
					ex := v.ExpressionOrigin
					if ex.File != "controls.sysml" || ex.Offset < p.Offset || ex.Offset+ex.Length > p.Offset+p.Length || v.Expression != text[ex.Offset:ex.Offset+ex.Length] {
						t.Fatalf("%s expression byte/provider mismatch", key)
					}
					if (v.Provenance == "own") != (v.Provider.ID == a.Subject.ID) {
						t.Fatalf("%s wrong provenance", key)
					}
				}
			}
		}
	}
	for _, tc := range []struct {
		owner, name, expression, provider string
		def, initial                      bool
	}{
		{"P::a", "number", "24.0", "P::a::number", false, false}, {"P::b", "number", "48.0", "P::b::number", false, false},
		{"P::Base", "number", "12.50", "P::Base::number", true, false}, {"P::c", "number", "12.50", "P::Base::number", true, false},
		{"P::Base", "unicode", "\"α/证据.json\"", "P::Base::unicode", false, false},
		{"P::Base", "longText", "\"a long authored evidence path / records / review / literal spelling must survive without clipping the inspector value\"", "P::Base::longText", false, false},
		{"P::a", "unicode", "\"local α\"", "P::a::unicode", false, false},
		{"P::b", "unicode", "\"local 证据\"", "P::b::unicode", false, false},
		{"P::Base", "flag", "true", "P::Base::flag", false, false}, {"P::Base", "quantity", "2 [m]", "P::Base::quantity", false, false},
		{"P::Base", "complex", "(2 + 3) * 4", "P::Base::complex", false, false}, {"P::Base", "linked", "number", "P::Base::linked", false, false},
		{"P::Base", "initial", "7", "P::Base::initial", false, true},
	} {
		a, ok := attrs[tc.owner+"/"+tc.name]
		if !ok {
			t.Fatalf("missing source metadata for %s/%s", tc.owner, tc.name)
		}
		if a.Value.Status != "available" || a.Value.Expression != tc.expression || a.Value.Provider == nil || a.Value.Provider.QualifiedName != tc.provider || a.Value.IsDefault != tc.def || a.Value.IsInitial != tc.initial {
			t.Fatalf("%+v: got %+v", tc, a.Value)
		}
	}
	if a := attrs["P::Base/empty"]; a.Value.Status != "absent" {
		t.Fatalf("empty %+v", a)
	}
	if a := attrs["P::Bound/rightValue"]; a.Value.Status != "unsupported" || (!strings.Contains(a.Value.Reason, "binding") || !strings.Contains(a.Value.Reason, "bind leftValue = rightValue;")) {
		t.Fatalf("binding gap %+v", a)
	}
	if a := nodeAttrs["P::a::number"]; a.Value.Expression != "24.0" {
		t.Fatalf("attribute node %+v", a)
	}
	// Inspect actual occurrence identities, not owner labels that repeat.
	raw, err = e.evaluateView(&JRenderViewRequest{ModelHash: parsed.ModelHash, View: "V::structure"})
	if err != nil {
		t.Fatal(err)
	}
	var envelope struct {
		Correspondence []ViewCorrespondence `json:"correspondence"`
		Artifact       struct {
			Nodes []struct {
				ID               string      `json:"id"`
				SourceAttributes []attribute `json:"sourceAttributes"`
			} `json:"nodes"`
		} `json:"artifact"`
	}
	json.Unmarshal(raw, &envelope)
	byID := map[string]string{}
	c.Index.Registered(func(_ string, ss []*symbols.Symbol) {
		for _, s := range ss {
			byID[originKey(s.Origin())] = c.Index.GetFQN(s)
		}
	})
	seen := map[string]bool{}
	for _, node := range envelope.Artifact.Nodes {
		for _, a := range node.SourceAttributes {
			if a.Name != "number" {
				continue
			}
			names := []string{}
			for _, id := range a.Context {
				names = append(names, byID[id])
			}
			joined := strings.Join(names, "/")
			want := ""
			provider := ""
			if strings.Contains(joined, "P::nestedA/") && strings.Contains(joined, "pair1") && strings.Contains(joined, "left") {
				want = "101"
				provider = "P::nestedA::pair1::left::number"
				seen["nestedA"] = true
			}
			if strings.Contains(joined, "P::nestedB/") && strings.Contains(joined, "pair1") && strings.Contains(joined, "left") {
				want = "202"
				provider = "P::nestedB::pair1::left::number"
				seen["nestedB"] = true
			}
			if strings.Contains(joined, "P::qualifiedA/") && strings.Contains(joined, "pair1") && strings.Contains(joined, "left") {
				want = "301"
				provider = "P::qualifiedA::overrideNumber"
				seen["qualifiedA"] = true
			}
			if strings.Contains(joined, "P::qualifiedB/") && strings.Contains(joined, "pair1") && strings.Contains(joined, "left") {
				want = "402"
				provider = "P::qualifiedB::overrideNumber"
				seen["qualifiedB"] = true
			}
			if want != "" && (a.Value.Expression != want || a.Value.Provider == nil || a.Value.Provider.QualifiedName != provider) {
				t.Fatalf("context %s: want %s from %s got %+v", joined, want, provider, a.Value)
			}
			// Negative control: the parallel pair2 context must retain the base default.
			if strings.Contains(joined, "P::qualified") && strings.Contains(joined, "pair2") && a.Value.Expression != "12.50" {
				t.Fatalf("provider leaked across context %s: %+v", joined, a.Value)
			}
		}
	}
	for _, name := range []string{"nestedA", "nestedB", "qualifiedA", "qualifiedB"} {
		if !seen[name] {
			t.Fatalf("missing contextual occurrence %s", name)
		}
	}
}

func TestSourceValuesProviderSafety(t *testing.T) {
	// Fault injection is deliberately below semantic resolution: malformed cycles
	// need not be accepted as valid SysML to exercise the bridge's fail-closed seam.
	empty := func() *symbols.Symbol { return &symbols.Symbol{Decl: &ast.Usage{}} }
	valued := func() *symbols.Symbol { return &symbols.Symbol{Decl: &ast.Usage{Value: &ast.QualifiedName{}}} }
	a, b, x, y := empty(), empty(), valued(), valued()
	graph := map[*symbols.Symbol][]*symbols.Symbol{a: {b}, b: {a}}
	edges := func(s *symbols.Symbol) []*symbols.Symbol { return graph[s] }
	if _, why := sourceProviders(a, edges); why != "cyclic source providers" {
		t.Fatalf("cycle %q", why)
	}
	graph[a] = []*symbols.Symbol{x, y}
	if _, why := sourceProviders(a, edges); why != "ambiguous source providers" {
		t.Fatalf("ambiguity %q", why)
	}
	graph[a] = []*symbols.Symbol{b, x}
	graph[b] = []*symbols.Symbol{x}
	if pp, why := sourceProviders(a, edges); why != "" || len(pp) != 1 || pp[0] != x {
		t.Fatalf("diamond %v %q", pp, why)
	}
	// Own expression wins without consulting invalid ancestor graphs.
	graph[x] = []*symbols.Symbol{a}
	if pp, why := sourceProviders(x, edges); why != "" || len(pp) != 1 || pp[0] != x {
		t.Fatalf("own %v %q", pp, why)
	}
	if _, why := sourceProviders(&symbols.Symbol{}, edges); why != "missing AST" {
		t.Fatalf("missing AST %q", why)
	}
	e, err := New()
	if err != nil {
		t.Fatal(err)
	}
	text := `package P { private import ScalarValues::*;
 part def A {attribute x:Real default = 1;}
 part def B {attribute y:Real default = 2;}
 part def C :> A, B {attribute z :>> x :>> y;}
 part def Mid :> A {attribute :>> x;}
 part deep : Mid {attribute :>> x;}
 }`
	raw, err := e.parseSources(context.Background(), &JParseSourcesRequest{Documents: []*JSourceDocument{{Name: "safety.sysml", Language: "sysml", Content: &text}}, StrictConformance: true})
	if err != nil {
		t.Fatal(err)
	}
	var parsed JParseSourcesResponse
	json.Unmarshal(raw, &parsed)
	for _, d := range parsed.Diagnostics {
		if d.Severity == "error" {
			t.Fatalf("invalid safety fixture %+v", d)
		}
	}
	c, _ := e.get(parsed.ModelHash)
	lookup := func(name string) *symbols.Symbol {
		ss := c.Index.LookupQualified(name)
		if len(ss) != 1 {
			t.Fatalf("lookup %s = %v", name, ss)
		}
		return ss[0]
	}
	z := lookup("P::C::z")
	if v := c.sourceValue(z, z); v.Status != "unsupported" || v.Reason != "ambiguous source providers" {
		t.Fatalf("semantic ambiguity %+v", v)
	}
	deep := lookup("P::deep::x")
	v := c.sourceValue(deep, deep)
	if v.Status != "available" || v.Expression != "1" || v.Provider.ID != originKey(lookup("P::A::x").Origin()) || v.Provenance != "redefined" {
		t.Fatalf("multiple-level inherited default %+v", v)
	}
	x = lookup("P::A::x")
	saved := x.Decl
	x.Decl = nil
	if v := c.sourceValue(x, x); v.Status != "unsupported" || v.Reason != "missing AST" {
		t.Fatalf("missing AST %+v", v)
	}
	x.Decl = saved
	docs := c.Documents
	c.Documents = nil
	if v := c.sourceValue(x, x); v.Status != "unsupported" || v.Reason != "missing applied provider source" {
		t.Fatalf("missing source %+v", v)
	}
	c.Documents = docs
	u := x.Decl.(*ast.Usage)
	oldValue := u.Value
	u.Value = &ast.QualifiedName{NodeBase: ast.NodeBase{NodeSpan: source.Span{Offset: len(text), Len: 1}}}
	if v := c.sourceValue(x, x); v.Status != "unsupported" || v.Reason != "expression outside provider declaration" {
		t.Fatalf("invalid expression origin %+v", v)
	}
	u.Value = oldValue
	original := x.DocName
	x.DocName = "outside.sysml"
	if v := c.sourceValue(x, x); v.Status != "unsupported" {
		t.Fatalf("external provider %+v", v)
	}
	x.DocName = original
}

const sourceValuesFixture = `package P {
 private import ScalarValues::*;
 private import SI::*;
 part def Base {
  attribute number : Real default = 12.50;
  attribute unicode : String = "α/证据.json";
  attribute longText : String = "a long authored evidence path / records / review / literal spelling must survive without clipping the inspector value";
  attribute flag : Boolean = true;
  attribute quantity = 2 [m];
  attribute complex : Real = (2 + 3) * 4;
  attribute empty : Real;
  attribute linked : Real = number;
  attribute initial : Real := 7;
 }
 part def Bound { attribute leftValue : Real = 5; attribute rightValue : Real; bind leftValue = rightValue; }
 part a : Base { attribute :>> number = 24.0; attribute :>> unicode = "local α"; }
 part b : Base { attribute :>> number = 48.0; attribute :>> unicode = "local 证据"; }
 part c : Base { attribute :>> number; }
 part def Pair { part left : Base; part right : Base; }
 part def Outer { part pair1 : Pair; part pair2 : Pair; }
 part system : Outer;
 part nestedA : Outer { part :>> pair1 { part :>> left { attribute :>> number = 101; attribute :>> unicode = "nested α"; } } }
 part nestedB : Outer { part :>> pair1 { part :>> left { attribute :>> number = 202; attribute :>> unicode = "nested 证据"; } } }
 part qualifiedA : Outer { attribute overrideNumber :>> pair1.left.number = 301; }
 part qualifiedB : Outer { attribute overrideNumber :>> pair1.left.number = 402; }
 part def Mid :> Base { attribute :>> number; }
 part multilevel : Mid { attribute :>> number; }

}
package V {
 view tree : StandardViewDefinitions::GeneralView { expose P::a; expose P::a::number; expose P::b; expose P::b::number; expose P::Base; expose P::Bound; expose P::c; }
 view structure : StandardViewDefinitions::InterconnectionView { expose P::system; expose P::nestedA; expose P::nestedB; expose P::qualifiedA; expose P::qualifiedB; }
}
`

func TestReviewExternalBinding(t *testing.T) {
	text := `package P {
 private import ScalarValues::*;
 part def Base { attribute number : Real default = 12.50; }
 part a : Base;
 attribute replacement : Real = 99;
 bind a.number = replacement;
}
package V { view structure : StandardViewDefinitions::InterconnectionView { expose P::a; } }`
	e, err := New()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := e.parseSources(context.Background(), &JParseSourcesRequest{Documents: []*JSourceDocument{{Name: "review.sysml", Language: "sysml", Content: &text}}, StrictConformance: true})
	if err != nil {
		t.Fatal(err)
	}
	var parsed JParseSourcesResponse
	json.Unmarshal(raw, &parsed)
	for _, d := range parsed.Diagnostics {
		if d.Severity == "error" {
			t.Fatalf("fixture invalid: %+v", d)
		}
	}
	raw, err = e.evaluateView(&JRenderViewRequest{ModelHash: parsed.ModelHash, View: "V::structure"})
	if err != nil {
		t.Fatal(err)
	}
	t.Log(string(raw))
	var out struct {
		Artifact struct {
			Nodes []struct {
				SourceAttributes []SourceAttribute `json:"sourceAttributes"`
			} `json:"nodes"`
		} `json:"artifact"`
	}
	json.Unmarshal(raw, &out)
	found := false
	for _, n := range out.Artifact.Nodes {
		for _, a := range n.SourceAttributes {
			if a.Name == "number" {
				found = true
				if a.Value.Status != "unsupported" {
					t.Errorf("outer binding was missed: status=%s expression=%s", a.Value.Status, a.Value.Expression)
				}
			}
		}
	}
	if !found {
		t.Fatal("number metadata not rendered")
	}
}

func TestReviewOuterQualifiedAssignment(t *testing.T) {
	text := `package P {
 private import ScalarValues::*;
 part def Base { attribute number : Real default = 12.50; }
 part a : Base;
 attribute overrideNumber :>> a.number = 99;
}
package V { view structure : StandardViewDefinitions::InterconnectionView { expose P::a; } }`
	e, err := New()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := e.parseSources(context.Background(), &JParseSourcesRequest{Documents: []*JSourceDocument{{Name: "review.sysml", Language: "sysml", Content: &text}}, StrictConformance: true})
	if err != nil {
		t.Fatal(err)
	}
	var parsed JParseSourcesResponse
	json.Unmarshal(raw, &parsed)
	for _, d := range parsed.Diagnostics {
		if d.Severity == "error" {
			t.Fatalf("fixture invalid: %+v", d)
		}
	}
	raw, err = e.evaluateView(&JRenderViewRequest{ModelHash: parsed.ModelHash, View: "V::structure"})
	if err != nil {
		t.Fatal(err)
	}
	c, _ := e.get(parsed.ModelHash)
	override := c.Index.LookupQualified("P::overrideNumber")[0]
	for _, rel := range semantics.RelationshipsOf(override) {
		if rel.Kind == ast.RelRedefines {
			path := c.typedModel().ChainTargetPath(override, rel.Kind, rel.Target)
			names := []string{}
			for _, step := range path {
				names = append(names, c.Index.GetFQN(step))
			}
			t.Logf("resolved outer redefinition path: %v", names)
			if len(path) != 2 || c.Index.GetFQN(path[0]) != "P::a" || c.Index.GetFQN(path[1]) != "P::Base::number" {
				t.Fatal("unexpected semantic target path")
			}
		}
	}
	t.Log(string(raw))
	var out struct {
		Artifact struct {
			Nodes []struct {
				SourceAttributes []SourceAttribute `json:"sourceAttributes"`
			} `json:"nodes"`
		} `json:"artifact"`
	}
	json.Unmarshal(raw, &out)
	found := false
	for _, n := range out.Artifact.Nodes {
		for _, a := range n.SourceAttributes {
			if a.Name == "number" {
				found = true
				if a.Value.Status == "available" && a.Value.Expression == "12.50" {
					t.Errorf("outer contextual assignment was missed: status=%s expression=%s", a.Value.Status, a.Value.Expression)
				}
			}
		}
	}
	if !found {
		t.Fatal("number metadata not rendered")
	}
}

func TestSourceValuesOuterScopes(t *testing.T) {
	for _, tc := range []struct {
		name        string
		documents   []string
		exposure    string
		unsupported []string
		defaults    []string
		evidence    string
	}{
		{"parallel binding", []string{`package P { private import ScalarValues::*; part def Base { attribute number : Real default = 12.50; } part a : Base; part b : Base; attribute replacement : Real = 99; bind a.number = replacement; }`}, "expose P::a; expose P::b;", []string{"P::a"}, []string{"P::b"}, "bind a.number = replacement;"},
		{"split namespace binding", []string{`package P { private import ScalarValues::*; part def Base { attribute number : Real default = 12.50; } part a : Base; part b : Base; attribute replacement : Real = 99; }`, `package P { bind a.number = replacement; }`}, "expose P::a; expose P::b;", []string{"P::a"}, []string{"P::b"}, "bind a.number = replacement;"},
		{"split namespace assignment", []string{`package P { private import ScalarValues::*; part def Base { attribute number : Real default = 12.50; } part a : Base; part b : Base; }`, `package P { attribute overrideNumber :>> a.number = 99; }`}, "expose P::a; expose P::b;", []string{"P::a"}, []string{"P::b"}, "attribute overrideNumber :>> a.number = 99;"},
		{"foreign namespace binding", []string{`package P { private import ScalarValues::*; part def Base { attribute number : Real default = 12.50; } part a : Base; part b : Base; attribute replacement : Real = 99; }`, `package Q { bind P::a.number = P::replacement; }`}, "expose P::a; expose P::b;", []string{"P::a"}, []string{"P::b"}, "bind P::a.number = P::replacement;"},
		{"nested repeated binding", []string{`package P { private import ScalarValues::*; part def Base { attribute number : Real default = 12.50; } part def Pair {part left:Base; part right:Base;} part one:Pair; part two:Pair; attribute replacement:Real=99; bind one.left.number = replacement; }`}, "expose P::one; expose P::two;", []string{"P::one/P::Pair::left"}, []string{"P::one/P::Pair::right", "P::two/P::Pair::left", "P::two/P::Pair::right"}, "bind one.left.number = replacement;"},
		{"nested repeated assignment", []string{`package P { private import ScalarValues::*; part def Base { attribute number : Real default = 12.50; } part def Pair {part left:Base; part right:Base;} part one:Pair; part two:Pair; attribute overrideNumber :>> one.left.number = 99; }`}, "expose P::one; expose P::two;", []string{"P::one/P::Pair::left"}, []string{"P::one/P::Pair::right", "P::two/P::Pair::left", "P::two/P::Pair::right"}, "attribute overrideNumber :>> one.left.number = 99;"},
		{"independently selected member", []string{`package P { private import ScalarValues::*; part def Base { attribute number : Real default = 12.50; } part def Pair {part left:Base; part right:Base; attribute overrideNumber :>> left.number = 99;} part b:Base; }`}, "expose P::Pair::left; expose P::Pair::right; expose P::b;", []string{"P::Pair::left", "P::Pair::right"}, []string{"P::b"}, "target path unresolved"},
		{"competing outer assignments", []string{`package P { private import ScalarValues::*; part def Base { attribute number : Real default = 12.50; } part a : Base; part b : Base; attribute overrideOne :>> a.number = 99; attribute overrideTwo :>> a.number = 100; }`}, "expose P::a; expose P::b;", []string{"P::a"}, []string{"P::b"}, "qualified assignment"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			e, err := New()
			if err != nil {
				t.Fatal(err)
			}
			docs := []*JSourceDocument{}
			sources := map[string]string{}
			for i, txt := range tc.documents {
				name := []string{"model.sysml", "effects.sysml"}[i]
				sources[name] = txt
				txt := txt
				docs = append(docs, &JSourceDocument{Name: name, Language: "sysml", Content: &txt})
			}
			view := `package V { view structure : StandardViewDefinitions::InterconnectionView {` + tc.exposure + `} }`
			docs = append(docs, &JSourceDocument{Name: "views.sysml", Language: "sysml", Content: &view})
			raw, err := e.parseSources(context.Background(), &JParseSourcesRequest{Documents: docs, StrictConformance: true})
			if err != nil {
				t.Fatal(err)
			}
			var parsed JParseSourcesResponse
			if err = json.Unmarshal(raw, &parsed); err != nil {
				t.Fatal(err)
			}
			for _, d := range parsed.Diagnostics {
				if d.Severity == "error" {
					t.Fatalf("fixture invalid %+v", d)
				}
			}
			raw, err = e.evaluateView(&JRenderViewRequest{ModelHash: parsed.ModelHash, View: "V::structure"})
			if err != nil {
				t.Fatal(err)
			}
			var out struct {
				Status         string               `json:"status"`
				Correspondence []ViewCorrespondence `json:"correspondence"`
				Artifact       struct {
					Nodes []struct {
						ID               string            `json:"id"`
						SourceAttributes []SourceAttribute `json:"sourceAttributes"`
					} `json:"nodes"`
				} `json:"artifact"`
			}
			if err = json.Unmarshal(raw, &out); err != nil {
				t.Fatal(err)
			}
			if len(out.Artifact.Nodes) == 0 && strings.HasPrefix(tc.name, "split namespace") {
				// The pinned exposure resolver cannot select a member across
				// these split package declarations. Exercise source-scope safety
				// directly against the real parsed symbols, not a fake graph.
				t.Logf("pinned split-namespace rendering limitation: %s", raw)
				c, _ := e.get(parsed.ModelHash)
				declared := map[string]*symbols.Symbol{}
				var walk func(*symbols.Scope)
				walk = func(scope *symbols.Scope) {
					if scope == nil {
						return
					}
					scope.ForEachMember(func(sym *symbols.Symbol) bool { declared[c.Index.GetFQN(sym)] = sym; return true })
					for _, child := range scope.Children() {
						walk(child)
					}
				}
				for _, doc := range c.Index.WorkspaceDocuments() {
					walk(c.Index.DocumentRoot(doc))
				}
				for _, name := range []string{"P::a", "P::b"} {
					owner := declared[name]
					member := declared["P::Base::number"]
					if owner == nil || member == nil {
						t.Fatal("fixture declarations not indexed")
					}
					context := []string{originKey(owner.Origin()), originKey(member.Origin())}
					attr := c.sourceAttribute(member, []*symbols.Symbol{owner}, context, c.sourceEffects())
					if name == "P::a" && attr.Value.Status != "unsupported" {
						t.Fatalf("split namespace outer effect missed: %+v", attr.Value)
					}
					if name == "P::b" && attr.Value.Status != "available" && !strings.Contains(attr.Value.Reason, "target path unresolved") {
						t.Fatalf("unexpected unaffected status: %+v", attr.Value)
					}
					t.Logf("direct semantic safety %s: %+v", name, attr.Value)
				}
				return
			}
			if out.Status != "complete" {
				t.Fatalf("not complete: %s", raw)
			}
			refs := map[string]ViewCorrespondence{}
			byID := map[string]string{}
			for _, r := range out.Correspondence {
				refs[r.Symbol] = r
				byID[r.Subject.ID] = r.Subject.QualifiedName
			}
			found := map[string]SourceAttribute{}
			for _, node := range out.Artifact.Nodes {
				for _, a := range node.SourceAttributes {
					if a.Name != "number" {
						continue
					}
					r := refs[node.ID]
					names := []string{}
					for _, id := range r.Context {
						names = append(names, byID[id])
					}
					key := strings.Join(names, "/")
					found[key] = a
					want := append(append([]string{}, r.Context...), a.Subject.ID)
					x, _ := json.Marshal(a.Context)
					y, _ := json.Marshal(want)
					if string(x) != string(y) {
						t.Fatalf("changed correspondence context %s: %s != %s", key, x, y)
					}
				}
			}
			for _, key := range tc.unsupported {
				a, ok := found[key]
				if !ok {
					t.Fatalf("missing %s from %+v", key, found)
				}
				if a.Value.Status != "unsupported" || !strings.Contains(a.Value.Reason, tc.evidence) {
					t.Errorf("external effect missed %s: %+v", key, a.Value)
				}
			}
			for _, key := range tc.defaults {
				a, ok := found[key]
				if !ok {
					t.Fatalf("missing %s", key)
				}
				v := a.Value
				if v.Status != "available" || v.Expression != "12.50" || v.Provider == nil || v.Provider.QualifiedName != "P::Base::number" {
					t.Errorf("effect leaked %s: %+v", key, v)
				}
				if v.Provider != nil && v.ExpressionOrigin != nil {
					o := v.ExpressionOrigin
					txt := sources[o.File]
					if o.Offset < 0 || o.Offset+o.Length > len(txt) || txt[o.Offset:o.Offset+o.Length] != "12.50" {
						t.Errorf("incorrect provider bytes %s: %+v", key, v)
					}
				}
			}
		})
	}
}

func TestSourceValuesBindingReferenceContext(t *testing.T) {
	for _, tc := range []struct {
		target                                 string
		definitionAvailable, parallelAvailable bool
	}{
		{"number", true, true},
		{"P::Base::number", false, true},
		{"P::b.number", true, false},
	} {
		t.Run(tc.target, func(t *testing.T) {
			text := `package P {private import ScalarValues::*; part def Base {attribute number:Real default=12.50;} part b:Base; part a:Base {attribute replacement:Real=99; bind ` + tc.target + `=replacement;}} package V {view structure:StandardViewDefinitions::InterconnectionView {expose P::Base;expose P::a;expose P::b;}}`
			e, err := New()
			if err != nil {
				t.Fatal(err)
			}
			raw, err := e.parseSources(context.Background(), &JParseSourcesRequest{Documents: []*JSourceDocument{{Name: "binding-context.sysml", Language: "sysml", Content: &text}}, StrictConformance: true})
			if err != nil {
				t.Fatal(err)
			}
			var parsed JParseSourcesResponse
			if err = json.Unmarshal(raw, &parsed); err != nil {
				t.Fatal(err)
			}
			for _, d := range parsed.Diagnostics {
				if d.Severity == "error" {
					t.Fatalf("invalid fixture: %+v", d)
				}
			}
			raw, err = e.evaluateView(&JRenderViewRequest{ModelHash: parsed.ModelHash, View: "V::structure"})
			if err != nil {
				t.Fatal(err)
			}
			var out struct {
				Status         string
				Correspondence []ViewCorrespondence
				Artifact       struct {
					Nodes []struct {
						ID               string
						SourceAttributes []SourceAttribute
					}
				}
			}
			if err = json.Unmarshal(raw, &out); err != nil {
				t.Fatal(err)
			}
			if out.Status != "complete" {
				t.Fatalf("incomplete: %s", raw)
			}
			refs := map[string]string{}
			for _, r := range out.Correspondence {
				refs[r.Symbol] = r.Subject.QualifiedName
			}
			found := map[string]bool{}
			for _, n := range out.Artifact.Nodes {
				for _, a := range n.SourceAttributes {
					if a.Name != "number" {
						continue
					}
					owner := refs[n.ID]
					found[owner] = true
					available := false
					switch owner {
					case "P::Base":
						available = tc.definitionAvailable
					case "P::b":
						available = tc.parallelAvailable
					}
					if available {
						if a.Value.Status != "available" || a.Value.Expression != "12.50" || a.Value.Provider == nil || a.Value.Provider.QualifiedName != "P::Base::number" {
							t.Errorf("wrong default for %s: %+v", owner, a.Value)
						}
					} else if a.Value.Status != "unsupported" {
						t.Errorf("binding missed %s: %+v", owner, a.Value)
					}
				}
			}
			for _, owner := range []string{"P::Base", "P::a", "P::b"} {
				if !found[owner] {
					t.Errorf("missing %s", owner)
				}
			}
		})
	}
}

func TestSourceValuesKeywordFreeRedefinitions(t *testing.T) {
	text := `package P { private import ScalarValues::*; part def Base { attribute span:Real default=0.6; attribute evidence:String default="base"; } part a:Base { :>> span default=0.8; :>> evidence="α"; } part b:Base { :>> span default=0.35; :>> evidence="other"; }} package V { view tree:StandardViewDefinitions::GeneralView {expose P::a;expose P::a::*;expose P::b;expose P::b::*;} view structure:StandardViewDefinitions::InterconnectionView {expose P::a;expose P::b;}}`
	e, err := New()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := e.parseSources(context.Background(), &JParseSourcesRequest{Documents: []*JSourceDocument{{Name: "keyword-free.sysml", Language: "sysml", Content: &text}}, StrictConformance: true})
	if err != nil {
		t.Fatal(err)
	}
	var parsed JParseSourcesResponse
	if err = json.Unmarshal(raw, &parsed); err != nil {
		t.Fatal(err)
	}
	for _, d := range parsed.Diagnostics {
		if d.Severity == "error" {
			t.Fatalf("invalid fixture: %+v", d)
		}
	}
	for _, view := range []string{"V::tree", "V::structure"} {
		t.Run(view, func(t *testing.T) {
			raw, err = e.evaluateView(&JRenderViewRequest{ModelHash: parsed.ModelHash, View: view})
			if err != nil {
				t.Fatal(err)
			}
			var out struct {
				Status         string
				Correspondence []ViewCorrespondence
				Artifact       struct {
					Nodes []struct {
						ID               string
						SourceAttribute  *SourceAttribute
						SourceAttributes []SourceAttribute
					}
				}
			}
			if err = json.Unmarshal(raw, &out); err != nil {
				t.Fatal(err)
			}
			if out.Status != "complete" {
				t.Fatalf("incomplete: %s", raw)
			}
			found := map[string]SourceAttribute{}
			refs := map[string]ViewCorrespondence{}
			for _, r := range out.Correspondence {
				refs[r.Symbol] = r
			}
			for _, n := range out.Artifact.Nodes {
				if view == "V::tree" {
					if n.SourceAttribute != nil {
						a := *n.SourceAttribute
						found[a.Subject.QualifiedName] = a
					}
				} else {
					for _, a := range n.SourceAttributes {
						found[a.Subject.QualifiedName] = a
						want := append(append([]string{}, refs[n.ID].Context...), a.Subject.ID)
						x, _ := json.Marshal(a.Context)
						y, _ := json.Marshal(want)
						if string(x) != string(y) {
							t.Fatalf("wrong context: %s != %s", x, y)
						}
					}
				}
			}
			for key, want := range map[string]string{"P::a::span": "0.8", "P::a::evidence": "\"α\"", "P::b::span": "0.35", "P::b::evidence": "\"other\""} {
				a, ok := found[key]
				if !ok {
					t.Fatalf("missing keyword-free source metadata %s", key)
				}
				v := a.Value
				if v.Status != "available" || v.Expression != want || v.Provider == nil || v.Provider.ID != a.Subject.ID {
					t.Errorf("wrong value for %s: %+v", key, v)
				}
				if v.ExpressionOrigin != nil {
					o := v.ExpressionOrigin
					if text[o.Offset:o.Offset+o.Length] != want {
						t.Errorf("wrong expression bytes %s", key)
					}
				}
			}
		})
	}
}

func TestSourceValuesBoundOwnerDoesNotBorrowTypeDefaults(t *testing.T) {
	text := `package P {private import ScalarValues::*; part def Base {attribute number:Real default=12.50;} part b:Base {attribute :>> number=99;} ref part a:Base=b;} package V {view structure:StandardViewDefinitions::InterconnectionView {expose P::a;expose P::b;}}`
	e, err := New()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := e.parseSources(context.Background(), &JParseSourcesRequest{Documents: []*JSourceDocument{{Name: "owner-value.sysml", Language: "sysml", Content: &text}}, StrictConformance: true})
	if err != nil {
		t.Fatal(err)
	}
	var parsed JParseSourcesResponse
	if err = json.Unmarshal(raw, &parsed); err != nil {
		t.Fatal(err)
	}
	for _, d := range parsed.Diagnostics {
		if d.Severity == "error" {
			t.Fatalf("invalid fixture: %+v", d)
		}
	}
	raw, err = e.evaluateView(&JRenderViewRequest{ModelHash: parsed.ModelHash, View: "V::structure"})
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		Status         string
		Correspondence []ViewCorrespondence
		Artifact       struct {
			Nodes []struct {
				ID               string
				SourceAttributes []SourceAttribute
			}
		}
	}
	if err = json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	if out.Status != "complete" {
		t.Fatalf("incomplete: %s", raw)
	}
	refs := map[string]string{}
	for _, r := range out.Correspondence {
		refs[r.Symbol] = r.Subject.QualifiedName
	}
	found := map[string]bool{}
	for _, n := range out.Artifact.Nodes {
		for _, a := range n.SourceAttributes {
			if a.Name != "number" {
				continue
			}
			owner := refs[n.ID]
			found[owner] = true
			if owner == "P::a" && (a.Value.Status != "unsupported" || !strings.Contains(a.Value.Reason, "owner")) {
				t.Errorf("bound owner borrowed default: %+v", a.Value)
			}
			if owner == "P::b" && (a.Value.Status != "available" || a.Value.Expression != "99") {
				t.Errorf("unbound usage changed: %+v", a.Value)
			}
		}
	}
	if !found["P::a"] || !found["P::b"] {
		t.Fatal("missing occurrences")
	}
}

// Controlled projection seam: library records must remain drawable without
// pretending their non-project origins are applied source-value metadata.
func TestSourceValuesLeaveLibraryRecordsUnannotated(t *testing.T) {
	e, err := New()
	if err != nil {
		t.Fatal(err)
	}
	text := `package P {part a;}`
	raw, err := e.parseSources(context.Background(), &JParseSourcesRequest{Documents: []*JSourceDocument{{Name: "project.sysml", Language: "sysml", Content: &text}}, StrictConformance: true})
	if err != nil {
		t.Fatal(err)
	}
	var parsed JParseSourcesResponse
	if err = json.Unmarshal(raw, &parsed); err != nil {
		t.Fatal(err)
	}
	c, _ := e.get(parsed.ModelHash)
	var library *symbols.Symbol
	c.Index.Registered(func(_ string, syms []*symbols.Symbol) {
		for _, s := range syms {
			if library == nil && s.Kind.IsAttributeLike() && c.Index.IsLibraryDocument(s.DocName) {
				library = s
			}
		}
	})
	if library == nil {
		t.Fatal("pinned library has no attribute control")
	}
	ref := c.sourceSubject(library)
	out := EvaluatedView{Artifact: json.RawMessage(`{"kind":"tree","nodes":[{"id":"library","name":"library","kind":"attribute"}],"edges":[]}`), Correspondence: []ViewCorrespondence{{Symbol: "library", Subject: ref, Context: []string{ref.ID}}}}
	if err = c.sourceValues(&out, map[string]*symbols.Symbol{ref.ID: library}); err != nil {
		t.Fatal(err)
	}
	var artifact struct{ Nodes []map[string]json.RawMessage }
	if err = json.Unmarshal(out.Artifact, &artifact); err != nil {
		t.Fatal(err)
	}
	if len(artifact.Nodes) != 1 {
		t.Fatal("library node removed")
	}
	for _, key := range []string{"sourceAttribute", "sourceAttributes"} {
		if _, ok := artifact.Nodes[0][key]; ok {
			t.Fatalf("library record published unapplied %s", key)
		}
	}
}
