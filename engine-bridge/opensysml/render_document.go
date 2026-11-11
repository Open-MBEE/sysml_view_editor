package engine

import (
	"context"
	"errors"
	"sort"

	"github.com/Open-MBEE/OpenSysML/internal/doc/docir"
	"github.com/Open-MBEE/OpenSysML/internal/doc/docrender"
	"github.com/Open-MBEE/OpenSysML/internal/doc/queryexec"
	"github.com/Open-MBEE/OpenSysML/internal/ir/docplan"
	"github.com/Open-MBEE/OpenSysML/internal/ir/view"
	"github.com/Open-MBEE/OpenSysML/internal/semantic/symbols"
	"github.com/Open-MBEE/OpenSysML/internal/syntax/source"
	"github.com/Open-MBEE/OpenSysML/internal/workspace/model"
)

// JListDocumentsRequest names the cached model whose document definitions are
// listed.
type JListDocumentsRequest struct {
	ModelHash string `json:"modelHash,omitempty"`
}

// JRenderDocumentRequest mirrors the protojson field names of the upstream
// RenderDocument RPC (model hash, document name, form) so the local bridge can
// be replaced by that RPC without changing the browser contract.
type JRenderDocumentRequest struct {
	ModelHash string `json:"modelHash,omitempty"`
	Document  string `json:"document,omitempty"`
	Form      string `json:"form,omitempty"`
}

// DocumentDefinition is one part def specializing DocumentQueries::Document,
// with the source declaration it is read from.
type DocumentDefinition struct {
	QualifiedName string      `json:"qualifiedName"`
	Name          string      `json:"name"`
	Origin        *ViewOrigin `json:"origin,omitempty"`
}

// DocumentList is the studio_render_document_v1 listing envelope.
type DocumentList struct {
	SchemaVersion int                  `json:"schemaVersion"`
	ModelHash     string               `json:"modelHash"`
	Documents     []DocumentDefinition `json:"documents"`
}

// DocumentDiagnostic is one typed planning, evaluation or rendering failure
// with the source location the engine recorded for it.
type DocumentDiagnostic struct {
	Stage    string `json:"stage"`
	Kind     string `json:"kind"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
	Document string `json:"document,omitempty"`
	Content  string `json:"content,omitempty"`
	Query    string `json:"query,omitempty"`
	File     string `json:"file,omitempty"`
	Line     int    `json:"line,omitempty"`
}

// DocumentReference maps a data-element qualified name in the rendered output
// to the declaration it denotes.
type DocumentReference struct {
	QualifiedName string      `json:"qualifiedName"`
	Kind          string      `json:"kind"`
	Origin        *ViewOrigin `json:"origin,omitempty"`
}

// DocumentContent maps a rendered content block (section, paragraph, table,
// list, diagram) to the part declaring it inside the document definition. Path
// joins the data-name attributes from the document root with "/".
type DocumentContent struct {
	Path   string      `json:"path"`
	Name   string      `json:"name"`
	Kind   string      `json:"kind"`
	View   string      `json:"view,omitempty"`
	Origin *ViewOrigin `json:"origin,omitempty"`
}

// RenderedDocument is the studio_render_document_v1 rendering envelope.
type RenderedDocument struct {
	SchemaVersion int                  `json:"schemaVersion"`
	ModelHash     string               `json:"modelHash"`
	Document      string               `json:"document"`
	Form          string               `json:"form"`
	Status        string               `json:"status"`
	Title         string               `json:"title,omitempty"`
	Content       string               `json:"content"`
	References    []DocumentReference  `json:"references"`
	Contents      []DocumentContent    `json:"contents"`
	Diagnostics   []DocumentDiagnostic `json:"diagnostics"`
}

const (
	documentFormHTML     = "html"
	documentFormMarkdown = "markdown"
)

// listDocuments resolves document definitions through the semantic model, in
// qualified-name order, with their declaring source ranges.
func (e *Engine) listDocuments(req *JListDocumentsRequest) ([]byte, error) {
	cached, ok := e.get(req.ModelHash)
	if !ok {
		return nil, statusErrorf(codeNotFound, msgModelNotFound, req.ModelHash)
	}
	typed := cached.typedModel()
	out := DocumentList{SchemaVersion: 1, ModelHash: req.ModelHash, Documents: []DocumentDefinition{}}
	for _, doc := range cached.Index.WorkspaceDocuments() {
		for _, sym := range model.DeclaredDocumentDefinitions(cached.Index, typed, cached.Index.DocumentRoot(doc)) {
			out.Documents = append(out.Documents, DocumentDefinition{
				QualifiedName: cached.Index.GetFQN(sym),
				Name:          sym.Name,
				Origin:        documentOrigin(sym.Origin()),
			})
		}
	}
	sort.SliceStable(out.Documents, func(i, j int) bool {
		return out.Documents[i].QualifiedName < out.Documents[j].QualifiedName
	})
	return marshal(out)
}

// renderDocument compiles a document definition to its plan, evaluates the
// plan over the cached model's runtime and renders it as semantic HTML or
// Markdown. Typed planning, evaluation and rendering failures are reported in
// the envelope rather than as transport errors so the browser can place them
// in its diagnostics surface.
func (e *Engine) renderDocument(req *JRenderDocumentRequest) ([]byte, error) {
	cached, ok := e.get(req.ModelHash)
	if !ok {
		return nil, statusErrorf(codeNotFound, msgModelNotFound, req.ModelHash)
	}
	if req.Document == "" {
		return nil, statusError(codeInvalidArgument, "document is required")
	}
	form := req.Form
	if form == "" {
		form = documentFormHTML
	}
	if form != documentFormHTML && form != documentFormMarkdown {
		return nil, statusErrorf(codeInvalidArgument, "unknown document form %q: one of html, markdown", req.Form)
	}
	typed := cached.typedModel()
	matches := lookupNamed(cached.Index, req.Document)
	if len(matches) > 1 {
		documents := matches[:0:0]
		for _, candidate := range matches {
			if docplan.IsDocumentDefinition(cached.Index, typed, candidate) {
				documents = append(documents, candidate)
			}
		}
		matches = documents
	}
	if len(matches) != 1 {
		return nil, statusErrorf(codeNotFound, "document not found: %s", req.Document)
	}
	sym := matches[0]
	out := RenderedDocument{
		SchemaVersion: 1,
		ModelHash:     req.ModelHash,
		Document:      req.Document,
		Form:          form,
		Status:        "invalid",
		References:    []DocumentReference{},
		Contents:      []DocumentContent{},
		Diagnostics:   []DocumentDiagnostic{},
	}
	if !docplan.IsDocumentDefinition(cached.Index, typed, sym) {
		out.Diagnostics = append(out.Diagnostics, DocumentDiagnostic{
			Stage:    "planning",
			Kind:     docplanKinds[docplan.ErrorNotDocumentDefinition],
			Severity: "error",
			Message:  req.Document + " is not a document: one is a part def specializing DocumentQueries::Document",
			Document: cached.Index.GetFQN(sym),
			File:     sym.Origin().Doc,
			Line:     cached.lineOf(sym.Origin()),
		})
		return marshal(out)
	}
	plan, err := docplan.Compile(cached.Index, typed, cached.resolver, sym)
	if err != nil {
		out.Diagnostics = append(out.Diagnostics, cached.documentDiagnostic("planning", err))
		return marshal(out)
	}
	rt := e.newRuntime(context.Background(), cached)
	queries := queryexec.Context{
		Index:    cached.Index,
		Resolver: cached.resolver,
		Model:    typed,
		Runtime:  rt,
		LineIndex: func(name string) *source.LineIndex {
			if file := cached.document(name); file != nil {
				return file.Lines()
			}
			return nil
		},
	}
	document, err := docir.EvaluateLinked(
		plan,
		model.SiblingDocumentPlans(cached.Index, typed, cached.resolver, sym),
		queries,
		queryexec.Options{},
		cached.sourceText(),
	)
	if err != nil {
		out.Diagnostics = append(out.Diagnostics, cached.documentDiagnostic("evaluation", err))
		return marshal(out)
	}
	// Graphviz is unavailable in wasm. The browser replaces every diagram
	// figure with its native renderer, so HTML carries each diagram's DOT
	// source as text: the Mermaid HTML path inlines images relative to
	// os.Getwd, which js/wasm does not implement. Markdown keeps the CLI's
	// Mermaid fences.
	var content string
	if form == documentFormHTML {
		content, err = docrender.HTML(document, docrender.HTMLOptions{
			Fragment:            true,
			NoDefaultStylesheet: true,
			DiagramForm:         view.FormDot,
			WithoutGraphviz:     true,
		})
	} else {
		content, err = docrender.Markdown(document, docrender.MarkdownOptions{
			DiagramForm:     view.FormMermaid,
			WithoutGraphviz: true,
		})
	}
	if err != nil {
		out.Diagnostics = append(out.Diagnostics, cached.documentDiagnostic("rendering", err))
		return marshal(out)
	}
	out.Status = "complete"
	out.Title = document.Title()
	out.Content = content
	out.References = cached.documentReferences(document)
	out.Contents = cached.documentContents("", document.Content())
	return marshal(out)
}

// documentContents records each content block's declaring part by its
// data-name path, so a rendered heading or block can reveal its declaration.
func (cached *cachedModel) documentContents(prefix string, nodes []docir.Content) []DocumentContent {
	out := []DocumentContent{}
	for _, node := range nodes {
		path := node.Name()
		if prefix != "" {
			path = prefix + "/" + node.Name()
		}
		item := DocumentContent{Path: path, Name: node.Name(), Kind: string(node.Kind()), Origin: documentOrigin(node.Origin())}
		if rendering := node.Rendering(); rendering != nil {
			item.View = rendering.View
		}
		out = append(out, item)
		out = append(out, cached.documentContents(path, node.Children())...)
	}
	return out
}

// documentReferences resolves every element the rendered output names in a
// data-element attribute: table rows, list items, definition entries and
// inline references.
func (cached *cachedModel) documentReferences(document *docir.Document) []DocumentReference {
	seen := map[string]DocumentReference{}
	record := func(sym *symbols.Symbol) {
		if sym == nil {
			return
		}
		name := cached.Index.GetFQN(sym)
		if _, done := seen[name]; done || name == "" {
			return
		}
		seen[name] = DocumentReference{QualifiedName: name, Kind: sym.Kind.String(), Origin: documentOrigin(sym.Origin())}
	}
	value := func(v queryexec.Value) {
		if sym, ok := v.Element(); ok {
			record(sym)
		}
	}
	named := func(qualified string) {
		if qualified == "" {
			return
		}
		if matches := lookupNamed(cached.Index, qualified); len(matches) == 1 {
			record(matches[0])
		}
	}
	runs := func(items []docir.TextRun) {
		for _, run := range items {
			named(run.TargetElement())
		}
	}
	var walk func(nodes []docir.Content)
	walk = func(nodes []docir.Content) {
		for _, node := range nodes {
			runs(node.Runs())
			for _, row := range node.Rows() {
				value(row.Element())
			}
			for _, group := range node.Groups() {
				for _, row := range group.Rows() {
					value(row.Element())
				}
			}
			for _, item := range node.Items() {
				value(item.Element())
				runs(item.Runs())
			}
			for _, definition := range node.Definitions() {
				value(definition.Element())
			}
			walk(node.Children())
		}
	}
	walk(document.Content())
	out := make([]DocumentReference, 0, len(seen))
	for _, ref := range seen {
		out = append(out, ref)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].QualifiedName < out[j].QualifiedName })
	return out
}

// documentOrigin is a located declaration range, nil for library or synthetic
// declarations.
func documentOrigin(origin symbols.Origin) *ViewOrigin {
	if !origin.Located() {
		return nil
	}
	return &ViewOrigin{File: origin.Doc, Offset: origin.Span.Offset, Length: origin.Span.Len, NameOffset: origin.Name.Offset, NameLength: origin.Name.Len}
}

// lineOf is the 1-based line an origin starts on in the model's own sources,
// zero when the origin is unlocated or belongs to the library.
func (cached *cachedModel) lineOf(origin symbols.Origin) int {
	if !origin.Located() {
		return 0
	}
	file := cached.document(origin.Doc)
	if file == nil {
		return 0
	}
	return file.Lines().PosAt(origin.Span.Offset).Line
}

// documentDiagnostic classifies a typed docplan, docir or docrender failure.
// Untyped failures keep their message under a generic kind.
func (cached *cachedModel) documentDiagnostic(stage string, err error) DocumentDiagnostic {
	out := DocumentDiagnostic{Stage: stage, Kind: stage, Severity: "error", Message: err.Error()}
	var planning *docplan.Error
	var evaluation *docir.Error
	var rendering *docrender.Error
	switch {
	case errors.As(err, &planning):
		out.Kind = docplanKinds[planning.Kind]
		out.Severity = planning.Kind.Severity().String()
		out.Document, out.Content, out.Query = planning.Document, planning.Content, planning.Query
		out.File, out.Line = cached.locate(planning.Origin)
	case errors.As(err, &evaluation):
		out.Kind = docirKinds[evaluation.Kind]
		out.Document, out.Content, out.Query = evaluation.Document, evaluation.Content, evaluation.Query
		out.File, out.Line = cached.locate(evaluation.Origin)
	case errors.As(err, &rendering):
		out.Kind = docrenderKinds[rendering.Kind]
		out.Content = rendering.Content
	}
	if out.Kind == "" {
		out.Kind = stage
	}
	return out
}

func (cached *cachedModel) locate(origin symbols.Origin) (string, int) {
	if !origin.Located() || cached.document(origin.Doc) == nil {
		return "", 0
	}
	return origin.Doc, cached.lineOf(origin)
}

var docplanKinds = map[docplan.ErrorKind]string{
	docplan.ErrorInvalidContext:             "invalidContext",
	docplan.ErrorLibraryUnavailable:         "libraryUnavailable",
	docplan.ErrorNotDocumentDefinition:      "notDocumentDefinition",
	docplan.ErrorMissingTitle:               "missingTitle",
	docplan.ErrorInvalidAttribute:           "invalidAttribute",
	docplan.ErrorInvalidContent:             "invalidContent",
	docplan.ErrorNestedDocument:             "nestedDocument",
	docplan.ErrorMissingText:                "missingText",
	docplan.ErrorConflictingText:            "conflictingText",
	docplan.ErrorMissingQuery:               "missingQuery",
	docplan.ErrorConflictingQuery:           "conflictingQuery",
	docplan.ErrorUnknownQuery:               "unknownQuery",
	docplan.ErrorQueryPlanning:              "queryPlanning",
	docplan.ErrorInvalidStyle:               "invalidStyle",
	docplan.ErrorUnknownParameter:           "unknownParameter",
	docplan.ErrorDuplicateBinding:           "duplicateBinding",
	docplan.ErrorMissingBinding:             "missingBinding",
	docplan.ErrorUnsupportedBinding:         "unsupportedBinding",
	docplan.ErrorBindingType:                "bindingType",
	docplan.ErrorBindingMultiplicity:        "bindingMultiplicity",
	docplan.ErrorMissingViewSource:          "missingViewSource",
	docplan.ErrorInvalidViewSource:          "invalidViewSource",
	docplan.ErrorUnknownViewSource:          "unknownViewSource",
	docplan.ErrorMissingDiagramKind:         "missingDiagramKind",
	docplan.ErrorConflictingKind:            "conflictingKind",
	docplan.ErrorUnsupportedKind:            "unsupportedKind",
	docplan.ErrorInvalidDirection:           "invalidDirection",
	docplan.ErrorUnsupportedDirection:       "unsupportedDirection",
	docplan.ErrorInvalidPalette:             "invalidPalette",
	docplan.ErrorUnsupportedPalette:         "unsupportedPalette",
	docplan.ErrorInvalidPorts:               "invalidPorts",
	docplan.ErrorUnsupportedPorts:           "unsupportedPorts",
	docplan.ErrorInvalidShow:                "invalidShow",
	docplan.ErrorInvalidOverlay:             "invalidOverlay",
	docplan.ErrorUnsupportedOverlay:         "unsupportedOverlay",
	docplan.ErrorConflictingRuns:            "conflictingRuns",
	docplan.ErrorAmbiguousRun:               "ambiguousRun",
	docplan.ErrorMissingRunText:             "missingRunText",
	docplan.ErrorInvalidRunStyle:            "invalidRunStyle",
	docplan.ErrorMissingLinkTarget:          "missingLinkTarget",
	docplan.ErrorMissingRefTarget:           "missingRefTarget",
	docplan.ErrorUnknownRefTarget:           "unknownRefTarget",
	docplan.ErrorInvalidRefTarget:           "invalidRefTarget",
	docplan.ErrorAmbiguousRefTarget:         "ambiguousRefTarget",
	docplan.ErrorUnknownValueTarget:         "unknownValueTarget",
	docplan.ErrorInvalidValueTarget:         "invalidValueTarget",
	docplan.ErrorUnknownGroupColumn:         "unknownGroupColumn",
	docplan.ErrorInvalidColumnWidths:        "invalidColumnWidths",
	docplan.ErrorInvalidColumnLabels:        "invalidColumnLabels",
	docplan.ErrorColumnRunWithoutQuery:      "columnRunWithoutQuery",
	docplan.ErrorConflictingColumnRuns:      "conflictingColumnRuns",
	docplan.ErrorMissingRunColumn:           "missingRunColumn",
	docplan.ErrorConflictingRunStyle:        "conflictingRunStyle",
	docplan.ErrorUnknownRunColumn:           "unknownRunColumn",
	docplan.ErrorMissingDefinitionColumn:    "missingDefinitionColumn",
	docplan.ErrorUnknownDefinitionColumn:    "unknownDefinitionColumn",
	docplan.ErrorMissingFormulaSource:       "missingFormulaSource",
	docplan.ErrorMissingImageLocation:       "missingImageLocation",
	docplan.ErrorUnsupportedMarkupLanguage:  "unsupportedMarkupLanguage",
	docplan.ErrorUnsupportedMarkupConstruct: "unsupportedMarkupConstruct",
	docplan.ErrorMisplacedMarkupBody:        "misplacedMarkupBody",
	docplan.ErrorMarkupBodyNotParagraph:     "markupBodyNotParagraph",
	docplan.ErrorMarkupToolMissing:          "markupToolMissing",
	docplan.ErrorMarkupToolFailed:           "markupToolFailed",
	docplan.ErrorMarkupHeadingLevel:         "markupHeadingLevel",
}
var docirKinds = map[docir.ErrorKind]string{
	docir.ErrorInvalidContext:          "invalidContext",
	docir.ErrorInvalidPlan:             "invalidPlan",
	docir.ErrorQueryExecution:          "queryExecution",
	docir.ErrorViewRendering:           "viewRendering",
	docir.ErrorUnknownGroup:            "unknownGroup",
	docir.ErrorUnknownRunColumn:        "unknownRunColumn",
	docir.ErrorInvalidRunStyle:         "invalidRunStyle",
	docir.ErrorInvalidRunTarget:        "invalidRunTarget",
	docir.ErrorBlankMath:               "blankMath",
	docir.ErrorUnknownDefinitionColumn: "unknownDefinitionColumn",
	docir.ErrorMissingImageLocation:    "missingImageLocation",
	docir.ErrorValueEvaluation:         "valueEvaluation",
	docir.ErrorEmptyValue:              "emptyValue",
}
var docrenderKinds = map[docrender.ErrorKind]string{
	docrender.ErrorNilDocument:          "nilDocument",
	docrender.ErrorUnknownContent:       "unknownContent",
	docrender.ErrorMissingRendering:     "missingRendering",
	docrender.ErrorUnrenderableDiagram:  "unrenderableDiagram",
	docrender.ErrorUnrenderableForm:     "unrenderableForm",
	docrender.ErrorUnknownForm:          "unknownForm",
	docrender.ErrorOversizedDiagram:     "oversizedDiagram",
	docrender.ErrorEmptyStylesheet:      "emptyStylesheet",
	docrender.ErrorAmbiguousStylesheet:  "ambiguousStylesheet",
	docrender.ErrorUnsafeStylesheet:     "unsafeStylesheet",
	docrender.ErrorUnknownTheme:         "unknownTheme",
	docrender.ErrorSurplusDiagramImages: "surplusDiagramImages",
	docrender.ErrorTableColumns:         "tableColumns",
}
