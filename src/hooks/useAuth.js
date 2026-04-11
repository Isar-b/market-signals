import { useState, useEffect, useCallback } from 'react'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
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

  const loginWithGoogle = useCallback(() => {
    window.location.href = '/api/auth/google'
  }, [])

  const loginWithGithub = useCallback(() => {
    window.location.href = '/api/auth/github'
  }, [])

  const logout = useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST' })
      .then(() => setUser(null))
      .catch(() => setUser(null))
  }, [])

  return { user, loading, loginWithGoogle, loginWithGithub, logout }
}
