import { kv } from '@vercel/kv'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password, name } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const userKey = `auth:${email.toLowerCase().trim()}`

    // Check if user already exists
    const existing = await kv.get(userKey)
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10)

    // Store user in KV
    await kv.set(userKey, {
      email: email.toLowerCase().trim(),
      name: name || email.split('@')[0],
      hashedPassword,
      provider: 'email',
      createdAt: Date.now(),
    })

    // Create session JWT
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const jwt = await new SignJWT({
      sub: `email:${email.toLowerCase().trim()}`,
      name: name || email.split('@')[0],
      email: email.toLowerCase().trim(),
      provider: 'email',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    res.setHeader('Set-Cookie', `session=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`)
    res.json({ ok: true, user: { name: name || email.split('@')[0], email: email.toLowerCase().trim() } })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Registration failed' })
  }
}
