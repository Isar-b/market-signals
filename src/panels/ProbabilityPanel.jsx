import { useState, useEffect } from 'react'
import { MARKETS } from '../config/markets'
import MarketCard from '../components/MarketCard'

export default function ProbabilityPanel({ asset, selectedHorizon }) {
  const [expandedIndex, setExpandedIndex] = useState(null)

  // Reset expanded card when asset changes
  useEffect(() => {
    setExpandedIndex(null)
  }, [asset?.id])

  const markets = MARKETS[asset?.id] || []

  const handleToggle = (index) => {
    setExpandedIndex(prev => prev === index ? null : index)
  }

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-4">
        Prediction Markets
      </h2>
      <div className="flex flex-col gap-2">
        {markets.length === 0 && (
          <p className="text-text-secondary text-sm">No markets configured for this asset.</p>
        )}
        {markets.map((market, i) => (
          <MarketCard
            key={`${asset?.id}-${market.id}`}
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
