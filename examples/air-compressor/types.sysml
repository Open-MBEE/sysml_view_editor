package CompressorTypes {
    doc /* Showcase quantities use documented SI units: pressure in Pa,
           volume in cubic metres, power in W, time in seconds, and temperature in kelvin. */
    item def Air;
    item def ElectricalPower;
    item def PressureReading;
    item def MotorCommand;
    item def TemperatureReading;
    item def Alarm;
    port def AirOutlet { out item air : Air; }
    port def PowerOutlet { out item electricity : ElectricalPower; }
    port def PressureOutlet { out item reading : PressureReading; }
    port def TemperatureOutlet { out item reading : TemperatureReading; }
    port def AlarmOutlet { out item alarm : Alarm; }
    port def CommandOutlet { out item command : MotorCommand; }
}
