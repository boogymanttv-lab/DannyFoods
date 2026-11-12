import { zoneCenterOrNull } from "@/lib/varna-geo";

export type GeocodeResult = { lat: number; lng: number };

const VARNA_VIEWBOX = "27.78,43.32,28.05,43.10";

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
      let body = "";
      try {
        body = (await res.text()).slice(0, 300);
      } catch {
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

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function hasCyrillic(s: string): boolean {
  return /[Ѐ-ӿ]/.test(s);
}
function hasLatinLetters(s: string): boolean {
  return /[a-zA-Z]/.test(s);
}

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
    out += LATIN_TO_CYRILLIC_SINGLE[ch] ?? ch;
    i += 1;
  }
  return out;
}

function normalizeScript(text: string): { value: string; converted: boolean } {
  if (!hasLatinLetters(text) || hasCyrillic(text)) return { value: text, converted: false };
  return { value: transliterateLatinToCyrillic(text), converted: true };
}

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

function normalizeStreetWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,№]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .filter((w) => !["улица", "булевард", "квартал"].includes(w));
}

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

  const streetMatch = streetWords.length > 0 ? data.find((r) => roadMatches(r, streetWords)) : undefined;

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

const MAX_PLAUSIBLE_KM = 4;

export async function geocodeAddress(
  rawAddress: string,
  neighborhoodHint?: string,
  rawStreetText?: string
): Promise<GeocodeResult | null> {
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
  const streetForMatch = streetText ?? address;

  if (zoneCenter) {
    const tight = await runQuery(
      `${address}, Варна, България`,
      tightViewbox(zoneCenter.lat, zoneCenter.lng)
    );
    if (tight === null) {
    } else if (tight.length === 0) {
      console.error(
        `[geocode] Zone-boxed Nominatim search returned zero candidates for "${address}" inside the "${neighborhoodHint ?? "unknown"}" zone box — trying a wider city-wide search next.`
      );
    } else {
      const result = pickBest(tight, { neighborhoodHint, near, streetText: streetForMatch });
      if (result) {
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

  const plain = await runQuery(`${address}, Варна, България`, VARNA_VIEWBOX);
  if (!plain) {
    console.error(
      `[geocode] Both the zone-boxed and city-wide Nominatim searches failed for "${address}" (hint: ${neighborhoodHint ?? "none"}) — falling back to the zone's approximate center. See the request-level [geocode] error above for why.`
    );
    return null;
  }
  if (plain.length === 0) {
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
