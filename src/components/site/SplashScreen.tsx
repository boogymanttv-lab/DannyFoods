"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { DictKey } from "@/lib/i18n/dict";
import {
  BasilLeaf,
  Mozzarella,
  Mushroom,
  PepperoniSlice,
  PizzaBody,
  PizzaGloss,
  Tomato,
} from "@/components/site/splash/Food";

const MIN_VISIBLE_MS = 1700;
const MAX_WAIT_MS = 9000;
const FADE_MS = 600;

const MESSAGES: DictKey[] = ["splash.msg1", "splash.msg2", "splash.msg3", "splash.msg4"];

type Item = {
  kind: "tomato" | "basil" | "mushroom" | "mozz" | "pepperoni";
  style: React.CSSProperties;
  size: number;
  d: number;
  delay: number;
  vars: [number, number, number, number, number, number, number, number];
  front?: boolean;
  blur?: number;
  desktopOnly?: boolean;
};

const ITEMS: Item[] = [
  { kind: "tomato", style: { left: "-3%", top: "12%" }, size: 19, d: 9, delay: 0, vars: [10, -16, -8, 10, 12, 14, 5, 10], front: true },
  { kind: "basil", style: { right: "-1%", top: "6%" }, size: 17, d: 11, delay: -3, vars: [-12, 12, 8, -10, -8, 16, 20, -14], front: true },
  { kind: "mushroom", style: { left: "-6%", top: "56%" }, size: 17, d: 10, delay: -5, vars: [12, 10, -10, -12, 14, -8, -6, 10], front: true },
  { kind: "mozz", style: { right: "-4%", top: "50%" }, size: 17, d: 12, delay: -2, vars: [-10, -14, 12, 10, -12, 12, 6, -8], front: true },
  { kind: "pepperoni", style: { left: "14%", bottom: "-6%" }, size: 14, d: 8.5, delay: -4, vars: [8, -10, -6, 8, 10, 12, -8, 6], front: true },
  { kind: "basil", style: { right: "12%", bottom: "-4%" }, size: 13, d: 10, delay: -6, vars: [-8, -12, 10, -6, -10, 10, 24, -10], front: true },
  { kind: "tomato", style: { right: "20%", top: "-6%" }, size: 10, d: 13, delay: -7, vars: [8, 10, -10, 6, 12, -8, 3, 8], blur: 1.2 },
  { kind: "mozz", style: { left: "20%", top: "-5%" }, size: 9, d: 14, delay: -1, vars: [-6, 12, 8, -8, -10, 10, 4, -6], blur: 1.6 },
  { kind: "pepperoni", style: { left: "-22%", top: "30%" }, size: 12, d: 12, delay: -8, vars: [10, 14, -8, 8, 12, -12, 8, -4], desktopOnly: true, blur: 1 },
  { kind: "mushroom", style: { right: "-24%", top: "30%" }, size: 11, d: 13, delay: -9, vars: [-10, 12, 8, -10, -12, 10, -6, 8], desktopOnly: true, blur: 1.4 },
  { kind: "tomato", style: { left: "-16%", bottom: "6%" }, size: 11, d: 11, delay: -3, vars: [10, -12, -8, 10, 8, 12, 6, -6], desktopOnly: true, blur: 0.8 },
  { kind: "basil", style: { right: "-18%", bottom: "8%" }, size: 10, d: 12, delay: -5, vars: [-8, 10, 10, -10, -10, 12, 18, -8], desktopOnly: true, blur: 1.2 },
];

const PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const r1 = seed / 233280;
  const r2 = ((seed * 7 + 13) % 1000) / 1000;
  const r3 = ((seed * 13 + 7) % 1000) / 1000;
  return {
    left: `${(r1 * 100).toFixed(1)}%`,
    top: `${(r2 * 100).toFixed(1)}%`,
    size: 3 + Math.round(r3 * 6),
    d: 11 + Math.round(r1 * 14),
    delay: -Math.round(r2 * 14),
    o: (0.35 + r3 * 0.5).toFixed(2),
    dx: Math.round((r1 - 0.5) * 40),
    dy: -Math.round(60 + r2 * 90),
    desktopOnly: i % 3 === 0,
  };
});

function FoodItem({ kind }: { kind: Item["kind"] }) {
  switch (kind) {
    case "tomato":
      return <Tomato />;
    case "basil":
      return <BasilLeaf />;
    case "mushroom":
      return <Mushroom />;
    case "mozz":
      return <Mozzarella />;
    default:
      return <PepperoniSlice />;
  }
}

export function SplashScreen({
  siteName,
  logoUrl,
  children,
}: {
  siteName: string;
  logoUrl?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const [phase, setPhase] = useState<"visible" | "fading" | "done">("visible");
  const [stage, setStage] = useState(0);
  const fillRef = useRef<HTMLDivElement>(null);
  const sparkRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const start = performance.now();
    let fontsReady = false;
    let pageLoaded = document.readyState === "complete";
    let shown = 0;
    let last = start;
    let frame = 0;
    let currentStage = 0;
    let finished = false;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let doneTimer: ReturnType<typeof setTimeout> | undefined;

    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => {
        fontsReady = true;
      });
    } else {
      fontsReady = true;
    }

    const onLoad = () => {
      pageLoaded = true;
    };
    if (!pageLoaded) window.addEventListener("load", onLoad);

    const paint = (value: number) => {
      const clamped = Math.min(100, Math.max(0, value));
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${clamped / 100})`;
      if (sparkRef.current) sparkRef.current.style.left = `${clamped}%`;
      if (percentRef.current) percentRef.current.textContent = `${Math.round(clamped)}%`;
      const nextStage = clamped >= 94 ? 3 : clamped >= 62 ? 2 : clamped >= 28 ? 1 : 0;
      if (nextStage !== currentStage) {
        currentStage = nextStage;
        setStage(nextStage);
      }
    };

    const tick = (now: number) => {
      const elapsed = now - start;
      const dt = now - last;
      last = now;
      const timedOut = elapsed >= MAX_WAIT_MS;
      const fontsPart = fontsReady || timedOut ? 30 : Math.min(22, elapsed * 0.011);
      const loadPart =
        pageLoaded || timedOut ? 50 : fontsReady ? Math.min(38, (elapsed - 200) * 0.009) : 0;
      const everythingReady = (fontsReady && pageLoaded) || timedOut;
      let target = 10 + fontsPart + Math.max(0, loadPart);
      if (everythingReady && elapsed >= MIN_VISIBLE_MS) target = 100;
      else if (everythingReady) target = Math.min(96, target);
      else target = Math.min(target, 88);
      shown += (target - shown) * (1 - Math.exp(-dt / 170));
      if (target === 100 && shown > 99.4) shown = 100;
      paint(shown);
      if (shown >= 100 && !finished) {
        finished = true;
        fadeTimer = setTimeout(() => setPhase("fading"), 260);
        doneTimer = setTimeout(() => setPhase("done"), 260 + FADE_MS);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("load", onLoad);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (doneTimer) clearTimeout(doneTimer);
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
          role="status"
          aria-busy={phase === "visible"}
          aria-label={t(MESSAGES[stage])}
          className="sp-root fixed inset-0 z-[999] overflow-hidden text-white transition-[opacity,transform] ease-out"
          style={{
            opacity: phase === "fading" ? 0 : 1,
            transform: phase === "fading" ? "scale(1.04)" : "scale(1)",
            transitionDuration: `${FADE_MS}ms`,
          }}
        >
          <div className="sp-layer sp-dots" />
          <div className="sp-glow sp-glow-a" />
          <div className="sp-glow sp-glow-b" />
          <div className="sp-glow sp-glow-c" />
          <div className="sp-layer overflow-hidden">
            <div className="sp-beam" />
          </div>
          <div className="sp-layer overflow-hidden">
            {PARTICLES.map((p, i) => (
              <span
                key={i}
                className={`sp-particle ${p.desktopOnly ? "hidden md:block" : ""}`}
                style={
                  {
                    left: p.left,
                    top: p.top,
                    width: p.size,
                    height: p.size,
                    "--d": `${p.d}s`,
                    "--delay": `${p.delay}s`,
                    "--o": p.o,
                    "--dx": `${p.dx}px`,
                    "--dy": `${p.dy}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          <div className="sp-vignette" />

          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-6 py-6 md:gap-10">
            <div className="sp-intro flex items-center gap-2.5 md:gap-3">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20 md:h-12 md:w-12"
                />
              )}
              <span className="bg-gradient-to-r from-[#ffd37a] via-white to-[#ffd37a] bg-clip-text font-display text-xl font-extrabold tracking-wide text-transparent md:text-3xl">
                {siteName}
              </span>
            </div>

            <div className="sp-intro relative aspect-square w-[min(84vw,48vh)] md:w-[min(54vh,540px)]">
              <div className="sp-scene-glow" />

              {ITEMS.filter((it) => !it.front).map((it, i) => (
                <ItemView key={`b${i}`} item={it} />
              ))}

              <div className="sp-steam" style={{ left: "26%", ["--d" as string]: "4.6s", ["--delay" as string]: "0s", ["--sx" as string]: "-12%" }} />
              <div className="sp-steam" style={{ left: "42%", ["--d" as string]: "5.2s", ["--delay" as string]: "-1.8s", ["--sx" as string]: "8%" }} />
              <div className="sp-steam" style={{ left: "58%", ["--d" as string]: "4.2s", ["--delay" as string]: "-3s", ["--sx" as string]: "14%" }} />

              <div className="sp-shadow" />

              <div className="absolute inset-0" style={{ transform: "perspective(1100px) rotateX(24deg)" }}>
                <div className="sp-float relative h-full w-full">
                  <div className="sp-spin h-full w-full">
                    <PizzaBody />
                  </div>
                  <PizzaGloss />
                </div>
              </div>

              {ITEMS.filter((it) => it.front).map((it, i) => (
                <ItemView key={`f${i}`} item={it} />
              ))}
            </div>

            <div className="sp-intro w-[min(82vw,360px)] md:w-[min(60vw,440px)]">
              <div className="mb-2 flex items-end justify-between">
                <span className="flex gap-1" aria-hidden>
                  <i className="block h-1.5 w-1.5 rounded-full bg-gold animate-dot-bounce" style={{ animationDelay: "0s" }} />
                  <i className="block h-1.5 w-1.5 rounded-full bg-gold animate-dot-bounce" style={{ animationDelay: "0.15s" }} />
                  <i className="block h-1.5 w-1.5 rounded-full bg-gold animate-dot-bounce" style={{ animationDelay: "0.3s" }} />
                </span>
                <span ref={percentRef} className="text-xs font-bold tabular-nums text-white/70 md:text-sm">
                  0%
                </span>
              </div>
              <div className="sp-bar">
                <div ref={fillRef} className="sp-bar-fill">
                  <div className="sp-bar-shine" />
                </div>
                <div ref={sparkRef} className="sp-bar-spark" style={{ left: "0%" }} />
              </div>
              <div className="relative mt-3 h-6 text-center md:mt-4 md:h-7">
                <p
                  key={stage}
                  className="sp-msg text-sm font-bold tracking-wide text-white/80 md:text-base"
                >
                  {t(MESSAGES[stage])}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}

function ItemView({ item }: { item: Item }) {
  const [x1, y1, x2, y2, r1, r2, x3, y3] = item.vars;
  return (
    <div
      className={`sp-item ${item.desktopOnly ? "hidden md:block" : ""}`}
      style={
        {
          ...item.style,
          width: `${item.size}%`,
          aspectRatio: "1",
          filter: item.blur ? `blur(${item.blur}px)` : undefined,
          "--d": `${item.d}s`,
          "--delay": `${item.delay}s`,
          "--x1": `${x1}px`,
          "--y1": `${y1}px`,
          "--x2": `${x2}px`,
          "--y2": `${y2}px`,
          "--x3": `${x3}px`,
          "--y3": `${y3}px`,
          "--r1": `${r1}deg`,
          "--r2": `${r2}deg`,
          "--r3": `${-r1 / 2}deg`,
        } as React.CSSProperties
      }
    >
      <FoodItem kind={item.kind} />
    </div>
  );
}
