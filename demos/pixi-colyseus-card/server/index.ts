import { defineServer, defineRoom } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { CardRoom } from "./CardRoom.ts";

// PORT is overridable so tests can run a second server (e.g. with a short reconnection window).
const PORT = Number(process.env.PORT ?? 2567);

const server = defineServer({
  transport: new WebSocketTransport(),
  rooms: {
    card: defineRoom(CardRoom),
  },
});

server.listen(PORT);
console.log(`[server] listening on ws://localhost:${PORT}`);
