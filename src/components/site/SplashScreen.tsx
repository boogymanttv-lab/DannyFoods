"use client";

import { useEffect, useState } from "react";

const VISIBLE_MS = 2600; // matches the .animate-splash-fill duration in globals.css
const FADE_MS = 450;

// Cycles through the menu's five categories while the splash is up — more
// fun to look at than a plain spinner, and doubles as a little teaser of
// what's on the menu.
const FOOD_STEPS = [
  { emoji: "🌯", label: "Дюнер" },
  { emoji: "🍕", label: "Пица" },
  { emoji: "🍔", label: "Бургер" },
  { emoji: "🥪", label: "Сандвич" },
  { emoji: "🥙", label: "Джоб" },
];
const STEP_MS = VISIBLE_MS / FOOD_STEPS.length;

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
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const toFading = setTimeout(() => setPhase("fading"), VISIBLE_MS);
    const toDone = setTimeout(() => setPhase("done"), VISIBLE_MS + FADE_MS);
    const stepInterval = setInterval(() => {
      setStepIndex((i) => (i + 1) % FOOD_STEPS.length);
    }, STEP_MS);
    return () => {
      clearTimeout(toFading);
      clearTimeout(toDone);
      clearInterval(stepInterval);
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

  const step = FOOD_STEPS[stepIndex];

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

          <div
            key={stepIndex}
            className="mt-8 h-24 w-24 rounded-3xl bg-white/10 grid place-items-center animate-splash-food"
          >
            <span className="text-5xl">{step.emoji}</span>
          </div>
          <p key={`label-${stepIndex}`} className="mt-3 text-white/60 text-sm font-bold tracking-wide animate-splash-food">
            {step.label}
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
