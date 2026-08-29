"use client";

import { useEffect, useState } from "react";

const VISIBLE_MS = 2600; // matches the .animate-splash-fill duration in globals.css
const FADE_MS = 450;

// The döner box "fills up" as fries/meat/veggies drop into it one after
// another — each entry's own CSS animation-delay staggers the fall, and
// `left`/`top` place it so the pile looks roughly centered over the box.
const INGREDIENTS = [
  { emoji: "🍟", left: "8%", top: "34%", delay: "0.15s" },
  { emoji: "🥩", left: "58%", top: "28%", delay: "0.45s" },
  { emoji: "🧀", left: "30%", top: "22%", delay: "0.75s" },
  { emoji: "🍅", left: "72%", top: "40%", delay: "1.05s" },
  { emoji: "🥬", left: "18%", top: "44%", delay: "1.35s" },
];

export function SplashScreen({
  siteName,
  logoUrl,
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
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-accent-dark transition-opacity ease-out"
          style={{
            opacity: phase === "fading" ? 0 : 1,
            transitionDuration: `${FADE_MS}ms`,
          }}
        >
          <div className="animate-splash-badge">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={siteName}
                className="h-14 w-14 rounded-full object-cover shadow-lg"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-brand text-white grid place-items-center font-display font-extrabold text-xl shadow-lg">
                {siteName.slice(0, 1)}
              </div>
            )}
          </div>

          <h1 className="mt-4 font-display font-extrabold text-xl sm:text-2xl text-white tracking-tight">
            {siteName}
          </h1>

          {/* Дюнер бокс — fries/meat/cheese/veggies drop in one by one */}
          <div className="relative mt-8 h-28 w-36">
            {INGREDIENTS.map((ing, i) => (
              <span
                key={i}
                className="absolute text-3xl animate-drop-in"
                style={{ left: ing.left, top: ing.top, animationDelay: ing.delay }}
              >
                {ing.emoji}
              </span>
            ))}
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-6xl leading-none">
              🥡
            </span>
          </div>
          <p className="mt-3 text-white/60 text-sm font-bold tracking-wide">
            Приготвяме менюто...
          </p>

          <div className="mt-8 h-1.5 w-48 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full bg-brand animate-splash-fill" />
          </div>
        </div>
      )}
      {children}
    </>
  );
}
