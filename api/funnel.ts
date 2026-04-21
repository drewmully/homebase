import type { IncomingMessage, ServerResponse } from "http";

const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "353503";
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || "";

interface FunnelStep {
  label: string;
  count: number;
  color: string;
}

interface FunnelResult {
  range: string;
  steps: FunnelStep[];
  purchaseRate: number;
  source: "posthog" | "supabase";
  snapshotDate?: string;
}

const cache = new Map<string, { data: FunnelResult; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function queryPostHog(hogql: string, days: number): Promise<number> {
  const after = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const query = `${hogql} AND toDate(timestamp) >= toDate('${after}')`;
  const res = await fetch(
    `https://app.posthog.com/api/projects/${POSTHOG_PROJECT_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    }
  );
  if (!res.ok) throw new Error(`PostHog ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return Number(json?.results?.[0]?.[0] ?? 0);
}

const SUPABASE_URL = "https://xnfjdbpjuaezxjgargto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZmpkYnBqdWFlenhqZ2FyZ3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzMxOTAsImV4cCI6MjA5MDA0OTE5MH0.rY1jpedgZ0qJmIRNJLYJNCuIBwBTljWJGpcZI9-YN_g";

async function getFunnelFromSupabase(range: string): Promise<FunnelResult | null> {
  const supabaseUrl = SUPABASE_URL;
  const supabaseKey = SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/ab_results?variant=eq.baseline-all&order=snapshot_date.desc&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const row = rows?.[0];
    if (!row) return null;
    const raw = row.raw_data || {};
    const homepage = raw.unique_page_view_users || row.page_views || 0;
    const onboarding = raw.onboarding_starts || raw.unique_onboarding_users || 0;
    const planSelect = raw.plan_selections || raw.subscription_state || 0;
    const purchase = row.purchases || raw.unique_purchase_users || 0;
    const dashboard = raw.dashboard_visits || raw.wallet_users || 0;
    return {
      range,
      steps: [
        { label: "Homepage", count: homepage, color: "#60a5fa" },
        { label: "Onboarding", count: onboarding, color: "#c084fc" },
        { label: "Plan Select", count: planSelect, color: "#f59e0b" },
        { label: "Purchase", count: purchase, color: "#4ade80" },
        { label: "Dashboard", count: dashboard, color: "#C9A84C" },
      ],
      purchaseRate: homepage > 0 ? purchase / homepage : 0,
      source: "supabase",
      snapshotDate: row.snapshot_date,
    };
  } catch {
    return null;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.writeHead(405).end();
    return;
  }

  const url = new URL(req.url || "/", "http://localhost");
  const range = url.searchParams.get("range") || "7d";

  const days = range === "24h" ? 1 : range === "30d" ? 30 : 7;

  const cached = cache.get(range);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(cached.data));
    return;
  }

  if (POSTHOG_API_KEY) {
    try {
      const [homepage, onboarding, planSelect, purchase, dashboard] = await Promise.all([
        queryPostHog("SELECT count(distinct distinct_id) FROM events WHERE event = '$pageview' AND (properties['$current_url'] LIKE '%mymully.com/' OR properties['$current_url'] LIKE '%mymully.com/?%')", days),
        queryPostHog("SELECT count(distinct distinct_id) FROM events WHERE event = '$pageview' AND properties['$current_url'] LIKE '%/onboarding%'", days),
        queryPostHog("SELECT count(distinct distinct_id) FROM events WHERE event = 'subscription_state'", days),
        queryPostHog("SELECT count(distinct distinct_id) FROM events WHERE event = 'purchase'", days),
        queryPostHog("SELECT count(distinct distinct_id) FROM events WHERE event = '$pageview' AND (properties['$current_url'] LIKE '%/home%' OR properties['$current_url'] LIKE '%/dashboard%')", days),
      ]);

      const result: FunnelResult = {
        range,
        steps: [
          { label: "Homepage", count: homepage, color: "#60a5fa" },
          { label: "Onboarding", count: onboarding, color: "#c084fc" },
          { label: "Plan Select", count: planSelect, color: "#f59e0b" },
          { label: "Purchase", count: purchase, color: "#4ade80" },
          { label: "Dashboard", count: dashboard, color: "#C9A84C" },
        ],
        purchaseRate: homepage > 0 ? purchase / homepage : 0,
        source: "posthog",
      };
      cache.set(range, { data: result, ts: Date.now() });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    } catch (err) {
      console.error("PostHog error, falling back to Supabase:", err);
    }
  }

  const fallback = await getFunnelFromSupabase(range);
  if (fallback) {
    cache.set(range, { data: fallback, ts: Date.now() });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(fallback));
    return;
  }

  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Funnel data unavailable" }));
}
