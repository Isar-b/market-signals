import { useState, useEffect, useCallback } from 'react'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const checkSession = useCallback(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        setUser(data.user || null)
        setLoading(false)
      })
      .catch(() => {
        setUser(null)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const loginWithGithub = useCallback(() => {
    window.location.href = '/api/auth/github'
  }, [])

  const logout = useCallback(() => {
    fetch('/api/auth/session', { method: 'POST' })
      .then(() => setUser(null))
      .catch(() => setUser(null))
  }, [])

  // Called after email login/register — re-check session to pick up the new cookie
  const refreshSession = useCallback(() => {
    checkSession()
  }, [checkSession])

  return { user, loading, loginWithGithub, logout, refreshSession }
}
