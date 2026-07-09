import { createContext, useContext, useEffect, useState } from 'react'
import api, { setAccessToken } from '@/lib/api'

const AuthContext = createContext(null)

// NOTE: POST /api/auth/refresh only returns { access_token } per API spec (11.Auth).
// To restore the user's id/name/role after a page reload without adding a new
// endpoint, we decode the (non-sensitive) claims out of the JWT payload.
// Assumes the backend encodes { sub, name, role } in the access token payload.
// If this assumption doesn't hold, session restore falls back to logged-out
// (fails closed) rather than guessing.
function decodeUserFromToken(token) {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (!json.sub || !json.role) return null
    return { id: json.sub, name: json.name ?? null, role: json.role }
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function restoreSession() {
      try {
        const { data } = await api.post('/api/auth/refresh')
        setAccessToken(data.access_token)
        setUser(decodeUserFromToken(data.access_token))
      } catch {
        setAccessToken(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    restoreSession()
  }, [])

  async function login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password })
    setAccessToken(data.access_token)
    setUser(data.user)
  }

  async function logout() {
    try {
      await api.post('/api/auth/logout')
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
