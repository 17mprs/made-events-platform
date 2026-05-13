import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, getErrorMessage } from '../api/client'
import { COLORS } from '../styles/theme'
import Button from '../components/Button'
import Input  from '../components/Input'

function validatePassword(pwd) {
  if (pwd.length < 8)       return 'Minimo 8 caratteri.'
  if (!/[A-Z]/.test(pwd))   return 'Almeno una lettera maiuscola.'
  if (!/[0-9]/.test(pwd))   return 'Almeno un numero.'
  return null
}

export default function ResetPasswordConfirm() {
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const token           = searchParams.get('token') || ''

  const [checking,  setChecking]  = useState(true)
  const [tokenOk,   setTokenOk]   = useState(false)
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)

  useEffect(() => {
    if (!token) { setChecking(false); return }
    authApi.validateResetToken(token).then(res => {
      setChecking(false)
      if (res.success && res.data?.valid) setTokenOk(true)
    })
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const pwdErr = validatePassword(password)
    if (pwdErr) { setError(pwdErr); return }
    if (password !== confirm) { setError('Le password non coincidono.'); return }

    setLoading(true)
    const res = await authApi.confirmPasswordReset(token, password)
    setLoading(false)
    if (!res.success) { setError(getErrorMessage(res.error)); return }
    setDone(true)
    setTimeout(() => navigate('/login', { state: { message: 'Password cambiata! Accedi con la nuova password.' } }), 2000)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Montserrat, sans-serif',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
        overflow: 'hidden',
      }}>
        <div style={{ background: COLORS.accent, padding: '28px 36px' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: 6 }}>
            MADE EVENTS
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>
            Nuova password
          </h1>
        </div>

        <div style={{ padding: '36px' }}>
          {checking && (
            <p style={{ textAlign: 'center', color: COLORS.textSecondary, fontSize: 13 }}>Verifica link…</p>
          )}

          {!checking && !tokenOk && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
              <p style={{ fontSize: 15, color: COLORS.text, fontWeight: 600, margin: '0 0 8px' }}>
                Link scaduto o già usato
              </p>
              <p style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, margin: '0 0 28px' }}>
                Il link di recupero non è più valido. Richiedi un nuovo link dalla pagina di recupero.
              </p>
              <Link to="/reset-password" style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Richiedi nuovo link →
              </Link>
            </div>
          )}

          {!checking && tokenOk && done && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
              <p style={{ fontSize: 15, color: COLORS.text, fontWeight: 600, margin: '0 0 8px' }}>
                Password cambiata!
              </p>
              <p style={{ fontSize: 13, color: COLORS.textSecondary }}>
                Reindirizzamento al login…
              </p>
            </div>
          )}

          {!checking && tokenOk && !done && (
            <>
              <p style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, margin: '0 0 24px' }}>
                Scegli una nuova password sicura (min. 8 caratteri, 1 maiuscola, 1 numero).
              </p>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Input
                  label="Nuova password *"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <Input
                  label="Conferma password *"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <Button
                  type="submit"
                  loading={loading}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  {loading ? 'Salvataggio…' : 'Cambia password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
