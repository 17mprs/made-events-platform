// === REGISTER USER (Talent) — MADE EVENT Platform ===
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { talentApi, getErrorMessage } from '../api/client'
import { COLORS, LETTER_SPACING } from '../styles/theme'
import Button from '../components/Button'
import Input  from '../components/Input'

// ---------------------------------------------------------------------------
// MAIN — Step 1 unico: dati base + gdpr → email con link /registrazione/completa
// Il profilo completo viene compilato in RegisterComplete.jsx via token email.
// ---------------------------------------------------------------------------

export default function RegisterUser() {
  const [form,    setForm]    = useState({ nome: '', cognome: '', email: '', telefono: '', gdpr_consent: false })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [done,    setDone]    = useState(false)
  const [sentTo,  setSentTo]  = useState('')

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.gdpr_consent) { setError('Devi accettare il trattamento dei dati per procedere.'); return }
    setError(null)
    setLoading(true)
    const res = await talentApi.registerStep1({ ...form, gdpr_consent: true })
    setLoading(false)
    if (!res.success) { setError(getErrorMessage(res.error)); return }
    setSentTo(form.email)
    setDone(true)
  }

  if (done) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px', background:'#FAFAFA' }}>
        <div style={{ maxWidth:'480px', textAlign:'center' }}>
          <div style={{
            width:'64px', height:'64px', borderRadius:'50%',
            background: COLORS.accentLight, color: COLORS.accent,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'28px', margin:'0 auto 28px',
          }}>✓</div>
          <h1 style={{ fontSize:'20px', fontWeight:300, letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px', color:COLORS.text }}>
            Email inviata!
          </h1>
          <p style={{ fontSize:'14px', color:COLORS.textSecondary, lineHeight:1.8, marginBottom:'32px' }}>
            Abbiamo inviato un link a <strong>{sentTo}</strong>.<br />
            Clicca il link nell'email per completare il tuo profilo e inviare la candidatura.
          </p>
          <p style={{ fontSize:'12px', color:COLORS.textSecondary, marginBottom:'32px' }}>
            Non trovi l'email? Controlla anche la cartella Spam.
          </p>
          <Link to="/login">
            <Button variant="secondary">Vai al Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#FAFAFA', padding:'40px 24px' }}>
      <div style={{ maxWidth:'480px', margin:'0 auto' }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'48px' }}>
          <Link to="/" style={{ display:'inline-flex', alignItems:'center', gap:'10px', marginBottom:'24px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.accent} />
              <path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{ letterSpacing:LETTER_SPACING.logo, fontSize:'13px', fontWeight:500, color:COLORS.text }}>
              MADE EVENTS
            </span>
          </Link>
          <h1 style={{ fontSize:'20px', fontWeight:300, letterSpacing:LETTER_SPACING.title, textTransform:'uppercase', color:COLORS.text, marginBottom:'8px' }}>
            Candidatura Talent
          </h1>
          <p style={{ fontSize:'13px', color:COLORS.textSecondary }}>
            Inserisci i tuoi dati — riceverai un'email con il link per completare il profilo.
          </p>
        </div>

        <div style={{ background:'#fff', border:`1px solid ${COLORS.border}`, borderRadius:'6px', padding:'40px' }}>
          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={submit} noValidate>
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div className="form-grid">
                <Input label="Nome *"    value={form.nome}    onChange={f('nome')}    required />
                <Input label="Cognome *" value={form.cognome} onChange={f('cognome')} required />
              </div>
              <Input label="Email *"   type="email" value={form.email}    onChange={f('email')}    required />
              <Input label="Telefono"  type="tel"   value={form.telefono} onChange={f('telefono')} />

              <div style={{ display:'flex', gap:'12px', alignItems:'flex-start', padding:'16px', background: COLORS.surface, borderRadius:'4px', border:`1px solid ${COLORS.border}` }}>
                <input
                  id="gdpr"
                  type="checkbox"
                  checked={form.gdpr_consent}
                  onChange={e => setForm(p => ({ ...p, gdpr_consent: e.target.checked }))}
                  style={{ marginTop:'2px', accentColor: COLORS.accent, flexShrink:0 }}
                />
                <label htmlFor="gdpr" style={{ fontSize:'12px', color:COLORS.textSecondary, lineHeight:1.6, cursor:'pointer' }}>
                  Dichiaro di aver letto e accetto il trattamento dei miei dati personali ai sensi del{' '}
                  <strong>Regolamento UE 2016/679 (GDPR)</strong> per le finalità di selezione del personale. *
                </label>
              </div>
            </div>

            <Button
              type="submit"
              loading={loading}
              style={{ width:'100%', marginTop:'24px' }}
            >
              {loading ? 'Invio in corso…' : 'Continua →'}
            </Button>
          </form>
        </div>

        <div style={{ textAlign:'center', marginTop:'24px', fontSize:'12px', color:COLORS.textSecondary }}>
          Hai già un account?{' '}
          <Link to="/login" style={{ color:COLORS.accent }}>Accedi</Link>
        </div>
      </div>
    </div>
  )
}
