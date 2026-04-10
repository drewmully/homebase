import { createClient } from '@supabase/supabase-js'

// In-memory storage adapter (avoids localStorage which is blocked in sandboxed iframes)
const memoryStore: Record<string, string> = {}
const memStorage = {
  getItem: (key: string) => memoryStore[key] ?? null,
  setItem: (key: string, value: string) => { memoryStore[key] = value },
  removeItem: (key: string) => { delete memoryStore[key] },
}

export const supabase = createClient(
  'https://xnfjdbpjuaezxjgargto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZmpkYnBqdWFlenhqZ2FyZ3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzMxOTAsImV4cCI6MjA5MDA0OTE5MH0.rY1jpedgZ0qJmIRNJLYJNCuIBwBTljWJGpcZI9-YN_g',
  {
    auth: {
      storage: memStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    }
  }
)

export type UserKey = 'drew' | 'jack' | 'joe'

export interface AppUser {
  key: UserKey
  name: string
  role: string
  email: string
}

const USER_MAP: Record<string, AppUser> = {
  'drew@mullybox.com': { key: 'drew', name: 'Drew', role: 'CEO', email: 'drew@mullybox.com' },
  'jack@mullybox.com': { key: 'jack', name: 'Jack', role: 'Revenue', email: 'jack@mullybox.com' },
  'joe@mullybox.com': { key: 'joe', name: 'Joe', role: 'Ops', email: 'joe@mullybox.com' },
}

export function mapEmailToUser(email: string): AppUser | null {
  return USER_MAP[email.toLowerCase()] || null
}

export function ownerToKey(owner: string): UserKey {
  const lower = owner.toLowerCase()
  if (lower === 'drew') return 'drew'
  if (lower === 'jack') return 'jack'
  if (lower === 'joe') return 'joe'
  return 'drew' // fallback
}
