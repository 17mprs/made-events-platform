// === LOGIN PAGE — MADE EVENTS Platform ===
import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getErrorMessage, decodeToken } from '../api/client'
import { COLORS, LETTER_SPACING, FONTS, COMPONENT_STYLES } from '../styles/theme'
import Button from '../components/Button'
import Input  from '../components/Input'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [slowHint,  setSlowHint]  = useState(false)

  // Mostra hint "connessione lenta" dopo 4s se ancora in loading
  React.useEffect(() => {
    if (!loading) { setSlowHint(false); return }
    const t = setTimeout(() => setSlowHint(true), 4000)
    return () => clearTimeout(t)
  }, [loading])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Inserisci email e password.')
      return
    }
    setError(null)
    setLoading(true)
    const res = await login(email.trim().toLowerCase(), password)
    setLoading(false)

    if (!res.success) {
      setError(getErrorMessage(res.error))
      return
    }

    const decoded = decodeToken(res.data.token)
    const role = decoded?.role
    if (role === 'USER') navigate('/portale', { replace: true })
    else if (role === 'CLIENTE') navigate('/cliente', { replace: true })
    else navigate('/admin', { replace: true })
  }

  return (
    <div className="split-layout">
      {/* LEFT PANEL */}
      <div className="split-left">
        <div style={{ marginBottom: 'auto' }} />

        <div>
          <div style={{
            display:       'flex',
            alignItems:    'center',
            gap:           '12px',
            marginBottom:  '48px',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="2" fill="rgba(255,255,255,0.2)" />
              <path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="logo-text" style={{ letterSpacing: LETTER_SPACING.logo, fontSize:'22px', fontWeight:600 }}>
              MADE EVENTS
            </span>
          </div>

          <h1 style={{
            fontSize:      '28px',
            fontWeight:    300,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom:  '16px',
            lineHeight:    1.3,
          }}>
            Piattaforma<br />Gestione Talent
          </h1>

          <p style={{ fontSize:'14px', opacity:0.75, lineHeight:1.7, maxWidth:'320px' }}>
            Gestisci eventi, turni e risorse in un'unica interfaccia pensata per i professionisti dell'evento.
          </p>
        </div>

        <div style={{ marginTop: '64px', fontSize:'12px', opacity:0.5, letterSpacing:'1px' }}>
          Non hai un account?{' '}
          <Link to="/registrazione" style={{ color:'#fff', textDecoration:'underline' }}>
            Candidati
          </Link>
          {' · '}
          <Link to="/azienda" style={{ color:'#fff', textDecoration:'underline' }}>
            Registra Azienda
          </Link>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="split-right">
        <div style={{ width:'100%', maxWidth:'360px' }}>
          <h2 style={{
            fontSize:      '20px',
            fontWeight:    300,
            letterSpacing: LETTER_SPACING.title,
            textTransform: 'uppercase',
            marginBottom:  '8px',
            color:         COLORS.text,
          }}>
            Accedi
          </h2>
          <p style={{ fontSize:'13px', color:COLORS.textSecondary, marginBottom:'40px' }}>
            Inserisci le tue credenziali per continuare.
          </p>

          {error && <div className="error-banner">{error}</div>}

          {slowHint && !error && (
            <div style={{ fontSize:'12px', color:COLORS.textSecondary, marginBottom:'8px', textAlign:'center' }}>
              Connessione in corso… (primo avvio potrebbe richiedere qualche secondo)
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nome@esempio.it"
                autoComplete="email"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <Button
              type="submit"
              loading={loading}
              style={{ width:'100%', marginTop:'32px' }}
            >
              {loading ? 'Accesso in corso…' : 'Accedi'}
            </Button>
          </form>

          <div style={{ marginTop:'16px', textAlign:'center' }}>
            <Link to="/reset-password" style={{ color:COLORS.accent, fontSize:'12px', textDecoration:'none' }}>
              Password dimenticata?
            </Link>
          </div>

          <div style={{ marginTop:'20px', textAlign:'center', fontSize:'12px', color:COLORS.textSecondary }}>
            <Link to="/registrazione" style={{ color:COLORS.accent }}>Candidati come Talent</Link>
            {' · '}
            <Link to="/azienda" style={{ color:COLORS.accent }}>Sei un'azienda?</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
