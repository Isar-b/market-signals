import { clearSessionCookie } from '../../lib/auth-helpers.js'

export default function handler(req, res) {
  res.setHeader('Set-Cookie', clearSessionCookie())
  res.json({ ok: true })
}
