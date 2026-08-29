// Fixed background per showcase slot — a distinct gradient + fallback icon,
// used whenever a card has no uploaded photo (and, on the homepage's wide
// desktop cards, always used as the background — the photo there is just a
// small corner accent, not a full-bleed image). Order matches position 1-4.
export const PROMO_CARD_STYLES = [
  { gradient: "from-[#7a2a1c] via-[#4a1811] to-[#2b120c]", icon: "🍕" },
  { gradient: "from-[#8a5a12] via-[#5a3a10] to-[#2b1a08]", icon: "🍔" },
  { gradient: "from-[#7a1f2e] via-[#4a1420] to-[#221012]", icon: "🌯" },
  { gradient: "from-[#1f5a6b] via-[#163a48] to-[#10181f]", icon: "🥤" },
] as const;

export function promoCardStyle(position: number) {
  return PROMO_CARD_STYLES[(position - 1) % PROMO_CARD_STYLES.length];
}
