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
        <span className={`text-xs ${changeColor}`}>
          {arrow} {Math.abs(changePp)}pp
        </span>
      )
    }
  }

  const volumeBadge = formatCompactUSD(Number(market.volume24hr))
  const polymarketUrl = market.slug ? `https://polymarket.com/event/${market.slug}` : null

  return (
    <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
      <div className="flex items-stretch">
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 hover:bg-bg-primary/30 transition-colors text-left"
        >
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <span className="text-sm text-text-primary leading-snug">{market.label}</span>
            <div className="flex items-center gap-2 flex-wrap">
              {volumeBadge && (
                <span className="text-xs text-text-secondary whitespace-nowrap" title="24h volume">
                  {volumeBadge}
                </span>
              )}
              {priceLoading ? (
                <span className="inline-block w-12 h-5 bg-bg-primary rounded animate-pulse" />
              ) : priceError ? (
                <span className="text-xs text-red">ERR</span>
              ) : (
                <>
                  <span className={`text-base font-bold ${priceColor}`}>{displayPrice}</span>
                  {changeIndicator}
                </>
              )}
            </div>
          </div>
          <svg
            className={`shrink-0 w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {polymarketUrl && (
          <a
            href={polymarketUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="View on Polymarket"
            aria-label="View on Polymarket"
            className="flex items-center px-3 text-text-secondary hover:text-text-primary hover:bg-bg-primary/30 border-l border-border transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5m0 0v5m0-5L10 14m-5-9h4M5 5v14h14v-4" />
            </svg>
          </a>
        )}
      </div>

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
