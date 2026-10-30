package CompressorBehavior {
    private import CompressorTypes::*;
    private import CompressorComponents::*;
    action def SensePressure { out item reading : PressureReading; }
    action def SenseTemperature { out item reading : TemperatureReading; }
    action def ControlMotor {
        in item reading : PressureReading;
        in item temperature : TemperatureReading;
        out item command : MotorCommand;
    }
    action def GenerateTorque { in item command : MotorCommand; }
    action def PumpAir { in item inlet : Air; out item outlet : Air; }
    action def CoolAir { in item inlet : Air; out item outlet : Air; }
    action def StoreAir { in item inlet : Air; out item outlet : Air; }
    action def DeliverAir { in item inlet : Air; }
    action def CompressAir {
        doc /* Normal supply scenario. Successions state order; item flows state
               transfers. Allocations are declared responsibilities, not execution. */
        ref part controller : Controller;
        ref part motor : Motor;
        ref part pumpUnit : Pump;
        ref part cooler : CoolingAssembly;
        ref part tank : Tank;
        ref part regulator : CheckValve;
        action sense : SensePressure;
        action temperature : SenseTemperature;
        action control : ControlMotor;
        action torque : GenerateTorque;
        action pump : PumpAir;
        action cool : CoolAir;
        action store : StoreAir;
        action deliver : DeliverAir;
        allocation sensing allocate sense to controller;
        allocation thermalSensing allocate temperature to controller;
        allocation regulation allocate control to controller;
        allocation turning allocate torque to motor;
        allocation compression allocate pump to pumpUnit;
        allocation cooling allocate cool to cooler;
        allocation storage allocate store to tank;
        allocation delivery allocate deliver to regulator;
        first start then sense;
        first sense then temperature;
        first temperature then control;
        first control then torque;
        first torque then pump;
        first pump then cool;
        first cool then store;
        first store then deliver;
        first deliver then done;
        flow from sense.reading to control.reading;
        flow from temperature.reading to control.temperature;
        flow from control.command to torque.command;
        flow from pump.outlet to cool.inlet;
        flow from cool.outlet to store.inlet;
        flow from store.outlet to deliver.inlet;
    }
    action def IsolatePower;
    action def ReleasePressure;
    action def InspectEquipment;
    action def ReplaceFilter;
    action def RestoreService;
    action def ServiceCompressor {
        doc /* Maintenance follows isolation and depressurization. No completion
               or safety verification result is claimed by this activity. */
        ref part technician : Technician;
        ref part controller : Controller;
        ref part relief : ReliefValve;
        action isolate : IsolatePower;
        action depressurize : ReleasePressure;
        action inspect : InspectEquipment;
        action replaceFilter : ReplaceFilter;
        action restore : RestoreService;
        allocation isolation allocate isolate to controller;
        allocation venting allocate depressurize to relief;
        allocation inspection allocate inspect to technician;
        allocation replacement allocate replaceFilter to technician;
        allocation restoration allocate restore to controller;
        first start then isolate;
        first isolate then depressurize;
        first depressurize then inspect;
        first inspect then replaceFilter;
        first replaceFilter then restore;
        first restore then done;
    }
    item def StartRequest;
    item def StartupChecked;
    item def TankCharged;
    item def ToolDemand;
    item def PressureLow;
    item def TemperatureHigh;
    item def TemperatureNormal;
    item def FaultDetected;
    item def ResetRequested;
    item def StopRequest;
    item def ServiceRequested;
    item def ServiceComplete;
    state def OperatingMode {
        entry; then stopped;
        state stopped;
        state starting;
        state charging;
        state ready;
        state supplying;
        state cooling;
        state fault;
        state maintenance;
        transition startCharging first stopped accept StartRequest then starting;
        transition startupComplete first starting accept StartupChecked then charging;
        transition chargingComplete first charging accept TankCharged then ready;
        transition supply first ready accept ToolDemand then supplying;
        transition recharge first supplying accept PressureLow then charging;
        transition coolDown first charging accept TemperatureHigh then cooling;
        transition cooled first cooling accept TemperatureNormal then ready;
        transition detectFault first charging accept FaultDetected then fault;
        transition coolingFault first cooling accept FaultDetected then fault;
        transition reset first fault accept ResetRequested then stopped;
        transition stop first ready accept StopRequest then stopped;
        transition stopSupply first supplying accept StopRequest then stopped;
        transition beginService first stopped accept ServiceRequested then maintenance;
        transition endService first maintenance accept ServiceComplete then stopped;
    }
}
