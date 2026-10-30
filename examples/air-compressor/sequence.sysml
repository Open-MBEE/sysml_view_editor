package CompressorSequence {
    item def AirDelivery;
    item def AirDemand;
    item def FaultNotice;
    item def PowerCommand;
    item def PressureReading;
    item def ReadyNotice;
    item def ResetCommand;
    item def SensorQuery;
    item def StartCommand;
    item def StopCommand;
    item def TemperatureReading;

    occurrence def Startup {
        part operator {
            event occurrence startSent;
            then event occurrence readyReceived;
        }
        part controller {
            event occurrence startReceived;
            then event occurrence checkSent;
            then event occurrence temperatureReceived;
            then event occurrence energizeSent;
            then event occurrence feedbackReceived;
            then event occurrence readySent;
        }
        part sensor {
            event occurrence checkReceived;
            then event occurrence temperatureSent;
        }
        part motor {
            event occurrence energizeReceived;
            then event occurrence driveSent;
        }
        part pump {
            event occurrence driveReceived;
            then event occurrence feedbackSent;
        }
        message start of StartCommand from operator.startSent to controller.startReceived;
        message check of SensorQuery from controller.checkSent to sensor.checkReceived;
        message temperature of TemperatureReading from sensor.temperatureSent to controller.temperatureReceived;
        message energize of PowerCommand from controller.energizeSent to motor.energizeReceived;
        message drive of PowerCommand from motor.driveSent to pump.driveReceived;
        message feedback of PressureReading from pump.feedbackSent to controller.feedbackReceived;
        message ready of ReadyNotice from controller.readySent to operator.readyReceived;
    }

    occurrence def ToolDemand {
        part tool {
            event occurrence requestSent;
            then event occurrence deliverReceived;
        }
        part tank {
            event occurrence requestReceived;
            then event occurrence deliverSent;
            then event occurrence pressureSent;
            then event occurrence refillReceived;
        }
        part controller {
            event occurrence pressureReceived;
            then event occurrence rechargeSent;
        }
        part motor {
            event occurrence rechargeReceived;
            then event occurrence driveSent;
        }
        part pump {
            event occurrence driveReceived;
            then event occurrence refillSent;
        }
        message request of AirDemand from tool.requestSent to tank.requestReceived;
        message deliver of AirDelivery from tank.deliverSent to tool.deliverReceived;
        message pressure of PressureReading from tank.pressureSent to controller.pressureReceived;
        message recharge of PowerCommand from controller.rechargeSent to motor.rechargeReceived;
        message drive of PowerCommand from motor.driveSent to pump.driveReceived;
        message refill of AirDelivery from pump.refillSent to tank.refillReceived;
    }

    occurrence def OverheatShutdown {
        part sensor {
            event occurrence overheatSent;
        }
        part controller {
            event occurrence overheatReceived;
            then event occurrence stopMotorSent;
            then event occurrence coolSent;
            then event occurrence alarmSent;
            then event occurrence acknowledgeReceived;
            then event occurrence resetSent;
        }
        part motor {
            event occurrence stopMotorReceived;
            then event occurrence resetReceived;
        }
        part fan {
            event occurrence coolReceived;
        }
        part operator {
            event occurrence alarmReceived;
            then event occurrence acknowledgeSent;
        }
        message overheat of TemperatureReading from sensor.overheatSent to controller.overheatReceived;
        message stopMotor of StopCommand from controller.stopMotorSent to motor.stopMotorReceived;
        message cool of PowerCommand from controller.coolSent to fan.coolReceived;
        message alarm of FaultNotice from controller.alarmSent to operator.alarmReceived;
        message acknowledge of ResetCommand from operator.acknowledgeSent to controller.acknowledgeReceived;
        message reset of StopCommand from controller.resetSent to motor.resetReceived;
    }
}
