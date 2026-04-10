import { useState, useMemo } from 'react'
import { useAppKV } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, CheckCircle2, ChevronDown, ChevronRight, Star, X } from 'lucide-react'

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  P0: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  P1: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  P2: { color: '#8a8778', bg: 'hsl(45 10% 18%)' },
}

function IssueCard({ issue, onResolve }: { issue: any; onResolve: () => void }) {
  const created = issue.created_at ? new Date(issue.created_at) : new Date()
  const daysOpen = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)))
  const pConfig = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.P2

  return (
    <div
      data-testid={`issue-card-${issue.id}`}
      className="rounded-xl p-4 transition-all duration-200"
      style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="text-[10px] font-bold px-2 py-1 rounded flex-shrink-0 mt-0.5"
          style={{ background: pConfig.bg, color: pConfig.color }}
        >
          {issue.priority}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{issue.title}</h3>
          {issue.description && (
            <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{issue.description}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {issue.owner && (
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold"
                  style={{ background: 'hsl(45 10% 22%)', color: 'var(--text-primary)' }}
                >
                  {issue.owner[0]}
                </div>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{issue.owner}</span>
              </div>
            )}
            {issue.entity && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(45 10% 18%)', color: 'var(--text-muted)' }}>
                {issue.entity}
              </span>
            )}
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{daysOpen}d open</span>
          </div>
        </div>
        {issue.status !== 'resolved' && (
          <button
            onClick={onResolve}
            data-testid={`button-resolve-${issue.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all touch-target flex-shrink-0"
            style={{
              background: 'rgba(74,222,128,0.1)',
              color: 'var(--success)',
              border: '1px solid rgba(74,222,128,0.2)',
            }}
          >
            <CheckCircle2 size={14} /> Resolve
          </button>
        )}
      </div>
    </div>
  )
}

function AddIssueForm({ onClose, onAdd }: { onClose: () => void; onAdd: (issue: any) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [entity, setEntity] = useState('mully')
  const [priority, setPriority] = useState('P1')
  const [owner, setOwner] = useState('Unassigned')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({
      id: `${entity}-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || null,
      entity,
      priority,
      owner,
      status: 'open',
      starred: false,
      xp_value: priority === 'P0' ? 25 : priority === 'P1' ? 15 : 10,
      created_at: new Date().toISOString(),
      resolved_at: null,
    })
    onClose()
  }

  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--gold)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>New Issue</h3>
        <button onClick={onClose} className="p-1" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text" placeholder="Issue title" value={title} onChange={(e) => setTitle(e.target.value)}
          data-testid="input-issue-title"
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 22%)', color: 'var(--text-primary)' }}
          autoFocus
        />
        <textarea
          placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)}
          data-testid="input-issue-description"
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none h-16"
          style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 22%)', color: 'var(--text-primary)' }}
        />
        <div className="grid grid-cols-3 gap-3">
          <select value={entity} onChange={(e) => setEntity(e.target.value)} data-testid="select-issue-entity"
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 22%)', color: 'var(--text-primary)' }}
          >
            <option value="mully">Mully</option>
            <option value="mfs">MFS</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} data-testid="select-issue-priority"
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 22%)', color: 'var(--text-primary)' }}
          >
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
          </select>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} data-testid="select-issue-owner"
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 22%)', color: 'var(--text-primary)' }}
          >
            <option value="Drew">Drew</option>
            <option value="Jack">Jack</option>
            <option value="Joe">Joe</option>
            <option value="Unassigned">Unassigned</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cancel</button>
          <button type="submit" data-testid="button-submit-issue" className="px-4 py-2 rounded-lg text-xs font-medium transition-all touch-target" style={{ background: 'var(--gold)', color: 'var(--surface-darkest)' }}>Add Issue</button>
        </div>
      </form>
    </div>
  )
}

export default function IssuesPage() {
  const { data: issuesKV, isLoading } = useAppKV('eos_issues')
  const qc = useQueryClient()
  const [entityFilter, setEntityFilter] = useState<'all' | 'mully' | 'mfs'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showResolved, setShowResolved] = useState(false)

  const allIssues = issuesKV?.issues || []

  const handleResolve = async (issueId: string) => {
    // Write to the proper eos_issues TABLE — trigger auto-syncs to app_kv
    await supabase.from('eos_issues').update({
      status: 'resolved',
      resolved_at: new Date().toISOString()
    }).eq('id', issueId)
    qc.invalidateQueries({ queryKey: ['app_kv', 'eos_issues'] })
  }

  const handleAdd = async (newIssue: any) => {
    // Write to the proper eos_issues TABLE — trigger auto-syncs to app_kv
    await supabase.from('eos_issues').insert({
      id: newIssue.id,
      title: newIssue.title,
      entity: newIssue.entity,
      priority: newIssue.priority,
      owner: newIssue.owner || null,
      status: 'open',
      starred: false,
      created_at: new Date().toISOString()
    })
    qc.invalidateQueries({ queryKey: ['app_kv', 'eos_issues'] })
  }

  const { open, resolved, counts, starred } = useMemo(() => {
    let filtered = allIssues
    if (entityFilter !== 'all') {
      filtered = allIssues.filter((i: any) => i.entity === entityFilter)
    }

    const open = filtered.filter((i: any) => i.status !== 'resolved')
    const resolved = filtered.filter((i: any) => i.status === 'resolved')

    const counts = {
      P0: open.filter((i: any) => i.priority === 'P0').length,
      P1: open.filter((i: any) => i.priority === 'P1').length,
      P2: open.filter((i: any) => i.priority === 'P2').length,
      resolved: resolved.length,
    }

    const starred = [...open]
      .filter((i: any) => i.starred)
      .sort((a: any, b: any) => {
        const pOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 }
        return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2)
      })
      .slice(0, 3)

    // If none starred, just take top 3 by priority
    const topPriority = starred.length > 0 ? starred : [...open]
      .sort((a: any, b: any) => {
        const pOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 }
        const pd = (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2)
        if (pd !== 0) return pd
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      })
      .slice(0, 3)

    return { open, resolved, counts, starred: topPriority }
  }, [allIssues, entityFilter])

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Issues</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: PRIORITY_CONFIG.P0.bg, color: PRIORITY_CONFIG.P0.color }}>{counts.P0} P0</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: PRIORITY_CONFIG.P1.bg, color: PRIORITY_CONFIG.P1.color }}>{counts.P1} P1</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: PRIORITY_CONFIG.P2.bg, color: PRIORITY_CONFIG.P2.color }}>{counts.P2} P2</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>{counts.resolved} Resolved</span>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          data-testid="button-add-issue"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all touch-target"
          style={{ background: 'var(--gold)', color: 'var(--surface-darkest)' }}
        >
          <Plus size={14} /> Add Issue
        </button>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'hsl(45 10% 14%)' }}>
        {(['all', 'mully', 'mfs'] as const).map(e => (
          <button key={e} data-testid={`filter-entity-${e}`} onClick={() => setEntityFilter(e)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all touch-target"
            style={{ background: entityFilter === e ? 'var(--gold)' : 'transparent', color: entityFilter === e ? 'var(--surface-darkest)' : 'var(--text-muted)' }}
          >
            {e === 'all' ? 'All' : e === 'mully' ? 'Mully' : 'MFS'}
          </button>
        ))}
      </div>

      {showAddForm && <AddIssueForm onClose={() => setShowAddForm(false)} onAdd={handleAdd} />}

      {isLoading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton rounded-xl h-24" />)}</div>}

      {starred.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--gold)' }}>
            <Star size={12} fill="currentColor" /> Top Priority
          </h3>
          <div className="space-y-2">
            {starred.map((issue: any) => (
              <IssueCard key={issue.id} issue={issue} onResolve={() => handleResolve(issue.id)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>All Open ({open.length})</h3>
        <div className="space-y-2">
          {open.map((issue: any) => (
            <IssueCard key={issue.id} issue={issue} onResolve={() => handleResolve(issue.id)} />
          ))}
          {open.length === 0 && !isLoading && (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No open issues.</div>
          )}
        </div>
      </section>

      {resolved.length > 0 && (
        <section>
          <button onClick={() => setShowResolved(!showResolved)} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            {showResolved ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Resolved ({resolved.length})
          </button>
          {showResolved && (
            <div className="space-y-2 opacity-60">
              {resolved.map((issue: any) => (
                <IssueCard key={issue.id} issue={issue} onResolve={() => {}} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
