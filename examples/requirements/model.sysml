package CapacityRequirements {
    part def Tank {
        attribute capacity : ScalarValues::Real;
    }
    part storage : Tank {
        attribute :>> capacity = 20.0;
    }
    requirement def <'REQ-1'> MinimumCapacity {
        doc /* The storage tank shall have capacity of at least ten units. */
        subject tank : Tank;
        require constraint { tank.capacity >= 10.0 }
    }
    requirement <'REQ-1.1'> usableCapacity : MinimumCapacity;
    satisfy usableCapacity by storage;
}
