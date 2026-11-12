"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { estimateLabel, estimateUpperMinutes } from "@/lib/delivery-estimate";
import { useLocale, useT } from "@/lib/i18n/LocaleProvider";
import type { DictKey } from "@/lib/i18n/dict";
import type { OrderStatus } from "@/lib/types";

const MapView = dynamic(() => import("@/components/shared/MapView").then((m) => m.MapView), {
  ssr: false,
});

const STATUS_KEYS: Record<OrderStatus, DictKey> = {
  new: "order.status.new",
  confirmed: "order.status.confirmed",
  preparing: "order.status.preparing",
  delivering: "order.status.delivering",
  delivered: "order.status.delivered",
  cancelled: "order.status.cancelled",
};

type Tracking = {
  status: OrderStatus;
  courierLocation: { lat: number; lng: number; name: string } | null;
  destination: { lat: number; lng: number } | null;
  estimatedDelivery: string | null;
  estimatedDeliverySetAt: string | null;
  requestedTime: string | null;
};

function DeliveryCountdownRing({
  estimate,
  setAt,
}: {
  estimate: string;
  setAt: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const totalMs = estimateUpperMinutes(estimate) * 60 * 1000;
  const deadline = new Date(setAt.replace(" ", "T") + "Z").getTime() + totalMs;
  const remainingMs = Math.max(0, deadline - now);
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - fraction);

  const totalSeconds = Math.round(remainingMs / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  const timeLabel =
    remainingMs <= 0 ? t("order.anyMoment") : `${mm}:${String(ss).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          transform="rotate(90 50 50)"
          className="fill-foreground font-bold"
          style={{ fontSize: remainingMs <= 0 ? "11px" : "17px" }}
        >
          {timeLabel}
        </text>
      </svg>
      <div>
        <p className="text-xs text-muted">{t("order.estimatedDeliveryTime")}</p>
        <p className="font-semibold">{estimateLabel(estimate, locale)}</p>
      </div>
    </div>
  );
}

function parseRequestedTime(requestedTime: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(requestedTime);
  if (!match) return null;
  const [, y, mo, d, hh, mm] = match;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm)).getTime();
}

function PendingConfirmationRing() {
  const t = useT();
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={0}
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          transform="rotate(90 50 50)"
          className="fill-foreground"
          style={{ fontSize: "22px" }}
        >
          ⏳
        </text>
      </svg>
      <div>
        <p className="text-xs text-muted">{t("order.waitingConfirmationLabel")}</p>
        <p className="font-semibold">{t("order.waitingConfirmationBody")}</p>
      </div>
    </div>
  );
}

function ScheduledTimeCountdown({ requestedTime }: { requestedTime: string }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const deadline = parseRequestedTime(requestedTime);
  if (deadline === null) return null;
  const remainingMs = Math.max(0, deadline - now);
  if (remainingMs <= 0) return null;

  const totalMinutes = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}${t("order.days")}`);
  if (days > 0 || hours > 0) parts.push(`${hours}${t("order.hours")}`);
  parts.push(`${minutes}${t("order.minutes")}`);

  return (
    <div>
      <p className="text-xs text-muted">{t("order.scheduledCountdownLabel")}</p>
      <p className="font-semibold text-lg">{parts.join(" ")}</p>
    </div>
  );
}

function ScheduledOrPendingRing({ requestedTime }: { requestedTime: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const deadline = requestedTime ? parseRequestedTime(requestedTime) : null;
  const stillScheduled = deadline !== null && deadline > now;

  return stillScheduled ? (
    <ScheduledTimeCountdown requestedTime={requestedTime!} />
  ) : (
    <PendingConfirmationRing />
  );
}

export function OrderTracking({
  orderNumber,
  initialStatus,
}: {
  orderNumber: string;
  initialStatus: OrderStatus;
}) {
  const t = useT();
  const [tracking, setTracking] = useState<Tracking>({
    status: initialStatus,
    courierLocation: null,
    destination: null,
    estimatedDelivery: null,
    estimatedDeliverySetAt: null,
    requestedTime: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderNumber}/tracking`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setTracking(data);
      } catch {
      }
    }
    poll();
    const interval = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderNumber]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-semibold">{t("order.status")}</span>
        <span className="bg-brand/10 text-brand font-bold text-sm px-3 py-1 rounded-full">
          {STATUS_KEYS[tracking.status] ? t(STATUS_KEYS[tracking.status]) : tracking.status}
        </span>
      </div>

      {tracking.estimatedDelivery &&
        tracking.estimatedDeliverySetAt &&
        tracking.status !== "delivered" &&
        tracking.status !== "cancelled" && (
          <DeliveryCountdownRing
            estimate={tracking.estimatedDelivery}
            setAt={tracking.estimatedDeliverySetAt}
          />
        )}

      {!tracking.estimatedDelivery &&
        tracking.status !== "delivered" &&
        tracking.status !== "cancelled" && (
          <ScheduledOrPendingRing requestedTime={tracking.requestedTime} />
        )}

      {tracking.status === "delivering" && tracking.courierLocation && (
        <div>
          <p className="text-xs text-muted mb-2">
            🛵 {tracking.courierLocation.name} {t("order.courierOnWay")}
          </p>
          <MapView
            markers={[
              {
                id: "courier",
                kind: "courier",
                lat: tracking.courierLocation.lat,
                lng: tracking.courierLocation.lng,
                label: tracking.courierLocation.name,
              },
              ...(tracking.destination
                ? [
                    {
                      id: "destination",
                      kind: "destination" as const,
                      lat: tracking.destination.lat,
                      lng: tracking.destination.lng,
                      label: t("order.deliveryAddressPin"),
                    },
                  ]
                : []),
            ]}
            zoom={15}
            height={260}
          />
        </div>
      )}

      {tracking.status === "delivering" && !tracking.courierLocation && (
        <p className="text-xs text-muted">🛵 {t("order.courierNoGps")}</p>
      )}
    </div>
  );
}
