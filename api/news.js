const CACHE_TTL = 15 * 60 * 1000 // 15 minutes
const newsCache = new Map()

// Search term overrides for assets where the label isn't ideal for news search
const SEARCH_OVERRIDES = {
  SP500:    '"S&P 500" | "stock market" | "Wall Street"',
  SP500_HL: '"S&P 500" | "stock market" | "Wall Street"',
  NDX:      '"Nasdaq" | "tech stocks"',
  OIL:      '"crude oil" | "Brent" | "OPEC" | "oil price"',
  OIL_HL:   '"crude oil" | "Brent" | "OPEC" | "oil price"',
  GOLD:     '"gold price" | "gold" | "precious metals"',
  BTC:      '"Bitcoin" | "BTC" | "crypto"',
  ETH:      '"Ethereum" | "ETH" | "DeFi"',
}

function buildSearchQuery(asset, label) {
  if (SEARCH_OVERRIDES[asset]) return SEARCH_OVERRIDES[asset]
  // For stocks/unknown assets, use the label
  return `"${label}"`
}

function sevenDaysAgo() {
  const d = new Date(Date.now() - 7 * 86400000)
  return d.toISOString().split('T')[0]
}

export async function fetchNews(asset, label) {
  const cacheKey = `news:${asset}`
  const cached = newsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const apiKey = process.env.NEWS_API_KEY
  if (!apiKey) return []

  const search = buildSearchQuery(asset, label)
  const params = new URLSearchParams({
    api_token: apiKey,
    search,
    language: 'en',
    published_after: sevenDaysAgo(),
    sort: 'published_at',
    limit: '5',
  })

  const resp = await fetch(`https://api.thenewsapi.com/v1/news/all?${params}`)
  if (!resp.ok) throw new Error(`News API returned ${resp.status}`)
  const json = await resp.json()

  const articles = (json.data || []).map(a => ({
    title: a.title,
    url: a.url,
    source: a.source,
    snippet: a.snippet || a.description || '',
    publishedAt: a.published_at,
    imageUrl: a.image_url,
  }))

  newsCache.set(cacheKey, { data: articles, ts: Date.now() })
  return articles
}

// Format articles as LLM context for market selection
export function formatNewsContext(articles) {
  if (!articles || articles.length === 0) return ''
  return articles
    .map((a, i) => `${i + 1}. "${a.title}" (${a.source}, ${new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`)
    .join('\n')
}

export default async function handler(req, res) {
  try {
    const { asset, label } = req.query
    if (!asset) return res.status(400).json({ error: 'asset query param required' })

    const articles = await fetchNews(asset, label || asset)
    res.json({ articles })
  } catch (err) {
    console.error('News error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
