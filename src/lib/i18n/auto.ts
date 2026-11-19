import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/repos/settings";
import type { Locale } from "@/lib/i18n/dict";

const CYRILLIC = /[Ѐ-ӿ]/;
const BATCH_SIZE = 40;

function hashOf(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

export function needsTranslation(text: string | null | undefined): text is string {
  return typeof text === "string" && text.trim().length > 0 && CYRILLIC.test(text);
}

async function deeplBatch(texts: string[], apiKey: string): Promise<string[] | null> {
  const isFreeKey = apiKey.trim().endsWith(":fx");
  const endpoint = isFreeKey
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: texts,
        source_lang: "BG",
        target_lang: "EN-GB",
        preserve_formatting: true,
      }),
    });
    if (!res.ok) {
      console.error("DeepL batch failed", res.status);
      return null;
    }
    const data = (await res.json()) as { translations?: { text: string }[] };
    const out = data.translations?.map((t) => t.text);
    return out && out.length === texts.length ? out : null;
  } catch (err) {
    console.error("DeepL batch request failed", err);
    return null;
  }
}

export async function translateMany(texts: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [...new Set(texts.filter(needsTranslation).map((t) => t.trim()))];
  if (unique.length === 0) return result;

  const db = await getDb();
  const hashes = new Map(unique.map((t) => [t, hashOf(t)]));

  const cached = new Map<string, string>();
  const hashList = [...hashes.values()];
  for (let i = 0; i < hashList.length; i += 200) {
    const chunk = hashList.slice(i, i + 200);
    const params: Record<string, string> = {};
    const placeholders = chunk.map((h, idx) => {
      params[`h${idx}`] = h;
      return `@h${idx}`;
    });
    const rows = (await db
      .prepare(`SELECT hash, en FROM translations WHERE hash IN (${placeholders.join(",")})`)
      .all(params)) as { hash: string; en: string }[];
    for (const r of rows) cached.set(r.hash, r.en);
  }

  const missing: string[] = [];
  for (const [text, h] of hashes) {
    const hit = cached.get(h);
    if (hit) result.set(text, hit);
    else missing.push(text);
  }
  if (missing.length === 0) return result;

  const settings = await getSettings();
  const apiKey = settings.deepl_api_key?.trim();
  if (!apiKey) return result;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    const translated = await deeplBatch(chunk, apiKey);
    if (!translated) continue;
    for (let j = 0; j < chunk.length; j++) {
      const en = translated[j]?.trim();
      if (!en) continue;
      result.set(chunk[j], en);
      try {
        await db
          .prepare(
            "INSERT INTO translations (hash, source, en) VALUES (@hash, @source, @en) ON CONFLICT (hash) DO NOTHING"
          )
          .run({ hash: hashes.get(chunk[j]), source: chunk[j], en });
      } catch (err) {
        console.error("translation cache write failed", err);
      }
    }
  }
  return result;
}

export function applyTranslation(text: string, map: Map<string, string>): string {
  if (!needsTranslation(text)) return text;
  const trimmed = text.trim();
  const en = map.get(trimmed);
  if (!en) return text;
  const lead = text.match(/^\s*/)?.[0] ?? "";
  const trail = text.match(/\s*$/)?.[0] ?? "";
  return `${lead}${en}${trail}`;
}

export async function translateOne(text: string, locale: Locale): Promise<string> {
  if (locale === "bg" || !needsTranslation(text)) return text;
  const map = await translateMany([text]);
  return applyTranslation(text, map);
}
