import { useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Save, Trash2, ChevronDown, ChevronRight, TrendingUp, LayoutGrid, Search, ParkingCircle, MessageCircle, Send } from 'lucide-react'

// ─── Stage config ─────────────────────────────────────────────────────────────

const OUTINGS_STAGES = ['prospect', 'pitched', 'engaged', 'negotiating', 'booked', 'completed'] as const
const MFS_STAGES = ['prospect', 'contacted', 'engaged', 'proposal', 'negotiating', 'signed', 'onboarding', 'active'] as const
const AFFILIATE_STAGES = ['prospect', 'contacted', 'engaged', 'negotiating', 'active'] as const

const STAGE_LABELS: Record<string, string> = {
  prospect: 'Prospect', pitched: 'Pitched', contacted: 'Contacted', engaged: 'Engaged',
  proposal: 'Proposal', negotiating: 'Negotiating', booked: 'Booked', completed: 'Completed',
  signed: 'Signed', onboarding: 'Onboarding', active: 'Active', parking_lot: 'Parking Lot', lost: 'Lost',
}

type PipelineTab = 'outings' | 'mfs' | 'affiliates' | 'all'

// ─── Stage color map ──────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  prospect:    '#6b7280',
  pitched:     '#60a5fa',
  contacted:   '#60a5fa',
  engaged:     '#38bdf8',
  proposal:    '#a78bfa',
  negotiating: '#C9A84C',
  booked:      '#4ade80',
  completed:   '#4ade80',
  signed:      '#4ade80',
  onboarding:  '#34d399',
  active:      '#10b981',
  parking_lot: '#f59e0b',
  lost:        '#ef4444',
}

function getStageColor(stage: string): string {
  return STAGE_COLORS[stage] ?? '#6b7280'
}

function getStageBg(stage: string): string {
  const c = getStageColor(stage)
  return `${c}18`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(val: number | null | undefined, suffix = ''): string {
  if (val == null || val === 0) return '—'
  let s: string
  if (val >= 1_000_000) s = `$${(val / 1_000_000).toFixed(1)}M`
  else if (val >= 1000) s = `$${Math.round(val / 1000)}K`
  else s = `$${val}`
  return suffix ? s + suffix : s
}

function timeAgo(date: string | null | undefined): string {
  if (!date) return ''
  const d = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  if (d === 0) return 'today'
  if (d === 1) return '1d ago'
  return `${d}d ago`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

const inputStyle = {
  background: 'hsl(45 10% 12%)',
  border: '1px solid hsl(45 10% 22%)',
  color: 'var(--text-primary)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
  outline: 'none',
} as const

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 4,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

// ─── Note Timeline ────────────────────────────────────────────────────────────

function NoteTimeline({ dealId, pipelineType }: { dealId: number | null; pipelineType: string }) {
  const qc = useQueryClient()
  const [newNote, setNewNote] = useState('')
  const [sending, setSending] = useState(false)

  const { data: notes = [] } = useQuery({
    queryKey: ['pipeline_notes', pipelineType, dealId],
    queryFn: async () => {
      if (!dealId) return []
      const { data } = await supabase
        .from('pipeline_notes')
        .select('*')
        .eq('pipeline_type', pipelineType)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!dealId,
    staleTime: 10_000,
  })

  const handleAdd = async () => {
    if (!newNote.trim() || !dealId) return
    setSending(true)
    await supabase.from('pipeline_notes').insert({
      pipeline_type: pipelineType,
      deal_id: dealId,
      note: newNote.trim(),
    })
    setNewNote('')
    setSending(false)
    qc.invalidateQueries({ queryKey: ['pipeline_notes', pipelineType, dealId] })
  }

  if (!dealId) return null

  return (
    <div>
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 4 }}>
        <MessageCircle size={11} /> Activity Notes
      </label>
      {/* Add note input */}
      <div className="flex gap-2 mb-2">
        <input
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() } }}
          placeholder="Add a note..."
          style={{ ...inputStyle, fontSize: 12 }}
        />
        <button
          onClick={handleAdd}
          disabled={!newNote.trim() || sending}
          className="flex items-center justify-center px-2.5 rounded-lg flex-shrink-0"
          style={{ background: newNote.trim() ? 'var(--gold)' : 'hsl(45 10% 18%)', color: newNote.trim() ? 'var(--surface-darkest)' : 'var(--text-muted)' }}
        >
          <Send size={12} />
        </button>
      </div>
      {/* Timeline */}
      {notes.length > 0 && (
        <div className="space-y-0 max-h-40 overflow-y-auto rounded-lg" style={{ background: 'hsl(45 10% 9%)', border: '1px solid hsl(45 10% 18%)' }}>
          {notes.map((n: any) => {
            const d = new Date(n.created_at)
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            return (
              <div key={n.id} className="flex gap-2 px-3 py-2" style={{ borderBottom: '1px solid hsl(45 10% 14%)' }}>
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{n.note}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                    {dateStr} at {timeStr}{n.author && n.author !== 'team' ? ` · ${n.author}` : ''}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  deal,
  tab,
  onClose,
  onSaved,
}: {
  deal: any
  tab: 'outings' | 'mfs'
  onClose: () => void
  onSaved: () => void
}) {
  const isOuting = tab === 'outings'
  const stages = isOuting ? [...OUTINGS_STAGES, 'parking_lot', 'lost'] : [...MFS_STAGES, 'parking_lot', 'lost']

  const [form, setForm] = useState(
    isOuting
      ? {
          name: deal.name ?? '',
          client_company: deal.client_company ?? '',
          contact_name: deal.contact_name ?? '',
          contact_email: deal.contact_email ?? '',
          status: deal.status ?? 'prospect',
          value: deal.value != null ? String(deal.value) : '',
          event_date: deal.event_date ? deal.event_date.split('T')[0] : '',
          location: deal.location ?? '',
          notes: deal.notes ?? '',
        }
      : {
          company_name: deal.company_name ?? '',
          contact_name: deal.contact_name ?? '',
          contact_email: deal.contact_email ?? '',
          status: deal.status ?? 'prospect',
          estimated_monthly_revenue: deal.estimated_monthly_revenue != null ? String(deal.estimated_monthly_revenue) : '',
          estimated_monthly_volume: deal.estimated_monthly_volume != null ? String(deal.estimated_monthly_volume) : '',
          notes: deal.notes ?? '',
        }
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: string, val: string) => setForm((f: any) => ({ ...f, [key]: val }))
  const isNew = !deal.id

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const now = new Date().toISOString()
    let payload: any
    if (isOuting) {
      payload = {
        name: (form as any).name.trim() || null,
        client_company: (form as any).client_company.trim() || null,
        contact_name: (form as any).contact_name.trim() || null,
        contact_email: (form as any).contact_email.trim() || null,
        status: (form as any).status,
        value: (form as any).value ? parseFloat((form as any).value) : null,
        event_date: (form as any).event_date || null,
        location: (form as any).location.trim() || null,
        notes: (form as any).notes.trim() || null,
        updated_at: now,
      }
    } else {
      payload = {
        company_name: (form as any).company_name.trim() || null,
        contact_name: (form as any).contact_name.trim() || null,
        contact_email: (form as any).contact_email.trim() || null,
        status: (form as any).status,
        estimated_monthly_revenue: (form as any).estimated_monthly_revenue ? parseFloat((form as any).estimated_monthly_revenue) : null,
        estimated_monthly_volume: (form as any).estimated_monthly_volume ? parseInt((form as any).estimated_monthly_volume) : null,
        notes: (form as any).notes.trim() || null,
        updated_at: now,
      }
    }
    const table = isOuting ? 'outings_pipeline' : 'mfs_pipeline'
    let newDealId = deal.id
    if (isNew) {
      const { data: inserted, error: err } = await supabase.from(table).insert({ ...payload, created_at: now }).select('id').single()
      if (err) { setSaving(false); setError(err.message); return }
      newDealId = inserted.id
      // Log creation note
      await supabase.from('pipeline_notes').insert({
        pipeline_type: isOuting ? 'outings' : 'mfs',
        deal_id: newDealId,
        note: `Deal created — ${STAGE_LABELS[(form as any).status] || (form as any).status}`,
        author: 'system',
      })
    } else {
      const { error: err } = await supabase.from(table).update(payload).eq('id', deal.id)
      if (err) { setSaving(false); setError(err.message); return }
      // Log status change
      if ((form as any).status !== deal.status) {
        await supabase.from('pipeline_notes').insert({
          pipeline_type: isOuting ? 'outings' : 'mfs',
          deal_id: deal.id,
          note: `Status changed: ${STAGE_LABELS[deal.status] || deal.status} → ${STAGE_LABELS[(form as any).status] || (form as any).status}`,
          author: 'system',
        })
      }
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    const table = isOuting ? 'outings_pipeline' : 'mfs_pipeline'
    await supabase.from(table).delete().eq('id', deal.id)
    setDeleting(false)
    onSaved()
    onClose()
  }

  const stageColor = getStageColor((form as any).status)

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-6 space-y-4"
        style={{
          background: 'hsl(45 10% 11%)',
          border: '1px solid hsl(45 10% 22%)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isNew ? (isOuting ? 'New Outing' : 'New MFS Client') : (isOuting ? 'Edit Outing' : 'Edit MFS Client')}
            </span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: getStageBg((form as any).status), color: stageColor, border: `1px solid ${stageColor}30` }}
            >
              {(form as any).status}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-all hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        {isOuting ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label style={labelStyle}>Event / Name</label>
              <input style={inputStyle} value={(form as any).name} onChange={(e) => set('name', e.target.value)} placeholder="Tournament or event name" />
            </div>
            <div>
              <label style={labelStyle}>Client Company</label>
              <input style={inputStyle} value={(form as any).client_company} onChange={(e) => set('client_company', e.target.value)} placeholder="Company" />
            </div>
            <div>
              <label style={labelStyle}>Contact Name</label>
              <input style={inputStyle} value={(form as any).contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="Contact person" />
            </div>
            <div>
              <label style={labelStyle}>Contact Email</label>
              <input style={inputStyle} type="email" value={(form as any).contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Value ($)</label>
              <input style={inputStyle} type="number" value={(form as any).value} onChange={(e) => set('value', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Event Date</label>
              <input style={inputStyle} type="date" value={(form as any).event_date} onChange={(e) => set('event_date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={(form as any).location} onChange={(e) => set('location', e.target.value)} placeholder="City, venue…" />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={(form as any).status} onChange={(e) => set('status', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} data-testid="status-select-outing">
                {stages.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, resize: 'none', height: 72 }} value={(form as any).notes} onChange={(e) => set('notes', e.target.value)} placeholder="Any additional notes…" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label style={labelStyle}>Company Name</label>
              <input style={inputStyle} value={(form as any).company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="Company" />
            </div>
            <div>
              <label style={labelStyle}>Contact Name</label>
              <input style={inputStyle} value={(form as any).contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="Contact person" />
            </div>
            <div>
              <label style={labelStyle}>Contact Email</label>
              <input style={inputStyle} type="email" value={(form as any).contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={(form as any).status} onChange={(e) => set('status', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} data-testid="status-select-mfs">
                {stages.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Est. Monthly Revenue ($)</label>
              <input style={inputStyle} type="number" value={(form as any).estimated_monthly_revenue} onChange={(e) => set('estimated_monthly_revenue', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Est. Monthly Volume</label>
              <input style={inputStyle} type="number" value={(form as any).estimated_monthly_volume} onChange={(e) => set('estimated_monthly_volume', e.target.value)} placeholder="0" />
            </div>
            <div className="sm:col-span-2">
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, resize: 'none', height: 72 }} value={(form as any).notes} onChange={(e) => set('notes', e.target.value)} placeholder="Any additional notes…" />
            </div>
          </div>
        )}

        {/* Note Timeline */}
        {!isNew && (
          <NoteTimeline dealId={deal.id} pipelineType={isOuting ? 'outings' : 'mfs'} />
        )}

        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <div>
            {!isNew && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{ color: confirmDelete ? '#ef4444' : 'var(--text-muted)', background: confirmDelete ? 'rgba(239,68,68,0.12)' : 'transparent' }}
                data-testid={`delete-deal-${deal.id}`}
              >
                <Trash2 size={12} />
                {confirmDelete ? (deleting ? 'Deleting…' : 'Confirm Delete') : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              data-testid={isOuting ? 'save-outing' : 'save-mfs'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'var(--gold)', color: 'var(--surface-darkest)', opacity: saving ? 0.7 : 1 }}
            >
              <Save size={12} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Compact Kanban Card ──────────────────────────────────────────────────────

function KanbanCard({
  deal,
  stage,
  valueField,
  valueSuffix,
  nameField,
  onEdit,
}: {
  deal: any
  stage: string
  valueField: string
  valueSuffix?: string
  nameField: string
  onEdit: () => void
}) {
  const color = getStageColor(stage)
  const ago = timeAgo(deal.updated_at || deal.created_at)
  const name = deal[nameField] || '—'
  const val = deal[valueField]

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('dealId', String(deal.id))
        e.dataTransfer.setData('fromStage', deal.status)
      }}
      onClick={onEdit}
      data-testid={`kanban-card-${deal.id}`}
      className="group cursor-pointer transition-all duration-100 hover:brightness-110 select-none"
      style={{
        background: 'var(--surface-card)',
        border: '1px solid hsl(45 10% 20%)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: '7px 10px',
        minHeight: 58,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 3,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className="text-xs font-semibold leading-tight line-clamp-1 flex-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {name}
        </span>
        {val != null && val !== 0 && (
          <span
            className="text-xs font-bold tabular-nums flex-shrink-0"
            style={{ color: 'var(--gold)' }}
          >
            {formatValue(val, valueSuffix)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {deal.client_company && (
          <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
            {deal.client_company}
          </span>
        )}
        {deal.contact_name && (
          <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
            {deal.contact_name}
          </span>
        )}
        {ago && (
          <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: 'var(--text-muted)', opacity: 0.55 }}>
            {ago}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  deals,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  valueField,
  valueSuffix,
  nameField,
  onEditDeal,
}: {
  stage: string
  deals: any[]
  isDragOver: boolean
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  valueField: string
  valueSuffix?: string
  nameField: string
  onEditDeal: (deal: any) => void
}) {
  const color = getStageColor(stage)
  const total = deals.reduce((sum, d) => sum + (d[valueField] ?? 0), 0)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver() }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        minWidth: 200,
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        transition: 'box-shadow 0.15s',
        borderRadius: 10,
        border: isDragOver ? `2px solid var(--gold)` : '2px solid transparent',
        background: isDragOver ? 'rgba(201,168,76,0.05)' : 'transparent',
      }}
    >
      {/* Column header */}
      <div
        className="px-3 py-2 rounded-t-lg flex items-center justify-between mb-2"
        style={{ background: `${color}14`, borderBottom: `1px solid ${color}30` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color }}
          >
            {stage}
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: `${color}25`, color }}
          >
            {deals.length}
          </span>
        </div>
        {total > 0 && (
          <span className="text-[10px] font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {formatValue(total, valueSuffix)}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-1.5 px-1.5 pb-2" style={{ minHeight: 80 }}>
        {deals.length === 0 && (
          <div
            className="text-[11px] text-center py-4 rounded-lg"
            style={{ color: 'var(--text-muted)', opacity: 0.4, border: '1px dashed hsl(45 10% 22%)' }}
          >
            Drop here
          </div>
        )}
        {deals.map((deal) => (
          <KanbanCard
            key={deal.id}
            deal={deal}
            stage={stage}
            valueField={valueField}
            valueSuffix={valueSuffix}
            nameField={nameField}
            onEdit={() => onEditDeal(deal)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Lost Deals Chip ──────────────────────────────────────────────────────────

function LostChip({
  deals,
  nameField,
  valueField,
  valueSuffix,
  onEdit,
}: {
  deals: any[]
  nameField: string
  valueField: string
  valueSuffix?: string
  onEdit: (deal: any) => void
}) {
  const [open, setOpen] = useState(false)
  if (deals.length === 0) return null

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {deals.length} Lost
      </button>
      {open && (
        <div
          className="mt-2 rounded-xl p-3 space-y-1.5"
          style={{ background: 'var(--surface-card)', border: '1px solid rgba(239,68,68,0.15)' }}
        >
          {deals.map((deal) => (
            <div
              key={deal.id}
              onClick={() => onEdit(deal)}
              className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all hover:brightness-110"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', borderLeft: '3px solid #ef4444' }}
            >
              <span className="text-xs line-through" style={{ color: 'var(--text-muted)' }}>
                {deal[nameField] || '—'}
              </span>
              <span className="text-xs tabular-nums" style={{ color: '#ef4444', opacity: 0.7 }}>
                {formatValue(deal[valueField], valueSuffix)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Summary Stats Bar ────────────────────────────────────────────────────────

function SummaryBar({
  outings,
  mfsDeals,
}: {
  outings: any[]
  mfsDeals: any[]
}) {
  const stats = useMemo(() => {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    const allDeals = [
      ...outings.filter((d) => d.status !== 'lost').map((d) => ({ value: d.value || 0, status: d.status, updatedAt: d.updated_at })),
      ...mfsDeals.filter((d) => d.status !== 'lost').map((d) => ({ value: d.estimated_monthly_revenue || 0, status: d.status, updatedAt: d.updated_at })),
    ]

    const totalValue = allDeals.reduce((s, d) => s + d.value, 0)
    const activeCount = allDeals.length
    const lateStages = new Set(['negotiating', 'booked', 'signed', 'onboarding', 'active', 'completed'])
    const lateCount = allDeals.filter((d) => lateStages.has(d.status)).length
    const wonStages = new Set(['booked', 'completed', 'signed', 'active'])
    const wonThisMonth = [
      ...outings.filter((d) => wonStages.has(d.status) && new Date(d.updated_at || d.created_at).getTime() > thirtyDaysAgo),
      ...mfsDeals.filter((d) => wonStages.has(d.status) && new Date(d.updated_at || d.created_at).getTime() > thirtyDaysAgo),
    ].length
    const lostCount = outings.filter((d) => d.status === 'lost').length + mfsDeals.filter((d) => d.status === 'lost').length

    return { totalValue, activeCount, lateCount, wonThisMonth, lostCount }
  }, [outings, mfsDeals])

  const items = [
    { label: 'Pipeline Value', value: formatValue(stats.totalValue), accent: true },
    { label: 'Active Deals', value: String(stats.activeCount), accent: false },
    { label: 'Negotiating+', value: String(stats.lateCount), accent: false },
    { label: 'Won (30d)', value: String(stats.wonThisMonth), green: true },
    { label: 'Lost', value: String(stats.lostCount), muted: true },
  ]

  return (
    <div
      className="flex items-stretch gap-0 rounded-xl overflow-hidden flex-shrink-0"
      style={{ border: '1px solid hsl(45 10% 20%)', background: 'var(--surface-card)' }}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className="flex-1 px-4 py-3 flex flex-col gap-0.5"
          style={{ borderRight: i < items.length - 1 ? '1px solid hsl(45 10% 18%)' : 'none' }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {item.label}
          </span>
          <span
            className="text-lg font-bold tabular-nums leading-tight"
            style={{
              color: (item as any).accent ? 'var(--gold)' : (item as any).green ? '#4ade80' : (item as any).muted ? 'var(--text-muted)' : 'var(--text-primary)',
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── All Tab ──────────────────────────────────────────────────────────────────

function AllTab({ outings, mfsDeals }: { outings: any[]; mfsDeals: any[] }) {
  const outingStats = useMemo(() => {
    const active = outings.filter((d) => d.status !== 'lost')
    const total = active.reduce((s, d) => s + (d.value || 0), 0)
    const byStage: Record<string, number> = {}
    for (const d of outings) byStage[d.status] = (byStage[d.status] || 0) + 1
    return { total, count: outings.length, lostCount: byStage.lost || 0, byStage }
  }, [outings])

  const mfsStats = useMemo(() => {
    const active = mfsDeals.filter((d) => d.status !== 'lost')
    const totalMRR = active.reduce((s, d) => s + (d.estimated_monthly_revenue || 0), 0)
    const byStage: Record<string, number> = {}
    for (const d of mfsDeals) byStage[d.status] = (byStage[d.status] || 0) + 1
    return { totalMRR, count: mfsDeals.length, lostCount: byStage.lost || 0, byStage }
  }, [mfsDeals])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Outings summary card */}
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Outings Pipeline</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{outingStats.count} total</span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Pipeline Value</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--gold)' }}>{formatValue(outingStats.total)}</p>
          </div>
          <div className="space-y-1.5">
            {OUTINGS_STAGES.map((stage) => {
              const count = outingStats.byStage[stage] || 0
              if (count === 0) return null
              return (
                <div key={stage} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getStageColor(stage) }} />
                  <span className="text-xs flex-1 capitalize" style={{ color: 'var(--text-muted)' }}>{stage}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{count}</span>
                </div>
              )
            })}
            {outingStats.lostCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                <span className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>Lost</span>
                <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>{outingStats.lostCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* MFS summary card */}
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>MFS Pipeline</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{mfsStats.count} total</span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Est. MRR</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--gold)' }}>{formatValue(mfsStats.totalMRR)}<span className="text-sm font-normal">/mo</span></p>
          </div>
          <div className="space-y-1.5">
            {MFS_STAGES.map((stage) => {
              const count = mfsStats.byStage[stage] || 0
              if (count === 0) return null
              return (
                <div key={stage} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getStageColor(stage) }} />
                  <span className="text-xs flex-1 capitalize" style={{ color: 'var(--text-muted)' }}>{stage}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{count}</span>
                </div>
              )
            })}
            {mfsStats.lostCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                <span className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>Lost</span>
                <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>{mfsStats.lostCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Combined funnel view */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} style={{ color: 'var(--gold)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Combined Funnel</h3>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Prospect', count: (outingStats.byStage.prospect || 0) + (mfsStats.byStage.prospect || 0) },
            { label: 'Early Stage', count: (outingStats.byStage.pitched || 0) + (outingStats.byStage.engaged || 0) + (mfsStats.byStage.contacted || 0) + (mfsStats.byStage.engaged || 0) + (mfsStats.byStage.proposal || 0) },
            { label: 'Negotiating', count: (outingStats.byStage.negotiating || 0) + (mfsStats.byStage.negotiating || 0) },
            { label: 'Won / Active', count: (outingStats.byStage.booked || 0) + (outingStats.byStage.completed || 0) + (mfsStats.byStage.signed || 0) + (mfsStats.byStage.onboarding || 0) + (mfsStats.byStage.active || 0) },
          ].map((row) => {
            const total = (outings.length + mfsDeals.length) || 1
            const pct = Math.round((row.count / total) * 100)
            return (
              <div key={row.label} className="flex items-center gap-3">
                <span className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: 'hsl(45 10% 18%)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: 'var(--gold)', opacity: 0.75 }}
                  />
                </div>
                <span className="text-xs font-semibold w-6 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{row.count}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({
  stages,
  dealsByStage,
  lostDeals,
  valueField,
  valueSuffix,
  nameField,
  table,
  onEditDeal,
  onRefresh,
}: {
  stages: readonly string[]
  dealsByStage: Record<string, any[]>
  lostDeals: any[]
  valueField: string
  valueSuffix?: string
  nameField: string
  table: 'outings_pipeline' | 'mfs_pipeline'
  onEditDeal: (deal: any) => void
  onRefresh: () => void
}) {
  const [dragOver, setDragOver] = useState<string | null>(null)

  const pipelineType = table === 'outings_pipeline' ? 'outings' : 'mfs'
  const handleMove = useCallback(
    async (dealId: number, toStage: string, fromStage: string) => {
      if (toStage === fromStage) return
      await supabase
        .from(table)
        .update({ status: toStage, updated_at: new Date().toISOString() })
        .eq('id', dealId)
      // Log the move
      await supabase.from('pipeline_notes').insert({
        pipeline_type: pipelineType,
        deal_id: dealId,
        note: `Moved: ${STAGE_LABELS[fromStage] || fromStage} → ${STAGE_LABELS[toStage] || toStage}`,
        author: 'system',
      })
      onRefresh()
    },
    [table, pipelineType, onRefresh]
  )

  return (
    <div>
      {/* Horizontal scroll container */}
      <div
        className="flex gap-3 pb-4"
        style={{ overflowX: 'auto', overflowY: 'visible' }}
      >
        {stages.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            deals={dealsByStage[stage] || []}
            isDragOver={dragOver === stage}
            onDragOver={() => setDragOver(stage)}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              const dealId = parseInt(e.dataTransfer.getData('dealId'))
              const fromStage = e.dataTransfer.getData('fromStage')
              if (!isNaN(dealId)) handleMove(dealId, stage, fromStage)
              setDragOver(null)
            }}
            valueField={valueField}
            valueSuffix={valueSuffix}
            nameField={nameField}
            onEditDeal={onEditDeal}
          />
        ))}
      </div>

      {/* Parking Lot */}
      {(dealsByStage['parking_lot'] || []).length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <ParkingCircle size={13} style={{ color: '#f59e0b' }} />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Parking Lot</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              {(dealsByStage['parking_lot'] || []).length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(dealsByStage['parking_lot'] || []).map((d: any) => (
              <div
                key={d.id}
                onClick={() => onEditDeal(d)}
                className="cursor-pointer rounded-lg px-3 py-2 transition-all hover:brightness-110"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderLeft: '3px solid #f59e0b' }}
              >
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{d[nameField] || '—'}</span>
                {d[valueField] && <span className="text-xs ml-2 tabular-nums" style={{ color: '#f59e0b' }}>{formatValue(d[valueField], valueSuffix)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lost chip */}
      <LostChip
        deals={lostDeals}
        nameField={nameField}
        valueField={valueField}
        valueSuffix={valueSuffix}
        onEdit={onEditDeal}
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<PipelineTab>('outings')
  const [editingDeal, setEditingDeal] = useState<{ deal: any; pipelineTab: 'outings' | 'mfs' } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: outings = [], isLoading: outingsLoading } = useQuery({
    queryKey: ['outings_pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outings_pipeline')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
  })

  const { data: mfsDeals = [], isLoading: mfsLoading } = useQuery({
    queryKey: ['mfs_pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mfs_pipeline')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['outings_pipeline'] })
    qc.invalidateQueries({ queryKey: ['mfs_pipeline'] })
  }, [qc])

  // Search filter helper
  const matchesSearch = useCallback((deal: any) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const fields = [deal.name, deal.company_name, deal.client_company, deal.contact_name, deal.contact_email, deal.notes, deal.location].filter(Boolean)
    return fields.some((f: string) => f.toLowerCase().includes(q))
  }, [searchQuery])

  const outingsByStage = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const s of [...OUTINGS_STAGES, 'parking_lot', 'lost']) map[s] = []
    for (const d of outings) {
      if (!matchesSearch(d)) continue
      const key = map[d.status] !== undefined ? d.status : 'prospect'
      map[key].push(d)
    }
    return map
  }, [outings, matchesSearch])

  const mfsByStage = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const s of [...MFS_STAGES, 'parking_lot', 'lost']) map[s] = []
    for (const d of mfsDeals) {
      if (!matchesSearch(d)) continue
      const key = map[d.status] !== undefined ? d.status : 'prospect'
      map[key].push(d)
    }
    return map
  }, [mfsDeals, matchesSearch])

  const isLoading = (tab === 'outings' || tab === 'all') ? outingsLoading : mfsLoading

  const tabs: { key: PipelineTab; label: string; count?: number }[] = [
    { key: 'outings', label: 'Outings', count: outingsLoading ? undefined : outings.length },
    { key: 'mfs', label: 'MFS', count: mfsLoading ? undefined : mfsDeals.length },
    { key: 'affiliates', label: 'Affiliates' },
    { key: 'all', label: 'All' },
  ]

  const handleAddDeal = () => {
    if (tab === 'outings') setEditingDeal({ deal: {}, pipelineTab: 'outings' })
    else if (tab === 'mfs') setEditingDeal({ deal: {}, pipelineTab: 'mfs' })
    else if (tab === 'affiliates') return // coming soon
    else setEditingDeal({ deal: {}, pipelineTab: 'outings' }) // All tab defaults to outings
  }

  return (
    <div style={{ maxWidth: '100%', padding: '24px 16px 32px', minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-5" style={{ maxWidth: 1200 }}>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <LayoutGrid size={16} style={{ color: 'var(--gold)' }} />
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Pipeline</h1>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {tab === 'outings' && 'Outings & event sales'}
            {tab === 'mfs' && 'MFS client acquisition'}
            {tab === 'affiliates' && 'Affiliate partnerships'}
            {tab === 'all' && 'All pipelines overview'}
          </p>
        </div>
        {tab !== 'affiliates' && tab !== 'all' && (
          <button
            onClick={handleAddDeal}
            data-testid="add-deal-btn"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'var(--gold)', color: 'var(--surface-darkest)' }}
          >
            <Plus size={14} /> Add Deal
          </button>
        )}
      </div>

      {/* Summary bar */}
      {!outingsLoading && !mfsLoading && (
        <div className="mb-5" style={{ maxWidth: 800 }}>
          <SummaryBar outings={outings} mfsDeals={mfsDeals} />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit mb-5" style={{ background: 'hsl(45 10% 14%)' }}>
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            data-testid={`tab-${key}`}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: tab === key ? 'var(--gold)' : 'transparent',
              color: tab === key ? 'var(--surface-darkest)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
            {count !== undefined && ` (${count})`}
          </button>
        ))}
      </div>

      {/* Search bar */}
      {tab !== 'all' && (
        <div className="mb-4" style={{ maxWidth: 360 }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search deals, contacts, companies..."
              className="w-full pl-9 pr-8 py-2 rounded-lg text-xs outline-none"
              style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 22%)', color: 'var(--text-primary)' }}
              data-testid="pipeline-search"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton rounded-xl flex-shrink-0" style={{ width: 220, height: 300 }} />
          ))}
        </div>
      )}

      {/* Outings Kanban */}
      {!isLoading && tab === 'outings' && (
        <KanbanBoard
          stages={OUTINGS_STAGES}
          dealsByStage={outingsByStage}
          lostDeals={outingsByStage['lost'] || []}
          valueField="value"
          nameField="name"
          table="outings_pipeline"
          onEditDeal={(deal) => setEditingDeal({ deal, pipelineTab: 'outings' })}
          onRefresh={invalidate}
        />
      )}

      {/* MFS Kanban */}
      {!isLoading && tab === 'mfs' && (
        <KanbanBoard
          stages={MFS_STAGES}
          dealsByStage={mfsByStage}
          lostDeals={mfsByStage['lost'] || []}
          valueField="estimated_monthly_revenue"
          valueSuffix="/mo"
          nameField="company_name"
          table="mfs_pipeline"
          onEditDeal={(deal) => setEditingDeal({ deal, pipelineTab: 'mfs' })}
          onRefresh={invalidate}
        />
      )}

      {/* Affiliates tab — coming soon */}
      {tab === 'affiliates' && (
        <div>
          {/* Empty kanban columns for visual structure */}
          <div className="flex gap-3 pb-4" style={{ overflowX: 'auto' }}>
            {AFFILIATE_STAGES.map((stage) => (
              <div
                key={stage}
                style={{
                  minWidth: 200,
                  width: 220,
                  flexShrink: 0,
                  borderRadius: 10,
                  border: '2px solid transparent',
                  background: 'transparent',
                }}
              >
                <div
                  className="px-3 py-2 rounded-t-lg flex items-center gap-2 mb-2"
                  style={{ background: `${getStageColor(stage)}14`, borderBottom: `1px solid ${getStageColor(stage)}30` }}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: getStageColor(stage) }}>
                    {stage}
                  </span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${getStageColor(stage)}25`, color: getStageColor(stage) }}
                  >
                    0
                  </span>
                </div>
                <div className="px-1.5 pb-2">
                  <div
                    className="text-[11px] text-center py-8 rounded-lg"
                    style={{ color: 'var(--text-muted)', opacity: 0.3, border: '1px dashed hsl(45 10% 22%)' }}
                  >
                    —
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div
            className="mt-4 rounded-xl p-6 text-center"
            style={{ background: 'var(--surface-card)', border: '1px dashed hsl(45 10% 24%)' }}
          >
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Coming soon</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Add your first affiliate deal — affiliate tracking will use <code className="px-1 rounded text-[10px]" style={{ background: 'hsl(45 10% 18%)' }}>pipeline_type</code> field to segment deals.
            </p>
          </div>
        </div>
      )}

      {/* All tab */}
      {!isLoading && tab === 'all' && (
        <AllTab outings={outings} mfsDeals={mfsDeals} />
      )}

      {/* Edit Modal */}
      {editingDeal && (
        <EditModal
          deal={editingDeal.deal}
          tab={editingDeal.pipelineTab}
          onClose={() => setEditingDeal(null)}
          onSaved={() => { invalidate(); setEditingDeal(null) }}
        />
      )}
    </div>
  )
}
