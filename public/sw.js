/* Service worker for the courier panel: shows order notifications even when
   Chrome / the app is closed, and opens the panel when one is tapped. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Нова поръчка", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Нова поръчка";
  const options = {
    body: data.body || "",
    tag: data.tag || "order",
    // A second notification for the same order replaces the first one but
    // still rings and vibrates again.
    renotify: true,
    // Stays on screen until the courier taps or dismisses it.
    requireInteraction: true,
    vibrate: [400, 150, 400, 150, 400, 150, 800],
    icon: "/courier-icon",
    badge: "/courier-icon",
    data: { url: data.url || "/courier" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/courier", self.location.origin);
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        const url = new URL(client.url);
        if (url.origin === target.origin && url.pathname.startsWith("/courier")) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target.href);
            } catch {
              // ignore — focusing is enough
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })()
  );
});

// Browsers occasionally rotate a subscription; register the new one so the
// courier keeps receiving notifications without doing anything.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch("/api/courier/push", { credentials: "same-origin" });
        const { publicKey } = await res.json();
        if (!publicKey) return;
        const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
        const raw = atob((publicKey + padding).replace(/-/g, "+").replace(/_/g, "/"));
        const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
        await fetch("/api/courier/push", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch {
        // the courier can re-enable from the panel
      }
    })()
  );
});
