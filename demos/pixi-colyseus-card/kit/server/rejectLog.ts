// Rate-limited REJECT logging, one instance per room.
// Same (player, reason) logs at most once per window; later lines report how many were
// suppressed. Stops a client from flooding the logs with cheat attempts (verified: a burst
// of 50 adds 1 line).

export interface RejectLogger {
  (sessionId: string, reason: string, line: string): void;
  /** Drop the counters of a player that left for good. */
  forget(sessionId: string): void;
}

export function createRejectLogger(log: (line: string) => void, windowMs = 5000): RejectLogger {
  const seen = new Map<string, { last: number; suppressed: number }>();
  const reject = ((sessionId: string, reason: string, line: string) => {
    const key = `${sessionId}:${reason}`;
    const now = Date.now();
    const entry = seen.get(key);
    if (entry && now - entry.last < windowMs) {
      entry.suppressed += 1;
      return;
    }
    const extra = entry?.suppressed ? ` (+${entry.suppressed} suppressed)` : "";
    seen.set(key, { last: now, suppressed: 0 });
    log(`REJECT ${line}${extra}`);
  }) as RejectLogger;
  reject.forget = (sessionId: string) => {
    for (const key of seen.keys()) if (key.startsWith(`${sessionId}:`)) seen.delete(key);
  };
  return reject;
}
