import { Resend } from "resend";
import type { Order, OrderItem } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { applyTranslation, translateMany } from "@/lib/i18n/auto";

type MailSettings = { resend_api_key: string; notification_from_email: string; site_name: string };

const MAIL_TEXT = {
  bg: {
    thanks: (name: string) => `Благодарим за поръчката, ${name}!`,
    orderNumber: "Номер на поръчка:",
    subtotal: "Междинна сума",
    pickup: "Вземане от място",
    delivery: "Доставка",
    discount: "Отстъпка",
    total: "Общо",
    pickupNote: "Ще вземете поръчката си на място.",
    deliveryTo: "Доставка на:",
    without: "Без:",
    subject: (n: string, site: string) => `Поръчка ${n} — ${site}`,
    reviewHeading: (n: string) => `Как мина поръчка ${n}?`,
    reviewHello: (name: string) => `Здравей, ${name}! Дай ни бърза оценка — отнема секунди.`,
    reviewButton: "Остави отзив",
    reviewSubject: (n: string, site: string) => `Как мина поръчка ${n}? — ${site}`,
  },
  en: {
    thanks: (name: string) => `Thank you for your order, ${name}!`,
    orderNumber: "Order number:",
    subtotal: "Subtotal",
    pickup: "Pickup",
    delivery: "Delivery",
    discount: "Discount",
    total: "Total",
    pickupNote: "You will pick up your order in person.",
    deliveryTo: "Delivery to:",
    without: "Without:",
    subject: (n: string, site: string) => `Order ${n} — ${site}`,
    reviewHeading: (n: string) => `How was order ${n}?`,
    reviewHello: (name: string) => `Hi ${name}! Give us a quick rating — it only takes a few seconds.`,
    reviewButton: "Leave a review",
    reviewSubject: (n: string, site: string) => `How was order ${n}? — ${site}`,
  },
} as const;

function mailLocale(order: Order): "bg" | "en" {
  return order.locale === "en" ? "en" : "bg";
}

export async function sendOrderConfirmationEmail(
  order: Order,
  settings: MailSettings
): Promise<void> {
  const to = order.email?.trim();
  if (!to || !settings.resend_api_key) return;

  try {
    const resend = new Resend(settings.resend_api_key);
    const locale = mailLocale(order);
    const m = MAIL_TEXT[locale];
    const items: OrderItem[] = JSON.parse(order.items_json);
    const isPickup = order.order_type === "pickup";

    let tr = (s: string) => s;
    if (locale === "en") {
      const strings: string[] = [];
      for (const item of items) {
        strings.push(item.name, item.sizeLabel ?? "");
        for (const e of item.extras) strings.push(e.name);
        for (const r of item.removed ?? []) strings.push(r);
      }
      const map = await translateMany(strings);
      tr = (s: string) => applyTranslation(s, map);
    }

    const itemsHtml = items
      .map((item) => {
        const extras = item.extras.map((e) => tr(e.name)).join(", ");
        const removed =
          item.removed && item.removed.length > 0
            ? `${m.without} ${item.removed.map(tr).join(", ")}`
            : "";
        return `<tr>
          <td style="padding:6px 0;">${item.quantity}× ${tr(item.name)}${item.sizeLabel ? ` (${tr(item.sizeLabel)})` : ""}
            ${extras ? `<br><span style="color:#7a6f68;font-size:12px;">+ ${extras}</span>` : ""}
            ${removed ? `<br><span style="color:#e11d2e;font-size:12px;">${removed}</span>` : ""}
          </td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">${formatPrice(item.lineTotal)}</td>
        </tr>`;
      })
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#201a17;">
        <h2 style="color:#e11d2e;">${m.thanks(order.customer_name)}</h2>
        <p>${m.orderNumber} <strong>${order.order_number}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          ${itemsHtml}
        </table>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #ece3da;padding-top:8px;">
          <tr><td>${m.subtotal}</td><td style="text-align:right;">${formatPrice(order.subtotal)}</td></tr>
          <tr><td>${isPickup ? m.pickup : m.delivery}</td><td style="text-align:right;">${isPickup ? "—" : formatPrice(order.delivery_fee)}</td></tr>
          ${order.discount > 0 ? `<tr><td>${m.discount}</td><td style="text-align:right;">-${formatPrice(order.discount)}</td></tr>` : ""}
          <tr style="font-weight:bold;"><td>${m.total}</td><td style="text-align:right;">${formatPrice(order.total)}</td></tr>
        </table>
        <p style="color:#7a6f68;font-size:13px;">
          ${isPickup ? m.pickupNote : `${m.deliveryTo} ${order.address}${order.quarter ? ` — ${order.quarter}` : ""}`}
        </p>
      </div>
    `;

    await resend.emails.send({
      from: settings.notification_from_email,
      to,
      subject: m.subject(order.order_number, settings.site_name),
      html,
    });
  } catch (err) {
    console.error("Failed to send order confirmation email", err);
  }
}

export async function sendReviewReminderEmail(
  order: Order,
  settings: MailSettings,
  siteUrl: string
): Promise<boolean> {
  const to = order.email?.trim();
  if (!to || !settings.resend_api_key) return false;

  try {
    const resend = new Resend(settings.resend_api_key);
    const m = MAIL_TEXT[mailLocale(order)];
    const reviewUrl = `${siteUrl.replace(/\/$/, "")}/order/${order.order_number}#review`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#201a17;">
        <h2 style="color:#e11d2e;">${m.reviewHeading(order.order_number)}</h2>
        <p>${m.reviewHello(order.customer_name)}</p>
        <p style="margin:24px 0;">
          <a href="${reviewUrl}" style="background:#e11d2e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:bold;display:inline-block;">
            ${m.reviewButton}
          </a>
        </p>
        <p style="color:#7a6f68;font-size:13px;">${settings.site_name}</p>
      </div>
    `;

    await resend.emails.send({
      from: settings.notification_from_email,
      to,
      subject: m.reviewSubject(order.order_number, settings.site_name),
      html,
    });
    return true;
  } catch (err) {
    console.error("Failed to send review reminder email", err);
    return false;
  }
}
