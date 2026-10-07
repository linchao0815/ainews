import { defineServer, type RegisteredHandler } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";

/**
 * Starts the game server with every room passed in. PORT env overrides the port so tests
 * can run a second server (e.g. with a short reconnection window).
 * Uses @colyseus/core + ws-transport, not the `colyseus` meta package (whose @colyseus/auth
 * dependency chain brings npm audit findings this project does not need).
 */
export function startServer(rooms: Record<string, RegisteredHandler>, port = Number(process.env.PORT ?? 2567)) {
  const server = defineServer({ transport: new WebSocketTransport(), rooms });
  server.listen(port);
  console.log(`[server] listening on ws://localhost:${port} rooms=${Object.keys(rooms).join(",")}`);
  return server;
}
