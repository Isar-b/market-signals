import { kv } from '@vercel/kv'
import { SignJWT } from 'jose'

export default async function handler(req, res) {
  try {
    const { token } = req.query
    if (!token) {
      return res.status(400).send('Missing token')
    }

    // Look up the token in KV
    const email = await kv.get(`magic:${token}`)
    if (!email) {
      return res.status(400).send(`
        <html><body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f1117; color: #e2e8f0;">
          <div style="text-align: center;">
            <h2>Link expired or invalid</h2>
            <p style="color: #94a3b8;">Please request a new sign-in link.</p>
            <a href="/" style="color: #6366f1;">Go back to dashboard</a>
          </div>
        </body></html>
      `)
    }

    // Delete the token (single use)
    await kv.del(`magic:${token}`)

    // Create session JWT
    const name = email.split('@')[0]
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const jwt = await new SignJWT({
      sub: `email:${email}`,
      name,
      email,
      provider: 'email',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host

    res.setHeader('Set-Cookie', `session=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`)
    res.redirect(302, `${proto}://${host}/`)
  } catch (err) {
    console.error('Verify error:', err)
    res.status(500).send('Verification failed')
  }
}
