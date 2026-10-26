package PartExample {
    part def Drive;
    part def ElectricDrive :> Drive;
    part def Operator;
    part def Machine {
        part left {
            part motor : ElectricDrive;
        }
        part right {
            // Same local name and type, different owner and symbol context.
            part motor : ElectricDrive;
        }
        ref part operator : Operator;
    }
}
