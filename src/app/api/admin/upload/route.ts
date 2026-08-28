import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

// Uploads an image file (from the admin panel's "Качи снимка" buttons — see
// ImageUploadField.tsx) to Supabase Storage, and returns its public URL.
//
// This route itself is already gated to admins-only by src/proxy.ts (every
// /api/admin/* path requires a valid admin session cookie), so no extra
// auth check is needed here.
//
// Storage is Supabase's, not Vercel's local disk — Vercel's serverless
// functions have no persistent/shared filesystem, so a file saved to disk
// on one request would simply be gone (or invisible to other instances) on
// the next. The bucket ("product-images") must already exist and be public
// — see DEPLOY_GUIDE.md for the one-time SQL to create it.
const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Качването на снимки не е конфигурирано (липсват SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY в environment variables).",
      },
      { status: 500 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Няма прикачен файл" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Разрешени са само изображения (JPEG, PNG, WEBP, GIF)" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файлът е твърде голям (макс. 5MB)" }, { status: 400 });
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const objectPath = `${randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();

  let uploadRes: Response;
  try {
    uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/${BUCKET}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": file.type,
        },
        body: bytes,
      }
    );
  } catch (err) {
    console.error("Supabase Storage upload request failed", err);
    return NextResponse.json(
      { error: "Не успяхме да се свържем със storage услугата. Проверете SUPABASE_URL." },
      { status: 502 }
    );
  }

  if (!uploadRes.ok) {
    const detail = await uploadRes.text().catch(() => "");
    console.error("Supabase Storage upload failed", uploadRes.status, detail);
    return NextResponse.json(
      { error: "Качването не бе успешно. Проверете дали bucket-ът product-images съществува." },
      { status: 502 }
    );
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  return NextResponse.json({ url: publicUrl });
}
