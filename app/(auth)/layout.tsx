import Link from "next/link";

import { AuthArtwork } from "@/components/auth/auth-artwork";
import { Wordmark } from "@/components/brand";
import { Reveal } from "@/components/motion/reveal";
import { RevealText } from "@/components/motion/reveal-text";

/**
 * Split layout: an oversized statement on the left, the form on the right.
 *
 * There is no colour change between the halves — the language is a single
 * black ground throughout, and the split is drawn with one hairline rule. On
 * small screens the statement drops away entirely so the form stays above the
 * fold.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col lg:grid lg:grid-cols-2">
      {/*
        On a narrow screen this collapses to a shallow banner so the form still
        starts near the top of the viewport; on desktop it becomes the full
        left column.
      */}
      <aside className="relative isolate flex min-h-[26svh] flex-col justify-between gutter py-[var(--y-half-default)] lg:min-h-0 lg:border-r lg:border-border lg:py-[var(--y-default)]">
        <AuthArtwork />
        <Wordmark />

        <div className="hidden lg:block">
          <p className="eyebrow text-foreground/55">Tournament software</p>
          <RevealText
            as="p"
            split="lines"
            trigger={false}
            className="mt-8 max-w-lg text-[clamp(2rem,3.4vw,3.5rem)] leading-[1.05] font-semibold"
          >
            Registration, fixtures and standings in one place.
          </RevealText>
          <Reveal
            y={20}
            delay={0.6}
            trigger={false}
            className="mt-8 max-w-sm text-base leading-relaxed font-light text-foreground/60"
          >
            <p>
              Organizers are the only people who need an account. Captains
              register from a link, spectators just read the page.
            </p>
          </Reveal>
        </div>

        <p className="hidden text-sm text-foreground/55 lg:block">
          <Link
            href="/"
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ← Back to home
          </Link>
        </p>
      </aside>

      <main className="flex flex-1 items-start justify-center gutter py-[var(--y-default)] lg:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
