export default async function handler(req, res) {
  try {
    const { token_id, side } = req.query
    const url = `https://clob.polymarket.com/price?token_id=${encodeURIComponent(token_id)}&side=${encodeURIComponent(side || 'BUY')}`

    const upstream = await fetch(url)
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    console.error('CLOB price proxy error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
