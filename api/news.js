import Anthropic from '@anthropic-ai/sdk'

const CACHE_TTL = 15 * 60 * 1000 // 15 minutes
const newsCache = new Map()
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

// Search term overrides for assets where the label isn't ideal for news search
const SEARCH_OVERRIDES = {
  SP500:    '"S&P 500" | "stock market" | "Wall Street"',
  SP500_HL: '"S&P 500" | "stock market" | "Wall Street"',
  NDX:      '"Nasdaq" | "tech stocks"',
  OIL:      '"crude oil" | "Brent" | "OPEC" | "oil price"',
  OIL_HL:   '"crude oil" | "Brent" | "OPEC" | "oil price"',
  GOLD:     '"gold price" | "precious metals" | "gold bullion"',
  BTC:      '"Bitcoin" | "BTC" | "crypto"',
  ETH:      '"Ethereum" | "ETH" | "DeFi"',
}

function buildSearchQuery(asset, label) {
  if (SEARCH_OVERRIDES[asset]) return SEARCH_OVERRIDES[asset]
  return `"${label}"`
}

function sevenDaysAgo() {
  const d = new Date(Date.now() - 7 * 86400000)
  return d.toISOString().split('T')[0]
}

async function filterWithLLM(articles, assetLabel) {
  if (!anthropic || articles.length <= 5) return articles

  const numbered = articles.map((a, i) => `${i}. ${a.title}`).join('\n')
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Which of these news articles are directly relevant to ${assetLabel} as a financial asset? Return ONLY a JSON array of index numbers for the top 5 most relevant articles (e.g. [0,3,7,9,12]). If fewer than 5 are relevant, return fewer. Articles:\n${numbered}`,
    }],
  })

  try {
    const text = response.content[0]?.text || '[]'
    const match = text.match(/\[[\d,\s]*\]/)
    if (!match) return articles.slice(0, 5)
    const indices = JSON.parse(match[0])
    const filtered = indices
      .filter(i => i >= 0 && i < articles.length)
      .map(i => articles[i])
    return filtered.length > 0 ? filtered : articles.slice(0, 5)
  } catch {
    return articles.slice(0, 5)
  }
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
    sort: 'relevance_score',
    limit: '15',
  })

  const resp = await fetch(`https://api.thenewsapi.com/v1/news/all?${params}`)
  if (!resp.ok) throw new Error(`News API returned ${resp.status}`)
  const json = await resp.json()

  const allArticles = (json.data || []).map(a => ({
    title: a.title,
    url: a.url,
    source: a.source,
    snippet: a.snippet || a.description || '',
    publishedAt: a.published_at,
    imageUrl: a.image_url,
  }))

  // LLM relevance filter: pick the 5 most relevant from 15 candidates
  const articles = await filterWithLLM(allArticles, label)

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
