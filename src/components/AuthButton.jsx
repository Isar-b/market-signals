import { useState } from 'react'

export default function AuthButton({ user, loading, onLoginGithub, onLogout }) {
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return <div className="text-[10px] text-text-secondary animate-pulse">Loading...</div>
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {user.picture ? (
          <img src={user.picture} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] text-white font-bold">
            {(user.name || user.email || '?')[0].toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-text-primary truncate">{user.name || user.email}</div>
          <button onClick={onLogout} className="text-[10px] text-text-secondary hover:text-red transition-colors">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  async function handleSendLink(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/auth/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to send link')
        setSubmitting(false)
        return
      }
      setSent(true)
      setSubmitting(false)
    } catch {
      setError('Network error')
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-1.5 text-center">
        <div className="text-[11px] text-green">Check your email</div>
        <div className="text-[10px] text-text-secondary">
          We sent a sign-in link to <span className="text-text-primary">{email}</span>
        </div>
        <button
          onClick={() => { setSent(false); setEmail(''); setError('') }}
          className="text-[10px] text-text-secondary hover:text-text-primary transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  if (showForm) {
    return (
      <form onSubmit={handleSendLink} className="flex flex-col gap-1.5">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-2 py-1 text-[11px] bg-bg-card border border-border rounded
            text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
        />
        {error && <div className="text-[10px] text-red">{error}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-2 py-1 text-[11px] bg-accent text-white rounded hover:bg-accent-hover
            transition-colors disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Send sign-in link'}
        </button>
        <button
          type="button"
          onClick={() => { setShowForm(false); setError('') }}
          className="text-[10px] text-text-secondary hover:text-text-primary transition-colors"
        >
          Back
        </button>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-text-secondary
          hover:text-text-primary hover:bg-bg-card rounded transition-colors"
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
        Sign in with email
      </button>
      <button
        onClick={onLoginGithub}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-text-secondary
          hover:text-text-primary hover:bg-bg-card rounded transition-colors"
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        Sign in with GitHub
      </button>
    </div>
  )
}
