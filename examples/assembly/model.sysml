package Assembly {
    port def Signal;
    part def Device {
        in port input : Signal;
        out port output : Signal;
        inout port service : Signal;
    }
    // Outside the supported graphical authoring subset; retain in source.
    action def Inspect;
    part def Station {
        part bay {
            part primary : Device;
            part standby : Device;
            connection handoff connect primary.output to standby.input;
        }
        ref part monitor : Device;
    }
}
