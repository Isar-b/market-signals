import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()
const USEFUL_TYPES = new Set(['EQUITY', 'ETF', 'INDEX', 'FUTURE', 'CRYPTOCURRENCY'])

export default async function handler(req, res) {
  try {
    const { q } = req.query
    if (!q || q.length < 1) {
      return res.status(400).json({ error: 'q query param required' })
    }

    const data = await yf.search(q, { quotesCount: 8, newsCount: 0 })
    const results = (data.quotes || [])
      .filter(quote => quote.symbol && USEFUL_TYPES.has(quote.quoteType))
      .map(quote => ({
        symbol: quote.symbol,
        shortname: quote.shortname || quote.longname || quote.symbol,
        quoteType: quote.quoteType,
        exchange: quote.exchange,
      }))

    res.json({ results })
  } catch (err) {
    console.error('Search error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
