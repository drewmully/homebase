import { Compass } from 'lucide-react'

export default function ArchitectPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
      <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Architect</h1>
      <div
        className="rounded-xl p-12 flex flex-col items-center justify-center text-center"
        style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(201,168,76,0.1)' }}
        >
          <Compass size={28} style={{ color: 'var(--gold)' }} />
        </div>
        <h2 className="text-base font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Coming Soon</h2>
        <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
          System architecture, org chart, and strategic planning tools are in development.
        </p>
      </div>
    </div>
  )
}
