import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useAppKV, useUpdateFocusEngine, useResolveIssue } from '@/lib/hooks'
import { ownerToKey } from '@/lib/supabase'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import { Check, TrendingUp, TrendingDown, Flame } from 'lucide-react'

function SkeletonCard({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl h-24 ${className}`} />
}

// --- Focus Engine ---
function FocusEngine() {
  const { user } = useAuth()
  const { data: issuesKV, isLoading: issuesLoading } = useAppKV('eos_issues')
  const { data: rocksKV, isLoading: rocksLoading } = useAppKV('rocks')
  const { data: metricsData, isLoading: metricsLoading } = useAppKV('current_metrics')
  const { data: focusData, isLoading: focusLoading } = useAppKV('focus_engine')
  const updateFocus = useUpdateFocusEngine()
  const resolveIssue = useResolveIssue()
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [stalePipeline, setStalePipeline] = useState<any[]>([])

  // Fetch overdue/upcoming subtasks directly from table
  useEffect(() => {
    supabase.from('rock_subtasks').select('*, rocks!inner(title, owner)')
      .eq('status', 'pending')
      .lte('due_date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
      .order('due_date')
      .then(({ data }) => { if (data) setSubtasks(data) })
    // Fetch pipeline deals with no update in 14+ days
    supabase.from('outings_pipeline').select('*')
      .in('status', ['pitched', 'negotiating'])
      .lt('updated_at', new Date(Date.now() - 14 * 86400000).toISOString())
      .order('value', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setStalePipeline(data) })
  }, [])

  const userKey = user?.key || 'drew'
  const loading = issuesLoading || rocksLoading || metricsLoading || focusLoading

  const userFocus = focusData?.users?.[userKey] || { streak: 0, xp: 0, level: 'Bogey' }

  const items = useMemo(() => {
    const scored: Array<{
      id: string; title: string; subtitle: string; priority?: string; entity?: string; type: string; score: number
    }> = []
    const now = Date.now()

    // ── Compute health scores for multiplier logic ──
    // Traction (0-25)
    let traction = 0
    const rocksForHealth = rocksKV?.rocks || []
    for (const r of rocksForHealth) {
      if (r.status === 'done') traction += 15
      else if (r.status === 'on_track') traction += 10
    }
    traction = Math.min(25, traction)

    // Data (0-25)
    let dataScore = 0
    const churnForHealth = metricsData?.churn?.monthly_churn_rate || 0
    const payFailForHealth = metricsData?.payments?.failure_rate || 0
    const subsForHealth = metricsData?.snapshots?.[metricsData.snapshots.length - 1]?.active || 0
    const revForHealth = metricsData?.revenue?.revenue_7d || 0
    const aovForHealth = metricsData?.revenue?.aov_7d || 0
    if (churnForHealth < 5) dataScore += 8; else if (churnForHealth < 10) dataScore += 4
    if (payFailForHealth < 10) dataScore += 5; else if (payFailForHealth < 30) dataScore += 2
    if (subsForHealth > 1000) dataScore += 4
    if (revForHealth > 0) dataScore += 4
    if (aovForHealth > 100) dataScore += 4
    dataScore = Math.min(25, dataScore)

    // Cash (0-25) — fixed heuristic
    const cashScore = 20 // approximate stable

    // Issues (0-25)
    let issuesScore = 25
    const issuesForHealth = issuesKV?.issues || []
    for (const issue of issuesForHealth) {
      if (issue.status === 'resolved') continue
      if (issue.priority === 'P0') issuesScore -= 4
      else if (issue.priority === 'P1') issuesScore -= 1
    }
    const weekAgoH = Date.now() - 7 * 24 * 60 * 60 * 1000
    let resolvedBonusH = 0
    for (const issue of issuesForHealth) {
      if (issue.status === 'resolved' && issue.resolved_at && new Date(issue.resolved_at).getTime() > weekAgoH) {
        resolvedBonusH += 2
      }
    }
    issuesScore = Math.min(25, Math.max(0, issuesScore + Math.min(5, resolvedBonusH)))

    const healthScores = { traction, data: dataScore, cash: cashScore, issues: issuesScore }

    // Health multiplier: if component < 8 → 2x, if < 15 → 1.5x, else 1x
    const getMultiplier = (component: 'traction' | 'data' | 'cash' | 'issues'): number => {
      const v = healthScores[component]
      if (v < 8) return 2.0
      if (v < 15) return 1.5
      return 1.0
    }

    // Issues from app_kv.eos_issues.issues
    const issues = issuesKV?.issues || []
    for (const issue of issues) {
      if (issue.status === 'resolved') continue
      const created = issue.created_at ? new Date(issue.created_at).getTime() : now
      const daysSince = Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)))
      const issueOwnerKey = issue.owner ? ownerToKey(issue.owner) : null
      const multiplier = getMultiplier('issues')

      if (issue.priority === 'P0') {
        if (issueOwnerKey === userKey) {
          scored.push({
            id: issue.id, title: issue.title,
            subtitle: `P0 · ${daysSince}d open`,
            priority: 'P0', entity: issue.entity, type: 'issue',
            score: Math.round((100 + daysSince * 2) * multiplier),
          })
        } else if (!issue.owner || issue.owner === 'Unassigned') {
          scored.push({
            id: issue.id, title: issue.title,
            subtitle: `P0 · Unassigned · ${daysSince}d`,
            priority: 'P0', entity: issue.entity, type: 'issue',
            score: Math.round(60 * multiplier),
          })
        }
      } else if (issue.priority === 'P1' && issueOwnerKey === userKey) {
        scored.push({
          id: issue.id, title: issue.title,
          subtitle: `P1 · ${daysSince}d open`,
          priority: 'P1', entity: issue.entity, type: 'issue',
          score: Math.round((50 + daysSince) * multiplier),
        })
      }
    }

    // Rocks from app_kv.rocks.rocks
    const rocks = rocksKV?.rocks || []
    for (const rock of rocks) {
      const rockOwnerKey = rock.owner ? ownerToKey(rock.owner) : null
      if (rockOwnerKey !== userKey) continue
      if (rock.status === 'done') continue
      const statusScores: Record<string, number> = { at_risk: 120, push_now: 90, needs_focus: 60 }
      const s = statusScores[rock.status]
      if (s) {
        const multiplier = getMultiplier('traction')
        scored.push({
          id: `rock-${rock.id}`, title: rock.title,
          subtitle: `Rock · ${rock.status.replace('_', ' ')}`,
          entity: rock.business, type: 'rock', score: Math.round(s * multiplier),
        })
      }
    }

    // Overdue subtasks — most actionable items (Traction component)
    for (const st of subtasks) {
      const rockOwner = st.rocks?.owner ? ownerToKey(st.rocks.owner) : null
      if (rockOwner !== userKey) continue
      const dueDate = st.due_date ? new Date(st.due_date) : null
      const overdue = dueDate && dueDate.getTime() < now
      const multiplier = getMultiplier('traction')
      scored.push({
        id: `subtask-${st.id}`, title: st.title,
        subtitle: `Rock: ${st.rocks?.title?.substring(0, 30)} · ${overdue ? 'OVERDUE' : 'due ' + st.due_date}`,
        type: 'subtask', score: Math.round((overdue ? 115 : 85) * multiplier),
      })
    }

    // Stale pipeline deals needing follow-up (Data component — deal tracking)
    for (const deal of stalePipeline) {
      const daysSince = Math.floor((now - new Date(deal.updated_at).getTime()) / 86400000)
      const multiplier = getMultiplier('data')
      scored.push({
        id: `deal-${deal.id}`, title: `Follow up: ${deal.name}`,
        subtitle: `${deal.status} · $${(deal.value/1000).toFixed(0)}K · ${daysSince}d since last update`,
        type: 'pipeline', score: Math.round((75 + Math.min(daysSince, 30)) * multiplier),
      })
    }

    // Metric-driven items (Data component)
    const churnRate = metricsData?.churn?.monthly_churn_rate || 0
    const payFailRate = metricsData?.payments?.failure_rate || 0
    const dataMultiplier = getMultiplier('data')
    if (churnRate > 10) {
      scored.push({ id: 'metric-churn', title: 'Address churn rate', subtitle: `Churn at ${churnRate}%`, type: 'metric', score: Math.round(80 * dataMultiplier) })
    }
    if (payFailRate > 40) {
      scored.push({ id: 'metric-payfail', title: 'Fix payment failures', subtitle: `Failure rate ${payFailRate}%`, type: 'metric', score: Math.round(70 * dataMultiplier) })
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 5)
  }, [issuesKV, rocksKV, metricsData, userKey, subtasks, stalePipeline])

  const handleDone = async (item: typeof items[0]) => {
    setDoneIds(prev => new Set(prev).add(item.id))
    if (focusData) {
      const updated = JSON.parse(JSON.stringify(focusData))
      if (!updated.users) updated.users = {}
      if (!updated.users[userKey]) updated.users[userKey] = { streak: 0, xp: 0, level: 'Bogey' }
      updated.users[userKey].xp = (updated.users[userKey].xp || 0) + 10
      updateFocus.mutate({ data: updated })
    }
    if (item.type === 'issue') {
      const realId = item.id // eos-xxx format
      resolveIssue.mutate({ id: realId })
    }
  }

  if (loading) {
    return <div className="space-y-2">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--gold)' }}>
          <Flame size={16} />
          <span className="font-semibold">{userFocus.streak || 0}-day streak</span>
        </div>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Level {userFocus.level || 'Bogey'} · {userFocus.xp || 0} XP
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            <p className="text-sm">All clear — nothing urgent right now.</p>
          </div>
        )}
        {items.filter(it => !doneIds.has(it.id)).map((item, i) => (
          <div
            key={item.id}
            data-testid={`focus-card-${item.id}`}
            className="rounded-xl p-4 flex items-center gap-4 transition-all duration-300"
            style={{
              background: 'var(--surface-card)',
              border: i === 0 ? '1px solid var(--gold)' : '1px solid hsl(45 10% 20%)',
              borderLeftWidth: i === 0 ? '3px' : '1px',
              borderLeftColor: i === 0 ? 'var(--gold)' : 'hsl(45 10% 20%)',
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: i === 0 ? 'var(--gold)' : 'transparent',
                color: i === 0 ? 'var(--surface-darkest)' : 'var(--text-muted)',
                border: i === 0 ? 'none' : '1px solid hsl(45 10% 25%)',
              }}
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</span>
                {item.priority && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      background: item.priority === 'P0' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: item.priority === 'P0' ? 'var(--error)' : 'var(--warning)',
                    }}
                  >
                    {item.priority}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.subtitle}</span>
                {item.entity && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(45 10% 18%)', color: 'var(--text-muted)' }}>
                    {item.entity}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDone(item)}
              data-testid={`button-done-${item.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 touch-target flex-shrink-0"
              style={{
                background: 'rgba(74, 222, 128, 0.1)',
                color: 'var(--success)',
                border: '1px solid rgba(74, 222, 128, 0.2)',
              }}
            >
              <Check size={14} /> Done
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Health Score Ring ---
function HealthScore() {
  const { data: metricsData } = useAppKV('current_metrics')
  const { data: issuesKV } = useAppKV('eos_issues')
  const { data: rocksKV } = useAppKV('rocks')
  const [expanded, setExpanded] = useState<string | null>(null)

  const scores = useMemo(() => {
    // Traction (25)
    let traction = 0
    const rocks = rocksKV?.rocks || []
    for (const r of rocks) {
      if (r.status === 'done') traction += 15
      else if (r.status === 'on_track') traction += 10
    }
    traction = Math.min(25, traction)

    // Data (25)
    let dataScore = 0
    const churn = metricsData?.churn?.monthly_churn_rate || 0
    const payFail = metricsData?.payments?.failure_rate || 0
    const subs = metricsData?.snapshots?.[metricsData.snapshots.length - 1]?.active || 0
    const rev = metricsData?.revenue?.revenue_7d || 0
    const aov = metricsData?.revenue?.aov_7d || 0
    if (churn < 5) dataScore += 8; else if (churn < 10) dataScore += 4
    if (payFail < 10) dataScore += 5; else if (payFail < 30) dataScore += 2
    if (subs > 1000) dataScore += 4
    if (rev > 0) dataScore += 4
    if (aov > 100) dataScore += 4
    dataScore = Math.min(25, dataScore)

    // Cash (25)
    let cashScore = 0
    const cashBal = 29163 // approximate from real_cash
    if (cashBal > 50000) cashScore = 15
    else if (cashBal > 20000) cashScore = 10
    else if (cashBal > 10000) cashScore = 5
    cashScore += 5 + 5
    cashScore = Math.min(25, cashScore)

    // Issues (25)
    let issuesScore = 25
    const issues = issuesKV?.issues || []
    for (const issue of issues) {
      if (issue.status === 'resolved') continue
      if (issue.priority === 'P0') issuesScore -= 4
      else if (issue.priority === 'P1') issuesScore -= 1
    }
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    let resolvedBonus = 0
    for (const issue of issues) {
      if (issue.status === 'resolved' && issue.resolved_at && new Date(issue.resolved_at).getTime() > weekAgo) {
        resolvedBonus += 2
      }
    }
    issuesScore = Math.min(25, Math.max(0, issuesScore + Math.min(5, resolvedBonus)))

    return { traction, data: dataScore, cash: cashScore, issues: issuesScore }
  }, [metricsData, issuesKV, rocksKV])

  const total = scores.traction + scores.data + scores.cash + scores.issues
  const circumference = 2 * Math.PI * 54
  const dashOffset = circumference - (total / 100) * circumference

  const bars = [
    { key: 'traction', label: 'Traction', value: scores.traction, max: 25 },
    { key: 'data', label: 'Data', value: scores.data, max: 25 },
    { key: 'cash', label: 'Cash', value: scores.cash, max: 25 },
    { key: 'issues', label: 'Issues', value: scores.issues, max: 25 },
  ]

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
      <div className="flex items-center gap-6">
        <div className="relative flex-shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(45 10% 18%)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke="var(--gold)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color: 'var(--gold)' }}>{total}</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>/ 100</span>
          </div>
        </div>
        <div className="flex-1 space-y-2.5">
          {bars.map(bar => (
            <div key={bar.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{bar.label}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{bar.value}/{bar.max}</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'hsl(45 10% 18%)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(bar.value / bar.max) * 100}%`,
                    background: bar.value > bar.max * 0.7 ? 'var(--success)' : bar.value > bar.max * 0.4 ? 'var(--gold)' : 'var(--error)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- KPI Card ---
function KPICard({ label, value, subtitle, delta, deltaPositive }: {
  label: string; value: string; subtitle?: string; delta?: string; deltaPositive?: boolean
}) {
  return (
    <div
      data-testid={`kpi-${label.toLowerCase().replace(/\s/g, '-')}`}
      className="rounded-xl p-4"
      style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
    >
      <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
      <div className="flex items-center gap-2 mt-1">
        {subtitle && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{subtitle}</span>}
        {delta && (
          <span
            className="text-[11px] font-medium flex items-center gap-0.5"
            style={{ color: deltaPositive ? 'var(--success)' : 'var(--error)' }}
          >
            {deltaPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {delta}
          </span>
        )}
      </div>
    </div>
  )
}

// --- Cash Chart ---
function CashChart({ entity }: { entity: 'mully' | 'mfs' }) {
  const forecastId = entity === 'mully' ? 'forecast_mully' : 'forecast_mfs'
  const { data: forecastData, isLoading } = useAppKV(forecastId)

  const chartData = useMemo(() => {
    if (!forecastData?.forecast) return []
    return forecastData.forecast.map((w: any) => ({
      week: w.week_label || `Wk${w.week}`,
      balance: w.closing_cash || 0,
    }))
  }, [forecastData])

  if (isLoading) return <div className="skeleton rounded-xl h-48" />
  if (chartData.length === 0) return null

  const hasNegative = chartData.some((d: any) => d.balance < 0)

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
      <div className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>13-Week Cash Forecast</div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#C9A84C" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(45 10% 16%)" />
          <XAxis dataKey="week" tick={{ fill: '#8a8778', fontSize: 10 }} axisLine={{ stroke: 'hsl(45 10% 20%)' }} tickLine={false} />
          <YAxis tick={{ fill: '#8a8778', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: '#232320', border: '1px solid hsl(45 10% 25%)', borderRadius: '8px', color: '#e8e4d9', fontSize: 12 }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
          />
          {hasNegative && <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5} />}
          <Area type="monotone" dataKey="balance" stroke="#C9A84C" fill="url(#goldGrad)" strokeWidth={2}
            dot={(props: any) => {
              if (props.payload?.balance < 0) return <circle cx={props.cx} cy={props.cy} r={4} fill="#ef4444" stroke="none" />
              return <circle cx={props.cx} cy={props.cy} r={0} />
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// --- Main Pulse Page ---
export default function PulsePage() {
  const [entity, setEntity] = useState<'mully' | 'mfs'>('mully')
  const { data: metricsData, isLoading: metricsLoading } = useAppKV('current_metrics')

  // Pull metrics from the real structure
  const latest = metricsData?.snapshots?.[metricsData.snapshots?.length - 1]
  const prevSnapshot = metricsData?.snapshots?.[metricsData.snapshots?.length - 2]
  const rev = metricsData?.revenue
  const payments = metricsData?.payments
  const trends = metricsData?.trends

  const fmtMoney = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`
  const fmtPct = (v: number) => `${v.toFixed(1)}%`

  const kpiCards = metricsData ? [
    { label: 'Revenue', value: fmtMoney(rev?.revenue_7d || 0), subtitle: '7-day', delta: trends?.revenue_7d_change ? `+$${trends.revenue_7d_change.toFixed(0)}` : undefined, deltaPositive: true },
    { label: 'Orders', value: String(rev?.orders_7d || latest?.orders || 0), subtitle: '7-day' },
    { label: 'Active Subs', value: (latest?.active || 0).toLocaleString(), delta: trends?.active_change ? `+${trends.active_change}` : undefined, deltaPositive: true },
    { label: 'AOV', value: `$${(rev?.aov_7d || 0).toFixed(2)}`, subtitle: '7-day' },
    { label: 'Paused', value: (latest?.paused || 0).toLocaleString() },
    { label: 'Cancelled', value: (latest?.inactive || 0).toLocaleString() },
    { label: 'Churn Rate', value: fmtPct(metricsData?.churn?.monthly_churn_rate || 0) },
    { label: 'Failures', value: fmtPct(payments?.failure_rate || 0), subtitle: `${payments?.unique_subs_failed || 0}/${payments?.unique_subs_billed || 0} subs` },
    { label: 'Unfulfilled', value: (rev?.unfulfilled || 0).toLocaleString() },
    { label: 'Est. MRR', value: '$76.6K', subtitle: 'Estimated' },
    { label: 'Cash', value: '$29,163', subtitle: '4 accounts' },
  ] : []

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Pulse</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Your daily operations snapshot</p>
      </div>

      {/* Focus Engine */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--gold)' }}>◆</span> Focus Engine
        </h2>
        <FocusEngine />
      </section>

      {/* Entity Toggle */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'hsl(45 10% 14%)' }}>
        {(['mully', 'mfs'] as const).map(e => (
          <button
            key={e}
            data-testid={`toggle-entity-${e}`}
            onClick={() => setEntity(e)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 touch-target"
            style={{
              background: entity === e ? 'var(--gold)' : 'transparent',
              color: entity === e ? 'var(--surface-darkest)' : 'var(--text-muted)',
            }}
          >
            {e === 'mully' ? 'Mully' : 'MFS'}
          </button>
        ))}
      </div>

      {/* Health Score */}
      <section>
        <HealthScore />
      </section>

      {/* KPI Cards */}
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Key Metrics</h2>
        {metricsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4,5,6,7,8].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCards.map(card => (
              <KPICard key={card.label} {...card} />
            ))}
          </div>
        )}
      </section>

      {/* Cash Chart */}
      <section>
        <CashChart entity={entity} />
      </section>
    </div>
  )
}
