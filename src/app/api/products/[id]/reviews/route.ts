import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerSession } from "@/lib/auth";
import {
  listReviewsForProduct,
  getRatingSummary,
  customerHasOrderedProduct,
  getCustomerReview,
  upsertReview,
} from "@/lib/repos/reviews";

// Public — anyone can read a product's reviews. Logged-in customers also
// get whether they're eligible to leave one (ordered it before) and their
// own existing review, if any, so the product modal can show the right
// form state without a second round-trip.
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

// Logged-in only, and only for a product the customer has actually ordered
// before (checked against their own order history) — closer to a
// verified-purchase review than an open one anyone could leave.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "Невалиден продукт" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Невалидни данни за отзива" }, { status: 400 });
  }

  const { ordered, orderId } = await customerHasOrderedProduct(session.customerId, productId);
  if (!ordered) {
    return NextResponse.json(
      { error: "Можете да оставите отзив само за продукт, който сте поръчвали" },
      { status: 403 }
    );
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
