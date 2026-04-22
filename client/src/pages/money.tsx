import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppKV } from '@/lib/hooks'
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
  Line,
} from 'recharts'
import {
  DollarSign,
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  Zap,
  MessageSquare,
  Plus,
  X,
  RefreshCw,
  Download,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function fmt(v: number | string | undefined | null): string {
  if (v === undefined || v === null) return '—'
  const n = typeof v === 'string' ? parseFloat(v.replace(/[$,]/g, '')) : v
  if (isNaN(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function numVal(v: any): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return v
  return parseFloat(String(v).replace(/[$,]/g, '')) || 0
}

// ─────────────────────────────────────────────
// Entity Toggle
// ─────────────────────────────────────────────

function EntityToggle({
  entity,
  onChange,
}: {
  entity: 'mully' | 'mfs'
  onChange: (e: 'mully' | 'mfs') => void
}) {
  return (
    <div
      className="flex items-center gap-1 p-0.5 rounded-lg"
      style={{ background: 'hsl(45 10% 14%)' }}
    >
      {(['mully', 'mfs'] as const).map((e) => (
        <button
          key={e}
          data-testid={`entity-toggle-${e}`}
          onClick={() => onChange(e)}
          className="px-4 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={{
            background: entity === e ? 'var(--gold)' : 'transparent',
            color: entity === e ? 'var(--surface-darkest)' : 'var(--text-muted)',
          }}
        >
          {e === 'mully' ? 'Mully' : 'MFS'}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Section 1 — Cash Position
// ─────────────────────────────────────────────

interface CashAccount {
  name: string
  balance: number
  institution?: string
}

function CashPositionSection({ entity }: { entity: 'mully' | 'mfs' }) {
  const { data: cashData, isLoading } = useAppKV('real_cash')

  const { accounts, total } = useMemo(() => {
    if (!cashData) return { accounts: [] as CashAccount[], total: 0 }

    let accts: CashAccount[] = []

    // First try accounts array (most detailed)
    if (Array.isArray(cashData.accounts)) {
      const filtered = cashData.accounts.filter((a: any) => {
        const n = ((a.name || '') + ' ' + (a.institution || '')).toLowerCase()
        if (entity === 'mully') return n.includes('huntington') || n.includes('shopify')
        return n.includes('mercury')
      })
      accts = filtered.map((a: any) => ({
        name: a.name || a.institution,
        balance: numVal(a.balance || a.current),
      }))
    }

    // Fallback: top-level keys (huntington, shopify, mercury)
    if (accts.length === 0) {
      if (entity === 'mully') {
        for (const key of ['huntington', 'shopify']) {
          const raw = cashData[key]
          if (raw !== undefined && raw !== null) {
            accts.push({ name: key.charAt(0).toUpperCase() + key.slice(1), balance: numVal(raw) })
          }
        }
      } else {
        // MFS — Mercury
        const raw = cashData['mercury'] ?? cashData['mercury_checking_balance']
        if (raw !== undefined && raw !== null) {
          accts.push({ name: 'Mercury', balance: numVal(raw) })
        }
      }
    }

    // Last fallback: entity-tagged arrays
    if (accts.length === 0) {
      const tagged = entity === 'mully' ? cashData.mully : cashData.mfs
      if (Array.isArray(tagged)) {
        accts = tagged.map((a: any) => ({
          name: a.name || a.institution,
          balance: numVal(a.balance || a.current),
        }))
      }
    }

    const total = accts.reduce((sum, a) => sum + a.balance, 0)
    return { accounts: accts, total }
  }, [cashData, entity])

  if (isLoading) {
    return (
      <section>
        <div className="skeleton rounded-xl h-28" />
      </section>
    )
  }

  return (
    <section>
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={15} style={{ color: 'var(--gold)' }} />
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Cash Position
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            · live from Plaid
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Total cash — big number */}
          <div
            className="rounded-xl px-6 py-4 flex-shrink-0"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}
          >
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Total Cash
            </div>
            <div className="text-3xl font-bold tabular-nums" style={{ color: 'var(--gold)' }}>
              {fmt(total)}
            </div>
          </div>

          {/* Per-account cards */}
          <div className="flex flex-wrap gap-3 flex-1">
            {accounts.length === 0 ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No account data yet — Plaid sync pending
              </div>
            ) : (
              accounts.map((acct, i) => {
                const Icon = acct.name.toLowerCase().includes('shopify') ? CreditCard : Building2
                return (
                  <div
                    key={acct.name + i}
                    className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{ background: 'hsl(45 10% 14%)', border: '1px solid hsl(45 10% 18%)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'hsl(45 10% 20%)' }}
                    >
                      <Icon size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div>
                      <div className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>
                        {acct.name}
                      </div>
                      <div className="text-base font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {fmt(acct.balance)}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────
// Section: Expense Breakdown by Category
// ─────────────────────────────────────────────

const EXPENSE_COLORS: Record<string, string> = {
  debt_service: '#ef4444', payroll: '#f97316', shopify_fees: '#eab308',
  rent: '#a855f7', talentpop: '#ec4899', software: '#6366f1',
  content_agency: '#8b5cf6', fulfillment: '#14b8a6', processing_fee: '#06b6d4',
  operating: '#64748b', usps_shipping: '#f43f5e', joe_draws: '#e879f9',
  inventory: '#d97706', invoices: '#dc2626', transfer_out: '#94a3b8',
}

function ExpenseBreakdownSection({ entity }: { entity: 'mully' | 'mfs' }) {
  const forecastKey = entity === 'mully' ? 'forecast_mully' : 'forecast_mfs'
  const { data: forecastData, isLoading } = useAppKV<ForecastData>(forecastKey)

  const { forecastCats, totalExpenses, totalRevenue } = useMemo(() => {
    const fc: Record<string, number> = {}
    let rev = 0
    if (forecastData?.forecast) {
      for (const w of forecastData.forecast.slice(0, 4)) {
        for (const [k, v] of Object.entries(w.outflows || {})) {
          if (v && Number(v) > 0) fc[k] = (fc[k] || 0) + Number(v)
        }
        rev += w.total_inflows || 0
      }
    }
    return {
      forecastCats: Object.entries(fc).sort((a, b) => b[1] - a[1]),
      totalExpenses: Object.values(fc).reduce((s, v) => s + v, 0),
      totalRevenue: rev,
    }
  }, [forecastData])

  if (isLoading) return <div className="skeleton rounded-xl h-32" />
  if (forecastCats.length === 0) return null

  return (
    <section>
      <div className="rounded-xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign size={15} style={{ color: '#ef4444' }} />
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Expense Breakdown</h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· forecast next 4 weeks</span>
          </div>
          <div className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {fmt(totalExpenses)} expenses · {fmt(totalRevenue)} revenue · <span style={{ color: totalRevenue > totalExpenses ? '#4ade80' : '#ef4444' }}>{totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(0) : 0}% of rev</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {forecastCats.slice(0, 10).map(([cat, amt]) => {
            const pctOfRev = totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {LABEL_MAP[cat] || cat.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                    {fmt(amt)} <span style={{ color: pctOfRev > 20 ? '#ef4444' : 'var(--text-muted)' }}>({pctOfRev.toFixed(1)}% rev)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(45 10% 16%)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(pctOfRev * 2, 100)}%`, background: EXPENSE_COLORS[cat] || '#64748b' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────
// Section: Cash Notes (Human Overrides)
// ─────────────────────────────────────────────

const OVERRIDE_CATEGORIES = [
  { value: 'pending_deposit', label: 'Pending Deposit', type: 'inflow' },
  { value: 'sub_renewals', label: 'Override Renewals', type: 'inflow' },
  { value: 'outing_revenue', label: 'Outing Revenue', type: 'inflow' },
  { value: 'client_revenue', label: 'Client Revenue (MFS)', type: 'inflow' },
  { value: 'debt_service', label: 'Debt Service', type: 'outflow' },
  { value: 'extra_outflow', label: 'Extra Outflow', type: 'outflow' },
  { value: 'opening_balance', label: 'Override Opening Balance', type: 'balance' },
]

function getNextMondays(count: number): Date[] {
  const result: Date[] = []
  const today = new Date()
  const dayOfWeek = today.getDay()
  const nextMon = new Date(today)
  nextMon.setDate(today.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek))
  nextMon.setHours(0, 0, 0, 0)
  // Also include this week's Monday
  const thisMon = new Date(nextMon)
  thisMon.setDate(nextMon.getDate() - 7)
  result.push(thisMon)
  for (let i = 0; i < count; i++) {
    const d = new Date(nextMon)
    d.setDate(nextMon.getDate() + i * 7)
    result.push(d)
  }
  return result
}

function CashNotesSection({ entity }: { entity: 'mully' | 'mfs' }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState('pending_deposit')
  const [weekIdx, setWeekIdx] = useState(0)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const mondays = useMemo(() => getNextMondays(13), [])

  const { data: overrides, isLoading } = useQuery({
    queryKey: ['cash_overrides', entity],
    queryFn: async () => {
      const { data } = await supabase
        .from('cash_overrides')
        .select('*')
        .eq('entity', entity)
        .eq('active', true)
        .order('week_start')
      return data || []
    },
    staleTime: 10_000,
  })

  const [recomputing, setRecomputing] = useState(false)
  const [recomputeDone, setRecomputeDone] = useState(false)

  const recomputeForecast = async () => {
    setRecomputing(true)
    const fn = entity === 'mully' ? 'recompute_forecast_mully' : 'recompute_forecast_mfs'
    await supabase.rpc(fn)
    qc.invalidateQueries({ queryKey: ['app_kv', entity === 'mully' ? 'forecast_mully' : 'forecast_mfs'] })
    setRecomputing(false)
    setRecomputeDone(true)
    setTimeout(() => setRecomputeDone(false), 3000)
  }

  const handleAdd = async () => {
    const num = parseFloat(amount.replace(/[$,]/g, ''))
    if (isNaN(num) || num === 0) return
    setSaving(true)
    const weekStart = mondays[weekIdx].toISOString().split('T')[0]
    await supabase.from('cash_overrides').upsert({
      entity,
      week_start: weekStart,
      category,
      amount: num,
      note: note || null,
      active: true,
    }, { onConflict: 'entity,week_start,category' })
    setAmount('')
    setNote('')
    setShowForm(false)
    setSaving(false)
    qc.invalidateQueries({ queryKey: ['cash_overrides', entity] })
    // Auto-recompute forecast
    await recomputeForecast()
  }

  const handleRemove = async (id: number) => {
    await supabase.from('cash_overrides').update({ active: false }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['cash_overrides', entity] })
    await recomputeForecast()
  }

  const activeOverrides = (overrides || []).filter((o: any) => o.active)

  return (
    <section>
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={15} style={{ color: 'var(--gold)' }} />
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Cash Notes
            </h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              · overrides feed the forecast
            </span>
            {recomputing && <span className="text-[10px] animate-pulse" style={{ color: 'var(--gold)' }}>Recomputing...</span>}
            {recomputeDone && <span className="text-[10px]" style={{ color: '#4ade80' }}>Forecast updated</span>}
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{
              background: showForm ? 'rgba(239,68,68,0.1)' : 'rgba(201,168,76,0.1)',
              color: showForm ? '#ef4444' : 'var(--gold)',
              border: `1px solid ${showForm ? 'rgba(239,68,68,0.2)' : 'rgba(201,168,76,0.2)'}`,
            }}
          >
            {showForm ? <><X size={11} /> Cancel</> : <><Plus size={11} /> Add Note</>}
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div
            className="rounded-lg p-3 mb-3 space-y-2"
            style={{ background: 'hsl(45 10% 12%)', border: '1px solid hsl(45 10% 20%)' }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="rounded-lg px-2 py-1.5 text-xs outline-none"
                style={{ background: 'hsl(45 10% 16%)', border: '1px solid hsl(45 10% 25%)', color: 'var(--text-primary)' }}
              >
                {OVERRIDE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select
                value={weekIdx}
                onChange={e => setWeekIdx(Number(e.target.value))}
                className="rounded-lg px-2 py-1.5 text-xs outline-none"
                style={{ background: 'hsl(45 10% 16%)', border: '1px solid hsl(45 10% 25%)', color: 'var(--text-primary)' }}
              >
                {mondays.map((d, i) => (
                  <option key={i} value={i}>
                    Wk {d.getMonth() + 1}/{d.getDate()}{i === 0 ? ' (this wk)' : i === 1 ? ' (next wk)' : ''}
                  </option>
                ))}
              </select>
              <input
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="$18,000"
                className="rounded-lg px-2 py-1.5 text-xs outline-none tabular-nums"
                style={{ background: 'hsl(45 10% 16%)', border: '1px solid hsl(45 10% 25%)', color: 'var(--text-primary)' }}
              />
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="rounded-lg px-2 py-1.5 text-xs outline-none"
                style={{ background: 'hsl(45 10% 16%)', border: '1px solid hsl(45 10% 25%)', color: 'var(--text-primary)' }}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!amount.trim() || saving}
              className="px-4 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: amount.trim() ? 'var(--gold)' : 'hsl(45 10% 20%)',
                color: amount.trim() ? 'var(--surface-darkest)' : 'var(--text-muted)',
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Add to Forecast'}
            </button>
          </div>
        )}

        {/* Active overrides */}
        {isLoading ? (
          <div className="skeleton rounded-lg h-8" />
        ) : activeOverrides.length === 0 ? (
          <div className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
            No active overrides. The forecast uses default assumptions. Add a note to adjust specific weeks.
          </div>
        ) : (
          <div className="space-y-1">
            {activeOverrides.map((o: any) => {
              const catLabel = OVERRIDE_CATEGORIES.find(c => c.value === o.category)?.label || o.category
              const catType = OVERRIDE_CATEGORIES.find(c => c.value === o.category)?.type || 'inflow'
              const weekDate = new Date(o.week_start + 'T00:00:00')
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: 'hsl(45 10% 13%)', border: '1px solid hsl(45 10% 18%)' }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{
                        background: catType === 'inflow' ? 'rgba(74,222,128,0.1)' : catType === 'outflow' ? 'rgba(239,68,68,0.1)' : 'rgba(96,165,250,0.1)',
                        color: catType === 'inflow' ? '#4ade80' : catType === 'outflow' ? '#ef4444' : '#60a5fa',
                      }}
                    >
                      {catLabel}
                    </span>
                    <span className="text-xs tabular-nums font-semibold" style={{ color: catType === 'inflow' ? '#4ade80' : catType === 'outflow' ? '#ef4444' : '#60a5fa' }}>
                      {fmt(o.amount)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Wk {weekDate.getMonth() + 1}/{weekDate.getDate()}
                    </span>
                    {o.note && (
                      <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        — {o.note}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(o.id)}
                    className="text-xs px-1.5 py-0.5 rounded opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ color: '#ef4444' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────
// Section 3 — 13-Week Forecast Chart
// ─────────────────────────────────────────────

interface ForecastWeek {
  date: string
  week: number
  week_label: string
  opening_cash: number
  closing_cash: number
  net_cash_flow: number
  total_inflows: number
  total_outflows: number
  inflows: Record<string, number>
  outflows: Record<string, number>
}

interface ForecastData {
  forecast: ForecastWeek[]
  current_plaid_balance?: number
  min_closing_cash?: number
  negative_weeks?: number
  run_date?: string
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  const isNeg = val < 0
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ background: '#1e1c19', border: '1px solid hsl(45 10% 25%)', color: 'var(--text-primary)' }}
    >
      <div className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="font-bold" style={{ color: isNeg ? '#ef4444' : 'var(--gold)' }}>
        {fmt(val)}
      </div>
    </div>
  )
}

// Inflow/outflow category colors
const INFLOW_COLORS: Record<string, string> = {
  sub_renewals: '#4ade80',
  online_store: '#22c55e',
  outing_revenue: '#16a34a',
  client_revenue: '#4ade80',
  revenue: '#4ade80',
}

const OUTFLOW_COLORS: Record<string, string> = {
  payroll: '#ef4444',
  operating: '#f87171',
  processing_fee: '#fca5a5',
  fulfillment: '#fb923c',
  inventory: '#f59e0b',
  software: '#d97706',
  content_agency: '#b45309',
  talentpop: '#92400e',
  debt_service: '#dc2626',
  invoices: '#991b1b',
  ap_items: '#7f1d1d',
  joe_draws: '#ef4444',
  usps_shipping: '#f87171',
  amex_shipping: '#fb923c',
  rent: '#dc2626',
  gusto_payroll: '#f59e0b',
  xero: '#d97706',
  misc: '#92400e',
  monthly_costs: '#b45309',
  expenses: '#ef4444',
}

const LABEL_MAP: Record<string, string> = {
  sub_renewals: 'Subscriptions', online_store: 'Online Store', outing_revenue: 'Outings',
  client_revenue: 'Client Revenue', payroll: 'Payroll', operating: 'Operating',
  processing_fee: 'Processing', fulfillment: 'Fulfillment', inventory: 'Inventory',
  software: 'Software', content_agency: 'Content Agency', talentpop: 'Talentpop',
  debt_service: 'Debt', invoices: 'Invoices', ap_items: 'AP Items',
  joe_draws: 'Joe Draws', usps_shipping: 'USPS Shipping', amex_shipping: 'AMEX Labels',
  rent: 'Rent', gusto_payroll: 'Gusto Payroll', xero: 'Xero', misc: 'Misc',
  monthly_costs: 'Monthly Costs',
  revenue: 'Revenue (Actual)',
  expenses: 'Expenses (Actual)',
}

function StackedBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const balance = payload.find((p: any) => p.dataKey === 'balance')
  const inflows = payload.filter((p: any) => p.dataKey.startsWith('in_') && p.value > 0)
  const outflows = payload.filter((p: any) => p.dataKey.startsWith('out_') && p.value > 0)
  return (
    <div className="rounded-lg px-3 py-2.5 text-xs max-w-[260px]" style={{ background: '#1e1c19', border: '1px solid hsl(45 10% 25%)' }}>
      <div className="font-semibold mb-1.5" style={{ color: 'var(--gold)' }}>Week of {label}</div>
      {balance && <div className="mb-1.5" style={{ color: 'var(--text-primary)' }}>Balance: <b>{fmt(balance.value)}</b></div>}
      {inflows.length > 0 && (
        <div className="mb-1">
          <div className="text-[10px] font-medium mb-0.5" style={{ color: '#4ade80' }}>Inflows</div>
          {inflows.map((p: any) => (
            <div key={p.dataKey} className="flex justify-between gap-3">
              <span style={{ color: 'var(--text-muted)' }}>{LABEL_MAP[p.dataKey.replace('in_', '')] || p.dataKey.replace('in_', '')}</span>
              <span className="tabular-nums" style={{ color: '#4ade80' }}>{fmt(p.value)}</span>
            </div>
          ))}
        </div>
      )}
      {outflows.length > 0 && (
        <div>
          <div className="text-[10px] font-medium mb-0.5" style={{ color: '#ef4444' }}>Outflows</div>
          {outflows.map((p: any) => (
            <div key={p.dataKey} className="flex justify-between gap-3">
              <span style={{ color: 'var(--text-muted)' }}>{LABEL_MAP[p.dataKey.replace('out_', '')] || p.dataKey.replace('out_', '')}</span>
              <span className="tabular-nums" style={{ color: '#ef4444' }}>{fmt(p.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ForecastChartSection({ entity }: { entity: 'mully' | 'mfs' }) {
  const forecastKey = entity === 'mully' ? 'forecast_mully' : 'forecast_mfs'
  const { data: forecastData, isLoading } = useAppKV<ForecastData>(forecastKey)

  // Pull historical weekly revenue
  const { data: historicalData } = useQuery({
    queryKey: ['historical-weekly', entity],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_historical_weekly_cash')
        .select('*')
        .eq('entity', entity)
        .order('week_start')
      return data || []
    },
  })

  const { chartData, inflowKeys, outflowKeys } = useMemo(() => {
    const iKeys = new Set<string>()
    const oKeys = new Set<string>()
    const combined: Record<string, any>[] = []

    // Historical weeks — show actual bars only, NO fabricated balance line
    const histWeeks = historicalData || []
    for (const h of histWeeks) {
      const d = new Date(h.week_start)
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      const inflow = parseFloat(h.inflows) || 0
      const outflow = parseFloat(h.outflows) || 0
      combined.push({
        label,
        balance: undefined, // no balance line for historicals — we don't have real weekly balances
        in_revenue: inflow > 0 ? inflow : undefined,
        out_expenses: outflow > 0 ? -outflow : undefined,
        isHistorical: true,
      })
      if (inflow > 0) iKeys.add('revenue')
      if (outflow > 0) oKeys.add('expenses')
    }

    // Forecast weeks
    if (forecastData?.forecast) {
      for (const w of forecastData.forecast) {
        const row: Record<string, any> = {
          label: w.week_label || `Wk${w.week}`,
          balance: w.closing_cash ?? 0,
          isHistorical: false,
        }
        for (const [k, v] of Object.entries(w.inflows || {})) {
          if (v && v > 0) { row[`in_${k}`] = v; iKeys.add(k) }
        }
        for (const [k, v] of Object.entries(w.outflows || {})) {
          if (v && v > 0) { row[`out_${k}`] = -v; oKeys.add(k) }
        }
        combined.push(row)
      }
    }

    return { chartData: combined, inflowKeys: Array.from(iKeys), outflowKeys: Array.from(oKeys) }
  }, [forecastData, historicalData])

  const hasNegative = chartData.some((d) => d.balance < 0)

  const meta = forecastData
    ? {
        runDate: forecastData.run_date
          ? new Date(forecastData.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : null,
        negWeeks: forecastData.negative_weeks ?? 0,
        minCash: forecastData.min_closing_cash,
      }
    : null

  return (
    <section>
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
      >
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              26-Week View — 13 Actual + 13 Forecast
            </h2>
            {meta?.runDate && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Calendar size={11} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Run {meta.runDate}
                </span>
              </div>
            )}
          </div>
          {meta && (
            <div className="flex items-center gap-2 flex-wrap">
              {meta.negWeeks > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                  <AlertTriangle size={11} /> {meta.negWeeks} negative {meta.negWeeks === 1 ? 'week' : 'weeks'}
                </div>
              )}
              {meta.minCash !== undefined && meta.minCash !== null && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium" style={{ background: meta.minCash < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.10)', color: meta.minCash < 0 ? '#ef4444' : '#4ade80' }}>
                  Min: {fmt(meta.minCash)}
                </div>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="skeleton rounded-xl h-64" />
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--text-muted)' }}>No forecast data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(45 10% 16%)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#8a8778', fontSize: 10 }} axisLine={{ stroke: 'hsl(45 10% 20%)' }} tickLine={false} interval={0} />
              <YAxis tick={{ fill: '#8a8778', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtShort(v)} width={56} />
              <Tooltip content={<StackedBarTooltip />} />
              {hasNegative && <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5} />}
              {/* Divider between historical and forecast */}
              {historicalData && historicalData.length > 0 && (
                <ReferenceLine x={chartData[historicalData.length - 1]?.label} stroke="var(--gold)" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'Now', position: 'top', fill: 'var(--gold)', fontSize: 10 }} />
              )}

              {/* Stacked inflow bars (positive) */}
              {inflowKeys.map((k) => (
                <Bar key={`in_${k}`} dataKey={`in_${k}`} stackId="inflows" fill={INFLOW_COLORS[k] || '#4ade80'} barSize={20} radius={0} />
              ))}
              {/* Stacked outflow bars (negative) */}
              {outflowKeys.map((k) => (
                <Bar key={`out_${k}`} dataKey={`out_${k}`} stackId="outflows" fill={OUTFLOW_COLORS[k] || '#ef4444'} barSize={20} radius={0} />
              ))}

              {/* Balance line on top */}
              <Line type="monotone" dataKey="balance" stroke="#C9A84C" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#C9A84C', strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────
// Section 3 — Forecast Breakdown Table
// ─────────────────────────────────────────────

function ForecastBreakdownSection({ entity }: { entity: 'mully' | 'mfs' }) {
  const forecastKey = entity === 'mully' ? 'forecast_mully' : 'forecast_mfs'
  const { data: forecastData, isLoading } = useAppKV<ForecastData>(forecastKey)

  const rows = useMemo(() => {
    if (!forecastData?.forecast) return []
    return forecastData.forecast.map((w) => {
      const inflows =
        w.total_inflows ??
        Object.values(w.inflows || {}).reduce((s, v) => s + (v || 0), 0)

      const outflows =
        w.total_outflows ??
        Object.values(w.outflows || {}).reduce((s, v) => s + (v || 0), 0)

      // Dynamic inflow/outflow detail — reads whatever the forecast provides
      const inDetail: Record<string, number> = {}
      for (const [k, v] of Object.entries(w.inflows || {})) {
        if (v && v > 0) inDetail[k] = v
      }
      const outDetail: Record<string, number> = {}
      for (const [k, v] of Object.entries(w.outflows || {})) {
        if (v && v > 0) outDetail[k] = v
      }

      return {
        label: w.week_label || `Wk${w.week}`,
        date: w.date,
        opening: w.opening_cash ?? 0,
        inflows,
        outflows,
        net: w.net_cash_flow ?? inflows - outflows,
        closing: w.closing_cash ?? 0,
        inDetail,
        outDetail,
      }
    })
  }, [forecastData])

  const [expanded, setExpanded] = useState<string | null>(null)

  const colStyle = (val: number, isClosing = false) => ({
    color:
      isClosing && val < 0
        ? '#ef4444'
        : val < 0
        ? '#ef4444'
        : 'var(--text-primary)',
  })

  if (isLoading) return <div className="skeleton rounded-xl h-56" />

  return (
    <section>
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
      >
        <div className="px-5 pt-4 pb-3 flex items-center gap-2">
          <TrendingUp size={15} style={{ color: 'var(--gold)' }} />
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Forecast Breakdown
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            · click a row to expand
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 pb-5 text-sm" style={{ color: 'var(--text-muted)' }}>
            No forecast data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'hsl(45 10% 13%)' }}>
                  {['Week', 'Opening Cash', 'Inflows', 'Outflows', 'Net', 'Closing Cash'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left font-medium"
                      style={{ color: 'var(--text-muted)', borderBottom: '1px solid hsl(45 10% 18%)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isExp = expanded === row.label
                  const rowBg = i % 2 === 0 ? 'var(--surface-card)' : 'hsl(45 10% 14%)'
                  return (
                    <>
                      <tr
                        key={row.label}
                        data-testid={`forecast-row-${row.label}`}
                        onClick={() => setExpanded(isExp ? null : row.label)}
                        className="cursor-pointer transition-colors"
                        style={{ background: rowBg }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLTableRowElement).style.background =
                            'hsl(45 10% 17%)'
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLTableRowElement).style.background = rowBg
                        }}
                      >
                        <td
                          className="px-4 py-2.5 font-medium"
                          style={{ color: 'var(--text-primary)', borderBottom: '1px solid hsl(45 10% 16%)' }}
                        >
                          {row.label}
                        </td>
                        <td
                          className="px-4 py-2.5 tabular-nums"
                          style={{ ...colStyle(row.opening), borderBottom: '1px solid hsl(45 10% 16%)' }}
                        >
                          {fmt(row.opening)}
                        </td>
                        <td
                          className="px-4 py-2.5 tabular-nums"
                          style={{ color: '#4ade80', borderBottom: '1px solid hsl(45 10% 16%)' }}
                        >
                          {fmt(row.inflows)}
                        </td>
                        <td
                          className="px-4 py-2.5 tabular-nums"
                          style={{ color: '#ef4444', borderBottom: '1px solid hsl(45 10% 16%)' }}
                        >
                          {fmt(row.outflows)}
                        </td>
                        <td
                          className="px-4 py-2.5 tabular-nums font-medium"
                          style={{ ...colStyle(row.net), borderBottom: '1px solid hsl(45 10% 16%)' }}
                        >
                          {row.net >= 0 ? '+' : ''}{fmt(row.net)}
                        </td>
                        <td
                          className="px-4 py-2.5 tabular-nums font-semibold"
                          style={{ ...colStyle(row.closing, true), borderBottom: '1px solid hsl(45 10% 16%)' }}
                        >
                          {fmt(row.closing)}
                          {row.closing < 0 && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                              NEG
                            </span>
                          )}
                        </td>
                      </tr>
                      {isExp && (
                        <tr key={`${row.label}-detail`} style={{ background: 'hsl(45 10% 12%)' }}>
                          <td colSpan={6} className="px-6 py-3" style={{ borderBottom: '1px solid hsl(45 10% 18%)' }}>
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <div className="text-[11px] font-semibold mb-1.5" style={{ color: '#4ade80' }}>
                                  Inflows
                                </div>
                                {Object.entries(row.inDetail).map(([k, v]) => (
                                  <div key={k} className="flex justify-between py-0.5">
                                    <span style={{ color: 'var(--text-muted)' }}>{LABEL_MAP[k] || k.replace(/_/g, ' ')}</span>
                                    <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmt(v)}</span>
                                  </div>
                                ))}
                              </div>
                              <div>
                                <div className="text-[11px] font-semibold mb-1.5" style={{ color: '#ef4444' }}>
                                  Outflows
                                </div>
                                {Object.entries(row.outDetail).map(([k, v]) => (
                                  <div key={k} className="flex justify-between py-0.5">
                                    <span style={{ color: 'var(--text-muted)' }}>{LABEL_MAP[k] || k.replace(/_/g, ' ')}</span>
                                    <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmt(v)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────
// Section 4 — CFO Assumptions
// ─────────────────────────────────────────────

interface CfoAssumption {
  id: string
  entity: string
  category: string
  label: string
  amount_weekly: number | null
  amount_monthly: number | null
  source: string | null
  learned_from_weeks: number | null
  last_actual: number | null
  variance_pct: number | null
  notes: string | null
  updated_at: string | null
}

function useCfoAssumptions(entity: 'mully' | 'mfs') {
  return useQuery<CfoAssumption[]>({
    queryKey: ['cfo_assumptions', entity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cfo_assumptions')
        .select('*')
        .eq('entity', entity)
        .order('category')
      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
  })
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null
  if (source === 'plaid_learned') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
        style={{ background: 'rgba(99,179,237,0.15)', color: '#63b3ed' }}
      >
        <Zap size={9} />
        auto
      </span>
    )
  }
  if (source === 'spreadsheet_seed') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
        style={{ background: 'hsl(45 10% 20%)', color: 'var(--text-muted)' }}
      >
        seed
      </span>
    )
  }
  if (source === 'manual') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
        style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--gold)' }}
      >
        manual
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ background: 'hsl(45 10% 18%)', color: 'var(--text-muted)' }}
    >
      {source}
    </span>
  )
}

interface EditableAmountCellProps {
  rowId: string
  field: 'amount_weekly' | 'amount_monthly'
  value: number | null
  onSave: (id: string, field: string, value: number | null) => void
}

function EditableAmountCell({ rowId, field, value, onSave }: EditableAmountCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value !== null ? String(value) : '')
  const [saving, setSaving] = useState(false)

  const commit = useCallback(async () => {
    const num = draft.trim() === '' ? null : parseFloat(draft.replace(/[$,]/g, ''))
    if (!isNaN(num as number) || num === null) {
      setSaving(true)
      await onSave(rowId, field, num)
      setSaving(false)
    }
    setEditing(false)
  }, [draft, rowId, field, onSave])

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value !== null ? String(value) : '')
            setEditing(false)
          }
        }}
        className="w-24 px-2 py-0.5 rounded text-xs tabular-nums outline-none"
        style={{
          background: 'hsl(45 10% 18%)',
          border: '1px solid var(--gold)',
          color: 'var(--text-primary)',
        }}
      />
    )
  }

  return (
    <span
      className="cursor-pointer hover:underline tabular-nums"
      style={{ color: value !== null ? 'var(--text-primary)' : 'var(--text-muted)', opacity: saving ? 0.5 : 1 }}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value !== null ? fmt(value) : '—'}
    </span>
  )
}

interface EditableNotesCellProps {
  rowId: string
  value: string | null
  onSave: (id: string, field: string, value: string | null) => void
}

function EditableNotesCell({ rowId, value, onSave }: EditableNotesCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')

  const commit = useCallback(async () => {
    await onSave(rowId, 'notes', draft.trim() || null)
    setEditing(false)
  }, [draft, rowId, onSave])

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value || '')
            setEditing(false)
          }
        }}
        className="w-full px-2 py-0.5 rounded text-xs outline-none"
        style={{
          background: 'hsl(45 10% 18%)',
          border: '1px solid var(--gold)',
          color: 'var(--text-primary)',
        }}
      />
    )
  }

  return (
    <span
      className="cursor-pointer hover:underline text-xs truncate max-w-[140px] inline-block"
      style={{ color: value ? 'var(--text-muted)' : 'hsl(45 10% 28%)' }}
      onClick={() => setEditing(true)}
      title={value || 'Add a note'}
    >
      {value || '—'}
    </span>
  )
}

function AssumptionsSection({ entity }: { entity: 'mully' | 'mfs' }) {
  const { data: assumptions, isLoading } = useCfoAssumptions(entity)
  const qc = useQueryClient()

  const saveField = useCallback(
    async (id: string, field: string, value: any) => {
      await supabase
        .from('cfo_assumptions')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', id)
      qc.invalidateQueries({ queryKey: ['cfo_assumptions', entity] })
    },
    [entity, qc]
  )

  // Group by category
  const grouped = useMemo(() => {
    if (!assumptions) return {}
    return assumptions.reduce<Record<string, CfoAssumption[]>>((acc, row) => {
      const cat = row.category || 'Other'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(row)
      return acc
    }, {})
  }, [assumptions])

  if (isLoading) return <div className="skeleton rounded-xl h-48" />

  return (
    <section>
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
      >
        <div className="px-5 pt-4 pb-3 flex items-center gap-2">
          <TrendingDown size={15} style={{ color: 'var(--gold)' }} />
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            CFO Assumptions
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            · click any cell to edit
          </span>
        </div>

        {!assumptions || assumptions.length === 0 ? (
          <div className="px-5 pb-5 text-sm" style={{ color: 'var(--text-muted)' }}>
            No assumptions found for {entity === 'mully' ? 'Mully' : 'MFS'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'hsl(45 10% 13%)' }}>
                  {['Label', 'Weekly', 'Monthly', 'Source', 'Last Actual', 'Notes'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left font-medium"
                      style={{ color: 'var(--text-muted)', borderBottom: '1px solid hsl(45 10% 18%)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([category, rows]) => (
                  <>
                    <tr key={`cat-${category}`}>
                      <td
                        colSpan={6}
                        className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                        style={{
                          color: 'var(--gold)',
                          background: 'hsl(45 10% 12%)',
                          borderBottom: '1px solid hsl(45 10% 16%)',
                        }}
                      >
                        {category}
                      </td>
                    </tr>
                    {rows.map((row, i) => {
                      const rowBg = i % 2 === 0 ? 'var(--surface-card)' : 'hsl(45 10% 14%)'
                      const variance = row.variance_pct
                      return (
                        <tr
                          key={row.id}
                          data-testid={`assumption-${row.id}`}
                          style={{ background: rowBg }}
                        >
                          <td
                            className="px-4 py-2.5 font-medium"
                            style={{ color: 'var(--text-primary)', borderBottom: '1px solid hsl(45 10% 16%)' }}
                          >
                            {row.label}
                          </td>
                          <td
                            className="px-4 py-2.5"
                            style={{ borderBottom: '1px solid hsl(45 10% 16%)' }}
                          >
                            <EditableAmountCell
                              rowId={row.id}
                              field="amount_weekly"
                              value={row.amount_weekly}
                              onSave={saveField}
                            />
                          </td>
                          <td
                            className="px-4 py-2.5"
                            style={{ borderBottom: '1px solid hsl(45 10% 16%)' }}
                          >
                            <EditableAmountCell
                              rowId={row.id}
                              field="amount_monthly"
                              value={row.amount_monthly}
                              onSave={saveField}
                            />
                          </td>
                          <td
                            className="px-4 py-2.5"
                            style={{ borderBottom: '1px solid hsl(45 10% 16%)' }}
                          >
                            <SourceBadge source={row.source} />
                          </td>
                          <td
                            className="px-4 py-2.5"
                            style={{ borderBottom: '1px solid hsl(45 10% 16%)' }}
                          >
                            {row.last_actual !== null ? (
                              <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                                {fmt(row.last_actual)}
                                {variance !== null && (
                                  <span
                                    className="ml-1.5 text-[10px]"
                                    style={{ color: Math.abs(variance) > 0.15 ? '#ef4444' : '#4ade80' }}
                                  >
                                    ({variance > 0 ? '+' : ''}{(variance * 100).toFixed(0)}%)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td
                            className="px-4 py-2.5"
                            style={{ borderBottom: '1px solid hsl(45 10% 16%)' }}
                          >
                            <EditableNotesCell
                              rowId={row.id}
                              value={row.notes}
                              onSave={saveField}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────
// Section: Forecast vs Actual
// ─────────────────────────────────────────────

function ForecastVsActualSection({ entity }: { entity: 'mully' | 'mfs' }) {
  const { data: actuals, isLoading: loadingActuals } = useQuery({
    queryKey: ['weekly_actuals', entity],
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_actuals')
        .select('*')
        .eq('entity', entity)
        .order('week_start', { ascending: false })
      return data || []
    },
    staleTime: 30_000,
  })

  const { data: snapshots } = useQuery({
    queryKey: ['forecast_snapshots', entity],
    queryFn: async () => {
      const { data } = await supabase
        .from('forecast_snapshots')
        .select('*')
        .eq('entity', entity)
        .order('forecast_week', { ascending: false })
        .limit(52)
      return data || []
    },
    staleTime: 30_000,
  })

  const CATEGORY_LABELS: Record<string, string> = {
    other_income: 'Income', client_revenue: 'Client Revenue',
    debt_service: 'Debt', payroll: 'Payroll', shopify_fees: 'Shopify Fees',
    rent: 'Rent', talentpop: 'Talentpop', software: 'Software',
    usps_shipping: 'USPS', joe_draws: 'Joe Draws', operating: 'Operating',
    transfer_out: 'Transfers', inventory: 'Inventory', other: 'Other',
  }

  const weeklyData = useMemo(() => {
    if (!actuals) return []
    const grouped: Record<string, Record<string, number>> = {}
    for (const row of actuals) {
      const wk = row.week_start
      if (!grouped[wk]) grouped[wk] = {}
      grouped[wk][row.category] = (grouped[wk][row.category] || 0) + Number(row.amount)
    }
    // Build snapshot lookup
    const snapMap: Record<string, any> = {}
    for (const s of (snapshots || [])) {
      snapMap[s.forecast_week] = s
    }

    return Object.entries(grouped)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 4)
      .map(([week, cats]) => {
        const inflows = (cats['other_income'] || 0) + (cats['client_revenue'] || 0)
        const outflows = Object.entries(cats)
          .filter(([k]) => !['other_income', 'client_revenue'].includes(k))
          .reduce((sum, [, v]) => sum + v, 0)
        const d = new Date(week + 'T00:00:00')
        const snap = snapMap[week]
        return {
          week,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          inflows: Math.round(inflows),
          outflows: Math.round(outflows),
          net: Math.round(inflows - outflows),
          categories: cats,
          forecast: snap ? {
            inflows: Number(snap.predicted_inflows),
            outflows: Number(snap.predicted_outflows),
            net: Number(snap.predicted_net),
          } : null,
        }
      })
  }, [actuals, snapshots])

  if (loadingActuals) return <div className="skeleton rounded-xl h-32" />
  if (weeklyData.length === 0) return null

  return (
    <section>
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown size={15} style={{ color: 'var(--gold)' }} />
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Forecast vs Actual
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            · Plaid actuals vs forecast predictions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'hsl(45 10% 13%)' }}>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid hsl(45 10% 18%)' }}>Week</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: '#4ade80', borderBottom: '1px solid hsl(45 10% 18%)' }}>Actual In</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: '#ef4444', borderBottom: '1px solid hsl(45 10% 18%)' }}>Actual Out</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--text-primary)', borderBottom: '1px solid hsl(45 10% 18%)' }}>Actual Net</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid hsl(45 10% 18%)' }}>Forecast Net</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid hsl(45 10% 18%)' }}>Variance</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid hsl(45 10% 18%)' }}>Top Outflows</th>
              </tr>
            </thead>
            <tbody>
              {weeklyData.map((wk, i) => {
                const topCats = Object.entries(wk.categories)
                  .filter(([k]) => !['other_income', 'client_revenue'].includes(k))
                  .sort((a, b) => Number(b[1]) - Number(a[1]))
                  .slice(0, 3)
                const variance = wk.forecast ? wk.net - wk.forecast.net : null
                return (
                  <tr key={wk.week} style={{ background: i % 2 === 0 ? 'var(--surface-card)' : 'hsl(45 10% 14%)' }}>
                    <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--text-primary)', borderBottom: '1px solid hsl(45 10% 16%)' }}>
                      {wk.label}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: '#4ade80', borderBottom: '1px solid hsl(45 10% 16%)' }}>
                      {wk.inflows > 0 ? fmt(wk.inflows) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: '#ef4444', borderBottom: '1px solid hsl(45 10% 16%)' }}>
                      {fmt(wk.outflows)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: wk.net >= 0 ? '#4ade80' : '#ef4444', borderBottom: '1px solid hsl(45 10% 16%)' }}>
                      {wk.net >= 0 ? '+' : ''}{fmt(wk.net)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-muted)', borderBottom: '1px solid hsl(45 10% 16%)' }}>
                      {wk.forecast ? `${wk.forecast.net >= 0 ? '+' : ''}${fmt(wk.forecast.net)}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium" style={{ color: variance === null ? 'var(--text-muted)' : variance >= 0 ? '#4ade80' : '#ef4444', borderBottom: '1px solid hsl(45 10% 16%)' }}>
                      {variance !== null ? (
                        <span>{variance >= 0 ? '+' : ''}{fmt(variance)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5" style={{ borderBottom: '1px solid hsl(45 10% 16%)' }}>
                      <div className="flex flex-wrap gap-1">
                        {topCats.map(([cat, amt]) => (
                          <span
                            key={cat}
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: 'hsl(45 10% 18%)', color: 'var(--text-muted)' }}
                          >
                            {CATEGORY_LABELS[cat] || cat}: {fmt(Number(amt))}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

function ExportButton({ entity }: { entity: 'mully' | 'mfs' }) {
  const [exporting, setExporting] = useState(false)
  const { data: forecastData } = useAppKV<ForecastData>(entity === 'mully' ? 'forecast_mully' : 'forecast_mfs')
  const { data: cashData } = useAppKV('real_cash')

  const handleExport = async () => {
    if (!forecastData?.forecast) return
    setExporting(true)

    const { default: jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const entityLabel = entity === 'mully' ? 'Mully' : 'MFS'
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 40

    // --- Page 1: Cover + Summary ---
    // Dark header bar
    doc.setFillColor(30, 28, 25)
    doc.rect(0, 0, pageW, 90, 'F')
    doc.setFillColor(201, 168, 76)
    doc.rect(0, 88, pageW, 3, 'F')

    doc.setTextColor(201, 168, 76)
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.text(`${entityLabel} Cash Flow Forecast`, margin, 55)
    doc.setTextColor(180, 175, 165)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`${today}  ·  Confidential  ·  Mully HQ`, margin, 75)

    // Summary metrics
    const opening = Math.round(forecastData.current_plaid_balance || 0)
    const minCash = Math.round(forecastData.min_closing_cash || 0)
    const negWeeks = forecastData.negative_weeks || 0
    const forecast = forecastData.forecast
    const endingCash = Math.round(forecast[forecast.length - 1]?.closing_cash || 0)
    const totalIn13 = forecast.reduce((s, w) => s + (w.total_inflows || 0), 0)
    const totalOut13 = forecast.reduce((s, w) => s + (w.total_outflows || 0), 0)

    let y = 120
    doc.setTextColor(60, 58, 55)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Executive Summary', margin, y)
    y += 25

    const metrics = [
      ['Current Cash Position', `$${opening.toLocaleString()}`],
      ['13-Week Projected Revenue', `$${Math.round(totalIn13).toLocaleString()}`],
      ['13-Week Projected Expenses', `$${Math.round(totalOut13).toLocaleString()}`],
      ['Net Cash Flow (13 wks)', `$${Math.round(totalIn13 - totalOut13).toLocaleString()}`],
      ['Ending Cash (Wk 13)', `$${endingCash.toLocaleString()}`],
      ['Minimum Cash Point', `$${minCash.toLocaleString()}`],
      ['Negative Cash Weeks', `${negWeeks} of 13`],
    ]

    doc.setFontSize(10)
    for (const [label, value] of metrics) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 98, 90)
      doc.text(label, margin, y)
      doc.setFont('helvetica', 'bold')
      const isNeg = value.includes('-')
      doc.setTextColor(isNeg ? 200 : 40, isNeg ? 60 : 40, isNeg ? 60 : 40)
      doc.text(value, margin + 220, y)
      y += 18
    }

    // Key assumptions note
    y += 15
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 58, 55)
    doc.text('Key Assumptions', margin, y)
    y += 15
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 98, 90)
    doc.setFontSize(9)
    const notes = [
      'Revenue: Subscription renewals sourced from Loop forecast (per-subscriber pricing)',
      `Debt Service: $${(forecastData.debug?.learned_debt_wk || 3489).toLocaleString()}/week based on restructured payment schedule`,
      `Payroll: $${(forecastData.debug?.learned_payroll_wk || 7089).toLocaleString()}/week`,
      'Inventory: $70/unit for Back 9 Legacy box orders, paid Net 30, estimated from Loop order forecast',
      'Cash Notes/Overrides applied where indicated',
    ]
    for (const note of notes) {
      doc.text(`•  ${note}`, margin + 10, y)
      y += 14
    }

    // --- Cash flow mini chart (bar chart using rectangles) ---
    y += 20
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 58, 55)
    doc.text('13-Week Cash Runway', margin, y)
    y += 15

    const chartX = margin
    const chartW = pageW - margin * 2
    const chartH = 100
    const barW = (chartW - 20) / 13
    const maxVal = Math.max(...forecast.map(w => Math.abs(w.closing_cash || 0)), 1)

    // Zero line
    const zeroY = y + chartH / 2
    doc.setDrawColor(180, 175, 165)
    doc.setLineWidth(0.5)
    doc.line(chartX, zeroY, chartX + chartW, zeroY)

    for (let fi = 0; fi < forecast.length; fi++) {
      const w = forecast[fi]
      const closing = w.closing_cash || 0
      const barH = (Math.abs(closing) / maxVal) * (chartH / 2 - 5)
      const bx = chartX + 10 + fi * barW

      if (closing >= 0) {
        doc.setFillColor(74, 222, 128)
        doc.rect(bx, zeroY - barH, barW - 4, barH, 'F')
      } else {
        doc.setFillColor(239, 68, 68)
        doc.rect(bx, zeroY, barW - 4, barH, 'F')
      }

      // Week label
      doc.setFontSize(7)
      doc.setTextColor(140, 135, 120)
      doc.text(w.week_label, bx + (barW - 4) / 2, y + chartH + 10, { align: 'center' })
    }
    y += chartH + 25

    // --- Page 2: Cash Flow Statement ---
    doc.addPage()

    doc.setFillColor(30, 28, 25)
    doc.rect(0, 0, pageW, 50, 'F')
    doc.setFillColor(201, 168, 76)
    doc.rect(0, 48, pageW, 2, 'F')
    doc.setTextColor(201, 168, 76)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('13-Week Cash Flow Statement', margin, 33)

    // Build statement rows: category label + 13 weekly values
    const $f = (v: number) => v === 0 ? '-' : `$${Math.round(v).toLocaleString()}`
    const weekHeaders = ['', ...forecast.map(w => w.week_label)]

    type StatementRow = { label: string; values: string[]; style: 'header' | 'line' | 'subtotal' | 'total' | 'spacer' }
    const rows: StatementRow[] = []

    // OPENING CASH
    rows.push({ label: 'Opening Cash', values: forecast.map(w => $f(w.opening_cash)), style: 'line' })
    rows.push({ label: '', values: forecast.map(() => ''), style: 'spacer' })

    // REVENUE
    rows.push({ label: 'REVENUE', values: forecast.map(() => ''), style: 'header' })
    rows.push({ label: '  Subscription Renewals', values: forecast.map(w => $f((w.inflows as any).sub_renewals || 0)), style: 'line' })
    rows.push({ label: '  Online Store', values: forecast.map(w => $f((w.inflows as any).online_store || 0)), style: 'line' })
    rows.push({ label: '  Outing Revenue', values: forecast.map(w => $f((w.inflows as any).outing_revenue || 0)), style: 'line' })
    rows.push({ label: 'Total Revenue', values: forecast.map(w => $f(w.total_inflows)), style: 'subtotal' })
    rows.push({ label: '', values: forecast.map(() => ''), style: 'spacer' })

    // COST OF GOODS SOLD
    rows.push({ label: 'COST OF GOODS SOLD', values: forecast.map(() => ''), style: 'header' })
    rows.push({ label: '  Inventory Purchases', values: forecast.map(w => $f((w.outflows as any).inventory || 0)), style: 'line' })
    rows.push({ label: '  Fulfillment', values: forecast.map(w => $f((w.outflows as any).fulfillment || 0)), style: 'line' })
    rows.push({ label: '  Payment Processing', values: forecast.map(w => $f((w.outflows as any).processing_fee || 0)), style: 'line' })
    const cogsPerWk = forecast.map(w => ((w.outflows as any).inventory || 0) + ((w.outflows as any).fulfillment || 0) + ((w.outflows as any).processing_fee || 0))
    rows.push({ label: 'Total COGS', values: cogsPerWk.map(v => $f(v)), style: 'subtotal' })
    const grossPerWk = forecast.map((w, i) => w.total_inflows - cogsPerWk[i])
    rows.push({ label: 'Gross Profit', values: grossPerWk.map(v => $f(v)), style: 'total' })
    rows.push({ label: '', values: forecast.map(() => ''), style: 'spacer' })

    // OPERATING EXPENSES
    rows.push({ label: 'OPERATING EXPENSES', values: forecast.map(() => ''), style: 'header' })
    rows.push({ label: '  Payroll', values: forecast.map(w => $f((w.outflows as any).payroll || 0)), style: 'line' })
    rows.push({ label: '  Content Agency', values: forecast.map(w => $f((w.outflows as any).content_agency || 0)), style: 'line' })
    rows.push({ label: '  Talentpop CS', values: forecast.map(w => $f((w.outflows as any).talentpop || 0)), style: 'line' })
    rows.push({ label: '  Software/Tools', values: forecast.map(w => $f((w.outflows as any).software || 0)), style: 'line' })
    rows.push({ label: '  Other Operating', values: forecast.map(w => $f((w.outflows as any).operating || 0)), style: 'line' })
    rows.push({ label: '  Vendor Invoices (AP)', values: forecast.map(w => $f((w.outflows as any).invoices || 0)), style: 'line' })
    const opexPerWk = forecast.map(w =>
      ((w.outflows as any).payroll || 0) + ((w.outflows as any).content_agency || 0) + ((w.outflows as any).talentpop || 0) +
      ((w.outflows as any).software || 0) + ((w.outflows as any).operating || 0) + ((w.outflows as any).invoices || 0)
    )
    rows.push({ label: 'Total Operating', values: opexPerWk.map(v => $f(v)), style: 'subtotal' })
    rows.push({ label: '', values: forecast.map(() => ''), style: 'spacer' })

    // DEBT SERVICE
    rows.push({ label: 'DEBT SERVICE', values: forecast.map(() => ''), style: 'header' })
    rows.push({ label: '  Loan Payments', values: forecast.map(w => $f((w.outflows as any).debt_service || 0)), style: 'line' })
    rows.push({ label: '', values: forecast.map(() => ''), style: 'spacer' })

    // NET CASH FLOW
    rows.push({ label: 'Net Cash Flow', values: forecast.map(w => `${w.net_cash_flow >= 0 ? '' : ''}${$f(w.net_cash_flow)}`), style: 'total' })
    rows.push({ label: 'Closing Cash', values: forecast.map(w => $f(w.closing_cash)), style: 'total' })

    // Render as autoTable
    const stmtHead = [weekHeaders]
    const stmtBody = rows.map(r => [r.label, ...r.values])

    autoTable(doc, {
      startY: 65,
      head: stmtHead,
      body: stmtBody,
      theme: 'plain',
      headStyles: { fillColor: [40, 38, 35], textColor: [201, 168, 76], fontSize: 6.5, fontStyle: 'bold', halign: 'right', cellPadding: 3 },
      bodyStyles: { fontSize: 7, textColor: [80, 78, 70], halign: 'right', cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 } },
      columnStyles: { 0: { halign: 'left', cellWidth: 115 } },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          const row = rows[data.row.index]
          if (!row) return
          // Style based on row type
          if (row.style === 'header') {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.textColor = [40, 38, 35]
            data.cell.styles.fontSize = 7
          } else if (row.style === 'subtotal') {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.textColor = [60, 58, 55]
            if (data.column.index > 0) data.cell.styles.fillColor = [242, 241, 238]
          } else if (row.style === 'total') {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.textColor = [30, 28, 25]
            data.cell.styles.fontSize = 7.5
            if (data.column.index > 0) data.cell.styles.fillColor = [235, 233, 228]
          } else if (row.style === 'spacer') {
            data.cell.styles.minCellHeight = 4
            data.cell.styles.fontSize = 3
          }
          // Red for negatives
          const val = data.cell.raw as string
          if (val && val.includes('-') && data.column.index > 0) {
            data.cell.styles.textColor = [200, 50, 50]
          }
        }
      },
      didDrawCell: (data: any) => {
        if (data.section === 'body') {
          const row = rows[data.row.index]
          if (row && (row.style === 'subtotal' || row.style === 'total')) {
            // Top border line for subtotals
            doc.setDrawColor(180, 175, 165)
            doc.setLineWidth(0.5)
            doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y)
          }
        }
      },
      margin: { left: margin, right: margin },
    })

    // Footer on each page
    const pageCount = doc.getNumberOfPages()
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setFontSize(7)
      doc.setTextColor(160, 155, 145)
      doc.text(`${entityLabel} Cash Flow Forecast  ·  ${today}  ·  Mully HQ  ·  Confidential`, margin, pageH - 20)
      doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 20, { align: 'right' })
    }

    doc.save(`${entityLabel}-Cash-Flow-Forecast-${new Date().toISOString().split('T')[0]}.pdf`)
    setExporting(false)
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting || !forecastData}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.2)' }}
    >
      <Download size={12} />
      {exporting ? 'Generating...' : 'Export PDF'}
    </button>
  )
}

export default function MoneyPage() {
  const [entity, setEntity] = useState<'mully' | 'mfs'>('mully')

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Money
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Cash position, forecasts, and CFO assumptions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton entity={entity} />
          <EntityToggle entity={entity} onChange={setEntity} />
        </div>
      </div>

      {/* S1 — Cash Position */}
      <CashPositionSection entity={entity} />

      {/* S2 — Expense Breakdown */}
      <ExpenseBreakdownSection entity={entity} />

      {/* S3 — Cash Notes / Overrides */}
      <CashNotesSection entity={entity} />

      {/* S3 — 13-Week Forecast Chart */}
      <ForecastChartSection entity={entity} />

      {/* S4 — Forecast Breakdown Table */}
      <ForecastBreakdownSection entity={entity} />

      {/* S5 — Forecast vs Actual */}
      <ForecastVsActualSection entity={entity} />

      {/* S6 — CFO Assumptions */}
      <AssumptionsSection entity={entity} />
    </div>
  )
}
