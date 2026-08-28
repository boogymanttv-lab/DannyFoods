import Link from "next/link";
import { getOrderStats, listOrders } from "@/lib/repos/orders";
import { formatPrice } from "@/lib/format";
import { ReportExport } from "@/components/admin/ReportExport";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  new: "Приета",
  confirmed: "Потвърдена",
  preparing: "Приготвя се",
  delivering: "На път е",
  delivered: "Доставена",
  cancelled: "Отказана",
};

export default async function AdminDashboardPage() {
  const stats = await getOrderStats();
  const recentOrders = await listOrders({ limit: 8 });

  return (
    <div className="space-y-8">
      <h1 className="font-display font-extrabold text-2xl">Табло</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Поръчки днес" value={String(stats.todayOrders)} />
        <StatCard label="Приход днес" value={formatPrice(stats.todayRevenue)} />
        <StatCard label="Активни поръчки" value={String(stats.activeOrders)} />
        <StatCard label="Общо поръчки" value={String(stats.totalOrders)} />
      </div>

      <ReportExport />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="bg-surface rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Последни поръчки</h2>
            <Link href="/admin/orders" className="text-sm text-brand font-semibold">
              Виж всички →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="pb-2 pr-3">№</th>
                  <th className="pb-2 pr-3">Клиент</th>
                  <th className="pb-2 pr-3">Сума</th>
                  <th className="pb-2">Статус</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-medium">{o.order_number}</td>
                    <td className="py-2 pr-3">{o.customer_name}</td>
                    <td className="py-2 pr-3 font-semibold">{formatPrice(o.total)}</td>
                    <td className="py-2">
                      <span className="text-xs bg-brand/10 text-brand font-semibold px-2 py-1 rounded-full">
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted">
                      Все още няма поръчки.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="font-semibold mb-4">Топ продукти</h2>
          <ul className="space-y-2">
            {stats.topProducts.map((p) => (
              <li key={p.name} className="flex justify-between text-sm">
                <span>{p.name}</span>
                <span className="font-semibold">{p.qty}×</span>
              </li>
            ))}
            {stats.topProducts.length === 0 && (
              <p className="text-sm text-muted">Няма данни все още.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display font-extrabold text-2xl mt-1">{value}</p>
    </div>
  );
}
