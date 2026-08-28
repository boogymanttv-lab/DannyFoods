"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const CONSENT_KEY = "dd_cookie_consent"; // "accepted" | "rejected"

// A single component that both shows the cookie-consent banner (GDPR/
// ePrivacy — required whenever non-essential cookies like analytics or ad
// pixels are in play) and conditionally loads Google Analytics / Meta Pixel
// once the visitor has actually accepted. Login sessions and the cart use
// only strictly-necessary cookies/localStorage, which don't need consent —
// so with no gaId/metaPixelId configured, this renders nothing extra at all
// beyond the banner itself.
export function CookieConsent({
  gaId,
  metaPixelId,
}: {
  gaId?: string;
  metaPixelId?: string;
}) {
  const [consent, setConsent] = useState<"accepted" | "rejected" | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(CONSENT_KEY);
    } catch {
      // Private-browsing/blocked storage — treat as "not yet decided" each
      // visit rather than crashing; the banner will just reappear.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser API (localStorage) only available client-side, same pattern used elsewhere in this codebase (e.g. SettingsManager's window.location.origin read)
    setConsent(stored === "accepted" || stored === "rejected" ? stored : null);
    setReady(true);
  }, []);

  function decide(value: "accepted" | "rejected") {
    setConsent(value);
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // Ignore — worst case the banner reappears next visit.
    }
  }

  const trackingConfigured = Boolean(gaId || metaPixelId);

  return (
    <>
      {consent === "accepted" && gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', { anonymize_ip: true });`}
          </Script>
        </>
      )}
      {consent === "accepted" && metaPixelId && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
            fbq('track', 'PageView');`}
        </Script>
      )}

      {ready && consent === null && trackingConfigured && (
        <div className="fixed bottom-0 inset-x-0 z-[998] p-4">
          <div className="mx-auto max-w-2xl bg-accent-dark text-white rounded-2xl shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-white/80 flex-1">
              Използваме бисквитки за анализ на трафика и реклами. Приемате ли това? Можете да
              прочетете повече в{" "}
              <a href="/privacy" className="underline text-white font-semibold">
                Политиката за защита на личните данни
              </a>
              .
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => decide("rejected")}
                className="text-sm font-semibold px-4 py-2 rounded-xl border border-white/30 text-white/90"
              >
                Отказвам
              </button>
              <button
                onClick={() => decide("accepted")}
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-brand text-white"
              >
                Приемам
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
