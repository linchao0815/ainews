// Must be imported before creating the Application so layout mixins apply.
import "@pixi/layout";
import { Application, Assets, CanvasTextMetrics, Container, Graphics, Text } from "pixi.js";
import { FancyButton } from "@pixi/ui";
// spine-pixi-v8 must be imported before app.init(): importing it registers SpinePipe and
// the dark-tint batcher as renderer extensions, and a Pixi renderer only collects pipes
// when it is created (AbstractRenderer._addPipes is private). Lazy-loading it crashed with
// "reading 'validateRenderable'". @pixi/sound has no such hook, so it is lazy-loaded.
import { Spine } from "@esotericsoftware/spine-pixi-v8";
type SoundLib = typeof import("@pixi/sound")["sound"];
import { gsap } from "gsap";
import { setup, createActor } from "xstate";
import { Client, Callbacks } from "@colyseus/sdk";
import { resolveServerUrl } from "../kit/client/serverUrl.ts";
import { joinOrResume } from "../kit/client/session.ts";
import { createSafeAreaProbe, fitToSafeArea, orientationOf } from "../kit/client/fit.ts";

const params = new URLSearchParams(location.search);
const NAME = params.get("name") ?? "玩家";
// Identifies this game in shared browser storage (several games may run on one origin).
const GAME_ID = "high-card";
const SERVER = resolveServerUrl();

const errors: string[] = [];
const transitions: string[] = [];
let flipCount = 0;
let soundPlays = 0;
let lastFlipDuration = -1; // seconds; 0 means the flip was applied instantly
// Respect the OS "reduce motion" setting (see .claude/skills/card-game-design).
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const FLIP_HALF = 0.15;

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
    if (reducedMotion) {
      // Same end state, no motion.
      gsap.killTweensOf(this.scale);
      this.scale.x = 1;
      this.value = value; this.faceUp = faceUp; this.draw();
      lastFlipDuration = 0;
      return;
    }
    // GSAP flip: squash to 0 width, swap face, expand back.
    lastFlipDuration = FLIP_HALF * 2;
    gsap.timeline()
      .to(this.scale, { x: 0, duration: FLIP_HALF, ease: "power1.in" })
      .call(() => { this.value = value; this.faceUp = faceUp; this.draw(); })
      .to(this.scale, { x: 1, duration: FLIP_HALF, ease: "power1.out" });
  }

  get debug() { return { caption: this.caption, value: this.value, faceUp: this.faceUp }; }
}

function rankName(v: number) {
  return ({ 1: "A", 11: "J", 12: "Q", 13: "K" } as Record<number, string>)[v] ?? String(v);
}

(async () => {
  const app = new Application();
  // Full-window canvas; DPR capped at 2 so 3x phones don't triple the fill cost.
  await app.init({
    background: "#12324a", resizeTo: window, antialias: true,
    autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  document.body.appendChild(app.canvas);


  // ---------- layout ----------
  // Player names are user input: wrap the title so a long name can't widen the layout.
  // @pixi/layout overwrites style.wordWrapWidth with the node's computed layout width,
  // so the width must be set on `layout` (with `layout: true` the width is the unwrapped
  // text width and nothing ever wraps).
  const title = new Text({
    text: `PixiJS + Colyseus 比大小 — ${NAME}`,
    style: { fill: 0xffffff, fontSize: 26, wordWrap: true, breakWords: true, align: "center" },
    // objectFit "none": the default "scale-down" shrinks the whole line instead of wrapping.
    layout: { width: 400, objectFit: "none" },
  });
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

  // Fixed-size slot so the layout does not shift when the character arrives later.
  const boyHolder = new Container({ layout: { width: 200, height: 150 } });
  let boy: Spine | null = null;
  let soundLib: SoundLib | null = null;
  // Started after the first render (see below); failures are recorded, never fatal.
  const loadExtras = async () => {
    const { sound } = await import("@pixi/sound");
    sound.add("reveal", "/assets/reveal.wav");
    soundLib = sound;
    Assets.add({ alias: "boyData", src: "/assets/spine/spineboy-pro.skel" });
    Assets.add({ alias: "boyAtlas", src: "/assets/spine/spineboy.atlas" });
    await Assets.load(["boyData", "boyAtlas"]);
    const b = Spine.from({ skeleton: "boyData", atlas: "boyAtlas", scale: 0.22 });
    b.state.setAnimation(0, "idle", true);
    b.position.set(100, 145);
    boyHolder.addChild(b);
    boy = b;
  };

  // ---------- responsive arrangement (portrait + landscape, safe area) ----------
  // The game is laid out at a design resolution per orientation, then the whole root is
  // scaled to fit inside the safe area. The design sizes keep the 64px-high button at
  // >= 44 CSS px down to a 360x640 phone (see .claude/skills/card-game-design §4).
  const DESIGN = { portrait: { w: 480, h: 854 }, landscape: { w: 854, h: 480 } } as const;
  const infoTop = new Container({ layout: { flexDirection: "column", alignItems: "center", gap: 10 } });
  infoTop.addChild(title, status, scoreText);
  const controls = new Container({ layout: { flexDirection: "column", alignItems: "center", gap: 12 } });
  controls.addChild(button, boyHolder);
  const side = new Container({ layout: { width: 420, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 } });
  const root = new Container();      // layout root, laid out at design size
  const holder = new Container();    // positions + scales the root (no layout of its own)
  holder.addChild(root);
  app.stage.addChild(holder);

  const readSafe = createSafeAreaProbe();

  let orientation: "portrait" | "landscape" | "" = "";
  let uiScale = 1;
  let safe = readSafe();
  const arrange = () => {
    safe = readSafe();
    const next = orientationOf(window.innerWidth, window.innerHeight);
    if (next !== orientation) {
      orientation = next;
      root.removeChildren();
      side.removeChildren();
      if (orientation === "portrait") root.addChild(infoTop, table, controls);
      else { side.addChild(infoTop, controls); root.addChild(table, side); }
    }
    const d = DESIGN[orientation];
    root.layout = {
      width: d.w, height: d.h, flexDirection: orientation === "portrait" ? "column" : "row",
      alignItems: "center", justifyContent: "space-evenly",
    };
    uiScale = fitToSafeArea(holder, d, safe);
  };
  arrange();
  window.addEventListener("resize", arrange);

  // ---------- networking ----------
  // Join, or resume this tab's seat after a reload (kit: per-game sessionStorage token,
  // SDK 0.18.5 token-timing workaround, clear on 4000/4002/4003).
  const client = new Client(SERVER);
  const { room, resumed } = await joinOrResume(client, { gameId: GAME_ID, roomName: "card", joinOptions: { name: NAME } });
  actor.send({ type: "JOINED" });
  let leaveCode: number | null = null;
  let drops = 0, reconnects = 0, reconnecting = false;
  room.onLeave((code: number) => { leaveCode = code; });
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
    status.text = reconnecting ? "連線中斷，重新連線中…"
      : o && o.connected === false ? "對手斷線，等待重新連線（最多 20 秒）…"
      : ({
        connecting: "連線中…", waiting: "等待對手加入…", myChoice: "看完你的牌，按「開牌」",
        waitingOpponent: "等待對手開牌…",
        revealed: room.state.winner === "draw" ? "平手！" : room.state.winner === room.sessionId ? "你贏了！" : "你輸了",
      } as Record<string, string>)[String(st)] ?? String(st);
  };

  // 0.18 reconnection: the SDK retries on the same Room instance; callbacks stay attached.
  room.onDrop(() => { drops++; reconnecting = true; render(); });
  room.onReconnect(() => { reconnects++; reconnecting = false; render(); });

  callbacks.listen("phase", (phase: string) => {
    if (phase === "dealt") actor.send({ type: "DEALT" });
    if (phase === "revealed") {
      actor.send({ type: "REVEALED" });
      try { if (soundLib) { soundLib.play("reveal"); soundPlays++; } } catch (e) { errors.push(`sound: ${e}`); }
      if (room.state.winner === room.sessionId && boy) {
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
  // Only in `vite` dev and `vite build --mode e2e`. In a production build this whole
  // branch is a constant-false and is removed, so the shipped bundle contains no hook
  // (checked by `npm run test:bundle`).
  if (import.meta.env.DEV || import.meta.env.MODE === "e2e") (window as any).__demo = {
    name: NAME,
    sessionId: room.sessionId,
    machine: () => String(actor.getSnapshot().value),
    transitions,
    errors,
    state: () => ({
      phase: room.state.phase, round: room.state.round, winner: room.state.winner,
      players: [...room.state.players.entries()].map(([sid, p]: [string, any]) => ({
        sid, name: p.name, score: p.score, ready: p.ready, shownCard: p.shownCard, card: p.card, connected: p.connected,
      })),
    }),
    cards: () => ({ me: myCard.debug, opp: oppCard.debug }),
    buttonCenter: () => { const b = button.getBounds(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, enabled: button.enabled }; },
    spine: () => boy ? ({ loaded: !!boy.skeleton, animations: boy.skeleton.data.animations.map((a) => a.name).slice(0, 6), current: boy.state.getTrack(0)?.animation?.name }) : { loaded: false }, // Spine 4.3: getCurrent -> getTrack
    soundExists: () => soundLib?.exists("reveal") ?? false,
    counters: () => ({ flipCount, soundPlays, lastFlipDuration, reducedMotion }),
    rawSend: (type: string, msg?: unknown) => room.send(type, msg),
    connection: () => ({ leaveCode, drops, reconnects, reconnecting, resumed }),
    // Consented leave (CloseCode.CONSENTED): skips onDrop, so the server frees the seat
    // immediately instead of holding it for reconnection. Tests call this before closing.
    leave: () => room.leave(),
    ui: () => {
      const r = (o: Container) => { const b = o.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
      const titleLines = CanvasTextMetrics.measureText(title.text, title.style).lines.length;
      const tb = r(title);
      return { orientation, scale: uiScale, safe, title: tb, titleLines, titleLineHeight: tb.height / titleLines,
        button: r(button), cards: [r(myCard), r(oppCard)] };
    },
  };
  render();
  // Game is playable now; fetch the decorative / late-needed modules in the background.
  loadExtras().catch((e) => { errors.push(`extras: ${e?.stack ?? e}`); console.error(e); });
})().catch((e) => { errors.push(String(e?.stack ?? e)); console.error(e); });

window.addEventListener("error", (e) => errors.push(`window.error: ${e.message}`));
