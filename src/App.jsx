import { useState } from 'react'
import { useAppState } from './state/useAppState'
import { useAuth } from './hooks/useAuth'
import AssetPanel from './panels/AssetPanel'
import PerformancePanel from './panels/PerformancePanel'
import ProbabilityPanel from './panels/ProbabilityPanel'
import NewsPanel from './panels/NewsPanel'

export default function App() {
  const auth = useAuth()
  const {
    assets, addAsset, removeAsset, moveAsset,
    selectedAsset, setSelectedAsset,
    selectedHorizon, setSelectedHorizon,
  } = useAppState(auth.user)
  const [showAssets, setShowAssets] = useState(false)
  const [desktopTab, setDesktopTab] = useState('markets')
  const [mobileMarketsOpen, setMobileMarketsOpen] = useState(true)
  const [mobileNewsOpen, setMobileNewsOpen] = useState(true)

  const asset = assets.find(a => a.id === selectedAsset)
  const isLoggedIn = !!auth.user

  return (
    <>
      {/* ── Desktop: 3-panel side-by-side ── */}
      <div className="hidden md:flex h-dvh overflow-hidden">
        <div className="w-[22%] min-w-[190px] bg-bg-panel border-r border-border p-3 flex flex-col overflow-visible">
          <AssetPanel
            assets={assets}
            selectedAsset={selectedAsset}
            onSelect={setSelectedAsset}
            onAdd={addAsset}
            onRemove={removeAsset}
            onMove={moveAsset}
            auth={auth}
            isLoggedIn={isLoggedIn}
          />
        </div>
        <div className="w-[43%] bg-bg-primary p-4 flex flex-col overflow-hidden">
          <PerformancePanel
            asset={asset}
            selectedHorizon={selectedHorizon}
            onHorizonChange={setSelectedHorizon}
          />
        </div>
        <div className="w-[35%] bg-bg-panel border-l border-border flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-border shrink-0">
            {['markets', 'news'].map(tab => (
              <button
                key={tab}
                onClick={() => setDesktopTab(tab)}
                className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors
                  ${desktopTab === tab
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                {tab === 'markets' ? 'Markets' : 'News'}
              </button>
            ))}
          </div>
          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {desktopTab === 'markets' ? (
              <ProbabilityPanel asset={asset} selectedHorizon={selectedHorizon} />
            ) : (
              <NewsPanel asset={asset} />
            )}
          </div>
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
          <MobileAuthButton auth={auth} />
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
              isLoggedIn={isLoggedIn}
            />
          </div>
        )}

        {/* Pinned chart */}
        <div className="px-3 pt-2 pb-1 h-[30vh] min-h-[200px] flex flex-col shrink-0">
          <PerformancePanel
            asset={asset}
            selectedHorizon={selectedHorizon}
            onHorizonChange={setSelectedHorizon}
          />
        </div>

        {/* Scrollable markets + news */}
        <div className="flex-1 overflow-y-auto border-t border-border">
          <div className="bg-bg-panel">
            {/* Collapsible Markets section */}
            <button
              onClick={() => setMobileMarketsOpen(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-2.5 border-b border-border"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Prediction Markets
              </span>
              <svg className={`w-3.5 h-3.5 text-text-secondary transition-transform ${mobileMarketsOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {mobileMarketsOpen && (
              <div className="p-3">
                <ProbabilityPanel asset={asset} selectedHorizon={selectedHorizon} />
              </div>
            )}

            {/* Collapsible News section */}
            <button
              onClick={() => setMobileNewsOpen(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-2.5 border-b border-border"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Trending News
              </span>
              <svg className={`w-3.5 h-3.5 text-text-secondary transition-transform ${mobileNewsOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {mobileNewsOpen && (
              <div className="p-3">
                <NewsPanel asset={asset} />
              </div>
            )}
          </div>
        </div>

        {/* Pinned footer */}
        <div className="px-3 py-2 text-center text-[10px] text-text-secondary leading-tight border-t border-border bg-bg-panel shrink-0">
          Created by Isar &middot; Powered by Yahoo Finance, Hyperliquid &amp; Polymarket
        </div>
      </div>
    </>
  )
}

// Compact auth button for mobile top bar
function MobileAuthButton({ auth }) {
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
    <div className="flex items-center gap-1.5">
      <button onClick={auth.loginWithGithub} className="text-[10px] text-text-secondary hover:text-text-primary">
        GitHub
      </button>
      <span className="text-[10px] text-text-secondary/40">|</span>
      <button onClick={auth.loginWithGoogle} className="text-[10px] text-text-secondary hover:text-text-primary">
        Google
      </button>
    </div>
  )
}
