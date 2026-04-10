import { useSharedPrice } from '../hooks/useSharedPriceCache'
import { useMarketHistory } from '../hooks/useMarketHistory'
import ProbabilityChart from './ProbabilityChart'

export default function MarketCard({ market, isExpanded, onToggle, horizon }) {
  const { price, loading: priceLoading, error: priceError } = useSharedPrice(market.tokenId)
  const { history, loading: histLoading } = useMarketHistory(market.tokenId, horizon, isExpanded)

  // If tokenId was never resolved, show unavailable state
  if (!market.tokenId) {
    return (
      <div className="bg-bg-card rounded-lg border border-border px-4 py-3 opacity-50">
        <span className="text-sm text-text-secondary">{market.label}</span>
        <span className="text-xs text-text-secondary ml-2">(unavailable)</span>
      </div>
    )
  }

  // If market is resolved (expired)
  if (market.resolved) {
    return (
      <div className="bg-bg-card rounded-lg border border-border px-4 py-3 opacity-60">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{market.label}</span>
          <span className="text-xs font-medium bg-bg-primary text-text-secondary px-2 py-0.5 rounded">
            Resolved
          </span>
        </div>
      </div>
    )
  }

  const displayPrice = price != null ? `${Math.round(price * 100)}%` : '--'
  const priceColor = price == null ? 'text-text-secondary'
    : price >= 0.5 ? 'text-green' : 'text-red'

  // Compute 24h change from history (if available)
  let changeIndicator = null
  if (history.length >= 2) {
    const oldest = history[0].probability
    const newest = history[history.length - 1].probability
    const changePp = Math.round((newest - oldest) * 100)
    if (changePp !== 0) {
      const arrow = changePp > 0 ? '\u25B2' : '\u25BC'
      const changeColor = changePp > 0 ? 'text-green' : 'text-red'
      changeIndicator = (
        <span className={`text-xs ${changeColor} ml-2`}>
          {arrow} {Math.abs(changePp)}pp
        </span>
      )
    }
  }

  return (
    <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
      {/* Collapsed header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-primary/30 transition-colors text-left"
      >
        <span className="text-sm text-text-primary flex-1 pr-2">{market.label}</span>
        <div className="flex items-center">
          {priceLoading ? (
            <span className="inline-block w-12 h-6 bg-bg-primary rounded animate-pulse" />
          ) : priceError ? (
            <span className="text-xs text-red">ERR</span>
          ) : (
            <>
              <span className={`text-lg font-bold ${priceColor}`}>{displayPrice}</span>
              {changeIndicator}
            </>
          )}
          <svg
            className={`w-4 h-4 ml-3 text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content - probability chart */}
      {isExpanded && (
        <div className="px-4 pb-3 border-t border-border pt-2">
          {histLoading ? (
            <div className="text-text-secondary text-xs py-4 animate-pulse">Loading chart...</div>
          ) : (
            <ProbabilityChart data={history} />
          )}
        </div>
      )}
    </div>
  )
}
