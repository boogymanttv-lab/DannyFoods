import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const MAX_WIDTH = 1600;
const WEBP_QUALITY = 82;

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

  const originalBytes = Buffer.from(await file.arrayBuffer());

  let uploadBytes: Buffer = originalBytes;
  let uploadContentType = file.type;
  let ext = file.name.includes(".") ? file.name.split(".").pop()! : "jpg";
  if (file.type !== "image/gif") {
    try {
      uploadBytes = await sharp(originalBytes)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      uploadContentType = "image/webp";
      ext = "webp";
    } catch (err) {
      console.error("Image compression failed, storing original", err);
      uploadBytes = originalBytes;
      uploadContentType = file.type;
    }
  }

  const objectPath = `${randomUUID()}.${ext}`;

  let uploadRes: Response;
  try {
    uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/${BUCKET}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": uploadContentType,
        },
        body: new Uint8Array(uploadBytes),
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
