"use client";

import { ReactLenis, type LenisRef } from "lenis/react";
import { useEffect, useRef } from "react";

import { ScrollTrigger, gsap, prefersReducedMotion } from "./gsap";

/**
 * Inertial scrolling, driven off GSAP's ticker rather than its own rAF loop.
 *
 * This matters more than it looks. Lenis and ScrollTrigger both want to run
 * once per frame; if each keeps its own loop they interleave unpredictably and
 * scrubbed animations lag the scroll position by a frame, which reads as a
 * rubbery disconnect between the page and the pointer. Driving Lenis from
 * `gsap.ticker` and disabling GSAP's own lag smoothing puts them on the same
 * clock.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    /*
     * Reduced motion means no inertia at all — Lenis is left uninitialised and
     * the browser's native scrolling takes over untouched.
     */
    if (prefersReducedMotion()) return;

    function update(time: number) {
      // GSAP's ticker is in seconds; Lenis expects milliseconds.
      lenisRef.current?.lenis?.raf(time * 1000);
    }

    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    const lenis = lenisRef.current?.lenis;
    lenis?.on("scroll", ScrollTrigger.update);

    /*
     * Re-measure once the page has actually settled.
     *
     * Triggers are computed the moment each component mounts, which is before
     * the webfont swaps in and before images have reserved their space. Every
     * position measured until then is stale, and any trigger far enough down
     * the page ends up with a start point that the user can never reach — the
     * element simply stays in its `from` state forever. Refreshing on font
     * load and on `load` fixes the measurements in both cases.
     */
    const refresh = () => ScrollTrigger.refresh();

    void document.fonts?.ready.then(refresh);
    if (document.readyState === "complete") refresh();
    else window.addEventListener("load", refresh, { once: true });

    return () => {
      gsap.ticker.remove(update);
      gsap.ticker.lagSmoothing(500, 33);
      lenis?.off("scroll", ScrollTrigger.update);
      window.removeEventListener("load", refresh);
    };
  }, []);

  return (
    <ReactLenis
      root
      ref={lenisRef}
      /*
       * `autoRaf: false` hands the frame loop to GSAP above. Everything else
       * is the reference's own configuration: a 1.2s glide with a heavy
       * exponential settle, and no smoothing on touch, where the platform's
       * native momentum is already better than anything JS can fake.
       */
      options={{
        autoRaf: false,
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
        touchMultiplier: 2,
        wheelMultiplier: 1,
        // In-page links (the public page's section nav) glide rather than
        // jump, and leave Lenis's position in step with the page.
        anchors: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
