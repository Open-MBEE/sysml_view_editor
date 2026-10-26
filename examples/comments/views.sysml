package DocumentationViews {
    private import StandardViewDefinitions::*;
    view overview : GeneralView { expose CommentExample::*; }
    view maintenance : InterconnectionView { expose CommentExample::ServiceLoop; }
}
