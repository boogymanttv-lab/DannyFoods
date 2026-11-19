"use client";

import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleProvider";

export function CheckoutCancelledNotice() {
  const params = useSearchParams();
  const t = useT();
  if (params.get("cancelled") !== "1") return null;
  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
    >
      {t("checkout.paymentCancelled")}
    </div>
  );
}
