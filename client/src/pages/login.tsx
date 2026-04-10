import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-darkest)' }}>
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-3">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-label="Mully HQ Logo">
              <rect x="2" y="2" width="36" height="36" rx="8" stroke="#C9A84C" strokeWidth="2.5" fill="none" />
              <path d="M10 28V14l5 8 5-8v14" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="24" y1="14" x2="24" y2="28" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="24" y1="28" x2="31" y2="28" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="text-xl font-semibold tracking-wider" style={{ color: 'var(--gold)' }}>MULLY HQ</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Operations Dashboard</p>
        </div>

        {/* Sign in card */}
        <div
          className="rounded-xl p-8"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid hsl(45 10% 20%)',
          }}
        >
          <h2 className="text-base font-medium mb-6 text-center" style={{ color: 'var(--text-primary)' }}>
            Sign in to continue
          </h2>

          <button
            onClick={signInWithGoogle}
            data-testid="button-sign-in-google"
            className="w-full flex items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 touch-target"
            style={{
              background: 'var(--gold)',
              color: 'var(--surface-darkest)',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--gold-hover)' }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'var(--gold)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.003 10.003 0 0 0 2 12c0 1.61.39 3.14 1.07 4.49l3.77-2.93z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          Restricted to @mullybox.com accounts
        </p>
      </div>
    </div>
  )
}
