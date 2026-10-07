import { Room, type Client } from "colyseus";
import { schema, t, StateView, type SchemaType } from "@colyseus/schema";

// Public fields go to everyone; `card` is private (.view()) and only reaches
// clients whose StateView contains this player instance (= the owner).
export const Player = schema({
  name: t.string(),
  seat: t.number(),
  score: t.number(),
  ready: t.boolean(),
  shownCard: t.number(),       // 0 until reveal, then copied from `card`
  card: t.number().view(),     // private hand
}, "Player");
type PlayerT = SchemaType<typeof Player>;

export const CardState = schema({
  phase: t.string(),           // waiting | dealt | revealed
  round: t.number(),
  winner: t.string(),          // sessionId of round winner, "draw", or ""
  players: t.map(Player),
}, "CardState");

const log = (...a: unknown[]) => console.log("[server]", ...a);

export class CardRoom extends Room {
  maxClients = 2;
  state = new CardState();

  // Declarative message map: the primary 0.18 API (see .claude/skills/colyseus/SKILL.md).
  messages = {
    ready: (client: Client) => {
      const p = this.state.players.get(client.sessionId) as PlayerT | undefined;
      if (!p) return;
      if (this.state.phase !== "dealt") {
        log(`REJECT ready from ${p.name}: phase=${this.state.phase}`);
        return;
      }
      if (p.ready) {
        log(`REJECT duplicate ready from ${p.name}`);
        return;
      }
      p.ready = true;
      log(`ready ${p.name} (round ${this.state.round})`);
      if ([...this.state.players.values()].every((x: PlayerT) => x.ready)) this.reveal();
    },
    // Cheat attempts: the client never decides outcomes or cards.
    claim_win: (client: Client) => {
      log(`REJECT claim_win from ${this.nameOf(client)}: outcome is server-authoritative`);
    },
    set_card: (client: Client, value: unknown) => {
      log(`REJECT set_card(${JSON.stringify(value)}) from ${this.nameOf(client)}: cards are dealt by server`);
    },
  };

  onCreate() {
    this.state.phase = "waiting";
    this.state.round = 0;
    this.state.winner = "";
  }

  onJoin(client: Client, options: { name?: string }) {
    const p = new Player();
    p.name = options?.name ?? client.sessionId;
    p.seat = this.state.players.size;
    p.score = 0;
    p.ready = false;
    p.shownCard = 0;
    p.card = 0;
    this.state.players.set(client.sessionId, p);
    client.view = new StateView();
    client.view.add(p);
    log(`join ${p.name} sid=${client.sessionId}`);
    if (this.state.players.size === 2) this.deal();
  }

  onLeave(client: Client) {
    log(`leave ${this.nameOf(client)}`);
    this.state.players.delete(client.sessionId);
    this.state.phase = "waiting";
  }

  private deal() {
    this.state.round += 1;
    this.state.phase = "dealt";
    this.state.winner = "";
    const deck = Array.from({ length: 13 }, (_, i) => i + 1);
    for (const p of this.state.players.values() as Iterable<PlayerT>) {
      const idx = Math.floor(Math.random() * deck.length);
      p.card = deck.splice(idx, 1)[0];
      p.ready = false;
      p.shownCard = 0;
    }
    log(`deal round ${this.state.round}: ` +
      [...this.state.players.values()].map((p: PlayerT) => `${p.name}=${p.card}`).join(" "));
  }

  private reveal() {
    const entries = [...this.state.players.entries()] as [string, PlayerT][];
    for (const [, p] of entries) p.shownCard = p.card;
    const [[sidA, a], [sidB, b]] = entries;
    const winner = a.card === b.card ? "draw" : a.card > b.card ? sidA : sidB;
    if (winner !== "draw") (this.state.players.get(winner) as PlayerT).score += 1;
    this.state.winner = winner;
    this.state.phase = "revealed";
    log(`reveal round ${this.state.round}: winner=${winner === "draw" ? "draw" : this.state.players.get(winner)?.name}`);
    this.clock.setTimeout(() => this.deal(), 1500);
  }

  private nameOf(client: Client) {
    return (this.state.players.get(client.sessionId) as PlayerT | undefined)?.name ?? client.sessionId;
  }
}
