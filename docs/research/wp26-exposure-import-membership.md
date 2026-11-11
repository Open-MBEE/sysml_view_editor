# WP26 exposure and intermediate import membership

Investigation recorded 2026-11-11 for [view-editor issue #20](https://github.com/Open-MBEE/sysml_view_editor/issues/20), on editor `890fe88d2bc31a137e156fa57d3783ca5ed7e807`, OpenSysML 0.12.0 / `760c4d1fc8edfa4e214423099065c0a7c1b24e2d`. Prepared WASM SHA-256: `9149b23d80b7fd0b6935b374f0e9102c270bc5f7d595b43a8186d01dece7b663`.

## Findings

The report's owned-only expectation is incorrect: a view exposure can admit private imported memberships. Wildcard standard-view imports bring public metamodel reexports into selection, then the renderer can expand the selected elements. Explicit element exposures and named imports are useful ways to bound that scope. They are not a repair for a visibility defect.

A separate intermediate-import defect is reproduced. The current resolver mixes flattened index reexports with namespace membership enumeration, bypassing the admission rules of intermediate imports. It also tests original declaration visibility where imported membership visibility depends on the import route. Unexpected declarations occur in the selected set before rendering.

Minimal shape:

```sysml
package ReviewSource {
    public part def Visible;
    private part def Hidden;
}
package Mid {
    private import ReviewSource::*;
    private part def OwnHidden;
}
package Probe {
    private import Mid::*;
    view focused : StandardViewDefinitions::GeneralView { expose Mid::*; }
}
```

The immediate exposure should select `Mid::OwnHidden` and `ReviewSource::Visible`. It also selects `ReviewSource::Hidden` at this pin. Changing the exposure to `Probe::*` should select only Probe's own view; the ordinary import of Mid cannot reexport Mid's private owned or privately imported memberships. The current pin incorrectly selects `Mid::OwnHidden`. The retained tests put some views outside the target namespaces so their expected sets do not include a view declaration accidentally.

The governing rules are [SysML 2.0 Part 1](https://www.omg.org/spec/SysML/2.0/Language/PDF), §8.3.26.2 and §8.3.26.4, and [KerML 1.0](https://www.omg.org/spec/KerML/1.0/PDF), §8.3.2.4.5–6. Exposure fixes its own `isImportAll` to true. Each selected intermediate import still invokes its own `importedMemberships` with its own `isImportAll`; an outer exposure does not recursively change every ordinary import to import-all. Imported membership visibility at the next boundary comes from its admitting import route.

## Retained upstream regression

[The executable Go fixture](../../tests/fixtures/opensysml-0.12-exposure-membership_test.go) targets the pinned upstream combined frontend package. It is a research reproduction, not a passing editor regression or a skipped test in the normal editor suite. At the current pin, seven of ten origin-selection cases fail. Ordinary-reference and native-traversal controls pass. The split-namespace control passes on the current pin and must remain passing in any proposed fix.

After normal engine preparation, from the repository root, run it without editing the prepared source:

```sh
mkdir -p sandbox/exposure-membership
python3 - <<'PY'
import json
from pathlib import Path
root = Path.cwd()
target = root / 'sandbox/opensysml-012/source/internal/frontend/combined/wp26_exposure_test.go'
fixture = root / 'tests/fixtures/opensysml-0.12-exposure-membership_test.go'
(root / 'sandbox/exposure-membership/overlay.json').write_text(
    json.dumps({'Replace': {str(target): str(fixture)}})
)
PY
GOCACHE="$PWD/sandbox/exposure-membership/go-cache" \
GOMODCACHE="$PWD/sandbox/opensysml-012/go-modules" \
GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOFLAGS=-mod=readonly \
sandbox/opensysml-012/go/bin/go -C sandbox/opensysml-012/source test \
  -overlay "$PWD/sandbox/exposure-membership/overlay.json" \
  ./internal/frontend/combined -run TestIssue20 -count=1 -v
```

The expected failure is the exact selected-origin mismatch, not a dependency/build failure. Tests compare source declaration slices and origins, not ordinal IDs or diagram node counts. They cover ordinary/private/public/import-all routes, named and absent imports, private outside lookup, native traversal versus selected scope, and namespace declarations split across two source files.

## Rejected experiment and upstream request

An experimental resolver overlay made all ten simple selection cases pass, but dropped a valid import contributed by a second declaration of the same namespace in another document. It is not integrated. Resolver, semantics and symbols suites passed on that experiment; the final combined-package suite failed its split-namespace regression. Those partial passes are not sufficient acceptance evidence.

A safe change must enumerate memberships across every declaration and recorded library scope, preserve import-route visibility and each intermediate import's `isImportAll`, and retain valid alternate routes, filters, hiding and cycle behavior. The relevant upstream seams are `internal/semantic/resolve/filter.go` (`namespaceChildren`, `declaredChildren`, `appendNamespaceMembers`), `visibility.go`, and flattened reexport indexing in `internal/semantic/symbols/index.go`.

Request an upstream resolver/index fix with the retained tests. A corrected upstream pin is preferable; any temporary retained resolver overlay needs explicit source/patch identities, licenses, normal provenance regeneration, and full integration checks. Filtering private/library nodes in the renderer would hide the symptom while changing valid authored exposure semantics.

No safe production fix, hosted browser timing measurement, deployment or upstream acceptance is claimed. Raw diagnostic and experimental captures remain in the local session's ignored evidence directories; the fixture above retains the reproducible source-level contract independently of those directories. Issue #18's inherited-member projection is a separate mechanism and must not be used to compensate for import selection.
