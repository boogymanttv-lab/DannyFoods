"use client";

import { useRef, useState } from "react";

const CLIENT_MAX_WIDTH = 1600;
const CLIENT_JPEG_QUALITY = 0.85;

async function compressImageClientSide(file: File): Promise<File> {
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, CLIENT_MAX_WIDTH / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", CLIENT_JPEG_QUALITY)
    );
    if (!blob) return file;
    if (blob.size >= file.size) return file;
    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    console.error("Client-side image compression failed, uploading original", err);
    return file;
  }
}

export function ImageUploadField({
  value,
  onChange,
  placeholder = "URL на снимка (по желание)",
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploadFile = await compressImageClientSide(file);
      const formData = new FormData();
      formData.append("file", uploadFile);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      if (res.status === 413) {
        setError("Снимката е твърде голяма дори след компресия. Опитайте с друга снимка.");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Качването не бе успешно.");
        return;
      }
      onChange(data.url);
    } catch {
      setError("Грешка при качване. Опитайте отново.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-border px-3.5 py-2.5 text-sm min-w-0"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 rounded-xl border border-border px-3.5 py-2.5 text-sm font-semibold hover:bg-black/5 transition-colors disabled:opacity-50"
        >
          {uploading ? "Качва се..." : "📷 Качи снимка"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" />
      )}
    </div>
  );
}
