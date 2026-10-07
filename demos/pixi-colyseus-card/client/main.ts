// Must be imported before creating the Application so layout mixins apply.
import "@pixi/layout";
import { Application, Assets, Container, Graphics, Text } from "pixi.js";
import { FancyButton } from "@pixi/ui";
import { sound } from "@pixi/sound";
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { gsap } from "gsap";
import { setup, createActor } from "xstate";
import { Client, Callbacks } from "@colyseus/sdk";

const params = new URLSearchParams(location.search);
const NAME = params.get("name") ?? "玩家";
const SERVER = params.get("server") ?? `ws://${location.hostname}:2567`;

const errors: string[] = [];
const transitions: string[] = [];
let flipCount = 0;
let soundPlays = 0;

// ---------- game flow (client-side view state; the server stays authoritative) ----------
const tableMachine = setup({}).createMachine({
  id: "table",
  initial: "connecting",
  states: {
    connecting: { on: { JOINED: "waiting" } },
    waiting: { on: { DEALT: "myChoice" } },
    myChoice: { on: { READY_SENT: "waitingOpponent", REVEALED: "revealed", OPP_LEFT: "waiting" } },
    waitingOpponent: { on: { REVEALED: "revealed", OPP_LEFT: "waiting" } },
    revealed: { on: { DEALT: "myChoice", OPP_LEFT: "waiting" } },
  },
});
const actor = createActor(tableMachine);
// Record only real transitions (xstate also notifies when an event is ignored).
actor.subscribe((s) => { const v = String(s.value); if (transitions.at(-1) !== v) transitions.push(v); });
actor.start();

// ---------- card view ----------
class CardView extends Container {
  private bg = new Graphics();
  private label = new Text({ text: "", style: { fill: 0x1b1b1b, fontSize: 56, fontWeight: "bold" } });
  private faceUp = false;
  private value = 0;

  constructor(private caption: string) {
    super({ layout: { width: 140, height: 200 } });
    this.addChild(this.bg, this.label);
    this.pivot.set(70, 100);
    this.draw();
  }

  private draw() {
    this.bg.clear().roundRect(0, 0, 140, 200, 14)
      .fill(this.faceUp ? 0xfaf7ee : 0x8b1e2d)
      .stroke({ width: 4, color: 0xffd479 });
    this.label.text = this.faceUp ? rankName(this.value) : "?";
    this.label.style.fill = this.faceUp ? 0x1b1b1b : 0xffd479;
    this.label.anchor.set(0.5);
    this.label.position.set(70, 100);
  }

  show(value: number, faceUp: boolean) {
    if (value === this.value && faceUp === this.faceUp) return;
    flipCount++;
    // GSAP flip: squash to 0 width, swap face, expand back.
    gsap.timeline()
      .to(this.scale, { x: 0, duration: 0.15, ease: "power1.in" })
      .call(() => { this.value = value; this.faceUp = faceUp; this.draw(); })
      .to(this.scale, { x: 1, duration: 0.15, ease: "power1.out" });
  }

  get debug() { return { caption: this.caption, value: this.value, faceUp: this.faceUp }; }
}

function rankName(v: number) {
  return ({ 1: "A", 11: "J", 12: "Q", 13: "K" } as Record<number, string>)[v] ?? String(v);
}

(async () => {
  const app = new Application();
  await app.init({ background: "#12324a", width: 720, height: 640, antialias: true });
  document.body.appendChild(app.canvas);

  // ---------- assets: Spine skeleton + sound ----------
  Assets.add({ alias: "boyData", src: "/assets/spine/spineboy-pro.skel" });
  Assets.add({ alias: "boyAtlas", src: "/assets/spine/spineboy.atlas" });
  await Assets.load(["boyData", "boyAtlas"]);
  sound.add("reveal", "/assets/reveal.wav");

  // ---------- layout ----------
  app.stage.layout = {
    width: 720, height: 640, flexDirection: "column",
    alignItems: "center", justifyContent: "flex-start", gap: 18, paddingTop: 20,
  };
  const title = new Text({ text: `PixiJS + Colyseus 比大小 — ${NAME}`, style: { fill: 0xffffff, fontSize: 26 }, layout: true });
  const status = new Text({ text: "連線中…", style: { fill: 0xffd479, fontSize: 22 }, layout: true });
  const scoreText = new Text({ text: "", style: { fill: 0xcfe8ff, fontSize: 20 }, layout: true });

  const table = new Container({ layout: { flexDirection: "row", gap: 80, alignItems: "center" } });
  const myCard = new CardView("me");
  const oppCard = new CardView("opponent");
  table.addChild(myCard, oppCard);

  const button = new FancyButton({
    defaultView: new Graphics().roundRect(0, 0, 220, 64, 16).fill(0x2f9e44),
    hoverView: new Graphics().roundRect(0, 0, 220, 64, 16).fill(0x37b24d),
    pressedView: new Graphics().roundRect(0, 0, 220, 64, 16).fill(0x2b8a3e),
    disabledView: new Graphics().roundRect(0, 0, 220, 64, 16).fill(0x555555),
    text: new Text({ text: "開牌", style: { fill: 0xffffff, fontSize: 28 } }),
  });
  button.layout = { width: 220, height: 64 };
  button.enabled = false;

  const boy = Spine.from({ skeleton: "boyData", atlas: "boyAtlas", scale: 0.22 });
  boy.state.setAnimation(0, "idle", true);
  const boyHolder = new Container({ layout: { width: 200, height: 150 } });
  boy.position.set(100, 145);
  boyHolder.addChild(boy);

  app.stage.addChild(title, status, scoreText, table, button, boyHolder);

  // ---------- networking ----------
  const client = new Client(SERVER);
  const room = await client.joinOrCreate("card", { name: NAME });
  actor.send({ type: "JOINED" });
  // 0.18 standard callbacks API (see .claude/skills/colyseus/SKILL.md "State callbacks").
  const callbacks = Callbacks.get(room);

  // The first full state may not have arrived yet right after joinOrCreate().
  const me = () => room.state.players?.get(room.sessionId);
  const opp = () => [...(room.state.players?.entries() ?? [])].find(([sid]: [string, unknown]) => sid !== room.sessionId)?.[1];

  const render = () => {
    const m = me(), o = opp();
    const phase = room.state.phase;
    if (m) myCard.show(m.card ?? 0, (m.card ?? 0) > 0);
    if (o) oppCard.show(o.shownCard ?? 0, phase === "revealed" && (o.shownCard ?? 0) > 0);
    scoreText.text = `第 ${room.state.round} 局　我 ${m?.score ?? 0} : ${o?.score ?? 0} 對手`;
    const st = actor.getSnapshot().value;
    // Enabled iff the machine would accept READY_SENT now (see .claude/skills/xstate-flow).
    button.enabled = actor.getSnapshot().can({ type: "READY_SENT" });
    status.text = ({
      connecting: "連線中…", waiting: "等待對手加入…", myChoice: "看完你的牌，按「開牌」",
      waitingOpponent: "等待對手開牌…",
      revealed: room.state.winner === "draw" ? "平手！" : room.state.winner === room.sessionId ? "你贏了！" : "你輸了",
    } as Record<string, string>)[String(st)] ?? String(st);
  };

  callbacks.listen("phase", (phase: string) => {
    if (phase === "dealt") actor.send({ type: "DEALT" });
    if (phase === "revealed") {
      actor.send({ type: "REVEALED" });
      try { sound.play("reveal"); soundPlays++; } catch (e) { errors.push(`sound: ${e}`); }
      if (room.state.winner === room.sessionId) {
        boy.state.setAnimation(0, "jump", false);
        boy.state.addAnimation(0, "idle", true, 0);
      }
    }
    if (phase === "waiting") actor.send({ type: "OPP_LEFT" });
    render();
  });
  callbacks.onAdd("players", (p: object) => { callbacks.onChange(p, render); render(); });
  callbacks.onRemove("players", render);
  callbacks.listen("round", render);

  button.onPress.connect(() => {
    if (!actor.getSnapshot().can({ type: "READY_SENT" })) return;
    room.send("ready");
    actor.send({ type: "READY_SENT" });
    render();
  });

  // ---------- test hooks (read-only views + raw send for cheat tests) ----------
  (window as any).__demo = {
    name: NAME,
    sessionId: room.sessionId,
    machine: () => String(actor.getSnapshot().value),
    transitions,
    errors,
    state: () => ({
      phase: room.state.phase, round: room.state.round, winner: room.state.winner,
      players: [...room.state.players.entries()].map(([sid, p]: [string, any]) => ({
        sid, name: p.name, score: p.score, ready: p.ready, shownCard: p.shownCard, card: p.card,
      })),
    }),
    cards: () => ({ me: myCard.debug, opp: oppCard.debug }),
    buttonCenter: () => { const b = button.getBounds(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, enabled: button.enabled }; },
    spine: () => ({ loaded: !!boy.skeleton, animations: boy.skeleton.data.animations.map((a) => a.name).slice(0, 6), current: boy.state.getTrack(0)?.animation?.name }), // Spine 4.3: getCurrent -> getTrack
    soundExists: () => sound.exists("reveal"),
    counters: () => ({ flipCount, soundPlays }),
    rawSend: (type: string, msg?: unknown) => room.send(type, msg),
  };
  render();
})().catch((e) => { errors.push(String(e?.stack ?? e)); console.error(e); });

window.addEventListener("error", (e) => errors.push(`window.error: ${e.message}`));
