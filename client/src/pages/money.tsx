import { useState, useMemo } from 'react'
import { useAppKV, useInvoices } from '@/lib/hooks'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import { DollarSign, Building2, CreditCard, FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

function CashCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent?: boolean }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--surface-card)',
        border: accent ? '1px solid var(--gold)' : '1px solid hsl(45 10% 20%)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: accent ? 'rgba(201,168,76,0.15)' : 'hsl(45 10% 18%)' }}
        >
          <Icon size={18} style={{ color: accent ? 'var(--gold)' : 'var(--text-muted)' }} />
        </div>
        <div>
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
          <div className="text-lg font-semibold" style={{ color: accent ? 'var(--gold)' : 'var(--text-primary)' }}>{value}</div>
        </div>
      </div>
    </div>
  )
}

function ForecastChart({ entity }: { entity: 'mully' | 'mfs' }) {
  const forecastId = entity === 'mully' ? 'forecast_mully' : 'forecast_mfs'
  const { data: forecastData, isLoading } = useAppKV(forecastId)

  const chartData = useMemo(() => {
    if (!forecastData?.forecast) return []
    return forecastData.forecast.map((w: any) => ({
      week: w.week_label || `Wk${w.week}`,
      balance: w.closing_cash || 0,
    }))
  }, [forecastData])

  if (isLoading) return <div className="skeleton rounded-xl h-64" />
  if (chartData.length === 0) return <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No forecast data</div>

  const hasNegative = chartData.some((d: any) => d.balance < 0)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id="moneyGold" x1="0" y1="0" x2="0" y2="1">
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
        <Area type="monotone" dataKey="balance" stroke="#C9A84C" fill="url(#moneyGold)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

const INVOICE_STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  paid: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: CheckCircle2 },
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: Clock },
  overdue: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: AlertCircle },
}

export default function MoneyPage() {
  const [entity, setEntity] = useState<'mully' | 'mfs'>('mully')
  const { data: cashData, isLoading: cashLoading } = useAppKV('real_cash')
  const { data: metricsData } = useAppKV('current_metrics')
  const { data: invoices, isLoading: invoicesLoading } = useInvoices()

  const cashAccounts = useMemo(() => {
    if (!cashData) return []
    if (Array.isArray(cashData)) return cashData
    if (cashData.accounts) return cashData.accounts
    // Build from known keys
    const accounts = []
    if (cashData.huntington) accounts.push({ name: 'Huntington', balance: cashData.huntington })
    if (cashData.mercury) accounts.push({ name: 'Mercury', balance: cashData.mercury })
    if (cashData.shopify) accounts.push({ name: 'Shopify', balance: cashData.shopify })
    return accounts
  }, [cashData])

  const totalCash = useMemo(() => {
    if (!cashData) {
      // Fallback to metrics
      const m = metricsData?.mully || metricsData || {}
      return m.cash || '$0'
    }
    if (cashData.total) return cashData.total
    const sum = cashAccounts.reduce((acc: number, a: any) => {
      const v = parseFloat(String(a.balance || '0').replace(/[$,]/g, '')) || 0
      return acc + v
    }, 0)
    return `$${sum.toLocaleString()}`
  }, [cashData, cashAccounts, metricsData])

  const accountIcons = [Building2, Building2, CreditCard]

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Money</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Cash, forecasts, and invoices</p>
      </div>

      {/* Cash overview */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <CashCard label="Total Cash" value={typeof totalCash === 'string' ? totalCash : `$${totalCash.toLocaleString()}`} icon={DollarSign} accent />
          {cashLoading ? (
            [1,2,3].map(i => <div key={i} className="skeleton rounded-xl h-20" />)
          ) : (
            cashAccounts.map((account: any, i: number) => (
              <CashCard
                key={account.name || i}
                label={account.name || `Account ${i + 1}`}
                value={typeof account.balance === 'string' ? account.balance : `$${(account.balance || 0).toLocaleString()}`}
                icon={accountIcons[i] || Building2}
              />
            ))
          )}
        </div>
      </section>

      {/* Forecast */}
      <section>
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>13-Week Cash Forecast</h2>
            <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'hsl(45 10% 14%)' }}>
              {(['mully', 'mfs'] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setEntity(e)}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: entity === e ? 'var(--gold)' : 'transparent',
                    color: entity === e ? 'var(--surface-darkest)' : 'var(--text-muted)',
                  }}
                >
                  {e === 'mully' ? 'Mully' : 'MFS'}
                </button>
              ))}
            </div>
          </div>
          <ForecastChart entity={entity} />
        </div>
      </section>

      {/* Invoices */}
      <section>
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} style={{ color: 'var(--gold)' }} />
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Invoices</h2>
          </div>

          {invoicesLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="skeleton rounded-lg h-12" />)}
            </div>
          ) : invoices && invoices.length > 0 ? (
            <div className="space-y-2">
              {invoices.map((inv: any) => {
                const statusConf = INVOICE_STATUS_CONFIG[inv.status] || INVOICE_STATUS_CONFIG.pending
                const StatusIcon = statusConf.icon
                return (
                  <div
                    key={inv.id}
                    data-testid={`invoice-${inv.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                    style={{ background: 'hsl(45 6% 11%)' }}
                  >
                    <StatusIcon size={16} style={{ color: statusConf.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {inv.vendor || inv.client || inv.description || 'Invoice'}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {inv.amount ? (typeof inv.amount === 'string' ? inv.amount : `$${inv.amount.toLocaleString()}`) : '—'}
                      </div>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: statusConf.bg, color: statusConf.color }}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>No invoices found.</div>
          )}
        </div>
      </section>
    </div>
  )
}
