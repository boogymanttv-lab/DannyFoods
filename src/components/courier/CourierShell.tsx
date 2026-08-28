"use client";

import { useRouter } from "next/navigation";
import { useCourierLocationBroadcast } from "@/lib/use-courier-location";

const STATUS_LABEL: Record<string, string> = {
  idle: "Изчакване на GPS...",
  active: "GPS активен",
  denied: "GPS отказан — разрешете локация от браузъра",
  unsupported: "GPS не се поддържа на това устройство",
};

const STATUS_COLOR: Record<string, string> = {
  idle: "bg-gold/20 text-gold",
  active: "bg-success/10 text-success",
  denied: "bg-brand/10 text-brand",
  unsupported: "bg-black/5 text-muted",
};

export function CourierShell({
  courierName,
  children,
}: {
  courierName: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const gpsStatus = useCourierLocationBroadcast();

  async function logout() {
    await fetch("/api/courier/logout", { method: "POST" });
    router.push("/courier/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-display font-extrabold">🛵 {courierName}</p>
            <span
              className={`inline-block mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[gpsStatus]}`}
            >
              {STATUS_LABEL[gpsStatus]}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-sm font-semibold px-3.5 py-2 rounded-full border border-border"
          >
            Изход
          </button>
        </div>
      </header>
      <main className="p-4 max-w-2xl mx-auto">{children}</main>
    </div>
  );
}
