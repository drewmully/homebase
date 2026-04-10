import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  ChevronDown, ChevronRight, CheckCircle2, Circle,
  AlertTriangle, Zap, Eye, Target, Check
} from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  on_track:    { label: 'On Track',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  push_now:    { label: 'Push Now',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  needs_focus: { label: 'Needs Focus', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  at_risk:     { label: 'At Risk',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  done:        { label: 'Done',        color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
}
const ALL_STATUSES = ['on_track', 'push_now', 'needs_focus', 'at_risk', 'done']

const OWNER_MAP: Record<string, string> = { drew: 'Drew', jack: 'Jack', joe: 'Joe' }

// ─────────────────────────────────────────────
// StatusBadge — dropdown to change status
// ─────────────────────────────────────────────
function StatusBadge({ status, rockId, onStatusChange }: {
  status: string; rockId: string; onStatusChange: (s: string) => void
}) {
  const [open, setOpen] = useState(false)
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.on_track

  return (
    <div className="relative">
      <button
        data-testid={`status-badge-${rockId}`}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all touch-target"
        style={{ background: config.bg, color: config.color }}
      >
        {status === 'done'        ? <CheckCircle2 size={12} /> :
         status === 'at_risk'     ? <AlertTriangle size={12} /> :
         status === 'push_now'    ? <Zap size={12} /> :
         status === 'needs_focus' ? <Eye size={12} /> :
         <Target size={12} />}
        {config.label}
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} style={{ pointerEvents: 'auto' }} />
          <div
            className="absolute top-full left-0 mt-1 z-50 rounded-lg py-1 min-w-[140px]"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 25%)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            {ALL_STATUSES.map(s => {
              const c = STATUS_CONFIG[s]
              return (
                <button
                  key={s}
                  data-testid={`status-option-${s}`}
                  onClick={() => { onStatusChange(s); setOpen(false) }}
                  className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors hover:bg-white/5"
                  style={{ color: c.color }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  {c.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Progress bar (read-only — auto-computed from subtasks)
// ─────────────────────────────────────────────
function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full">
      <div className="h-1.5 rounded-full" style={{ background: 'hsl(45 10% 18%)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: progress === 100 ? 'var(--success)' : 'var(--gold)',
          }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// RockCard — full expanded card
// ─────────────────────────────────────────────
function RockCard({
  rock, subtasks, expanded, onToggleExpand, onSubtaskToggle, onStatusChange
}: {
  rock: any
  subtasks: any[]
  expanded: boolean
  onToggleExpand: () => void
  onSubtaskToggle: (subtaskId: string, newStatus: 'done' | 'pending') => void
  onStatusChange: (s: string) => void
}) {
  const isDone = rock.status === 'done'
  const pendingSubtasks = subtasks.filter((s: any) => s.status !== 'done')
  const doneCount = subtasks.filter((s: any) => s.status === 'done').length
  const progress = subtasks.length > 0
    ? Math.round((doneCount / subtasks.length) * 100)
    : (rock.progress || 0)

  const nextSubtask = pendingSubtasks[0] || null

  return (
    <div
      data-testid={`rock-card-${rock.id}`}
      className="rounded-xl transition-all duration-200"
      style={{
        background: 'var(--surface-card)',
        border: isDone ? '1px solid hsl(45 10% 16%)' : '1px solid hsl(45 10% 20%)',
        opacity: isDone ? 0.7 : 1,
      }}
    >
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 mt-0.5">
            {isDone
              ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
              : <Circle size={16} style={{ color: 'var(--text-muted)' }} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                {rock.title}
              </h3>
              {rock.business && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
                  style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--gold)' }}
                >
                  {rock.business}
                </span>
              )}
            </div>

            {/* Status + progress row */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={rock.status} rockId={rock.id} onStatusChange={onStatusChange} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {progress}%
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3 ml-7">
          <ProgressBar progress={progress} />
        </div>

        {/* Next subtask hint */}
        {nextSubtask && !expanded && (
          <div
            className="ml-7 mb-3 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'hsl(45 10% 14%)', color: 'var(--text-muted)' }}
          >
            <span style={{ color: 'var(--gold)', fontWeight: 500 }}>Next: </span>
            {nextSubtask.title}
          </div>
        )}

        {/* Subtasks toggle button */}
        {subtasks.length > 0 && (
          <button
            onClick={onToggleExpand}
            className="ml-7 flex items-center gap-1.5 text-xs touch-target transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span style={{ color: expanded ? 'var(--gold)' : 'var(--text-muted)' }}>
              {expanded ? 'Collapse' : `▶ Expand ${subtasks.length} tasks`}
            </span>
            <span className="ml-1" style={{ color: 'hsl(45 10% 40%)' }}>
              {doneCount}/{subtasks.length} done
            </span>
          </button>
        )}
      </div>

      {/* Expanded subtask list */}
      {expanded && subtasks.length > 0 && (
        <div
          className="border-t mx-0 px-4 pb-3 space-y-0.5"
          style={{ borderColor: 'hsl(45 10% 16%)' }}
        >
          <div className="pt-3 space-y-0.5">
            {subtasks.map((st: any) => {
              const isStDone = st.status === 'done'
              return (
                <button
                  key={st.id}
                  data-testid={`subtask-${st.id}`}
                  onClick={() => onSubtaskToggle(st.id, isStDone ? 'pending' : 'done')}
                  className="flex items-center gap-2.5 py-1.5 w-full text-left transition-all"
                >
                  {isStDone
                    ? <CheckCircle2 size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    : <Circle size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  }
                  <span
                    className="text-xs"
                    style={{
                      color: isStDone ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: isStDone ? 'line-through' : 'none',
                    }}
                  >
                    {st.title}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// DoneRocksCollapsed — tiny inline chips
// ─────────────────────────────────────────────
function DoneRocksSection({ rocks }: { rocks: any[] }) {
  const [open, setOpen] = useState(false)
  if (rocks.length === 0) return null

  return (
    <div
      className="rounded-xl transition-all"
      style={{ border: '1px solid hsl(45 10% 16%)', background: 'hsl(45 10% 12%)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--success)' }}
      >
        <Check size={13} />
        ✅ Done ({rocks.length})
        <ChevronDown size={13} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="px-4 pb-3 space-y-1">
          {rocks.map((r: any) => (
            <div key={r.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
              {r.title}
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {rocks.map((r: any) => (
            <span
              key={r.id}
              className="text-[11px] flex items-center gap-1"
              style={{ color: 'var(--text-muted)' }}
            >
              <CheckCircle2 size={10} style={{ color: 'var(--success)' }} />
              {r.title}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Owner section — collapsible
// ─────────────────────────────────────────────
function OwnerSection({
  ownerKey, ownerName, rocks, allSubtasks, defaultExpanded, onSubtaskToggle, onStatusChange
}: {
  ownerKey: string
  ownerName: string
  rocks: any[]
  allSubtasks: Map<string, any[]>
  defaultExpanded: boolean
  onSubtaskToggle: (subtaskId: string, rockId: string, newStatus: 'done' | 'pending') => void
  onStatusChange: (rockId: string, status: string) => void
}) {
  const [sectionOpen, setSectionOpen] = useState(defaultExpanded)
  const [expandedRocks, setExpandedRocks] = useState<Set<string>>(new Set())

  const activeRocks = rocks.filter(r => r.status !== 'done')
  const doneRocks = rocks.filter(r => r.status === 'done')

  const toggleRock = (id: string) => {
    setExpandedRocks(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isMe = defaultExpanded

  return (
    <div className="space-y-3">
      {/* Section header */}
      <button
        onClick={() => setSectionOpen(!sectionOpen)}
        className="flex items-center gap-2 w-full group"
      >
        <h3
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: isMe ? 'var(--gold)' : 'var(--text-muted)' }}
        >
          {isMe ? `YOUR ROCKS (${ownerName})` : `${ownerName.toUpperCase()}'S ROCKS`}
        </h3>
        <div className="flex-1 h-px" style={{ background: 'hsl(45 10% 18%)' }} />
        <ChevronDown
          size={14}
          style={{ color: 'var(--text-muted)' }}
          className={`transition-transform flex-shrink-0 ${sectionOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {sectionOpen && (
        <div className="space-y-3">
          {activeRocks.map(rock => (
            <RockCard
              key={rock.id}
              rock={rock}
              subtasks={allSubtasks.get(rock.id) || rock.rock_subtasks || []}
              expanded={expandedRocks.has(rock.id)}
              onToggleExpand={() => toggleRock(rock.id)}
              onSubtaskToggle={(subtaskId, newStatus) =>
                onSubtaskToggle(subtaskId, rock.id, newStatus)
              }
              onStatusChange={(s) => onStatusChange(rock.id, s)}
            />
          ))}

          <DoneRocksSection rocks={doneRocks} />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Summary bar helpers
// ─────────────────────────────────────────────
function getDaysLeftInQuarter() {
  const now = new Date()
  const month = now.getMonth() // 0-based
  const quarterEndMonths = [2, 5, 8, 11] // Mar, Jun, Sep, Dec
  const qEnd = quarterEndMonths.find(m => m >= month)!
  const endOfQ = new Date(now.getFullYear(), qEnd + 1, 0) // last day of quarter-end month
  return Math.max(0, Math.ceil((endOfQ.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

function getCurrentQuarterLabel() {
  const q = Math.ceil((new Date().getMonth() + 1) / 3)
  return `Q${q} ${new Date().getFullYear()}`
}

// ─────────────────────────────────────────────
// Main RocksPage
// ─────────────────────────────────────────────
export default function RocksPage() {
  const { user } = useAuth()
  const userKey = (user?.key || 'drew') as string
  const userName = OWNER_MAP[userKey] || 'Drew'

  const [rocks, setRocks] = useState<any[]>([])
  const [subtasksMap, setSubtasksMap] = useState<Map<string, any[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch rocks + subtasks
  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: rocksData, error: rocksErr }, { data: subtasksData, error: stErr }] =
        await Promise.all([
          supabase.from('rocks').select('*').order('id'),
          supabase.from('rock_subtasks').select('*').order('rock_id').order('id'),
        ])
      if (rocksErr) throw rocksErr
      if (stErr) throw stErr

      setRocks(rocksData || [])

      const map = new Map<string, any[]>()
      for (const st of subtasksData || []) {
        if (!map.has(st.rock_id)) map.set(st.rock_id, [])
        map.get(st.rock_id)!.push(st)
      }
      setSubtasksMap(map)
    } catch (e: any) {
      setError(e.message || 'Failed to load rocks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Toggle subtask — optimistic update then refetch
  const handleSubtaskToggle = async (subtaskId: string, rockId: string, newStatus: 'done' | 'pending') => {
    // Optimistic update
    setSubtasksMap(prev => {
      const next = new Map(prev)
      const list = (next.get(rockId) || []).map(s =>
        s.id === subtaskId ? { ...s, status: newStatus } : s
      )
      next.set(rockId, list)
      return next
    })

    await supabase
      .from('rock_subtasks')
      .update({
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', subtaskId)

    // Recalculate rock progress
    const updatedList = (subtasksMap.get(rockId) || []).map(s =>
      s.id === subtaskId ? { ...s, status: newStatus } : s
    )
    const doneCount = updatedList.filter(s => s.status === 'done').length
    const totalCount = updatedList.length
    if (totalCount > 0) {
      await supabase
        .from('rocks')
        .update({ progress: Math.round((doneCount / totalCount) * 100) })
        .eq('id', rockId)
    }
  }

  // Update rock status
  const handleStatusChange = async (rockId: string, status: string) => {
    setRocks(prev => prev.map(r => r.id === rockId ? { ...r, status } : r))
    await supabase
      .from('rocks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', rockId)
  }

  // Summary stats
  const summary = useMemo(() => {
    const total = rocks.length
    const done = rocks.filter(r => r.status === 'done').length
    const atRisk = rocks.filter(r => r.status === 'at_risk').length
    const pushNow = rocks.filter(r => r.status === 'push_now').length
    const daysLeft = getDaysLeftInQuarter()
    return { total, done, atRisk, pushNow, daysLeft }
  }, [rocks])

  // Group rocks by owner
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const rock of rocks) {
      const owner = (rock.owner || 'Drew').toLowerCase()
      if (!groups[owner]) groups[owner] = []
      groups[owner].push(rock)
    }
    return groups
  }, [rocks])

  // Build ordered owner list — logged-in user first
  const ownerOrder = useMemo(() => {
    const keys = Object.keys(grouped)
    const sorted = [userKey, ...keys.filter(k => k !== userKey)]
    return sorted.filter(k => grouped[k])
  }, [grouped, userKey])

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Rocks</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Quarterly priorities and milestones</p>
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          {getCurrentQuarterLabel()}
        </span>
      </div>

      {/* Summary bar */}
      <div
        className="rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap text-sm"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
      >
        <span className="font-medium" style={{ color: 'var(--gold)' }}>
          {summary.done}/{summary.total} done
        </span>
        <span style={{ color: 'hsl(45 10% 35%)' }}>·</span>
        {summary.atRisk > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--error)' }}>
            {summary.atRisk} at risk
          </span>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>0 at risk</span>
        )}
        <span style={{ color: 'hsl(45 10% 35%)' }}>·</span>
        {summary.pushNow > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            {summary.pushNow} push now
          </span>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>0 push now</span>
        )}
        <span style={{ color: 'hsl(45 10% 35%)' }}>·</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {summary.daysLeft}d left
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton rounded-xl h-32" />)}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)' }}>
          Failed to load rocks: {error}
        </div>
      )}

      {/* Owner sections */}
      {!loading && !error && ownerOrder.map(ownerKey => (
        <OwnerSection
          key={ownerKey}
          ownerKey={ownerKey}
          ownerName={OWNER_MAP[ownerKey] || ownerKey}
          rocks={grouped[ownerKey] || []}
          allSubtasks={subtasksMap}
          defaultExpanded={ownerKey === userKey}
          onSubtaskToggle={handleSubtaskToggle}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  )
}
