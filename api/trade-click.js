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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { asset, label } = req.body || {}
    const user = await getUser(req)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'unknown'

    const entry = {
      asset: asset || 'unknown',
      label: label || 'unknown',
      email: user?.email || 'anonymous',
      name: user?.name || null,
      provider: user?.provider || null,
      ip,
      timestamp: new Date().toISOString(),
    }

    // Append to a list in KV
    await kv.lpush('trade_clicks', JSON.stringify(entry))

    res.json({ ok: true })
  } catch (err) {
    console.error('Trade click log error:', err.message)
    // Don't fail the user experience
    res.json({ ok: true })
  }
}
