# Read-only requirements data

The requirements table and traceability matrix inspect the complete **applied** source set, independently of named diagram exposure. They do not create a view declaration, modify source, evaluate requirements or write presentation data. Unapplied drafts remain unchanged and are called out explicitly.

`workspace/requirements` owns the TypeBox response schema and source-bound validation. The browser semantic worker parses the exact applied documents, checks the model hash and calls the retained OpenSysML `EvaluateRelationships` bridge. The combined server validates that cached model before inspection. The bridge returns requirement definitions/usages (excluding verification objectives), declared identifiers and documentation, and resolved allocation/satisfaction/verification endpoints. Assertion and negation are retained separately. Library-only/unlocated endpoints cannot pass the project-origin validator. Incomplete extraction returns no rows or links; an unknown result is never presented as an empty matrix.

The workspace checks the applied model and source references again after the asynchronous request. Switching projects, applying source or disposing the workspace rejects a late result. Component lifetime cancellation terminates the disposable worker. Read-only inspection does not take over transaction history or the active diagram.

The table supports name/identifier/documentation filtering, name sorting and CSV export. The matrix supports satisfaction and verification, with requirements on rows and **linked** elements on columns. Matrices above 10,000 cells require narrowing the requirement search before display/export. Unlinked requirements remain rows; this first version does not enumerate all possible satisfiers, edit relationships, compute transitive links or infer compliance. Repeated local names remain separate by exact declaration identity. Multiple declarations in one cell remain separate, including negated assertions.

Selecting a row, column or link reveals its exact recorded declaration. Source reveal is refused when that file's draft differs from applied source, rather than applying an old byte range to new text. The diagram stays mounted while data is shown, retaining its camera and presentation. CSV and read-only display settings do not alter the portable version-1 bundle.

Selecting a named view returns to the diagram. Successfully opening or restoring a project also starts in diagram mode; failed operations retain the current representation.
