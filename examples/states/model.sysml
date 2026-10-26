package Lifecycle {
    state def StationStates {
        entry; then idle;
        state idle;
        state active {
            entry; then processing;
            state processing;
        }
        transition startWork first idle then active;
        transition finishWork first active then idle;
    }
}
