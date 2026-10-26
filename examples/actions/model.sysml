package Workflow {
    item def Sample;
    action def Inspect {
        in item sample : Sample;
        out item result : Sample;
    }
    action def Process {
        first start;
        action collect;
        action inspect : Inspect;
        action archive;
        done;
        succession first start then collect;
        succession first collect then inspect;
        succession first inspect then archive;
        succession first archive then done;
    }
}
