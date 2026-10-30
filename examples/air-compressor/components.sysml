package CompressorComponents {
    private import ScalarValues::*;
    private import CompressorTypes::*;
    part def PowerSupply {
        attribute ratedPower : Real default = 2200.0;
        out port supply : PowerOutlet;
    }
    part def Controller {
        attribute shutdownDuration : Real default = 0.25;
        in port pressure : ~PressureOutlet;
        in port temperature : ~TemperatureOutlet;
        in port service : ~CommandOutlet;
        out port command : CommandOutlet;
        out port fanCommand : CommandOutlet;
        out port alarm : AlarmOutlet;
    }
    part def Motor {
        attribute ratedPower : Real default = 1500.0;
        in port power : ~PowerOutlet;
        in port command : ~CommandOutlet;
    }
    part def Pump {
        in port inlet : ~AirOutlet;
        out port outlet : AirOutlet;
        out port temperature : TemperatureOutlet;
    }
    part def Tank {
        attribute volume : Real default = 0.05;
        attribute pressure : Real default = 0.0;
        in port inlet : ~AirOutlet;
        out port delivery : AirOutlet;
        out port relief : AirOutlet;
        out port pressureReading : PressureOutlet;
    }
    part def Sensor {
        attribute accuracy : Real default = 0.01;
    }
    part def PressureSensor :> Sensor {
        in port sample : ~PressureOutlet;
        out port reading : PressureOutlet;
    }
    part def TemperatureSensor :> Sensor {
        attribute temperature : Real default = 293.15;
        in port sample : ~TemperatureOutlet;
        out port reading : TemperatureOutlet;
    }
    part def Valve {
        in port inlet : ~AirOutlet;
        out port outlet : AirOutlet;
    }
    part def CheckValve :> Valve {
        attribute deliveryPressure : Real default = 600000.0;
    }
    part def ReliefValve :> Valve {
        attribute openingPressure : Real default = 800000.0;
    }
    part def CoolingFan {
        attribute ratedPower : Real default = 120.0;
        in port command : ~CommandOutlet;
    }
    part def CoolingAssembly {
        part fan : CoolingFan;
        part temperature : TemperatureSensor;
    }
    part def ServiceConsole {
        out port request : CommandOutlet;
        in port alarm : ~AlarmOutlet;
    }
    part def CompressorInterface {
        doc /* Black-box interface used in the workshop context.
               Compressor specializes this definition with internal assemblies. */
        in port power : ~PowerOutlet;
        out port air : AirOutlet;
    }
    part def Operator;
    part def Technician;
    part def AirTool { in port inlet : ~AirOutlet; }
}
