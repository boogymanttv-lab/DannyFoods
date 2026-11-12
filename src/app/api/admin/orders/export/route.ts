import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "@/lib/repos/orders";
import { listZones } from "@/lib/repos/zones";
import { listCouriers } from "@/lib/repos/couriers";
import type { OrderItem, OrderStatus } from "@/lib/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Приета",
  confirmed: "Потвърдена",
  preparing: "Приготвя се",
  delivering: "На път е",
  delivered: "Доставена",
  cancelled: "Отказана",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наложен платеж (в брой)",
  card_on_delivery: "Наложен платеж (карта на куриера)",
  stripe: "Картово плащане онлайн",
};

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

const UTF8_BOM = "﻿";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const status = (searchParams.get("status") as OrderStatus | null) || undefined;

  const orders = await listOrders({ dateFrom: from, dateTo: to, status: status ?? undefined });
  const zones = await listZones(false);
  const couriers = await listCouriers(false);

  const header = [
    "Номер",
    "Дата и час",
    "Клиент",
    "Телефон",
    "Зона",
    "Адрес",
    "Продукти",
    "Междинна сума",
    "Доставка",
    "Отстъпка",
    "Общо",
    "Плащане",
    "Статус",
    "Куриер",
    "Промо код",
    "Бележки",
  ];

  const rows = orders.map((o) => {
    let itemsText = "";
    try {
      const items: OrderItem[] = JSON.parse(o.items_json);
      itemsText = items
        .map((it) => {
          const extras = it.extras.length > 0 ? ` + ${it.extras.map((e) => e.name).join(", ")}` : "";
          const removed =
            it.removed && it.removed.length > 0 ? ` (Без: ${it.removed.join(", ")})` : "";
          return `${it.quantity}× ${it.name}${it.sizeLabel ? ` (${it.sizeLabel})` : ""}${extras}${removed}`;
        })
        .join("; ");
    } catch {
      itemsText = "";
    }
    const zoneName = zones.find((z) => z.id === o.zone_id)?.name ?? "";
    const courierName = o.courier_id ? couriers.find((c) => c.id === o.courier_id)?.name ?? "" : "";

    return [
      o.order_number,
      new Date(o.created_at).toLocaleString("bg-BG"),
      o.customer_name,
      o.phone,
      zoneName,
      o.address,
      itemsText,
      o.subtotal.toFixed(2),
      o.delivery_fee.toFixed(2),
      o.discount.toFixed(2),
      o.total.toFixed(2),
      PAYMENT_LABELS[o.payment_method] ?? o.payment_method,
      STATUS_LABELS[o.status] ?? o.status,
      courierName,
      o.promo_code ?? "",
      o.notes ?? "",
    ];
  });

  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  const csv = UTF8_BOM + lines.join("\r\n");

  const rangeLabel = from || to ? `_${from ?? "start"}_to_${to ?? "today"}` : "";
  const filename = `poruchki${rangeLabel}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
