import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "353503";
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || "";

interface FunnelCache {
  data: FunnelResult;
  ts: number;
}

interface FunnelResult {
  range: string;
  steps: { label: string; count: number; color: string }[];
  purchaseRate: number;
  source: "posthog" | "supabase";
  snapshotDate?: string;
}

const funnelCache = new Map<string, FunnelCache>();
const CACHE_TTL = 5 * 60 * 1000;

async function queryPostHog(hogql: string, days: number): Promise<number> {
  const after = new Date(Date.now() - days * 86400000).toISOString();
  const query = `${hogql} AND toDate(timestamp) >= toDate('${after.slice(0, 10)}')`;
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
  if (!res.ok) throw new Error(`PostHog ${res.status}`);
  const json = await res.json();
  return Number(json?.results?.[0]?.[0] ?? 0);
}

async function getFunnelFromSupabase(range: string): Promise<FunnelResult | null> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/funnel", async (req, res) => {
    const range = (req.query.range as string) || "7d";
    const cached = funnelCache.get(range);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json(cached.data);
    }

    const days = range === "24h" ? 1 : range === "30d" ? 30 : 7;

    if (POSTHOG_API_KEY) {
      try {
        const [homepage, onboarding, planSelect, purchase, dashboard] = await Promise.all([
          queryPostHog("SELECT count(distinct distinct_id) FROM events WHERE event = 'page_view' AND (properties.$current_url LIKE '%/' OR properties.$current_url LIKE '%/?%') AND properties.$current_url NOT LIKE '%/home%' AND properties.$current_url NOT LIKE '%/dashboard%' AND properties.$current_url NOT LIKE '%/onboarding%'", days),
          queryPostHog("SELECT count(distinct distinct_id) FROM events WHERE event = 'page_view' AND properties.$current_url LIKE '%/onboarding%'", days),
          queryPostHog("SELECT count(distinct distinct_id) FROM events WHERE event = 'subscription_state'", days),
          queryPostHog("SELECT count(distinct distinct_id) FROM events WHERE event = 'purchase'", days),
          queryPostHog("SELECT count(distinct distinct_id) FROM events WHERE event = 'page_view' AND (properties.$current_url LIKE '%/home%' OR properties.$current_url LIKE '%/dashboard%')", days),
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
        funnelCache.set(range, { data: result, ts: Date.now() });
        return res.json(result);
      } catch (err) {
        console.error("PostHog funnel error, falling back to Supabase:", err);
      }
    }

    const fallback = await getFunnelFromSupabase(range);
    if (fallback) {
      funnelCache.set(range, { data: fallback, ts: Date.now() });
      return res.json(fallback);
    }

    return res.status(503).json({ error: "Funnel data unavailable" });
  });

  return httpServer;
}
