package Workshop {
    // A shared definition used twice; renaming one usage must preserve the other.
    part def Motor;
    part def Compressor {
        part primary : Motor;
        part standby : Motor;
    }
}
