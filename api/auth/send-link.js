import { kv } from '@vercel/kv'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex')

    // Store token in KV with 10-minute expiry
    await kv.set(`magic:${token}`, normalizedEmail, { ex: 600 })

    // Build the magic link URL
    const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const magicLink = `${proto}://${host}/api/auth/verify?token=${token}`

    // Send the email
    await resend.emails.send({
      from: 'Market Signals <onboarding@resend.dev>',
      to: normalizedEmail,
      subject: 'Sign in to Market Signals',
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #e2e8f0; background: #0f1117; padding: 20px; border-radius: 8px; text-align: center;">
            Market Signals
          </h2>
          <p>Click the button below to sign in:</p>
          <a href="${magicLink}" style="display: block; background: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; text-align: center; font-weight: 600; margin: 20px 0;">
            Sign in
          </a>
          <p style="color: #666; font-size: 13px;">This link expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('Send link error:', err)
    res.status(500).json({ error: 'Failed to send login link' })
  }
}
