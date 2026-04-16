import { HORIZONS } from '../config/horizons'
import { usePriceData } from '../hooks/usePriceData'
import HorizonButton from '../components/HorizonButton'
import PriceChart from '../components/PriceChart'
import ChartErrorBoundary from '../components/ChartErrorBoundary'

export default function PerformancePanel({ asset, selectedHorizon, onHorizonChange }) {
  const { data, loading, error } = usePriceData(asset, selectedHorizon)

  const currentPrice = data.length > 0 ? data[data.length - 1].close : null
  const firstPrice = data.length > 0 ? data[0].close : null
  const changePercent = firstPrice ? ((currentPrice - firstPrice) / firstPrice * 100) : null

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-base md:text-lg font-semibold text-text-primary truncate">{asset?.label}</h2>
          {currentPrice != null && !loading && (
            <>
              <span className="text-lg md:text-xl font-bold text-text-primary whitespace-nowrap">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-xs md:text-sm font-medium whitespace-nowrap ${changePercent >= 0 ? 'text-green' : 'text-red'}`}>
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => {
            fetch('/api/trade-click', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ asset: asset?.id, label: asset?.label }),
            }).catch(() => {})
            window.open('/trade.html', '_blank')
          }}
          className="px-3 py-1.5 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors whitespace-nowrap shrink-0"
        >
          Trade
        </button>
      </div>
      <div className="flex gap-0.5 md:gap-1 mb-2">
        {HORIZONS.map(h => (
          <HorizonButton
            key={h.id}
            label={h.label}
            isSelected={selectedHorizon === h.id}
            onClick={() => onHorizonChange(h.id)}
          />
        ))}
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-full text-text-secondary">
            <div className="animate-pulse">Loading chart...</div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full text-red text-sm">
            Failed to load price data: {error}
          </div>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-secondary text-sm">
            No data available for this time range
          </div>
        )}
        {!loading && !error && data.length > 0 && (
          <ChartErrorBoundary>
            <PriceChart data={data} horizon={selectedHorizon} />
          </ChartErrorBoundary>
        )}
      </div>
    </>
  )
}
