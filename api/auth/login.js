import { kv } from '@vercel/kv'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const userKey = `auth:${email.toLowerCase().trim()}`
    const user = await kv.get(userKey)

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.hashedPassword)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Create session JWT
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const jwt = await new SignJWT({
      sub: `email:${user.email}`,
      name: user.name,
      email: user.email,
      provider: 'email',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    res.setHeader('Set-Cookie', `session=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`)
    res.json({ ok: true, user: { name: user.name, email: user.email } })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
}
