package TraceRequirements {
    private import TraceSystem::*;
    requirement def <'REQ-CAP'> MinimumCapacity {
        doc /* The storage tank shall provide at least ten units of usable
               capacity. This declared requirement and its satisfaction links
               are model content, not evidence that a test has passed. */
        subject tank : Tank;
        require constraint { tank.capacity >= 10.0 }
    }
    alias CapacityRule for MinimumCapacity;
    requirement <'REQ-LEFT'> leftSpecification {
        doc /* Capacity requirements for the left installation. */
        subject installation : Tank;
        requirement <'REQ-LEFT-CAP'> leftCapacity : CapacityRule {
            subject tank = TraceSystem::LeftPlant::tank;
        }
    }
    requirement <'REQ-RIGHT'> rightSpecification {
        doc /* Capacity requirements for the right installation. */
        subject installation : Tank;
        requirement <'REQ-RIGHT-CAP'> rightCapacity : CapacityRule {
            subject tank = TraceSystem::RightPlant::tank;
        }
    }
    requirement <'REQ-UNLINKED'> unlinkedCapacity : MinimumCapacity {
        subject tank = TraceSystem::spare;
    }
    requirement <'REQ-EXCLUDED'> excludedCapacity : MinimumCapacity {
        subject tank = TraceSystem::spare;
    }
    assert not satisfy excludedCapacity by TraceSystem::spare;
    satisfy leftSpecification.leftCapacity by TraceSystem::LeftPlant::tank;
    satisfy rightSpecification.rightCapacity by TraceSystem::RightPlant::tank;
}
