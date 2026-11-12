import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProduct } from "@/lib/repos/products";
import { validatePromotion, incrementPromotionUsage, getPromotionByCode } from "@/lib/repos/promotions";
import {
  createOrder,
  updateOrderPayment,
  updateOrderDestination,
} from "@/lib/repos/orders";
import { getSettings } from "@/lib/repos/settings";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { geocodeAddress } from "@/lib/geocode";
import { approximateZoneCenter } from "@/lib/varna-geo";
import { getCustomerSession } from "@/lib/auth";
import { getOrCreateStripeCustomerId } from "@/lib/stripe-customer";
import { isValidDeliverySlot } from "@/lib/delivery-slots";
import type { OrderItem } from "@/lib/types";
import Stripe from "stripe";

const checkoutSchema = z
  .object({
    customer_name: z.string().max(100).optional(),
    phone: z.string().min(6).max(30),
    email: z.string().email().max(200).optional().or(z.literal("")),
    order_type: z.enum(["delivery", "pickup"]).default("delivery"),
    quarter: z.string().max(100).optional(),
    street: z.string().max(150).optional(),
    house_number: z.string().max(20).optional(),
    intercom: z.string().max(60).optional(),
    address_notes: z.string().max(300).optional(),
    notes: z.string().max(300).optional(),
    promo_code: z.string().max(40).optional(),
    payment_method: z.enum(["cash", "card_on_delivery", "stripe"]),
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
                optionId: z.number().int().positive().optional(),
              })
            )
            .default([]),
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

  const orderItems: OrderItem[] = [];
  let subtotal = 0;
  for (const item of data.items) {
    const product = await getProduct(item.productId);
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

    let components: OrderItem["components"];
    if (product.is_combo && product.combo_items.length > 0) {
      components = [];
      for (const ci of product.combo_items) {
        const compProduct = await getProduct(ci.product_id);
        if (!compProduct) continue;
        const size = ci.size_id ? compProduct.sizes.find((s) => s.id === ci.size_id) : undefined;
        components.push({
          name: compProduct.name,
          sizeLabel: size?.label,
          quantity: ci.quantity,
        });
      }
    }

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
      components,
      is_pizza: Boolean(product.is_pizza),
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

  const customerSession = await getCustomerSession();

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

  sendOrderConfirmationEmail(order, settings).catch((err) => {
    console.error("Order confirmation email failed", err);
  });

  if (promoCode) {
    const promo = await getPromotionByCode(promoCode);
    if (promo) await incrementPromotionUsage(promo.id);
  }

  if (isDelivery) {
    const quarterName = data.quarter?.trim() ?? "";
    geocodeAddress(combinedAddress, quarterName, data.street!.trim())
      .then((geo) => geo ?? approximateZoneCenter(quarterName))
      .then((coords) => updateOrderDestination(order.id, coords.lat, coords.lng))
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
      const stripeCustomerId = customerSession
        ? await getOrCreateStripeCustomerId(stripe, customerSession.customerId)
        : undefined;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
        payment_intent_data: stripeCustomerId
          ? { setup_future_usage: "off_session" }
          : undefined,
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
