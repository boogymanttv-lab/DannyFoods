"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

const NAV = [
  { href: "/admin", label: "Табло", icon: "📊", exact: true },
  { href: "/admin/orders", label: "Поръчки", icon: "🧾" },
  { href: "/admin/couriers", label: "Куриери", icon: "🛵" },
  { href: "/admin/products", label: "Продукти и меню", icon: "🍕" },
  { href: "/admin/promotions", label: "Промоции", icon: "🏷️" },
  { href: "/admin/showcase", label: "Витрина на началния екран", icon: "🖼️" },
  { href: "/admin/zones", label: "Зони за доставка", icon: "🗺️" },
  { href: "/admin/settings", label: "Настройки", icon: "⚙️" },
];

export function AdminShell({
  adminName,
  children,
}: {
  adminName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const navItems = NAV.map((item) => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={clsx(
          "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
          active ? "bg-brand text-white" : "text-white/70 hover:bg-white/10"
        )}
      >
        <span>{item.icon}</span>
        {item.label}
      </Link>
    );
  });

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr] min-h-screen">
      <aside className="hidden lg:flex flex-col bg-accent-dark text-white p-4 gap-1 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <span className="h-9 w-9 rounded-full bg-brand grid place-items-center font-display font-extrabold">
            D
          </span>
          <span className="font-display font-extrabold">DannyFoods</span>
        </div>
        {navItems}
        <div className="mt-auto pt-4 border-t border-white/10">
          <p className="px-3.5 text-xs text-white/50 mb-2">Влезли като {adminName}</p>
          <button
            onClick={logout}
            className="w-full text-left rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/10"
          >
            🚪 Изход
          </button>
        </div>
      </aside>

      <div className="lg:hidden sticky top-0 z-40 bg-accent-dark text-white flex items-center justify-between px-4 py-3">
        <span className="font-display font-extrabold">DannyFoods Админ</span>
        <button onClick={() => setMobileOpen((v) => !v)} className="text-2xl leading-none">
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>
      {mobileOpen && (
        <div className="lg:hidden bg-accent-dark text-white p-4 space-y-1">
          {navItems}
          <button
            onClick={logout}
            className="w-full text-left rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/10"
          >
            🚪 Изход
          </button>
        </div>
      )}

      <main className="p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">{children}</main>
    </div>
  );
}
