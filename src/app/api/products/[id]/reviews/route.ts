import { NextRequest, NextResponse } from "next/server";
import { errJson } from "@/lib/i18n/api";
import { z } from "zod";
import { getCustomerSession } from "@/lib/auth";
import {
  listReviewsForProduct,
  getRatingSummary,
  customerHasOrderedProduct,
  getCustomerReview,
  upsertReview,
} from "@/lib/repos/reviews";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = Number(id);
  const [reviews, summary] = await Promise.all([
    listReviewsForProduct(productId),
    getRatingSummary(productId),
  ]);

  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ reviews, ...summary, canReview: false, myReview: null });
  }
  const [{ ordered }, myReview] = await Promise.all([
    customerHasOrderedProduct(session.customerId, productId),
    getCustomerReview(session.customerId, productId),
  ]);
  return NextResponse.json({ reviews, ...summary, canReview: ordered, myReview: myReview ?? null });
}

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCustomerSession();
  if (!session) {
    return await errJson("Неоторизиран достъп", 401);
  }
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    return await errJson("Невалиден продукт", 400);
  }

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return await errJson("Невалидни данни за отзива", 400);
  }

  const { ordered, orderId } = await customerHasOrderedProduct(session.customerId, productId);
  if (!ordered) {
    return await errJson("Можете да оставите отзив само за продукт, който сте поръчвали", 403);
  }

  await upsertReview({
    productId,
    customerId: session.customerId,
    orderId,
    rating: parsed.data.rating,
    comment: parsed.data.comment?.trim() ?? "",
  });

  return NextResponse.json({ ok: true });
}
