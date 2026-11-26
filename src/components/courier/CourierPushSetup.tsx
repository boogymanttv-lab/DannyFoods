"use client";

import { useEffect, useState } from "react";

type State =
  | "loading"
  | "not-configured"
  | "ios-install"
  | "unsupported"
  | "denied"
  | "off"
  | "on";

const SW_SCOPE = "/courier";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function fetchStatus(endpoint?: string) {
  const qs = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : "";
  const res = await fetch(`/api/courier/push${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("status");
  return (await res.json()) as { publicKey: string; configured: boolean; subscribed: boolean };
}

async function saveSubscription(sub: PushSubscription) {
  const res = await fetch("/api/courier/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) throw new Error("save");
}

export function CourierPushSetup() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        if (!pushSupported()) {
          if (!cancelled) setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: SW_SCOPE });
        const sub = await reg.pushManager.getSubscription();
        const status = await fetchStatus(sub?.endpoint);
        if (cancelled) return;
        if (!status.configured) return setState("not-configured");
        if (Notification.permission === "denied") return setState("denied");
        if (sub && Notification.permission === "granted") {
          // The phone is subscribed but the server doesn't know (or it was
          // registered under another courier) — quietly fix it.
          if (!status.subscribed) await saveSubscription(sub);
          if (!cancelled) setState("on");
          return;
        }
        setState("off");
      } catch {
        if (!cancelled) setState("off");
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async status check
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      // Must be the first thing after the tap — iPhone only shows the
      // permission prompt in direct response to a tap.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: SW_SCOPE });
      await navigator.serviceWorker.ready;
      const { publicKey, configured } = await fetchStatus();
      if (!configured || !publicKey) {
        setState("not-configured");
        return;
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(publicKey),
        });
      }
      await saveSubscription(sub);
      setState("on");
      setMessage("Готово! Натисни „Изпрати тест“, за да провериш.");
    } catch {
      setMessage("Не успяхме да включим известията. Опитай отново.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/courier/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setMessage("Не успяхме да изключим известията.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/courier/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setMessage(
        res.ok
          ? "Изпратено — до няколко секунди трябва да получиш известие."
          : (data.error ?? "Тестът не беше изпратен.")
      );
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  if (state === "on") {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-emerald-800">🔔 Известията за поръчки са включени</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sendTest}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              Изпрати тест
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-60"
            >
              Изключи
            </button>
          </div>
        </div>
        {message && <p className="text-xs font-semibold text-emerald-800">{message}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4 space-y-2">
      {state === "off" && (
        <>
          <p className="text-sm font-bold text-red-800">
            🔕 Известията са изключени — няма да разбереш за нова поръчка, ако приложението е затворено.
          </p>
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {busy ? "..." : "🔔 Включи известия за поръчки"}
          </button>
        </>
      )}
      {state === "ios-install" && (
        <div className="text-sm text-red-900 space-y-1">
          <p className="font-bold">📲 На iPhone известията работят само от иконата на началния екран:</p>
          <p>1. Отвори тази страница в Safari.</p>
          <p>2. Натисни бутона „Сподели“ (квадратче със стрелка нагоре).</p>
          <p>3. Избери „Добави към началния екран“ → „Добави“.</p>
          <p>4. Отвори „Куриер“ от новата икона, влез и натисни „Включи известия“.</p>
        </div>
      )}
      {state === "denied" && (
        <div className="text-sm text-red-900 space-y-1">
          <p className="font-bold">🚫 Известията са блокирани за този сайт.</p>
          <p>
            Android: натисни катинарчето до адреса → Разрешения → Известия → Разреши, после
            презареди страницата.
          </p>
          <p>iPhone: Настройки → Известия → Куриер → Разреши известия.</p>
        </div>
      )}
      {state === "unsupported" && (
        <p className="text-sm font-semibold text-red-900">
          Този браузър не поддържа известия. Използвай Google Chrome (Android) или Safari (iPhone).
        </p>
      )}
      {state === "not-configured" && (
        <p className="text-sm font-semibold text-red-900">
          Известията още не са настроени от собственика на сайта.
        </p>
      )}
      {message && <p className="text-xs font-semibold text-red-800">{message}</p>}
    </div>
  );
}
