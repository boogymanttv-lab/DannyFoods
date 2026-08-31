"use client";

import { useEffect, useState } from "react";
import type { KitchenLoadTier } from "@/lib/delivery-estimate";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { DictKey } from "@/lib/i18n/dict";

type Status = { openNow: boolean; estimateLabel: string; tier: KitchenLoadTier; label: string };

const TIER_STYLE: Record<KitchenLoadTier, string> = {
  calm: "border-success/40 bg-success/10 text-success",
  medium: "border-gold/40 bg-gold/10 text-gold",
  busy: "border-brand/40 bg-brand/10 text-brand-light",
};
const TIER_DOT: Record<KitchenLoadTier, string> = {
  calm: "bg-success",
  medium: "bg-gold",
  busy: "bg-brand",
};

// A small, honest "how busy is the kitchen right now" signal next to the
// existing "ОТВОРЕНО · ДОСТАВЯМЕ ДО..." pill — most delivery apps hide this
// on purpose; showing it builds trust instead ("we're upfront about how
// slow it might be"). Refreshes itself every 60s so it stays live while
// someone browses the menu, without needing a page reload.
export function KitchenStatusBadge({ initial }: { initial: Status }) {
  const [status, setStatus] = useState(initial);
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/kitchen-status", { cache: "no-store" });
        if (!res.ok) return;
        const data: Status = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        // A failed poll just keeps showing the last known status — never
        // worth surfacing an error for a purely informational badge.
      }
    }
    const id = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!status.openNow) return null;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-bold backdrop-blur-sm ${TIER_STYLE[status.tier]}`}
    >
      <span className={`h-2 w-2 rounded-full ${TIER_DOT[status.tier]}`} aria-hidden />
      {t(`kitchen.${status.tier}` as DictKey)}
    </span>
  );
}
