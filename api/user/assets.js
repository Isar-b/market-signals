import { kv } from '@vercel/kv'
import { jwtVerify } from 'jose'

async function getUser(req) {
  try {
    const cookies = {}
    ;(req.headers.cookie || '').split(';').forEach(part => {
      const [key, ...rest] = part.trim().split('=')
      if (key) cookies[key] = rest.join('=')
    })
    const token = cookies.session
    if (!token) return null

    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  const user = await getUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const assetsKey = `user:${user.sub}:assets`
  const selectedKey = `user:${user.sub}:selected`

  if (req.method === 'GET') {
    try {
      const assets = await kv.get(assetsKey)
      const selected = await kv.get(selectedKey)
      res.json({ assets: assets || null, selected: selected || null })
    } catch (err) {
      console.error('KV read error:', err.message)
      res.json({ assets: null, selected: null })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const { assets, selected } = req.body

      if (!Array.isArray(assets) || assets.length === 0 || assets.length > 50) {
        return res.status(400).json({ error: 'Invalid assets array (1-50 items)' })
      }
      for (const a of assets) {
        if (!a.id || !a.label || !a.yahooSymbol) {
          return res.status(400).json({ error: 'Each asset must have id, label, yahooSymbol' })
        }
      }

      await kv.set(assetsKey, assets)
      if (selected) await kv.set(selectedKey, selected)

      res.json({ ok: true })
    } catch (err) {
      console.error('KV write error:', err.message)
      res.status(500).json({ error: 'Failed to save assets' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
