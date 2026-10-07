import { defineServer, defineRoom } from "colyseus";
import { CardRoom } from "./CardRoom.ts";

const server = defineServer({
  rooms: {
    card: defineRoom(CardRoom),
  },
});

server.listen(2567);
console.log("[server] listening on ws://localhost:2567");
