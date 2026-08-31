"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";

function Stars({
  value,
  onPick,
}: {
  value: number;
  onPick: (n: number) => void;
}) {
  return (
    <span className="inline-flex text-2xl">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          role="button"
          onClick={() => onPick(n)}
          className={`cursor-pointer ${n <= value ? "text-gold" : "text-border"}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// One product's rating widget — a compact version of ProductReviews.tsx's
// input form, reusing the exact same GET/POST /api/products/[id]/reviews
// endpoints (which already enforce "logged in + actually ordered this
// product"), just without the public reviews list underneath — this is
// the "leave a review" moment, not the "browse reviews" moment.
function ItemRating({ productId, name }: { productId: number; name: string }) {
  const t = useT();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${productId}/reviews`)
      .then((r) => r.json())
      .then((d) => {
        setCanReview(Boolean(d.canReview));
        if (d.myReview) {
          setRating(d.myReview.rating);
          setComment(d.myReview.comment ?? "");
          setAlreadyReviewed(true);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function submit() {
    if (rating < 1) return;
    setSubmitting(true);
    const res = await fetch(`/api/products/${productId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSaved(true);
      setAlreadyReviewed(true);
    }
  }

  // Not eligible (didn't order it under this account, or some other edge
  // case) — quietly render nothing rather than an empty/confusing card.
  if (loaded && !canReview) return null;

  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-sm font-semibold mb-1.5">{name}</p>
      <Stars value={rating} onPick={setRating} />
      <textarea
        className="w-full rounded-lg border border-border px-3 py-2 text-sm mt-2"
        placeholder={t("product.reviews.commentPlaceholder")}
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button
        onClick={submit}
        disabled={submitting || rating < 1}
        className="mt-2 text-xs font-bold bg-brand text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
      >
        {submitting
          ? t("product.reviews.submitting")
          : saved || alreadyReviewed
            ? t("order.reviewPrompt.update")
            : t("product.reviews.submit")}
      </button>
    </div>
  );
}

// Rendered on the order confirmation/tracking page once an order is
// delivered — a direct "how was it" prompt right where the customer
// already is, one star-click away, instead of relying on them to
// remember to open their account later. Same block also lands whoever
// clicks the automatic post-delivery reminder email.
export function OrderReviewPrompt({
  items,
}: {
  items: { productId: number; name: string }[];
}) {
  // A combo's components aren't reviewable products in their own right,
  // and the same product can appear more than once in an order — dedupe
  // by id so nothing renders twice.
  const t = useT();
  const seen = new Set<number>();
  const unique = items.filter((i) => {
    if (seen.has(i.productId)) return false;
    seen.add(i.productId);
    return true;
  });

  return (
    <div id="review" className="border-t border-border pt-4">
      <p className="font-semibold mb-2">{t("order.reviewPrompt.title")}</p>
      <div className="space-y-2">
        {unique.map((i) => (
          <ItemRating key={i.productId} productId={i.productId} name={i.name} />
        ))}
      </div>
    </div>
  );
}
