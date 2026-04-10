import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_ASSETS } from '../config/assets'

const STORAGE_KEY_ASSETS = 'market-signals-assets'
const STORAGE_KEY_SELECTED = 'market-signals-selected-asset'

function loadAssets() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ASSETS)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0 &&
          parsed.every(a => a.id && a.label && a.yahooSymbol)) {
        return parsed
      }
    }
  } catch { /* ignore corrupt data */ }
  return DEFAULT_ASSETS
}

function loadSelectedAsset(assets) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SELECTED)
    if (stored && assets.some(a => a.id === stored)) {
      return stored
    }
  } catch { /* ignore */ }
  return assets[0]?.id || 'SP500'
}

export function useAppState() {
  const [assets, setAssets] = useState(() => loadAssets())
  const [selectedAsset, setSelectedAsset] = useState(() => loadSelectedAsset(loadAssets()))
  const [selectedHorizon, setSelectedHorizon] = useState('YTD')

  // Persist assets to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ASSETS, JSON.stringify(assets))
  }, [assets])

  // Persist selected asset to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SELECTED, selectedAsset)
  }, [selectedAsset])

  const addAsset = useCallback((asset) => {
    setAssets(prev => {
      // Check for duplicate by id or yahooSymbol
      const exists = prev.some(a => a.id === asset.id || a.yahooSymbol === asset.yahooSymbol)
      if (exists) {
        // Just select the existing one
        const existing = prev.find(a => a.id === asset.id || a.yahooSymbol === asset.yahooSymbol)
        setSelectedAsset(existing.id)
        return prev
      }
      return [...prev, asset]
    })
    // Select the newly added asset
    setSelectedAsset(asset.id)
  }, [])

  const removeAsset = useCallback((id) => {
    setAssets(prev => {
      if (prev.length <= 1) return prev // don't remove the last one
      const next = prev.filter(a => a.id !== id)
      return next
    })
    // If removing the selected asset, select the first remaining
    setSelectedAsset(prev => {
      if (prev === id) {
        const remaining = assets.filter(a => a.id !== id)
        return remaining[0]?.id || assets[0]?.id
      }
      return prev
    })
  }, [assets])

  return {
    assets,
    addAsset,
    removeAsset,
    selectedAsset,
    setSelectedAsset,
    selectedHorizon,
    setSelectedHorizon,
  }
}
