package RoverViews {
    private import StandardViewDefinitions::*;
    view architecture : InterconnectionView { expose RoverSystem::InspectionRover; }
    view definitions : GeneralView {
        filter @SysML::PartDefinition or @SysML::PartUsage;
        expose RoverComponents::**;
    }
    view mission : ActionFlowView { expose RoverBehavior::InspectRoute; }
    view lifecycle : StateTransitionView { expose RoverBehavior::OperatingMode; }
    view requirements : GeneralView {
        filter @SysML::RequirementDefinition or @SysML::RequirementUsage;
        expose RoverRequirements::reserve;
        expose RoverRequirements::speed;
        expose RoverRequirements::clearance;
        expose RoverRequirements::imaging;
    }
}
