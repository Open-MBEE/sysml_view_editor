package AssemblyViews {
    private import StandardViewDefinitions::*;
    view structure : InterconnectionView { expose Assembly::Station; }
    view devices : InterconnectionView {
        expose Assembly::Station::bay;
        expose Assembly::Inspect;
    }
}
