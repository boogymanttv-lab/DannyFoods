import { NextResponse } from "next/server";
import { getSettings } from "@/lib/repos/settings";

export const dynamic = "force-dynamic";

// Icon for the courier app and its notifications — always the site's
// current logo (set in Настройки), so nothing needs re-uploading here.
export async function GET(req: Request) {
  const settings = await getSettings();
  const logo = settings.logo_url;
  if (!logo) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(new URL(logo, req.url), {
    status: 302,
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
