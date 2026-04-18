import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  FlaskConical, TrendingUp, Target, BarChart3,
  Clock, CheckCircle2, Circle, Eye, UserPlus, ShoppingCart
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell
} from '@/components/ui/table'
import {
  Tooltip, TooltipContent, TooltipTrigger
} from '@/components/ui/tooltip'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid
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
  return `${(Number(val) * 100).toFixed(1)}%`
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
          .order('snapshot_date', { ascending: false })
          .limit(20),
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
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', height: 120 }} />
        ))}
      </div>
    )
  }

  const funnelCards = [
    {
      label: 'Page Views',
      value: funnelBaseline?.raw_data?.unique_page_view_users
        ? formatNum(funnelBaseline.raw_data.unique_page_view_users)
        : formatNum(funnelBaseline?.page_views),
      icon: Eye,
      color: '#60a5fa',
    },
    {
      label: 'Registrations',
      value: formatNum(funnelBaseline?.registrations),
      icon: UserPlus,
      color: '#c084fc',
    },
    {
      label: 'Purchases',
      value: formatNum(funnelBaseline?.purchases),
      icon: ShoppingCart,
      color: '#4ade80',
    },
    {
      label: 'Purchase Rate',
      value: formatPct(funnelBaseline?.conversion_rate_purchase),
      icon: TrendingUp,
      color: '#C9A84C',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <FlaskConical size={20} style={{ color: 'var(--gold)' }} />
          CRO Lab
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Conversion Rate Optimization — A/B Testing Dashboard
        </p>
      </div>

      {/* Section 1: Funnel Overview */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--gold)' }}>◆</span> Funnel Overview
          {funnelBaseline?.snapshot_date && (
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              — {funnelBaseline.snapshot_date}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {funnelCards.map(card => {
            const Icon = card.icon
            return (
              <div
                key={card.label}
                className="rounded-xl p-4"
                style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} style={{ color: card.color }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{card.label}</span>
                </div>
                <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{card.value}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Conversion Rate Over Time Chart */}
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

      {/* Section 2: Active Experiments */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--gold)' }}>◆</span> Active Experiments
          <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({activeExperiments.length})</span>
        </h2>
        {activeExperiments.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-muted)' }}
          >
            No active experiments
          </div>
        ) : (
          <div className="space-y-3">
            {activeExperiments.map(exp => (
              <div
                key={exp.id}
                className="rounded-xl p-4"
                style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
              >
                <div className="flex flex-wrap items-start gap-2 mb-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{exp.name}</span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
                  >
                    <Circle size={6} fill="#4ade80" /> Active
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}
                  >
                    {exp.page}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  <span>Element: <span style={{ color: 'var(--text-primary)' }}>{exp.element}</span></span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {daysSince(exp.started_at)} days running
                  </span>
                  <span>Started: {new Date(exp.started_at).toLocaleDateString()}</span>
                </div>

                {/* Variants */}
                {exp.variants && Object.keys(exp.variants).length > 0 && (
                  <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid hsl(45 10% 16%)' }}>
                    <div className="text-[10px] font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Variants
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
                                    <span className="font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>{variantName}:</span>
                                    <span style={{ color: 'var(--text-primary)' }}>"{String(value)}"</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div key={key} className="flex gap-2 text-xs">
                            <span className="font-mono" style={{ color: 'var(--text-muted)' }}>{key}:</span>
                            <span style={{ color: 'var(--text-primary)' }}>"{String(variants)}"</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Hypothesis Backlog */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--gold)' }}>◆</span>
          <Target size={14} style={{ color: 'var(--gold)' }} />
          Hypothesis Backlog
          <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({hypotheses.length})</span>
        </h2>
        {hypotheses.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-muted)' }}
          >
            No hypotheses yet
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: 'hsl(45 10% 20%)' }}>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Priority</TableHead>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Hypothesis</TableHead>
                  <TableHead className="text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Funnel Stage</TableHead>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hypotheses.map(h => {
                  const pc = priorityColor(h.priority_score)
                  const ss = statusStyle(h.status)
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
                            <span className="text-xs cursor-help" style={{ color: 'var(--text-primary)' }}>
                              {h.hypothesis}
                            </span>
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
                      <TableCell className="py-3">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                          style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}
                        >
                          {h.status}
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

      {/* Section 4: Results History */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--gold)' }}>◆</span>
          <BarChart3 size={14} style={{ color: 'var(--gold)' }} />
          Results History
        </h2>
        {results.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-muted)' }}
          >
            No results yet
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: 'hsl(45 10% 20%)' }}>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Date</TableHead>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Experiment</TableHead>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Variant</TableHead>
                  <TableHead className="text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Page Views</TableHead>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Purchases</TableHead>
                  <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Purchase Rate</TableHead>
                  <TableHead className="text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Registrations</TableHead>
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
                    <TableCell className="py-2.5 text-xs hidden md:table-cell" style={{ color: 'var(--text-primary)' }}>
                      {formatNum(r.registrations)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Section 5: Completed Experiments */}
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
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}
                    >
                      {exp.page}
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
