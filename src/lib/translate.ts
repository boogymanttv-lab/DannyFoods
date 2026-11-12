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
