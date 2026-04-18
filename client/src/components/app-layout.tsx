import { Link, useLocation } from 'wouter'
import { useAuth } from '@/lib/auth'
import { useState } from 'react'
import {
  Activity, Mountain, AlertTriangle, TrendingUp, DollarSign,
  LayoutGrid, LogOut, Menu, X, FlaskConical
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', label: 'Pulse', icon: Activity },
  { path: '/rocks', label: 'Rocks', icon: Mountain },
  { path: '/issues', label: 'Issues', icon: AlertTriangle },
  { path: '/pipeline', label: 'Pipeline', icon: TrendingUp },
  { path: '/money', label: 'Money', icon: DollarSign },
  { path: '/apps', label: 'Apps', icon: LayoutGrid },
  { path: '/cro', label: 'CRO', icon: FlaskConical },
]

const MOBILE_NAV = NAV_ITEMS.slice(0, 5)

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const { user, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-darkest)' }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex flex-col w-56 flex-shrink-0 border-r"
        style={{
          background: 'var(--surface-darkest)',
          borderColor: 'hsl(45 10% 15%)',
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-label="Mully HQ Logo">
            <rect x="2" y="2" width="36" height="36" rx="8" stroke="#C9A84C" strokeWidth="2.5" fill="none" />
            <path d="M10 28V14l5 8 5-8v14" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <line x1="24" y1="14" x2="24" y2="28" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="24" y1="28" x2="31" y2="28" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-semibold tracking-widest" style={{ color: 'var(--gold)' }}>MULLY HQ</span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = location === item.path || (item.path !== '/' && location.startsWith(item.path))
            const Icon = item.icon
            return (
              <Link key={item.path} href={item.path}>
                <div
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
                  style={{
                    color: isActive ? 'var(--gold)' : 'var(--text-muted)',
                    background: isActive ? 'rgba(201, 168, 76, 0.08)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
                  }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                  {item.label}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t" style={{ borderColor: 'hsl(45 10% 15%)' }}>
          <div className="flex items-center gap-3 px-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: 'var(--gold)', color: 'var(--surface-darkest)' }}
            >
              {user?.name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.name}</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.role}</div>
            </div>
            <button
              onClick={signOut}
              data-testid="button-sign-out"
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header
          className="md:hidden flex items-center justify-between px-4 py-3 border-b"
          style={{
            background: 'var(--surface-darkest)',
            borderColor: 'hsl(45 10% 15%)',
          }}
        >
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
              <rect x="2" y="2" width="36" height="36" rx="8" stroke="#C9A84C" strokeWidth="2.5" fill="none" />
              <path d="M10 28V14l5 8 5-8v14" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="24" y1="14" x2="24" y2="28" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="24" y1="28" x2="31" y2="28" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-semibold tracking-widest" style={{ color: 'var(--gold)' }}>MULLY HQ</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
            className="p-2 rounded-lg touch-target"
            style={{ color: 'var(--text-muted)' }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Mobile slide menu */}
        {mobileMenuOpen && (
          <div
            className="md:hidden absolute inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="absolute top-0 right-0 h-full w-64 p-4 space-y-1"
              style={{ background: 'var(--surface-card)', borderLeft: '1px solid hsl(45 10% 20%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end mb-4">
                <button onClick={() => setMobileMenuOpen(false)} className="p-2" style={{ color: 'var(--text-muted)' }}>
                  <X size={20} />
                </button>
              </div>
              {NAV_ITEMS.map(item => {
                const isActive = location === item.path || (item.path !== '/' && location.startsWith(item.path))
                const Icon = item.icon
                return (
                  <Link key={item.path} href={item.path}>
                    <div
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium"
                      style={{ color: isActive ? 'var(--gold)' : 'var(--text-muted)' }}
                    >
                      <Icon size={18} />
                      {item.label}
                    </div>
                  </Link>
                )
              })}
              <div className="pt-4 border-t mt-4" style={{ borderColor: 'hsl(45 10% 20%)' }}>
                <button
                  onClick={signOut}
                  className="flex items-center gap-3 px-3 py-3 text-sm w-full"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <LogOut size={18} />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page content */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0" style={{ background: 'var(--surface-page)' }}>
          {children}
        </div>

        {/* Mobile bottom tab bar */}
        <nav
          className="md:hidden flex items-center justify-around py-2 border-t fixed bottom-0 left-0 right-0 z-40"
          style={{
            background: 'var(--surface-darkest)',
            borderColor: 'hsl(45 10% 15%)',
          }}
        >
          {MOBILE_NAV.map(item => {
            const isActive = location === item.path || (item.path !== '/' && location.startsWith(item.path))
            const Icon = item.icon
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className="flex flex-col items-center gap-1 py-1 px-3 touch-target"
                  style={{ color: isActive ? 'var(--gold)' : 'var(--text-muted)' }}
                >
                  <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                  {isActive && (
                    <div className="w-4 h-0.5 rounded-full" style={{ background: 'var(--gold)' }} />
                  )}
                </div>
              </Link>
            )
          })}
        </nav>
      </main>
    </div>
  )
}
