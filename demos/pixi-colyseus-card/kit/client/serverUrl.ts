/**
 * Game server endpoint, in priority order:
 * 1. `?server=` query (dev and tests)
 * 2. VITE_SERVER_URL, set at build time (Capacitor apps have no address bar)
 * 3. same host, port 2567
 */
export function resolveServerUrl(search = location.search): string {
  const fromQuery = new URLSearchParams(search).get("server");
  return fromQuery ?? import.meta.env.VITE_SERVER_URL ?? `ws://${location.hostname}:2567`;
}
