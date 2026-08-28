"use client";

import { useRef, useState } from "react";

// A "URL text input" + "Качи снимка" file button, side by side — either
// paste an existing image URL directly, or upload a file from your
// computer and its Supabase Storage URL gets filled in automatically.
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
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
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
