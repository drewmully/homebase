import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Send, Mail, Check, X, Plus, Edit2, Eye, ChevronDown, RefreshCw,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface CampaignDraft {
  id: string
  name: string
  subject: string
  preview_text: string | null
  html_body: string
  text_body: string | null
  segment_name: string
  segment_sql: string
  status: 'pending' | 'approved' | 'rejected' | 'sending' | 'sent' | 'failed'
  proposed_by: string | null
  approved_by: string | null
  approved_at: string | null
  scheduled_at: string | null
  sent_at: string | null
  recipient_count: number | null
  sent_count: number
  failed_count: number
  from_address: string
  reply_to: string
  notes: string | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function StatusBadge({ status }: { status: CampaignDraft['status'] }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: 'rgba(201,168,76,0.12)',  color: '#C9A84C', label: 'Pending' },
    approved: { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80', label: 'Approved' },
    rejected: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: 'Rejected' },
    sending:  { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa', label: 'Sending' },
    sent:     { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80', label: 'Sent' },
    failed:   { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: 'Failed' },
  }
  const s = styles[status] || styles.pending
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

// ─────────────────────────────────────────────
// Blank draft template
// ─────────────────────────────────────────────
function blankDraft(): Partial<CampaignDraft> {
  return {
    name: '',
    subject: '',
    preview_text: '',
    html_body: '',
    text_body: '',
    segment_name: '',
    segment_sql: "SELECT email, first_name FROM subscribers WHERE status = 'active'",
    scheduled_at: null,
    notes: '',
    from_address: 'Drew @ Mully <drew@mail.mymully.com>',
    reply_to: 'drew@mail.mymully.com',
    proposed_by: 'drew',
  }
}

// ─────────────────────────────────────────────
// Edit Modal
// ─────────────────────────────────────────────
interface EditModalProps {
  draft: Partial<CampaignDraft>
  isNew: boolean
  onClose: () => void
  onSave: () => void
}

function EditModal({ draft: initial, isNew, onClose, onSave }: EditModalProps) {
  const [form, setForm] = useState<Partial<CampaignDraft>>({ ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof CampaignDraft, value: string | null) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.name?.trim() || !form.subject?.trim() || !form.html_body?.trim() || !form.segment_sql?.trim() || !form.segment_name?.trim()) {
      setError('Name, subject, segment name, segment SQL, and HTML body are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        const { error: err } = await supabase.from('campaign_drafts').insert({
          name: form.name,
          subject: form.subject,
          preview_text: form.preview_text || null,
          html_body: form.html_body,
          text_body: form.text_body || null,
          segment_name: form.segment_name,
          segment_sql: form.segment_sql,
          scheduled_at: form.scheduled_at || null,
          notes: form.notes || null,
          from_address: form.from_address || 'Drew @ Mully <drew@mail.mymully.com>',
          reply_to: form.reply_to || 'drew@mail.mymully.com',
          proposed_by: form.proposed_by || 'drew',
          status: 'pending',
        })
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('campaign_drafts')
          .update({
            name: form.name,
            subject: form.subject,
            preview_text: form.preview_text || null,
            html_body: form.html_body,
            text_body: form.text_body || null,
            segment_name: form.segment_name,
            segment_sql: form.segment_sql,
            scheduled_at: form.scheduled_at || null,
            notes: form.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', form.id!)
        if (err) throw err
      }
      onSave()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'hsl(45 10% 14%)',
    border: '1px solid hsl(45 10% 22%)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 4,
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 22%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isNew ? 'New Draft' : 'Edit Campaign'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Name (handle)</label>
              <input style={inputStyle} value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. winback_churned_2026_05" />
            </div>
            <div>
              <label style={labelStyle}>Segment Name</label>
              <input style={inputStyle} value={form.segment_name || ''} onChange={e => set('segment_name', e.target.value)} placeholder="e.g. Paused Subs (120)" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Subject</label>
            <input style={inputStyle} value={form.subject || ''} onChange={e => set('subject', e.target.value)} placeholder="Email subject line" />
          </div>

          <div>
            <label style={labelStyle}>Preview Text</label>
            <input style={inputStyle} value={form.preview_text || ''} onChange={e => set('preview_text', e.target.value)} placeholder="Short summary shown in inbox" />
          </div>

          <div>
            <label style={labelStyle}>Segment SQL</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
              value={form.segment_sql || ''}
              onChange={e => set('segment_sql', e.target.value)}
              placeholder="SELECT email, first_name FROM subscribers WHERE ..."
            />
          </div>

          <div>
            <label style={labelStyle}>HTML Body</label>
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
              value={form.html_body || ''}
              onChange={e => set('html_body', e.target.value)}
              placeholder="Full HTML email body"
            />
          </div>

          <div>
            <label style={labelStyle}>Text Body</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              value={form.text_body || ''}
              onChange={e => set('text_body', e.target.value)}
              placeholder="Plain text fallback"
            />
          </div>

          <div>
            <label style={labelStyle}>Scheduled At (optional)</label>
            <input
              type="datetime-local"
              style={inputStyle}
              value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ''}
              onChange={e => set('scheduled_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </div>

          <div>
            <label style={labelStyle}>Notes / Rationale</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
              value={form.notes || ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Why this campaign, what angle, inspiration..."
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: 'hsl(45 10% 18%)', color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--gold)', color: 'var(--surface-darkest)', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Preview Modal
// ─────────────────────────────────────────────
function PreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#fff', border: '1px solid hsl(45 10% 22%)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: 'var(--surface-card)', borderBottom: '1px solid hsl(45 10% 22%)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Email Preview</span>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Campaign Row
// ─────────────────────────────────────────────
interface CampaignRowProps {
  c: CampaignDraft
  onEdit: (c: CampaignDraft) => void
  onPreview: (html: string) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

function CampaignRow({ c, onEdit, onPreview, onApprove, onReject }: CampaignRowProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        style={{ borderBottom: '1px solid hsl(45 10% 18%)', cursor: 'pointer' }}
        onClick={() => setExpanded(x => !x)}
      >
        <td className="px-4 py-3">
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
          <div className="text-xs mt-0.5 truncate max-w-[220px]" style={{ color: 'var(--text-muted)' }}>{c.subject}</div>
        </td>
        <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{c.segment_name}</td>
        <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
        <td className="px-3 py-3 text-xs text-right" style={{ color: 'var(--text-muted)' }}>
          {c.recipient_count != null ? c.recipient_count.toLocaleString() : '—'}
        </td>
        <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {c.scheduled_at ? fmtDate(c.scheduled_at) : c.sent_at ? fmtDate(c.sent_at) : '—'}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
            {/* Preview */}
            <button
              title="Preview HTML"
              onClick={() => onPreview(c.html_body)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}
            >
              <Eye size={13} />
            </button>
            {/* Edit */}
            <button
              title="Edit"
              onClick={() => onEdit(c)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)' }}
            >
              <Edit2 size={13} />
            </button>
            {/* Approve */}
            {c.status === 'pending' && (
              <button
                title="Approve"
                onClick={() => onApprove(c.id)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}
              >
                <Check size={13} />
              </button>
            )}
            {/* Reject */}
            {c.status === 'pending' && (
              <button
                title="Reject"
                onClick={() => onReject(c.id)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: 'hsl(45 10% 12%)', borderBottom: '1px solid hsl(45 10% 18%)' }}>
          <td colSpan={6} className="px-5 py-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Proposed by: </span>
                <span style={{ color: 'var(--text-primary)' }}>{c.proposed_by || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Approved by: </span>
                <span style={{ color: 'var(--text-primary)' }}>{c.approved_by || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Sent: </span>
                <span style={{ color: 'var(--text-primary)' }}>{c.sent_count} / {c.recipient_count ?? '?'}</span>
                {c.failed_count > 0 && <span style={{ color: '#ef4444' }}> ({c.failed_count} failed)</span>}
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Created: </span>
                <span style={{ color: 'var(--text-primary)' }}>{fmtDate(c.created_at)}</span>
              </div>
              {c.notes && (
                <div className="col-span-2">
                  <span style={{ color: 'var(--text-muted)' }}>Notes: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{c.notes}</span>
                </div>
              )}
              <div className="col-span-2">
                <span style={{ color: 'var(--text-muted)' }}>Segment SQL: </span>
                <code style={{ color: '#60a5fa', fontSize: 11 }}>{c.segment_sql}</code>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─────────────────────────────────────────────
// Main CampaignsPage
// ─────────────────────────────────────────────
export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<Partial<CampaignDraft> | null>(null)
  const [isNewDraft, setIsNewDraft] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('campaign_drafts')
      .select('*')
      .order('created_at', { ascending: false })
    setCampaigns((data as CampaignDraft[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleApprove(id: string) {
    await supabase.from('campaign_drafts').update({
      status: 'approved',
      approved_by: 'drew',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await load()
  }

  async function handleReject(id: string) {
    await supabase.from('campaign_drafts').update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await load()
  }

  const filtered = statusFilter === 'all'
    ? campaigns
    : campaigns.filter(c => c.status === statusFilter)

  const statusCounts = campaigns.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)' }}
          >
            <Mail size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Campaigns</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {campaigns.length} total · {statusCounts['pending'] || 0} pending review
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg"
            style={{ background: 'hsl(45 10% 16%)', color: 'var(--text-muted)' }}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => { setIsNewDraft(true); setEditTarget(blankDraft()) }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--gold)', color: 'var(--surface-darkest)' }}
          >
            <Plus size={14} />
            New Draft
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'hsl(45 10% 14%)' }}>
        {['all', 'pending', 'approved', 'sent', 'rejected', 'failed'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all duration-200"
            style={{
              background: statusFilter === s ? 'var(--gold)' : 'transparent',
              color: statusFilter === s ? 'var(--surface-darkest)' : 'var(--text-muted)',
            }}
          >
            {s === 'all' ? `All (${campaigns.length})` : `${s} (${statusCounts[s] || 0})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
      >
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton rounded-lg h-12" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No campaigns found.
            {statusFilter === 'all' && (
              <div className="mt-3">
                <button
                  onClick={() => { setIsNewDraft(true); setEditTarget(blankDraft()) }}
                  className="text-xs underline"
                  style={{ color: 'var(--gold)' }}
                >
                  Create your first draft
                </button>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'hsl(45 10% 14%)', borderBottom: '1px solid hsl(45 10% 20%)' }}>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>Campaign</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>Segment</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>Status</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>Recipients</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>Date</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <CampaignRow
                  key={c.id}
                  c={c}
                  onEdit={c => { setIsNewDraft(false); setEditTarget(c) }}
                  onPreview={html => setPreviewHtml(html)}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {editTarget && (
        <EditModal
          draft={editTarget}
          isNew={isNewDraft}
          onClose={() => setEditTarget(null)}
          onSave={load}
        />
      )}
      {previewHtml !== null && (
        <PreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />
      )}
    </div>
  )
}
