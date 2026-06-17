// === AUTH CONTEXT — MADE EVENTS Platform ===
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi, getToken, setToken, removeToken, decodeToken, isAuthError } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTokenState]   = useState(() => getToken())
  const [user,  setUser]         = useState(() => decodeToken(getToken()))
  const [loading, setLoading]    = useState(false)

  // Sync decoded user whenever token changes
  useEffect(() => {
    setUser(decodeToken(token))
  }, [token])

  const login = useCallback(async (email, password) => {
    setLoading(true)
    const res = await authApi.login(email, password)
    setLoading(false)
    if (!res.success) return res
    setToken(res.data.token)
    setTokenState(res.data.token)
    return res
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    removeToken()
    setTokenState(null)
    setUser(null)
  }, [])

  // Intercept auth errors coming from API calls (called by pages that use apiCall)
  const handleApiResponse = useCallback((res) => {
    if (!res.success && isAuthError(res.error)) {
      removeToken()
      setTokenState(null)
      setUser(null)
    }
    return res
  }, [])

  const value = {
    token,
    user,
    loading,
    login,
    logout,
    handleApiResponse,
    isAuthenticated: !!token,
    role: user?.role ?? null,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
