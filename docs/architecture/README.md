# Architecture

One static browser application contains a framework-independent workspace and a React workbench. There is one npm project. Internal modules expose small interfaces; extraction into separately published packages requires a concrete second consumer.

## Ownership and direction

| Module                      | Owns                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `workspace/project`         | Source documents, validation of membership/limits, applied model records, exact source digests    |
| `workspace/editing`         | Command schemas, engine-facing interfaces and command postconditions                              |
| `workspace/views`           | Evaluated artifact/identity contracts and revision checks                                         |
| `workspace/history`         | Accepted transaction history                                                                      |
| `workspace/persistence`     | Versioned project schema, serialization and format rules                                          |
| `workspace/createWorkspace` | Session lifetime and prepare/accept orchestration                                                 |
| `engines`                   | Disposable workers, timeout/cancellation, engine-specific calls and data normalization            |
| `workbench`                 | Files/Views/Model navigation, source interaction, diagrams, properties, dialogs and UI state      |
| `contracts`                 | Shared validation mechanics; schemas remain with their owners                                     |
| `ui`                        | Shared React controls, theme tokens and browser appearance preferences; no workspace transactions |

The workspace imports neither React/DOM nor engine implementations. Engine adapters satisfy the two interfaces declared by editing; they have distinct roles. `workbench/shell/session.ts` constructs them and creates a session. UI entry points call the same workspace operations. `npm run check:architecture` checks import direction and platform globals.

## Transaction interface

`prepare(command)` captures an applied revision, invokes Toolkit against the whole source set, validates the complete candidate with OpenSysML, checks command postconditions and returns an immutable proposal. It does not publish sources. `accept(proposal)` accepts only a proposal actually issued by that session against the current revision, then publishes one history entry. Draft changes invalidate outstanding proposals, including edit-and-revert sequences.

Source application validates drafts independently of the previous applied snapshot. Invalid drafts retain the previous model/view. Cancellation and generation checks prevent late work from replacing current state. Closing a session terminates in-flight worker requests.

Source changes conservatively invalidate presentation mappings. A future identity reconciliation policy must use verified mappings and dedicated fixtures. A source transaction can succeed while a renderer is unsupported; the workbench reports that separately.

## Views

Named views are actual SysML usages. Open existing views without authoring another declaration. New view takes a subject, representation and name; package ownership is advanced configuration. Definitions, exposure and filters remain source content. The canvas is a derived artifact and does not serialize the model.

Semantic subject identity, usage context and symbol identity remain distinct. Geometry changes never imply semantic containment or connectivity. The bounded structural projection consumes engine parent IDs, typed inherited ports and explicit connection endpoints; port selection retains its usage context. `moveSymbols` validates a complete presentation batch before publishing it, so moving a group and its descendants keeps version-1 absolute coordinates consistent without a source transaction. [Structural projection, engine trace and limits](structural-views.md).

## TypeBox

Project files, semantic command input, worker envelopes and normalized engine responses use TypeBox schemas with inferred TypeScript types. Version-1 owned persistence/transport objects reject unknown fields where specified; engine-owned artifact objects permit additional engine metadata. Validation checks shapes without defaults or coercion. Referential, ownership, revision and postcondition rules remain explicit code.

## Testing seams

Unit tests exercise workspace interfaces with controlled engine responses. These do not establish engine conformance. Browser scenarios run real Go/Rust-derived WASM, verify source changes and reopen project bundles. Engine preparation runs the retained Go bridge tests before building its module. Keep a failing model fixture with every semantic regression.
