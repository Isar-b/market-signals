import { useState, useEffect, useRef } from 'react'

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

    setLoading(true)

    // Debounce 300ms
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      let cancelled = false

      fetch(`http://localhost:3001/api/search?q=${encodeURIComponent(query)}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json()
        })
        .then(json => {
          if (!cancelled) {
            setResults(json.results || [])
            setLoading(false)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResults([])
            setLoading(false)
          }
        })

      return () => { cancelled = true }
    }, 300)

    return () => clearTimeout(timerRef.current)
  }, [query])

  const clear = () => {
    setQuery('')
    setResults([])
  }

  return { query, setQuery, results, loading, clear }
}
