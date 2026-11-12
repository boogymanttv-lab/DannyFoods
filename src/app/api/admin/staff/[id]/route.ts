import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { updateAdminPassword, updateStaff, deleteStaff } from "@/lib/repos/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { password, ...rest } = body;
  if (Object.keys(rest).length > 0) {
    await updateStaff(Number(id), rest);
  }
  if (password) {
    const password_hash = await bcrypt.hash(password, 10);
    await updateAdminPassword(Number(id), password_hash);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteStaff(Number(id));
  return NextResponse.json({ ok: true });
}
