import { useFredData } from '../hooks/useFredData'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatValue(value, suffix) {
  if (value == null) return '—'
  return `${value.toFixed(1)}${suffix}`
}

function DeltaBadge({ delta }) {
  if (delta == null) return null
  const isUp = delta > 0
  const color = isUp ? 'text-red' : 'text-green' // rising inflation/unemployment = red
  return (
    <span className={`text-[10px] font-medium ${color}`}>
      {isUp ? '+' : ''}{delta.toFixed(1)}pp
    </span>
  )
}

export default function EconPanel({ enabled }) {
  const { indicators, loading, error } = useFredData(enabled)

  if (!enabled) return null

  // Group by category
  const grouped = {}
  for (const ind of indicators) {
    if (!grouped[ind.category]) grouped[ind.category] = []
    grouped[ind.category].push(ind)
  }

  return (
    <div className="flex flex-col gap-3">
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-full max-w-xs bg-bg-primary rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-accent rounded-full animate-pulse w-1/2" />
          </div>
          <p className="text-sm text-text-secondary text-center animate-pulse">
            Loading economic data from FRED...
          </p>
        </div>
      )}
      {error && (
        <div className="text-red text-sm py-4">
          Failed to load economic data: {error}
        </div>
      )}
      {!loading && !error && Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-2">
            {category}
          </h3>
          <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
            {items.map((ind, i) => (
              <div
                key={ind.id}
                className={`flex items-center justify-between px-3 py-2.5 ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <div className="min-w-0">
                  <div className="text-xs text-text-primary font-medium">{ind.label}</div>
                  <div className="text-[10px] text-text-secondary">{formatDate(ind.date)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <DeltaBadge delta={ind.delta} />
                  <span className="text-sm font-bold text-text-primary">
                    {formatValue(ind.value, ind.suffix)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!loading && !error && indicators.length > 0 && (
        <p className="text-[9px] text-text-secondary/50 text-center mt-1">
          Source: Federal Reserve Economic Data (FRED)
        </p>
      )}
    </div>
  )
}
