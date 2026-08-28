"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Грешка при вход");
      setLoading(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid place-items-center bg-accent-dark px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-surface rounded-2xl p-7 space-y-4 shadow-xl"
      >
        <div className="text-center mb-2">
          <span className="h-12 w-12 rounded-full bg-brand text-white grid place-items-center font-display font-extrabold text-xl mx-auto mb-2">
            D
          </span>
          <h1 className="font-display font-extrabold text-xl">Админ панел</h1>
          <p className="text-sm text-muted">DaniDunner</p>
        </div>
        <input
          type="email"
          required
          placeholder="Имейл"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
        />
        <input
          type="password"
          required
          placeholder="Парола"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
        />
        {error && <p className="text-sm text-brand font-semibold">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-brand text-white rounded-xl py-3 font-bold hover:bg-brand-dark transition-colors disabled:opacity-60"
        >
          {loading ? "Вход..." : "Вход"}
        </button>
      </form>
    </div>
  );
}
