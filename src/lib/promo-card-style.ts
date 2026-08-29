// Fixed look for each of the 4 showcase slots — no photo upload, so the
// "cool" factor comes entirely from a distinct gradient + icon per
// position, baked in rather than admin-configurable (keeps the admin form
// down to just the text fields, as requested). Order matches position 1-4.
export const PROMO_CARD_STYLES = [
  { gradient: "from-[#7a2a1c] via-[#4a1811] to-[#2b120c]", icon: "🍕" },
  { gradient: "from-[#8a5a12] via-[#5a3a10] to-[#2b1a08]", icon: "🍔" },
  { gradient: "from-[#7a1f2e] via-[#4a1420] to-[#221012]", icon: "🌯" },
  { gradient: "from-[#1f5a6b] via-[#163a48] to-[#10181f]", icon: "🥤" },
] as const;

export function promoCardStyle(position: number) {
  return PROMO_CARD_STYLES[(position - 1) % PROMO_CARD_STYLES.length];
}
