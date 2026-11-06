package RoverBehavior {
    action def InspectRoute {
        doc /* Declared mission order; this diagram does not execute the rover. */
        first start;
        action checkBattery;
        action patrol;
        action detectObstacle;
        action captureInspection;
        action transmitReport;
        action returnToDock;
        action recharge;
        done;
        succession first start then checkBattery;
        succession first checkBattery then patrol;
        succession first patrol then detectObstacle;
        succession first detectObstacle then captureInspection;
        succession first captureInspection then transmitReport;
        succession first transmitReport then returnToDock;
        succession first returnToDock then recharge;
        succession first recharge then done;
        allocation perceptionResponsibility allocate detectObstacle to RoverSystem::rover.autonomy.controller;
        allocation imagingResponsibility allocate captureInspection to RoverSystem::rover.inspection.camera;
        allocation reportingResponsibility allocate transmitReport to RoverSystem::rover.inspection.radio;
        allocation tractionResponsibility allocate patrol to RoverSystem::rover.mobility.leftDrive;
    }
    state def OperatingMode {
        entry; then docked;
        state docked;
        state patrolling;
        state inspecting;
        state returning;
        state charging;
        state safeStop;
        transition dispatch first docked then patrolling;
        transition targetFound first patrolling then inspecting;
        transition inspectionComplete first inspecting then patrolling;
        transition lowReserve first patrolling then returning;
        transition dockReached first returning then charging;
        transition chargeComplete first charging then docked;
        transition obstacleDetected first patrolling then safeStop;
        transition pathClear first safeStop then patrolling;
    }
}
