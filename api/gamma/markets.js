export default async function handler(req, res) {
  try {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(req.query)) {
      params.set(key, value)
    }

    const url = `https://gamma-api.polymarket.com/markets?${params}`
    const upstream = await fetch(url)
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    console.error('Gamma markets proxy error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
