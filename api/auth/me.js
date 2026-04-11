import { verifySession } from '../../lib/auth-helpers.js'

export default async function handler(req, res) {
  const user = await verifySession(req)
  res.json({ user: user || null })
}
