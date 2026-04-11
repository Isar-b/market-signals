import { useState, useEffect, useCallback, useRef } from 'react'
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

export function useAppState(user) {
  const [assets, setAssets] = useState(DEFAULT_ASSETS)
  const [selectedAsset, setSelectedAsset] = useState(DEFAULT_ASSETS[0].id)
  const [selectedHorizon, setSelectedHorizon] = useState('YTD')
  const syncTimerRef = useRef(null)

  // Persist to localStorage only when logged in
  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY_ASSETS, JSON.stringify(assets))
  }, [assets, user])

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY_SELECTED, selectedAsset)
  }, [selectedAsset, user])

  // When user logs in, load their saved state (KV first, then localStorage fallback)
  useEffect(() => {
    if (!user) {
      // Logged out — reset to defaults
      setAssets(DEFAULT_ASSETS)
      setSelectedAsset(DEFAULT_ASSETS[0].id)
      return
    }

    // Try loading from localStorage as instant cache while KV fetches
    const cached = loadAssets()
    const cachedSelected = loadSelectedAsset(cached)
    setAssets(cached)
    setSelectedAsset(cachedSelected)

    fetch('/api/user/assets')
      .then(res => res.json())
      .then(data => {
        if (data.assets && Array.isArray(data.assets) && data.assets.length > 0) {
          // KV has data — use it
          setAssets(data.assets)
          if (data.selected) setSelectedAsset(data.selected)
        } else {
          // First login — migrate localStorage to KV
          syncToServer(assets, selectedAsset)
        }
      })
      .catch(() => { /* KV unavailable, stay with localStorage */ })
  }, [user?.sub])

  // Debounced sync to server on state changes (when logged in)
  function syncToServer(currentAssets, currentSelected) {
    if (!user) return
    clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      fetch('/api/user/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: currentAssets, selected: currentSelected }),
      }).catch(() => { /* silent fail — localStorage is the backup */ })
    }, 500)
  }

  const addAsset = useCallback((asset) => {
    setAssets(prev => {
      const exists = prev.some(a => a.id === asset.id || a.yahooSymbol === asset.yahooSymbol)
      if (exists) {
        const existing = prev.find(a => a.id === asset.id || a.yahooSymbol === asset.yahooSymbol)
        setSelectedAsset(existing.id)
        return prev
      }
      const next = [...prev, asset]
      syncToServer(next, asset.id)
      return next
    })
    setSelectedAsset(asset.id)
  }, [user])

  const removeAsset = useCallback((id) => {
    setAssets(prev => {
      if (prev.length <= 1) return prev
      const next = prev.filter(a => a.id !== id)
      const newSelected = selectedAsset === id ? next[0]?.id : selectedAsset
      if (selectedAsset === id) setSelectedAsset(newSelected)
      syncToServer(next, newSelected)
      return next
    })
  }, [user, selectedAsset])

  const moveAsset = useCallback((id, direction) => {
    setAssets(prev => {
      const idx = prev.findIndex(a => a.id === id)
      const newIdx = idx + direction
      if (idx < 0 || newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      syncToServer(next, selectedAsset)
      return next
    })
  }, [user, selectedAsset])

  // Sync selected asset changes to server
  const setSelectedAssetAndSync = useCallback((val) => {
    setSelectedAsset(prev => {
      const next = typeof val === 'function' ? val(prev) : val
      if (user) syncToServer(assets, next)
      return next
    })
  }, [user, assets])

  return {
    assets,
    addAsset,
    removeAsset,
    moveAsset,
    selectedAsset,
    setSelectedAsset: setSelectedAssetAndSync,
    selectedHorizon,
    setSelectedHorizon,
  }
}
