import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  FlaskConical, TrendingUp, Target, BarChart3,
  Clock, CheckCircle2, Circle, Eye, UserPlus,
  ShoppingCart, ArrowRight, Monitor, Zap, Trophy,
  AlertTriangle, Loader2, History, Crown
} from 'lucide-react'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell
} from '@/components/ui/table'
import {
  Tooltip, TooltipContent, TooltipTrigger
} from '@/components/ui/tooltip'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell,
  LineChart, Line, ReferenceLine, Label
} from 'recharts'

/* ─── Interfaces ─── */

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
  primary_metric?: string | null
}

/* Map a primary_metric value to a short human label for the badge. */
function primaryMetricLabel(metric: string | null | undefined): string {
  switch (metric) {
    case 'purchase': return 'Purchase'
    case 'plan_selection': return 'Plan Selection'
    case 'onboarding_start': return 'Onboarding Start'
    case 'registration': return 'Registration'
    case 'dashboard_view': return 'Dashboard View'
    default: return 'Purchase'
  }
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

interface ArchiveRow {
  id: string
  experiment_id: string
  experiment_name: string
  page: string
  element: string
  started_at: string
  ended_at: string
  duration_days: number
  winning_variant: string
  control_visitors: number
  control_conversions: number
  control_rate: number
  winner_visitors: number
  winner_conversions: number
  winner_rate: number
  relative_lift_pct: number
  absolute_lift_pct: number
  confidence_score: number
  decided_by: string
  hypotheses_tested: string[]
  created_at: string
}

/* ─── Stats helpers ─── */

function zTestConfidence(controlVisitors: number, controlConversions: number, variantVisitors: number, variantConversions: number): number {
  if (controlVisitors < 1 || variantVisitors < 1) return 0
  const pC = controlConversions / controlVisitors
  const pV = variantConversions / variantVisitors
  const pPool = (controlConversions + variantConversions) / (controlVisitors + variantVisitors)
  if (pPool === 0 || pPool === 1) return 0
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / controlVisitors + 1 / variantVisitors))
  if (se === 0) return 0
  const z = Math.abs(pV - pC) / se
  // Approximate two-tailed p-value from z-score using error function approximation
  const p = 2 * (1 - normalCDF(z))
  return Math.max(0, Math.min(100, (1 - p) * 100))
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1.0 + sign * y)
}

/* ─── Format helpers ─── */

function daysSince(dateStr: string): number {
  const start = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function formatPct(val: number | null | undefined): string {
  if (val == null) return '\u2014'
  return `${(Number(val) * 100).toFixed(2)}%`
}

function formatNum(val: number | null | undefined): string {
  if (val == null) return '\u2014'
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

function liftColor(lift: number): string {
  if (lift > 0) return '#4ade80'
  if (lift < 0) return '#ef4444'
  return '#8a8778'
}

function confidenceBadge(conf: number): { label: string; color: string; bg: string; border: string } {
  if (conf >= 95) return { label: `${conf.toFixed(1)}%`, color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.3)' }
  if (conf >= 80) return { label: `${conf.toFixed(1)}%`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' }
  return { label: conf > 0 ? `${conf.toFixed(1)}%` : 'N/A', color: '#8a8778', bg: 'rgba(138,135,120,0.1)', border: 'rgba(138,135,120,0.3)' }
}

/* ─── Funnel step component ─── */
function FunnelStep({ label, value, pct, color, isLast, deltaPct, deltaLabel }: {
  label: string; value: string; pct?: string; color: string; isLast?: boolean;
  deltaPct?: number | null; deltaLabel?: string
}) {
  const hasDelta = typeof deltaPct === 'number' && Number.isFinite(deltaPct)
  const deltaColor = !hasDelta ? '#8a8778' : (deltaPct! >= 0 ? '#4ade80' : '#f87171')
  const deltaSign = hasDelta && deltaPct! >= 0 ? '+' : ''
  return (
    <div className="flex items-center gap-2 flex-1 min-w-[120px]">
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          {label}
        </div>
        <div className="text-xl font-bold" style={{ color }}>{value}</div>
        {hasDelta && (
          <div className="text-[10px] mt-0.5 flex items-center gap-1">
            <span style={{ color: deltaColor, fontWeight: 600 }}>{deltaSign}{deltaPct!.toFixed(1)}%</span>
            {deltaLabel && <span style={{ color: 'var(--text-muted)' }}>{deltaLabel}</span>}
          </div>
        )}
        {!hasDelta && pct && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{pct}{pct.includes('of') ? '' : ' of homepage'}</div>}
      </div>
      {!isLast && <ArrowRight size={14} style={{ color: 'hsl(45 10% 25%)' }} className="shrink-0 hidden md:block" />}
    </div>
  )
}

/* ─── Variant Performance Card ─── */
interface VariantPerf {
  variant: string
  visitors: number
  conversions: number
  rate: number
  confidence: number
  liftVsControl: number
}

function VariantPerformanceCard({ experiment, variantResults, onDeclareWinner }: {
  experiment: Experiment
  variantResults: ResultRow[]
  onDeclareWinner: (experiment: Experiment, variant: string, perf: VariantPerf) => void
}) {
  // Aggregate per-variant data from result rows
  const latestByVariant = new Map<string, ResultRow>()
  for (const r of variantResults) {
    if (r.experiment_id === experiment.id) {
      const existing = latestByVariant.get(r.variant)
      if (!existing || r.snapshot_date > existing.snapshot_date) {
        latestByVariant.set(r.variant, r)
      }
    }
  }

  if (latestByVariant.size === 0) {
    return (
      <div className="rounded-lg p-3 mt-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid hsl(45 10% 16%)' }}>
        <div className="text-[10px] font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Variant Performance
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Waiting for variant data. The CRO cron will populate per-variant results on its next run.
        </div>
      </div>
    )
  }

  // Build perf array
  const controlRow = latestByVariant.get('control')
  const controlRate = controlRow && controlRow.page_views > 0
    ? controlRow.purchases / controlRow.page_views
    : 0

  const perfs: VariantPerf[] = []
  latestByVariant.forEach((row, variant) => {
    const visitors = row.page_views || 0
    const conversions = row.purchases || 0
    const rate = visitors > 0 ? conversions / visitors : 0
    const liftVsControl = controlRate > 0 && variant !== 'control'
      ? ((rate - controlRate) / controlRate) * 100
      : 0

    let confidence = 0
    if (variant !== 'control' && controlRow) {
      confidence = zTestConfidence(
        controlRow.page_views || 0, controlRow.purchases || 0,
        visitors, conversions
      )
    }

    perfs.push({ variant, visitors, conversions, rate, confidence, liftVsControl })
  })

  // Sort: control first, then by rate descending
  perfs.sort((a, b) => {
    if (a.variant === 'control') return -1
    if (b.variant === 'control') return 1
    return b.rate - a.rate
  })

  const totalVisitors = perfs.reduce((s, p) => s + p.visitors, 0)

  return (
    <div className="rounded-lg p-3 mt-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid hsl(45 10% 16%)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Variant Performance
        </div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {formatNum(totalVisitors)} total visitors
        </div>
      </div>

      <div className="space-y-1.5">
        {perfs.map(p => {
          const cb = confidenceBadge(p.confidence)
          const isControl = p.variant === 'control'
          const hasEnoughData = p.visitors >= 100
          const isSignificant = p.confidence >= 95
          const canDeclare = hasEnoughData && !isControl

          return (
            <div key={p.variant} className="rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 18%)' }}>
              <div className="flex items-center gap-3">
                {/* Variant badge */}
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 min-w-[70px] text-center"
                  style={{
                    background: isControl ? 'rgba(138,135,120,0.15)' : 'rgba(201,168,76,0.1)',
                    color: isControl ? '#8a8778' : '#C9A84C',
                    border: isControl ? '1px solid rgba(138,135,120,0.3)' : '1px solid rgba(201,168,76,0.3)',
                  }}
                >
                  {p.variant}
                </span>

                {/* Stats row */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="text-center">
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Visitors</div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{formatNum(p.visitors)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Purchases</div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{formatNum(p.conversions)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Conv. Rate</div>
                    <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>{(p.rate * 100).toFixed(2)}%</div>
                  </div>
                  {!isControl && (
                    <>
                      <div className="text-center">
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Lift</div>
                        <div className="text-xs font-bold" style={{ color: liftColor(p.liftVsControl) }}>
                          {p.liftVsControl > 0 ? '+' : ''}{p.liftVsControl.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Confidence</div>
                        <span
                          className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: cb.bg, color: cb.color, border: `1px solid ${cb.border}` }}
                        >
                          {cb.label}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Declare Winner button */}
                {canDeclare && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onDeclareWinner(experiment, p.variant, p)}
                        className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all"
                        style={{
                          background: isSignificant ? 'rgba(201,168,76,0.15)' : 'rgba(138,135,120,0.1)',
                          color: isSignificant ? '#C9A84C' : '#8a8778',
                          border: `1px solid ${isSignificant ? 'rgba(201,168,76,0.4)' : 'rgba(138,135,120,0.3)'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <Crown size={10} />
                          Declare Winner
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-xs text-xs"
                      style={{ background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid hsl(45 10% 28%)' }}
                    >
                      {!hasEnoughData
                        ? 'Need at least 100 visitors per variant'
                        : isSignificant
                          ? 'Statistically significant result. Ready to push live.'
                          : `Confidence is ${p.confidence.toFixed(1)}%. Consider waiting for 95%+ significance.`
                      }
                    </TooltipContent>
                  </Tooltip>
                )}

                {isSignificant && !isControl && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0"
                    style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
                  >
                    Significant
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Declare Winner Modal ─── */
function DeclareWinnerModal({ open, onOpenChange, experiment, variant, perf, onConfirm, confirming }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  experiment: Experiment | null
  variant: string
  perf: VariantPerf | null
  onConfirm: () => void
  confirming: boolean
}) {
  if (!experiment || !perf) return null
  const lowConfidence = perf.confidence < 95

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 25%)', color: 'var(--text-primary)' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base" style={{ color: 'var(--text-primary)' }}>
            <Crown size={16} style={{ color: 'var(--gold)' }} />
            Declare Winner
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            Push this variant to 100% of traffic
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Experiment name */}
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Experiment: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{experiment.name}</span>
          </div>

          {/* Winner info */}
          <div className="rounded-lg p-3" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <div className="flex items-center gap-3">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' }}
              >
                {variant}
              </span>
              <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
                <span className="font-bold" style={{ color: 'var(--gold)' }}>{(perf.rate * 100).toFixed(2)}%</span> conv. rate
              </div>
              <div className="text-xs" style={{ color: liftColor(perf.liftVsControl) }}>
                {perf.liftVsControl > 0 ? '+' : ''}{perf.liftVsControl.toFixed(1)}% vs control
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span>{formatNum(perf.visitors)} visitors</span>
              <span>{formatNum(perf.conversions)} purchases</span>
              <span>Confidence: {perf.confidence.toFixed(1)}%</span>
            </div>
          </div>

          {/* Low confidence warning */}
          {lowConfidence && (
            <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
              <div className="text-xs" style={{ color: '#f59e0b' }}>
                This variant has not reached statistical significance ({perf.confidence.toFixed(1)}% confidence, need 95%+). The result may be due to random chance. Are you sure?
              </div>
            </div>
          )}

          {/* What happens */}
          <div className="text-[10px] space-y-1" style={{ color: 'var(--text-muted)' }}>
            <div className="font-semibold uppercase tracking-wider mb-1">On confirmation:</div>
            <div>1. Experiment marked as completed with this winner</div>
            <div>2. Flag overrides set so all users see this variant</div>
            <div>3. Result archived with lift metrics</div>
            <div>4. CRO cron will wire up the next queued test</div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-4 py-2 text-xs font-medium transition-all"
            style={{ background: 'rgba(138,135,120,0.1)', color: '#8a8778', border: '1px solid rgba(138,135,120,0.3)', cursor: 'pointer' }}
            disabled={confirming}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="rounded-lg px-4 py-2 text-xs font-semibold transition-all flex items-center gap-1.5"
            style={{
              background: 'rgba(201,168,76,0.15)',
              color: '#C9A84C',
              border: '1px solid rgba(201,168,76,0.4)',
              cursor: confirming ? 'not-allowed' : 'pointer',
              opacity: confirming ? 0.6 : 1,
            }}
          >
            {confirming ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={12} />}
            {confirming ? 'Pushing...' : 'Push to Live'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Test Archive Section ─── */
function TestArchiveSection({ archive, conversionHistory }: { archive: ArchiveRow[]; conversionHistory: { date: string; rate: number }[] }) {
  if (archive.length === 0) return null

  // Summary stats
  const totalTests = archive.length
  const winners = archive.filter(a => a.relative_lift_pct > 0)
  const avgLift = winners.length > 0
    ? winners.reduce((s, a) => s + Number(a.relative_lift_pct), 0) / winners.length
    : 0
  const bestTest = archive.reduce((best, a) => Number(a.relative_lift_pct) > Number(best.relative_lift_pct) ? a : best, archive[0])

  // Cumulative lift chart data: build from archive sorted by ended_at
  const sorted = [...archive].sort((a, b) => new Date(a.ended_at).getTime() - new Date(b.ended_at).getTime())
  const cumulativeData = sorted.map((a, i) => ({
    label: a.experiment_name.length > 20 ? a.experiment_name.slice(0, 20) + '...' : a.experiment_name,
    lift: Number(a.relative_lift_pct),
    cumulativeLift: sorted.slice(0, i + 1).reduce((s, x) => s + Number(x.relative_lift_pct), 0) / (i + 1),
    date: new Date(a.ended_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    decidedBy: a.decided_by,
  }))

  return (
    <section>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <span style={{ color: 'var(--gold)' }}>&#9670;</span>
        <History size={14} style={{ color: 'var(--gold)' }} />
        Test Archive
        <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
          ({totalTests} completed)
        </span>
      </h2>

      {/* Summary Bar */}
      <div
        className="rounded-xl p-4 mb-3 flex flex-wrap gap-6"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
      >
        <div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tests Completed</div>
          <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{totalTests}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Winners</div>
          <div className="text-lg font-bold" style={{ color: '#4ade80' }}>{winners.length}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Avg Winner Lift</div>
          <div className="text-lg font-bold" style={{ color: avgLift > 0 ? '#4ade80' : '#8a8778' }}>
            {avgLift > 0 ? '+' : ''}{avgLift.toFixed(1)}%
          </div>
        </div>
        {bestTest && Number(bestTest.relative_lift_pct) > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Best Test</div>
            <div className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>
              {bestTest.experiment_name}: +{Number(bestTest.relative_lift_pct).toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {/* Cumulative Lift Chart */}
      {cumulativeData.length > 1 && (
        <div className="rounded-xl p-4 mb-3" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Lift per Test
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={cumulativeData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(45 10% 16%)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#8a8778', fontSize: 10 }} />
              <YAxis tick={{ fill: '#8a8778', fontSize: 10 }} tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`} />
              <RechartsTooltip
                contentStyle={{ background: '#232320', border: '1px solid hsl(45 10% 25%)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#8a8778' }}
                formatter={(value: number, name: string) => [
                  `${value > 0 ? '+' : ''}${value.toFixed(1)}%`,
                  name === 'lift' ? 'Lift' : 'Avg Lift'
                ]}
              />
              <ReferenceLine y={0} stroke="hsl(45 10% 25%)" />
              <Bar dataKey="lift" radius={[4, 4, 0, 0]}>
                {cumulativeData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.lift > 0 ? '#4ade80' : entry.lift < 0 ? '#ef4444' : '#8a8778'} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Archive Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: 'hsl(45 10% 20%)' }}>
              <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Test</TableHead>
              <TableHead className="text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Element</TableHead>
              <TableHead className="text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Duration</TableHead>
              <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Winner</TableHead>
              <TableHead className="text-xs" style={{ color: 'var(--text-muted)' }}>Lift</TableHead>
              <TableHead className="text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Confidence</TableHead>
              <TableHead className="text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {archive.map(a => {
              const lift = Number(a.relative_lift_pct)
              const conf = Number(a.confidence_score)
              const cb = confidenceBadge(conf)
              return (
                <TableRow key={a.id} style={{ borderColor: 'hsl(45 10% 18%)' }}>
                  <TableCell className="py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    {a.experiment_name}
                  </TableCell>
                  <TableCell className="py-2.5 text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>
                    {a.element}
                  </TableCell>
                  <TableCell className="py-2.5 text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>
                    {a.duration_days}d
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: a.winning_variant === 'control' ? 'rgba(138,135,120,0.1)' : 'rgba(201,168,76,0.1)',
                        color: a.winning_variant === 'control' ? '#8a8778' : '#C9A84C',
                        border: a.winning_variant === 'control' ? '1px solid rgba(138,135,120,0.3)' : '1px solid rgba(201,168,76,0.3)',
                      }}
                    >
                      {a.winning_variant}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 text-xs font-bold" style={{ color: liftColor(lift) }}>
                    {lift > 0 ? '+' : ''}{lift.toFixed(1)}%
                  </TableCell>
                  <TableCell className="py-2.5 hidden md:table-cell">
                    <span
                      className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: cb.bg, color: cb.color, border: `1px solid ${cb.border}` }}
                    >
                      {cb.label}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 text-xs capitalize hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>
                    {a.decided_by}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   ═══ MAIN CRO PAGE ═══════════════════════
   ═══════════════════════════════════════════ */

export default function CroPage() {
  const [loading, setLoading] = useState(true)
  const [funnelBaseline, setFunnelBaseline] = useState<ResultRow | null>(null)
  const [activeExperiments, setActiveExperiments] = useState<Experiment[]>([])
  const [completedExperiments, setCompletedExperiments] = useState<Experiment[]>([])
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [conversionHistory, setConversionHistory] = useState<any[]>([])
  const [archive, setArchive] = useState<ArchiveRow[]>([])

  // Declare Winner modal state
  const [declareOpen, setDeclareOpen] = useState(false)
  const [declareExperiment, setDeclareExperiment] = useState<Experiment | null>(null)
  const [declareVariant, setDeclareVariant] = useState('')
  const [declarePerf, setDeclarePerf] = useState<VariantPerf | null>(null)
  const [confirming, setConfirming] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [
      { data: baselineData },
      { data: activeData },
      { data: completedData },
      { data: hypothesesData },
      { data: resultsData },
      { data: conversionData },
      { data: archiveData },
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
        .select('snapshot_date, conversion_rate_purchase, variant, page_views, purchases, experiment_id, raw_data')
        .eq('variant', 'baseline-all')
        .order('snapshot_date', { ascending: true })
        .limit(60),
      supabase
        .from('ab_experiment_archive')
        .select('*')
        .order('ended_at', { ascending: false }),
    ])

    setFunnelBaseline((baselineData?.[0] as ResultRow) || null)
    setActiveExperiments((activeData as Experiment[]) || [])
    setCompletedExperiments((completedData as Experiment[]) || [])
    setHypotheses((hypothesesData as Hypothesis[]) || [])
    setResults((resultsData as ResultRow[]) || [])
    // Dedupe baseline rows by snapshot_date. Multiple active experiments each write
    // their own 'baseline-all' row per day, which produces duplicate x-axis points.
    // Strategy: per date, pick the row with the most page_views (that's the real sitewide funnel).
    const bestByDate = new Map<string, any>()
    for (const r of (conversionData || []) as any[]) {
      const existing = bestByDate.get(r.snapshot_date)
      if (!existing || (r.page_views || 0) > (existing.page_views || 0)) {
        bestByDate.set(r.snapshot_date, r)
      }
    }
    setConversionHistory(
      Array.from(bestByDate.values())
        .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
        .map((r: any) => ({
          date: r.snapshot_date,
          rate: r.conversion_rate_purchase ? Number(r.conversion_rate_purchase) * 100 : 0,
          views: r.page_views || 0,
          purchases: r.purchases || 0,
        }))
    )
    setArchive((archiveData as ArchiveRow[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadData])

  // Declare winner handler
  const handleDeclareWinner = (experiment: Experiment, variant: string, perf: VariantPerf) => {
    setDeclareExperiment(experiment)
    setDeclareVariant(variant)
    setDeclarePerf(perf)
    setDeclareOpen(true)
  }

  const handleConfirmWinner = async () => {
    if (!declareExperiment || !declarePerf) return
    setConfirming(true)

    try {
      const exp = declareExperiment
      const now = new Date().toISOString()
      const durationDays = daysSince(exp.started_at)

      // Get control perf for archive
      const controlResults = results.filter(r => r.experiment_id === exp.id && r.variant === 'control')
      const controlRow = controlResults.length > 0
        ? controlResults.reduce((latest, r) => r.snapshot_date > latest.snapshot_date ? r : latest, controlResults[0])
        : null

      // 1. Update experiment to completed
      await supabase
        .from('ab_experiments')
        .update({
          status: 'completed',
          winning_variant: declareVariant,
          ended_at: now,
        })
        .eq('id', exp.id)

      // 2. Update hypotheses
      const linkedHypotheses = hypotheses.filter(h => h.experiment_id === exp.id)
      for (const h of linkedHypotheses) {
        await supabase
          .from('ab_hypotheses')
          .update({ status: h.status === 'testing' ? 'validated' : h.status })
          .eq('id', h.id)
      }

      // 3. Insert flag overrides
      if (exp.variants) {
        for (const [flagKey, variants] of Object.entries(exp.variants)) {
          if (typeof variants === 'object' && variants !== null && declareVariant in variants) {
            await supabase
              .from('flag_overrides')
              .upsert({
                flag_key: flagKey,
                forced_variant: declareVariant,
                forced_at: now,
                forced_by: 'drew',
              }, { onConflict: 'flag_key' })
          }
        }
      }

      // 4. Insert archive row
      await supabase
        .from('ab_experiment_archive')
        .insert({
          experiment_id: exp.id,
          experiment_name: exp.name,
          page: exp.page,
          element: exp.element,
          started_at: exp.started_at,
          ended_at: now,
          duration_days: durationDays,
          winning_variant: declareVariant,
          control_visitors: controlRow?.page_views || 0,
          control_conversions: controlRow?.purchases || 0,
          control_rate: controlRow && controlRow.page_views > 0 ? controlRow.purchases / controlRow.page_views : 0,
          winner_visitors: declarePerf.visitors,
          winner_conversions: declarePerf.conversions,
          winner_rate: declarePerf.rate,
          relative_lift_pct: declarePerf.liftVsControl,
          absolute_lift_pct: declarePerf.rate - (controlRow && controlRow.page_views > 0 ? controlRow.purchases / controlRow.page_views : 0),
          confidence_score: declarePerf.confidence,
          decided_by: 'drew',
          hypotheses_tested: linkedHypotheses.map(h => h.hypothesis),
        })

      // Close modal and reload
      setDeclareOpen(false)
      setConfirming(false)
      await loadData()
    } catch (err) {
      console.error('Failed to declare winner:', err)
      setConfirming(false)
    }
  }

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
  const homepageViews = raw.unique_homepage_users || raw.unique_page_view_users || funnelBaseline?.page_views || 0
  const onboardingStarts = raw.onboarding_starts || raw.unique_onboarding_users || 0
  const planSelections = raw.plan_selections || raw.subscription_state || raw.unique_plan_selection_users || 0
  const purchases = raw.purchases || funnelBaseline?.purchases || raw.unique_purchase_users || 0
  const dashboardViews = raw.dashboard_visits || funnelBaseline?.dashboard_visits || raw.wallet_users || 0
  const newAccounts = raw.new_accounts || 0
  const homepageViewsPrior = raw.homepage_views_prior || 0
  const homepagePctChange = typeof raw.homepage_views_pct_change === 'number'
    ? raw.homepage_views_pct_change
    : (homepageViewsPrior > 0 ? ((homepageViews - homepageViewsPrior) / homepageViewsPrior) * 100 : null)
  const newAccountsPctChange = typeof raw.new_accounts_pct_change === 'number'
    ? raw.new_accounts_pct_change
    : null
  const purchaseRate = homepageViews > 0 ? (purchases / homepageViews) : 0

  // Funnel bar chart data
  const funnelBarData = [
    { step: 'Homepage', count: homepageViews, color: '#60a5fa' },
    { step: 'Onboarding', count: onboardingStarts, color: '#c084fc' },
    { step: 'Plan Select', count: planSelections, color: '#f59e0b' },
    { step: 'New Account', count: newAccounts, color: '#34d399' },
    { step: 'Purchase', count: purchases, color: '#4ade80' },
    { step: 'Dashboard', count: dashboardViews, color: '#C9A84C' },
  ]

  // Separate testing vs queued hypotheses
  const testingHypotheses = hypotheses.filter(h => h.status === 'testing')
  const queuedHypotheses = hypotheses.filter(h => h.status === 'pending')

  // Next cron run info. The cron runs every 6 hours at :00 UTC (0, 6, 12, 18).
  const nextCronHours = (() => {
    const now = new Date()
    const h = now.getUTCHours()
    const nextSlot = [0, 6, 12, 18].find(s => s > h)
    if (typeof nextSlot === 'number') return nextSlot - h
    return 24 - h // next 0 UTC
  })()

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Declare Winner Modal */}
      <DeclareWinnerModal
        open={declareOpen}
        onOpenChange={setDeclareOpen}
        experiment={declareExperiment}
        variant={declareVariant}
        perf={declarePerf}
        onConfirm={handleConfirmWinner}
        confirming={confirming}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <FlaskConical size={20} style={{ color: 'var(--gold)' }} />
            CRO Lab
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Automated A/B testing, analyzing every 6 hours
          </p>
        </div>
        <div
          className="rounded-lg px-3 py-1.5 text-[10px] font-medium flex items-center gap-1.5"
          style={{ background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
        >
          <Zap size={10} /> Auto-pilot active &middot; next analysis in {nextCronHours}h
        </div>
      </div>

      {/* ─── CONVERSION FUNNEL ─── */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--gold)' }}>&#9670;</span> Conversion Funnel
          {funnelBaseline?.snapshot_date && (
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              {'\u2014'} 7-day snapshot ({funnelBaseline.snapshot_date})
            </span>
          )}
        </h2>

        {/* Funnel steps row */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
        >
          <div className="flex flex-wrap md:flex-nowrap gap-4 md:gap-2">
            <FunnelStep
              label="Site Visitors"
              value={formatNum(homepageViews)}
              color="#60a5fa"
              deltaPct={homepagePctChange}
              deltaLabel="vs prior 3d"
            />
            <FunnelStep label="Onboarding Start" value={formatNum(onboardingStarts)} pct={homepageViews > 0 ? `${((onboardingStarts/homepageViews)*100).toFixed(1)}%` : undefined} color="#c084fc" />
            <FunnelStep label="Plan Selection" value={formatNum(planSelections)} pct={homepageViews > 0 ? `${((planSelections/homepageViews)*100).toFixed(1)}%` : undefined} color="#f59e0b" />
            <FunnelStep
              label="New Account"
              value={formatNum(newAccounts)}
              pct={homepageViews > 0 ? `${((newAccounts/homepageViews)*100).toFixed(1)}% of visitors` : undefined}
              color="#34d399"
              deltaPct={newAccountsPctChange}
              deltaLabel="vs prior 3d"
            />
            <FunnelStep label="Purchase" value={formatNum(purchases)} pct={homepageViews > 0 ? `${((purchases/homepageViews)*100).toFixed(1)}%` : undefined} color="#4ade80" />
            <FunnelStep label="Dashboard" value={formatNum(dashboardViews)} pct={homepageViews > 0 ? `${((dashboardViews/homepageViews)*100).toFixed(1)}%` : undefined} color="#C9A84C" isLast />
          </div>

          {/* Purchase rate callout */}
          <div className="mt-4 pt-3 flex items-center gap-3" style={{ borderTop: '1px solid hsl(45 10% 18%)' }}>
            <TrendingUp size={14} style={{ color: 'var(--gold)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Purchase rate (3-day trailing)</span>
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
          <span style={{ color: 'var(--gold)' }}>&#9670;</span> Live Experiments
          <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({activeExperiments.length} running)</span>
        </h2>
        {activeExperiments.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-muted)' }}
          >
            No active experiments. The cron will deploy the next test automatically.
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
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    title="Primary metric this experiment is optimizing for"
                    style={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' }}
                  >
                    Optimizing: {primaryMetricLabel(exp.primary_metric)}
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

                {/* Variant Performance (NEW) */}
                <VariantPerformanceCard
                  experiment={exp}
                  variantResults={results}
                  onDeclareWinner={handleDeclareWinner}
                />

                {/* Testing hypotheses linked to this experiment */}
                {testingHypotheses.filter(h => h.experiment_id === exp.id).length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid hsl(45 10% 16%)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Hypotheses under test
                    </div>
                    {testingHypotheses.filter(h => h.experiment_id === exp.id).map(h => (
                      <div key={h.id} className="text-xs mb-1" style={{ color: 'var(--text-primary)' }}>
                        &bull; {h.hypothesis}
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
            <span style={{ color: 'var(--gold)' }}>&#9670;</span> Purchase Rate Trend
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              {'\u2014'} 3-day trailing, by snapshot date
            </span>
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
          <span style={{ color: 'var(--gold)' }}>&#9670;</span>
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
                                {idx === 0 && <span className="text-[10px] mr-1.5 font-semibold" style={{ color: 'var(--gold)' }}>NEXT UP &rarr;</span>}
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
            <span style={{ color: 'var(--gold)' }}>&#9670;</span>
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
                      {r.ab_experiments?.name || '\u2014'}
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

      {/* ─── TEST ARCHIVE (replaces old Completed Experiments) ─── */}
      <TestArchiveSection archive={archive} conversionHistory={conversionHistory} />

      {/* ─── COMPLETED EXPERIMENTS (shown only if no archive data yet) ─── */}
      {archive.length === 0 && completedExperiments.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--gold)' }}>&#9670;</span>
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
