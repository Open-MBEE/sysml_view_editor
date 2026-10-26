package OperationViews {
    private import StandardViewDefinitions::*;
    view scenarios : GeneralView {
        filter @SysML::UseCaseUsage;
        expose Operations::'Operate station';
    }
    view definitions : GeneralView {
        expose Operations::*[@SysML::CaseDefinition];
    }
}
