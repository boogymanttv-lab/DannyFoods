"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountLoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/account/login", {
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
    router.push(data.isAdmin ? "/admin" : redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
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
  );
}
