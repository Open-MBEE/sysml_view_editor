package CompressorRequirements {
    private import ScalarValues::*;
    private import CompressorComponents::*;
    private import CompressorSystem::*;
    requirement def <'COMP-001'> SafePressure {
        doc /* Tank pressure shall not exceed 800000 Pa. */
        subject tank : Tank;
        attribute maximum : Real default = 800000.0;
        require constraint pressureBound { tank.pressure <= maximum }
    }
    requirement def <'COMP-002'> StorageCapacity {
        doc /* The tank shall provide at least 0.05 cubic metres of storage. */
        subject tank : Tank;
        attribute minimum : Real default = 0.05;
        require constraint capacityBound { tank.volume >= minimum }
    }
    requirement def <'COMP-003'> ThermalLimit {
        doc /* Normal operation shall remain below 353.15 K (80 degrees Celsius). */
        subject sensor : TemperatureSensor;
        attribute maximum : Real default = 353.15;
        require constraint thermalBound { sensor.temperature <= maximum }
    }
    requirement def <'COMP-004'> SafeShutdown {
        doc /* The controller shall stop the motor within 1 s of detecting a fault. */
        subject controller : Controller;
        attribute maximum : Real default = 1.0;
        require constraint shutdownBound { controller.shutdownDuration <= maximum }
    }
    requirement def <'COMP-005'> DeliveryPressure {
        doc /* The regulated delivery setting shall be at least 600000 Pa. */
        subject regulator : CheckValve;
        attribute minimum : Real default = 600000.0;
        require constraint deliveryBound { regulator.deliveryPressure >= minimum }
    }
    requirement def <'COMP-006'> PressureProtection {
        doc /* The mechanical relief valve shall open at or below 800000 Pa. */
        subject valve : ReliefValve;
        attribute maximum : Real default = 800000.0;
        require constraint reliefBound { valve.openingPressure <= maximum }
    }
    requirement workshopSpecification {
        doc /* Bounds and declared trace links. Satisfaction assertions and
               verification cases are model declarations, not test evidence. */
        subject compressor : Compressor;
        requirement pressure : SafePressure { subject tank = compressor.pneumatic.tank; }
        requirement capacity : StorageCapacity { subject tank = compressor.pneumatic.tank; }
        requirement temperature : ThermalLimit { subject sensor = compressor.cooling.temperature; }
        requirement shutdown : SafeShutdown { subject controller = compressor.electrical.controller; }
        requirement delivery : DeliveryPressure { subject regulator = compressor.pneumatic.regulator; }
        requirement relief : PressureProtection { subject valve = compressor.pneumatic.relief; }
    }
    assert satisfy workshopSpecification.pressure by CompressorSystem::workshop.compressor.pneumatic.tank;
    assert satisfy workshopSpecification.capacity by CompressorSystem::workshop.compressor.pneumatic.tank;
    assert satisfy workshopSpecification.temperature by CompressorSystem::workshop.compressor.cooling.temperature;
    assert satisfy workshopSpecification.shutdown by CompressorSystem::workshop.compressor.electrical.controller;
    assert satisfy workshopSpecification.delivery by CompressorSystem::workshop.compressor.pneumatic.regulator;
    assert satisfy workshopSpecification.relief by CompressorSystem::workshop.compressor.pneumatic.relief;
    verification def CheckPressure {
        subject compressor : Compressor;
        objective pressureCheck { verify workshopSpecification.pressure; }
    }
    verification def CheckShutdown {
        subject compressor : Compressor;
        objective shutdownCheck { verify workshopSpecification.shutdown; }
    }
    verification pressureTest : CheckPressure { subject compressor = CompressorSystem::workshop.compressor; }
    verification shutdownTest : CheckShutdown { subject compressor = CompressorSystem::workshop.compressor; }
}
