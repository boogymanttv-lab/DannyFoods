"use client";

import { useEffect, useState } from "react";

const VISIBLE_MS = 2600; // matches the .animate-splash-fill duration in globals.css
const FADE_MS = 450;

// Cycles through a few of the menu's categories while the splash is up —
// more fun to look at than a plain spinner, and doubles as a little teaser
// of what's on the menu.
const FOOD_STEPS = [
  { emoji: "🍕", label: "Пица" },
  { emoji: "🌯", label: "Дюнер" },
  { emoji: "🍔", label: "Бургер" },
  { emoji: "🥪", label: "Сандвич" },
];
const STEP_MS = VISIBLE_MS / FOOD_STEPS.length;

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
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#2f0f0f] to-[#200a0a] transition-opacity ease-out"
          style={{
            opacity: phase === "fading" ? 0 : 1,
            transitionDuration: `${FADE_MS}ms`,
          }}
        >
          {/* Animated backdrop: a slowly-panning dot grid (the "running
              dots") plus a couple of slow-drifting color blobs, instead of
              a flat color. */}
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 opacity-40 animate-dots"
              style={{
                backgroundImage: "radial-gradient(rgba(245,166,35,0.55) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
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

          {/* Cycling food icon — glowing card with a pop/rotate transition
              between categories. */}
          <div className="relative z-10 h-28 w-28 rounded-3xl bg-gradient-to-br from-white/15 to-white/5 border border-white/10 grid place-items-center animate-pulse-glow">
            <span key={stepIndex} className="text-6xl animate-splash-food">
              {step.emoji}
            </span>
          </div>
          <p
            key={`label-${stepIndex}`}
            className="relative z-10 mt-4 text-white/70 text-sm font-bold tracking-wide animate-splash-food"
          >
            {step.label}
          </p>

          {/* Shimmering premium "Зареждане" label with a bouncing ellipsis */}
          <div className="relative z-10 mt-6 flex items-center gap-1.5">
            <span className="bg-gradient-to-r from-gold via-white to-gold bg-clip-text text-transparent font-display font-extrabold text-base tracking-wide animate-shimmer">
              Зареждане
            </span>
            <span className="flex gap-1">
              <span
                className="h-1.5 w-1.5 rounded-full bg-gold animate-dot-bounce"
                style={{ animationDelay: "0s" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-gold animate-dot-bounce"
                style={{ animationDelay: "0.15s" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-gold animate-dot-bounce"
                style={{ animationDelay: "0.3s" }}
              />
            </span>
          </div>

          <div className="relative z-10 mt-6 h-1.5 w-48 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-gold animate-splash-fill" />
          </div>
        </div>
      )}
      {children}
    </>
  );
}
