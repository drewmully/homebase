import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts'
import { useFunnel, type FunnelRange } from '@/hooks/useFunnel'

const RANGES: { label: string; value: FunnelRange }[] = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
]

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function FunnelChart() {
  const [range, setRange] = useState<FunnelRange>('7d')
  const { data, isLoading, isError } = useFunnel(range)

  const homepageCount = data?.steps[0]?.count ?? 0

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Live Funnel
          </h3>
          {data?.snapshotDate && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              snapshot {data.snapshotDate} · via {data.source}
            </p>
          )}
          {data && !data.snapshotDate && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              via {data.source}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'hsl(45 10% 14%)' }}>
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className="px-3 py-1 rounded-md text-xs font-medium transition-all duration-200"
              style={{
                background: range === r.value ? 'var(--gold)' : 'transparent',
                color: range === r.value ? 'var(--surface-darkest)' : 'var(--text-muted)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton rounded h-8" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-xs py-6 text-center" style={{ color: 'var(--text-muted)' }}>
          Funnel data unavailable
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* Horizontal bars */}
          <div className="space-y-2 mb-4">
            {data.steps.map((step, i) => {
              const pct = homepageCount > 0 ? (step.count / homepageCount) * 100 : 0
              const prevCount = i > 0 ? data.steps[i - 1].count : step.count
              const dropPct = i > 0 && prevCount > 0
                ? Math.round(((prevCount - step.count) / prevCount) * 100)
                : null

              return (
                <div key={step.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{step.label}</span>
                    <div className="flex items-center gap-2">
                      {dropPct !== null && dropPct > 0 && (
                        <span className="text-[10px]" style={{ color: '#ef4444' }}>
                          ▼ {dropPct}%
                        </span>
                      )}
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fmt(step.count)}
                        {homepageCount > 0 && i > 0 && (
                          <span className="ml-1 font-normal text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            ({pct.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(45 10% 18%)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, step.count > 0 ? 1 : 0)}%`, background: step.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bar chart */}
          {homepageCount > 0 && (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={data.steps} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(45 10% 16%)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#8a8778', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                <YAxis type="category" dataKey="label" tick={{ fill: '#8a8778', fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip
                  contentStyle={{ background: '#232320', border: '1px solid hsl(45 10% 25%)', borderRadius: 8, color: '#e8e4d9', fontSize: 12 }}
                  formatter={(value: number) => [fmt(value), 'Users']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.steps.map((step, idx) => (
                    <Cell key={idx} fill={step.color} fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* KPI footer */}
          <div className="mt-4 pt-3 flex items-center gap-3" style={{ borderTop: '1px solid hsl(45 10% 18%)' }}>
            <TrendingUp size={14} style={{ color: 'var(--gold)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Homepage → Purchase</span>
            <span className="text-lg font-bold" style={{ color: 'var(--gold)' }}>
              {(data.purchaseRate * 100).toFixed(2)}%
            </span>
          </div>
        </>
      )}
    </div>
  )
}
