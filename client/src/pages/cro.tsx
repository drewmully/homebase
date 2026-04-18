import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  FlaskConical, TrendingUp, Target, BarChart3,
  Clock, CheckCircle2, Circle, Eye, UserPlus,
  ShoppingCart, ArrowRight, Monitor, Zap
} from 'lucide-react'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell
} from '@/components/ui/table'
import {
  Tooltip, TooltipContent, TooltipTrigger
} from '@/components/ui/tooltip'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell
} from 'recharts'

interface Experiment {
  id: string
  name: string
  page: string
  element: string
  status: string
  variants: Record<string, Record<string, string>> | null
  winning_variant: string | null
  started_at: string
  ended_at: string | null
  created_at: string
}

interface Hypothesis {
  id: string
  experiment_id: string | null
  hypothesis: string
  rationale: string
  priority_score: number
  funnel_stage: string
  status: string
  created_at: string
}

interface ResultRow {
  id: string
  experiment_id: string
  snapshot_date: string
  variant: string
  page_views: number
  cta_clicks: number
  registrations: number
  purchases: number
  dashboard_visits: number
  conversion_rate_purchase: number
  conversion_rate_registration: number
  confidence_score: number
  raw_data: any
  created_at: string
  ab_experiments: { name: string } | null
}

function daysSince(dateStr: string): number {
  const start = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function formatPct(val: number | null | undefined): string {
  if (val == null) return '—'
  return `${(Number(val) * 100).toFixed(2)}%`
}

function formatNum(val: number | null | undefined): string {
  if (val == null) return '—'
  return Number(val).toLocaleString()
}

function priorityColor(score: number): { bg: string; color: string; border: string } {
  if (score >= 70) return { bg: 'rgba(74,222,128,0.1)', color: '#4ade80', border: 'rgba(74,222,128,0.3)' }
  if (score >= 50) return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' }
  return { bg: 'rgba(138,135,120,0.1)', color: '#8a8778', border: 'rgba(138,135,120,0.3)' }
}

function statusStyle(status: string): { bg: string; color: string; border: string } {
  switch (status) {
    case 'active':
    case 'validated':
    case 'testing':
      return { bg: 'rgba(74,222,128,0.1)', color: '#4ade80', border: 'rgba(74,222,128,0.3)' }
    case 'completed':
      return { bg: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: 'rgba(96,165,250,0.3)' }
    case 'paused':
    case 'pending':
      return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' }
    case 'invalidated':
      return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' }
    default:
      return { bg: 'rgba(138,135,120,0.1)', color: '#8a8778', border: 'rgba(138,135,120,0.3)' }
  }
}

function funnelStageStyle(stage: string): { bg: string; color: string; border: string } {
  switch (stage) {
    case 'awareness':
      return { bg: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: 'rgba(96,165,250,0.3)' }
    case 'consideration':
      return { bg: 'rgba(192,132,252,0.1)', color: '#c084fc', border: 'rgba(192,132,252,0.3)' }
    case 'conversion':
      return { bg: 'rgba(74,222,128,0.1)', color: '#4ade80', border: 'rgba(74,222,128,0.3)' }
    case 'retention':
      return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' }
    default:
      return { bg: 'rgba(138,135,120,0.1)', color: '#8a8778', border: 'rgba(138,135,120,0.3)' }
  }
}

/* ─── Funnel step component ─── */
function FunnelStep({ label, value, pct, color, isLast }: {
  label: string; value: string; pct?: string; color: string; isLast?: boolean
}) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-[120px]">
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          {label}
        </div>
        <div className="text-xl font-bold" style={{ color }}>{value}</div>
        {pct && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{pct} of homepage</div>}
      </div>
      {!isLast && <ArrowRight size={14} style={{ color: 'hsl(45 10% 25%)' }} className="shrink-0 hidden md:block" />}
    </div>
  )
}

export default function CroPage() {
  const [loading, setLoading] = useState(true)
  const [funnelBaseline, setFunnelBaseline] = useState<ResultRow | null>(null)
  const [activeExperiments, setActiveExperiments] = useState<Experiment[]>([])
  const [completedExperiments, setCompletedExperiments] = useState<Experiment[]>([])
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [conversionHistory, setConversionHistory] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [
        { data: baselineData },
        { data: activeData },
        { data: completedData },
        { data: hypothesesData },
        { data: resultsData },
        { data: conversionData },
      ] = await Promise.all([
        supabase
          .from('ab_results')
          .select('*')
          .eq('variant', 'baseline-all')
          .order('snapshot_date', { ascending: false })
          .limit(1),
        supabase
          .from('ab_experiments')
          .select('*')
          .eq('status', 'active')
          .order('started_at', { ascending: true }),
        supabase
          .from('ab_experiments')
          .select('*')
          .eq('status', 'completed')
          .order('ended_at', { ascending: false }),
        supabase
          .from('ab_hypotheses')
          .select('*')
          .order('priority_score', { ascending: false }),
        supabase
          .from('ab_results')
          .select('*, ab_experiments(name)')
          .neq('variant', 'baseline-all')
          .order('snapshot_date', { ascending: false })
          .limit(30),
        supabase
          .from('ab_results')
          .select('snapshot_date, conversion_rate_purchase, variant')
          .eq('variant', 'baseline-all')
          .order('snapshot_date', { ascending: true })
          .limit(30),
      ])

      setFunnelBaseline((baselineData?.[0] as ResultRow) || null)
      setActiveExperiments((activeData as Experiment[]) || [])
      setCompletedExperiments((completedData as Experiment[]) || [])
      setHypotheses((hypothesesData as Hypothesis[]) || [])
      setResults((resultsData as ResultRow[]) || [])
      setConversionHistory(
        (conversionData || []).map((r: any) => ({
          date: r.snapshot_date,
          rate: r.conversion_rate_purchase ? Number(r.conversion_rate_purchase) * 100 : 0,
        }))
      )
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <FlaskConical size={20} style={{ color: 'var(--gold)' }} />
            CRO Lab
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', height: 90 }} />
          ))}
        </div>
      </div>
    )
  }

  // Parse funnel numbers from baseline raw_data
  const raw = funnelBaseline?.raw_data || {}
  const homepageViews = raw.unique_page_view_users || funnelBaseline?.page_views || 0
  const onboardingStarts = raw.onboarding_starts || raw.unique_onboarding_users || 0
  const planSelections = raw.plan_selections || raw.subscription_state || 0
  const purchases = funnelBaseline?.purchases || raw.unique_purchase_users || 0
  const dashboardViews = raw.dashboard_visits || funnelBaseline?.dashboard_visits || raw.wallet_users || 0
  const purchaseRate = homepageViews > 0 ? (purchases / homepageViews) : 0

  // Funnel bar chart data
  const funnelBarData = [
    { step: 'Homepage', count: homepageViews, color: '#60a5fa' },
    { step: 'Onboarding', count: onboardingStarts, color: '#c084fc' },
    { step: 'Plan Select', count: planSelections, color: '#f59e0b' },
    { step: 'Purchase', count: purchases, color: '#4ade80' },
    { step: 'Dashboard', count: dashboardViews, color: '#C9A84C' },
  ]

  // Separate testing vs queued hypotheses
  const testingHypotheses = hypotheses.filter(h => h.status === 'testing')
  const queuedHypotheses = hypotheses.filter(h => h.status === 'pending')

  // Next cron run info
  const nextCronDays = (() => {
    const now = new Date()
    const cronDays = [1,4,7,10,13,16,19,22,25,28]
    const today = now.getUTCDate()
    const next = cronDays.find(d => d > today) || cronDays[0]
    if (next > today) return next - today
    // next month
    const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate()
    return (daysInMonth - today) + next
  })()

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <FlaskConical size={20} style={{ color: 'var(--gold)' }} />
            CRO Lab
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Automated A/B testing &mdash; analyzing every 3 days
          </p>
        </div>
        <div
          className="rounded-lg px-3 py-1.5 text-[10px] font-medium flex items-center gap-1.5"
          style={{ background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
        >
          <Zap size={10} /> Auto-pilot active &middot; next analysis in {nextCronDays}d
        </div>
      </div>

      {/* ─── CONVERSION FUNNEL ─── */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--gold)' }}>◆</span> Conversion Funnel
          {funnelBaseline?.snapshot_date && (
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              — 7-day snapshot ({funnelBaseline.snapshot_date})
            </span>
          )}
        </h2>

        {/* Funnel steps row */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
        >
          <div className="flex flex-wrap md:flex-nowrap gap-4 md:gap-2">
            <FunnelStep label="Homepage" value={formatNum(homepageViews)} color="#60a5fa" />
            <FunnelStep label="Onboarding Start" value={formatNum(onboardingStarts)} pct={homepageViews > 0 ? `${((onboardingStarts/homepageViews)*100).toFixed(1)}%` : undefined} color="#c084fc" />
            <FunnelStep label="Plan Selection" value={formatNum(planSelections)} pct={homepageViews > 0 ? `${((planSelections/homepageViews)*100).toFixed(1)}%` : undefined} color="#f59e0b" />
            <FunnelStep label="Purchase" value={formatNum(purchases)} pct={homepageViews > 0 ? `${((purchases/homepageViews)*100).toFixed(1)}%` : undefined} color="#4ade80" />
            <FunnelStep label="Dashboard" value={formatNum(dashboardViews)} pct={homepageViews > 0 ? `${((dashboardViews/homepageViews)*100).toFixed(1)}%` : undefined} color="#C9A84C" isLast />
          </div>

          {/* Purchase rate callout */}
          <div className="mt-4 pt-3 flex items-center gap-3" style={{ borderTop: '1px solid hsl(45 10% 18%)' }}>
            <TrendingUp size={14} style={{ color: 'var(--gold)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Purchase rate</span>
            <span className="text-lg font-bold" style={{ color: 'var(--gold)' }}>{(purchaseRate * 100).toFixed(2)}%</span>
            <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
              Primary optimization target
            </span>
          </div>
        </div>

        {/* Funnel bar chart */}
        {homepageViews > 0 && (
          <div className="rounded-xl p-4 mt-3" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={funnelBarData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(45 10% 16%)" vertical={false} />
                <XAxis dataKey="step" tick={{ fill: '#8a8778', fontSize: 10 }} />
                <YAxis tick={{ fill: '#8a8778', fontSize: 10 }} />
                <RechartsTooltip
                  contentStyle={{ background: '#232320', border: '1px solid hsl(45 10% 25%)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#8a8778' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {funnelBarData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ─── LIVE EXPERIMENTS ─── */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--gold)' }}>◆</span> Live Experiments
          <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({activeExperiments.length} running)</span>
        </h2>
        {activeExperiments.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-muted)' }}
          >
            No active experiments — the cron will deploy the next test automatically
          </div>
        ) : (
          <div className="space-y-3">
            {activeExperiments.map(exp => (
              <div
                key={exp.id}
                className="rounded-xl p-4"
                style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{exp.name}</span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
                  >
                    <Circle size={6} fill="#4ade80" /> Live
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}
                  >
                    {exp.page}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={12} /> {daysSince(exp.started_at)}d running
                  </span>
                </div>

                {/* Variants breakdown */}
                {exp.variants && Object.keys(exp.variants).length > 0 && (
                  <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid hsl(45 10% 16%)' }}>
                    <div className="text-[10px] font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      What&apos;s being tested
                    </div>
                    <div className="space-y-2">
                      {Object.entries(exp.variants).map(([key, variants]) => {
                        if (typeof variants === 'object' && variants !== null) {
                          return (
                            <div key={key}>
                              <div className="text-xs font-medium mb-1" style={{ color: 'var(--gold)' }}>{key}</div>
                              <div className="grid gap-1 ml-3">
                                {Object.entries(variants).map(([variantName, value]) => (
                                  <div key={variantName} className="flex gap-2 text-xs">
                                    <span
                                      className="rounded px-1.5 py-0.5 font-mono text-[10px] shrink-0"
                                      style={{
                                        background: variantName === 'control' ? 'rgba(138,135,120,0.15)' : 'rgba(201,168,76,0.1)',
                                        color: variantName === 'control' ? '#8a8778' : '#C9A84C',
                                      }}
                                    >
                                      {variantName}
                                    </span>
                                    <span style={{ color: 'var(--text-primary)' }}>{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div key={key} className="flex gap-2 text-xs">
                            <span className="font-mono" style={{ color: 'var(--text-muted)' }}>{key}:</span>
                            <span style={{ color: 'var(--text-primary)' }}>{String(variants)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Testing hypotheses linked to this experiment */}
                {testingHypotheses.filter(h => h.experiment_id === exp.id).length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid hsl(45 10% 16%)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Hypotheses under test
                    </div>
                    {testingHypotheses.filter(h => h.experiment_id === exp.id).map(h => (
                      <div key={h.id} className="text-xs mb-1" style={{ color: 'var(--text-primary)' }}>
                        • {h.hypothesis}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── PURCHASE RATE TREND ─── */}
      {conversionHistory.length > 1 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--gold)' }}>◆</span> Purchase Rate Trend
          </h2>
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={conversionHistory} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="croGoldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#C9A84C" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(45 10% 16%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#8a8778', fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fill: '#8a8778', fontSize: 10 }}
                  tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                />
                <RechartsTooltip
                  contentStyle={{ background: '#232320', border: '1px solid hsl(45 10% 25%)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#8a8778' }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Purchase Rate']}
                />
                <Area type="monotone" dataKey="rate" stroke="#C9A84C" fill="url(#croGoldGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ─── HYPOTHESIS BACKLOG ─── */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--gold)' }}>◆</span>
          <Target size={14} style={{ color: 'var(--gold)' }} />
          Hypothesis Queue
          <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
            ({queuedHypotheses.length} pending &middot; auto-selected by priority)
          </span>
        </h2>
        {queuedHypotheses.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-muted)' }}
          >
            All hypotheses are being tested or have been resolved
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: 'hsl(45 10% 20%)' }}>
                  <TableHead className="text-xs w-[60px]" style={{ color: 'var(--text-muted)' }}>Score</TableHead>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Hypothesis</TableHead>
                  <TableHead className="text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Stage</TableHead>
                  <TableHead className="text-xs hidden md:table-cell w-[80px]" style={{ color: 'var(--text-muted)' }}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queuedHypotheses.map((h, idx) => {
                  const pc = priorityColor(h.priority_score)
                  const fs = funnelStageStyle(h.funnel_stage)
                  return (
                    <TableRow key={h.id} style={{ borderColor: 'hsl(45 10% 18%)' }}>
                      <TableCell className="py-3">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-xs font-bold text-center min-w-[36px]"
                          style={{ background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}
                        >
                          {h.priority_score}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <div className="text-xs cursor-help" style={{ color: 'var(--text-primary)' }}>
                                {idx === 0 && <span className="text-[10px] mr-1.5 font-semibold" style={{ color: 'var(--gold)' }}>NEXT UP →</span>}
                                {h.hypothesis}
                              </div>
                            </div>
                          </TooltipTrigger>
                          {h.rationale && (
                            <TooltipContent
                              side="top"
                              className="max-w-xs text-xs"
                              style={{ background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid hsl(45 10% 28%)' }}
                            >
                              <strong style={{ color: 'var(--gold)' }}>Rationale:</strong> {h.rationale}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                      <TableCell className="py-3 hidden md:table-cell">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                          style={{ background: fs.bg, color: fs.color, border: `1px solid ${fs.border}` }}
                        >
                          {h.funnel_stage}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 hidden md:table-cell">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                        >
                          queued
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ─── VARIANT RESULTS ─── */}
      {results.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--gold)' }}>◆</span>
            <BarChart3 size={14} style={{ color: 'var(--gold)' }} />
            Variant Results
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: 'hsl(45 10% 20%)' }}>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Date</TableHead>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Experiment</TableHead>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Variant</TableHead>
                  <TableHead className="text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Views</TableHead>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Purchases</TableHead>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Conv. Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(r => (
                  <TableRow key={r.id} style={{ borderColor: 'hsl(45 10% 18%)' }}>
                    <TableCell className="py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{r.snapshot_date}</TableCell>
                    <TableCell className="py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                      {r.ab_experiments?.name || '—'}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: r.variant === 'control' ? 'rgba(138,135,120,0.1)' : 'rgba(201,168,76,0.1)',
                          color: r.variant === 'control' ? '#8a8778' : '#C9A84C',
                          border: r.variant === 'control' ? '1px solid rgba(138,135,120,0.3)' : '1px solid rgba(201,168,76,0.3)',
                        }}
                      >
                        {r.variant}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs hidden md:table-cell" style={{ color: 'var(--text-primary)' }}>
                      {formatNum(r.page_views)}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs" style={{ color: 'var(--text-primary)' }}>
                      {formatNum(r.purchases)}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-medium" style={{ color: 'var(--gold)' }}>
                      {formatPct(r.conversion_rate_purchase)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* ─── COMPLETED EXPERIMENTS ─── */}
      {completedExperiments.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--gold)' }}>◆</span>
            <CheckCircle2 size={14} style={{ color: 'var(--gold)' }} />
            Completed Experiments
          </h2>
          <div className="space-y-3">
            {completedExperiments.map(exp => {
              const ss = statusStyle(exp.status)
              return (
                <div
                  key={exp.id}
                  className="rounded-xl p-4"
                  style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
                >
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{exp.name}</span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}
                    >
                      <CheckCircle2 size={10} /> Completed
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>Element: <span style={{ color: 'var(--text-primary)' }}>{exp.element}</span></span>
                    {exp.ended_at && <span>Ended: {new Date(exp.ended_at).toLocaleDateString()}</span>}
                    {exp.winning_variant && (
                      <span className="flex items-center gap-1">
                        Winner:
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
                        >
                          {exp.winning_variant}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
