import { getLocale } from "@/lib/i18n/locale";
import { translateOne } from "@/lib/i18n/auto";

export async function localizedTitle(bg: string): Promise<{ title: string }> {
  return { title: await translateOne(bg, await getLocale()) };
}
