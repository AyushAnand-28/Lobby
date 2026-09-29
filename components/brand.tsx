import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The Lobby wordmark: a small square mark and the name at body size.
 *
 * Held deliberately small. The language puts its weight into one enormous
 * piece of display type per screen, so the persistent chrome — nav, wordmark,
 * language switch — all sits at 16px and gets out of the way.
 */
export function Wordmark({
  className,
  href = "/",
}: {
  className?: string;
  href?: string | null;
}) {
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-base leading-none font-medium uppercase",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-5 shrink-0 fill-current"
      >
        {/* A shuttle in flight: skirt, then the cork leading it. */}
        <path d="M3 21 10.5 6.5 14 10 6.5 21Z" />
        <circle cx="17.5" cy="5.5" r="3.5" />
      </svg>
      Lobby
    </span>
  );

  if (href === null) return content;

  return (
    <Link
      href={href}
      className="outline-ring/50 focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      {content}
    </Link>
  );
}
