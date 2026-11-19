"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleProvider";

export function AccountRegisterForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/account/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("auth.registerError"));
      setLoading(false);
      return;
    }
    router.push(data.isAdmin ? "/admin" : redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        required
        placeholder={t("auth.namePh")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
      />
      <input
        placeholder={t("auth.phoneOptPh")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
      />
      <input
        type="email"
        required
        placeholder={t("auth.emailPh")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
      />
      <input
        type="password"
        required
        minLength={6}
        placeholder={t("auth.passwordMinPh")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm"
      />
      {error && <p className="text-sm text-brand font-semibold">{error}</p>}
      <button
        disabled={loading}
        className="w-full bg-brand text-white rounded-xl py-3 font-bold hover:bg-brand-dark transition-colors disabled:opacity-60"
      >
        {loading ? t("auth.registering") : t("auth.register")}
      </button>
    </form>
  );
}
