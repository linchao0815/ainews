import type { Container } from "pixi.js";

export interface Insets { top: number; right: number; bottom: number; left: number }
export interface DesignSize { w: number; h: number }

/**
 * env(safe-area-inset-*) is only readable from CSS, so measure it on a hidden probe element
 * (id `safe-area-probe`; the layout test overrides its padding to simulate a notch).
 * index.html needs `viewport-fit=cover` for the insets to be non-zero on real devices.
 */
export function createSafeAreaProbe(): () => Insets {
  const probe = document.createElement("div");
  probe.id = "safe-area-probe";
  probe.style.cssText = "position:fixed;inset:0;visibility:hidden;pointer-events:none;" +
    "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.appendChild(probe);
  return () => {
    const cs = getComputedStyle(probe);
    return {
      top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0,
    };
  };
}

export const orientationOf = (w: number, h: number): "portrait" | "landscape" => (w >= h ? "landscape" : "portrait");

/**
 * Scale and centre `holder` (a container WITHOUT a layout of its own, wrapping the game's
 * layout root) so a `design`-sized area fits inside the safe area. Returns the scale.
 * Which children go where per orientation stays in the game (Yoga has no `order`).
 */
export function fitToSafeArea(holder: Container, design: DesignSize, safe: Insets,
  viewport = { w: window.innerWidth, h: window.innerHeight }): number {
  const availW = Math.max(1, viewport.w - safe.left - safe.right);
  const availH = Math.max(1, viewport.h - safe.top - safe.bottom);
  const scale = Math.min(availW / design.w, availH / design.h);
  holder.scale.set(scale);
  holder.position.set(safe.left + (availW - design.w * scale) / 2, safe.top + (availH - design.h * scale) / 2);
  return scale;
}
