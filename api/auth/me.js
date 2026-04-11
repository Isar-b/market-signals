import { jwtVerify } from 'jose'

export default async function handler(req, res) {
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
