// Turns a delivery address into map coordinates using OpenStreetMap's free
// Nominatim geocoding service — no API key required. Used so the customer's
// live tracking map can show a destination pin and a route line, not just
// the courier's position.
//
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires a descriptive User-Agent and asks for at most ~1 request/second —
// both are fine for a single small delivery business's order volume.

import { zoneCenterOrNull } from "@/lib/varna-geo";

export type GeocodeResult = { lat: number; lng: number };

// Roughly encloses the city of Varna (left, top, right, bottom = min-lon,
// max-lat, max-lon, min-lat). Passed as a *bounded* box so Nominatim only
// considers matches inside Varna — this was the main cause of pins landing
// somewhere else entirely (a street name that also exists in another
// Bulgarian town), not bad house-number precision.
const VARNA_VIEWBOX = "27.78,43.32,28.05,43.10";

// A small box (~1.6km around a point) used to bias the search toward a
// specific *neighborhood* within Varna — free-text hints like appending
// "Левски" to the query aren't reliable because Nominatim treats the whole
// string as fuzzy text and can match an unrelated street that happens to
// share the name (e.g. "Left ski" streets named after Vasil Levski exist
// all over Bulgaria, including in other Varna districts) instead of using
// it to narrow the search area. A tight bounding box, by contrast, makes
// Nominatim only look at candidates physically inside that neighborhood.
function tightViewbox(lat: number, lng: number): string {
  const dLat = 0.016;
  const dLng = 0.02;
  return `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`;
}

type NominatimResult = {
  lat: string;
  lon: string;
  address?: Record<string, string>;
};

async function runQuery(query: string, viewbox: string): Promise<NominatimResult[] | null> {
  const params = new URLSearchParams({
    format: "json",
    limit: "5",
    q: query,
    countrycodes: "bg",
    viewbox,
    bounded: "1",
    addressdetails: "1",
  });
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "DannyFoods-DeliverySite/1.0 (order address geocoding)",
        "Accept-Language": "bg",
      },
    });
    if (!res.ok) {
      // Logged (not swallowed) because a silent failure here is exactly
      // what makes every order in a zone land on the same fallback pin —
      // from the outside that looks like "the map always shows the same
      // spot", when really every geocode call is failing the same way
      // (rate-limited, blocked, DNS/network issue on the host, etc.) and
      // falling back to the zone's fixed approximate center every time.
      // Check this log to see the actual reason.
      let body = "";
      try {
        body = (await res.text()).slice(0, 300);
      } catch {
        // ignore — body isn't essential, the status already tells us plenty
      }
      console.error(
        `[geocode] Nominatim returned ${res.status} ${res.statusText} for query "${query}". Body: ${body}`
      );
      return null;
    }
    const data = (await res.json()) as NominatimResult[];
    return Array.isArray(data) ? data : null;
  } catch (err) {
    console.error(`[geocode] Request to Nominatim failed for query "${query}":`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Straight-line distance in km between two lat/lng points (haversine) — used
// to prefer whichever candidate result actually lands closest to the
// delivery zone's neighborhood, when several look equally plausible.
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// --- Latin-script input ------------------------------------------------
// OpenStreetMap's Bulgarian street data is entered in Cyrillic. A customer
// who types their address in Latin letters (common on phones with an
// English keyboard, or for foreign customers) would otherwise never match
// anything — so we detect that case and convert to an approximate Cyrillic
// spelling before searching. Reverse transliteration is inherently a bit
// lossy (a few Latin letters can map to more than one Cyrillic letter), but
// getting *close* is far better than not searching in the right alphabet at
// all.
function hasCyrillic(s: string): boolean {
  return /[Ѐ-ӿ]/.test(s);
}
function hasLatinLetters(s: string): boolean {
  return /[a-zA-Z]/.test(s);
}

// Longest-match-first digraphs/trigraphs, then single letters. Based on the
// common informal way Bulgarians type their own language in Latin (not the
// official transliteration standard, which maps "ъ" the same as "а" and so
// can't be reversed unambiguously) — this favours the spellings people
// actually type over strict round-trip correctness.
const LATIN_TO_CYRILLIC_MULTI: [string, string][] = [
  ["sht", "щ"],
  ["yo", "ьо"],
  ["zh", "ж"],
  ["ch", "ч"],
  ["sh", "ш"],
  ["ya", "я"],
  ["ju", "ю"],
  ["ja", "я"],
  ["yu", "ю"],
  ["ts", "ц"],
  ["kh", "х"],
];
const LATIN_TO_CYRILLIC_SINGLE: Record<string, string> = {
  a: "а",
  b: "б",
  v: "в",
  g: "г",
  d: "д",
  e: "е",
  z: "з",
  i: "и",
  y: "й",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  f: "ф",
  h: "х",
  c: "ц",
  j: "ж",
  w: "в",
  q: "к",
  x: "кс",
};

function transliterateLatinToCyrillic(text: string): string {
  const lower = text.toLowerCase();
  let out = "";
  let i = 0;
  outer: while (i < lower.length) {
    for (const [latin, cyr] of LATIN_TO_CYRILLIC_MULTI) {
      if (lower.startsWith(latin, i)) {
        out += cyr;
        i += latin.length;
        continue outer;
      }
    }
    const ch = lower[i];
    out += LATIN_TO_CYRILLIC_SINGLE[ch] ?? ch; // digits, punctuation, spaces pass through
    i += 1;
  }
  return out;
}

// Only converts strings that look purely Latin-typed Bulgarian (no Cyrillic
// already present) — an address already in Cyrillic is left untouched.
function normalizeScript(text: string): { value: string; converted: boolean } {
  if (!hasLatinLetters(text) || hasCyrillic(text)) return { value: text, converted: false };
  return { value: transliterateLatinToCyrillic(text), converted: true };
}

// --- Common Cyrillic misspellings ---------------------------------------
// Bulgarian's unstressed vowels are often written the way they sound rather
// than how they're spelled (e.g. "Желязкова" typed as "Железкова" — the
// unstressed "я" reduces toward an "e" sound in speech). This generates a
// bounded set of single-substitution variants for the most commonly
// confused letter pairs, tried as a last resort when the exact spelling the
// customer typed finds nothing at all.
const CONFUSABLE_PAIRS: [string, string][] = [
  ["я", "е"],
  ["е", "и"],
  ["о", "а"],
  ["ъ", "а"],
  ["й", "и"],
];

function commonMisspellingVariants(word: string, maxVariants = 12): string[] {
  const variants = new Set<string>();
  const lower = word.toLowerCase();
  for (const [a, b] of CONFUSABLE_PAIRS) {
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as [string, string][]) {
      for (let idx = 0; idx < lower.length; idx++) {
        if (lower[idx] !== from) continue;
        const variant = lower.slice(0, idx) + to + lower.slice(idx + 1);
        if (variant !== lower) variants.add(variant);
        if (variants.size >= maxVariants) return Array.from(variants);
      }
    }
  }
  return Array.from(variants);
}

// Strips common Bulgarian street-type prefixes/titles and punctuation so the
// customer's typed street name can be compared against OSM's `address.road`
// field — e.g. "ул. Д-р Анастасия Железкова" and "Анастасия Железкова"
// should be recognized as the same street.
function normalizeStreetWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,№]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4) // drop short particles/titles (ул, бул, д-р, жк...)
    .filter((w) => !["улица", "булевард", "квартал"].includes(w));
}

// True when the candidate's own road name shares at least one meaningful
// word with the street the customer actually typed. This is the strongest
// possible signal that a result is the right *street*, not just somewhere
// inside the right neighborhood — distance-to-zone-center alone can't tell
// two different streets in the same quarter apart.
function roadMatches(r: NominatimResult, streetWords: string[]): boolean {
  const road = r.address?.road?.toLowerCase();
  if (!road || streetWords.length === 0) return false;
  return streetWords.some((w) => road.includes(w));
}

function pickBest(
  data: NominatimResult[],
  opts?: { neighborhoodHint?: string; near?: { lat: number; lng: number }; streetText?: string }
): GeocodeResult | null {
  if (data.length === 0) return null;
  const hint = opts?.neighborhoodHint?.toLowerCase();
  const streetWords = opts?.streetText ? normalizeStreetWords(opts.streetText) : [];

  // Strongest signal: a candidate whose OSM road name actually matches what
  // the customer typed. Without this check, a messy/unusual street name can
  // return several unrelated fuzzy candidates from Nominatim, and the old
  // logic below would confidently pick whichever one is geographically
  // closest to the zone center — even if none of them is the real street.
  const streetMatch = streetWords.length > 0 ? data.find((r) => roadMatches(r, streetWords)) : undefined;

  // Prefer a hit whose neighbourhood/suburb/city_district matches the
  // delivery zone the customer picked (e.g. "Левски") — when OSM does tag it,
  // this is the most reliable signal.
  const hintMatch = hint
    ? data.find((r) => {
        const fields = [
          r.address?.suburb,
          r.address?.city_district,
          r.address?.neighbourhood,
          r.address?.quarter,
        ];
        return fields.some((f) => f && f.toLowerCase().includes(hint));
      })
    : undefined;

  // Otherwise, if we know roughly where the zone is, prefer whichever
  // candidate is physically closest to it — much more reliable than trying
  // to match district names in free text, since Varna's informal quarter
  // names aren't consistently tagged in OSM's address data.
  let nearest: NominatimResult | undefined;
  if (!streetMatch && !hintMatch && opts?.near) {
    const near = opts.near;
    let bestDist = Infinity;
    for (const r of data) {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
      const d = distanceKm({ lat, lng }, near);
      if (d < bestDist) {
        bestDist = d;
        nearest = r;
      }
    }
  }

  const best =
    streetMatch ??
    hintMatch ??
    nearest ??
    data.find((r) => {
      const place = (r.address?.city ?? r.address?.town ?? r.address?.village ?? "").toLowerCase();
      return place.includes("варна") || place.includes("varna");
    }) ??
    data[0];

  const lat = parseFloat(best.lat);
  const lng = parseFloat(best.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

// If we know roughly where the selected quarter is, a geocoded pin that
// lands further than this from it is treated as untrustworthy rather than
// shown — Nominatim's city-wide fallback search can occasionally match an
// unrelated street/place that just happens to rank first for a messy or
// unusual query, and a "precise-looking" pin in the wrong part of the city
// is worse than an approximate one that's at least in the right
// neighborhood. Varna's quarters are roughly 3-4km across, so this is loose
// enough to allow normal street-level offsets within (or just past) the
// selected quarter's edge while still catching a wrong-district match.
const MAX_PLAUSIBLE_KM = 4;

// `neighborhoodHint` is the delivery zone's name (e.g. "Левски",
// "Възраждане"). The main disambiguation signal is spatial: we look up the
// zone's approximate center (varna-geo.ts) and search inside a tight
// ~1.6km box around it first, so Nominatim only sees candidates physically
// in that part of the city — a street name search alone regularly resolves
// to the wrong district otherwise. If that tight search finds nothing, we
// widen to the whole city, still preferring whichever result lands closest
// to the zone's center — but only trust that widened result if it's
// actually close enough to be believable; otherwise we return null so the
// caller falls back to the zone's approximate center instead of a wrong pin.
export async function geocodeAddress(
  rawAddress: string,
  neighborhoodHint?: string,
  rawStreetText?: string
): Promise<GeocodeResult | null> {
  // Convert Latin-typed input to an approximate Cyrillic spelling up front —
  // OSM's Bulgarian street data is Cyrillic-only, so a Latin query almost
  // never matches anything.
  const addressNorm = normalizeScript(rawAddress);
  const streetNorm = rawStreetText !== undefined ? normalizeScript(rawStreetText) : undefined;
  const address = addressNorm.value;
  const streetText = streetNorm?.value ?? (addressNorm.converted ? address : rawStreetText);
  if (addressNorm.converted) {
    console.error(
      `[geocode] "${rawAddress}" looked Latin-typed — converted to "${address}" before searching (approximate; Latin-to-Cyrillic transliteration isn't always exact).`
    );
  }

  const zoneCenter = zoneCenterOrNull(neighborhoodHint);
  const near = zoneCenter;
  // Defaults to the full address string when the caller doesn't separately
  // pass the street part — still useful for matching, just slightly noisier
  // since it may include the house number and city name too.
  const streetForMatch = streetText ?? address;

  if (zoneCenter) {
    const tight = await runQuery(
      `${address}, Варна, България`,
      tightViewbox(zoneCenter.lat, zoneCenter.lng)
    );
    if (tight === null) {
      // A real request failure was already logged inside runQuery(); no
      // need to repeat it here.
    } else if (tight.length === 0) {
      console.error(
        `[geocode] Zone-boxed Nominatim search returned zero candidates for "${address}" inside the "${neighborhoodHint ?? "unknown"}" zone box — trying a wider city-wide search next.`
      );
    } else {
      const result = pickBest(tight, { neighborhoodHint, near, streetText: streetForMatch });
      if (result) {
        // Even inside the zone box, a messy/unusual street name can make
        // Nominatim return candidates for an unrelated nearby street —
        // pickBest now checks the road name first, but if it still had to
        // fall back to "just the nearest candidate", log it so a
        // consistently-visible-but-wrong pin has a paper trail instead of
        // looking like a silent success every time.
        const matched = tight.some((r) => roadMatches(r, normalizeStreetWords(streetForMatch)));
        if (!matched) {
          console.error(
            `[geocode] No candidate's OSM road name matched "${streetForMatch}" inside the "${neighborhoodHint ?? "unknown"}" zone box — used the geographically-nearest candidate instead, which may be the wrong street. Nominatim likely has no/poor data for this exact street.`
          );
        }
        return result;
      }
    }
  }

  // Fall back to a city-wide search (or if the tight search came back
  // empty) — the order still works fine without a perfectly precise pin,
  // so it's better to get an approximate match than none, as long as it's
  // plausible.
  const plain = await runQuery(`${address}, Варна, България`, VARNA_VIEWBOX);
  if (!plain) {
    console.error(
      `[geocode] Both the zone-boxed and city-wide Nominatim searches failed for "${address}" (hint: ${neighborhoodHint ?? "none"}) — falling back to the zone's approximate center. See the request-level [geocode] error above for why.`
    );
    return null;
  }
  if (plain.length === 0) {
    // Nominatim genuinely has no match at all for "<street> <number>, Варна"
    // — this is common for smaller Bulgarian streets/house numbers that
    // simply aren't mapped in OpenStreetMap yet. Try again with just the
    // street name (no house number, no "Варна, България" repeated in case
    // that's confusing the parser) — Nominatim frequently knows a street
    // exists even when it has no data for individual house numbers on it,
    // which still gets us a pin on the right street instead of just the
    // zone's generic center point.
    console.error(
      `[geocode] City-wide Nominatim search also returned zero candidates for "${address}" (hint: ${neighborhoodHint ?? "none"}) — retrying with just the street name, dropping the house number.`
    );
    if (streetText && streetText.trim() && streetText.trim() !== address.trim()) {
      const streetOnly = await runQuery(`${streetText.trim()}, Варна, България`, VARNA_VIEWBOX);
      if (streetOnly && streetOnly.length > 0) {
        const streetResult = pickBest(streetOnly, { neighborhoodHint, near, streetText: streetForMatch });
        if (streetResult && (!near || distanceKm(streetResult, near) <= MAX_PLAUSIBLE_KM)) {
          console.error(
            `[geocode] Street-only retry succeeded for "${streetText}" — using that street's location (house-number-level precision isn't available for this address in OpenStreetMap).`
          );
          return streetResult;
        }
      }
      console.error(
        `[geocode] Street-only retry for "${streetText}" also found nothing usable — trying common misspelling variants next.`
      );

      // Last resort: Bulgarian's unstressed vowels are often typed the way
      // they sound rather than how the street is officially spelled (e.g.
      // "Железкова" for the actual "Желязкова") — try a bounded set of
      // single-letter-swap variants before giving up entirely.
      const variants = commonMisspellingVariants(streetText.trim());
      for (const variant of variants) {
        const variantResult = await runQuery(`${variant}, Варна, България`, VARNA_VIEWBOX);
        if (!variantResult || variantResult.length === 0) continue;
        const picked = pickBest(variantResult, { neighborhoodHint, near, streetText: variant });
        if (picked && (!near || distanceKm(picked, near) <= MAX_PLAUSIBLE_KM)) {
          console.error(
            `[geocode] Misspelling-variant retry found a match using "${variant}" instead of "${streetText}" — using it (double-check the street's real spelling if this keeps happening).`
          );
          return picked;
        }
      }
      console.error(
        `[geocode] No misspelling variant of "${streetText}" found anything either — falling back to the zone's approximate center.`
      );
    }
    return null;
  }
  const result = pickBest(plain, { neighborhoodHint, near, streetText: streetForMatch });
  if (result && near && distanceKm(result, near) > MAX_PLAUSIBLE_KM) {
    console.error(
      `[geocode] Best city-wide match for "${address}" (hint: ${neighborhoodHint ?? "none"}) was ${distanceKm(result, near).toFixed(1)}km from the zone center — too far to trust, falling back to the zone's approximate center instead.`
    );
    return null;
  }
  return result;
}
