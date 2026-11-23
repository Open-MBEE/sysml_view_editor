package ScopeDemo {
    part def Wheel;
    part def Sat {
        part a : Wheel;
        part b : Wheel;
        part c : Wheel;
    }
}
package ScopeViews {
    private import StandardViewDefinitions::*;
    view definitions : GeneralView {
        filter @SysML::PartDefinition;
        expose ScopeDemo::Sat;
    }
    view tree : GeneralView {
        expose ScopeDemo::Sat;
    }
    view definitionsAndUsages : GeneralView {
        filter @SysML::PartDefinition or @SysML::PartUsage;
        expose ScopeDemo::Sat;
    }
    view explicitMembers : GeneralView {
        filter @SysML::PartDefinition or @SysML::PartUsage;
        expose ScopeDemo::Sat;
        expose ScopeDemo::Sat::*;
    }
}
