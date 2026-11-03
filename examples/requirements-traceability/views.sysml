package TraceViews {
    private import StandardViewDefinitions::*;
    view requirements : GeneralView {
        filter @SysML::RequirementDefinition or @SysML::RequirementUsage;
        expose TraceRequirements::**;
    }
    view overview : GeneralView {
        expose TraceRequirements::**;
        expose TraceSystem::LeftPlant::tank;
        expose TraceSystem::RightPlant::tank;
        expose TraceSystem::spare;
    }
}
