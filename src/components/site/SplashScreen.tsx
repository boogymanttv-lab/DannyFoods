"use client";

import { useEffect, useState } from "react";

const VISIBLE_MS = 2600; // matches the .animate-splash-fill duration in globals.css
const FADE_MS = 450;

// The döner box "fills up" as fries/meat/cheese/veggies drop into it one
// after another — each entry's own CSS animation-delay staggers the fall.
// `top` is tuned so each emoji lands inside the box's dark interior opening,
// with its lower half then covered by the front wall (rendered afterwards,
// see below) — that's what sells the "landing inside an open box" illusion.
const INGREDIENTS = [
  { emoji: "🍟", left: "8%", top: "58px", delay: "0.15s" },
  { emoji: "🥩", left: "56%", top: "50px", delay: "0.45s" },
  { emoji: "🧀", left: "32%", top: "44px", delay: "0.75s" },
  { emoji: "🍅", left: "68%", top: "62px", delay: "1.05s" },
  { emoji: "🥬", left: "18%", top: "68px", delay: "1.35s" },
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

          {/* Дюнер бокс — a real flip-top kraft-paper container built from
              CSS layers (not one flat emoji): an open lid tilted back, a
              dark interior opening that gives it depth, corrugated-cardboard
              texture on the front wall, and that front wall painted OVER the
              ingredients' lower half so they read as landing inside it. */}
          <div className="relative z-10 h-36 w-44">
            {/* open lid, hinged at the back and tilted open */}
            <div
              className="absolute left-1/2 top-0 h-9 w-32 rounded-t-xl bg-gradient-to-b from-[#e8b578] to-[#c68a4e] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)]"
              style={{ transform: "translateX(-50%) rotate(-9deg)", transformOrigin: "bottom center" }}
            />
            {/* dark interior opening — gives the box visible depth */}
            <div className="absolute left-1/2 top-[30px] h-11 w-40 -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-black/60 via-[#5c3b22] to-[#5c3b22]" />
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
            {/* front wall, painted over the ingredients' lower half only —
                short enough that the interior opening and the top half of
                each landed ingredient both stay visible above it. */}
            <div className="absolute inset-x-1 bottom-0 z-20 h-16 rounded-b-2xl bg-gradient-to-b from-[#dd9d5c] via-[#c9884b] to-[#a86b38] shadow-[inset_0_2px_0_0_rgba(255,255,255,0.35)] overflow-hidden">
              {/* corrugated-cardboard ridges */}
              <div
                className="absolute inset-x-2 top-2 bottom-2 opacity-25"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 2px, transparent 2px, transparent 9px)",
                }}
              />
              {/* fold line under the rim */}
              <div className="absolute inset-x-0 top-0 h-1 bg-black/10" />
            </div>
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
