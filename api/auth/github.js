export default function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const baseUrl = `${proto}://${host}`

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${baseUrl}/api/auth/github/callback`,
    scope: 'read:user user:email',
  })

  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`)
}
