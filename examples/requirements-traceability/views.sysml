package TraceViews {
    private import StandardViewDefinitions::*;
    view requirements : GeneralView {
        filter @SysML::RequirementDefinition or @SysML::RequirementUsage;
        expose TraceRequirements::MinimumCapacity;
        expose TraceRequirements::leftSpecification;
        expose TraceRequirements::rightSpecification;
        expose TraceRequirements::unlinkedCapacity;
        expose TraceRequirements::excludedCapacity;
        expose TraceRequirements::leftSpecification::leftCapacity;
        expose TraceRequirements::rightSpecification::rightCapacity;
    }
    view overview : GeneralView {
        expose TraceRequirements;
        expose TraceSystem;
    }
}
