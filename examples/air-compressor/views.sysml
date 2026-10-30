package CompressorViews {
    private import StandardViewDefinitions::*;
    view def Structure :> InterconnectionView;
    view def Definitions :> GeneralView {
        filter @SysML::PartDefinition or @SysML::PartUsage;
    }
    view def Requirements :> GeneralView;
    view def Actions :> ActionFlowView;
    view def UseCases :> GeneralView;
    view def Sequence :> SequenceView;
    view def Geometry :> GeometryView;
    view def States :> StateTransitionView;
    view overview : Structure { expose CompressorSystem::WorkshopContext; }
    view structure : Structure { expose CompressorSystem::Compressor; }
    view installation : Structure { expose CompressorSystem::Workshop; }
    view pneumatics : Structure { expose CompressorSystem::PneumaticAssembly; }
    view definitions : Definitions { expose CompressorComponents::**; }
    view requirements : Requirements { expose CompressorRequirements::workshopSpecification; }
    view actions : Actions { expose CompressorBehavior::CompressAir; }
    view maintenance : Actions { expose CompressorBehavior::ServiceCompressor; }
    view useCases : UseCases {
        expose CompressorUseCases::operateWorkshop;
        render OpenSysMLRenderings::asCaseDiagram;
    }
    view states : States { expose CompressorBehavior::OperatingMode; }
    view startupSequence : Sequence { expose CompressorSequence::Startup; }
    view demandSequence : Sequence { expose CompressorSequence::ToolDemand; }
    view faultSequence : Sequence { expose CompressorSequence::OverheatShutdown; }
    view envelopeGeometry : Geometry { expose CompressorGeometry::enclosure; }
}
