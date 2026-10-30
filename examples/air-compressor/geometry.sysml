package CompressorGeometry {
    doc /* Envelope dimensions and placement. The preview centers the Box on its coordinate-frame origin. */
    attribute workshopDatum : ISQ::CartesianSpatial3dCoordinateFrame {
        :>> mRefs = (SI::m, SI::m, SI::m);
    }
    item enclosure : ShapeItems::Box {
        :>> length = 120 [SI::cm];
        :>> width = 80 [SI::cm];
        :>> height = 90 [SI::cm];
        attribute coordinateFrame : ISQ::CartesianSpatial3dCoordinateFrame {
            :>> mRefs = (SI::m, SI::m, SI::m);
            :>> transformation : MeasurementReferences::CoordinateFramePlacement {
                :>> source = workshopDatum;
                :>> origin = (1.5, 0.0, 0.45) [workshopDatum];
                :>> basisDirections = ((0.0, 1.0, 0.0) [workshopDatum],
                                      (-1.0, 0.0, 0.0) [workshopDatum],
                                      (0.0, 0.0, 1.0) [workshopDatum]);
            }
        }
    }
}
