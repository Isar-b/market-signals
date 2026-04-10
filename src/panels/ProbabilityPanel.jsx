import { useState, useEffect } from 'react'
import { useDynamicMarkets } from '../hooks/useDynamicMarkets'
import MarketCard from '../components/MarketCard'

export default function ProbabilityPanel({ asset, selectedHorizon }) {
  const [expandedIndex, setExpandedIndex] = useState(null)
  const { markets, loading, error } = useDynamicMarkets(asset?.id, asset?.label)

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
          <div className="text-text-secondary text-sm animate-pulse py-8 text-center">
            Discovering relevant markets...
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
