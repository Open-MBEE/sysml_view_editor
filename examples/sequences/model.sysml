package SequenceExample {
    item def Request;
    item def Reply;
    occurrence def Exchange {
        part client {
            event occurrence sent;
            event occurrence received;
        }
        part server {
            event occurrence received;
            event occurrence sent;
        }
        message request of Request from client.sent to server.received;
        message reply of Reply from server.sent to client.received;
        succession first server.received then server.sent;
    }
}
