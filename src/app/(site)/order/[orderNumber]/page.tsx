import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByNumber } from "@/lib/repos/orders";
import { getSettings } from "@/lib/repos/settings";
import { getCustomerSession } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { formatRequestedTime } from "@/lib/delivery-slots";
import { OrderTracking } from "@/components/site/OrderTracking";
import { OrderReviewPrompt } from "@/components/site/OrderReviewPrompt";
import { getLocale } from "@/lib/i18n/locale";
import { translate, type DictKey } from "@/lib/i18n/dict";
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
  const locale = await getLocale();
  const t = (key: DictKey) => translate(locale, key);

  const items: OrderItem[] = JSON.parse(order.items_json);
  const isPickup = order.order_type === "pickup";
  const settings = isPickup ? await getSettings() : null;

  // The review prompt only makes sense once the order actually arrived,
  // and only for the customer it belongs to — a guest order (no
  // customer_id) has no account to check a review against, so it's
  // simply not offered here (matches the "account holders only" scope of
  // the automatic post-delivery reminder email).
  const session = order.customer_id ? await getCustomerSession() : null;
  const isOwnAccount = Boolean(order.customer_id && session?.customerId === order.customer_id);
  const showReviewPrompt = order.status === "delivered" && order.customer_id != null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <div className="text-center mb-8">
        <span className="text-5xl">✅</span>
        <h1 className="font-display font-extrabold text-2xl mt-3">{t("order.thankYou")}</h1>
        <p className="text-muted mt-1">
          {t("order.number")}: <span className="font-semibold">{order.order_number}</span>
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        <OrderTracking orderNumber={order.order_number} initialStatus={order.status} />

        <div className="border-t border-border pt-4">
          <p className="font-semibold mb-2">{t("order.products")}</p>
          <ul className="space-y-1.5 text-sm">
            {items.map((item, idx) => (
              <li key={idx} className="flex justify-between gap-2">
                <span className="text-muted">
                  {item.quantity}× {item.name}
                  {item.sizeLabel ? ` (${item.sizeLabel})` : ""}
                  {item.removed && item.removed.length > 0 && (
                    <span className="block text-xs">{t("order.without")}: {item.removed.join(", ")}</span>
                  )}
                </span>
                <span className="font-semibold">{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </div>

        {showReviewPrompt &&
          (isOwnAccount ? (
            <OrderReviewPrompt
              items={items.map((i) => ({ productId: i.productId, name: i.name }))}
            />
          ) : (
            <div id="review" className="border-t border-border pt-4">
              <p className="text-sm text-muted">
                <Link
                  href={`/account/login?redirect=${encodeURIComponent(`/order/${order.order_number}#review`)}`}
                  className="text-brand font-semibold"
                >
                  {t("order.loginToReview")}
                </Link>
                {t("order.loginToReviewSuffix")}
              </p>
            </div>
          ))}

        <div className="border-t border-border pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">{t("order.subtotal")}</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">{isPickup ? t("order.pickupFromPlace") : t("order.deliveryOrPickup")}</span>
            <span>{isPickup ? "—" : formatPrice(order.delivery_fee)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-success">
              <span>{t("order.discount")} {order.promo_code ? `(${order.promo_code})` : ""}</span>
              <span>-{formatPrice(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base">
            <span>{t("order.total")}</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        <div className="border-t border-border pt-4 text-sm space-y-1">
          <p>
            <span className="text-muted">{isPickup ? t("order.pickupFromColon") : t("order.deliveryToColon")}</span>
            {isPickup
              ? settings?.address || t("order.onSitePickupFallback")
              : `${order.address}${order.quarter ? ` — ${order.quarter}` : ""}`}
          </p>
          {!isPickup && order.address_notes && (
            <p>
              <span className="text-muted">{t("order.floorApt")}</span>
              {order.address_notes}
            </p>
          )}
          {!isPickup && order.intercom && (
            <p>
              <span className="text-muted">{t("order.intercom")}</span>
              {order.intercom}
            </p>
          )}
          <p>
            <span className="text-muted">{t("order.phone")}</span>
            {order.phone}
          </p>
          <p>
            <span className="text-muted">{t("order.deliveryTimeColon")}</span>
            {order.requested_time ? formatRequestedTime(order.requested_time) : t("order.asap")}
          </p>
        </div>
      </div>

      <div className="text-center mt-8">
        <Link href="/" className="inline-block bg-brand text-white rounded-xl px-6 py-3 font-bold">
          {t("order.backToMenu")}
        </Link>
      </div>
    </div>
  );
}
