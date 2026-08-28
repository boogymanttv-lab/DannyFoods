"use client";

import { useState } from "react";

// Small client-side control for the admin report export — the customer
// deliverable is a CSV (opens directly in Excel/Google Sheets/LibreOffice,
// no extra library to install), the actual generation happens server-side
// in /api/admin/orders/export. Clicking the download link just navigates
// there with the chosen date range as query params; the browser handles the
// file download itself because of the response's Content-Disposition header.
export function ReportExport() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const href = `/api/admin/orders/export?${params.toString()}`;

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
      <h2 className="font-semibold">Справка за поръчките</h2>
      <p className="text-xs text-muted">
        Избери период и свали таблица (CSV — отваря се директно в Excel) с всички поръчки за отчет.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted block mb-1">От дата</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">До дата</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm"
          />
        </div>
        <a
          href={href}
          className="bg-brand text-white rounded-xl px-4 py-2.5 font-semibold text-sm whitespace-nowrap"
        >
          ⬇ Свали справка (CSV)
        </a>
      </div>
    </div>
  );
}
