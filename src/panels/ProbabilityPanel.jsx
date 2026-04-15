import { useState, useEffect } from 'react'
import { useDynamicMarkets } from '../hooks/useDynamicMarkets'
import { isIndexAsset, HL_TO_MARKET_ID } from '../config/assets'
import MarketCard from '../components/MarketCard'

export default function ProbabilityPanel({ asset, selectedHorizon }) {
  const [expandedIndex, setExpandedIndex] = useState(null)
  const isIndex = isIndexAsset(asset?.id)
  const marketAssetId = HL_TO_MARKET_ID[asset?.id] || asset?.id
  const { markets, loading, error, loadingMessage, progress } = useDynamicMarkets(marketAssetId, asset?.label, isIndex)

  // Reset expanded card when asset changes
  useEffect(() => {
    setExpandedIndex(null)
  }, [asset?.id])

  const handleToggle = (index) => {
    setExpandedIndex(prev => prev === index ? null : index)
  }

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-4">
        Prediction Markets
      </h2>
      <div className="flex flex-col gap-2">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            {/* Progress bar */}
            <div className="w-full max-w-xs bg-bg-primary rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Step message with fade transition */}
            <p className="text-sm text-text-secondary text-center animate-pulse transition-all duration-500">
              {loadingMessage}
            </p>
            {/* Skeleton cards */}
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
        {!loading && markets.map((market, i) => (
          <MarketCard
            key={market.tokenId}
            market={market}
            isExpanded={expandedIndex === i}
            onToggle={() => handleToggle(i)}
            horizon={selectedHorizon}
          />
        ))}
      </div>
    </>
  )
}
