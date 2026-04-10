import { useState, useEffect } from 'react'
import { useAppState } from './state/useAppState'
import { ASSETS } from './config/assets'
import { resolveTokenIds } from './config/resolveTokenIds'
import AssetPanel from './panels/AssetPanel'
import PerformancePanel from './panels/PerformancePanel'
import ProbabilityPanel from './panels/ProbabilityPanel'

export default function App() {
  const { selectedAsset, setSelectedAsset, selectedHorizon, setSelectedHorizon } = useAppState()
  const [tokensReady, setTokensReady] = useState(false)

  useEffect(() => {
    resolveTokenIds()
      .then(() => setTokensReady(true))
      .catch(err => {
        console.error('Token resolution failed:', err)
        setTokensReady(true) // proceed anyway; cards will show unavailable
      })
  }, [])

  const asset = ASSETS.find(a => a.id === selectedAsset)

  if (!tokensReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="text-text-secondary animate-pulse">Resolving market data...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Panel 1: Asset selector - 15% */}
      <div className="w-[15%] min-w-[140px] bg-bg-panel border-r border-border p-3 flex flex-col">
        <AssetPanel
          selectedAsset={selectedAsset}
          onSelect={setSelectedAsset}
        />
      </div>

      {/* Panel 2: Performance chart - 50% */}
      <div className="w-[50%] bg-bg-primary p-4 flex flex-col overflow-hidden">
        <PerformancePanel
          asset={asset}
          selectedHorizon={selectedHorizon}
          onHorizonChange={setSelectedHorizon}
        />
      </div>

      {/* Panel 3: Probability cards - 35% */}
      <div className="w-[35%] bg-bg-panel border-l border-border p-4 overflow-y-auto">
        <ProbabilityPanel
          asset={asset}
          selectedHorizon={selectedHorizon}
        />
      </div>
    </div>
  )
}
