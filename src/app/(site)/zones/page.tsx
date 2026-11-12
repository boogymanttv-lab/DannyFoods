import { getSettings } from "@/lib/repos/settings";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Зони за доставка" };

export default async function ZonesPage() {
  const settings = await getSettings();
  const deliveryFee = Number(settings.delivery_fee_flat || "0");
  const freeOver = Number(settings.free_delivery_over || "0");
  const minOrder = Number(settings.min_order_global || "0");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display font-extrabold text-3xl mb-2">Зони за доставка</h1>
      <p className="text-foreground/80 mb-8">
        Доставяме в целия град Варна — таксата за доставка и минималната сума на
        поръчката са едни и същи навсякъде в града, без значение от квартала.
      </p>

      <div className="divide-y divide-border rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="font-semibold">Такса за доставка</span>
          <span className="font-bold text-brand">{formatPrice(deliveryFee)}</span>
        </div>
        {freeOver > 0 && (
          <div className="flex items-center justify-between px-5 py-4">
            <span className="font-semibold">Безплатна доставка над</span>
            <span className="font-bold text-brand">{formatPrice(freeOver)}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-5 py-4">
          <span className="font-semibold">Минимална поръчка</span>
          <span className="font-bold text-brand">{formatPrice(minOrder)}</span>
        </div>
      </div>

      <p className="text-muted text-sm mt-6">
        Предпочитате да вземете поръчката си лично? На финалната стъпка на
        поръчката може да изберете &quot;Вземи на място&quot; вместо доставка.
      </p>
    </div>
  );
}
