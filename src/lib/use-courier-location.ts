"use client";

import { useEffect, useState } from "react";

const MIN_INTERVAL_MS = 12000;

export function useCourierLocationBroadcast() {
  const [status, setStatus] = useState<"idle" | "active" | "denied" | "unsupported">(
    "idle"
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability check on mount
      setStatus("unsupported");
      return;
    }

    let lastSent = 0;
    let cancelled = false;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        setStatus("active");
        const now = Date.now();
        if (now - lastSent < MIN_INTERVAL_MS) return;
        lastSent = now;
        fetch("/api/courier/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        }).catch(() => {
          // best-effort — a missed location ping isn't worth surfacing to the courier
        });
      },
      () => {
        if (!cancelled) setStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return status;
}
