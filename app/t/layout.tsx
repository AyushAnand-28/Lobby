import { Wordmark } from "@/components/brand";

/**
 * Shell for a tournament's public page: players and spectators, no login.
 * The header floats over the page's full-bleed hero rather than sitting above
 * it, so the photograph starts at the very top of the screen.
 */
export default function PublicTournamentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col">
      <header className="absolute inset-x-0 top-0 z-30 flex h-16 items-center gutter">
        <Wordmark />
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border gutter py-8 text-sm font-light text-foreground/55">
        Run on Lobby. Results update here as they are entered at the venue.
      </footer>
    </div>
  );
}
