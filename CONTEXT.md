# Model exploration and authored views

Language for understanding a SysML project and choosing how to inspect its content. These terms distinguish model content from its storage and graphical presentation.

## Language

**Source file**:
An authoring document containing SysML declarations. A file boundary is not necessarily a package or system boundary.
_Avoid_: Model, system, diagram when referring to a file.

**Project model**:
The logical model resolved from a project's source documents together. It can contain several systems, reusable definitions and packages.
_Avoid_: Full system when referring to all project content.

**Applied model**:
The last accepted, validated model revision. Unapplied draft source can differ from the source of this revision.

**Scope**:
The model content being inspected, such as the project, a package or a particular system usage. A definition and its individual usages are distinct subjects.

**Representation**:
The graphical form used to inspect a scope, such as an overview or internal structure. Representation choice does not define the underlying system.
_Avoid_: Named view when only the graphical form is meant.

**Exploration**:
A temporary browsing context consisting of a scope and representation, without requiring an authored SysML view declaration.
_Avoid_: View usage, saved view.

**Named view**:
An authored SysML view usage specifying a repeatable presentation of model content through its declared scope, exposure, filters and representation semantics.
_Avoid_: Diagram tab, temporary exploration.

**Diagram presentation**:
The visual arrangement of symbols for a particular graphical context. Geometry does not establish semantic ownership, connectivity or usage identity.

**Camera**:
The viewport position and zoom through which a diagram is inspected. Camera movement does not change model-space geometry.
