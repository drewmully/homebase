import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronRight, ArrowRight, Star, X } from 'lucide-react'

// ─── Stage config ─────────────────────────────────────────────────────────────

const OUTINGS_STAGES = ['booked', 'completed', 'negotiating', 'pitched', 'prospect', 'lost'] as const
const MFS_STAGES = ['active', 'onboarding', 'signed', 'negotiating', 'proposal', 'contacted', 'prospect', 'lost'] as const

type OutingStage = typeof OUTINGS_STAGES[number]
type MfsStage = typeof MFS_STAGES[number]

function getStageBadge(stage: string): { color: string; bg: string; strikethrough?: boolean } {
  switch (stage) {
    case 'booked':
    case 'active':
    case 'signed':
    case 'completed':
      return { color: '#4ade80', bg: 'rgba(74,222,128,0.12)' }
    case 'negotiating':
    case 'proposal':
      return { color: '#C9A84C', bg: 'rgba(201,168,76,0.15)' }
    case 'pitched':
    case 'contacted':
    case 'onboarding':
      return { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' }
    case 'prospect':
      return { color: '#8a8778', bg: 'hsl(45 10% 18%)' }
    case 'lost':
      return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', strikethrough: true }
    default:
      return { color: '#8a8778', bg: 'hsl(45 10% 18%)' }
  }
}

function formatValue(val: number | null | undefined): string {
  if (!val) return '—'
  if (val >= 1000) return `$${Math.round(val / 1000)}K`
  return `$${val}`
}

function formatTotalValue(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1000) return `$${Math.round(val / 1000)}K`
  return `$${val}`
}

function daysAgo(date: string | null | undefined): string | null {
  if (!date) return null
  const d = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  if (d === 0) return 'today'
  return `${d}d ago`
}

// ─── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  nextStage,
  nextLabel,
  onAdvance,
  valueField = 'value',
}: {
  deal: any
  nextStage: string | null
  nextLabel: string | null
  onAdvance: () => void
  valueField?: string
}) {
  const badge = getStageBadge(deal.status)
  const ago = daysAgo(deal.updated_at || deal.created_at)
  const val = deal[valueField] ?? deal.value ?? deal.estimated_monthly_revenue

  return (
    <div
      className="rounded-xl px-4 py-3.5 transition-all duration-200"
      style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-sm font-medium truncate"
              style={{
                color: 'var(--text-primary)',
                textDecoration: deal.status === 'lost' ? 'line-through' : 'none',
                opacity: deal.status === 'lost' ? 0.6 : 1,
              }}
            >
              {deal.name || deal.company || '—'}
            </span>
            {deal.starred && <Star size={11} fill="#C9A84C" color="#C9A84C" />}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {deal.owner && (
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {deal.owner}
              </span>
            )}
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: badge.bg, color: badge.color }}
            >
              {deal.status}
            </span>
            {ago && (
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {ago}
              </span>
            )}
            {deal.contact && (
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                · {deal.contact}
              </span>
            )}
          </div>
          {deal.notes && (
            <p className="text-[11px] mt-1.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
              {deal.notes}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {formatValue(val)}
          </span>
          {nextStage && nextLabel && deal.status !== 'lost' && (
            <button
              onClick={onAdvance}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: 'rgba(201,168,76,0.1)',
                color: 'var(--gold)',
                border: '1px solid rgba(201,168,76,0.25)',
              }}
            >
              <ArrowRight size={11} />
              {nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Stage Section ────────────────────────────────────────────────────────────

function StageSection({
  stage,
  deals,
  nextStage,
  nextLabel,
  onAdvance,
  valueField,
  defaultOpen = true,
}: {
  stage: string
  deals: any[]
  nextStage: string | null
  nextLabel: string | null
  onAdvance: (deal: any) => void
  valueField?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const badge = getStageBadge(stage)
  const total = deals.reduce((sum, d) => {
    const v = d[valueField || 'value'] ?? d.value ?? d.estimated_monthly_revenue ?? 0
    return sum + (typeof v === 'number' ? v : 0)
  }, 0)

  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full mb-2 group"
      >
        {open ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: badge.color }}
        >
          {stage}
        </span>
        <span
          className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: badge.bg, color: badge.color }}
        >
          {deals.length}
        </span>
        {total > 0 && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {formatTotalValue(total)}
          </span>
        )}
      </button>
      {open && (
        <div className="space-y-2 mb-4">
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              nextStage={nextStage}
              nextLabel={nextLabel}
              onAdvance={() => onAdvance(deal)}
              valueField={valueField}
            />
          ))}
          {deals.length === 0 && (
            <div
              className="text-center py-5 text-xs rounded-xl"
              style={{ color: 'var(--text-muted)', border: '1px dashed hsl(45 10% 20%)' }}
            >
              No deals in {stage}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Add Deal Form ────────────────────────────────────────────────────────────

function AddDealForm({
  tab,
  onClose,
  onAdd,
}: {
  tab: 'outings' | 'mfs'
  onClose: () => void
  onAdd: (deal: any) => void
}) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [value, setValue] = useState('')
  const [status, setStatus] = useState(tab === 'outings' ? 'prospect' : 'prospect')
  const [notes, setNotes] = useState('')

  const stages = tab === 'outings' ? OUTINGS_STAGES : MFS_STAGES

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({
      name: name.trim(),
      contact: contact.trim() || null,
      ...(tab === 'outings' ? { value: value ? parseFloat(value) : null } : { estimated_monthly_revenue: value ? parseFloat(value) : null }),
      status,
      notes: notes.trim() || null,
    })
    onClose()
  }

  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--gold)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          New {tab === 'outings' ? 'Outing' : 'MFS Client'}
        </h3>
        <button onClick={onClose} className="p-1" style={{ color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder={tab === 'outings' ? 'Event / tournament name' : 'Company name'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 22%)', color: 'var(--text-primary)' }}
          autoFocus
        />
        <input
          type="text"
          placeholder="Contact name"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 22%)', color: 'var(--text-primary)' }}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            placeholder={tab === 'outings' ? 'Value ($)' : 'Monthly revenue ($)'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 22%)', color: 'var(--text-primary)' }}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 22%)', color: 'var(--text-primary)' }}
          >
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none h-16"
          style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 22%)', color: 'var(--text-primary)' }}
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
            className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'var(--gold)', color: 'var(--surface-darkest)' }}
          >
            Add Deal
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'outings' | 'mfs'>('outings')
  const [showAddForm, setShowAddForm] = useState(false)

  // Fetch outings pipeline
  const { data: outings = [], isLoading: outingsLoading } = useQuery({
    queryKey: ['outings_pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outings_pipeline')
        .select('*')
        .order('status')
        .order('value', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
  })

  // Fetch MFS pipeline
  const { data: mfsDeals = [], isLoading: mfsLoading } = useQuery({
    queryKey: ['mfs_pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mfs_pipeline')
        .select('*')
        .order('status')
        .order('estimated_monthly_revenue', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
  })

  const isLoading = tab === 'outings' ? outingsLoading : mfsLoading

  // Advance deal to next stage
  const handleAdvanceOuting = async (deal: any) => {
    const idx = OUTINGS_STAGES.indexOf(deal.status as OutingStage)
    if (idx < 0 || idx >= OUTINGS_STAGES.length - 1) return
    const nextStage = OUTINGS_STAGES[idx + 1]
    await supabase
      .from('outings_pipeline')
      .update({ status: nextStage, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
    qc.invalidateQueries({ queryKey: ['outings_pipeline'] })
  }

  const handleAdvanceMfs = async (deal: any) => {
    const idx = MFS_STAGES.indexOf(deal.status as MfsStage)
    if (idx < 0 || idx >= MFS_STAGES.length - 1) return
    const nextStage = MFS_STAGES[idx + 1]
    await supabase
      .from('mfs_pipeline')
      .update({ status: nextStage, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
    qc.invalidateQueries({ queryKey: ['mfs_pipeline'] })
  }

  const handleAddDeal = async (dealData: any) => {
    if (tab === 'outings') {
      await supabase.from('outings_pipeline').insert({
        ...dealData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      qc.invalidateQueries({ queryKey: ['outings_pipeline'] })
    } else {
      await supabase.from('mfs_pipeline').insert({
        ...dealData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      qc.invalidateQueries({ queryKey: ['mfs_pipeline'] })
    }
  }

  // Group by stage
  const outingsByStage = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const s of OUTINGS_STAGES) map[s] = []
    for (const d of outings) {
      const key = d.status && map[d.status] !== undefined ? d.status : 'prospect'
      map[key].push(d)
    }
    return map
  }, [outings])

  const mfsByStage = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const s of MFS_STAGES) map[s] = []
    for (const d of mfsDeals) {
      const key = d.status && map[d.status] !== undefined ? d.status : 'prospect'
      map[key].push(d)
    }
    return map
  }, [mfsDeals])

  // Summary stats
  const outingsSummary = useMemo(() => {
    const activePipeline = outings.filter((d) => d.status !== 'lost' && d.status !== 'completed')
    const total = activePipeline.reduce((s, d) => s + (d.value || 0), 0)
    const stageCounts: Record<string, number> = {}
    for (const s of OUTINGS_STAGES) stageCounts[s] = outingsByStage[s].length
    return { total, stageCounts, count: outings.length }
  }, [outings, outingsByStage])

  const mfsSummary = useMemo(() => {
    const activePipeline = mfsDeals.filter((d) => d.status !== 'lost')
    const total = activePipeline.reduce((s, d) => s + (d.estimated_monthly_revenue || 0), 0)
    const stageCounts: Record<string, number> = {}
    for (const s of MFS_STAGES) stageCounts[s] = mfsByStage[s].length
    return { total, stageCounts, count: mfsDeals.length }
  }, [mfsDeals, mfsByStage])

  const summary = tab === 'outings' ? outingsSummary : mfsSummary

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Pipeline</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--gold)' }}>
              {formatTotalValue(summary.total)} pipeline
            </span>
            {tab === 'outings' ? (
              <>
                {outingsSummary.stageCounts.booked > 0 && (
                  <span style={{ color: '#4ade80' }}>· {outingsSummary.stageCounts.booked} booked</span>
                )}
                {outingsSummary.stageCounts.pitched > 0 && (
                  <span>· {outingsSummary.stageCounts.pitched} pitched</span>
                )}
                {outingsSummary.stageCounts.prospect > 0 && (
                  <span>· {outingsSummary.stageCounts.prospect} prospects</span>
                )}
              </>
            ) : (
              <>
                {mfsSummary.stageCounts.active > 0 && (
                  <span style={{ color: '#4ade80' }}>· {mfsSummary.stageCounts.active} active</span>
                )}
                {mfsSummary.stageCounts.proposal > 0 && (
                  <span>· {mfsSummary.stageCounts.proposal} proposals</span>
                )}
                {mfsSummary.stageCounts.prospect > 0 && (
                  <span>· {mfsSummary.stageCounts.prospect} prospects</span>
                )}
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all touch-target"
          style={{ background: 'var(--gold)', color: 'var(--surface-darkest)' }}
        >
          <Plus size={14} /> Add Deal
        </button>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'hsl(45 10% 14%)' }}>
        <button
          onClick={() => { setTab('outings'); setShowAddForm(false) }}
          className="px-3 py-1.5 rounded-md text-xs font-medium transition-all touch-target"
          style={{
            background: tab === 'outings' ? 'var(--gold)' : 'transparent',
            color: tab === 'outings' ? 'var(--surface-darkest)' : 'var(--text-muted)',
          }}
        >
          Outings ({outings.length})
        </button>
        <button
          onClick={() => { setTab('mfs'); setShowAddForm(false) }}
          className="px-3 py-1.5 rounded-md text-xs font-medium transition-all touch-target"
          style={{
            background: tab === 'mfs' ? 'var(--gold)' : 'transparent',
            color: tab === 'mfs' ? 'var(--surface-darkest)' : 'var(--text-muted)',
          }}
        >
          MFS Clients ({mfsDeals.length})
        </button>
      </div>

      {/* Add Deal form */}
      {showAddForm && (
        <AddDealForm tab={tab} onClose={() => setShowAddForm(false)} onAdd={handleAddDeal} />
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton rounded-xl h-20" />
          ))}
        </div>
      )}

      {/* Outings stages */}
      {!isLoading && tab === 'outings' && (
        <div className="space-y-1">
          {OUTINGS_STAGES.map((stage, idx) => {
            const nextStage = idx < OUTINGS_STAGES.length - 1 ? OUTINGS_STAGES[idx + 1] : null
            const nextLabel = nextStage ? `→ ${nextStage.charAt(0).toUpperCase() + nextStage.slice(1)}` : null
            const deals = outingsByStage[stage] || []
            if (deals.length === 0 && stage === 'lost') return null
            return (
              <StageSection
                key={stage}
                stage={stage}
                deals={deals}
                nextStage={nextStage}
                nextLabel={nextLabel}
                onAdvance={handleAdvanceOuting}
                valueField="value"
                defaultOpen={stage !== 'lost' && stage !== 'completed'}
              />
            )
          })}
        </div>
      )}

      {/* MFS stages */}
      {!isLoading && tab === 'mfs' && (
        <div className="space-y-1">
          {MFS_STAGES.map((stage, idx) => {
            const nextStage = idx < MFS_STAGES.length - 1 ? MFS_STAGES[idx + 1] : null
            const nextLabel = nextStage ? `→ ${nextStage.charAt(0).toUpperCase() + nextStage.slice(1)}` : null
            const deals = mfsByStage[stage] || []
            if (deals.length === 0 && stage === 'lost') return null
            return (
              <StageSection
                key={stage}
                stage={stage}
                deals={deals}
                nextStage={nextStage}
                nextLabel={nextLabel}
                onAdvance={handleAdvanceMfs}
                valueField="estimated_monthly_revenue"
                defaultOpen={stage !== 'lost'}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
