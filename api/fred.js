const CACHE_TTL = 60 * 60 * 1000 // 1 hour — FRED data updates monthly at most
let fredCache = { data: null, ts: 0 }

const SERIES = [
  { id: 'GDPNOW',   label: 'GDPNow Estimate',   units: 'lin',  suffix: '%', category: 'Growth' },
  { id: 'CPIAUCSL', label: 'CPI (Headline YoY)', units: 'pc1',  suffix: '%', category: 'Inflation' },
  { id: 'CPILFESL', label: 'CPI (Core YoY)',     units: 'pc1',  suffix: '%', category: 'Inflation' },
  { id: 'PCEPI',    label: 'PCE (Headline YoY)', units: 'pc1',  suffix: '%', category: 'Inflation' },
  { id: 'PCEPILFE', label: 'PCE (Core YoY)',     units: 'pc1',  suffix: '%', category: 'Inflation' },
  { id: 'UNRATE',   label: 'Unemployment Rate',  units: 'lin',  suffix: '%', category: 'Labor' },
]

async function fetchSeries(seriesId, units, apiKey) {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: 'json',
    sort_order: 'desc',
    limit: '2', // latest + previous for delta
    units,
  })
  const resp = await fetch(`https://api.stlouisfed.org/fred/series/observations?${params}`)
  if (!resp.ok) throw new Error(`FRED API returned ${resp.status}`)
  const json = await resp.json()
  const obs = (json.observations || []).filter(o => o.value !== '.')
  return obs
}

export async function fetchFredData() {
  if (fredCache.data && Date.now() - fredCache.ts < CACHE_TTL) return fredCache.data

  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return []

  const results = await Promise.all(
    SERIES.map(async (s) => {
      try {
        const obs = await fetchSeries(s.id, s.units, apiKey)
        const latest = obs[0]
        const previous = obs[1]
        const value = latest ? parseFloat(latest.value) : null
        const prevValue = previous ? parseFloat(previous.value) : null
        const delta = (value != null && prevValue != null) ? value - prevValue : null
        return {
          id: s.id,
          label: s.label,
          category: s.category,
          value,
          suffix: s.suffix,
          date: latest?.date || null,
          delta,
        }
      } catch (err) {
        console.error(`FRED ${s.id} failed:`, err.message)
        return { id: s.id, label: s.label, category: s.category, value: null, suffix: s.suffix, date: null, delta: null }
      }
    })
  )

  fredCache = { data: results, ts: Date.now() }
  return results
}

export default async function handler(req, res) {
  try {
    const data = await fetchFredData()
    res.json({ indicators: data })
  } catch (err) {
    console.error('FRED error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
