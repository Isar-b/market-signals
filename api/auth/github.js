import { getBaseUrl } from '../../lib/auth-helpers.js'

export default function handler(req, res) {
  const baseUrl = getBaseUrl(req)
  const redirectUri = `${baseUrl}/api/auth/github/callback`

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
  })

  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`)
}
