import { useId } from "react";

function useUid() {
  return useId().replace(/[^a-zA-Z0-9]/g, "");
}

const CRUST_BUBBLES = Array.from({ length: 26 }, (_, i) => {
  const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.05;
  const r = 166 + (i % 4);
  return {
    x: 200 + Math.cos(a) * r,
    y: 200 + Math.sin(a) * r,
    rx: 8 + (i % 5),
    ry: 5 + (i % 3),
    rot: (a * 180) / Math.PI + 90,
    light: i % 2 === 0,
  };
});

const CHEESE_EDGE = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const r = 134 + (i % 3) * 2;
  return { x: 200 + Math.cos(a) * r, y: 200 + Math.sin(a) * r, r: 15 + (i % 4) * 2 };
});

const PEPPERONI = [
  [150, 142],
  [242, 130],
  [288, 208],
  [236, 268],
  [148, 262],
  [112, 204],
  [196, 202],
  [196, 92],
] as const;

const MUSHROOMS = [
  [258, 168, 20],
  [160, 196, -30],
  [214, 244, 10],
  [128, 134, 40],
  [262, 240, -18],
] as const;

const OLIVES = [
  [178, 150],
  [232, 190],
  [168, 244],
  [250, 120],
  [118, 250],
] as const;

const BASIL = [
  [206, 156, 20],
  [138, 176, -40],
  [248, 214, 70],
  [188, 258, 150],
  [226, 104, -10],
] as const;

const MOZZ_PATCHES = [
  [160, 120, 30, 16, 20],
  [252, 150, 26, 14, -30],
  [120, 220, 28, 14, 60],
  [210, 280, 30, 15, 10],
  [276, 238, 22, 12, 40],
  [196, 160, 26, 13, 70],
  [150, 212, 24, 12, -20],
] as const;

export function PizzaBody() {
  return (
    <svg viewBox="0 0 400 400" className="block h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="sp-crust" cx="40%" cy="34%" r="75%">
          <stop offset="0" stopColor="#f6bd66" />
          <stop offset="0.65" stopColor="#dc8c30" />
          <stop offset="1" stopColor="#a85817" />
        </radialGradient>
        <radialGradient id="sp-sauce" cx="45%" cy="40%" r="70%">
          <stop offset="0" stopColor="#e8402f" />
          <stop offset="1" stopColor="#a01c13" />
        </radialGradient>
        <radialGradient id="sp-cheese" cx="42%" cy="36%" r="72%">
          <stop offset="0" stopColor="#ffe597" />
          <stop offset="0.6" stopColor="#f8b94c" />
          <stop offset="1" stopColor="#e5902a" />
        </radialGradient>
        <radialGradient id="sp-pep" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ee5a46" />
          <stop offset="0.65" stopColor="#b9271b" />
          <stop offset="1" stopColor="#7a130d" />
        </radialGradient>
      </defs>

      <ellipse cx="200" cy="216" rx="178" ry="176" fill="#7b3d10" />
      <circle cx="200" cy="200" r="178" fill="url(#sp-crust)" />
      <circle cx="200" cy="200" r="178" fill="none" stroke="#8c4710" strokeOpacity="0.55" strokeWidth="3" />
      {CRUST_BUBBLES.map((b, i) => (
        <ellipse
          key={i}
          cx={b.x}
          cy={b.y}
          rx={b.rx}
          ry={b.ry}
          transform={`rotate(${b.rot} ${b.x} ${b.y})`}
          fill={b.light ? "#ffd58a" : "#b86a20"}
          opacity={b.light ? 0.5 : 0.45}
        />
      ))}
      <circle cx="200" cy="200" r="150" fill="#c9792b" />
      <circle cx="200" cy="200" r="146" fill="url(#sp-sauce)" />
      <circle cx="200" cy="200" r="138" fill="url(#sp-cheese)" />
      {CHEESE_EDGE.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={c.r} fill="url(#sp-cheese)" />
      ))}
      <circle cx="200" cy="200" r="140" fill="none" stroke="#d98322" strokeOpacity="0.5" strokeWidth="2" />
      {MOZZ_PATCHES.map(([x, y, rx, ry, rot], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx={rx}
          ry={ry}
          transform={`rotate(${rot} ${x} ${y})`}
          fill="#fff3cd"
          opacity="0.6"
        />
      ))}
      {[
        [150, 170],
        [270, 190],
        [190, 220],
        [235, 150],
        [120, 180],
        [240, 280],
      ].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="9" ry="6" fill="#c97716" opacity="0.5" />
      ))}

      {PEPPERONI.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x + 3} cy={y + 6} rx="27" ry="25" fill="#5a2a08" opacity="0.3" />
          <circle cx={x} cy={y} r="26" fill="url(#sp-pep)" />
          <circle cx={x} cy={y} r="22" fill="none" stroke="#6e100b" strokeOpacity="0.5" strokeWidth="2" />
          <circle cx={x - 8} cy={y - 7} r="3.2" fill="#f7b79a" opacity="0.65" />
          <circle cx={x + 7} cy={y + 4} r="2.6" fill="#f7b79a" opacity="0.55" />
          <circle cx={x - 3} cy={y + 10} r="2.2" fill="#f7b79a" opacity="0.5" />
          <circle cx={x + 9} cy={y - 10} r="2" fill="#f7b79a" opacity="0.5" />
        </g>
      ))}

      {MUSHROOMS.map(([x, y, rot], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
          <ellipse cx="2" cy="6" rx="22" ry="14" fill="#5a2a08" opacity="0.28" />
          <path
            d="M-20 4C-20 -16 20 -16 20 4C20 10 11 11 7 11L7 22C7 27 -7 27 -7 22L-7 11C-11 11 -20 10 -20 4Z"
            fill="#f1e4cd"
            stroke="#c2aa82"
            strokeWidth="2"
          />
          <path d="M-14 0C-12 -9 12 -9 14 0" fill="none" stroke="#fff9ea" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        </g>
      ))}

      {OLIVES.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x + 2} cy={y + 3} r="11" fill="#5a2a08" opacity="0.25" />
          <circle cx={x} cy={y} r="9" fill="none" stroke="#2b1a17" strokeWidth="5" />
          <circle cx={x - 3} cy={y - 3} r="1.6" fill="#7a625c" />
        </g>
      ))}

      {BASIL.map(([x, y, rot], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
          <path d="M0 -18C16 -13 18 9 0 20C-18 9 -16 -13 0 -18Z" fill="#43a043" stroke="#2c7a2c" strokeWidth="1.5" />
          <path d="M0 -16L0 18" stroke="#2c7a2c" strokeWidth="1.6" />
          <path d="M0 -4L8 -9M0 4L9 0M0 -4L-8 -9M0 4L-9 0" stroke="#2c7a2c" strokeWidth="1.2" fill="none" />
          <path d="M-5 -9C-2 -14 6 -12 6 -6" fill="none" stroke="#9be08b" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}

export function PizzaGloss() {
  return (
    <svg viewBox="0 0 400 400" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="sp-gloss" cx="30%" cy="22%" r="62%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sp-rim" cx="50%" cy="50%" r="50%">
          <stop offset="0.9" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#3b1503" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="178" fill="url(#sp-gloss)" />
      <circle cx="200" cy="200" r="178" fill="url(#sp-rim)" />
    </svg>
  );
}

export function Tomato() {
  const uid = useUid();
  const gid = `sp-tom${uid}`;
  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full" aria-hidden>
      <defs>
        <radialGradient id={gid} cx="36%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ff6a55" />
          <stop offset="0.6" stopColor="#d9261b" />
          <stop offset="1" stopColor="#8e130c" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="94" rx="30" ry="5" fill="#000" opacity="0.25" />
      <path d="M50 18C80 12 96 36 92 58C88 82 66 92 50 92C34 92 12 82 8 58C4 36 20 12 50 18Z" fill={`url(#${gid})`} />
      <path d="M50 22L40 8L50 14L60 6L58 20L72 18L56 28Z" fill="#3f9a3c" stroke="#2a6e29" strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="32" cy="38" rx="9" ry="14" transform="rotate(25 32 38)" fill="#fff" opacity="0.38" />
    </svg>
  );
}

export function BasilLeaf() {
  const uid = useUid();
  const gid = `sp-leaf${uid}`;
  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6cc35f" />
          <stop offset="1" stopColor="#2f8a2f" />
        </linearGradient>
      </defs>
      <path d="M50 6C84 18 90 62 50 94C10 62 16 18 50 6Z" fill={`url(#${gid})`} stroke="#23702a" strokeWidth="2.4" />
      <path d="M50 10L50 90" stroke="#23702a" strokeWidth="2.6" />
      <path d="M50 34L70 22M50 52L74 40M50 70L68 60M50 34L30 22M50 52L26 40M50 70L32 60" stroke="#23702a" strokeWidth="2" fill="none" />
      <path d="M32 26C38 14 56 12 66 20" fill="none" stroke="#b6f0a8" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function Mushroom() {
  const uid = useUid();
  const gid = `sp-mush${uid}`;
  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full" aria-hidden>
      <defs>
        <radialGradient id={gid} cx="40%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fbf1de" />
          <stop offset="1" stopColor="#d9c29a" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="95" rx="28" ry="4" fill="#000" opacity="0.25" />
      <path d="M8 50C8 18 92 18 92 50C92 58 78 60 68 60L68 82C68 92 32 92 32 82L32 60C22 60 8 58 8 50Z" fill={`url(#${gid})`} stroke="#b79d72" strokeWidth="2.4" />
      <path d="M18 44C22 28 78 28 82 44" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
      <path d="M40 62L40 84M50 62L50 86M60 62L60 84" stroke="#c4aa80" strokeWidth="2" opacity="0.6" />
    </svg>
  );
}

export function Mozzarella() {
  const uid = useUid();
  const gid = `sp-moz${uid}`;
  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full" aria-hidden>
      <defs>
        <radialGradient id={gid} cx="36%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#f7ecd2" />
          <stop offset="1" stopColor="#dcc99c" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="94" rx="30" ry="5" fill="#000" opacity="0.25" />
      <circle cx="50" cy="52" r="40" fill={`url(#${gid})`} />
      <path d="M34 28C42 22 56 22 64 28" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
      <circle cx="66" cy="68" r="4" fill="#dcc99c" opacity="0.5" />
      <circle cx="40" cy="72" r="3" fill="#dcc99c" opacity="0.5" />
    </svg>
  );
}

export function PepperoniSlice() {
  const uid = useUid();
  const gid = `sp-pep2${uid}`;
  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full" aria-hidden>
      <defs>
        <radialGradient id={gid} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ee5a46" />
          <stop offset="0.65" stopColor="#b9271b" />
          <stop offset="1" stopColor="#7a130d" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="95" rx="30" ry="4" fill="#000" opacity="0.25" />
      <circle cx="50" cy="50" r="42" fill={`url(#${gid})`} />
      <circle cx="50" cy="50" r="35" fill="none" stroke="#6e100b" strokeOpacity="0.5" strokeWidth="2.4" />
      <circle cx="36" cy="38" r="4.5" fill="#f7b79a" opacity="0.65" />
      <circle cx="60" cy="56" r="3.6" fill="#f7b79a" opacity="0.55" />
      <circle cx="46" cy="68" r="3" fill="#f7b79a" opacity="0.5" />
      <circle cx="66" cy="34" r="2.8" fill="#f7b79a" opacity="0.5" />
    </svg>
  );
}
