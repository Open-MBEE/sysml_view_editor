# 0001: Browser workspace with explicit source transactions

Date: 2026-10-26. Status: initial implementation direction.

## Decisions

- React, TypeScript and Vite provide the browser workbench. React was selected during the fresh-start discussion for ecosystem reuse. Domain/workspace code remains independent of React.
- Retain React Flow and ELK for graph interaction/layout. Build SysML operations and adapters around them.
- OpenSysML supplies authoritative interpretation and native view evaluation; Toolkit proposes source transformations. The two engines have distinct interfaces and are not interchangeable semantic authorities.
- Source owns model declarations and native view semantics. Presentation owns geometry. Every supported graphical semantic edit produces a reviewed source transaction.
- TypeBox defines runtime data contracts and inferred types for persistence and worker/engine messages. Semantic invariants remain explicit workspace rules.
- Keep a single npm project and enforce import direction. Add packages/plugins/backends only for demonstrated requirements.

## Consequences

The initial scope is smaller than the predecessor application and is recorded in capabilities. Reusing pinned engine preparation/overlays preserves proven integration work and provenance while the application is implemented afresh. Whole-project worker requests are initially disposable and bounded by timeouts; persistent/incremental sessions require measured evidence and compatibility tests.

The project format includes source/drafts and compatible positions from the outset. Conservative layout invalidation is preferable to unverified identity matching. Source selection, renderer support and editing capability remain separate outcomes internally, while users open named views through one list.
