import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, mapEmailToUser, type AppUser } from './supabase'
import type { Session } from '@supabase/supabase-js'

interface AuthContextType {
  session: Session | null
  user: AppUser | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Dev bypass: check URL param ?dev=drew
    const params = new URLSearchParams(window.location.search)
    const devUser = params.get('dev')
    if (devUser) {
      const mockUser = mapEmailToUser(`${devUser}@mullybox.com`)
      if (mockUser) {
        setUser(mockUser)
        setSession({ user: { email: `${devUser}@mullybox.com` } } as any)
        setLoading(false)
        return
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user?.email) {
        setUser(mapEmailToUser(session.user.email))
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user?.email) {
        setUser(mapEmailToUser(session.user.email))
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
