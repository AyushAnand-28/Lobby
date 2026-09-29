"use client";

import { useEffect, useRef } from "react";

/**
 * Film grain over the whole page.
 *
 * The reference carries a full-viewport 2D canvas under its hero doing exactly
 * this. Repainting noise every frame is expensive, so instead one small tile is
 * generated once and repeated by CSS, with `background-position` stepping
 * between a few offsets — visually indistinguishable from per-frame noise at
 * this opacity, for effectively zero cost after the first paint.
 *
 * It is what stops a pure `#000` ground reading as flat and digital.
 */
const TILE = 128;

export function GrainOverlay() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const canvas = document.createElement("canvas");
    canvas.width = TILE;
    canvas.height = TILE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = ctx.createImageData(TILE, TILE);
    const { data } = image;

    for (let i = 0; i < data.length; i += 4) {
      // Monochrome noise; alpha stays opaque so it tints nothing.
      const v = (Math.random() * 255) | 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);

    /*
     * Written straight to the node rather than held in state. The tile is a
     * one-time side effect on an external system (the DOM) and never
     * participates in rendering, so putting it in state would only buy a
     * second render pass.
     */
    el.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 bg-repeat opacity-[0.035] mix-blend-overlay motion-safe:animate-[grain_0.6s_steps(1)_infinite]"
    />
  );
}
