import { verifySession } from './_helpers.js'

export default async function handler(req, res) {
  const user = await verifySession(req)
  res.json({ user: user || null })
}
