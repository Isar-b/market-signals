import { clearSessionCookie } from './_helpers.js'

export default function handler(req, res) {
  res.setHeader('Set-Cookie', clearSessionCookie())
  res.json({ ok: true })
}
