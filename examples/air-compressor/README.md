# Smart air workshop

This is the editor's startup project. Its nine SysML files and 14 named views model the compressor's electrical and pneumatic assemblies, cooling, two installed compressor usages, tools, operator/technician roles, requirements, behaviour and enclosure geometry.

The default opens **pneumatics** in Diagram mode: pump, tank, regulator, relief valve and pressure sensor, with 13 displayed ports and four authored connections. **Split** reveals the source; other named views remain available in the sidebar.

| File                 | Features                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `system.sysml`       | Compressor, electrical/pneumatic assemblies, workshop/context, connections and a power-budget constraint |
| `components.sysml`   | Reusable part definitions, attributes, sensor/valve specialization and cooling assembly                  |
| `types.sysml`        | Air, power, readings, commands, alarms and directed port definitions                                     |
| `behavior.sysml`     | Normal supply and maintenance actions, allocations, operating states and transitions                     |
| `requirements.sysml` | Quantified requirements, satisfaction declarations and verification case declarations                    |
| `use-cases.sysml`    | Operator/technician objectives and explicitly bound include usages                                       |
| `sequence.sysml`     | Startup, tool-demand and overheating-shutdown interactions                                               |
| `geometry.sysml`     | Unit-bearing enclosure dimensions and authored placement                                                 |
| `views.sysml`        | Four structural views, definitions, requirements and behaviour/geometry selections                       |

## Views and current support

- **overview**, **structure**, **installation**, **pneumatics**: structural diagrams. Nested typed assemblies can remain component-level nodes, with deeper links collapsed to those nodes. Conjugated type labels are retained, but payload expansion and effective conjugated directions remain incomplete.
- **definitions**: part definitions, specialization, typing and composition with generic relationship lines.
- **requirements**: a GeneralView tree of the specification and applied subjects; dedicated requirement notation and satisfaction/verification trace links are not drawn.
- **actions**, **maintenance**, **useCases**, **states**, **startupSequence**, **demandSequence**, **faultSequence**, **envelopeGeometry**: evaluated by the pinned engine, with explicit unavailable-renderer messages in this application.

Attributes and constraints remain authored source; the diagram does not draw full attribute compartments or run a solver. Satisfaction and verification declarations are not evidence of a completed test. Conjugated endpoints cannot be used by the bounded graphical connection command. Use the smaller [assembly fixture](../assembly/model.sysml) to exercise that command's explicit same-type endpoint subset.

The [catalog](../catalog.json) retains exact engine node/relationship expectations, visual targets and gaps for every view. [Verification](../../docs/verification.md) distinguishes engine results, application behaviour and local test evidence.

## Provenance

The nine `.sysml` files are copied unchanged from `sysml_ide/examples/sysml-structural/air-compressor/` at revision `bdb85e2341ba5a1a7ce3c6fab4f056c5cb6bca18`, under Apache-2.0. Root [NOTICE](../../NOTICE) records attribution. Startup selection, documentation and application-specific gaps are maintained here.
