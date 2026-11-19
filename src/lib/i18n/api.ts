import { NextResponse } from "next/server";
import { getLocale } from "@/lib/i18n/locale";
import { translateOne } from "@/lib/i18n/auto";

export async function errJson(message: string, status = 400, extra?: Record<string, unknown>) {
  const locale = await getLocale();
  const error = await translateOne(message, locale);
  return NextResponse.json({ error, ...extra }, { status });
}
