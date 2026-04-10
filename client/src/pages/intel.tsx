import { useKnowledgeBase } from '@/lib/hooks'
import { Brain, FileText, ExternalLink } from 'lucide-react'

export default function IntelPage() {
  const { data: entries, isLoading, error } = useKnowledgeBase()

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Intel</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Knowledge base and reference materials</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton rounded-xl h-20" />)}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)' }}>
          Failed to load knowledge base.
        </div>
      )}

      {entries && entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((entry: any) => (
            <div
              key={entry.id}
              data-testid={`intel-entry-${entry.id}`}
              className="rounded-xl p-4"
              style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'hsl(45 10% 18%)' }}
                >
                  <FileText size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    {entry.title || entry.name || 'Untitled'}
                  </h3>
                  {(entry.description || entry.content || entry.summary) && (
                    <p className="text-xs line-clamp-3" style={{ color: 'var(--text-muted)' }}>
                      {entry.description || entry.content || entry.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {entry.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(45 10% 18%)', color: 'var(--text-muted)' }}>
                        {entry.category}
                      </span>
                    )}
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] flex items-center gap-1"
                        style={{ color: 'var(--gold)' }}
                      >
                        <ExternalLink size={10} /> View
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !isLoading && (
        <div
          className="rounded-xl p-12 flex flex-col items-center justify-center text-center"
          style={{ background: 'var(--surface-card)', border: '1px solid hsl(45 10% 20%)' }}
        >
          <Brain size={28} style={{ color: 'var(--gold)' }} className="mb-4" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No knowledge base entries yet.</p>
        </div>
      )}
    </div>
  )
}
