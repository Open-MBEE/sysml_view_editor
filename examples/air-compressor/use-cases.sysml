package CompressorUseCases {
    private import CompressorComponents::*;
    private import CompressorSystem::*;
    use case def ChargeTank {
        subject compressor : Compressor;
        actor operator : Operator;
        objective { doc /* Build a usable supply of compressed air. */ }
    }
    use case def SupplyAir {
        subject compressor : Compressor;
        actor operator : Operator;
        objective { doc /* Supply regulated compressed air to workshop tools. */ }
    }
    use case def ProtectEquipment {
        subject compressor : Compressor;
        actor operator : Operator;
        objective { doc /* Stop the motor, cool the equipment and notify the operator on overheating. */ }
    }
    use case def RecoverFromFault {
        subject compressor : Compressor;
        actor operator : Operator;
        objective { doc /* Acknowledge the fault and return to a stopped state before restarting. */ }
    }
    use case def MaintainEquipment {
        subject compressor : Compressor;
        actor technician : Technician;
        objective { doc /* Isolate, depressurize, inspect and service the compressor. */ }
    }
    use case operateWorkshop {
        subject compressor : Compressor;
        actor operator : Operator;
        actor technician : Technician;
        objective { doc /* Keep workshop tools supplied with air while protecting equipment and enabling maintenance. */ }
        include use case charge : ChargeTank {
            subject compressor;
            actor operator = operateWorkshop::operator;
        }
        include use case supply : SupplyAir {
            subject compressor;
            actor operator = operateWorkshop::operator;
        }
        include use case protect : ProtectEquipment {
            subject compressor;
            actor operator = operateWorkshop::operator;
        }
        include use case recover : RecoverFromFault {
            subject compressor;
            actor operator = operateWorkshop::operator;
        }
        include use case service : MaintainEquipment {
            subject compressor;
            actor technician = operateWorkshop::technician;
        }
    }
}
