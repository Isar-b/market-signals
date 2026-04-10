import { HORIZONS } from '../config/horizons'
import { usePriceData } from '../hooks/usePriceData'
import HorizonButton from '../components/HorizonButton'
import PriceChart from '../components/PriceChart'
import ChartErrorBoundary from '../components/ChartErrorBoundary'

export default function PerformancePanel({ asset, selectedHorizon, onHorizonChange }) {
  const { data, loading, error } = usePriceData(asset?.yahooSymbol, selectedHorizon)

  const currentPrice = data.length > 0 ? data[data.length - 1].close : null
  const firstPrice = data.length > 0 ? data[0].close : null
  const changePercent = firstPrice ? ((currentPrice - firstPrice) / firstPrice * 100) : null

  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold text-text-primary">{asset?.label}</h2>
          {currentPrice != null && !loading && (
            <>
              <span className="text-xl font-bold text-text-primary">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-sm font-medium ${changePercent >= 0 ? 'text-green' : 'text-red'}`}>
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
              </span>
            </>
          )}
        </div>
        <div className="flex gap-1">
          {HORIZONS.map(h => (
            <HorizonButton
              key={h.id}
              label={h.label}
              isSelected={selectedHorizon === h.id}
              onClick={() => onHorizonChange(h.id)}
            />
          ))}
        </div>
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
