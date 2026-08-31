"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { ProductReviewPublic } from "@/lib/types";

function Stars({
  value,
  size = "text-sm",
  onPick,
}: {
  value: number;
  size?: string;
  // Present only for the input version (picking a rating); omit for
  // read-only display.
  onPick?: (n: number) => void;
}) {
  return (
    <span className={`inline-flex ${size}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          role={onPick ? "button" : undefined}
          onClick={onPick ? () => onPick(n) : undefined}
          className={`${onPick ? "cursor-pointer" : ""} ${n <= Math.round(value) ? "text-gold" : "text-border"}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// Star rating + reviews for one product — public read, but leaving a review
// requires being logged in AND having actually ordered this product before
// (enforced server-side; this UI just reflects what the API already told
// it via `canReview`).
export function ProductReviews({ productId }: { productId: number }) {
  const t = useT();
  const [reviews, setReviews] = useState<ProductReviewPublic[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [canReview, setCanReview] = useState(false);
  const [loggedIn, setLoggedIn] = useState(true); // assume yes until the fetch says otherwise, so no login prompt flashes for a logged-in customer
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  function load() {
    fetch(`/api/products/${productId}/reviews`)
      .then((r) => r.json())
      .then((d) => {
        setReviews(d.reviews ?? []);
        setAverage(d.average ?? 0);
        setCount(d.count ?? 0);
        setCanReview(Boolean(d.canReview));
        if (d.myReview) {
          setRating(d.myReview.rating);
          setComment(d.myReview.comment ?? "");
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));

    fetch("/api/account/session")
      .then((r) => r.json())
      .then((d) => setLoggedIn(Boolean(d.loggedIn)))
      .catch(() => {});
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function submit() {
    if (rating < 1) return;
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/products/${productId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Възникна грешка");
      return;
    }
    load();
  }

  if (!loaded) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="font-semibold text-sm">{t("product.reviews")}</p>
        {count > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted">
            <Stars value={average} />
            {average.toFixed(1)} ({count})
          </span>
        )}
      </div>

      {canReview && (
        <div className="rounded-xl border border-border p-3 mb-3 space-y-2">
          <p className="text-xs text-muted">{t("product.reviews.canReview")}</p>
          <Stars value={rating} size="text-xl" onPick={setRating} />
          <textarea
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            placeholder={t("product.reviews.commentPlaceholder")}
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {error && <p className="text-xs text-brand">{error}</p>}
          <button
            onClick={submit}
            disabled={submitting || rating < 1}
            className="text-xs font-bold bg-brand text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            {submitting ? t("product.reviews.submitting") : t("product.reviews.submit")}
          </button>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-xs text-muted">{t("product.reviews.empty")}</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {reviews.map((r) => (
            <div key={r.id} className="text-sm border-b border-border/60 pb-2 last:border-0">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} />
                <span className="text-xs font-semibold">{r.customer_name}</span>
              </div>
              {r.comment && <p className="text-xs text-muted mt-0.5">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {!loggedIn && (
        <p className="text-xs text-muted mt-2">{t("product.reviews.loginRequired")}</p>
      )}
    </div>
  );
}
