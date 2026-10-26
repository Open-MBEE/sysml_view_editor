package CommentExample {
    // A lexical comment: useful in source, not a diagram annotation.
    part def Pump {
        doc /* Moves coolant through the service loop — température ≤ 80 °C. */
    }
    /* This block comment must survive every import and export. */
    part def ServiceLoop {
        doc /* Keep access to the pump clear for maintenance. */
        part pump : Pump;
    }
    comment about Pump /* Inspect the access panel before replacing the pump. */
}
