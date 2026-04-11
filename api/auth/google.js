import { getBaseUrl } from '../../lib/auth-helpers.js'

export default function handler(req, res) {
  const baseUrl = getBaseUrl(req)
  const redirectUri = `${baseUrl}/api/auth/google/callback`

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })

  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
