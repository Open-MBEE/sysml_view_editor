package OrganizationViews {
    private import StandardViewDefinitions::*;
    view outline : GeneralView { expose Organization::*; }
    view dependencies : GeneralView {
        filter @SysML::Package;
        expose Organization;
        expose Organization::Common;
        expose Organization::Control;
        expose Organization::Plant;
    }
}
