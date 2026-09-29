"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * The shared registration link, with a copy button. The link is shown in full
 * and selectable, so it can still be copied by hand where the clipboard API is
 * unavailable (plain http on a LAN address, some in-app browsers).
 */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard blocked: the link is on screen to copy by hand.
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <output className="min-w-0 flex-1 truncate border border-border px-3.5 py-3 font-light text-foreground/80 select-all">
        {url}
      </output>
      <Button
        type="button"
        variant="brand"
        size="xl"
        onClick={copy}
        aria-live="polite"
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
