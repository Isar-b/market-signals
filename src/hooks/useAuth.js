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

  const loginWithGoogle = useCallback(() => {
    window.location.href = '/api/auth/google'
  }, [])

  const logout = useCallback(() => {
    fetch('/api/auth/session', { method: 'POST' })
      .then(() => setUser(null))
      .catch(() => setUser(null))
  }, [])

  return { user, loading, loginWithGithub, loginWithGoogle, logout }
}
