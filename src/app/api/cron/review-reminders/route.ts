import { NextRequest, NextResponse } from "next/server";
import {
  listOrdersNeedingReviewReminder,
  markReviewReminderSent,
} from "@/lib/repos/orders";
import { getSettings } from "@/lib/repos/settings";
import { sendReviewReminderEmail } from "@/lib/email";

// Fired on a schedule (see vercel.json) rather than by a user action —
// Vercel serverless has no persistent background worker, so a delayed
// "20-30 minutes after delivery" nudge has to be a periodic job checking
// for orders that just crossed that threshold, not a timer set at
// delivery time. Vercel signs its own Cron requests with an Authorization
// header matching the project's CRON_SECRET env var when one is set —
// checked below so this can't be triggered (and spam emails sent) by
// anyone who finds the URL. If CRON_SECRET isn't configured yet, the job
// still runs (nothing sensitive is exposed — at worst, review emails go
// out slightly early) but logs a warning so it gets set.
const MIN_MINUTES_SINCE_DELIVERY = 20;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn(
      "CRON_SECRET is not set — /api/cron/review-reminders is running unauthenticated."
    );
  }

  const settings = await getSettings();
  const siteUrl = settings.site_domain
    ? `https://${settings.site_domain}`
    : req.nextUrl.origin;

  const candidates = await listOrdersNeedingReviewReminder(MIN_MINUTES_SINCE_DELIVERY);
  let sent = 0;
  for (const order of candidates) {
    const ok = await sendReviewReminderEmail(order, settings, siteUrl);
    // Marked as sent even on a delivery failure (bad address, Resend down)
    // — same reasoning as the order confirmation email: retrying forever
    // isn't worth the complexity for a nice-to-have reminder, and without
    // this the same broken address would be retried every run indefinitely.
    await markReviewReminderSent(order.id);
    if (ok) sent++;
  }

  return NextResponse.json({ checked: candidates.length, sent });
}
