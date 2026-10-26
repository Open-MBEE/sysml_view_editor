package PartViews {
    private import StandardViewDefinitions::*;
    view structure : InterconnectionView { expose PartExample::Machine; }
    view definitions : GeneralView {
        filter @SysML::Definition or @SysML::Usage;
        expose PartExample::Drive;
        expose PartExample::ElectricDrive;
        expose PartExample::Operator;
        expose PartExample::Machine;
    }
}
