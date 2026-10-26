# Project bundle version 1

The owning TypeBox schema is `src/lib/workspace/persistence/schema.ts`.

| Field           | Meaning                                                        |
| --------------- | -------------------------------------------------------------- |
| `format`        | `sysmlv2-view-project`                                         |
| `version`       | `1`                                                            |
| `name`          | Nonblank project display name, at most 120 characters          |
| `documents`     | Applied sources resolved together                              |
| `drafts`        | Unapplied text, retaining every applied filename               |
| `presentations` | View identity → source digest, model hash and symbol positions |

Both source sets require 1–20 unique, relative `.sysml` filenames and at most 5 MiB of UTF-8 source. The bundle limit is 24 MiB. Parent traversal, absolute paths, backslashes and control characters are rejected. Positions must be finite and within supported bounds. Unknown versions are rejected explicitly; future migrations require fixtures for previous versions.

The source digest is SHA-256 over the normalized ordered source-document serialization. Presentations are restored only for matching source and model identities, and only existing artifact nodes consume stored positions. A valid position record does not establish semantic membership.

Positions are absolute model-space coordinates, including for nested structures. Parent-relative canvas coordinates are converted at the workbench boundary; the version-1 shape is unchanged. A group move stores the affected descendants in the same presentation update. Saved child positions outside the current rendered owner's bounds are arranged again with an explicit notice rather than changing ownership. [Structural projection](structural-views.md).

Opening parses the applied source set before restoring drafts. Project replacement must preserve the previous session on parse failure. Download includes invalid drafts; a successful download preparation does not verify where the browser stored the file. Browser reload recovery, active tabs/cameras, folder write-back and migration from the predecessor app's formats are not implemented in this version.
