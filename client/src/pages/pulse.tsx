import { useState, useMemo, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useAppKV, useUpdateFocusEngine } from '@/lib/hooks'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import { Check, Flame, AlertCircle, HelpCircle } from 'lucide-react'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const USER_KEY_TO_OWNER: Record<string, string> = { drew: 'Drew', jack: 'Jack', joe: 'Joe' }

function fmtMoney(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function getScoreWeeks() {
  // Start from 4/6/2026 (first week of data), show 4 weeks
  const mondays: Date[] = []
  const today = new Date()
  const dayOfWeek = today.getDay()
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  thisMonday.setHours(0, 0, 0, 0)
  // Show this week and next 3 weeks
  for (let i = 0; i < 4; i++) {
    const d = new Date(thisMonday)
    d.setDate(thisMonday.getDate() + i * 7)
    mondays.push(d)
  }
  return mondays
}

function formatMonday(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function toISODate(d: Date) {
  return d.toISOString().split('T')[0]
}

// ─────────────────────────────────────────────
// Section 1: Focus Engine
// ─────────────────────────────────────────────
interface FocusItem {
  id: string
  title: string
  subtitle: string
  type: 'subtask' | 'pipeline'
  score: number
}

function FocusEngine() {
  const { user } = useAuth()
  const userKey = user?.key || 'drew'
  const ownerName = USER_KEY_TO_OWNER[userKey] || 'Drew'

  const { data: focusData } = useAppKV('focus_engine')
  const updateFocus = useUpdateFocusEngine()
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [overdueAlert, setOverdueAlert] = useState<any[]>([])
  const [items, setItems] = useState<FocusItem[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const now = Date.now()
      const sevenDaysFromNow = new Date(now + 7 * 86400000).toISOString().split('T')[0]
      const thirtyDaysFromNow = new Date(now + 30 * 86400000).toISOString().split('T')[0]
      const fourteenDaysAgo = new Date(now - 14 * 86400000).toISOString()

      const [
        { data: subtasksData },
        { data: staleOutings },
        { data: staleMfs },
        { data: invoicesData },
      ] = await Promise.all([
        supabase
          .from('rock_subtasks')
          .select('*, rocks!inner(title, owner, business)')
          .eq('status', 'pending')
          .order('due_date')
          .limit(20),
        supabase
          .from('outings_pipeline')
          .select('*')
          .in('status', ['pitched', 'negotiating'])
          .lt('updated_at', fourteenDaysAgo)
          .order('value', { ascending: false })
          .limit(5),
        supabase
          .from('mfs_pipeline')
          .select('*')
          .in('status', ['proposal', 'negotiating', 'contacted'])
          .lt('updated_at', fourteenDaysAgo)
          .limit(5),
        supabase
          .from('invoices')
          .select('*')
          .in('status', ['overdue', 'upcoming'])
          .order('due_date'),
      ])

      const scored: FocusItem[] = []
      const today = new Date().toISOString().split('T')[0]

      // Overdue subtasks (score: 150) and due-this-week (score: 100)
      for (const st of subtasksData || []) {
        const rockOwner = (st.rocks?.owner || '').toLowerCase()
        if (rockOwner !== ownerName.toLowerCase()) continue
        const dueDate = st.due_date
        const isOverdue = dueDate && dueDate < today
        const isDueSoon = dueDate && dueDate >= today && dueDate <= thirtyDaysFromNow
        const isUnscheduled = !dueDate

        const rockTitle = st.rocks?.title || 'Unknown Rock'
        const business = st.rocks?.business || ''
        let score = 0
        let label = ''
        if (isOverdue) { score = 150; label = 'OVERDUE' }
        else if (isDueSoon) { 
          const daysOut = Math.ceil((new Date(dueDate!).getTime() - now) / 86400000)
          score = 120 - daysOut  // closer = higher priority
          label = `due in ${daysOut}d`
        }
        else if (isUnscheduled) { score = 80; label = 'unscheduled' }
        else { continue } // far future, skip

        scored.push({
          id: `subtask-${st.id}`,
          title: st.title,
          subtitle: `Rock: ${rockTitle.substring(0, 28)}${business ? ' · ' + business : ''} · ${label}`,
          type: 'subtask',
          score,
        })
      }

      // Stale outings pipeline
      for (const deal of staleOutings || []) {
        const daysSince = Math.floor((now - new Date(deal.updated_at).getTime()) / 86400000)
        const val = deal.value ? ` — ${fmtMoney(deal.value)}` : ''
        scored.push({
          id: `outing-${deal.id}`,
          title: `Follow up: ${deal.name}${val}, ${daysSince}d stale`,
          subtitle: `Pipeline · Outings`,
          type: 'pipeline',
          score: 80,
        })
      }

      // Stale MFS pipeline
      for (const deal of staleMfs || []) {
        const daysSince = Math.floor((now - new Date(deal.updated_at).getTime()) / 86400000)
        const val = deal.value ? ` — ${fmtMoney(deal.value)}` : ''
        scored.push({
          id: `mfs-${deal.id}`,
          title: `Follow up: ${deal.name || deal.company || 'Deal'}${val}, ${daysSince}d stale`,
          subtitle: `Pipeline · MFS`,
          type: 'pipeline',
          score: 80,
        })
      }

      // Store overdue invoices for alert banner (not in focus items)
      const overdueInvoices = (invoicesData || []).filter((i: any) => i.status === 'overdue')
      if (overdueInvoices.length > 0) {
        setOverdueAlert(overdueInvoices)
      }

      scored.sort((a, b) => b.score - a.score)
      setItems(scored.slice(0, 5))
      setLoading(false)
    }
    load()
  }, [ownerName])

  const userFocus = focusData?.users?.[userKey] || { streak: 0, xp: 0, level: 'Bogey' }

  const handleDone = async (item: FocusItem) => {
    setDoneIds(prev => new Set(prev).add(item.id))
    if (focusData) {
      const updated = JSON.parse(JSON.stringify(focusData))
      if (!updated.users) updated.users = {}
      if (!updated.users[userKey]) updated.users[userKey] = { streak: 0, xp: 0, level: 'Bogey' }
      updated.users[userKey].xp = (updated.users[userKey].xp || 0) + 10
      updateFocus.mutate({ data: updated })
    }
    // If subtask, mark done in DB
    if (item.type === 'subtask') {
      const subtaskId = item.id.replace('subtask-', '')
      await supabase
        .from('rock_subtasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', subtaskId)
    }
  }

  const visibleItems = items.filter(it => !doneIds.has(it.id))

  return (
    <div>
      {/* Streak row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--gold)' }}>
          <Flame size={15} />
          <span className="font-semibold">{userFocus.streak || 0}-day streak</span>
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {userFocus.level || 'Bogey'} · {userFocus.xp || 0} XP
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton rounded-lg h-14" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div
          className="rounded-xl px-5 py-6 text-center text-sm"
          style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 18%)', color: 'var(--text-muted)' }}
        >
          All clear — no pending tasks right now.
        </div>
      ) : (
        <div className="space-y-1.5">
          {visibleItems.map((item, i) => (
            <div
              key={item.id}
              data-testid={`focus-card-${item.id}`}
              className="rounded-xl flex items-center gap-3 transition-all duration-200"
              style={{
                background: 'var(--surface-card)',
                border: i === 0 ? '1px solid var(--gold)' : '1px solid hsl(45 10% 20%)',
                borderLeftWidth: i === 0 ? '3px' : '1px',
                borderLeftColor: i === 0 ? 'var(--gold)' : 'hsl(45 10% 20%)',
                padding: '10px 12px',
              }}
            >
              {/* Number */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={{
                  background: i === 0 ? 'var(--gold)' : 'transparent',
                  color: i === 0 ? 'var(--surface-darkest)' : 'var(--text-muted)',
                  border: i === 0 ? 'none' : '1px solid hsl(45 10% 28%)',
                }}
              >
                {i + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-snug truncate" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {item.subtitle}
                </div>
              </div>

              {/* Done button */}
              <button
                onClick={() => handleDone(item)}
                data-testid={`button-done-${item.id}`}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 flex-shrink-0"
                style={{
                  background: 'rgba(74,222,128,0.08)',
                  color: 'var(--success)',
                  border: '1px solid rgba(74,222,128,0.2)',
                }}
              >
                <Check size={12} />
                Done
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Section 2: Health Score Ring
// ─────────────────────────────────────────────
function HealthScore() {
  const { data: metricsData } = useAppKV('current_metrics')
  const { data: issuesKV } = useAppKV('eos_issues')
  const { data: rocksKV } = useAppKV('rocks')

  const scores = useMemo(() => {
    let traction = 0
    const rocks = rocksKV?.rocks || []
    for (const r of rocks) {
      if (r.status === 'done') traction += 15
      else if (r.status === 'on_track') traction += 10
    }
    traction = Math.min(25, traction)

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

    let cashScore = 0
    const cashBal = 29163
    if (cashBal > 50000) cashScore = 15
    else if (cashBal > 20000) cashScore = 10
    else if (cashBal > 10000) cashScore = 5
    cashScore += 10
    cashScore = Math.min(25, cashScore)

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
    <div className="rounded-xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
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

// ─────────────────────────────────────────────
// Section 3: EOS Scorecard
// ─────────────────────────────────────────────

interface ScorecardRow {
  id: string
  entity: string
  measurable: string
  label?: string
  goal: string | null
  data_source: string
  auto_fill_query: string | null
  sort_order: number
}

interface ScorecardEntry {
  scorecard_id: string
  week_start: string
  value: string | null
  auto_value: string | null
}

function ScorecardCell({
  row,
  weekStart,
  entry,
  onSave,
}: {
  row: ScorecardRow
  weekStart: string
  entry: ScorecardEntry | undefined
  onSave: (scorecardId: string, weekStart: string, value: string) => void
}) {
  const isManual = row.data_source === 'manual' || !row.auto_fill_query
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [tooltip, setTooltip] = useState(false)

  const displayVal = entry?.auto_value ?? entry?.value

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const commit = () => {
    if (inputVal.trim()) {
      onSave(row.id, weekStart, inputVal.trim())
    }
    setEditing(false)
    setInputVal('')
  }

  if (!isManual && displayVal) {
    return (
      <td
        className="text-center px-2 py-1.5 text-xs font-medium"
        style={{ color: 'var(--gold)', borderRight: '1px solid hsl(45 10% 20%)' }}
      >
        {displayVal}
      </td>
    )
  }

  if (!isManual && !displayVal) {
    return (
      <td
        className="text-center px-2 py-1.5 text-xs"
        style={{ color: 'hsl(45 10% 35%)', borderRight: '1px solid hsl(45 10% 20%)' }}
      >
        AUTO
      </td>
    )
  }

  // Manual cell
  if (editing) {
    return (
      <td style={{ borderRight: '1px solid hsl(45 10% 20%)', padding: '2px 4px' }}>
        <input
          ref={inputRef}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setInputVal('') } }}
          className="w-full text-center text-xs rounded px-1 py-0.5 outline-none"
          style={{
            background: 'hsl(45 10% 16%)',
            color: 'var(--text-primary)',
            border: '1px solid var(--gold)',
            minWidth: 0,
          }}
          placeholder="—"
        />
      </td>
    )
  }

  if (displayVal) {
    return (
      <td
        className="text-center px-2 py-1.5 text-xs cursor-pointer hover:bg-white/5 transition-colors"
        style={{ color: 'var(--text-primary)', borderRight: '1px solid hsl(45 10% 20%)' }}
        onClick={() => { setEditing(true); setInputVal(displayVal) }}
      >
        {displayVal}
      </td>
    )
  }

  // Empty manual cell — show "?" with tooltip on hover
  return (
    <td
      className="text-center px-2 py-1.5 cursor-pointer hover:bg-white/5 transition-colors relative"
      style={{ borderRight: '1px solid hsl(45 10% 20%)' }}
      onClick={() => setEditing(true)}
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      <span style={{ color: 'hsl(45 10% 35%)' }}>—</span>
      {tooltip && (
        <div
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1 text-[10px] rounded px-2 py-1 whitespace-nowrap"
          style={{
            background: '#1a1a18',
            border: '1px solid hsl(45 10% 28%)',
            color: 'var(--text-muted)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          Click to enter · Source: {row.data_source}
        </div>
      )}
    </td>
  )
}


// Format scorecard values based on measurable type
function formatScorecardValue(value: string | null | undefined, measurable: string, isGoal?: boolean): string {
  if (!value || value === '—') return '—'
  const num = parseFloat(value)
  if (isNaN(num)) return value
  
  const isCurrency = measurable.toLowerCase().includes('cash') || 
    measurable.toLowerCase().includes('spend') || 
    measurable.toLowerCase().includes('sales') || 
    measurable.toLowerCase().includes('cost') ||
    measurable.toLowerCase().includes('revenue')
  const isPercent = measurable.includes('%') || 
    measurable.toLowerCase().includes('converted') ||
    measurable.toLowerCase().includes('convert')
  const isDays = measurable.toLowerCase().includes('ship time')
  
  if (isCurrency) {
    const abs = Math.abs(num)
    const formatted = abs >= 1000 ? `$${(abs/1000).toFixed(abs >= 10000 ? 0 : 1)}K` : `$${abs.toFixed(0)}`
    return num < 0 ? `-${formatted}` : formatted
  }
  if (isPercent) return isGoal ? value : `${num}%`
  if (isDays) return `${num.toFixed(1)}d`
  if (num >= 1000) return num.toLocaleString('en-US', {maximumFractionDigits: 0})
  return value
}

// Color code value vs goal
function getGoalColor(value: string | null | undefined, goal: string | null | undefined, measurable: string): string {
  if (!value || !goal || value === '—') return 'var(--text-muted)'
  const numVal = parseFloat(value)
  const numGoal = parseFloat(goal.replace(/[,$%K]/g, ''))
  if (isNaN(numVal) || isNaN(numGoal) || numGoal === 0) return '#e8e4d9'
  
  // Metrics where LOWER is better
  const lowerIsBetter = measurable.toLowerCase().includes('lost') || 
    measurable.toLowerCase().includes('cost') ||
    measurable.toLowerCase().includes('labor') ||
    measurable.toLowerCase().includes('ship time') ||
    measurable.toLowerCase().includes('spend')
  
  if (lowerIsBetter) {
    if (numVal <= numGoal) return '#4ade80' // green — at or below target
    if (numVal <= numGoal * 1.3) return '#C9A84C' // gold — close
    return '#ef4444' // red — over target
  } else {
    if (numVal >= numGoal) return '#4ade80' // green
    if (numVal >= numGoal * 0.7) return '#C9A84C' // gold
    return '#ef4444' // red
  }
}

function GoalCell({ row, onGoalSave }: { row: ScorecardRow; onGoalSave: (id: string, goal: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(row.goal || '')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])

  if (editing) {
    return (
      <td className="text-center px-1 py-1" style={{ borderRight: '1px solid hsl(45 10% 20%)' }}>
        <input
          ref={ref}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => { setEditing(false); if (val.trim()) onGoalSave(row.id, val.trim()) }}
          onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); if (val.trim()) onGoalSave(row.id, val.trim()) } }}
          className="w-full text-center text-xs bg-transparent border-b outline-none"
          style={{ color: '#C9A84C', borderColor: '#C9A84C', maxWidth: 70 }}
        />
      </td>
    )
  }
  return (
    <td
      className="text-center px-2 py-2 cursor-pointer hover:opacity-80"
      style={{ color: row.goal ? '#C9A84C' : 'var(--text-muted)', borderRight: '1px solid hsl(45 10% 20%)', fontSize: 12 }}
      onClick={() => setEditing(true)}
      title="Click to set goal"
    >
      {formatScorecardValue(row.goal, row.measurable || '', true) || '—'}
    </td>
  )
}
function EosScorecard({ entity }: { entity: 'mully' | 'mfs' }) {
  const [rows, setRows] = useState<ScorecardRow[]>([])
  const [entries, setEntries] = useState<ScorecardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [overdueAlert, setOverdueAlert] = useState<any[]>([])

  const mondays = useMemo(() => getScoreWeeks(), [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const fourWeeksAgo = toISODate(mondays[0])
      const [{ data: sc }, { data: en }] = await Promise.all([
        supabase.from('scorecard').select('*').order('entity').order('sort_order'),
        supabase.from('scorecard_entries').select('*').gte('week_start', fourWeeksAgo),
      ])
      setRows(sc || [])
      setEntries(en || [])
      setLoading(false)
    }
    load()
  }, [])

  const handleGoalSave = async (scorecardId: string, goal: string) => {
    setRows(prev => prev.map(r => r.id === scorecardId ? { ...r, goal } : r))
    await supabase.from('scorecard').update({ goal }).eq('id', scorecardId)
  }

  const handleSave = async (scorecardId: string, weekStart: string, value: string) => {
    // Optimistic update
    setEntries(prev => {
      const existing = prev.find(e => e.scorecard_id === scorecardId && e.week_start === weekStart)
      if (existing) {
        return prev.map(e =>
          e.scorecard_id === scorecardId && e.week_start === weekStart
            ? { ...e, value }
            : e
        )
      }
      return [...prev, { scorecard_id: scorecardId, week_start: weekStart, value, auto_value: null }]
    })
    // Upsert to DB
    await supabase.from('scorecard_entries').upsert(
      { scorecard_id: scorecardId, week_start: weekStart, value },
      { onConflict: 'scorecard_id,week_start' }
    )
  }

  const entityRows = rows.filter(r => r.entity?.toLowerCase() === entity)
  const entityLabel = entity === 'mully' ? 'MULLY (eCOMMERCE)' : 'MFS (3PL)'

  const getEntry = (rowId: string, weekStart: string) =>
    entries.find(e => e.scorecard_id === rowId && e.week_start === weekStart)

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton rounded h-8" />)}
      </div>
    )
  }

  if (entityRows.length === 0) {
    return (
      <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
        No scorecard rows for {entity.toUpperCase()} yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        <thead>
          {/* Entity header row */}
          <tr>
            <td
              colSpan={mondays.length + 2}
              className="px-3 py-2 font-semibold text-[11px] tracking-wider"
              style={{
                background: '#1a1a18',
                color: 'var(--gold)',
                borderTop: '1px solid hsl(45 10% 22%)',
                borderBottom: '1px solid hsl(45 10% 22%)',
              }}
            >
              {entityLabel} — {entityRows.length} measurables
            </td>
          </tr>
          {/* Column headers */}
          <tr style={{ background: '#1a1a18' }}>
            <th
              className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-wider"
              style={{ color: 'var(--gold)', borderRight: '1px solid hsl(45 10% 20%)', minWidth: 180 }}
            >
              Measurable
            </th>
            <th
              className="text-center px-3 py-2 font-semibold text-[10px] uppercase tracking-wider"
              style={{ color: 'var(--gold)', borderRight: '1px solid hsl(45 10% 20%)', minWidth: 60 }}
            >
              Goal
            </th>
            {mondays.map(mon => (
              <th
                key={mon.toISOString()}
                className="text-center px-2 py-2 font-semibold text-[10px]"
                style={{ color: 'var(--gold)', borderRight: '1px solid hsl(45 10% 20%)', minWidth: 56 }}
              >
                {formatMonday(mon)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entityRows.map((row, idx) => (
            <tr
              key={row.id}
              style={{
                background: idx % 2 === 0 ? 'var(--surface-card)' : 'hsl(45 10% 14%)',
                borderBottom: '1px solid hsl(45 10% 16%)',
              }}
            >
              {/* Label */}
              <td
                className="px-3 py-2"
                style={{ color: 'var(--text-primary)', borderRight: '1px solid hsl(45 10% 20%)' }}
              >
                <span title={`Data source: ${row.data_source || "manual"}`}>{row.measurable || row.label}</span>
              </td>
              {/* Goal — click to edit */}
              <GoalCell row={row} onGoalSave={handleGoalSave} />
              {/* Week cells */}
              {mondays.map(mon => {
                const ws = toISODate(mon)
                return (
                  <ScorecardCell
                    key={ws}
                    row={row}
                    weekStart={ws}
                    entry={getEntry(row.id, ws)}
                    onSave={handleSave}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────
// Section 4: Cash Chart
// ─────────────────────────────────────────────
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
      <div className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
        13-Week Cash Forecast
      </div>
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
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#C9A84C"
            fill="url(#goldGrad)"
            strokeWidth={2}
            dot={(props: any) => {
              if (props.payload?.balance < 0) return <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill="#ef4444" stroke="none" />
              return <circle key={props.key} cx={props.cx} cy={props.cy} r={0} />
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Pulse Page
// ─────────────────────────────────────────────
export default function PulsePage() {
  const [entity, setEntity] = useState<'mully' | 'mfs'>('mully')

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Pulse</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Your daily operations snapshot</p>
      </div>

      {/* Section 1: Focus Engine */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--gold)' }}>◆</span> Focus Engine
        </h2>
        <FocusEngine />
      </section>

      {/* Section 2: Entity Toggle + Health Score */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'hsl(45 10% 14%)' }}>
        {(['mully', 'mfs'] as const).map(e => (
          <button
            key={e}
            data-testid={`toggle-entity-${e}`}
            onClick={() => setEntity(e)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-200"
            style={{
              background: entity === e ? 'var(--gold)' : 'transparent',
              color: entity === e ? 'var(--surface-darkest)' : 'var(--text-muted)',
            }}
          >
            {e === 'mully' ? 'Mully' : 'MFS'}
          </button>
        ))}
      </div>

      <section>
        <HealthScore />
      </section>

      {/* Section 3: EOS Scorecard */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--gold)' }}>◆</span> EOS Scorecard
        </h2>
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid hsl(45 10% 20%)', background: 'var(--surface-card)' }}
        >
          <EosScorecard entity={entity} />
        </div>
      </section>

      {/* Section 4: Cash Chart */}
      <section>
        <CashChart entity={entity} />
      </section>
    </div>
  )
}
