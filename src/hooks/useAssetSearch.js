import { useState, useEffect, useRef } from 'react'

const HL_ASSETS = [
  { symbol: 'SP500_HL', shortname: 'S&P 500 24h', quoteType: 'PERP', source: 'hyperliquid', hlSymbol: 'xyz:SP500' },
  { symbol: 'OIL_HL',   shortname: 'Brent Oil 24h', quoteType: 'PERP', source: 'hyperliquid', hlSymbol: 'xyz:BRENTOIL' },
  { symbol: 'BTC',      shortname: 'Bitcoin',      quoteType: 'PERP', source: 'hyperliquid', hlSymbol: 'BTC' },
  { symbol: 'ETH',      shortname: 'Ethereum',     quoteType: 'PERP', source: 'hyperliquid', hlSymbol: 'ETH' },
]

export function useAssetSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    // Match Hyperliquid assets client-side
    const q = query.toLowerCase()
    const hlMatches = HL_ASSETS.filter(a =>
      a.symbol.toLowerCase().includes(q) ||
      a.shortname.toLowerCase().includes(q)
    )

    setLoading(true)

    // Debounce 300ms
    let cancelled = false
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json()
        })
        .then(json => {
          if (!cancelled) {
            setResults([...hlMatches, ...(json.results || [])])
            setLoading(false)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResults(hlMatches)
            setLoading(false)
          }
        })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
    }
  }, [query])

  const clear = () => {
    setQuery('')
    setResults([])
  }

  return { query, setQuery, results, loading, clear }
}
