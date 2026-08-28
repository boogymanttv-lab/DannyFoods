import { NextRequest, NextResponse } from "next/server";
import { getCourierSession } from "@/lib/auth";
import { updateOrderStatusByCourier } from "@/lib/repos/orders";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCourierSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (status !== "delivering" && status !== "delivered") {
    return NextResponse.json({ error: "Невалиден статус" }, { status: 400 });
  }
  const ok = await updateOrderStatusByCourier(Number(id), session.courierId, status);
  if (!ok) {
    return NextResponse.json({ error: "Тази поръчка не е ваша" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
