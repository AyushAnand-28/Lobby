import { Wordmark } from "@/components/brand";
import { LogoutButton } from "@/components/auth/logout-button";
import { getDisplayName, requireUser } from "@/lib/auth/session";

/**
 * Protected shell for everything an organizer sees once logged in.
 *
 * proxy.ts already turns anonymous traffic away, but this re-checks: the proxy
 * is a routing convenience and can be bypassed (direct RSC payload requests,
 * a misconfigured matcher), so authorization is re-established on render.
 */
/**
 * Never prerender anything under here. Without this, a build that runs before
 * the Supabase env vars exist would bake `/dashboard` into a static redirect to
 * `/login` and serve that to everyone, logged in or not.
 */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/dashboard");

  return (
    <div className="flex min-h-svh flex-col">
      {/*
        Sticky rather than fixed, and without the landing page's
        mix-blend-difference: the dashboard scrolls over its own content, so
        the header needs a solid ground to stay readable.
      */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gutter">
          <Wordmark href="/dashboard" />
          <div className="flex items-center gap-6">
            <span className="hidden text-sm font-light text-foreground/55 sm:inline">
              {getDisplayName(user)}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 gutter py-[var(--y-default)]">{children}</main>
    </div>
  );
}
