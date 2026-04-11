import { SignJWT, decodeJwt } from 'jose'

export default async function handler(req, res) {
  try {
    const { code } = req.query
    if (!code) return res.status(400).json({ error: 'Missing code' })

    const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const baseUrl = `${proto}://${host}`
    const redirectUri = `${baseUrl}/api/auth/google/callback`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokens.id_token) {
      console.error('Google token exchange failed:', tokens)
      return res.redirect(302, `${baseUrl}/?auth_error=token_exchange_failed`)
    }

    const idToken = decodeJwt(tokens.id_token)
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const jwt = await new SignJWT({
      sub: `google:${idToken.sub}`,
      name: idToken.name || idToken.email,
      email: idToken.email,
      picture: idToken.picture,
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
