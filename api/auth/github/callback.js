import { createSessionCookie, getBaseUrl } from '../../../lib/auth-helpers.js'

export default async function handler(req, res) {
  try {
    const { code } = req.query
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' })
    }

    const baseUrl = getBaseUrl(req)
    const redirectUri = `${baseUrl}/api/auth/github/callback`

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
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

    // Fetch user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const user = await userRes.json()

    // Fetch email (may not be in profile)
    let email = user.email
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const emails = await emailRes.json()
      const primary = emails.find(e => e.primary) || emails[0]
      email = primary?.email
    }

    const cookie = await createSessionCookie({
      sub: `github:${user.id}`,
      name: user.name || user.login,
      email,
      picture: user.avatar_url,
      provider: 'github',
    })

    res.setHeader('Set-Cookie', cookie)
    res.redirect(302, baseUrl + '/')
  } catch (err) {
    console.error('GitHub callback error:', err)
    res.redirect(302, '/?auth_error=callback_failed')
  }
}
