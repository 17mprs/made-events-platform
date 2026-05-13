import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi, getErrorMessage } from '../api/client'
import { COLORS, COMPONENT_STYLES } from '../styles/theme'
import Button from '../components/Button'
import Input  from '../components/Input'

export default function ResetPasswordRequest() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setError('Inserisci la tua email.'); return }
    setLoading(true)
    setError(null)
    const res = await authApi.requestPasswordReset(email.trim().toLowerCase())
    setLoading(false)
    if (!res.success) {
      setError(getErrorMessage(res.error))
      return
    }
    setSent(true)
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
            Recupera password
          </h1>
        </div>

        <div style={{ padding: '36px' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
              <p style={{ fontSize: 15, color: COLORS.text, fontWeight: 600, margin: '0 0 8px' }}>
                Email inviata!
              </p>
              <p style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, margin: '0 0 28px' }}>
                Ti abbiamo inviato un'email con le istruzioni per reimpostare la password. Controlla la posta (e la cartella spam).
              </p>
              <Link to="/login" style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                ← Torna al login
              </Link>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, margin: '0 0 24px' }}>
                Inserisci la tua email e ti manderemo un link per reimpostare la password.
              </p>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <Input
                  label="Email *"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="la-tua@email.it"
                  autoComplete="email"
                  required
                />
                <Button
                  type="submit"
                  loading={loading}
                  style={{ width: '100%', marginTop: 24 }}
                >
                  {loading ? 'Invio in corso…' : 'Invia link di recupero'}
                </Button>
              </form>

              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Link to="/login" style={{ color: COLORS.textSecondary, fontSize: 12, textDecoration: 'none' }}>
                  ← Torna al login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
