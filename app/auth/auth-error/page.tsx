import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Link problem",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <div className="flex min-h-svh flex-col bg-ink text-paper">
      <header className="mx-auto w-full max-w-6xl px-5 py-6">
        <Wordmark className="text-paper" />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-24">
        <div className="grid w-full max-w-md gap-5">
          <p className="eyebrow text-flame">Link problem</p>
          <h1 className="text-[clamp(1.75rem,1.5rem+1vw,2.5rem)]">
            That link did not work
          </h1>
          <p className="text-xs leading-relaxed text-paper/60">
            Email links expire after an hour and can only be used once. Request a
            fresh one and it should go through.
          </p>
          {reason ? (
            <p className="border border-paper/20 px-3 py-2 text-xs text-paper/50">
              {reason}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-3">
            <Button render={<Link href="/login" />} variant="flame" size="xl">
              Back to login
            </Button>
            <Button
              render={<Link href="/signup" />}
              variant="outline"
              size="xl"
              className="border-paper/30 bg-transparent text-paper hover:bg-paper hover:text-ink"
            >
              Create an account
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
