"use client";

import { useCallback, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string | number;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  // "courier" renders a rotating direction puck (like Google Maps' live
  // location marker) that points the way the courier is moving.
  // "destination" renders a static pin. Omit for the plain colored dot used
  // elsewhere (e.g. the admin all-couriers overview map).
  kind?: "courier" | "destination";
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

// Great-circle bearing from point 1 to point 2, in degrees (0 = north).
function bearingBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Distance in meters (haversine) — used to ignore GPS jitter so the puck
// doesn't spin in place while the courier is stationary.
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function courierPuckHtml(color: string, bearingDeg: number) {
  return `
    <div style="width:32px;height:32px;transform:rotate(${bearingDeg}deg);transform-origin:50% 50%;">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <polygon points="16,1 22,13 10,13" fill="${color}" stroke="white" stroke-width="1.5"/>
        <circle cx="16" cy="18" r="9" fill="${color}" stroke="white" stroke-width="2.5"/>
      </svg>
    </div>`;
}

function destinationPinHtml(color: string) {
  return `
    <div style="width:30px;height:38px;position:relative;">
      <svg width="30" height="38" viewBox="0 0 30 38">
        <path d="M15 37C15 37 28 22.5 28 14C28 6.8 22.2 1 15 1C7.8 1 2 6.8 2 14C2 22.5 15 37 15 37Z"
          fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="15" cy="14" r="5.5" fill="white"/>
      </svg>
    </div>`;
}

function plainDotHtml(color: string) {
  return `<div style="background:${color};width:16px;height:16px;border-radius:999px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`;
}

export function MapView({
  markers,
  center,
  zoom = 13,
  height = 320,
  showRoute = true,
}: {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  // When a "courier" marker and a "destination" marker are both present,
  // draw a route line between them (like a live Google Maps ETA line).
  showRoute?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const routeLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const prevPosRef = useRef<Map<string | number, { lat: number; lng: number }>>(new Map());
  const bearingRef = useRef<Map<string | number, number>>(new Map());
  const routeReqIdRef = useRef(0);
  const lastRouteFromRef = useRef<{ lat: number; lng: number } | null>(null);

  // Varna city center as a sensible default.
  const fallbackCenter: [number, number] = [43.2141, 27.9147];

  const renderMarkers = useCallback(
    (L: typeof import("leaflet"), map: import("leaflet").Map) => {
      layerRef.current?.clearLayers();
      if (!layerRef.current) return;
      for (const m of markers) {
        let html: string;
        let iconSize: [number, number];
        let iconAnchor: [number, number];
        const color = m.color ?? "#e11d2e";

        if (m.kind === "courier") {
          const prev = prevPosRef.current.get(m.id);
          let bearingDeg = bearingRef.current.get(m.id) ?? 0;
          if (prev && distanceMeters(prev.lat, prev.lng, m.lat, m.lng) > 3) {
            bearingDeg = bearingBetween(prev.lat, prev.lng, m.lat, m.lng);
            bearingRef.current.set(m.id, bearingDeg);
          }
          prevPosRef.current.set(m.id, { lat: m.lat, lng: m.lng });
          html = courierPuckHtml(color, bearingDeg);
          iconSize = [32, 32];
          iconAnchor = [16, 18];
        } else if (m.kind === "destination") {
          html = destinationPinHtml(m.color ?? "#1a1a1a");
          iconSize = [30, 38];
          iconAnchor = [15, 37];
        } else {
          html = plainDotHtml(color);
          iconSize = [16, 16];
          iconAnchor = [8, 8];
        }

        const icon = L.divIcon({ className: "", html, iconSize, iconAnchor });
        const marker = L.marker([m.lat, m.lng], { icon }).addTo(layerRef.current);
        if (m.label) marker.bindTooltip(m.label, { permanent: false });
      }
      if (markers.length > 0 && !center) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
        map.fitBounds(bounds.pad(0.3), { maxZoom: 15 });
      }
    },
    [markers, center]
  );

  const renderRoute = useCallback(
    async (L: typeof import("leaflet")) => {
      const map = mapRef.current;
      if (!map || !routeLayerRef.current) return;

      const courier = markers.find((m) => m.kind === "courier");
      const destination = markers.find((m) => m.kind === "destination");

      if (!showRoute || !courier || !destination) {
        routeLayerRef.current.clearLayers();
        lastRouteFromRef.current = null;
        return;
      }

      // Avoid refetching on every tiny GPS jitter — only when the courier
      // has actually moved a meaningful distance, or we have no route yet.
      const last = lastRouteFromRef.current;
      if (last && distanceMeters(last.lat, last.lng, courier.lat, courier.lng) < 15) {
        return;
      }
      lastRouteFromRef.current = { lat: courier.lat, lng: courier.lng };

      const reqId = ++routeReqIdRef.current;
      const drawLine = (latlngs: [number, number][], dashed: boolean) => {
        if (reqId !== routeReqIdRef.current || !routeLayerRef.current) return;
        routeLayerRef.current.clearLayers();
        L.polyline(latlngs, {
          color: "#2563eb",
          weight: 5,
          opacity: 0.85,
          dashArray: dashed ? "8,8" : undefined,
        }).addTo(routeLayerRef.current);
      };

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const url = `https://router.project-osrm.org/route/v1/driving/${courier.lng},${courier.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error("routing failed");
        const data = await res.json();
        const coords: [number, number][] | undefined =
          data?.routes?.[0]?.geometry?.coordinates?.map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
          );
        if (!coords || coords.length === 0) throw new Error("no route geometry");
        drawLine(coords, false);
      } catch {
        // Routing service unreachable/rate-limited — fall back to a simple
        // straight dashed line so the customer still sees a direction.
        drawLine(
          [
            [courier.lat, courier.lng],
            [destination.lat, destination.lng],
          ],
          true
        );
      }
    },
    [markers, showRoute]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const initialCenter = center ?? markers[0]
        ? ([markers[0].lat, markers[0].lng] as [number, number])
        : fallbackCenter;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView(initialCenter, zoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      mapRef.current = map;
      // Route line goes underneath the markers layer.
      routeLayerRef.current = L.layerGroup().addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      renderMarkers(L, map);
      renderRoute(L);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      routeLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once; marker/route updates handled by the effects below
  }, []);

  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      if (mapRef.current) renderMarkers(L, mapRef.current);
    })();
  }, [renderMarkers]);

  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      if (mapRef.current) renderRoute(L);
    })();
  }, [renderRoute]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full rounded-2xl overflow-hidden border border-border bg-black/5"
    />
  );
}
