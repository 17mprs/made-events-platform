// === REGISTER AZIENDA — MADE EVENT Platform ===
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { clientApi, getErrorMessage } from '../api/client'
import { COLORS, COMPONENT_STYLES, LETTER_SPACING } from '../styles/theme'
import Button from '../components/Button'
import Input  from '../components/Input'

export default function RegisterAzienda() {
  const [form, setForm] = useState({
    ragione_sociale: '',
    piva:            '',
    email_referente: '',
    nome_referente:  '',
    telefono:        '',
    indirizzo:       '',
    citta:           '',
    note:            '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [done,    setDone]    = useState(false)

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await clientApi.create(form)
    setLoading(false)
    if (!res.success) { setError(getErrorMessage(res.error)); return }
    setDone(true)
  }

  if (done) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px', background:'#FAFAFA' }}>
        <div style={{ maxWidth:'480px', textAlign:'center' }}>
          <div style={{ fontSize:'40px', marginBottom:'24px' }}>✓</div>
          <h1 style={{ fontSize:'22px', fontWeight:300, letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px', color:COLORS.accent }}>
            Registrazione Inviata
          </h1>
          <p style={{ fontSize:'14px', color:COLORS.textSecondary, lineHeight:1.7, marginBottom:'32px' }}>
            La tua azienda è stata registrata. Un amministratore creerà le credenziali di accesso e
            ti contatterà all'email indicata.
          </p>
          <Link to="/login">
            <Button>Vai al Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#FAFAFA', padding:'40px 24px' }}>
      <div style={{ maxWidth:'640px', margin:'0 auto' }}>
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
          <h1 style={{ fontSize:'20px', fontWeight:300, letterSpacing:LETTER_SPACING.title, textTransform:'uppercase', color:COLORS.text }}>
            Registra la tua Azienda
          </h1>
          <p style={{ fontSize:'13px', color:COLORS.textSecondary, marginTop:'8px' }}>
            Compila il modulo — un nostro operatore attiverà l'account e ti fornirà le credenziali.
          </p>
        </div>

        <div style={{ background:'#fff', border:`1px solid ${COLORS.border}`, borderRadius:'6px', padding:'40px' }}>
          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={submit} noValidate>
            <div style={{ marginBottom:'24px' }}>
              <div style={{
                fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase',
                color:COLORS.textSecondary, marginBottom:'16px', fontWeight:500,
              }}>
                Dati Azienda
              </div>
              <div className="form-grid">
                <div className="form-field-full">
                  <Input label="Ragione Sociale *" value={form.ragione_sociale} onChange={f('ragione_sociale')} required />
                </div>
                <Input label="Partita IVA" value={form.piva} onChange={f('piva')} />
                <Input label="Indirizzo"   value={form.indirizzo} onChange={f('indirizzo')} />
                <Input label="Città"       value={form.citta} onChange={f('citta')} />
              </div>
            </div>

            <hr style={{ border:'none', borderTop:`1px solid ${COLORS.border}`, margin:'8px 0 24px' }} />

            <div>
              <div style={{
                fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase',
                color:COLORS.textSecondary, marginBottom:'16px', fontWeight:500,
              }}>
                Referente
              </div>
              <div className="form-grid">
                <Input label="Nome e Cognome *" value={form.nome_referente}  onChange={f('nome_referente')}  required />
                <Input label="Email *"           type="email" value={form.email_referente} onChange={f('email_referente')} required />
                <Input label="Telefono"          type="tel"   value={form.telefono}        onChange={f('telefono')} />
                <div className="form-field-full">
                  <Input label="Note" value={form.note} onChange={f('note')} helper="Eventuali note o esigenze specifiche" />
                </div>
              </div>
            </div>

            <div style={{ marginTop:'32px' }}>
              <Button type="submit" loading={loading} style={{ width:'100%' }}>
                Invia Richiesta
              </Button>
            </div>
          </form>
        </div>

        <div style={{ textAlign:'center', marginTop:'24px', fontSize:'12px', color:COLORS.textSecondary }}>
          Sei un talent?{' '}
          <Link to="/registrazione" style={{ color:COLORS.accent }}>Candidati qui</Link>
          {' · '}
          <Link to="/login" style={{ color:COLORS.accent }}>Accedi</Link>
        </div>
      </div>
    </div>
  )
}
