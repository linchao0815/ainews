import { CloseCode, type Client, type Room } from "@colyseus/core";

/** Seconds a dropped seat is held. RECONNECT_SECONDS env overrides (tests use 2). */
export function reconnectSeconds(env: NodeJS.ProcessEnv = process.env, fallback = 20): number {
  const v = Number(env.RECONNECT_SECONDS);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/**
 * Call from the room's own onDrop. Every non-consented close reaches onDrop (including a
 * client kicked by validate() with WITH_ERROR 4002 and a closed tab with 1001), so:
 * - 4002: no seat is held for a tampered client -> returns false; Colyseus then runs onLeave.
 * - otherwise: runs onHold (e.g. mark the player disconnected) and holds the seat for
 *   `seconds`; on timeout Colyseus runs onLeave. Returns true.
 */
export function holdSeatOnDrop(
  room: Room,
  client: Client,
  code: number | undefined,
  opts: { seconds: number; onHold?: () => void; log?: (line: string) => void; label?: string },
): boolean {
  const who = opts.label ?? client.sessionId;
  if (code === CloseCode.WITH_ERROR) {
    opts.log?.(`drop ${who} code=${code}: kicked, no reconnection`);
    return false;
  }
  opts.onHold?.();
  opts.log?.(`drop ${who} code=${code}: holding seat ${opts.seconds}s`);
  room.allowReconnection(client, opts.seconds);
  return true;
}
