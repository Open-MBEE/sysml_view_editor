# Source assistance and local recovery

The workbench composes a separate Toolkit language adapter in `shell/session.ts`. Language queries are read-only and use every current draft source file, including unapplied text. Each request runs in a disposable worker against the pinned Toolkit library and negotiates UTF-16 positions. Normalization converts between raw source offsets and protocol positions, including CRLF and astral Unicode characters.

Completion is explicit with Control+Space. Only supported single plain-text edits are offered; snippets, additional edits and commands are excluded. Hover and F1 display plain text. F12 navigates to one exact project-file definition; unavailable, ambiguous and library-only targets explain their limits. The editor rejects results after draft, session, file or busy-state changes and rechecks completion validity when applying it. Queries do not apply source, change model history or replace views.

## Recovery storage

Local recovery uses one IndexedDB record per browser origin: database `sysml-view-recovery`, store `recovery`, key `latest`. A separately validated version-1 recovery envelope contains a serialized portable project, save time and active file/view. The portable project format remains version 1. Recovery includes applied source, drafts and saved presentation geometry; it does not include canvas camera or undo history.

After edits, the workbench debounces an immutable project snapshot for 750 ms. Dirty projects and unapplied drafts qualify, including drafts retained after a download. Recovery serialization does not mark the project downloaded or add history. Restored projects remain unsaved until downloaded, including when their drafts match applied source. While local recovery is enabled, when work returns to a clean state after discard, undo or download, an ordered atomic clear removes this session’s older recovery copy. Pending startup or foreign copies remain protected. The enabled preference is a separate boolean in localStorage under `sysml-view-recovery-enabled-v1`.

A startup record blocks replacement until an explicit restore/discard choice. Restore validates the project through the real workspace engine before replacing it, confirms replacement of dirty current work, and accepts the recovery snapshot synchronously before observing subsequent work. The active view is checked against the restored model. Failed restore retains the stored record and current project.

Writes and deletion use an atomic compare-and-swap transaction against the exact previously read string. A competing tab's change causes a visible conflict; retry reads and protects that copy for an explicit choice. Denied storage and write failures retain the editable project and permit retry. Malformed or future string envelopes remain protected until explicit discard. An unsupported non-string IndexedDB value is retained and reported unavailable; this version cannot discard that value through the app.

Only one recovery copy is kept, without a time-based expiration. Disabling saving retains the existing record until discarded. Browser storage is local to the origin and may be cleared or unavailable; downloaded project files remain the portable backup mechanism.
