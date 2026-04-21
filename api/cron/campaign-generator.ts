import type { IncomingMessage, ServerResponse } from "http";

/**
 * Vercel cron target: runs weekly (Mondays 14:00 UTC).
 * Queries subscriber segments and proposes ONE new campaign draft
 * into campaign_drafts with status='pending'.
 *
 * Auth: accepts `vercel-cron` user-agent OR `Authorization: Bearer ${CRON_SECRET}`.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xnfjdbpjuaezxjgargto.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

// ─────────────────────────────────────────────
// Campaign angle templates
// ─────────────────────────────────────────────
interface AngleTemplate {
  name_prefix: string;
  subject: string;
  html_template: string;
  text_template: string;
  segment_sql: string;
  segment_label: string;
  rationale: string;
}

const ANGLES: AngleTemplate[] = [
  // 0: legacy_upgrade
  {
    name_prefix: "legacy_upgrade",
    subject: "You've been here from the start — your Reserve upgrade is waiting",
    html_template: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;padding:40px 36px;">
<tr><td>
  <div style="font-size:14px;font-weight:600;letter-spacing:2px;color:#6b5e3c;text-transform:uppercase;margin-bottom:24px;">MULLY RESERVE</div>
  <h1 style="font-size:26px;font-weight:700;margin:0 0 20px 0;color:#1a1a1a;">You helped build this. Here's what you unlocked.</h1>
  <p style="font-size:16px;margin:0 0 18px 0;">Hey {first_name},</p>
  <p style="font-size:16px;margin:0 0 18px 0;">You've been a Mully member since the beginning. The new Reserve tier is here — built for members like you who stuck with us.</p>
  <p style="font-size:16px;margin:0 0 18px 0;"><strong>Upgrade to Reserve Member ($250/qtr) and get:</strong></p>
  <ul style="font-size:16px;margin:0 0 24px 0;padding-left:20px;">
    <li style="margin-bottom:8px;">Premium Reserve box with curated drops</li>
    <li style="margin-bottom:8px;">15% off everything in the Pro Shop</li>
    <li style="margin-bottom:8px;">Free 2-day shipping, no minimums</li>
    <li style="margin-bottom:8px;">V1+ Virtual Coaching (normally $59.95)</li>
    <li style="margin-bottom:8px;">$200 Far &amp; Sure Golf Tours credit</li>
  </ul>
  <div style="text-align:center;margin:32px 0;">
    <a href="https://mymully.com/reservecard" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:600;">Upgrade to Reserve</a>
  </div>
  <p style="font-size:16px;margin:24px 0 6px 0;">Swing well,</p>
  <p style="font-size:16px;margin:0;"><strong>Drew</strong></p>
  <p style="font-size:14px;color:#6b6b6b;margin:0 0 28px 0;">Founder, Mully</p>
  <hr style="border:none;border-top:1px solid #e8e4dc;margin:20px 0;">
  <p style="font-size:12px;color:#8a8a8a;margin:0;">You're receiving this because you're an active Mully subscriber. Reply "unsubscribe" to opt out.</p>
</td></tr></table>
</td></tr></table>
</body></html>`,
    text_template: `Hey {first_name},

You've been a Mully member since the beginning. The new Reserve tier is here.

Upgrade to Reserve Member ($250/qtr): https://mymully.com/reservecard

Benefits: Premium Reserve box, 15% off Pro Shop, free 2-day shipping, V1+ coaching, $200 Golf Tours credit.

Swing well,
Drew
Founder, Mully`,
    segment_sql: `SELECT email, first_name FROM subscribers WHERE plan_tier='legacy_back9' AND status='active' AND last_order_date > now()-interval '60 days'`,
    segment_label: "Legacy Back9 Active (60d)",
    rationale: "Target legacy tier members who have ordered recently. They are familiar with the brand and most likely to upgrade to Reserve.",
  },
  // 1: paused_winback
  {
    name_prefix: "paused_winback",
    subject: "We held your spot. Ready to come back?",
    html_template: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;padding:40px 36px;">
<tr><td>
  <div style="font-size:14px;font-weight:600;letter-spacing:2px;color:#6b5e3c;text-transform:uppercase;margin-bottom:24px;">MULLY</div>
  <h1 style="font-size:26px;font-weight:700;margin:0 0 20px 0;color:#1a1a1a;">We held your spot.</h1>
  <p style="font-size:16px;margin:0 0 18px 0;">Hey {first_name},</p>
  <p style="font-size:16px;margin:0 0 18px 0;">Your Mully subscription is paused. A lot has changed while you've been away — the Reserve box just launched and May shipments are the best we've ever curated.</p>
  <p style="font-size:16px;margin:0 0 18px 0;">Resume anytime and your next box ships within days.</p>
  <div style="text-align:center;margin:32px 0;">
    <a href="https://mymully.com/account" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:600;">Resume My Subscription</a>
  </div>
  <p style="font-size:16px;margin:24px 0 6px 0;">Good to have you back,</p>
  <p style="font-size:16px;margin:0;"><strong>Drew</strong></p>
  <p style="font-size:14px;color:#6b6b6b;margin:0 0 28px 0;">Founder, Mully</p>
  <hr style="border:none;border-top:1px solid #e8e4dc;margin:20px 0;">
  <p style="font-size:12px;color:#8a8a8a;margin:0;">You're receiving this because you have a paused Mully subscription. Reply "unsubscribe" to opt out.</p>
</td></tr></table>
</td></tr></table>
</body></html>`,
    text_template: `Hey {first_name},

Your Mully subscription is paused. A lot has changed while you've been away — the Reserve box just launched.

Resume anytime: https://mymully.com/account

Good to have you back,
Drew
Founder, Mully`,
    segment_sql: `SELECT email, first_name FROM subscribers WHERE status='paused'`,
    segment_label: "Paused Subscribers",
    rationale: "Re-engage paused members. Highlight new Reserve launch as reason to come back now.",
  },
  // 2: high_value_exclusive
  {
    name_prefix: "high_value_exclusive",
    subject: "You're in the top 50 — early access to the next drop",
    html_template: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;padding:40px 36px;">
<tr><td>
  <div style="font-size:14px;font-weight:600;letter-spacing:2px;color:#6b5e3c;text-transform:uppercase;margin-bottom:24px;">FOR TOP MEMBERS ONLY</div>
  <h1 style="font-size:26px;font-weight:700;margin:0 0 20px 0;color:#1a1a1a;">48-hour early access. Just for you.</h1>
  <p style="font-size:16px;margin:0 0 18px 0;">Hey {first_name},</p>
  <p style="font-size:16px;margin:0 0 18px 0;">You're one of our top 50 members by total spend. That means you get first look at the next limited drop — 48 hours before anyone else.</p>
  <p style="font-size:16px;margin:0 0 18px 0;">Details land in your inbox shortly. Keep an eye out.</p>
  <div style="text-align:center;margin:32px 0;">
    <a href="https://mymully.com/shop" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:600;">Browse the Pro Shop</a>
  </div>
  <p style="font-size:16px;margin:24px 0 6px 0;">Appreciate your loyalty,</p>
  <p style="font-size:16px;margin:0;"><strong>Drew</strong></p>
  <p style="font-size:14px;color:#6b6b6b;margin:0 0 28px 0;">Founder, Mully</p>
  <hr style="border:none;border-top:1px solid #e8e4dc;margin:20px 0;">
  <p style="font-size:12px;color:#8a8a8a;margin:0;">You're receiving this because you're a top Mully member. Reply "unsubscribe" to opt out.</p>
</td></tr></table>
</td></tr></table>
</body></html>`,
    text_template: `Hey {first_name},

You're one of our top 50 members by total spend. You get 48-hour early access to the next limited drop.

Browse the Pro Shop: https://mymully.com/shop

Appreciate your loyalty,
Drew
Founder, Mully`,
    segment_sql: `SELECT email, first_name FROM subscribers WHERE status='active' ORDER BY loop_subscription_spent DESC NULLS LAST LIMIT 50`,
    segment_label: "Top 50 by Spend",
    rationale: "VIP exclusivity play for highest-value members. Builds loyalty and drives Pro Shop revenue.",
  },
  // 3: new_member_welcome
  {
    name_prefix: "new_member_welcome",
    subject: "Welcome to Mully — here's how to get the most out of it",
    html_template: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;padding:40px 36px;">
<tr><td>
  <div style="font-size:14px;font-weight:600;letter-spacing:2px;color:#6b5e3c;text-transform:uppercase;margin-bottom:24px;">WELCOME TO MULLY</div>
  <h1 style="font-size:26px;font-weight:700;margin:0 0 20px 0;color:#1a1a1a;">Glad you're here, {first_name}.</h1>
  <p style="font-size:16px;margin:0 0 18px 0;">Hey {first_name},</p>
  <p style="font-size:16px;margin:0 0 18px 0;">You just joined a community of golfers who care about playing well and looking sharp without the country club markup.</p>
  <p style="font-size:16px;margin:0 0 14px 0;"><strong>Three things to do right now:</strong></p>
  <ol style="font-size:16px;margin:0 0 24px 0;padding-left:20px;">
    <li style="margin-bottom:10px;">Check out the <a href="https://mymully.com/shop" style="color:#1a1a1a;">Pro Shop</a> — member discount applies immediately.</li>
    <li style="margin-bottom:10px;">Update your gear preferences so your box is dialed in.</li>
    <li style="margin-bottom:10px;">Consider upgrading to Reserve — the best box we offer, same fair pricing.</li>
  </ol>
  <div style="text-align:center;margin:32px 0;">
    <a href="https://mymully.com/account" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:600;">Go to My Account</a>
  </div>
  <p style="font-size:16px;margin:24px 0 6px 0;">Swing well,</p>
  <p style="font-size:16px;margin:0;"><strong>Drew</strong></p>
  <p style="font-size:14px;color:#6b6b6b;margin:0 0 28px 0;">Founder, Mully</p>
  <hr style="border:none;border-top:1px solid #e8e4dc;margin:20px 0;">
  <p style="font-size:12px;color:#8a8a8a;margin:0;">You're receiving this because you recently joined Mully. Reply "unsubscribe" to opt out.</p>
</td></tr></table>
</td></tr></table>
</body></html>`,
    text_template: `Hey {first_name},

Welcome to Mully. Three things to do right now:

1. Check out the Pro Shop (member discount applies): https://mymully.com/shop
2. Update your gear preferences.
3. Consider upgrading to Reserve: https://mymully.com/reservecard

Swing well,
Drew
Founder, Mully`,
    segment_sql: `SELECT email, first_name FROM subscribers WHERE acquired_at > now()-interval '14 days' AND plan_tier IN ('member','access') AND status='active'`,
    segment_label: "New Members (last 14 days)",
    rationale: "Onboarding sequence for recent signups. Educate them on Pro Shop, preferences, and Reserve upsell opportunity.",
  },
];

// ─────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────
function readAuthHeader(req: IncomingMessage): string {
  const h = req.headers["authorization"];
  if (Array.isArray(h)) return h[0] || "";
  return h || "";
}

// ─────────────────────────────────────────────
// Supabase REST helper
// ─────────────────────────────────────────────
async function sbPost(path: string, body: object) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  return res;
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const auth = readAuthHeader(req);
    const ua = (req.headers["user-agent"] as string) || "";
    const isVercelCron = ua.includes("vercel-cron");
    const hasSecret = CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;

    if (!isVercelCron && !hasSecret) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }),
      );
      return;
    }

    // Pick angle by ISO week number mod N
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
    );
    const angle = ANGLES[weekNumber % ANGLES.length];

    // Build campaign name with date stamp
    const dateSuffix = now.toISOString().slice(0, 10).replace(/-/g, "_");
    const campaignName = `${angle.name_prefix}_${dateSuffix}`;

    // Insert into campaign_drafts
    const insertRes = await sbPost("/rest/v1/campaign_drafts", {
      name: campaignName,
      subject: angle.subject,
      html_body: angle.html_template,
      text_body: angle.text_template,
      segment_name: angle.segment_label,
      segment_sql: angle.segment_sql,
      status: "pending",
      proposed_by: "cron_generator",
      notes: angle.rationale,
      from_address: "Drew @ Mully <drew@mail.mymully.com>",
      reply_to: "drew@mail.mymully.com",
    });

    if (!insertRes.ok) {
      const detail = await insertRes.text();
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "insert failed", detail }));
      return;
    }

    const inserted = await insertRes.json();
    const draftId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ran_at: now.toISOString(),
        angle: angle.name_prefix,
        week_number: weekNumber,
        campaign_name: campaignName,
        draft_id: draftId,
      }),
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "exception",
        detail: String(err?.message || err),
      }),
    );
  }
}
