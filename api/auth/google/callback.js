import { createSessionCookie, getBaseUrl } from '../../../lib/auth-helpers.js'
import { decodeJwt } from 'jose'

export default async function handler(req, res) {
  try {
    const { code } = req.query
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' })
    }

    const baseUrl = getBaseUrl(req)
    const redirectUri = `${baseUrl}/api/auth/google/callback`

    // Exchange code for tokens
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

    // Decode the id_token to get user info
    const idToken = decodeJwt(tokens.id_token)

    const cookie = await createSessionCookie({
      sub: `google:${idToken.sub}`,
      name: idToken.name || idToken.email,
      email: idToken.email,
      picture: idToken.picture,
      provider: 'google',
    })

    res.setHeader('Set-Cookie', cookie)
    res.redirect(302, baseUrl + '/')
  } catch (err) {
    console.error('Google callback error:', err)
    res.redirect(302, '/?auth_error=callback_failed')
  }
}
