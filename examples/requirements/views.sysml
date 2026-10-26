package CapacityViews {
    private import StandardViewDefinitions::*;
    view requirements : GeneralView {
        filter @SysML::RequirementDefinition or @SysML::RequirementUsage;
        expose CapacityRequirements::**;
    }
}
