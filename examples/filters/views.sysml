package SelectionViews {
    private import StandardViewDefinitions::*;
    view reviewed : GeneralView {
        filter @Review;
        expose Selection::**;
    }
    view empty : GeneralView {
        filter false;
        expose Selection::**;
    }
}
