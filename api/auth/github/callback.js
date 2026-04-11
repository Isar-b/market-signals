import { SignJWT } from 'jose'

export default async function handler(req, res) {
  try {
    const { code } = req.query
    if (!code) return res.status(400).json({ error: 'Missing code' })

    const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const baseUrl = `${proto}://${host}`
    const redirectUri = `${baseUrl}/api/auth/github/callback`

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      console.error('GitHub token exchange failed:', tokens)
      return res.redirect(302, `${baseUrl}/?auth_error=token_exchange_failed`)
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const user = await userRes.json()

    let email = user.email
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const emails = await emailRes.json()
      const primary = Array.isArray(emails) ? (emails.find(e => e.primary) || emails[0]) : null
      email = primary?.email
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const jwt = await new SignJWT({
      sub: `github:${user.id}`,
      name: user.name || user.login,
      email,
      picture: user.avatar_url,
      provider: 'github',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    res.setHeader('Set-Cookie', `session=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`)
    res.redirect(302, baseUrl + '/')
  } catch (err) {
    console.error('GitHub callback error:', err)
    res.redirect(302, '/?auth_error=callback_failed')
  }
}
