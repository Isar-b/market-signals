import express from 'express'
import cors from 'cors'
import YahooFinance from 'yahoo-finance2'

const app = express()
const yf = new YahooFinance()

app.use(cors({ origin: 'http://localhost:5173' }))

// GET /api/chart?symbol=AAPL&horizon=YTD
app.get('/api/chart', async (req, res) => {
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
})

function buildChartParams(horizon) {
  const now = Date.now()
  const DAY = 86400000

  switch (horizon) {
    case '1D':  return { period1: new Date(now - DAY),         interval: '5m'  }
    case '1W':  return { period1: new Date(now - 7 * DAY),     interval: '1h'  }
    case 'YTD': return { period1: `${new Date().getFullYear()}-01-01`, interval: '1d' }
    case '1Y':  return { period1: new Date(now - 365 * DAY),   interval: '1d'  }
    case 'MAX': return { period1: new Date(now - 3650 * DAY),  interval: '1wk' }
    default:    return { period1: `${new Date().getFullYear()}-01-01`, interval: '1d' }
  }
}

const PORT = 3001
app.listen(PORT, () => console.log(`Yahoo proxy running on http://localhost:${PORT}`))
