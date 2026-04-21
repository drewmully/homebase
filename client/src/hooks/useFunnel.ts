import { useQuery } from '@tanstack/react-query'

export type FunnelRange = '24h' | '7d' | '30d'

export interface FunnelStep {
  label: string
  count: number
  color: string
}

export interface FunnelData {
  range: FunnelRange
  steps: FunnelStep[]
  purchaseRate: number
  source: 'posthog' | 'supabase'
  snapshotDate?: string
}

export function useFunnel(range: FunnelRange = '7d') {
  return useQuery<FunnelData>({
    queryKey: ['funnel', range],
    queryFn: async () => {
      const res = await fetch(`/api/funnel?range=${range}`)
      if (!res.ok) throw new Error(`Funnel API ${res.status}`)
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
