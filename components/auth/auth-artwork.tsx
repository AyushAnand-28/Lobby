"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * Photograph behind the auth side panel.
 *
 * A client component purely so it can read the pathname: `/login` and
 * `/signup` share one layout, and an App Router layout cannot receive
 * per-page props. Giving each route its own image is what stops the two
 * screens feeling like the same page with the heading swapped.
 *
 * Both shots are deliberately not badminton — the product is multi-sport, and
 * these are the first screens someone signing up will see.
 */
const ARTWORK: Record<string, { src: string; alt: string }> = {
  "/login": {
    src: "/images/auth-login.jpg",
    alt: "A basketball player rising to dunk in a darkened gym",
  },
  "/signup": {
    src: "/images/auth-signup.jpg",
    alt: "A volleyball player jumping to spike under floodlights at night",
  },
};

export function AuthArtwork() {
  const pathname = usePathname();
  const art = ARTWORK[pathname] ?? ARTWORK["/login"];

  return (
    /*
     * `alt=""` and aria-hidden: this is decoration, and the panel beside it
     * already carries the same message in text. The descriptive strings above
     * are kept for whoever swaps these out later.
     */
    <div aria-hidden className="absolute inset-0 -z-10 overflow-clip">
      <Image
        src={art.src}
        alt=""
        fill
        priority
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover"
      />

      {/*
        Lighter than it looks like it should be. Both photographs are already
        low-key, so the landing page's 55% flat scrim plus a gradient buried
        them entirely — the panel just read as black. The flat layer is dropped
        to 40% and the gradient does the rest of the work, deepening only the
        band where the copy actually sits.
      */}
      <div className="absolute inset-0 bg-background/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/35" />
    </div>
  );
}
