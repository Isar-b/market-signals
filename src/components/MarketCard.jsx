import { useSharedPrice } from '../hooks/useSharedPriceCache'
import ProbabilityChart from './ProbabilityChart'

function formatCompactUSD(n) {
  if (!Number.isFinite(n) || n <= 0) return null
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return `$${Math.round(n)}`
}

export default function MarketCard({ market, isExpanded, onToggle, horizon, history = [], historyLoading = false }) {
  const { price, loading: priceLoading, error: priceError } = useSharedPrice(market.tokenId)

  if (!market.tokenId) {
    return (
      <div className="bg-bg-card rounded-lg border border-border px-4 py-3 opacity-50">
        <span className="text-sm text-text-secondary">{market.label}</span>
        <span className="text-xs text-text-secondary ml-2">(unavailable)</span>
      </div>
    )
  }

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

  let changeIndicator = null
  if (history.length >= 2) {
    const oldest = history[0].probability
    const newest = history[history.length - 1].probability
    const changePp = Math.round((newest - oldest) * 100)
    if (changePp !== 0) {
      const arrow = changePp > 0 ? '▲' : '▼'
      const changeColor = changePp > 0 ? 'text-green' : 'text-red'
      changeIndicator = (
        <span className={`text-xs ${changeColor} ml-2`}>
          {arrow} {Math.abs(changePp)}pp
        </span>
      )
    }
  }

  const volumeBadge = formatCompactUSD(Number(market.volume24hr))

  return (
    <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-primary/30 transition-colors text-left"
      >
        <div className="flex-1 pr-2 flex items-baseline gap-2 min-w-0">
          <span className="text-sm text-text-primary truncate">{market.label}</span>
          {volumeBadge && (
            <span className="text-xs text-text-secondary whitespace-nowrap" title="24h volume">
              {volumeBadge}
            </span>
          )}
        </div>
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

      {isExpanded && (
        <div className="px-4 pb-3 border-t border-border pt-2">
          {historyLoading && history.length === 0 ? (
            <div className="text-text-secondary text-xs py-4 animate-pulse">Loading chart...</div>
          ) : (
            <ProbabilityChart data={history} horizon={horizon} />
          )}
        </div>
      )}
    </div>
  )
}
