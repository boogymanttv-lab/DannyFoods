import { NextResponse } from "next/server";
import { getSettings } from "@/lib/repos/settings";

export const dynamic = "force-dynamic";

// Lets couriers "Add to Home Screen" the courier panel as its own app.
// On iPhone this is required for notifications to work at all.
export async function GET() {
  const settings = await getSettings();
  const name = `${settings.site_name || "Dany Foods"} · Куриер`;
  return NextResponse.json(
    {
      name,
      short_name: "Куриер",
      start_url: "/courier",
      scope: "/courier",
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: "#e11d2e",
      icons: [
        { src: "/courier-icon", sizes: "192x192", purpose: "any" },
        { src: "/courier-icon", sizes: "512x512", purpose: "any" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
