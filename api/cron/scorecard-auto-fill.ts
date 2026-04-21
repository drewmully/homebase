import type { IncomingMessage, ServerResponse } from "http";

/**
 * Vercel cron target: runs the Supabase RPC `run_scorecard_autofill()` which
 * executes every `scorecard.auto_fill_query` and upserts the result into
 * `scorecard_entries.auto_value` for the current ISO week.
 *
 * Invoked by Vercel Cron (see vercel.json). Also protected via CRON_SECRET
 * header for manual triggering.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xnfjdbpjuaezxjgargto.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

function readAuthHeader(req: IncomingMessage): string {
  const h = req.headers["authorization"];
  if (Array.isArray(h)) return h[0] || "";
  return h || "";
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when configured
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

    const rpcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/run_scorecard_autofill`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );

    if (!rpcRes.ok) {
      const text = await rpcRes.text();
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "rpc failed", detail: text }));
      return;
    }

    const results = (await rpcRes.json()) as Array<{
      out_scorecard_id: number;
      out_measurable: string;
      out_value: string | null;
      out_status: string;
    }>;

    const ok = results.filter((r) => r.out_status === "ok").length;
    const failed = results.filter((r) => r.out_status !== "ok");

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ran_at: new Date().toISOString(),
        ok,
        total: results.length,
        failed,
        results,
      }),
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({ error: "exception", detail: String(err?.message || err) }),
    );
  }
}
