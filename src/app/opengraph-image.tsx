import { ImageResponse } from "next/og";
import { getSettings } from "@/lib/repos/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "DannyFoods";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadLogo(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    if (!/^image\/(png|jpe?g|gif)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function card(name: string, logo: string | null) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          background: "linear-gradient(135deg, #3a0f12 0%, #1f090b 55%, #120708 100%)",
        }}
      >
        {logo && (
          <img
            src={logo}
            width={340}
            height={340}
            alt=""
            style={{ objectFit: "contain", borderRadius: 48 }}
          />
        )}
        <div
          style={{
            display: "flex",
            fontSize: logo ? 112 : 150,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -2,
          }}
        >
          {name}
        </div>
      </div>
    ),
    { ...size }
  );
}

async function toPng(name: string, logo: string | null): Promise<Response> {
  const buf = await card(name, logo).arrayBuffer();
  return new Response(buf, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

export default async function OpengraphImage() {
  const settings = await getSettings();
  const name = settings.site_name;
  const logo = await loadLogo(settings.logo_url);
  try {
    return await toPng(name, logo);
  } catch {
    return await toPng(name, null);
  }
}
