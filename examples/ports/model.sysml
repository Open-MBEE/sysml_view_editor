package PortExample {
    port def Command {
        out value : ScalarValues::Real;
    }
    part def Sender {
        port command : Command;
    }
    part def Receiver {
        port command : ~Command;
    }
    part def Link {
        part sender : Sender;
        part receiver : Receiver;
        interface commandLink connect sender.command to receiver.command;
    }
}
