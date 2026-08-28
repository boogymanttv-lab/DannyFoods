import { NextRequest, NextResponse } from "next/server";
import { getCourierSession } from "@/lib/auth";
import { claimOrder } from "@/lib/repos/orders";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCourierSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await claimOrder(Number(id), session.courierId);
  if (!ok) {
    return NextResponse.json(
      { error: "Тази поръчка вече е взета от друг куриер" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
