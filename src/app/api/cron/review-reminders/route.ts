import { NextRequest, NextResponse } from "next/server";
import {
  listOrdersNeedingReviewReminder,
  markReviewReminderSent,
} from "@/lib/repos/orders";
import { getSettings } from "@/lib/repos/settings";
import { sendReviewReminderEmail } from "@/lib/email";

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
    await markReviewReminderSent(order.id);
    if (ok) sent++;
  }

  return NextResponse.json({ checked: candidates.length, sent });
}
