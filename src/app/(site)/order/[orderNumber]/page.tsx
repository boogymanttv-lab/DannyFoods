import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByNumber } from "@/lib/repos/orders";
import { getSettings } from "@/lib/repos/settings";
import { formatPrice } from "@/lib/format";
import { formatRequestedTime } from "@/lib/delivery-slots";
import { OrderTracking } from "@/components/site/OrderTracking";
import type { OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await getOrderByNumber(orderNumber);
  if (!order) notFound();

  const items: OrderItem[] = JSON.parse(order.items_json);
  const isPickup = order.order_type === "pickup";
  const settings = isPickup ? await getSettings() : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <div className="text-center mb-8">
        <span className="text-5xl">✅</span>
        <h1 className="font-display font-extrabold text-2xl mt-3">
          Благодарим Ви за поръчката!
        </h1>
        <p className="text-muted mt-1">
          Номер на поръчка: <span className="font-semibold">{order.order_number}</span>
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        <OrderTracking orderNumber={order.order_number} initialStatus={order.status} />

        <div className="border-t border-border pt-4">
          <p className="font-semibold mb-2">Продукти</p>
          <ul className="space-y-1.5 text-sm">
            {items.map((item, idx) => (
              <li key={idx} className="flex justify-between gap-2">
                <span className="text-muted">
                  {item.quantity}× {item.name}
                  {item.sizeLabel ? ` (${item.sizeLabel})` : ""}
                  {item.removed && item.removed.length > 0 && (
                    <span className="block text-xs">Без: {item.removed.join(", ")}</span>
                  )}
                </span>
                <span className="font-semibold">{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-border pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Междинна сума</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">{isPickup ? "Вземане от място" : "Доставка"}</span>
            <span>{isPickup ? "—" : formatPrice(order.delivery_fee)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-success">
              <span>Отстъпка {order.promo_code ? `(${order.promo_code})` : ""}</span>
              <span>-{formatPrice(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base">
            <span>Общо</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        <div className="border-t border-border pt-4 text-sm space-y-1">
          <p>
            <span className="text-muted">{isPickup ? "Вземане от: " : "Доставка до: "}</span>
            {isPickup
              ? settings?.address || "адреса на място"
              : `${order.address}${order.quarter ? ` — ${order.quarter}` : ""}`}
          </p>
          {!isPickup && order.address_notes && (
            <p>
              <span className="text-muted">Етаж/апартамент: </span>
              {order.address_notes}
            </p>
          )}
          {!isPickup && order.intercom && (
            <p>
              <span className="text-muted">Звънец: </span>
              {order.intercom}
            </p>
          )}
          <p>
            <span className="text-muted">Телефон: </span>
            {order.phone}
          </p>
          <p>
            <span className="text-muted">Час на доставка: </span>
            {order.requested_time ? formatRequestedTime(order.requested_time) : "Възможно най-скоро"}
          </p>
        </div>
      </div>

      <div className="text-center mt-8">
        <Link href="/" className="inline-block bg-brand text-white rounded-xl px-6 py-3 font-bold">
          Обратно към менюто
        </Link>
      </div>
    </div>
  );
}
