package RoverComponents {
    private import ScalarValues::*;
    private import RoverTypes::*;
    part def Battery {
        doc /* Rechargeable battery. Capacity and reserve are design targets. */
        attribute capacityWh : Real default = 480.0;
        attribute reservePercent : Real default = 20.0;
        out port supply : PowerPort;
    }
    part def Distribution {
        in port input : PowerPort;
        out port drive : PowerPort;
        out port compute : PowerPort;
        out port payload : PowerPort;
    }
    part def Actuator;
    part def Sensor;
    part def Drive :> Actuator {
        attribute maximumSpeedMps : Real default = 1.5;
        in port power : PowerPort;
        in port command : CommandPort;
    }
    part def Controller {
        attribute obstacleStopDistanceM : Real default = 0.8;
        in port power : PowerPort;
        in port perception : SensorPort;
        in port images : ImagePort;
        out port drive : CommandPort;
        out port status : TelemetryPort;
    }
    part def Lidar :> Sensor {
        attribute rangeM : Real default = 12.0;
        out port scan : SensorPort;
    }
    part def Camera :> Sensor {
        attribute resolutionMP : Real default = 12.0;
        in port power : PowerPort;
        out port image : ImagePort;
    }
    part def Radio {
        attribute rangeM : Real default = 300.0;
        in port telemetry : TelemetryPort;
    }
}
