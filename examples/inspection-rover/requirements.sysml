package RoverRequirements {
    private import ScalarValues::*;
    private import RoverComponents::*;
    requirement def <'RVR-001'> EnergyReserve {
        doc /* Keep at least 20 percent battery reserve for the return journey. */
        subject battery : Battery;
        require constraint { battery.reservePercent >= 20.0 }
    }
    requirement def <'RVR-002'> SafeSpeed {
        doc /* Each drive shall limit nominal indoor speed to 1.5 m/s. */
        subject drive : Drive;
        require constraint { drive.maximumSpeedMps <= 1.5 }
    }
    requirement def <'RVR-003'> ObstacleClearance {
        doc /* Stop at least 0.8 m before a detected obstacle. */
        subject controller : Controller;
        require constraint { controller.obstacleStopDistanceM >= 0.8 }
    }
    requirement def <'RVR-004'> InspectionQuality {
        doc /* Capture inspection images at a resolution of at least 12 MP. */
        subject camera : Camera;
        require constraint { camera.resolutionMP >= 12.0 }
    }
    requirement <'RVR-RESERVE'> reserve : EnergyReserve {
        doc /* Keep at least 20 percent battery reserve for the return journey. */
        subject battery = RoverSystem::rover.energy.battery;
    }
    requirement <'RVR-SPEED'> speed : SafeSpeed {
        doc /* Limit the left drive nominal indoor speed to 1.5 m/s. */
        subject drive = RoverSystem::rover.mobility.leftDrive;
    }
    requirement <'RVR-CLEAR'> clearance : ObstacleClearance {
        doc /* Stop at least 0.8 m before a detected obstacle. */
        subject controller = RoverSystem::rover.autonomy.controller;
    }
    requirement <'RVR-IMAGE'> imaging : InspectionQuality {
        doc /* Capture inspection images at a resolution of at least 12 MP. */
        subject camera = RoverSystem::rover.inspection.camera;
    }
    assert satisfy reserve by RoverSystem::rover.energy.battery;
    assert satisfy speed by RoverSystem::rover.mobility.leftDrive;
    assert satisfy clearance by RoverSystem::rover.autonomy.controller;
    assert satisfy imaging by RoverSystem::rover.inspection.camera;
}
