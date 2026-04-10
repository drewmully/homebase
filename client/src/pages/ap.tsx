import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Edit2, CreditCard, AlertTriangle, Calendar, CheckCircle, DollarSign } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string
  vendor: string
  description: string | null
  amount: number
  due_date: string | null
  paid_date: string | null
  paid_amount: number | null
  status: 'overdue' | 'upcoming' | 'paid'
  entity: 'mully' | 'mfs'
  type: 'payable' | 'receivable'
  category: string | null
  recurring: boolean
  frequency: string | null
  assigned_to: string | null
  notes: string | null
  created_at: string
}

interface InvoiceSummary {
  overdue_total: number | null
  overdue_count: number | null
  upcoming_total: number | null
  upcoming_count: number | null
  paid_this_month: number | null
  net_outstanding: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(val: number | null | undefined): string {
  if (!val && val !== 0) return '—'
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}K`
  return `$${val.toLocaleString()}`
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getStatusColor(status: string): { border: string; label: string; labelColor: string; labelBg: string } {
  switch (status) {
    case 'overdue':
      return { border: '#ef4444', label: 'OVERDUE', labelColor: '#ef4444', labelBg: 'rgba(239,68,68,0.12)' }
    case 'upcoming':
      return { border: '#C9A84C', label: 'UPCOMING', labelColor: '#C9A84C', labelBg: 'rgba(201,168,76,0.15)' }
    case 'paid':
      return { border: '#4ade80', label: 'PAID', labelColor: '#4ade80', labelBg: 'rgba(74,222,128,0.12)' }
    default:
      return { border: '#8a8778', label: status.toUpperCase(), labelColor: '#8a8778', labelBg: 'hsl(45 10% 18%)' }
  }
}

function computeStatusFromDate(invoice: Invoice): 'overdue' | 'upcoming' | 'paid' {
  if (invoice.status === 'paid') return 'paid'
  if (!invoice.due_date) return 'upcoming'
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(invoice.due_date)
  due.setHours(0, 0, 0, 0)
  if (due < now) return 'overdue'
  return 'upcoming'
}

const FIELD_STYLE = {
  background: 'hsl(45 10% 12%)',
  border: '1px solid hsl(45 10% 22%)',
  color: 'var(--text-primary)',
} as React.CSSProperties

const ASSIGNED_OPTIONS = ['—', 'Drew', 'Jack', 'Joe']
const FREQUENCY_OPTIONS = ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'annually']

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary, invoices }: { summary: InvoiceSummary | null; invoices: Invoice[] }) {
  // Compute from invoices if summary view not available
  const computed = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    let overdueTotal = 0, overdueCount = 0
    let upcomingTotal = 0, upcomingCount = 0
    let paidThisMonth = 0
    let netOutstanding = 0

    for (const inv of invoices) {
      const eff = computeStatusFromDate(inv)
      if (eff === 'overdue') {
        overdueTotal += inv.amount || 0
        overdueCount++
        netOutstanding += inv.amount || 0
      } else if (eff === 'upcoming') {
        upcomingTotal += inv.amount || 0
        upcomingCount++
        netOutstanding += inv.amount || 0
      } else if (eff === 'paid') {
        const pd = inv.paid_date ? new Date(inv.paid_date) : null
        if (pd && pd >= startOfMonth) {
          paidThisMonth += inv.paid_amount || inv.amount || 0
        }
      }
    }
    return { overdueTotal, overdueCount, upcomingTotal, upcomingCount, paidThisMonth, netOutstanding }
  }, [invoices])

  const overdueTotal = summary?.overdue_total ?? computed.overdueTotal
  const overdueCount = summary?.overdue_count ?? computed.overdueCount
  const upcomingTotal = summary?.upcoming_total ?? computed.upcomingTotal
  const upcomingCount = summary?.upcoming_count ?? computed.upcomingCount
  const paidThisMonth = summary?.paid_this_month ?? computed.paidThisMonth
  const netOutstanding = summary?.net_outstanding ?? computed.netOutstanding

  const cards = [
    {
      icon: AlertTriangle,
      label: 'OVERDUE',
      value: formatMoney(overdueTotal),
      sub: `${overdueCount} item${overdueCount !== 1 ? 's' : ''}`,
      accent: '#ef4444',
      accentBg: 'rgba(239,68,68,0.08)',
    },
    {
      icon: Calendar,
      label: 'UPCOMING',
      value: formatMoney(upcomingTotal),
      sub: `${upcomingCount} item${upcomingCount !== 1 ? 's' : ''}`,
      accent: '#C9A84C',
      accentBg: 'rgba(201,168,76,0.08)',
    },
    {
      icon: CheckCircle,
      label: 'PAID',
      value: formatMoney(paidThisMonth),
      sub: 'this month',
      accent: '#4ade80',
      accentBg: 'rgba(74,222,128,0.08)',
    },
    {
      icon: DollarSign,
      label: 'NET AP',
      value: formatMoney(netOutstanding),
      sub: 'outstanding',
      accent: '#e8e4d9',
      accentBg: 'rgba(232,228,217,0.06)',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="rounded-xl p-4"
            style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: card.accentBg, color: card.accent }}
              >
                <Icon size={14} strokeWidth={2} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: card.accent }}>
                {card.label}
              </span>
            </div>
            <div className="text-xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {card.value}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {card.sub}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Invoice Card ─────────────────────────────────────────────────────────────

function InvoiceCard({
  invoice,
  onPay,
  onEdit,
}: {
  invoice: Invoice
  onPay: (inv: Invoice) => void
  onEdit: (inv: Invoice) => void
}) {
  const eff = computeStatusFromDate(invoice)
  const { border } = getStatusColor(eff)
  const isPaid = eff === 'paid'

  return (
    <div
      className="rounded-xl px-4 py-3.5 transition-all duration-200"
      style={{
        background: 'var(--surface-card)',
        border: '1px solid hsl(45 10% 20%)',
        borderLeft: `3px solid ${border}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Vendor + amount row */}
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-sm font-medium truncate"
              style={{
                color: 'var(--text-primary)',
                textDecoration: isPaid ? 'line-through' : 'none',
                opacity: isPaid ? 0.55 : 1,
              }}
            >
              {invoice.vendor || '—'}
            </span>
            <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
              {formatMoney(invoice.amount)}
            </span>
          </div>

          {/* Description */}
          {invoice.description && (
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {invoice.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[11px] capitalize" style={{ color: 'var(--text-muted)' }}>
              {invoice.entity || '—'}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              · {invoice.type || 'payable'}
            </span>
            {invoice.assigned_to && (
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                · {invoice.assigned_to}
              </span>
            )}
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              · due {formatDate(invoice.due_date)}
            </span>
            {invoice.recurring && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C' }}
              >
                {invoice.frequency || 'recurring'}
              </span>
            )}
          </div>

          {/* Notes */}
          {invoice.notes && (
            <p className="text-[11px] mt-1 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
              {invoice.notes}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          {!isPaid && (
            <button
              onClick={() => onPay(invoice)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: 'rgba(74,222,128,0.1)',
                color: '#4ade80',
                border: '1px solid rgba(74,222,128,0.25)',
              }}
            >
              <CreditCard size={11} />
              Pay
            </button>
          )}
          <button
            onClick={() => onEdit(invoice)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
            style={{
              background: 'rgba(201,168,76,0.1)',
              color: 'var(--gold)',
              border: '1px solid rgba(201,168,76,0.25)',
            }}
          >
            <Edit2 size={11} />
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Status Group ─────────────────────────────────────────────────────────────

function StatusGroup({
  status,
  invoices,
  onPay,
  onEdit,
}: {
  status: 'overdue' | 'upcoming' | 'paid'
  invoices: Invoice[]
  onPay: (inv: Invoice) => void
  onEdit: (inv: Invoice) => void
}) {
  const [open, setOpen] = useState(true)
  const { label, labelColor, labelBg } = getStatusColor(status)
  const total = invoices.reduce((s, inv) => s + (inv.amount || 0), 0)

  if (invoices.length === 0) return null

  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full mb-2"
      >
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: labelColor }}
        >
          {open ? '▾' : '▸'} {label}
        </span>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: labelBg, color: labelColor }}
        >
          {invoices.length}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {formatMoney(total)}
        </span>
      </button>
      {open && (
        <div className="space-y-2 mb-4">
          {invoices.map((inv) => (
            <InvoiceCard key={inv.id} invoice={inv} onPay={onPay} onEdit={onEdit} />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Add Invoice Form ─────────────────────────────────────────────────────────

function AddInvoiceForm({ onClose, onAdd }: { onClose: () => void; onAdd: (data: Partial<Invoice>) => Promise<void> }) {
  const [vendor, setVendor] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<'upcoming' | 'overdue' | 'paid'>('upcoming')
  const [entity, setEntity] = useState<'mully' | 'mfs'>('mully')
  const [type, setType] = useState<'payable' | 'receivable'>('payable')
  const [category, setCategory] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [frequency, setFrequency] = useState('monthly')
  const [assignedTo, setAssignedTo] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendor.trim()) return
    setSaving(true)
    await onAdd({
      vendor: vendor.trim(),
      description: description.trim() || null,
      amount: amount ? parseFloat(amount) : 0,
      due_date: dueDate || null,
      status,
      entity,
      type,
      category: category.trim() || null,
      recurring,
      frequency: recurring ? frequency : null,
      assigned_to: assignedTo && assignedTo !== '—' ? assignedTo : null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--gold)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add Invoice</h3>
        <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Vendor"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none"
            style={FIELD_STYLE}
            autoFocus
            required
          />
          <input
            type="number"
            placeholder="Amount ($)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none"
            style={FIELD_STYLE}
            step="0.01"
          />
        </div>
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={FIELD_STYLE}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            placeholder="Due Date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none"
            style={FIELD_STYLE}
          />
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value as 'mully' | 'mfs')}
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={FIELD_STYLE}
          >
            <option value="mully">Mully</option>
            <option value="mfs">MFS</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'payable' | 'receivable')}
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={FIELD_STYLE}
          >
            <option value="payable">Payable</option>
            <option value="receivable">Receivable</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={FIELD_STYLE}
          >
            <option value="upcoming">Upcoming</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Category (optional)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none"
            style={FIELD_STYLE}
          />
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={FIELD_STYLE}
          >
            {ASSIGNED_OPTIONS.map((o) => (
              <option key={o} value={o === '—' ? '' : o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="rounded"
              style={{ accentColor: '#C9A84C' }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Recurring</span>
          </label>
          {recurring && (
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs outline-none flex-1"
              style={FIELD_STYLE}
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
              ))}
            </select>
          )}
        </div>
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none h-16"
          style={FIELD_STYLE}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'var(--gold)', color: 'var(--surface-darkest)', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Edit Invoice Form ────────────────────────────────────────────────────────

function EditInvoiceForm({
  invoice,
  onClose,
  onSave,
}: {
  invoice: Invoice
  onClose: () => void
  onSave: (id: string, data: Partial<Invoice>) => Promise<void>
}) {
  const [vendor, setVendor] = useState(invoice.vendor || '')
  const [description, setDescription] = useState(invoice.description || '')
  const [amount, setAmount] = useState(String(invoice.amount || ''))
  const [dueDate, setDueDate] = useState(invoice.due_date || '')
  const [status, setStatus] = useState(invoice.status || 'upcoming')
  const [entity, setEntity] = useState(invoice.entity || 'mully')
  const [type, setType] = useState(invoice.type || 'payable')
  const [category, setCategory] = useState(invoice.category || '')
  const [recurring, setRecurring] = useState(invoice.recurring || false)
  const [frequency, setFrequency] = useState(invoice.frequency || 'monthly')
  const [assignedTo, setAssignedTo] = useState(invoice.assigned_to || '')
  const [notes, setNotes] = useState(invoice.notes || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave(invoice.id, {
      vendor: vendor.trim(),
      description: description.trim() || null,
      amount: amount ? parseFloat(amount) : 0,
      due_date: dueDate || null,
      status: status as any,
      entity: entity as any,
      type: type as any,
      category: category.trim() || null,
      recurring,
      frequency: recurring ? frequency : null,
      assigned_to: assignedTo && assignedTo !== '—' ? assignedTo : null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--surface-card)', border: '1px solid rgba(201,168,76,0.5)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Edit Invoice</h3>
        <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Vendor"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none"
            style={FIELD_STYLE}
            required
          />
          <input
            type="number"
            placeholder="Amount ($)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none"
            style={FIELD_STYLE}
            step="0.01"
          />
        </div>
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={FIELD_STYLE}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none"
            style={FIELD_STYLE}
          />
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value as any)}
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={FIELD_STYLE}
          >
            <option value="mully">Mully</option>
            <option value="mfs">MFS</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={FIELD_STYLE}
          >
            <option value="payable">Payable</option>
            <option value="receivable">Receivable</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={FIELD_STYLE}
          >
            <option value="upcoming">Upcoming</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Category (optional)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none"
            style={FIELD_STYLE}
          />
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={FIELD_STYLE}
          >
            {ASSIGNED_OPTIONS.map((o) => (
              <option key={o} value={o === '—' ? '' : o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              style={{ accentColor: '#C9A84C' }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Recurring</span>
          </label>
          {recurring && (
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs outline-none flex-1"
              style={FIELD_STYLE}
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
              ))}
            </select>
          )}
        </div>
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none h-16"
          style={FIELD_STYLE}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'var(--gold)', color: 'var(--surface-darkest)', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function APPage() {
  const qc = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'upcoming' | 'paid'>('all')
  const [entityFilter, setEntityFilter] = useState<'all' | 'mully' | 'mfs'>('all')

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data || []) as Invoice[]
    },
    staleTime: 30_000,
  })

  // Fetch summary view
  const { data: summary } = useQuery({
    queryKey: ['v_invoice_summary'],
    queryFn: async () => {
      const { data } = await supabase.from('v_invoice_summary').select('*').single()
      return data as InvoiceSummary | null
    },
    staleTime: 30_000,
  })

  // Filter and group invoices
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const eff = computeStatusFromDate(inv)
      if (statusFilter !== 'all' && eff !== statusFilter) return false
      if (entityFilter !== 'all' && inv.entity !== entityFilter) return false
      return true
    })
  }, [invoices, statusFilter, entityFilter])

  const grouped = useMemo(() => {
    const overdue: Invoice[] = []
    const upcoming: Invoice[] = []
    const paid: Invoice[] = []
    for (const inv of filtered) {
      const eff = computeStatusFromDate(inv)
      if (eff === 'overdue') overdue.push(inv)
      else if (eff === 'upcoming') upcoming.push(inv)
      else paid.push(inv)
    }
    return { overdue, upcoming, paid }
  }, [filtered])

  // Handlers
  const handlePay = async (inv: Invoice) => {
    await supabase.from('invoices').update({
      status: 'paid',
      paid_date: new Date().toISOString().split('T')[0],
      paid_amount: inv.amount,
    }).eq('id', inv.id)
    qc.invalidateQueries({ queryKey: ['invoices'] })
    qc.invalidateQueries({ queryKey: ['v_invoice_summary'] })
  }

  const handleEdit = (inv: Invoice) => {
    setEditingInvoice(inv)
    setShowAddForm(false)
  }

  const handleSaveEdit = async (id: string, data: Partial<Invoice>) => {
    await supabase.from('invoices').update(data).eq('id', id)
    qc.invalidateQueries({ queryKey: ['invoices'] })
    qc.invalidateQueries({ queryKey: ['v_invoice_summary'] })
    setEditingInvoice(null)
  }

  const handleAddInvoice = async (data: Partial<Invoice>) => {
    await supabase.from('invoices').insert({
      ...data,
      created_at: new Date().toISOString(),
    })
    qc.invalidateQueries({ queryKey: ['invoices'] })
    qc.invalidateQueries({ queryKey: ['v_invoice_summary'] })
  }

  const overdueCount = useMemo(() => invoices.filter((i) => computeStatusFromDate(i) === 'overdue').length, [invoices])

  const filterTabStyle = (active: boolean) => ({
    background: active ? 'var(--gold)' : 'transparent',
    color: active ? 'var(--surface-darkest)' : 'var(--text-muted)',
  })

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Accounts Payable</h1>
          {overdueCount > 0 && (
            <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
              {overdueCount} overdue invoice{overdueCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingInvoice(null) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all touch-target"
          style={{ background: 'var(--gold)', color: 'var(--surface-darkest)' }}
        >
          <Plus size={14} /> Add Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={summary ?? null} invoices={invoices} />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status filter */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'hsl(45 10% 14%)' }}>
          {(['all', 'overdue', 'upcoming', 'paid'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize touch-target"
              style={filterTabStyle(statusFilter === f)}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Entity filter */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'hsl(45 10% 14%)' }}>
          {(['all', 'mully', 'mfs'] as const).map((e) => (
            <button
              key={e}
              onClick={() => setEntityFilter(e)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all touch-target"
              style={filterTabStyle(entityFilter === e)}
            >
              {e === 'all' ? 'All' : e === 'mully' ? 'Mully' : 'MFS'}
            </button>
          ))}
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddInvoiceForm onClose={() => setShowAddForm(false)} onAdd={handleAddInvoice} />
      )}

      {/* Edit form */}
      {editingInvoice && (
        <EditInvoiceForm
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton rounded-xl h-20" />
          ))}
        </div>
      )}

      {/* Invoice groups */}
      {!isLoading && (
        <div className="space-y-1">
          <StatusGroup
            status="overdue"
            invoices={grouped.overdue}
            onPay={handlePay}
            onEdit={handleEdit}
          />
          <StatusGroup
            status="upcoming"
            invoices={grouped.upcoming}
            onPay={handlePay}
            onEdit={handleEdit}
          />
          <StatusGroup
            status="paid"
            invoices={grouped.paid}
            onPay={handlePay}
            onEdit={handleEdit}
          />
          {filtered.length === 0 && (
            <div
              className="text-center py-10 text-xs rounded-xl"
              style={{ color: 'var(--text-muted)', border: '1px dashed hsl(45 10% 20%)' }}
            >
              No invoices found
            </div>
          )}
        </div>
      )}
    </div>
  )
}
