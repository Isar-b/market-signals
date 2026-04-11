export default async function handler(req, res) {
  try {
    const { path, ...queryParams } = req.query
    const pathStr = Array.isArray(path) ? path.join('/') : path || ''
    const url = new URL(`https://gamma-api.polymarket.com/${pathStr}`)

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
    console.error('Gamma proxy error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
