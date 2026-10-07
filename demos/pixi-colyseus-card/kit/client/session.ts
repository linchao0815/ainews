import { CloseCode, type Client, type Room } from "@colyseus/sdk";

/**
 * Join a room, or resume the seat this tab held before a reload / reopened tab.
 *
 * - The reconnection token is kept in sessionStorage under `${gameId}:reconnectionToken`:
 *   per tab (two tabs of one browser never take each other's seat) and per game (several
 *   games on one origin never try each other's token).
 * - @colyseus/sdk 0.18.5 fires onReconnect *before* it assigns the new reconnectionToken,
 *   and the server rotates the token on every (re)join, so the token is saved after the
 *   current task (queueMicrotask) and again on pagehide.
 * - The token is cleared when there is no seat left to resume (consented leave, kicked,
 *   reconnection failed) or when resuming fails.
 */
export async function joinOrResume(
  client: Client,
  opts: { gameId: string; roomName: string; joinOptions?: Record<string, unknown> },
): Promise<{ room: Room; resumed: boolean }> {
  const key = `${opts.gameId}:reconnectionToken`;
  const storage = {
    get: () => { try { return sessionStorage.getItem(key); } catch { return null; } },
    set: (v: string) => { try { sessionStorage.setItem(key, v); } catch { /* private mode etc. */ } },
    clear: () => { try { sessionStorage.removeItem(key); } catch { /* ignore */ } },
  };

  let room: Room;
  let resumed = false;
  const saved = storage.get();
  try {
    if (!saved) throw new Error("no saved seat");
    room = await client.reconnect(saved);
    resumed = true;
  } catch {
    storage.clear(); // expired or never existed: start a fresh seat
    room = await client.joinOrCreate(opts.roomName, opts.joinOptions ?? {});
  }

  storage.set(room.reconnectionToken);
  room.onReconnect(() => queueMicrotask(() => storage.set(room.reconnectionToken)));
  window.addEventListener("pagehide", () => storage.set(room.reconnectionToken));
  room.onLeave((code: number) => {
    if (code === CloseCode.CONSENTED || code === CloseCode.WITH_ERROR || code === CloseCode.FAILED_TO_RECONNECT) storage.clear();
  });
  return { room, resumed };
}
