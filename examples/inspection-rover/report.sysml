package RoverReport {
    private import DocumentQueries::*;
    private import KerML::Root::Element;
    private import ScalarValues::*;
    private import RoverSystem::*;

    calc def Subparts :> Query {
        in root : Element;
        Project(
            source = OrderBy(
                source = WhereType(
                    source = Descendants(source = root, maxDepth = 1),
                    type = "PartUsage",
                    exact = true
                ),
                property = "name",
                direction = "ascending",
                missing = "last",
                multiple = "error"
            ),
            properties = ("name", "type")
        )
    }

    calc def DeclaredRequirements :> Query {
        in scope : String;
        Project(
            source = WhereType(
                source = Descendants(
                    source = Named(qualifiedName = scope),
                    maxDepth = 1
                ),
                type = "RequirementUsage",
                exact = true
            ),
            properties = ("name", "documentation")
        )
    }

    part def InspectionReport :> Document {
        attribute redefines title = "Inspection Rover Report";

        part intro : Paragraph {
            part lead : Span {
                :>> text = "This report is generated from the applied model of";
            }
            part roverRef : Ref {
                ref redefines target = RoverSystem::rover;
            }
            part tail : Span {
                :>> text = "and lists each subsystem's parts, the declared requirements and the architecture view.";
            }
        }

        part energy : Section {
            attribute redefines title = "Energy";
            part summary : Paragraph {
                :>> text = "A 480 Wh battery feeds a distribution unit with drive, compute and payload outlets.";
            }
            part parts : Table {
                attribute redefines caption = "Energy parts";
                calc rows : Subparts {
                    in root = rover.energy;
                }
            }
        }

        part mobility : Section {
            attribute redefines title = "Mobility";
            part summary : Paragraph {
                :>> text = "Two drive usages share one Drive definition and remain distinct parts.";
            }
            part parts : Table {
                attribute redefines caption = "Mobility parts";
                calc rows : Subparts {
                    in root = rover.mobility;
                }
            }
        }

        part autonomy : Section {
            attribute redefines title = "Autonomy";
            part summary : Paragraph {
                :>> text = "Lidar feeds obstacle perception; the controller commands both drives.";
            }
            part parts : Table {
                attribute redefines caption = "Autonomy parts";
                calc rows : Subparts {
                    in root = rover.autonomy;
                }
            }
        }

        part inspection : Section {
            attribute redefines title = "Inspection";
            part summary : Paragraph {
                :>> text = "The camera returns images to the controller and the radio carries mission telemetry.";
            }
            part parts : Table {
                attribute redefines caption = "Inspection parts";
                calc rows : Subparts {
                    in root = rover.inspection;
                }
            }
        }

        part requirements : Section {
            attribute redefines title = "Requirements";
            part note : Paragraph {
                :>> text = "Declared quantitative bounds. Satisfaction assertions are modeled claims, not verification results.";
            }
            part table : Table {
                attribute redefines caption = "Declared requirement usages";
                calc rows : DeclaredRequirements {
                    in scope = "RoverRequirements";
                }
            }
        }

        part architecture : Section {
            attribute redefines title = "Architecture";
            part diagram : Diagram {
                attribute redefines caption = "Rover interconnection, from the architecture view";
                ref redefines source = RoverViews::architecture;
            }
        }
    }
}
