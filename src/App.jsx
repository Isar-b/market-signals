import { useState } from 'react'
import { useAppState } from './state/useAppState'
import { useAuth } from './hooks/useAuth'
import AssetPanel from './panels/AssetPanel'
import PerformancePanel from './panels/PerformancePanel'
import ProbabilityPanel from './panels/ProbabilityPanel'

export default function App() {
  const auth = useAuth()
  const {
    assets, addAsset, removeAsset,
    selectedAsset, setSelectedAsset,
    selectedHorizon, setSelectedHorizon,
  } = useAppState(auth.user)
  const [activeTab, setActiveTab] = useState('chart')

  const asset = assets.find(a => a.id === selectedAsset)

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">

      {/* ── Desktop: 3-panel side-by-side. Mobile: tab-based ── */}

      {/* Panel 1: Asset selector */}
      <div className={`
        ${activeTab === 'assets' ? 'flex' : 'hidden'} md:flex
        w-full md:w-[15%] md:min-w-[140px]
        bg-bg-panel md:border-r border-border p-3 flex-col
        flex-1 md:flex-initial overflow-visible
        pb-20 md:pb-3
      `}>
        <AssetPanel
          assets={assets}
          selectedAsset={selectedAsset}
          onSelect={(id) => {
            setSelectedAsset(id)
            setActiveTab('chart') // switch to chart after selecting on mobile
          }}
          onAdd={(asset) => {
            addAsset(asset)
            setActiveTab('chart')
          }}
          onRemove={removeAsset}
          auth={auth}
        />
      </div>

      {/* Panel 2: Performance chart */}
      <div className={`
        ${activeTab === 'chart' ? 'flex' : 'hidden'} md:flex
        w-full md:w-[50%]
        bg-bg-primary p-4 flex-col
        flex-1 md:flex-initial overflow-hidden
        pb-20 md:pb-4
      `}>
        <PerformancePanel
          asset={asset}
          selectedHorizon={selectedHorizon}
          onHorizonChange={setSelectedHorizon}
        />
      </div>

      {/* Panel 3: Probability cards */}
      <div className={`
        ${activeTab === 'markets' ? 'flex' : 'hidden'} md:flex
        w-full md:w-[35%]
        bg-bg-panel md:border-l border-border p-4 flex-col
        flex-1 md:flex-initial overflow-y-auto
        pb-20 md:pb-4
      `}>
        <ProbabilityPanel
          asset={asset}
          selectedHorizon={selectedHorizon}
        />
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-panel border-t border-border
        flex items-center justify-around py-2 px-4 z-50">
        <TabButton
          active={activeTab === 'assets'}
          onClick={() => setActiveTab('assets')}
          label="Assets"
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>
            </svg>
          }
        />
        <TabButton
          active={activeTab === 'chart'}
          onClick={() => setActiveTab('chart')}
          label={asset?.label || 'Chart'}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
        />
        <TabButton
          active={activeTab === 'markets'}
          onClick={() => setActiveTab('markets')}
          label="Markets"
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          }
        />
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label, icon }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors
        ${active ? 'text-accent' : 'text-text-secondary'}`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}
