// === REGISTER COMPLETE — MADE EVENT Platform ===
// Landing raggiunta via link email con ?token=UUID.
// Orchestratore dell'onboarding completo in 8 sezioni.
// Ogni sezione salva automaticamente i dati su GAS al click "Salva e continua".
import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { talentApi, getErrorMessage } from '../api/client'
import { COLORS, LETTER_SPACING } from '../styles/theme'
import Button from '../components/Button'
import ProgressBar from '../components/registration/ProgressBar'

import Section1 from '../components/registration/sections/Section1'
import Section2 from '../components/registration/sections/Section2'
import Section3 from '../components/registration/sections/Section3'
import Section4 from '../components/registration/sections/Section4'
import Section5 from '../components/registration/sections/Section5'
import Section6 from '../components/registration/sections/Section6'

// ---------------------------------------------------------------------------
// STATO INIZIALE FORM
// ---------------------------------------------------------------------------

const FORM_INITIAL = {
  // Sezione 1
  genere: '',
  nascita_nazione: 'Italia', nascita_regione: '', nascita_provincia: '', nascita_citta: '', nascita_paese: '',
  residenza_nazione: 'Italia', residenza_regione: '', residenza_provincia: '', residenza_citta: '', residenza_paese: '',
  domicilio_coincide: false, domicilio_provincia: '',
  instagram: '', facebook: '',
  // Sezione 2
  altezza: '', taglia_tshirt: '', taglia_pantalone: '', taglia_gonna: '', numero_scarpe: '',
  piercing_visibili: '', tatuaggi_visibili: '', tatuaggi_dove: '',
  // Sezione 3
  patente_tipologie: [], automunita: '', province_lavoro: [],
  disponibilita_trasferte: '', disponibilita_weekend: '', disponibilita_serali: '',
  // Sezione 4
  lingua_inglese: '', lingua_francese: '', lingua_spagnolo: '', lingua_tedesco: '',
  altre_lingue: [],
  // Sezione 5
  titolo_studio: '', titolo_studio_indirizzo: '',
  professione_attuale: [], tipologie_esperienza: [], anni_esperienza_settore: '',
  // Sezione 6
  dotazione_personale: [],
}

// Mappa i campi saved_data del backend sui campi del form
function mergeWithSaved(savedData) {
  if (!savedData) return FORM_INITIAL
  return { ...FORM_INITIAL, ...savedData }
}

// ---------------------------------------------------------------------------
// LOGO SHELL
// ---------------------------------------------------------------------------

function PageShell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', padding: '40px 24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.accent} />
              <path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ letterSpacing: LETTER_SPACING.logo, fontSize: '13px', fontWeight: 500, color: COLORS.text }}>
              MADE EVENTS
            </span>
          </Link>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: '6px', padding: '48px' }}>
          {children}
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: COLORS.textSecondary }}>
          <Link to="/login" style={{ color: COLORS.accent }}>Accedi</Link>
          {' · '}
          <Link to="/registrazione" style={{ color: COLORS.accent }}>Nuova registrazione</Link>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SCHERMATA: LINK NON VALIDO
// ---------------------------------------------------------------------------

function InvalidToken() {
  return (
    <PageShell>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: '36px', marginBottom: '20px', color: COLORS.border }}>✕</div>
        <h2 style={{ fontSize: '18px', fontWeight: 300, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.text, marginBottom: '12px' }}>
          Link non valido
        </h2>
        <p style={{ fontSize: '14px', color: COLORS.textSecondary, lineHeight: 1.7, marginBottom: '28px' }}>
          Questo link non è valido o è scaduto.<br />
          Se hai già completato la registrazione, puoi accedere direttamente.
        </p>
        <Link to="/login"><Button>Vai al login</Button></Link>
        <div style={{ marginTop: '16px' }}>
          <Link to="/registrazione" style={{ fontSize: '13px', color: COLORS.accent }}>
            Inizia una nuova registrazione
          </Link>
        </div>
      </div>
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// SCHERMATA: PROFILO INVIATO
// ---------------------------------------------------------------------------

function ProfiloInviato({ nome }) {
  return (
    <PageShell>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: COLORS.accentLight, color: COLORS.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px', margin: '0 auto 28px',
        }}>
          ✓
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.text, marginBottom: '16px' }}>
          Profilo inviato!
        </h2>
        <p style={{ fontSize: '14px', color: COLORS.textSecondary, lineHeight: 1.8, maxWidth: '400px', margin: '0 auto 32px' }}>
          Ciao <strong>{nome}</strong>, il tuo profilo è stato ricevuto ed è ora
          in attesa di revisione da parte del team MADE EVENTS.
        </p>

        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: '4px', padding: '20px 24px', textAlign: 'left',
          maxWidth: '360px', margin: '0 auto 36px',
        }}>
          <p style={{ margin: '0 0 12px', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 500 }}>
            Cosa succede ora
          </p>
          {[
            'Il team MADE EVENTS esamina il tuo profilo (solitamente 2–5 giorni)',
            'Ricevi una email con l\'esito della valutazione',
            'Se approvata, accedi alla piattaforma e candidati agli eventi',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: i < 2 ? '10px' : 0 }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: COLORS.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 500, flexShrink: 0, marginTop: '2px' }}>
                {i + 1}
              </span>
              <span style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.6 }}>{item}</span>
            </div>
          ))}
        </div>

        <Link to="/login">
          <Button variant="secondary">Vai al login</Button>
        </Link>
      </div>
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// SCHERMATA: GIA' COMPLETATO
// ---------------------------------------------------------------------------

function GiaCompletato() {
  return (
    <PageShell>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: '32px', marginBottom: '20px' }}>✓</div>
        <h2 style={{ fontSize: '18px', fontWeight: 300, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.accent, marginBottom: '12px' }}>
          Registrazione completata
        </h2>
        <p style={{ fontSize: '14px', color: COLORS.textSecondary, lineHeight: 1.7, marginBottom: '28px' }}>
          Hai già inviato il tuo profilo.<br />
          Il team MADE EVENTS lo esaminerà e ti contatterà via email.
        </p>
        <Link to="/login"><Button>Accedi alla piattaforma</Button></Link>
      </div>
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function RegisterComplete() {
  const token = new URLSearchParams(window.location.search).get('token')

  const [status,   setStatus]   = useState('loading') // loading | invalid | form | done | already_done
  const [section,  setSection]  = useState(1)
  const [saving,   setSaving]   = useState(false)
  const [saveErr,  setSaveErr]  = useState(null)
  const [leadData, setLeadData] = useState(null)  // { lead_id, nome, email }
  const [formData, setFormData] = useState(FORM_INITIAL)

  // ---------------------------------------------------------------------------
  // Caricamento iniziale — verifica token e precarica dati salvati
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }

    talentApi.getLead(token).then(res => {
      if (!res.success) { setStatus('invalid'); return }

      const { lead_id, nome, email, step_completed, saved_data } = res.data
      setLeadData({ lead_id, nome, email })

      if (step_completed >= 6) {
        setStatus('already_done')
        return
      }

      // Pre-popola il form con i dati già salvati
      if (saved_data) {
        setFormData(mergeWithSaved(saved_data))
      }

      // Riprendi dalla sezione successiva a quella già completata
      const resumeAt = Math.min(Math.max((step_completed || 0) + 1, 1), 6)
      setSection(resumeAt)
      setStatus('form')
    })
  }, [token])

  // ---------------------------------------------------------------------------
  // Aggiorna un campo del form
  // ---------------------------------------------------------------------------

  const handleChange = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }, [])

  // ---------------------------------------------------------------------------
  // Autosave su GAS dopo ogni sezione (sezioni 1-7)
  // ---------------------------------------------------------------------------

  async function saveSection(sectionNumber) {
    setSaving(true)
    setSaveErr(null)

    const res = await talentApi.registerStep2({
      lead_id:            leadData.lead_id,
      email:              leadData.email,
      sezione_completata: sectionNumber,
      ...formData,
    })

    setSaving(false)
    if (!res.success) {
      setSaveErr(getErrorMessage(res.error))
      return false
    }
    return true
  }

  // ---------------------------------------------------------------------------
  // Invio finale (sezione 8)
  // ---------------------------------------------------------------------------

  async function handleFinalSubmit() {
    setSaving(true)
    setSaveErr(null)

    const res = await talentApi.registerStep3({
      lead_id: leadData.lead_id,
      email:   leadData.email,
      ...formData,
    })

    setSaving(false)
    if (!res.success) {
      setSaveErr(getErrorMessage(res.error))
      return
    }
    setStatus('done')
  }

  // ---------------------------------------------------------------------------
  // Navigazione sezioni
  // ---------------------------------------------------------------------------

  async function handleNext(sectionNumber) {
    const ok = await saveSection(sectionNumber)
    if (ok) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setSection(sectionNumber + 1)
    }
  }

  function handleBack(sectionNumber) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setSection(sectionNumber - 1)
  }

  // ---------------------------------------------------------------------------
  // Renders per stato
  // ---------------------------------------------------------------------------

  if (status === 'loading') {
    return (
      <PageShell>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="spinner" style={{ margin: '0 auto', width: '28px', height: '28px' }} />
          <p style={{ marginTop: '20px', fontSize: '13px', color: COLORS.textSecondary }}>
            Caricamento in corso…
          </p>
        </div>
      </PageShell>
    )
  }

  if (status === 'invalid')      return <InvalidToken />
  if (status === 'already_done') return <GiaCompletato />
  if (status === 'done')         return <ProfiloInviato nome={leadData?.nome} />

  // ---------------------------------------------------------------------------
  // Form a 8 sezioni
  // ---------------------------------------------------------------------------

  const commonProps = { data: formData, onChange: handleChange, loading: saving }

  return (
    <PageShell>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 300, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.text, marginBottom: '4px' }}>
          Completa il tuo profilo
        </h1>
        {leadData?.nome && (
          <p style={{ fontSize: '13px', color: COLORS.textSecondary }}>
            Ciao <strong>{leadData.nome}</strong> — compila tutte le sezioni per inviare la tua candidatura.
          </p>
        )}
      </div>

      {/* Progress bar */}
      <ProgressBar current={section} />

      {/* Errore salvataggio */}
      {saveErr && (
        <div className="error-banner" style={{ marginBottom: '24px' }}>
          {saveErr} — riprova o ricarica la pagina.
        </div>
      )}

      {/* Sezioni */}
      {section === 1 && (
        <Section1
          {...commonProps}
          onNext={() => handleNext(1)}
        />
      )}
      {section === 2 && (
        <Section2
          {...commonProps}
          onBack={() => handleBack(2)}
          onNext={() => handleNext(2)}
        />
      )}
      {section === 3 && (
        <Section3
          {...commonProps}
          onBack={() => handleBack(3)}
          onNext={() => handleNext(3)}
        />
      )}
      {section === 4 && (
        <Section4
          {...commonProps}
          onBack={() => handleBack(4)}
          onNext={() => handleNext(4)}
        />
      )}
      {section === 5 && (
        <Section5
          {...commonProps}
          onBack={() => handleBack(5)}
          onNext={() => handleNext(5)}
        />
      )}
      {section === 6 && (
        <Section6
          {...commonProps}
          onBack={() => handleBack(6)}
          onNext={handleFinalSubmit}
          nextLabel="Invia candidatura →"
        />
      )}
    </PageShell>
  )
}
