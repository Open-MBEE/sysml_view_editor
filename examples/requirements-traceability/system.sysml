package TraceSystem {
    part def Tank {
        attribute capacity : ScalarValues::Real;
    }
    package LeftPlant {
        part tank : Tank {
            attribute :>> capacity = 20.0;
        }
    }
    package RightPlant {
        part tank : Tank {
            attribute :>> capacity = 30.0;
        }
    }
    part spare : Tank {
        attribute :>> capacity = 40.0;
    }
}
