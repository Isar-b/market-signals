import { useState } from 'react'
import { useAppState } from './state/useAppState'
import { useAuth } from './hooks/useAuth'
import AssetPanel from './panels/AssetPanel'
import PerformancePanel from './panels/PerformancePanel'
import ProbabilityPanel from './panels/ProbabilityPanel'

export default function App() {
  const auth = useAuth()
  const {
    assets, addAsset, removeAsset, moveAsset,
    selectedAsset, setSelectedAsset,
    selectedHorizon, setSelectedHorizon,
  } = useAppState(auth.user)
  const [showAssets, setShowAssets] = useState(false)

  const asset = assets.find(a => a.id === selectedAsset)

  return (
    <>
      {/* ── Desktop: 3-panel side-by-side ── */}
      <div className="hidden md:flex h-dvh overflow-hidden">
        <div className="w-[15%] min-w-[140px] bg-bg-panel border-r border-border p-3 flex flex-col overflow-visible">
          <AssetPanel
            assets={assets}
            selectedAsset={selectedAsset}
            onSelect={setSelectedAsset}
            onAdd={addAsset}
            onRemove={removeAsset}
            onMove={moveAsset}
            auth={auth}
          />
        </div>
        <div className="w-[50%] bg-bg-primary p-4 flex flex-col overflow-hidden">
          <PerformancePanel
            asset={asset}
            selectedHorizon={selectedHorizon}
            onHorizonChange={setSelectedHorizon}
          />
        </div>
        <div className="w-[35%] bg-bg-panel border-l border-border p-4 overflow-y-auto">
          <ProbabilityPanel
            asset={asset}
            selectedHorizon={selectedHorizon}
          />
        </div>
      </div>

      {/* ── Mobile: stacked chart + markets, asset drawer ── */}
      <div className="md:hidden flex flex-col h-dvh overflow-hidden bg-bg-primary">

        {/* Mobile top bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-bg-panel border-b border-border shrink-0">
          <button
            onClick={() => setShowAssets(!showAssets)}
            className="flex items-center gap-1.5 text-sm font-semibold text-text-primary"
          >
            {asset?.label || 'Select asset'}
            <svg className={`w-3.5 h-3.5 text-text-secondary transition-transform ${showAssets ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <AuthButton auth={auth} />
        </div>

        {/* Asset drawer (slides down when open) */}
        {showAssets && (
          <div className="bg-bg-panel border-b border-border p-3 max-h-[60vh] flex flex-col shrink-0">
            <AssetPanel
              assets={assets}
              selectedAsset={selectedAsset}
              onSelect={(id) => {
                setSelectedAsset(id)
                setShowAssets(false)
              }}
              onAdd={(a) => {
                addAsset(a)
                setShowAssets(false)
              }}
              onRemove={removeAsset}
              onMove={moveAsset}
              auth={null}
            />
          </div>
        )}

        {/* Scrollable content: chart + markets stacked */}
        <div className="flex-1 overflow-y-auto">
          {/* Chart section */}
          <div className="p-3 h-[45vh] min-h-[280px] flex flex-col">
            <PerformancePanel
              asset={asset}
              selectedHorizon={selectedHorizon}
              onHorizonChange={setSelectedHorizon}
            />
          </div>

          {/* Markets section */}
          <div className="p-3 bg-bg-panel border-t border-border">
            <ProbabilityPanel
              asset={asset}
              selectedHorizon={selectedHorizon}
            />
          </div>
        </div>
      </div>
    </>
  )
}

// Compact auth button for mobile top bar
function AuthButton({ auth }) {
  if (!auth) return null
  if (auth.loading) return null

  if (auth.user) {
    return (
      <div className="flex items-center gap-1.5">
        {auth.user.picture && (
          <img src={auth.user.picture} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
        )}
        <button onClick={auth.logout} className="text-[10px] text-text-secondary">
          Sign out
        </button>
      </div>
    )
  }

  return (
    <button onClick={auth.loginWithGithub} className="text-[10px] text-text-secondary hover:text-text-primary">
      Sign in
    </button>
  )
}
