import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Nav link whose label rolls up and is replaced by a copy of itself.
 *
 * The reference renders every nav label twice for this — inspecting its DOM
 * shows literal "WORKWORK" text nodes. The duplicate is `aria-hidden` here so
 * assistive tech reads the label once, which the original does not bother to
 * do.
 *
 * Deliberately CSS-only: it is a hover transition on a transform, so it costs
 * nothing and cannot desync from the pointer the way a JS-driven tween can.
 */
export function RollLink({
  href,
  children,
  className,
}: {
  href: string;
  children: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-block overflow-hidden align-middle",
        "outline-ring/50 focus-visible:outline-2 focus-visible:outline-offset-4",
        className,
      )}
    >
      {/* Sits in normal flow and reserves the box; rolls up and out on hover. */}
      <span className="block transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-full">
        {children}
      </span>
      {/* Waits one line-height below, rolls up into the vacated box. */}
      <span
        aria-hidden
        className="absolute inset-0 block translate-y-full transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0"
      >
        {children}
      </span>
    </Link>
  );
}

/**
 * Text call-to-action with a travelling arrow. The reference uses these
 * instead of filled buttons almost everywhere — "SEE OUR RELATED PROJECTS →".
 */
export function ArrowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-3 text-sm uppercase",
        "outline-ring/50 focus-visible:outline-2 focus-visible:outline-offset-4",
        className,
      )}
    >
      <span className="relative">
        {children}
        {/* Rule wipes in from the left on hover. */}
        <span className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-0 bg-current transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:origin-left group-hover:scale-x-100" />
      </span>
      <span
        aria-hidden
        className="transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5"
      >
        →
      </span>
    </Link>
  );
}
