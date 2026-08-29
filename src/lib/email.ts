import { Resend } from "resend";
import type { Order, OrderItem } from "@/lib/types";
import { formatPrice } from "@/lib/format";

// Order confirmation email via Resend — entirely optional. Both the API key
// and the "from" address live in site_settings (configured in Настройки),
// same pattern as the Stripe keys: an empty key means the feature is off
// and checkout proceeds exactly the same either way. Never throws — a
// failed or skipped send should never take down order creation.
export async function sendOrderConfirmationEmail(
  order: Order,
  settings: { resend_api_key: string; notification_from_email: string; site_name: string }
): Promise<void> {
  const to = order.email?.trim();
  if (!to || !settings.resend_api_key) return;

  try {
    const resend = new Resend(settings.resend_api_key);
    const items: OrderItem[] = JSON.parse(order.items_json);
    const isPickup = order.order_type === "pickup";

    const itemsHtml = items
      .map((item) => {
        const extras = item.extras.map((e) => e.name).join(", ");
        const removed = item.removed && item.removed.length > 0 ? `Без: ${item.removed.join(", ")}` : "";
        return `<tr>
          <td style="padding:6px 0;">${item.quantity}× ${item.name}${item.sizeLabel ? ` (${item.sizeLabel})` : ""}
            ${extras ? `<br><span style="color:#7a6f68;font-size:12px;">+ ${extras}</span>` : ""}
            ${removed ? `<br><span style="color:#e11d2e;font-size:12px;">${removed}</span>` : ""}
          </td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">${formatPrice(item.lineTotal)}</td>
        </tr>`;
      })
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#201a17;">
        <h2 style="color:#e11d2e;">Благодарим за поръчката, ${order.customer_name}!</h2>
        <p>Номер на поръчка: <strong>${order.order_number}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          ${itemsHtml}
        </table>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #ece3da;padding-top:8px;">
          <tr><td>Междинна сума</td><td style="text-align:right;">${formatPrice(order.subtotal)}</td></tr>
          <tr><td>${isPickup ? "Вземане от място" : "Доставка"}</td><td style="text-align:right;">${isPickup ? "—" : formatPrice(order.delivery_fee)}</td></tr>
          ${order.discount > 0 ? `<tr><td>Отстъпка</td><td style="text-align:right;">-${formatPrice(order.discount)}</td></tr>` : ""}
          <tr style="font-weight:bold;"><td>Общо</td><td style="text-align:right;">${formatPrice(order.total)}</td></tr>
        </table>
        <p style="color:#7a6f68;font-size:13px;">
          ${isPickup ? "Ще вземете поръчката си на място." : `Доставка на: ${order.address}${order.quarter ? ` — ${order.quarter}` : ""}`}
        </p>
      </div>
    `;

    await resend.emails.send({
      from: settings.notification_from_email,
      to,
      subject: `Поръчка ${order.order_number} — ${settings.site_name}`,
      html,
    });
  } catch (err) {
    // Never let a failed email (bad key, unverified domain, network issue)
    // affect the order itself — it's already been created successfully.
    console.error("Failed to send order confirmation email", err);
  }
}
