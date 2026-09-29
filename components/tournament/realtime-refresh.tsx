"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Re-renders the page when this tournament's matches, entries or status
 * change. Realtime is only the doorbell: the page re-fetches through the
 * server as usual, so what a viewer sees is always what row level security
 * lets them read — never a raw change event.
 *
 * Bursts are coalesced: a knockout result writes the match and the next
 * match's slot in one go, and that should be one refresh, not two.
 */
export function RealtimeRefresh({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();

  useEffect(() => {
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return; // Supabase not configured; the page still works, just not live.
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel(`tournament:${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `tournament_id=eq.${tournamentId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` },
        refresh,
      )
      .subscribe();

    // A phone that slept through results catches up when it wakes.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [router, tournamentId]);

  return null;
}
