import type { Metadata } from "next";

import { RevealText } from "@/components/motion/reveal-text";
import { Reveal } from "@/components/motion/reveal";
import { getDisplayName, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  return (
    <div className="grid gap-[var(--y-default)]">
      <div>
        <p className="eyebrow text-foreground/55">Dashboard</p>
        <RevealText
          as="h1"
          split="lines"
          trigger={false}
          className="mt-6 text-[clamp(2.25rem,5vw,4.5rem)] leading-none font-semibold"
        >
          {`Hello, ${getDisplayName(user)}`}
        </RevealText>
      </div>

      {/* Empty state. Creating a tournament needs the schema, which is the
          next slice of work — no CTA here yet that would 404. */}
      <Reveal
        y={24}
        trigger={false}
        delay={0.5}
        className="flex min-h-[40svh] flex-col items-start justify-end border border-border bg-mist p-[var(--x-double-default)]"
      >
        <div>
          <p className="text-3xl font-medium">No tournaments yet</p>
          <p className="mt-4 max-w-md text-base leading-relaxed font-light text-foreground/60">
            Once tournament creation lands, this is where you will set up a
            draw, approve teams and share the public link.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
