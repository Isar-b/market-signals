import { useState, useEffect, useMemo } from 'react'
import { useDynamicMarkets } from '../hooks/useDynamicMarkets'
import { useMarketHistories } from '../hooks/useMarketHistories'
import { HL_TO_MARKET_ID } from '../config/assets'
import MarketCard from '../components/MarketCard'

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'volume', label: 'Volume' },
  { id: 'volatility', label: 'Volatility' },
]

function volatilityFor(history) {
  if (!history || history.length < 2) return -1
  return Math.abs(history[history.length - 1].probability - history[0].probability)
}

export default function ProbabilityPanel({ asset, selectedHorizon }) {
  const [expandedTokenId, setExpandedTokenId] = useState(null)
  const [sortMode, setSortMode] = useState('relevance')
  const marketAssetId = HL_TO_MARKET_ID[asset?.id] || asset?.id
  const { markets, loading, loadingMore, hasMore, loadMore, error, loadingMessage, progress } = useDynamicMarkets(marketAssetId, asset?.label)
  const { histories } = useMarketHistories(markets, selectedHorizon)

  useEffect(() => {
    setExpandedTokenId(null)
    setSortMode('relevance')
  }, [asset?.id])

  const sortedMarkets = useMemo(() => {
    if (sortMode === 'volume') {
      return [...markets].sort((a, b) => (Number(b.volume24hr) || 0) - (Number(a.volume24hr) || 0))
    }
    if (sortMode === 'volatility') {
      return [...markets].sort((a, b) => volatilityFor(histories.get(b.tokenId)) - volatilityFor(histories.get(a.tokenId)))
    }
    return markets
  }, [markets, sortMode, histories])

  const handleToggle = (tokenId) => {
    setExpandedTokenId(prev => prev === tokenId ? null : tokenId)
  }

  return (
    <div className="flex flex-col gap-2">
      {!loading && !error && markets.length > 0 && (
        <div className="flex items-center gap-1 text-xs">
          <span className="text-text-secondary mr-1">Sort:</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => { setSortMode(opt.id); setExpandedTokenId(null) }}
              className={`px-2 py-1 rounded transition-colors ${
                sortMode === opt.id
                  ? 'bg-accent text-white'
                  : 'bg-bg-card text-text-secondary hover:bg-bg-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-full max-w-xs bg-bg-primary rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-text-secondary text-center animate-pulse transition-all duration-500">
            {loadingMessage}
          </p>
          <div className="w-full flex flex-col gap-2 mt-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-bg-card rounded-lg border border-border px-4 py-4 animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-bg-primary rounded w-2/3" />
                  <div className="h-5 bg-bg-primary rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && (
        <div className="text-red text-sm py-4">
          Failed to load markets: {error}
        </div>
      )}
      {!loading && !error && markets.length === 0 && (
        <p className="text-text-secondary text-sm">No relevant markets found for this asset.</p>
      )}
      {!loading && sortedMarkets.map((market) => (
        <MarketCard
          key={market.tokenId}
          market={market}
          isExpanded={expandedTokenId === market.tokenId}
          onToggle={() => handleToggle(market.tokenId)}
          horizon={selectedHorizon}
          history={histories.get(market.tokenId) || []}
        />
      ))}
      {!loading && !error && hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-1 px-4 py-2 text-sm rounded-lg border border-border bg-bg-card text-text-secondary hover:bg-bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loadingMore ? 'Loading...' : 'Load more markets'}
        </button>
      )}
    </div>
  )
}
