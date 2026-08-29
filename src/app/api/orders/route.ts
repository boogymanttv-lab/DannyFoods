import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProduct } from "@/lib/repos/products";
import { validatePromotion, incrementPromotionUsage, getPromotionByCode } from "@/lib/repos/promotions";
import {
  createOrder,
  updateOrderPayment,
  updateOrderDestination,
  updateOrderEstimate,
  countActiveOrders,
} from "@/lib/repos/orders";
import { getSettings } from "@/lib/repos/settings";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { geocodeAddress } from "@/lib/geocode";
import { approximateZoneCenter } from "@/lib/varna-geo";
import { getCustomerSession } from "@/lib/auth";
import { isValidDeliverySlot } from "@/lib/delivery-slots";
import {
  combineEstimates,
  parseBusyHours,
  suggestByLoad,
  suggestEstimate,
} from "@/lib/delivery-estimate";
import type { OrderItem } from "@/lib/types";
import Stripe from "stripe";

const checkoutSchema = z
  .object({
    // Only phone is truly required to get an order to someone — a name is
    // nice to have (and used to greet the customer) but not essential, so
    // it falls back to a placeholder when left blank.
    customer_name: z.string().max(100).optional(),
    phone: z.string().min(6).max(30),
    // Optional — powers the Resend order confirmation email when present.
    // No email at all (a guest who left it blank) just means no email gets
    // sent; everything else about the order works the same.
    email: z.string().email().max(200).optional().or(z.literal("")),
    // "delivery" needs the address fields below; "pickup" needs none of
    // them — the customer collects the order in person.
    order_type: z.enum(["delivery", "pickup"]).default("delivery"),
    // Free-typed neighborhood name — replaces the old zone_id dropdown.
    // Only meaningful (and required) for delivery orders.
    quarter: z.string().max(100).optional(),
    // Split so the geocoder only ever sees a clean "street + number" — no
    // floor/apartment/intercom text mixed in, which used to sometimes end up
    // inside the old single free-text "address" field and confuse the map.
    street: z.string().max(150).optional(),
    house_number: z.string().max(20).optional(),
    intercom: z.string().max(60).optional(),
    address_notes: z.string().max(300).optional(),
    notes: z.string().max(300).optional(),
    promo_code: z.string().max(40).optional(),
    payment_method: z.enum(["cash", "card_on_delivery", "stripe"]),
    // "YYYY-MM-DD HH:MM" — a specific slot the customer picked at checkout;
    // omitted entirely means "as soon as possible".
    requested_time: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    items: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          sizeId: z.number().int().positive().optional(),
          extras: z
            .array(
              z.object({
                id: z.number().int().positive(),
                // Set when the customer picked one of that extra's weight/
                // quantity variants (see ExtraOption) instead of its plain
                // flat price.
                optionId: z.number().int().positive().optional(),
              })
            )
            .default([]),
          // Ingredients (parsed client-side from the product's description)
          // the customer unchecked in "Без —" — purely a kitchen/courier
          // note, no effect on price.
          removed: z.array(z.string().max(80)).max(30).optional(),
          quantity: z.number().int().min(1).max(30),
        })
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    if (data.order_type !== "delivery") return;
    if (!data.quarter || !data.quarter.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quarter"], message: "Изберете квартал" });
    }
    if (!data.street || !data.street.trim() || data.street.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["street"], message: "Въведете улица" });
    }
    if (!data.house_number || !data.house_number.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["house_number"], message: "Въведете номер" });
    }
  });

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалидни данни в заявката", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Recompute prices server-side from the DB — never trust client-sent prices.
  const orderItems: OrderItem[] = [];
  let subtotal = 0;
  for (const item of data.items) {
    const product = await getProduct(item.productId);
    // Combo products created from a promo card are intentionally
    // `active = 0` — that's what keeps them out of the normal
    // category-browsed menu — but a customer can still have one in
    // their cart via the card's own "add to cart" button, so an
    // inactive combo must still be allowed through here. Only a
    // genuinely inactive, non-combo product gets rejected.
    if (!product || (!product.active && !product.is_combo)) {
      return NextResponse.json(
        { error: `Продукт с ID ${item.productId} не е наличен` },
        { status: 400 }
      );
    }
    let unitPrice = product.base_price;
    let sizeLabel: string | undefined;
    if (item.sizeId) {
      const size = product.sizes.find((s) => s.id === item.sizeId);
      if (!size) {
        return NextResponse.json({ error: "Невалиден размер" }, { status: 400 });
      }
      unitPrice += size.price_delta;
      sizeLabel = size.label;
    }
    // Recompute each selected extra's price server-side too — for one with
    // weight/quantity variants (options), the picked option's own price is
    // what counts, never the extra's plain base price or anything sent by
    // the client. Anything that doesn't resolve (unknown extra/option id)
    // is silently dropped, same permissive behavior as before this feature.
    // id/optionId are kept alongside name/price (not just for display) so
    // "Поръчай отново" can later rebuild this exact cart line without
    // re-matching extras by their display name text.
    const extras: { name: string; price: number; id?: number; optionId?: number }[] = [];
    for (const sel of item.extras) {
      const extra = product.extras.find((e) => e.id === sel.id);
      if (!extra) continue;
      if (sel.optionId != null) {
        const option = extra.options.find((o) => o.id === sel.optionId);
        if (!option) continue;
        extras.push({ name: `${extra.name} (${option.label})`, price: option.price, id: extra.id, optionId: option.id });
      } else {
        extras.push({ name: extra.name, price: extra.price, id: extra.id });
      }
    }
    const extrasTotal = extras.reduce((s, e) => s + e.price, 0);
    const lineTotal = (unitPrice + extrasTotal) * item.quantity;
    subtotal += lineTotal;
    orderItems.push({
      productId: product.id,
      name: product.name,
      sizeLabel,
      sizeId: item.sizeId,
      unitPrice,
      quantity: item.quantity,
      extras,
      removed: item.removed && item.removed.length > 0 ? item.removed : undefined,
      lineTotal: Math.round(lineTotal * 100) / 100,
    });
  }
  subtotal = Math.round(subtotal * 100) / 100;

  const settings = await getSettings();

  const minOrderGlobal = Number(settings.min_order_global || "0");
  if (minOrderGlobal > 0 && subtotal < minOrderGlobal) {
    return NextResponse.json(
      { error: `Минималната поръчка е ${minOrderGlobal.toFixed(2)} €` },
      { status: 400 }
    );
  }

  if (data.requested_time) {
    const [reqDate, reqTime] = data.requested_time.split(" ");
    if (!isValidDeliverySlot(reqDate, reqTime, new Date(), settings.opening_time, settings.closing_time)) {
      return NextResponse.json(
        { error: "Невалиден или вече отминал час за доставка" },
        { status: 400 }
      );
    }
  }

  // Flat delivery fee under the free-delivery threshold, waived above it —
  // no delivery fee at all for pickup orders, obviously.
  const freeDeliveryOver = Number(settings.free_delivery_over || "0");
  const flatDeliveryFee = Number(settings.delivery_fee_flat || "0");
  let deliveryFee = 0;
  if (data.order_type === "delivery") {
    deliveryFee =
      freeDeliveryOver > 0 && subtotal >= freeDeliveryOver ? 0 : flatDeliveryFee;
  }

  let discount = 0;
  let promoCode: string | null = null;
  if (data.promo_code) {
    const result = await validatePromotion(data.promo_code, subtotal);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    discount = result.discount;
    promoCode = result.promotion.code;
  }

  const total = Math.max(0, Math.round((subtotal + deliveryFee - discount) * 100) / 100);

  // Attach the order to the customer's account when they're logged in
  // (guests — the vast majority of the checkout flow — just get null here,
  // exactly as before) so it shows up in their order history.
  const customerSession = await getCustomerSession();

  // "address" stays as one combined human-readable string for display (order
  // confirmation, admin panel, courier app) — but it's always built from just
  // street + number, never from address_notes/intercom, so what shows up
  // there matches what gets geocoded below. Pickup orders have no delivery
  // address at all — the customer collects the order in person.
  const isDelivery = data.order_type === "delivery";
  const combinedAddress = isDelivery
    ? `${data.street!.trim()} ${data.house_number!.trim()}`.trim()
    : "Взимане от място";
  const customerName = data.customer_name?.trim() || "Клиент";

  const order = await createOrder({
    customer_name: customerName,
    phone: data.phone,
    zone_id: null,
    quarter: isDelivery ? data.quarter?.trim() : "",
    order_type: data.order_type,
    address: combinedAddress,
    street: isDelivery ? data.street!.trim() : "",
    house_number: isDelivery ? data.house_number!.trim() : "",
    intercom: isDelivery ? data.intercom?.trim() : "",
    address_notes: isDelivery ? data.address_notes : "",
    items: orderItems,
    subtotal,
    delivery_fee: deliveryFee,
    discount,
    total,
    promo_code: promoCode,
    payment_method: data.payment_method,
    notes: data.notes,
    customer_id: customerSession?.customerId ?? null,
    requested_time: data.requested_time ?? null,
    email: data.email ?? "",
  });

  // Fire-and-forget — a slow or failing email provider should never delay
  // or break the checkout response; sendOrderConfirmationEmail already
  // no-ops silently when there's no address or no Resend key configured.
  sendOrderConfirmationEmail(order, settings).catch((err) => {
    console.error("Order confirmation email failed", err);
  });

  if (promoCode) {
    const promo = await getPromotionByCode(promoCode);
    if (promo) await incrementPromotionUsage(promo.id);
  }

  // Give the customer an estimate — and a running countdown ring — right
  // away instead of leaving it blank until an admin opens the order and
  // manually picks one. Uses the same "busy hours" + "current load" signals
  // the admin panel suggests from; the admin can still override it later,
  // which re-stamps the countdown from that moment.
  const busyRules = parseBusyHours(settings.busy_hours_json);
  const autoEstimate = combineEstimates(
    suggestEstimate(busyRules),
    suggestByLoad(await countActiveOrders())
  );
  await updateOrderEstimate(order.id, autoEstimate);

  // Geocode the delivery address in the background so checkout doesn't wait
  // on an external service — the tracking map picks up the destination pin
  // as soon as it resolves (usually within a second or two). If the address
  // can't be geocoded (bad/unusual address text, or the server has no
  // outbound internet access to the free geocoding service), fall back to
  // an approximate center point for the neighborhood instead of leaving the
  // destination blank — the tracking map should always show a destination,
  // even if it's only approximate. Pickup orders have nowhere to deliver to,
  // so there's nothing to geocode.
  if (isDelivery) {
    const quarterName = data.quarter?.trim() ?? "";
    geocodeAddress(combinedAddress, quarterName, data.street!.trim())
      .then((geo) => geo ?? approximateZoneCenter(quarterName))
      .then((coords) => updateOrderDestination(order.id, coords.lat, coords.lng))
      // updateOrderDestination is async — its promise is returned and chained above,
      // so the outer .catch still captures any rejection from it.
      .catch((err) => {
        console.error("Failed to set order destination point", err);
      });
  }

  if (data.payment_method === "stripe") {
    if (!settings.stripe_secret_key) {
      return NextResponse.json(
        {
          error:
            "Картовото плащане онлайн все още не е конфигурирано. Моля, изберете наложен платеж.",
        },
        { status: 400 }
      );
    }
    try {
      const stripe = new Stripe(settings.stripe_secret_key);
      const origin = req.nextUrl.origin;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              unit_amount: Math.round(total * 100),
              product_data: { name: `Поръчка ${order.order_number} — ${settings.site_name}` },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/order/${order.order_number}?paid=1`,
        cancel_url: `${origin}/checkout?cancelled=1`,
        metadata: { order_number: order.order_number },
      });
      await updateOrderPayment(order.id, { stripe_session_id: session.id });
      return NextResponse.json({ orderNumber: order.order_number, redirectUrl: session.url });
    } catch (err) {
      console.error("Stripe error", err);
      return NextResponse.json(
        { error: "Грешка при създаване на плащане. Опитайте отново." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ orderNumber: order.order_number, redirectUrl: `/order/${order.order_number}` });
}
