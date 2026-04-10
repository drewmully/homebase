import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingDown, TrendingUp, Users, UserMinus } from 'lucide-react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface SubscriberSummary {
  active_count: number
  churned_30d: number
  monthly_churn_rate: number
  avg_ltv_active: number
  acquired_30d: number
  net_30d: number
}

interface ChurnTrendRow {
  month: string
  churned_count: number
}

interface AcqTrendRow {
  month: string
  acquired_count: number
}

interface Subscriber {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  status: string
  churned_at: string | null
  loop_subscription_spent: number | null
  order_count: number | null
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString()
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function monthAbbr(iso: string) {
  // iso like "2025-04-01"
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />
}

// ─────────────────────────────────────────────
// Churn Bar Chart (CSS-only)
// ─────────────────────────────────────────────
function ChurnBarChart({ data }: { data: ChurnTrendRow[] }) {
  const max = Math.max(...data.map(d => d.churned_count), 1)

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
    >
      <div className="text-sm font-medium mb-5" style={{ color: 'var(--text-primary)' }}>
        Churn Trend <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>last 12 months</span>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 140 }}>
        {data.map((row) => {
          const pct = (row.churned_count / max) * 100
          return (
            <div key={row.month} className="flex flex-col items-center flex-1 min-w-0" style={{ height: '100%' }}>
              {/* count label */}
              <div
                className="text-[9px] font-medium mb-1 leading-none"
                style={{ color: 'var(--gold)' }}
              >
                {row.churned_count}
              </div>
              {/* bar container */}
              <div className="flex-1 w-full flex items-end">
                <div
                  className="w-full rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${Math.max(pct, 4)}%`,
                    background: 'linear-gradient(to top, #C9A84C, rgba(201,168,76,0.7))',
                  }}
                />
              </div>
              {/* month label */}
              <div
                className="text-[9px] mt-1.5 leading-none"
                style={{ color: 'var(--text-muted)' }}
              >
                {monthAbbr(row.month)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Acquisition vs Churn dual-line chart (CSS/SVG)
// ─────────────────────────────────────────────
function DualLineChart({ acqData, churnData }: { acqData: AcqTrendRow[]; churnData: ChurnTrendRow[] }) {
  // Align by month
  const months = useMemo(() => {
    const set = new Set([...acqData.map(d => d.month), ...churnData.map(d => d.month)])
    return Array.from(set).sort()
  }, [acqData, churnData])

  const acqMap = useMemo(() => Object.fromEntries(acqData.map(d => [d.month, d.acquired_count])), [acqData])
  const churnMap = useMemo(() => Object.fromEntries(churnData.map(d => [d.month, d.churned_count])), [churnData])

  const allVals = months.flatMap(m => [acqMap[m] ?? 0, churnMap[m] ?? 0])
  const maxVal = Math.max(...allVals, 1)

  // SVG dimensions
  const W = 600
  const H = 160
  const PAD_L = 36
  const PAD_R = 16
  const PAD_T = 12
  const PAD_B = 32
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  const xStep = months.length > 1 ? chartW / (months.length - 1) : chartW

  function toY(val: number) {
    return PAD_T + chartH - (val / maxVal) * chartH
  }

  function pointsFor(vals: number[]) {
    return vals.map((v, i) => `${PAD_L + i * xStep},${toY(v)}`).join(' ')
  }

  const acqVals = months.map(m => acqMap[m] ?? 0)
  const churnVals = months.map(m => churnMap[m] ?? 0)

  // Y-axis labels (0, mid, max)
  const yTicks = [0, Math.round(maxVal / 2), maxVal]

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Acquisition vs Churn
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: '#4ade80' }} />
            Acquired
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: '#ef4444' }} />
            Churned
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
          {/* Grid lines */}
          {yTicks.map(tick => (
            <g key={tick}>
              <line
                x1={PAD_L} y1={toY(tick)}
                x2={W - PAD_R} y2={toY(tick)}
                stroke="hsl(45 10% 16%)" strokeWidth={1}
              />
              <text
                x={PAD_L - 4} y={toY(tick) + 3}
                textAnchor="end" fontSize={9}
                fill="hsl(45 10% 40%)"
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Acquisition line */}
          <polyline
            points={pointsFor(acqVals)}
            fill="none"
            stroke="#4ade80"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Churn line */}
          <polyline
            points={pointsFor(churnVals)}
            fill="none"
            stroke="#ef4444"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Dots — acq */}
          {acqVals.map((v, i) => (
            <circle
              key={`acq-${i}`}
              cx={PAD_L + i * xStep}
              cy={toY(v)}
              r={3}
              fill="#4ade80"
            />
          ))}
          {/* Dots — churn */}
          {churnVals.map((v, i) => (
            <circle
              key={`ch-${i}`}
              cx={PAD_L + i * xStep}
              cy={toY(v)}
              r={3}
              fill="#ef4444"
            />
          ))}

          {/* X-axis month labels */}
          {months.map((m, i) => (
            <text
              key={m}
              x={PAD_L + i * xStep}
              y={H - 4}
              textAnchor="middle"
              fontSize={9}
              fill="hsl(45 10% 40%)"
            >
              {monthAbbr(m)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Subscriber row
// ─────────────────────────────────────────────
function SubRow({ sub, showChurnDate }: { sub: Subscriber; showChurnDate?: boolean }) {
  const name = [sub.first_name, sub.last_name].filter(Boolean).join(' ') || sub.email
  const email = sub.email
  const ltv = sub.loop_subscription_spent ?? 0
  const orders = sub.order_count ?? 0

  return (
    <div
      className="flex items-center justify-between px-4 py-3 gap-4"
      style={{ borderBottom: '1px solid hsl(45 10% 17%)' }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {name}
        </div>
        <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {email}
          {showChurnDate && sub.churned_at && (
            <span style={{ color: '#ef4444' }}> · Churned {fmtDate(sub.churned_at)}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 text-right">
        <div>
          <div className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>
            {fmtMoney(ltv)}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>LTV</div>
        </div>
        <div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {orders}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>orders</div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub1,
  sub2,
  borderColor,
}: {
  label: string
  value: string
  sub1?: string
  sub2?: string
  borderColor?: string
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{
        background: 'var(--surface-card)',
        border: `1px solid ${borderColor || 'hsl(45 10% 20%)'}`,
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
      {sub1 && <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sub1}</div>}
      {sub2 && <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sub2}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function SubscribersPage() {
  const [summary, setSummary] = useState<SubscriberSummary | null>(null)
  const [churnTrend, setChurnTrend] = useState<ChurnTrendRow[]>([])
  const [acqTrend, setAcqTrend] = useState<AcqTrendRow[]>([])
  const [recentChurns, setRecentChurns] = useState<Subscriber[]>([])
  const [topSpenders, setTopSpenders] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

    Promise.all([
      supabase.from('v_subscriber_summary').select('*').single(),
      supabase.from('mv_monthly_churn').select('*').gte('month', '2025-04-01').order('month'),
      supabase.from('mv_monthly_acquisitions').select('*').gte('month', '2025-04-01').order('month'),
      supabase.from('subscribers').select('*')
        .not('churned_at', 'is', null)
        .gte('churned_at', thirtyDaysAgo)
        .order('churned_at', { ascending: false })
        .limit(20),
      supabase.from('subscribers').select('*')
        .eq('status', 'active')
        .order('loop_subscription_spent', { ascending: false })
        .limit(10),
    ]).then(([s, ct, at, rc, ts]) => {
      if (s.data) setSummary(s.data as SubscriberSummary)
      if (ct.data) setChurnTrend(ct.data as ChurnTrendRow[])
      if (at.data) setAcqTrend(at.data as AcqTrendRow[])
      if (rc.data) setRecentChurns(rc.data as Subscriber[])
      if (ts.data) setTopSpenders(ts.data as Subscriber[])
      setLoading(false)
    })
  }, [])

  const net30d = summary ? (summary.acquired_30d ?? 0) - (summary.churned_30d ?? 0) : 0
  const netPositive = net30d >= 0

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)' }}
        >
          <Users size={18} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Subscribers</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Subscriber analytics &amp; churn tracking</p>
        </div>
      </div>

      {/* Summary stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Active"
            value={fmt(summary?.active_count)}
            sub1={`↓ from prev`}
            borderColor="var(--gold)"
          />
          <StatCard
            label="Churned"
            value={`${fmt(summary?.churned_30d)}/30d`}
            sub1={`${summary?.monthly_churn_rate?.toFixed(1) ?? '—'}% monthly`}
            borderColor="#ef4444"
          />
          <StatCard
            label="Avg LTV"
            value={fmtMoney(summary?.avg_ltv_active)}
            sub1="active subs"
            borderColor="#4ade80"
          />
          <StatCard
            label="Net 30d"
            value={`${netPositive ? '+' : ''}${net30d}`}
            sub1={`${fmt(summary?.acquired_30d)} in`}
            sub2={`${fmt(summary?.churned_30d)} out`}
            borderColor={netPositive ? '#4ade80' : '#ef4444'}
          />
        </div>
      )}

      {/* Churn Bar Chart */}
      {loading ? (
        <Skeleton className="h-52" />
      ) : churnTrend.length > 0 ? (
        <ChurnBarChart data={churnTrend} />
      ) : null}

      {/* Dual Line Chart */}
      {loading ? (
        <Skeleton className="h-52" />
      ) : (acqTrend.length > 0 || churnTrend.length > 0) ? (
        <DualLineChart acqData={acqTrend} churnData={churnTrend} />
      ) : null}

      {/* Recent Churns */}
      <section>
        <h2
          className="text-sm font-semibold mb-3 flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <UserMinus size={14} style={{ color: '#ef4444' }} />
          Recent Losses
          <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>last 30 days</span>
        </h2>
        {loading ? (
          <Skeleton className="h-48" />
        ) : recentChurns.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-muted)' }}
          >
            No churns in the last 30 days
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
          >
            {recentChurns.map((sub, i) => (
              <SubRow key={sub.id || i} sub={sub} showChurnDate />
            ))}
          </div>
        )}
      </section>

      {/* Top Spenders */}
      <section>
        <h2
          className="text-sm font-semibold mb-3 flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <TrendingUp size={14} style={{ color: 'var(--gold)' }} />
          Top Active Subscribers
          <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>by LTV</span>
        </h2>
        {loading ? (
          <Skeleton className="h-48" />
        ) : topSpenders.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-muted)' }}
          >
            No data
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
          >
            {topSpenders.map((sub, i) => (
              <SubRow key={sub.id || i} sub={sub} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
