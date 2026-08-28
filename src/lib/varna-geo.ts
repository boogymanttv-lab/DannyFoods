// Approximate center coordinates for Varna's neighborhoods, used as a
// fallback destination point whenever precise address geocoding isn't
// available — e.g. the server has no outbound internet access to the free
// geocoding service, or the address text just doesn't match anything. This
// guarantees the customer's tracking map ALWAYS has a destination point and
// a route line to show, never just the courier alone.

export const VARNA_CENTER = { lat: 43.2141, lng: 27.9147 };

// Covers every quarter/neighborhood commonly used to describe an address in
// Varna (compiled from the city's administrative district breakdown), not
// just the handful originally seeded as delivery zones. Coordinates are
// deliberately approximate — they only need to land the geocoder's search
// box in roughly the right part of the city; the actual street-level
// precision comes from the live OpenStreetMap lookup in geocode.ts, which
// falls back to a city-wide search if this rougher box doesn't turn up
// anything. If a pin still looks off for a specific quarter, its center
// here can be nudged — this list isn't meant to be the last word on it.
const ZONE_KEYWORDS: { keyword: string; lat: number; lng: number }[] = [
  { keyword: "център", lat: 43.2141, lng: 27.9147 },
  { keyword: "чайка", lat: 43.2075, lng: 27.935 },
  { keyword: "морска градина", lat: 43.2075, lng: 27.935 },
  { keyword: "владислав варненчик", lat: 43.236, lng: 27.87 },
  { keyword: "младост", lat: 43.198, lng: 27.88 },
  { keyword: "възраждане", lat: 43.205, lng: 27.895 },
  { keyword: "аспарухово", lat: 43.18, lng: 27.91 },
  { keyword: "виница", lat: 43.22, lng: 27.96 },
  { keyword: "галата", lat: 43.17, lng: 27.935 },
  // Corrected — this used to point to a spot near "Западна промишлена
  // зона" on the far west side of the city, which is wrong: жк "Васил
  // Левски" is actually in Район Приморски, bordering Цветен квартал,
  // Чайка and Бриз (confirmed via public sources — e.g. "ул. Д-р Анастасия
  // Железкова" is officially listed as being in жк Васил Левски). That's
  // what was causing every "Левски" order to geocode into the wrong part
  // of town even when the street match itself was correct.
  { keyword: "левски", lat: 43.216, lng: 27.918 },
  { keyword: "западна промишлена", lat: 43.23, lng: 27.85 },
  { keyword: "тракия", lat: 43.222, lng: 27.925 },
  { keyword: "изгрев", lat: 43.228, lng: 27.928 },
  { keyword: "бриз", lat: 43.212, lng: 27.94 },
  { keyword: "владиславово", lat: 43.183, lng: 27.905 },
  { keyword: "победа", lat: 43.183, lng: 27.895 },
  { keyword: "христо ботев", lat: 43.2, lng: 27.905 },
  { keyword: "свети никола", lat: 43.24, lng: 27.93 },
  { keyword: "кайсиева градина", lat: 43.232, lng: 27.865 },
  { keyword: "максуда", lat: 43.213, lng: 27.9 },
  { keyword: "гръцка махала", lat: 43.209, lng: 27.917 },
  { keyword: "пчелина", lat: 43.2, lng: 27.885 },
  { keyword: "автогара", lat: 43.2, lng: 27.9 },
  { keyword: "трошево", lat: 43.28, lng: 27.83 },
  { keyword: "свети иван рилски", lat: 43.195, lng: 27.87 },
  { keyword: "цветен квартал", lat: 43.225, lng: 27.933 },
  { keyword: "евксиноград", lat: 43.25, lng: 27.94 },
];

// The canonical set of Varna neighborhoods this site knows about — used to
// make sure every one of them exists as a delivery zone (see the migration
// in db.ts), so customers can find their actual quarter in the dropdown
// instead of picking the closest-sounding one. Anything already seeded
// under a different label (e.g. "Морска градина / Кв. Чайка" for "Чайка")
// is intentionally left out here to avoid creating a near-duplicate zone —
// an admin can always rename/merge/add zones from the Zones panel.
export const VARNA_NEW_NEIGHBORHOODS = [
  "Тракия",
  "Изгрев",
  "Бриз",
  "Владиславово",
  "Победа",
  "Христо Ботев",
  "Свети Никола",
  "Кайсиева градина",
  "Максуда",
  "Гръцка махала",
  "Пчелина",
  "Автогара",
  "Трошево",
  "Свети Иван Рилски",
  "Цветен квартал",
  "Евксиноград",
];

// Strict lookup — returns undefined when the zone name doesn't match any
// known neighborhood keyword, instead of silently defaulting to the city
// center. Used by the geocoder to decide whether it actually knows where to
// spatially bias the search; guessing "city center" for an unrecognized zone
// name would just as often push a real match out of a too-tight box.
export function zoneCenterOrNull(
  zoneName: string | null | undefined
): { lat: number; lng: number } | undefined {
  if (!zoneName) return undefined;
  const normalized = zoneName.toLowerCase();
  for (const z of ZONE_KEYWORDS) {
    if (normalized.includes(z.keyword)) return { lat: z.lat, lng: z.lng };
  }
  return undefined;
}

export function approximateZoneCenter(zoneName: string | null | undefined): {
  lat: number;
  lng: number;
} {
  return zoneCenterOrNull(zoneName) ?? VARNA_CENTER;
}
