package Reading {
    private import ScalarValues::*;
    part def Configuration {
        attribute capacity : Real default = 12.5;
        attribute evidence : String default = "records/default.json";
    }
    part small : Configuration {
        :>> capacity = 24.0;
        :>> evidence = "records/α-evidence.json";
    }
    part large : Configuration {
        :>> capacity = 48.0;
        :>> evidence = "records/large-evidence.json";
    }
  part def Sensor { attribute gain : Real default = 12.50; }
  part def Pair { part left : Sensor; part right : Sensor; }
  part alpha : Pair { part :>> left { attribute :>> gain = 101; } }
  part beta : Pair { part :>> left { attribute :>> gain = 202; } }
  part valueless : Sensor { attribute :>> gain; }
  part bound : Sensor;
  attribute replacement : Real = 99;
  bind bound.gain = replacement;
}
package ReadingViews {
    view configurations : StandardViewDefinitions::GeneralView {
        expose Reading::small;
        expose Reading::small::capacity;
        expose Reading::small::evidence;
        expose Reading::large;
        expose Reading::large::capacity;
        expose Reading::large::evidence;
    }

  view nested : StandardViewDefinitions::InterconnectionView {
    expose Reading::alpha;
    expose Reading::beta;
    expose Reading::valueless;
    expose Reading::bound;
  }
}
