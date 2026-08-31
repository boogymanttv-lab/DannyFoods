// Auto-translates Bulgarian menu/promo text to English via DeepL, called
// server-side when an admin saves a product/category/promo card (see the
// admin API routes). Entirely optional — same pattern as Stripe/Resend
// keys elsewhere: an empty key means the feature is off, and saving still
// works exactly the same either way (the _en column just stays empty,
// which the frontend already treats as "fall back to Bulgarian").
//
// Uses DeepL's free-tier endpoint by default; a paid DeepL key (not ending
// in ":fx") is routed to the paid endpoint automatically, since DeepL
// rejects a paid key against the free URL and vice versa.
export async function translateToEnglish(text: string, apiKey: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || !apiKey) return "";

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
        text: [trimmed],
        source_lang: "BG",
        target_lang: "EN",
      }),
    });
    if (!res.ok) {
      console.error("DeepL translate failed", res.status, await res.text().catch(() => ""));
      return "";
    }
    const data = await res.json();
    return data?.translations?.[0]?.text ?? "";
  } catch (err) {
    console.error("DeepL translate request failed", err);
    return "";
  }
}

// Translates name + description together. Re-translates on every save
// rather than caching/skipping — there's no admin UI yet to manually
// override a specific English field (a deliberate phase-1 scope cut, see
// project notes), so the only source of truth for the Bulgarian text is
// whatever was just saved, and the English side should always track it.
// A blank/missing DeepL key or a translation failure just yields "" —
// callers already treat that as "not translated yet" and fall back to the
// Bulgarian text on the customer-facing English site.
export async function autoTranslateFields(
  fields: { name: string; description?: string },
  apiKey: string
): Promise<{ name_en: string; description_en: string }> {
  if (!apiKey) return { name_en: "", description_en: "" };
  const [name_en, description_en] = await Promise.all([
    translateToEnglish(fields.name, apiKey),
    fields.description ? translateToEnglish(fields.description, apiKey) : Promise.resolve(""),
  ]);
  return { name_en, description_en };
}
