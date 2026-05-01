import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { AlertCircle, CheckCircle2, Clock, ExternalLink, MessageSquare, Search, X, User } from 'lucide-react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Ticket = {
  id: number
  source: string
  source_url: string | null
  reporter_name: string | null
  raw_text: string
  title: string
  summary: string | null
  proposed_fix: string | null
  domain: string
  severity: string
  assignee: string
  status: string
  resolution_note: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

type Changelog = {
  id: number
  ticket_id: number
  actor: string
  action: string
  from_value: string | null
  to_value: string | null
  note: string | null
  created_at: string
}

type Comment = {
  id: number
  ticket_id: number
  author: string
  body: string
  created_at: string
}

const ASSIGNEES = ['drew', 'leo', 'santy', 'jack'] as const
const STATUSES = ['new', 'in_progress', 'blocked', 'resolved', 'wontfix'] as const
const SEVERITIES = ['p0', 'p1', 'normal', 'low'] as const
const DOMAINS = ['acquire', 'activate', 'deliver', 'allocate', 'other'] as const

const DOMAIN_LABEL: Record<string, string> = {
  acquire: 'Acquire',
  activate: 'Activate',
  deliver: 'Deliver',
  allocate: 'Allocate',
  other: 'Other',
}

const DOMAIN_COLOR: Record<string, string> = {
  acquire: '#fbbf24',  // gold/yellow (Leo)
  activate: '#34d399', // green (Santy)
  deliver: '#60a5fa',  // blue (Jack)
  allocate: '#f472b6', // pink (Drew)
  other: '#94a3b8',
}

const SEVERITY_COLOR: Record<string, string> = {
  p0: '#ef4444',
  p1: '#f59e0b',
  normal: '#94a3b8',
  low: '#6b7280',
}

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  resolved: 'Resolved',
  wontfix: 'Won't Fix',
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function TicketsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('open') // open = new+in_progress+blocked
  const [filterDomain, setFilterDomain] = useState<string>('all')
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['dev_tickets'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dev_tickets')
        .select('*')
        .order('created_at', { ascending: false })
      return (data || []) as Ticket[]
    },
    staleTime: 15_000,
  })

  const { data: changelog } = useQuery({
    queryKey: ['dev_ticket_changelog_recent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dev_ticket_changelog')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      return (data || []) as Changelog[]
    },
    staleTime: 15_000,
  })

  const filtered = useMemo(() => {
    if (!tickets) return []
    return tickets.filter(t => {
      if (filterAssignee !== 'all' && t.assignee !== filterAssignee) return false
      if (filterDomain !== 'all' && t.domain !== filterDomain) return false
      if (filterStatus === 'open' && !['new', 'in_progress', 'blocked'].includes(t.status)) return false
      if (filterStatus === 'closed' && !['resolved', 'wontfix'].includes(t.status)) return false
      if (filterStatus !== 'all' && filterStatus !== 'open' && filterStatus !== 'closed' && t.status !== filterStatus) return false
      if (search && !`${t.title} ${t.raw_text} ${t.summary || ''}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [tickets, filterAssignee, filterStatus, filterDomain, search])

  // Counts per assignee
  const assigneeCounts = useMemo(() => {
    const counts: Record<string, { open: number; total: number }> = {}
    for (const a of ASSIGNEES) counts[a] = { open: 0, total: 0 }
    for (const t of (tickets || [])) {
      if (!counts[t.assignee]) counts[t.assignee] = { open: 0, total: 0 }
      counts[t.assignee].total += 1
      if (['new', 'in_progress', 'blocked'].includes(t.status)) counts[t.assignee].open += 1
    }
    return counts
  }, [tickets])

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Tickets</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Slack-fed dev queue — hourly ingest from #mully-os, AI-triaged, domain-routed
          </p>
        </div>
      </div>

      {/* Assignee KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ASSIGNEES.map(a => {
          const c = assigneeCounts[a] || { open: 0, total: 0 }
          const isActive = filterAssignee === a
          return (
            <button
              key={a}
              onClick={() => setFilterAssignee(isActive ? 'all' : a)}
              className="rounded-xl p-4 text-left transition"
              style={{
                background: isActive ? 'rgba(201,168,76,0.08)' : 'var(--surface-card)',
                border: `1px solid ${isActive ? 'rgba(201,168,76,0.3)' : 'hsl(45 10% 20%)'}`,
              }}
              data-testid={`kpi-assignee-${a}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{a}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(45 10% 18%)', color: DOMAIN_COLOR[ownerToDomain(a)] }}>
                  {DOMAIN_LABEL[ownerToDomain(a)]}
                </span>
              </div>
              <div className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{c.open}</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>open · {c.total} total</div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-[360px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-primary)' }}
            data-testid="input-search"
          />
        </div>
        <FilterPill label="Status" options={[['open', 'Open'], ['all', 'All'], ['new', 'New'], ['in_progress', 'In Progress'], ['blocked', 'Blocked'], ['resolved', 'Resolved'], ['closed', 'Closed']]} value={filterStatus} onChange={setFilterStatus} />
        <FilterPill label="Domain" options={[['all', 'All']].concat(DOMAINS.map(d => [d, DOMAIN_LABEL[d]] as [string, string]))} value={filterDomain} onChange={setFilterDomain} />
        <span className="text-[11px] ml-auto" style={{ color: 'var(--text-muted)' }}>{filtered.length} ticket{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tickets list */}
        <div className="lg:col-span-2 space-y-2">
          {isLoading && <div className="skeleton rounded-xl h-32" />}
          {!isLoading && filtered.length === 0 && (
            <div className="rounded-xl p-8 text-center text-xs" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-muted)' }}>
              No tickets match. Try clearing filters.
            </div>
          )}
          {filtered.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTicket(t)}
              className="w-full rounded-xl p-3 text-left transition hover:opacity-90"
              style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
              data-testid={`ticket-${t.id}`}
            >
              <div className="flex items-start gap-3">
                <SeverityBadge severity={t.severity} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>#{t.id}</span>
                    <DomainChip domain={t.domain} />
                    <StatusChip status={t.status} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {timeAgo(t.created_at)} · by {t.reporter_name}
                    </span>
                  </div>
                  <div className="text-xs mb-1" style={{ color: 'var(--text-primary)' }}>{t.title}</div>
                  {t.summary && <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t.summary.slice(0, 140)}{t.summary.length > 140 ? '…' : ''}</div>}
                </div>
                <div className="flex items-center gap-1.5">
                  <User size={11} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-[11px] font-medium" style={{ color: DOMAIN_COLOR[t.domain] }}>{t.assignee}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Changelog sidebar */}
        <div className="rounded-xl p-4 h-fit lg:sticky lg:top-4" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
          <h2 className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            <Clock size={12} /> Changelog
          </h2>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {(changelog || []).slice(0, 30).map(c => (
              <div key={c.id} className="text-[11px] pb-2" style={{ borderBottom: '1px solid hsl(45 10% 16%)' }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>#{c.ticket_id}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{actionLabel(c.action)}</span>
                  {c.from_value && c.to_value && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {c.from_value} → <strong style={{ color: 'var(--text-primary)' }}>{c.to_value}</strong>
                    </span>
                  )}
                  {!c.from_value && c.to_value && c.action === 'created' && (
                    <span style={{ color: 'var(--text-muted)' }}>as <strong style={{ color: 'var(--text-primary)' }}>{c.to_value}</strong></span>
                  )}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(c.created_at)} · {c.actor}</div>
              </div>
            ))}
            {(!changelog || changelog.length === 0) && (
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No activity yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {activeTicket && (
        <TicketDetailModal
          ticket={activeTicket}
          onClose={() => setActiveTicket(null)}
          onUpdate={() => qc.invalidateQueries({ queryKey: ['dev_tickets'] })}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Detail modal
// ─────────────────────────────────────────────

function TicketDetailModal({ ticket, onClose, onUpdate }: { ticket: Ticket; onClose: () => void; onUpdate: () => void }) {
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [authorName] = useState(() => localStorage_get('hq_user') || 'drew')
  const [resolution, setResolution] = useState(ticket.resolution_note || '')

  const { data: comments } = useQuery({
    queryKey: ['dev_ticket_comments', ticket.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('dev_ticket_comments')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at')
      return (data || []) as Comment[]
    },
  })

  const { data: ticketChangelog } = useQuery({
    queryKey: ['dev_ticket_changelog', ticket.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('dev_ticket_changelog')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at')
      return (data || []) as Changelog[]
    },
  })

  const update = async (patch: Partial<Ticket>) => {
    await supabase.from('dev_tickets').update(patch).eq('id', ticket.id)
    qc.invalidateQueries({ queryKey: ['dev_tickets'] })
    qc.invalidateQueries({ queryKey: ['dev_ticket_changelog_recent'] })
    qc.invalidateQueries({ queryKey: ['dev_ticket_changelog', ticket.id] })
    onUpdate()
  }

  const addComment = async () => {
    if (!comment.trim()) return
    await supabase.from('dev_ticket_comments').insert({ ticket_id: ticket.id, author: authorName, body: comment })
    setComment('')
    qc.invalidateQueries({ queryKey: ['dev_ticket_comments', ticket.id] })
  }

  const claimTicket = async () => {
    await update({ assignee: authorName as any })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
        {/* Header */}
        <div className="sticky top-0 px-5 py-3 flex items-center justify-between" style={{ background: 'var(--surface-card)', borderBottom: '1px solid hsl(45 10% 18%)' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>#{ticket.id}</span>
            <SeverityBadge severity={ticket.severity} />
            <DomainChip domain={ticket.domain} />
            <StatusChip status={ticket.status} />
            {ticket.source_url && (
              <a href={ticket.source_url} target="_blank" rel="noreferrer" className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <ExternalLink size={11} /> Slack
              </a>
            )}
          </div>
          <button onClick={onClose} className="p-1" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title + meta */}
          <div>
            <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{ticket.title}</h2>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Reported by <strong style={{ color: 'var(--text-primary)' }}>{ticket.reporter_name}</strong> {timeAgo(ticket.created_at)} · last updated {timeAgo(ticket.updated_at)}
            </div>
          </div>

          {/* Original raw text */}
          <div className="rounded-lg p-3 text-xs whitespace-pre-wrap" style={{ background: 'hsl(45 10% 13%)', color: 'var(--text-primary)' }}>
            {ticket.raw_text}
          </div>

          {/* AI-generated summary + fix */}
          {ticket.summary && (
            <div className="space-y-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>AI Summary</div>
                <div className="text-xs" style={{ color: 'var(--text-primary)' }}>{ticket.summary}</div>
              </div>
              {ticket.proposed_fix && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Proposed Fix</div>
                  <div className="text-xs" style={{ color: 'var(--text-primary)' }}>{ticket.proposed_fix}</div>
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2" style={{ borderTop: '1px solid hsl(45 10% 18%)' }}>
            <Field label="Assignee">
              <select value={ticket.assignee} onChange={e => update({ assignee: e.target.value })} className="w-full px-2 py-1.5 rounded text-xs" style={{ background: 'hsl(45 10% 13%)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-primary)' }}>
                {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
                <option value="unassigned">unassigned</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={ticket.status} onChange={e => update({ status: e.target.value })} className="w-full px-2 py-1.5 rounded text-xs" style={{ background: 'hsl(45 10% 13%)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-primary)' }}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </Field>
            <Field label="Severity">
              <select value={ticket.severity} onChange={e => update({ severity: e.target.value })} className="w-full px-2 py-1.5 rounded text-xs" style={{ background: 'hsl(45 10% 13%)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-primary)' }}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </Field>
            <Field label="Domain">
              <select value={ticket.domain} onChange={e => update({ domain: e.target.value })} className="w-full px-2 py-1.5 rounded text-xs" style={{ background: 'hsl(45 10% 13%)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-primary)' }}>
                {DOMAINS.map(d => <option key={d} value={d}>{DOMAIN_LABEL[d]}</option>)}
              </select>
            </Field>
            <div className="md:col-span-2 flex items-end">
              <button onClick={claimTicket} className="text-[11px] px-3 py-1.5 rounded-md w-full" style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.2)' }}>
                Claim as {authorName}
              </button>
            </div>
          </div>

          {/* Resolution note */}
          {(ticket.status === 'resolved' || ticket.status === 'wontfix') && (
            <div>
              <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Resolution Note</div>
              <textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                onBlur={() => update({ resolution_note: resolution })}
                placeholder="What was done?"
                className="w-full px-2 py-1.5 rounded text-xs"
                rows={2}
                style={{ background: 'hsl(45 10% 13%)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-primary)' }}
              />
            </div>
          )}

          {/* Comments */}
          <div>
            <div className="text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <MessageSquare size={11} /> Comments
            </div>
            <div className="space-y-2 mb-3">
              {(comments || []).map(c => (
                <div key={c.id} className="text-xs p-2 rounded" style={{ background: 'hsl(45 10% 13%)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.author}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <div style={{ color: 'var(--text-primary)' }} className="whitespace-pre-wrap">{c.body}</div>
                </div>
              ))}
              {(!comments || comments.length === 0) && (
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No comments yet.</div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a comment..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addComment() }}
                className="flex-1 px-2 py-1.5 rounded text-xs"
                style={{ background: 'hsl(45 10% 13%)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-primary)' }}
              />
              <button onClick={addComment} className="text-[11px] px-3 py-1.5 rounded-md" style={{ background: 'var(--gold)', color: '#1a1a1a' }}>Post</button>
            </div>
          </div>

          {/* Per-ticket history */}
          {ticketChangelog && ticketChangelog.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>History</div>
              <div className="space-y-1">
                {ticketChangelog.map(c => (
                  <div key={c.id} className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{c.actor}</span> {actionLabel(c.action)}
                    {c.from_value && c.to_value && <> {c.from_value} → <strong style={{ color: 'var(--text-primary)' }}>{c.to_value}</strong></>}
                    {!c.from_value && c.to_value && c.action === 'created' && <> as <strong style={{ color: 'var(--text-primary)' }}>{c.to_value}</strong></>}
                    <span className="ml-1" style={{ color: 'var(--text-muted)' }}>· {timeAgo(c.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Bits
// ─────────────────────────────────────────────

function FilterPill({ label, options, value, onChange }: { label: string; options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="text-xs px-2 py-1.5 rounded" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)', color: 'var(--text-primary)' }}>
      {options.map(([v, l]) => <option key={v} value={v}>{label}: {l}</option>)}
    </select>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const Icon = severity === 'p0' ? AlertCircle : severity === 'p1' ? AlertCircle : Clock
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 shrink-0" style={{ background: 'hsl(45 10% 18%)', color: SEVERITY_COLOR[severity] }}>
      <Icon size={10} /> {severity.toUpperCase()}
    </span>
  )
}

function DomainChip({ domain }: { domain: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'hsl(45 10% 18%)', color: DOMAIN_COLOR[domain] }}>
      {DOMAIN_LABEL[domain] || domain}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  const isClosed = status === 'resolved' || status === 'wontfix'
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1" style={{ background: 'hsl(45 10% 18%)', color: isClosed ? '#4ade80' : status === 'blocked' ? '#ef4444' : status === 'in_progress' ? '#fbbf24' : 'var(--text-muted)' }}>
      {isClosed && <CheckCircle2 size={9} />}
      {STATUS_LABEL[status] || status}
    </span>
  )
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </label>
  )
}

function ownerToDomain(owner: string): string {
  return owner === 'leo' ? 'acquire' : owner === 'santy' ? 'activate' : owner === 'jack' ? 'deliver' : owner === 'drew' ? 'allocate' : 'other'
}

function actionLabel(action: string): string {
  if (action === 'created') return 'opened'
  if (action === 'status_changed') return 'changed status'
  if (action === 'reassigned') return 'reassigned'
  if (action === 'commented') return 'commented'
  return action
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.round(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

// localStorage is blocked in iframe; safe getter
function localStorage_get(_key: string): string | null {
  try { return null } catch { return null }
}
