import type { IncomingMessage, ServerResponse } from "http";

/**
 * Vercel cron target: runs every 15 minutes.
 * Finds one approved campaign and sends up to 15 emails per invocation,
 * using a send_cursor to paginate through large segments.
 *
 * Auth: accepts `vercel-cron` user-agent OR `Authorization: Bearer ${CRON_SECRET}`.
 * Required env vars: RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, CRON_SECRET.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xnfjdbpjuaezxjgargto.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

const BATCH_SIZE = 15;
const SEND_DELAY_MS = 500;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface CampaignDraft {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  segment_sql: string;
  from_address: string;
  reply_to: string;
  send_cursor: string | null;
  sent_count: number;
  failed_count: number;
  recipient_count: number | null;
}

interface Recipient {
  email: string;
  first_name?: string | null;
}

// ─────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────
function readAuthHeader(req: IncomingMessage): string {
  const h = req.headers["authorization"];
  if (Array.isArray(h)) return h[0] || "";
  return h || "";
}

// ─────────────────────────────────────────────
// Supabase REST helpers
// ─────────────────────────────────────────────
async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  return res;
}

async function sbPatch(path: string, body: object) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return res;
}

async function sbPost(path: string, body: object, preferUpsert?: string) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: preferUpsert || "return=representation",
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res;
}

async function sbRpc(fn: string, args: object) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  return res;
}

// ─────────────────────────────────────────────
// Execute segment SQL via Supabase RPC wrapper
// We call a postgres function that accepts arbitrary SQL and returns rows.
// Because we can't run arbitrary SQL directly via REST without an RPC,
// we use the /rest/v1/rpc/execute_segment_sql approach (see below).
// Fallback: run via the SQL API (management API — not available in Vercel env),
// so instead we parse the segment_sql to extract table/filters and use REST.
// ─────────────────────────────────────────────

/**
 * Executes the segment SQL using the Supabase management SQL endpoint.
 * Returns rows with {email, first_name} fields.
 * Uses a cursor (email > last_email) to paginate.
 */
async function runSegmentQuery(
  segmentSql: string,
  cursor: string | null,
  limit: number,
): Promise<Recipient[]> {
  // We hit the /rest/v1/rpc endpoint with a generic SQL executor.
  // The project needs an RPC function `run_select_query` — if it doesn't exist,
  // we fall back to a direct REST fetch against `subscribers` table.
  //
  // Strategy: append a cursor WHERE clause and LIMIT to the segment SQL.
  // The segment_sql is expected to NOT have a trailing semicolon.
  let sql = segmentSql;

  // Inject cursor condition
  if (cursor) {
    // If the SQL already has a WHERE clause, append AND; otherwise add WHERE
    const upperSql = sql.toUpperCase();
    if (upperSql.includes(" WHERE ")) {
      sql = `${sql} AND email > '${cursor.replace(/'/g, "''")}'`;
    } else {
      sql = `${sql} WHERE email > '${cursor.replace(/'/g, "''")}'`;
    }
  }

  // Append ORDER BY + LIMIT for pagination
  const upperSql = sql.toUpperCase();
  if (!upperSql.includes(" ORDER BY ")) {
    sql = `${sql} ORDER BY email ASC`;
  }
  sql = `${sql} LIMIT ${limit}`;

  // Try RPC run_select_query if available
  const rpcRes = await sbRpc("run_select_query", { query_text: sql });
  if (rpcRes.ok) {
    const rows = await rpcRes.json();
    if (Array.isArray(rows)) return rows as Recipient[];
  }

  // Fallback: parse the segment SQL manually to use REST API.
  // This handles common patterns like SELECT email, first_name FROM subscribers WHERE ...
  // We extract filters and use Supabase REST with &select=email,first_name
  return await fallbackRestQuery(segmentSql, cursor, limit);
}

async function fallbackRestQuery(
  segmentSql: string,
  cursor: string | null,
  limit: number,
): Promise<Recipient[]> {
  // Extract table name from "FROM <table>"
  const fromMatch = segmentSql.match(/\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  if (!fromMatch) return [];
  const table = fromMatch[1];

  // Build query params
  const params = new URLSearchParams();
  params.set("select", "email,first_name");
  params.set("order", "email.asc");
  params.set("limit", String(limit));

  if (cursor) {
    params.set("email", `gt.${cursor}`);
  }

  // Extract simple WHERE conditions from segment_sql and add them
  // Pattern: WHERE status='active' -> status=eq.active
  const whereMatch = segmentSql.match(/\bWHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s*$)/is);
  if (whereMatch) {
    const conditions = whereMatch[1];
    // status='active' or status = 'active'
    const eqMatches = conditions.matchAll(/(\w+)\s*=\s*'([^']+)'/g);
    for (const m of eqMatches) {
      const col = m[1];
      const val = m[2];
      if (col !== "email") {
        params.append(col, `eq.${val}`);
      }
    }
    // Handle plan_tier IN ('a','b')
    const inMatch = conditions.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
    if (inMatch) {
      const col = inMatch[1];
      const vals = inMatch[2].split(",").map(v => v.trim().replace(/'/g, ""));
      params.set(col, `in.(${vals.join(",")})`);
    }
  }

  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? (data as Recipient[]) : [];
}

// ─────────────────────────────────────────────
// Resend send
// ─────────────────────────────────────────────
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string | null;
  from: string;
  replyTo: string;
}): Promise<{ messageId: string | null; error: string | null }> {
  if (!RESEND_API_KEY) {
    return { messageId: null, error: "RESEND_API_KEY not configured" };
  }

  const body: Record<string, any> = {
    from: params.from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    reply_to: params.replyTo,
  };
  if (params.text) body.text = params.text;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { messageId: null, error: `Resend ${res.status}: ${errText}` };
  }

  const data = await res.json();
  return { messageId: data.id || null, error: null };
}

// ─────────────────────────────────────────────
// Personalise templates
// ─────────────────────────────────────────────
function personalise(template: string, firstName: string | null | undefined): string {
  return template.replace(/\{first_name\}/g, firstName || "there");
}

// ─────────────────────────────────────────────
// Sleep helper
// ─────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

    // Find one approved campaign ready to send
    const now = new Date().toISOString();
    const listRes = await sbGet(
      `/rest/v1/campaign_drafts?status=eq.approved&or=(scheduled_at.is.null,scheduled_at.lte.${encodeURIComponent(now)})&order=created_at.asc&limit=1`,
    );

    if (!listRes.ok) {
      const detail = await listRes.text();
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "failed to fetch campaigns", detail }));
      return;
    }

    const campaigns = (await listRes.json()) as CampaignDraft[];

    if (!campaigns || campaigns.length === 0) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ran_at: now, message: "no approved campaigns ready" }));
      return;
    }

    const campaign = campaigns[0];

    // Mark as sending
    await sbPatch(`/rest/v1/campaign_drafts?id=eq.${campaign.id}`, {
      status: "sending",
      updated_at: new Date().toISOString(),
    });

    // Get recipients (paginated via cursor)
    let recipients: Recipient[];
    try {
      recipients = await runSegmentQuery(
        campaign.segment_sql,
        campaign.send_cursor,
        BATCH_SIZE,
      );
    } catch (err: any) {
      // If segment query fails, mark failed and bail
      await sbPatch(`/rest/v1/campaign_drafts?id=eq.${campaign.id}`, {
        status: "failed",
        updated_at: new Date().toISOString(),
      });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "segment query failed", detail: String(err?.message || err) }));
      return;
    }

    let sentCount = 0;
    let failedCount = 0;
    let lastEmail: string | null = null;

    for (const recipient of recipients) {
      if (!recipient.email) continue;

      const html = personalise(campaign.html_body, recipient.first_name);
      const text = campaign.text_body
        ? personalise(campaign.text_body, recipient.first_name)
        : null;

      const { messageId, error: sendError } = await sendEmail({
        to: recipient.email,
        subject: campaign.subject,
        html,
        text,
        from: campaign.from_address,
        replyTo: campaign.reply_to,
      });

      // Upsert into campaign_sends
      await sbPost(
        "/rest/v1/campaign_sends",
        {
          campaign_id: campaign.id,
          email: recipient.email,
          first_name: recipient.first_name || null,
          status: sendError ? "failed" : "sent",
          message_id: messageId,
          error: sendError,
          sent_at: sendError ? null : new Date().toISOString(),
        },
        "resolution=merge-duplicates,return=minimal",
      );

      if (sendError) {
        failedCount++;
      } else {
        sentCount++;
      }

      lastEmail = recipient.email;

      // Throttle
      if (recipients.indexOf(recipient) < recipients.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    }

    const batchDone = recipients.length < BATCH_SIZE;
    const totalSent = (campaign.sent_count || 0) + sentCount;
    const totalFailed = (campaign.failed_count || 0) + failedCount;

    if (batchDone) {
      // All recipients processed — mark sent
      await sbPatch(`/rest/v1/campaign_drafts?id=eq.${campaign.id}`, {
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_count: totalSent,
        failed_count: totalFailed,
        recipient_count: totalSent + totalFailed,
        send_cursor: null,
        updated_at: new Date().toISOString(),
      });
    } else {
      // More to send — update cursor and go back to approved so next tick picks it up
      await sbPatch(`/rest/v1/campaign_drafts?id=eq.${campaign.id}`, {
        status: "approved",
        sent_count: totalSent,
        failed_count: totalFailed,
        send_cursor: lastEmail,
        updated_at: new Date().toISOString(),
      });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ran_at: new Date().toISOString(),
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        batch_size: recipients.length,
        sent: sentCount,
        failed: failedCount,
        batch_complete: batchDone,
        cursor_advanced_to: batchDone ? null : lastEmail,
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
