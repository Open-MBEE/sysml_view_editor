# Editing Flexo MMS models from the view editor

Researched 2026-10-30 against OpenMBEE documentation and source. The intended workflow is editing both models created here and existing models created by other tools. This is a design investigation; no Flexo deployment or round-trip experiment was run.

## Established interfaces

Flexo MMS Layer 1 versions RDF graphs through organizations, repositories, branches, commits, locks and diffs. Reads use SPARQL; writes use updates or graph replacement. Its policies apply to repository resources. This is distinct from the earlier document-oriented MMS, now `exec-mms`; compatibility with that service must be treated separately. [Architecture](https://flexo-mms.openmbee.org/architecture/), [Layer 1](https://flexo-mms.openmbee.org/services/layer1/).

The dedicated Flexo SysML v2 service implements the OMG Systems Modeling API over Layer 1. Projects map to repositories and commits to Layer 1 commits. It exposes projects, branches, tags, commit element sets and relationships as JSON. This is the preferred semantic interface for this editor; raw SPARQL remains useful for cross-domain querying and deployment-specific metadata. [SysML v2 service](https://flexo-mms.openmbee.org/services/sysmlv2/).

The reviewed SysML v2 source is commit `836d904d455d484d1817c190806d25d90a143dc7`. Its commit handler translates JSON change records into a Layer 1 update; `replace=true` replaces the model graph. It also accepts textual notation when an optional OpenSysML `sysml-grpc` service is configured. The handler reviewed does not visibly forward an expected-head precondition; conflict prevention must be established against the selected deployment rather than assumed. [Commit handler](https://github.com/Open-MBEE/flexo-mms-sysmlv2/blob/836d904d455d484d1817c190806d25d90a143dc7/src/main/kotlin/org/openmbee/flexo/sysmlv2/apis/CommitApi.kt).

The notation service converts between API JSON and SysML/KerML, requests UUID-form IDs on input conversion, and reports diagnostics. Conversion is not evidence of exact original source-file preservation. [Notation implementation](https://github.com/Open-MBEE/flexo-mms-sysmlv2/blob/836d904d455d484d1817c190806d25d90a143dc7/src/main/kotlin/org/openmbee/flexo/sysmlv2/OpenSysml.kt).

Flexo uses bearer JWTs. The original authentication service exchanges LDAP credentials; the SSO alternative supports OAuth2/OIDC and API keys. The actual deployment determines which flow is available. The Store service stages RDF loads through S3-compatible storage for the quadstore; it should not be presumed to provide a general source-file/document API. [Authentication](https://flexo-mms.openmbee.org/services/auth/), [Store](https://flexo-mms.openmbee.org/services/store/).

Compose and Kubernetes deployment paths are documented, but the main OpenMBEE page calls the SysML v2 setup a beta. Published documentation and source availability do not establish the feature set or conformance of a particular deployed image. [Deployment](https://flexo-mms.openmbee.org/services/deployment/), [OpenMBEE SysML v2](https://www.openmbee.org/flexo.html).

## Existing OpenMBEE client work

OpenMBEE's SysML v2 Web Modeler is a Java/Pilot service with graphical rendering, textual editing and remote project/branch access. It is worth sharing fixtures and interchange findings with this project. Its deployment model includes a server between browser and repository. [Web Modeler](https://github.com/Open-MBEE/sysmlv2-web-modeler).

Source reviewed at `b173564276814ca84007915852a3a80fb637bcd5` shows repository readback trying Xtext serialization and then custom fallback text. This does not promise faithful reconstruction of original authoring files. Its Python bridge posts a whole-model replacement commit and supplies no base-commit guard of its own. Reusing it unchanged would not satisfy safe multi-tool editing. [Textual service](https://github.com/Open-MBEE/sysmlv2-web-modeler/blob/b173564276814ca84007915852a3a80fb637bcd5/app/TextualModelService.java), [Commit bridge](https://github.com/Open-MBEE/sysmlv2-web-modeler/blob/b173564276814ca84007915852a3a80fb637bcd5/app/sysml_replace_commit.py).

## Fit with this editor

The [workspace architecture](../architecture/README.md) makes applied source authoritative, keeps drafts separate, and validates complete semantic proposals before acceptance. The [version-1 bundle](../architecture/project-format.md) preserves exact applied documents, drafts and compatible presentation positions. An MMS graph checkout supplies semantic elements; it may have no original source files to recover. Generated authoring text must therefore be identified as generated, with a demonstrated mapping back to repository identities.

The application's normalized model and rendered symbols are insufficient as full SysML interchange. Names, source spans and renderer counters are revision-scoped. They must not become MMS element UUIDs. The [identity investigation](../architecture/engine-identity-sources.md) records the separate identity domains and lack of a demonstrated Toolkit/OpenSysML identity join.

There is already a promising local seam: the pinned Toolkit `0.10.10` wrapper exposes `Session.fromInterchangeJson`, `toCompactJson`, `toFullJsonStrict` and `toFullJson`. Its comments explicitly mention Flexo change records. These methods are not currently exposed through the application's worker contract, and comments are not conformance evidence. Inspect the prepared wrapper under `static/vendor/sysml-toolkit/`; [preparation](../../scripts/prepare-sysml-toolkit.mjs) and the [engine guide](../../engine-bridge/README.md) own pin/checksum provenance. Test this existing capability before adding another parser service or dependency.

## Recommended bounded milestones

1. **Prove interchange on a disposable repository.** Pin the actual Flexo image and API schema. Load an element set produced by another tool into the pinned Toolkit; generate editable text; re-export without edits; compare identities, metaclasses, relationships, explicit properties and references. Preserve the raw checkout as comparison evidence. Include unsupported constructs, standard-library references, repeated usages, anonymous elements and Unicode.
2. **Deliver read-only checkout.** Choose project/branch, resolve its head once, fetch every page from that immutable commit, validate transport, and open supported views. Retain project, branch and commit IDs. Show generated source and unsupported constructs explicitly. Do not replace an existing local session until checkout succeeds.
3. **Allow one proven writeback command.** Start with rename of an existing element while preserving its repository UUID and every unedited semantic property. Generate a reviewed change set relative to the original checkout. Require a server-enforced stale-head check; a client read-then-write comparison alone has a race. If the selected service cannot enforce it, address that service contract before shared-branch editing.
4. **Extend to models created here and broader commands.** Establish UUID assignment/reuse for creation, deletion and reopen; add multi-file/source provenance and presentation associations as explicit versioned integration data. Keep semantic commits separate from private invalid drafts. Publish layout only when its model/view/usage binding is validated.

Success means another tool can reopen the committed model with the same intended identities and references, an unchanged round trip preserves semantic content, concurrent branch movement rejects the stale write, and failed conversion/authentication/publication retains local drafts and the prior applied model. Local undo history should remain separate from published repository history; undoing a published change requires a new reviewed commit.

## Decisions and unknowns

- Which MMS generation, deployment version, authentication flow and enabled notation service are actually targeted?
- Can the pinned Toolkit retain all relevant foreign-model semantics and UUIDs through editable text and subsequent reparses? What must remain read-only?
- Where will exact source documents, file boundaries, presentation data and their association with a semantic commit live? No reviewed interface establishes an atomic source-plus-layout-plus-semantic commit.
- Does the chosen API provide an enforceable expected-head condition, and what happens when publication times out after the server may have committed?
- Do browser CORS and login constraints permit direct access? Add a same-origin gateway only when deployment evidence requires it.

These are unresolved contracts, not implemented capabilities. A successful HTTP POST or visually plausible diagram is not sufficient evidence of safe interoperability.
