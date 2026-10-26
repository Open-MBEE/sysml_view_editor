package WorkshopViews {
    private import StandardViewDefinitions::*;
    view overview : GeneralView { expose Workshop::*; }
    view compressor : InterconnectionView { expose Workshop::Compressor; }
}
