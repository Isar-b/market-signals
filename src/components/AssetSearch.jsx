import { useRef, useEffect } from 'react'
import { useAssetSearch } from '../hooks/useAssetSearch'

export default function AssetSearch({ onAdd, existingIds, disabled }) {
  const { query, setQuery, results, loading, clear } = useAssetSearch()
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        clear()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [clear])

  const handleSelect = (result) => {
    if (existingIds.has(result.symbol) || existingIds.has(result.hlSymbol)) return
    if (result.source === 'hyperliquid') {
      onAdd({ id: result.symbol, label: result.shortname, hlSymbol: result.hlSymbol, source: 'hyperliquid' })
    } else {
      onAdd({ id: result.symbol, label: result.shortname || result.symbol, yahooSymbol: result.symbol })
    }
    clear()
  }

  const showDropdown = query.length >= 2 && (results.length > 0 || loading)

  return (
    <div className="relative mb-3">
      {disabled ? (
        <div>
          <input
            type="text"
            disabled
            placeholder="Search assets..."
            className="w-full px-2.5 py-1.5 text-xs bg-bg-card border border-border rounded-lg
              text-text-secondary placeholder:text-text-secondary/50 opacity-50 cursor-not-allowed"
          />
          <p className="text-[10px] text-text-secondary/70 mt-1 px-0.5">
            Sign in to search &amp; customize assets
          </p>
        </div>
      ) : (
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search assets..."
        className="w-full px-2.5 py-1.5 text-xs bg-bg-card border border-border rounded-lg
          text-text-primary placeholder:text-text-secondary
          focus:outline-none focus:border-accent transition-colors"
      />
      )}

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1 bg-bg-card border border-border
            rounded-lg shadow-lg z-20 max-h-[240px] overflow-y-auto min-w-[220px]"
        >
          {loading && (
            <div className="px-3 py-2 text-xs text-text-secondary animate-pulse">
              Searching...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-secondary">
              No results
            </div>
          )}
          {results.map(result => {
            const isAdded = existingIds.has(result.symbol) || existingIds.has(result.hlSymbol)
            return (
              <button
                key={result.symbol}
                onClick={() => handleSelect(result)}
                disabled={isAdded}
                className={`w-full text-left px-3 py-2 text-xs transition-colors border-b border-border last:border-b-0
                  ${isAdded
                    ? 'text-text-secondary opacity-50 cursor-default'
                    : 'text-text-primary hover:bg-bg-primary/50 cursor-pointer'
                  }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{result.symbol}</span>
                  <span className="text-[10px] text-text-secondary bg-bg-primary px-1.5 py-0.5 rounded">
                    {result.quoteType}
                  </span>
                </div>
                <div className="text-text-secondary truncate mt-0.5">
                  {result.shortname}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
