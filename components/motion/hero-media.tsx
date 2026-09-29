"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const WIDE = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const queries = [window.matchMedia(REDUCED_MOTION), window.matchMedia(WIDE)];
  queries.forEach((q) => q.addEventListener("change", onChange));
  return () => queries.forEach((q) => q.removeEventListener("change", onChange));
}

function shouldPlayVideo() {
  // `connection` is Chromium-only; absence means "no signal", not "no".
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;

  return (
    !window.matchMedia(REDUCED_MOTION).matches &&
    window.matchMedia(WIDE).matches &&
    connection?.saveData !== true
  );
}

/**
 * Hero backdrop: a still that is always there, with a looping clip layered
 * over it only where that is a good idea.
 *
 * The still is the LCP element and ships to everyone. The video is a
 * progressive enhancement and is deliberately *not* rendered at all when it
 * would be a bad trade:
 *
 * - narrow viewports, where it is 6MB of cellular data for a background an
 *   organizer is likely loading at a venue;
 * - `prefers-reduced-motion`, where looping motion is the thing being opted
 *   out of;
 * - `Save-Data`, where the user has asked for exactly this to be skipped.
 *
 * The reference's own hero is a still — no video anywhere on the page — so
 * this is an addition to the language rather than a copy of it, and it is kept
 * subordinate to the photograph accordingly.
 */
export function HeroMedia({
  image,
  video,
}: {
  image: string;
  /** Omit to ship the still alone — the clip is never load-bearing. */
  video?: string;
}) {
  /*
   * Subscribed rather than read once in an effect: these are external stores,
   * so `useSyncExternalStore` keeps them correct through a resize or a change
   * of motion preference, gives a stable `false` for the server render, and
   * avoids the extra render an effect-then-setState would cost.
   */
  const showVideo = useSyncExternalStore(subscribe, shouldPlayVideo, () => false);
  const [ready, setReady] = useState(false);

  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-clip bg-background">
      <Image
        src={image}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      {showVideo && video ? (
        <video
          src={video}
          poster={image}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          onCanPlayThrough={() => setReady(true)}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ease-out ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : null}

      {/*
        Two-part scrim. The flat layer guarantees a contrast floor everywhere;
        the gradient deepens the bottom-left, where the strapline sits, and the
        top, where the nav does. Without the flat layer, a bright frame of the
        clip can wash out the middle of the headline.
      */}
      <div className="absolute inset-0 bg-background/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-background/70" />
    </div>
  );
}
