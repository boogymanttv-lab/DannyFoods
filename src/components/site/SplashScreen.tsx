"use client";

import { useEffect, useState } from "react";

const VISIBLE_MS = 2600; // matches the .animate-splash-fill duration in globals.css
const FADE_MS = 450;

// The döner box "fills up" as fries/meat/cheese/veggies drop into it one
// after another — each entry's own CSS animation-delay staggers the fall.
// `top` is tuned so roughly the top half of each emoji clears the box's
// front wall (rendered afterwards, see below) while the rest is hidden
// behind it — that's what sells the "landing inside an open box" illusion.
const INGREDIENTS = [
  { emoji: "🍟", left: "6%", top: "18%", delay: "0.15s" },
  { emoji: "🥩", left: "56%", top: "10%", delay: "0.45s" },
  { emoji: "🧀", left: "30%", top: "4%", delay: "0.75s" },
  { emoji: "🍅", left: "70%", top: "24%", delay: "1.05s" },
  { emoji: "🥬", left: "16%", top: "30%", delay: "1.35s" },
];

export function SplashScreen({
  children,
}: {
  siteName: string;
  logoUrl?: string;
  children: React.ReactNode;
}) {
  // "visible" -> "fading" -> "done". Only ever runs once per real page load
  // (this component lives in the root layout, which doesn't remount on
  // client-side navigation between pages) — so it greets a visitor once,
  // not every time they click around the site.
  const [phase, setPhase] = useState<"visible" | "fading" | "done">("visible");

  useEffect(() => {
    const toFading = setTimeout(() => setPhase("fading"), VISIBLE_MS);
    const toDone = setTimeout(() => setPhase("done"), VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(toFading);
      clearTimeout(toDone);
    };
  }, []);

  useEffect(() => {
    if (phase === "done") return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [phase]);

  return (
    <>
      {phase !== "done" && (
        <div
          aria-hidden={phase === "fading"}
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden bg-accent-dark transition-opacity ease-out"
          style={{
            opacity: phase === "fading" ? 0 : 1,
            transitionDuration: `${FADE_MS}ms`,
          }}
        >
          {/* Slow-drifting glow blobs — an animated backdrop instead of a
              flat color, kept subtle so the box/ingredients stay the focus. */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-16 -left-12 h-72 w-72 rounded-full bg-brand/30 blur-3xl animate-blob" />
            <div
              className="absolute -bottom-20 -right-10 h-80 w-80 rounded-full bg-gold/25 blur-3xl animate-blob"
              style={{ animationDelay: "-4s" }}
            />
            <div
              className="absolute top-1/3 right-1/4 h-56 w-56 rounded-full bg-brand-light/20 blur-3xl animate-blob"
              style={{ animationDelay: "-8s" }}
            />
          </div>

          {/* Дюнер бокс — an open kraft-paper box built from CSS (not an
              emoji) so the ingredients can visibly fall INSIDE it: a back
              panel gives it depth, then the ingredients drop in, then a
              shorter front wall paints over their lower half. */}
          <div className="relative z-10 h-32 w-40">
            {/* back interior + floor */}
            <div className="absolute inset-x-3 bottom-0 h-24 rounded-t-sm rounded-b-2xl bg-[#8a5a35]" />
            {/* falling ingredients */}
            {INGREDIENTS.map((ing, i) => (
              <span
                key={i}
                className="absolute z-10 text-3xl animate-drop-in"
                style={{ left: ing.left, top: ing.top, animationDelay: ing.delay }}
              >
                {ing.emoji}
              </span>
            ))}
            {/* front wall + rim, painted over the ingredients' lower half */}
            <div className="absolute inset-x-0 bottom-0 z-20 h-11 rounded-b-2xl bg-gradient-to-b from-[#d99a58] to-[#b97b3f] shadow-[inset_0_2px_0_0_rgba(255,255,255,0.35)]" />
          </div>

          <div className="relative z-10 mt-8 h-1.5 w-48 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full bg-brand animate-splash-fill" />
          </div>
        </div>
      )}
      {children}
    </>
  );
}
