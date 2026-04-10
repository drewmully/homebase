import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

// Generic app_kv fetcher
export function useAppKV<T = any>(id: string) {
  return useQuery<T>({
    queryKey: ['app_kv', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_kv')
        .select('data')
        .eq('id', id)
        .single()
      if (error) throw error
      return data?.data as T
    },
    staleTime: 30_000,
  })
}

// Rocks with subtasks
export function useRocks() {
  return useQuery({
    queryKey: ['rocks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rocks')
        .select('*, rock_subtasks(*)')
      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
  })
}

// Issues
export function useIssues() {
  return useQuery({
    queryKey: ['eos_issues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eos_issues')
        .select('*')
        .order('priority')
      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
  })
}

// Invoices
export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
  })
}

// Knowledge base
export function useKnowledgeBase() {
  return useQuery({
    queryKey: ['knowledge_base'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
      if (error) throw error
      return data || []
    },
    staleTime: 60_000,
  })
}

// Update rock status
export function useUpdateRockStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('rocks')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rocks'] })
      qc.invalidateQueries({ queryKey: ['app_kv', 'rocks'] })
    },
  })
}

// Update rock progress
export function useUpdateRockProgress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const { error } = await supabase
        .from('rocks')
        .update({ progress, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rocks'] })
      qc.invalidateQueries({ queryKey: ['app_kv', 'rocks'] })
    },
  })
}

// Toggle subtask
export function useToggleSubtask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('rock_subtasks')
        .update({ status })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rocks'] })
    },
  })
}

// Resolve issue
export function useResolveIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('eos_issues')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eos_issues'] })
      qc.invalidateQueries({ queryKey: ['app_kv', 'eos_issues'] })
    },
  })
}

// Add issue
export function useAddIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (issue: {
      id: string
      title: string
      description?: string
      entity: string
      priority: string
      owner: string
      status: string
      created_at: string
    }) => {
      const { error } = await supabase
        .from('eos_issues')
        .insert(issue)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eos_issues'] })
    },
  })
}

// Update focus engine XP
export function useUpdateFocusEngine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ data }: { data: any }) => {
      const { error } = await supabase
        .from('app_kv')
        .update({ data })
        .eq('id', 'focus_engine')
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app_kv', 'focus_engine'] })
    },
  })
}
