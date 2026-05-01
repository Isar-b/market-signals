import { useState, useEffect, useRef, useCallback } from 'react'

const LOADING_STEPS = [
  'Scanning 10,000 prediction markets...',
  'Building asset profile...',
  'Fetching trending news...',
  'Matching markets by sector & geography...',
  'Ranking by relevance...',
  'Selecting top signals...',
]

const LOAD_MORE_PAGE_SIZE = 5

export function useDynamicMarkets(assetId, assetLabel) {
  const [markets, setMarkets] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [loadingStep, setLoadingStep] = useState(0)
  const stepTimerRef = useRef(null)
  const cancelledRef = useRef(false)
  const marketsRef = useRef(markets)
  useEffect(() => { marketsRef.current = markets }, [markets])

  const steps = LOADING_STEPS

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

    cancelledRef.current = false
    setLoading(true)
    setError(null)
    setMarkets([])
    setTotal(0)

    const params = new URLSearchParams({ asset: assetId })
    if (assetLabel) params.set('label', assetLabel)

    fetch(`/api/markets?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!cancelledRef.current) {
          setMarkets(json.markets || [])
          setTotal(typeof json.total === 'number' ? json.total : (json.markets?.length || 0))
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelledRef.current) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelledRef.current = true }
  }, [assetId, assetLabel])

  const loadMore = useCallback(() => {
    if (!assetId) return
    const currentOffset = marketsRef.current.length
    setLoadingMore(true)
    setError(null)

    const params = new URLSearchParams({ asset: assetId, offset: String(currentOffset), limit: String(LOAD_MORE_PAGE_SIZE) })
    if (assetLabel) params.set('label', assetLabel)

    fetch(`/api/markets?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (cancelledRef.current) return
        const next = json.markets || []
        setMarkets(prev => {
          const seen = new Set(prev.map(m => m.tokenId))
          return [...prev, ...next.filter(m => !seen.has(m.tokenId))]
        })
        if (typeof json.total === 'number') setTotal(json.total)
        setLoadingMore(false)
      })
      .catch(err => {
        if (!cancelledRef.current) {
          setError(err.message)
          setLoadingMore(false)
        }
      })
  }, [assetId, assetLabel])

  const progress = loading ? Math.round(((loadingStep + 1) / steps.length) * 100) : 100
  const hasMore = markets.length < total

  return {
    markets,
    total,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    loadingMessage: steps[loadingStep],
    progress,
  }
}
