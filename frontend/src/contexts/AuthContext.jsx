// === AUTH CONTEXT — MADE EVENTS Platform ===
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi, getToken, setToken, removeToken, decodeToken, isAuthError } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTokenState]   = useState(() => getToken())
  const [user,  setUser]         = useState(() => decodeToken(getToken()))
  const [loading, setLoading]    = useState(false)
  // true solo se c'è un token locale da verificare col backend — evita lo stato
  // "loggato ma non autorizzato" quando un token scaduto/invalidato sopravvive
  // in localStorage e la pagina tenta di renderizzare contenuti prima di saperlo.
  const [authChecking, setAuthChecking] = useState(() => !!getToken())

  // Sync decoded user whenever token changes
  useEffect(() => {
    setUser(decodeToken(token))
  }, [token])

  // Verifica col backend il token già presente al mount (una tantum — dopo un
  // login riuscito il token è già stato appena validato lato server, non serve
  // ricontrollarlo qui). Se non valido: logout locale + redirect (gestito da
  // RequireAuth leggendo isAuthenticated una volta che authChecking torna false).
  useEffect(() => {
    let cancelled = false
    const initialToken = getToken()
    if (!initialToken) { setAuthChecking(false); return }

    authApi.getMe().then(res => {
      if (cancelled) return
      if (!res.success) {
        removeToken()
        setTokenState(null)
        setUser(null)
      } else if (res.data?.user) {
        setUser(res.data.user)
      }
      setAuthChecking(false)
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    authChecking,
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
