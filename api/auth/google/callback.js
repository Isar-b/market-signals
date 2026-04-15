import { SignJWT } from 'jose'

export default async function handler(req, res) {
  try {
    const { code } = req.query
    if (!code) return res.status(400).json({ error: 'Missing code' })

    const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const baseUrl = `${proto}://${host}`
    const redirectUri = `${baseUrl}/api/auth/google/callback`

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      console.error('Google token exchange failed:', tokens)
      return res.redirect(302, `${baseUrl}/?auth_error=token_exchange_failed`)
    }

    // Fetch user profile
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const user = await userRes.json()

    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const jwt = await new SignJWT({
      sub: `google:${user.id}`,
      name: user.name,
      email: user.email,
      picture: user.picture,
      provider: 'google',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    res.setHeader('Set-Cookie', `session=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`)
    res.redirect(302, baseUrl + '/')
  } catch (err) {
    console.error('Google callback error:', err)
    res.redirect(302, '/?auth_error=callback_failed')
  }
}
