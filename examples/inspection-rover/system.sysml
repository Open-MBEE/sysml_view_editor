package RoverSystem {
    private import RoverComponents::*;
    part def InspectionRover {
        doc /* A slow indoor inspection rover. Explore architecture, mission,
               operating states and declared requirement traceability. */
        part energy {
            part battery : Battery;
            part distribution : Distribution;
            connection batterySupply connect battery.supply to distribution.input;
        }
        part mobility {
            part leftDrive : Drive;
            part rightDrive : Drive;
        }
        part autonomy {
            part controller : Controller;
            part lidar : Lidar;
            connection obstacleScan connect lidar.scan to controller.perception;
        }
        part inspection {
            part camera : Camera;
            part radio : Radio;
        }
        connection leftPower connect energy.distribution.drive to mobility.leftDrive.power;
        connection rightPower connect energy.distribution.drive to mobility.rightDrive.power;
        connection computePower connect energy.distribution.compute to autonomy.controller.power;
        connection cameraPower connect energy.distribution.payload to inspection.camera.power;
        connection leftCommand connect autonomy.controller.drive to mobility.leftDrive.command;
        connection rightCommand connect autonomy.controller.drive to mobility.rightDrive.command;
        connection inspectionImages connect inspection.camera.image to autonomy.controller.images;
        connection missionTelemetry connect autonomy.controller.status to inspection.radio.telemetry;
    }
    part rover : InspectionRover;
}
