---
name: pixi-addons
description: "本專案 PixiJS 周邊套件的用法與陷阱：@pixi/ui（FancyButton、Slider、ScrollBox 等 UI 元件）、@pixi/layout（Flexbox 排版）、@esotericsoftware/spine-pixi-v8（Spine 骨骼動畫）、@pixi/sound（音效），以及在 PixiJS 物件上使用 GSAP 補間動畫。在新增或修改按鈕、UI 元件、版面排列、Spine 角色、音效、或用 gsap 對 Pixi 物件做動畫之前使用。官方 pixijs 技能不涵蓋這些套件。"
---

# PixiJS 周邊套件（本專案版本）

官方 `pixijs` 技能只涵蓋 pixi.js 本體。下面這幾個套件都沒有官方技能，用法以 **`node_modules` 裡的型別定義**為準，因為它的版本一定和專案安裝的一致。下文的寫法都已在 `client/main.ts` 實際跑過，並通過 e2e 測試。

## 第 1 步：確認版本，並找到型別定義

先讀 `package.json` 確認版本。驗證時的版本如下：

| 套件 | 驗證時的版本 | 型別定義（查 API 時讀這裡） |
|---|---|---|
| @pixi/ui | 2.4.1 | `node_modules/@pixi/ui/lib/<元件>.d.ts`，元件清單見 `lib/index.d.ts` |
| @pixi/layout | 3.2.1 | `node_modules/@pixi/layout/dist/core/style/layoutStyles.d.ts`（可用的排版屬性）、`dist/components/LayoutContainer.d.ts` |
| @esotericsoftware/spine-pixi-v8 | 4.3.13 | `node_modules/@esotericsoftware/spine-pixi-v8/dist/Spine.d.ts`、`node_modules/@esotericsoftware/spine-core/dist/AnimationState.d.ts` |
| @pixi/sound | 6.0.1 | `node_modules/@pixi/sound/lib/SoundLibrary.d.ts` |
| gsap | 3.15.0 | 一般 API 看官方 `gsap-core`、`gsap-timeline` 技能；用在 Pixi 物件上的差異看本文第 6 節 |

只要版本和上表不同，就先讀型別定義再動手，不要沿用下面的寫法。

## 第 2 步：@pixi/layout（排版）

- **在建立 `Application` 之前**先執行 `import "@pixi/layout";`。這個 import 會替 Container 加上 `layout` 屬性（mixin），順序錯了 `layout` 就不會生效。
- 根節點要明確給尺寸：`app.stage.layout = { width: app.screen.width, height: app.screen.height, flexDirection: "column", ... }`。
- 子物件加入排版有兩種寫法：建構時傳 `layout: true` 或樣式物件，例如 `new Text({ text, style, layout: true })`、`new Container({ layout: { flexDirection: "row", gap: 80 } })`。物件建好之後，也可以直接設定 `obj.layout = { width, height }`，@pixi/ui 的按鈕就是用這種方式。
- 排版會自己決定物件的位置。被排版的物件，不要再手動設定 `x`、`y`。要做浮動效果（例如角色跳躍），把它包進一個有固定尺寸的 Container，再對內層物件設定位置（參考 `boyHolder`）。
- 旋轉、縮放已經在排版中的物件，不會觸發重新排版（官方 README）。所以翻牌這類 GSAP 縮放動畫可以放心使用。

## 第 3 步：@pixi/ui（UI 元件）

- 可用的元件：`Button`、`FancyButton`、`CheckBox`、`RadioGroup`、`Slider`、`DoubleSlider`、`ProgressBar`、`CircularProgressBar`、`ScrollBox`、`List`、`Select`、`Switcher`、`Input`、`MaskedFrame`、`Dialog`、`Drawer`。
- `FancyButton` 的外觀，用四種狀態的圖形組成：`defaultView`、`hoverView`、`pressedView`、`disabledView`（可以是 `Graphics` 或材質名稱），文字放在 `text`。
- 事件是 signal（訊號物件），寫法是 `button.onPress.connect(fn)`，另有 `onDown`、`onUp`、`onUpOut`。它不是 DOM 事件，所以沒有 `addEventListener`。
- 用 `button.enabled = false` 停用按鈕，畫面會自動切換成 `disabledView`。按鈕可不可以按，要依照遊戲狀態來決定（本專案用 xstate 的狀態判斷），並在 `onPress` 開頭再檢查一次狀態。這樣就算玩家快速連點，也不會重複送出請求。
- e2e 測試要點擊按鈕時，先用 `button.getBounds()` 算出按鈕中心點，再用滑鼠點下去（見 `window.__demo.buttonCenter()`）。

## 第 4 步：Spine 骨骼動畫（spine-pixi-v8 4.3）

```ts
Assets.add({ alias: "boyData", src: "/assets/spine/spineboy-pro.skel" });
Assets.add({ alias: "boyAtlas", src: "/assets/spine/spineboy.atlas" });
await Assets.load(["boyData", "boyAtlas"]);
const boy = Spine.from({ skeleton: "boyData", atlas: "boyAtlas", scale: 0.22 });
boy.state.setAnimation(0, "idle", true);        // 第 0 軌，循環播放
boy.state.addAnimation(0, "idle", true, 0);     // 上一段動畫播完後，接著播
```

- **4.3 改了函式名稱**：要取得某一軌目前的動畫，寫 `boy.state.getTrack(0)`。舊的 `getCurrent()` 已經不存在。網路上的範例和 AI 的記憶大多還停在 4.2 以前。
- 動畫名稱不要用猜的，從 `boy.skeleton.data.animations.map(a => a.name)` 讀出實際的清單。
- `Spine.from` 的 `scale` 是在讀取骨架時就套用的縮放。要在執行中改大小，請另外設定 `boy.scale`。
- 需要 pixi.js 8.16 以上的版本（套件的 peerDependencies 有寫）。
- 素材檔放在 `public/assets/spine/`，它不進版本記錄，用 `npm run assets` 下載。

## 第 5 步：@pixi/sound（音效）

- 先註冊再播放：`sound.add("reveal", "/assets/reveal.wav")`，接著 `sound.play("reveal")`。
- 如果音效還沒載入完成，`play()` 會回傳 Promise。要在播完後做事，就 `await` 它。
- 瀏覽器規定，**使用者沒有先點擊或觸碰畫面，就不能自動播放聲音**。正式遊戲的第一次播放，要放在玩家點擊之後（例如按下開始鍵）。e2e 測試用 `--autoplay-policy=no-user-gesture-required` 這個參數繞過，這只是測試用的設定，玩家的瀏覽器不會有。
- 呼叫 `play()` 要包在 try/catch 裡，失敗時記到 `errors`，不能讓整個遊戲流程因此中斷。

## 第 6 步：GSAP 用在 Pixi 物件上

官方 `gsap-core` 技能是以 DOM 為對象寫的。換成 Pixi 物件時，有三點不同：

- **縮放要對 `sprite.scale` 本身做動畫**，例如 `gsap.to(card.scale, { x: 0 })`。Pixi 的 `scale` 是 ObservablePoint（帶 x、y 的點物件），不是單一數字。
- **淡入淡出用 `alpha`**。`autoAlpha` 是給 CSS 用的。物件需要隱藏時，自己在動畫結束的回呼（`onComplete`）裡設定 `visible = false`。
- 位置和旋轉直接對物件做動畫，例如 `gsap.to(sprite, { x: 100, rotation: Math.PI })`。這裡的 `rotation` 單位是弧度，CSS 用的是角度。
- 連續動作（翻牌：先縮到寬度 0、換牌面、再放大回來）用 `gsap.timeline()` 加 `.call()` 串起來，參考 `CardView.show()`。
- 物件被銷毀之前，先 `gsap.killTweensOf(target)` 停掉它身上的動畫，避免動畫繼續改寫已銷毀的物件。

## 完成條件

改完上面任何一項之後，執行 `npm run test:e2e`，最後一行要印出 `ALL PASS`。如果改動影響畫面，還要打開 `logs/e2e/*.png` 截圖確認。新的 UI 互動，要在 `tests/e2e.mjs` 補上對應的 `check(...)`。
