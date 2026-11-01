# Source issue navigation

OpenSysML's pinned ParseSources response supplies diagnostic `span.file` and one-based `span.startLine`. The existing semantic worker normalizes those to optional `file` and `line`. The workbench selects a whole reported line, retaining raw UTF-16 offsets and CRLF/CR/LF boundaries; it does not claim a column or token range that this transport does not carry.

`WorkspaceState.diagnosticDocuments` records the exact source documents associated with visible diagnostics. Failed draft application and rejected semantic candidates retain their respective inputs; accepted model diagnostics use applied documents. This transient state is independent of the version-1 portable project. Draft edits clear obsolete diagnostics and their inputs.

`workbench/issues/navigation.ts` resolves a diagnostic only when its file belongs to the current project and that file's current draft text exactly matches the diagnosed text. A known file without a line opens at the beginning with no text selected and an explicit explanation. Unknown files, unavailable snapshots and out-of-range lines expose a reason instead of a source action. A candidate error must not lend its location to the old live source.

The click handler rechecks current diagnostic membership and resolves against the current workspace snapshot before changing source focus. Source reveal preserves Code/Split mode, opening Split when the source was hidden in Diagram mode. The open named view, selected semantic element, source text and saved geometry remain independent of issue browsing. Explicit editor-mode changes retain the existing diagram-fit policy.

The browser scenarios combine actual pinned-engine errors with controlled normalized responses for unavailable locations and rejected-candidate evidence. Unit checks cover raw line bounds, Unicode, line endings and stale snapshots. These are navigation and preservation guarantees, not complete diagnostic or SysML conformance.
