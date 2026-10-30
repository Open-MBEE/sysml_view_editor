package CompressorSystem {
    private import ScalarValues::*;
    private import CompressorTypes::*;
    private import CompressorComponents::*;
    private import CompressorBehavior::*;
    part def Compressor :> CompressorInterface {
        doc /* Smart compressor: electrical control, air storage and cooling.
               These are authored connections and constraints, not a simulation. */
        part electrical : ElectricalAssembly;
        part pneumatic : PneumaticAssembly;
        part cooling : CoolingAssembly;
        part serviceConsole : ServiceConsole;
        connection pressureFeedback connect pneumatic.pressureSensor.reading
            to electrical.controller.pressure;
        connection temperatureSample connect pneumatic.pump.temperature
            to cooling.temperature.sample;
        connection temperatureFeedback connect cooling.temperature.reading
            to electrical.controller.temperature;
        connection fanControl connect electrical.controller.fanCommand to cooling.fan.command;
        connection maintenanceRequest connect serviceConsole.request to electrical.controller.service;
        connection faultAlarm connect electrical.controller.alarm to serviceConsole.alarm;
        constraint powerBudget {
            electrical.motor.ratedPower + cooling.fan.ratedPower <= electrical.supply.ratedPower
        }
        action startup : CompressAir;
        action service : ServiceCompressor;
        state operatingMode : OperatingMode;
    }
    part def ElectricalAssembly {
        part supply : PowerSupply;
        part controller : Controller;
        part motor : Motor;
        connection motorPower connect supply.supply to motor.power;
        connection motorControl connect controller.command to motor.command;
    }
    part def PneumaticAssembly {
        part pump : Pump;
        part tank : Tank;
        part regulator : CheckValve;
        part relief : ReliefValve;
        part pressureSensor : PressureSensor;
        connection chargingLine connect pump.outlet to tank.inlet;
        connection regulatedDelivery connect tank.delivery to regulator.inlet;
        connection pressureProtection connect tank.relief to relief.inlet;
        connection pressureSample connect tank.pressureReading to pressureSensor.sample;
    }
    part def Workshop {
        part compressor : Compressor;
        part spareCompressor : Compressor;
        part tool : AirTool;
        part blowGun : AirTool;
        part operator : Operator;
        part technician : Technician;
        connection deliveryLine connect compressor.pneumatic.regulator.outlet to tool.inlet;
        connection spareDelivery connect spareCompressor.pneumatic.regulator.outlet to blowGun.inlet;
    }
    part def WorkshopContext {
        doc /* A black-box system context. The two compressor roles share the
               interface specialized by the detailed Compressor definition. */
        part mains : PowerSupply;
        part compressor : CompressorInterface;
        part tool : AirTool;
        part serviceConsole : ServiceConsole;
        connection electricalSupply connect mains.supply to compressor.power;
        connection usableAir connect compressor.air to tool.inlet;
    }
    part workshop : Workshop;
}
