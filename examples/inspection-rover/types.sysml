package RoverTypes {
    item def ElectricalPower;
    item def DriveCommand;
    item def SensorFrame;
    item def InspectionImage;
    item def Telemetry;
    port def PowerPort { out item power : ElectricalPower; }
    port def CommandPort { out item command : DriveCommand; }
    port def SensorPort { out item scanData : SensorFrame; }
    port def ImagePort { out item image : InspectionImage; }
    port def TelemetryPort { out item report : Telemetry; }
}
