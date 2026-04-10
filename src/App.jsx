import { useAppState } from './state/useAppState'
import AssetPanel from './panels/AssetPanel'
import PerformancePanel from './panels/PerformancePanel'
import ProbabilityPanel from './panels/ProbabilityPanel'

export default function App() {
  const {
    assets, addAsset, removeAsset,
    selectedAsset, setSelectedAsset,
    selectedHorizon, setSelectedHorizon,
  } = useAppState()

  const asset = assets.find(a => a.id === selectedAsset)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Panel 1: Asset selector - 15% */}
      <div className="w-[15%] min-w-[140px] bg-bg-panel border-r border-border p-3 flex flex-col overflow-visible">
        <AssetPanel
          assets={assets}
          selectedAsset={selectedAsset}
          onSelect={setSelectedAsset}
          onAdd={addAsset}
          onRemove={removeAsset}
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
