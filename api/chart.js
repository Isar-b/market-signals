import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()

function buildChartParams(horizon) {
  const now = Date.now()
  const DAY = 86400000
  switch (horizon) {
    case '1D':  return { period1: new Date(now - DAY),         interval: '5m'  }
    case '1W':  return { period1: new Date(now - 7 * DAY),     interval: '1h'  }
    case '1M':  return { period1: new Date(now - 30 * DAY),   interval: '1d'  }
    case 'YTD': return { period1: `${new Date().getFullYear()}-01-01`, interval: '1d' }
    case '1Y':  return { period1: new Date(now - 365 * DAY),   interval: '1d'  }
    case 'MAX': return { period1: new Date(now - 3650 * DAY),  interval: '1wk' }
    default:    return { period1: `${new Date().getFullYear()}-01-01`, interval: '1d' }
  }
}

export default async function handler(req, res) {
  try {
    const { symbol, horizon } = req.query
    if (!symbol || !horizon) {
      return res.status(400).json({ error: 'symbol and horizon required' })
    }

    const params = buildChartParams(horizon)
    const result = await yf.chart(symbol, {
      period1: params.period1,
      interval: params.interval,
    })

    const data = (result.quotes || [])
      .filter(q => q.close != null)
      .map(q => ({
        date: q.date instanceof Date ? q.date.toISOString() : q.date,
        close: q.close,
      }))

    res.json({ data })
  } catch (err) {
    console.error('Chart error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
