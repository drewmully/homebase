import { useState, useMemo } from 'react'
import { useRocks, useUpdateRockStatus, useUpdateRockProgress, useToggleSubtask } from '@/lib/hooks'
import { ChevronDown, ChevronRight, CheckCircle2, Circle, AlertTriangle, Zap, Eye, Target } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  on_track: { label: 'On Track', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  push_now: { label: 'Push Now', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  needs_focus: { label: 'Needs Focus', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  at_risk: { label: 'At Risk', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  done: { label: 'Done', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
}

const ALL_STATUSES = ['on_track', 'push_now', 'needs_focus', 'at_risk', 'done']

function StatusBadge({ status, rockId }: { status: string; rockId: string }) {
  const [open, setOpen] = useState(false)
  const updateStatus = useUpdateRockStatus()
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.on_track

  return (
    <div className="relative">
      <button
        data-testid={`status-badge-${rockId}`}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all touch-target"
        style={{ background: config.bg, color: config.color }}
      >
        {status === 'done' ? <CheckCircle2 size={12} /> :
         status === 'at_risk' ? <AlertTriangle size={12} /> :
         status === 'push_now' ? <Zap size={12} /> :
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
                  onClick={() => {
                    updateStatus.mutate({ id: rockId, status: s })
                    setOpen(false)
                  }}
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

function ProgressSlider({ rockId, progress }: { rockId: string; progress: number }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(progress)
  const updateProgress = useUpdateRockProgress()

  const handleSave = () => {
    updateProgress.mutate({ id: rockId, progress: value })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(parseInt(e.target.value))}
          onMouseUp={handleSave}
          onTouchEnd={handleSave}
          className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: 'var(--gold)' }}
          data-testid={`progress-slider-${rockId}`}
        />
        <span className="text-xs font-medium w-8 text-right" style={{ color: 'var(--gold)' }}>{value}%</span>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      data-testid={`progress-bar-${rockId}`}
      className="w-full"
    >
      <div className="h-1.5 rounded-full" style={{ background: 'hsl(45 10% 18%)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: progress === 100 ? 'var(--success)' : 'var(--gold)',
          }}
        />
      </div>
      <div className="text-[10px] mt-1 text-right" style={{ color: 'var(--text-muted)' }}>{progress}%</div>
    </button>
  )
}

function SubtaskItem({ subtask }: { subtask: any }) {
  const toggleSubtask = useToggleSubtask()
  const isDone = subtask.status === 'done'

  return (
    <button
      data-testid={`subtask-${subtask.id}`}
      onClick={() => toggleSubtask.mutate({ id: subtask.id, status: isDone ? 'pending' : 'done' })}
      className="flex items-center gap-2.5 py-1.5 w-full text-left transition-all"
    >
      {isDone ? (
        <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
      ) : (
        <Circle size={14} style={{ color: 'var(--text-muted)' }} />
      )}
      <span
        className="text-xs"
        style={{
          color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
          textDecoration: isDone ? 'line-through' : 'none',
        }}
      >
        {subtask.title}
      </span>
    </button>
  )
}

function RockCard({ rock }: { rock: any }) {
  const [expanded, setExpanded] = useState(false)
  const subtasks = rock.rock_subtasks || []
  const doneCount = subtasks.filter((s: any) => s.status === 'done').length

  const dueDate = rock.due_date ? new Date(rock.due_date) : null
  const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null

  return (
    <div
      data-testid={`rock-card-${rock.id}`}
      className="rounded-xl p-4 transition-all duration-200"
      style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5"
          style={{ background: 'hsl(45 10% 22%)', color: 'var(--text-primary)' }}
        >
          {(rock.owner || '?')[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{rock.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={rock.status} rockId={rock.id} />
            {rock.business && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(45 10% 18%)', color: 'var(--text-muted)' }}>
                {rock.business}
              </span>
            )}
            {daysLeft !== null && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background: daysLeft < 7 ? 'rgba(239,68,68,0.12)' : 'hsl(45 10% 18%)',
                  color: daysLeft < 7 ? 'var(--error)' : 'var(--text-muted)',
                }}
              >
                {daysLeft > 0 ? `${daysLeft}d left` : `${Math.abs(daysLeft)}d overdue`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <ProgressSlider rockId={rock.id} progress={rock.progress || 0} />
      </div>

      {/* Subtasks toggle */}
      {subtasks.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs touch-target"
            style={{ color: 'var(--text-muted)' }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {doneCount}/{subtasks.length} subtasks
          </button>
          {expanded && (
            <div className="mt-2 ml-1 space-y-0.5">
              {subtasks.map((st: any) => (
                <SubtaskItem key={st.id} subtask={st} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RocksPage() {
  const { data: rocks, isLoading, error } = useRocks()

  const grouped = useMemo(() => {
    if (!rocks) return {}
    const groups: Record<string, any[]> = {}
    for (const rock of rocks) {
      const owner = rock.owner || 'Unassigned'
      if (!groups[owner]) groups[owner] = []
      groups[owner].push(rock)
    }
    return groups
  }, [rocks])

  const summary = useMemo(() => {
    if (!rocks) return { total: 0, done: 0, atRisk: 0 }
    return {
      total: rocks.length,
      done: rocks.filter((r: any) => r.status === 'done').length,
      atRisk: rocks.filter((r: any) => r.status === 'at_risk').length,
    }
  }, [rocks])

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Rocks</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Quarterly priorities and milestones</p>
      </div>

      {/* Summary bar */}
      <div
        className="rounded-xl px-5 py-3 flex items-center gap-4 flex-wrap text-sm"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
      >
        <span style={{ color: 'var(--text-primary)' }} className="font-medium">Q2 Rocks</span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>
          {summary.done}/{summary.total} complete
        </span>
        {summary.atRisk > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--error)' }}>
            {summary.atRisk} at risk
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton rounded-xl h-32" />)}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)' }}>
          Failed to load rocks. Please refresh.
        </div>
      )}

      {/* Grouped rocks */}
      {Object.entries(grouped).map(([owner, ownerRocks]) => (
        <div key={owner}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            {owner}
          </h3>
          <div className="space-y-3">
            {ownerRocks.map((rock: any) => (
              <RockCard key={rock.id} rock={rock} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
