import { listZones } from "@/lib/repos/zones";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Зони за доставка" };

export default async function ZonesPage() {
  const zones = await listZones(true);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display font-extrabold text-3xl mb-2">Зони за доставка</h1>
      <p className="text-foreground/80 mb-8">
        Доставяме само в град Варна. Таксата за доставка и минималната сума на
        поръчката зависят от квартала.
      </p>

      <div className="divide-y divide-border rounded-2xl border border-border bg-surface overflow-hidden">
        {zones.map((z) => (
          <div key={z.id} className="flex items-center justify-between px-5 py-4">
            <span className="font-semibold">{z.name}</span>
            <div className="text-right text-sm">
              <p className="font-bold text-brand">{formatPrice(z.delivery_fee)} доставка</p>
              <p className="text-muted">мин. поръчка {formatPrice(z.min_order)}</p>
            </div>
          </div>
        ))}
        {zones.length === 0 && (
          <p className="text-muted text-center py-10">Няма активни зони в момента.</p>
        )}
      </div>
    </div>
  );
}
