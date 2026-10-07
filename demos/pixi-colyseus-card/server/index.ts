import { defineServer, defineRoom } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { CardRoom } from "./CardRoom.ts";

const server = defineServer({
  transport: new WebSocketTransport(),
  rooms: {
    card: defineRoom(CardRoom),
  },
});

server.listen(2567);
console.log("[server] listening on ws://localhost:2567");
