// Unified Polymarket proxy — handles both CLOB and Gamma API requests
// Usage: /api/polymarket?target=clob&path=price&token_id=...&side=BUY
//        /api/polymarket?target=clob&path=prices-history&market=...
//        /api/polymarket?target=gamma&path=markets&slug=...

const TARGETS = {
  clob: 'https://clob.polymarket.com',
  gamma: 'https://gamma-api.polymarket.com',
}

export default async function handler(req, res) {
  try {
    const { target, path, ...queryParams } = req.query

    const baseUrl = TARGETS[target]
    if (!baseUrl || !path) {
      return res.status(400).json({ error: 'target (clob|gamma) and path are required' })
    }

    const url = new URL(`${baseUrl}/${path}`)
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value)
    }

    const upstream = await fetch(url.toString())
    const text = await upstream.text()

    try {
      const data = JSON.parse(text)
      res.status(upstream.status).json(data)
    } catch {
      res.status(upstream.status).send(text)
    }
  } catch (err) {
    console.error('Polymarket proxy error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
