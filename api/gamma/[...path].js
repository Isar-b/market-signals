export default async function handler(req, res) {
  try {
    const { path } = req.query
    const pathStr = Array.isArray(path) ? path.join('/') : path || ''
    const url = new URL(`https://gamma-api.polymarket.com/${pathStr}`)

    // Forward all query params except 'path' (which is the catch-all param)
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'path') url.searchParams.set(key, value)
    }

    const upstream = await fetch(url.toString())
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    console.error('Gamma proxy error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
