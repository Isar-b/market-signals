import { jwtVerify } from 'jose'

// GET /api/auth/session → return current user
// POST /api/auth/session → logout (clear cookie)

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Logout
    res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0')
    return res.json({ ok: true })
  }

  // GET — return current user
  try {
    const cookies = {}
    ;(req.headers.cookie || '').split(';').forEach(part => {
      const [key, ...rest] = part.trim().split('=')
      if (key) cookies[key] = rest.join('=')
    })
    const token = cookies.session
    if (!token) return res.json({ user: null })

    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    res.json({ user: payload })
  } catch {
    res.json({ user: null })
  }
}
