import { useState, useEffect, useRef } from 'react'

const LOADING_STEPS = [
  'Scanning 10,000 prediction markets...',
  'Building asset profile...',
  'Fetching trending news...',
  'Matching markets by sector & geography...',
  'Ranking by relevance...',
  'Selecting top signals...',
]

export function useDynamicMarkets(assetId, assetLabel) {
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loadingStep, setLoadingStep] = useState(0)
  const stepTimerRef = useRef(null)

  const steps = LOADING_STEPS

  // Cycle through loading steps while loading
  useEffect(() => {
    if (!loading) {
      setLoadingStep(0)
      clearInterval(stepTimerRef.current)
      return
    }

    setLoadingStep(0)
    let step = 0
    stepTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, steps.length - 1)
      setLoadingStep(step)
    }, 2000)

    return () => clearInterval(stepTimerRef.current)
  }, [loading, steps.length])

  useEffect(() => {
    if (!assetId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ asset: assetId })
    if (assetLabel) params.set('label', assetLabel)

    fetch(`/api/markets?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!cancelled) {
          setMarkets(json.markets || [])
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [assetId, assetLabel])

  const progress = loading ? Math.round(((loadingStep + 1) / steps.length) * 100) : 100

  return {
    markets,
    loading,
    error,
    loadingMessage: steps[loadingStep],
    progress,
  }
}
