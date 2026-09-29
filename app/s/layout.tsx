import type { Metadata } from "next";

import { Wordmark } from "@/components/brand";

export const metadata: Metadata = {
  // A scorer link is a credential; keep it out of search results.
  robots: { index: false, follow: false },
};

/**
 * Shell for volunteers holding the scorer link. No account, no navigation
 * beyond the tournament they were given the link for.
 */
export default function ScorerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border">
        <div className="flex h-16 items-center justify-between gutter">
          <Wordmark href={null} />
          <span className="text-xs font-medium tracking-[0.08em] text-foreground/55 uppercase">
            Scorer
          </span>
        </div>
      </header>
      <main className="flex-1 gutter py-[var(--y-half-default)]">{children}</main>
    </div>
  );
}
