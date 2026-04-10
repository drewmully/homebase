import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { supabase } from '@/lib/supabase'
import { useAppKV } from '@/lib/hooks'
import {
  Activity, Mountain, AlertTriangle, TrendingUp,
  DollarSign, Bot, Brain, Compass, LayoutGrid,
  FileText, BarChart2, Megaphone, Clock
} from 'lucide-react'

// ─────────────────────────────────────────────
// Live stat hooks
// ─────────────────────────────────────────────
function useAppStats() {
  const { data: metricsData } = useAppKV('current_metrics')
  const { data: issuesKV } = useAppKV('eos_issues')
  const { data: rocksKV } = useAppKV('rocks')
  const [pipelineCount, setPipelineCount] = useState<number | null>(null)
  const [agentsCount, setAgentsCount] = useState<number | null>(null)
  const [intelCount, setIntelCount] = useState<number | null>(null)
  const [architectCount, setArchitectCount] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('outings_pipeline').select('id', { count: 'exact', head: true })
      .then(({ count }) => setPipelineCount(count))
    supabase.from('agents').select('id', { count: 'exact', head: true }).eq('status', 'active')
      .then(({ count }) => setAgentsCount(count ?? null))
    supabase.from('knowledge_base').select('id', { count: 'exact', head: true })
      .then(({ count }) => setIntelCount(count))
    supabase.from('architect_tasks').select('id', { count: 'exact', head: true })
      .then(({ count }) => setArchitectCount(count ?? null))
  }, [])

  // Health score
  let healthTotal = 0
  const rocks = rocksKV?.rocks || []
  let traction = 0
  for (const r of rocks) {
    if (r.status === 'done') traction += 15
    else if (r.status === 'on_track') traction += 10
  }
  traction = Math.min(25, traction)
  const churn = metricsData?.churn?.monthly_churn_rate || 0
  const payFail = metricsData?.payments?.failure_rate || 0
  const subs = metricsData?.snapshots?.[metricsData.snapshots.length - 1]?.active || 0
  const rev = metricsData?.revenue?.revenue_7d || 0
  const aov = metricsData?.revenue?.aov_7d || 0
  let dataScore = 0
  if (churn < 5) dataScore += 8; else if (churn < 10) dataScore += 4
  if (payFail < 10) dataScore += 5; else if (payFail < 30) dataScore += 2
  if (subs > 1000) dataScore += 4
  if (rev > 0) dataScore += 4
  if (aov > 100) dataScore += 4
  dataScore = Math.min(25, dataScore)
  const cashBal = 29163
  let cashScore = 0
  if (cashBal > 50000) cashScore = 15
  else if (cashBal > 20000) cashScore = 10
  else if (cashBal > 10000) cashScore = 5
  cashScore += 10
  cashScore = Math.min(25, cashScore)
  let issuesScore = 25
  for (const issue of (issuesKV?.issues || [])) {
    if (issue.status === 'resolved') continue
    if (issue.priority === 'P0') issuesScore -= 4
    else if (issue.priority === 'P1') issuesScore -= 1
  }
  issuesScore = Math.max(0, issuesScore)
  healthTotal = traction + dataScore + cashScore + issuesScore

  const p0Count = (issuesKV?.issues || []).filter((i: any) => i.priority === 'P0' && i.status !== 'resolved').length
  const rocksTotal = rocks.length
  const rocksDone = rocks.filter((r: any) => r.status === 'done').length

  return {
    healthTotal,
    p0Count,
    rocksTotal,
    rocksDone,
    pipelineCount,
    agentsCount,
    intelCount,
    architectCount,
    cashBal,
  }
}

// ─────────────────────────────────────────────
// App tile component
// ─────────────────────────────────────────────
interface AppTile {
  id: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  name: string
  stat: string | null
  path: string
  comingSoon?: boolean
  primary?: boolean
}

function Tile({ tile }: { tile: AppTile }) {
  const Icon = tile.icon

  const inner = (
    <div
      data-testid={`app-tile-${tile.id}`}
      className="rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 cursor-pointer group"
      style={{
        background: 'var(--surface-card)',
        border: tile.comingSoon
          ? '1px solid hsl(45 10% 16%)'
          : '1px solid hsl(45 10% 20%)',
        opacity: tile.comingSoon ? 0.55 : 1,
      }}
      onMouseEnter={e => {
        if (!tile.comingSoon) {
          (e.currentTarget as HTMLElement).style.border = '1px solid var(--gold)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(201,168,76,0.2)'
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.border = tile.comingSoon
          ? '1px solid hsl(45 10% 16%)'
          : '1px solid hsl(45 10% 20%)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{
          background: tile.comingSoon ? 'hsl(45 10% 16%)' : 'rgba(201,168,76,0.1)',
          color: tile.comingSoon ? 'var(--text-muted)' : 'var(--gold)',
        }}
      >
        <Icon size={20} strokeWidth={1.5} />
      </div>

      {/* Name */}
      <div>
        <div className="text-sm font-medium" style={{ color: tile.comingSoon ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          {tile.name}
        </div>

        {/* Stat or Coming Soon */}
        {tile.comingSoon ? (
          <div
            className="mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: 'hsl(45 10% 18%)', color: 'hsl(45 10% 45%)' }}
          >
            <Clock size={9} />
            Coming Soon
          </div>
        ) : (
          <div className="text-xs mt-0.5 font-medium" style={{ color: 'var(--gold)' }}>
            {tile.stat !== null ? tile.stat : '—'}
          </div>
        )}
      </div>
    </div>
  )

  if (tile.comingSoon) return inner
  return <Link href={tile.path}>{inner}</Link>
}

// ─────────────────────────────────────────────
// Main AppsPage
// ─────────────────────────────────────────────
export default function AppsPage() {
  const stats = useAppStats()

  const tiles: AppTile[] = [
    {
      id: 'pulse',
      icon: Activity,
      name: 'Pulse',
      stat: `Health: ${stats.healthTotal}`,
      path: '/',
      primary: true,
    },
    {
      id: 'rocks',
      icon: Mountain,
      name: 'Rocks',
      stat: `${stats.rocksDone}/${stats.rocksTotal} done`,
      path: '/rocks',
    },
    {
      id: 'issues',
      icon: AlertTriangle,
      name: 'Issues',
      stat: stats.p0Count > 0 ? `${stats.p0Count} P0` : '0 P0',
      path: '/issues',
    },
    {
      id: 'money',
      icon: DollarSign,
      name: 'Money',
      stat: `$${(stats.cashBal / 1000).toFixed(1)}K`,
      path: '/money',
    },
    {
      id: 'pipeline',
      icon: TrendingUp,
      name: 'Pipeline',
      stat: stats.pipelineCount !== null ? `${stats.pipelineCount} deals` : '...',
      path: '/pipeline',
    },
    {
      id: 'agents',
      icon: Bot,
      name: 'Agents',
      stat: stats.agentsCount !== null ? `${stats.agentsCount} active` : '...',
      path: '/agents',
    },
    {
      id: 'scorecard',
      icon: FileText,
      name: 'Scorecard',
      stat: 'Friday',
      path: '/scorecard',
      comingSoon: true,
    },
    {
      id: 'intel',
      icon: Brain,
      name: 'Intel',
      stat: stats.intelCount !== null ? `${stats.intelCount} docs` : '...',
      path: '/intel',
    },
    {
      id: 'architect',
      icon: Compass,
      name: 'Architect',
      stat: stats.architectCount !== null ? `${stats.architectCount} tasks` : '...',
      path: '/architect',
    },
    {
      id: 'pl',
      icon: BarChart2,
      name: 'P&L',
      stat: 'Coming',
      path: '/pl',
      comingSoon: true,
    },
    {
      id: 'marketing',
      icon: Megaphone,
      name: 'Marketing',
      stat: 'Coming',
      path: '/marketing',
      comingSoon: true,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)' }}
        >
          <LayoutGrid size={18} />
        </div>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Apps</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Your operations launchpad</p>
        </div>
      </div>

      {/* Tiles grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map(tile => (
          <Tile key={tile.id} tile={tile} />
        ))}
      </div>
    </div>
  )
}
