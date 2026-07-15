// === USER PORTAL — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  eventApi, applicationApi, assignmentApi, talentApi, documentApi,
  getErrorMessage,
} from '../api/client'
import { COLORS, COMPONENT_STYLES, LETTER_SPACING } from '../styles/theme'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Card   from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import Input from '../components/Input'
import FileUpload from '../components/registration/FileUpload'
import { Section1Fields } from '../components/registration/sections/Section1'
import { Section2Fields } from '../components/registration/sections/Section2'
import { Section3Fields } from '../components/registration/sections/Section3'
import { Section4Fields } from '../components/registration/sections/Section4'
import { Section5Fields } from '../components/registration/sections/Section5'
import { Section6Fields } from '../components/registration/sections/Section6'
import { FOTO_FIELDS, CRITERI_NON_ACCETTAZIONE } from '../components/registration/questionnaireOptions'

// Mirror di driveThumbUrl() in pages/admin/shared.jsx — i link foto sono
// share link Drive (drive.google.com/file/d/<id>/view), non utilizzabili
// direttamente come <img src>, vanno convertiti in link thumbnail incorporabile.
function driveThumbUrl(url, size = 200) {
  if (typeof url !== 'string') return url
  const m = url.match(/\/file\/d\/([^/]+)/)
  if (!m) return url
  return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${size}`
}

const SIDEBAR_ITEMS = [
  { type:'section', label:'Talent' },
  { label:'Offerte di Lavoro',    to:'/portale#events' },
  { label:'Le Mie Candidature', to:'/portale#applications' },
  { label:'I Miei Turni',       to:'/portale#assignments' },
  { type:'section', label:'Account' },
  { label:'Il Mio Profilo',    to:'/portale#profile' },
  { type:'section', label:'Supporto' },
  { label:'FAQ',               to:'/portale/faq' },
]

function SectionTitle({ children, id }) {
  return <h2 id={id} style={{ ...COMPONENT_STYLES.sectionTitle, marginTop:'48px' }}>{children}</h2>
}

// ---------------------------------------------------------------------------
// OFFERTE DI LAVORO (EVENTI APERTI)
// ---------------------------------------------------------------------------

function EventDetailDrawer({ event, onClose, onApply, applying, alreadyApplied }) {
  const ed = event?.data ?? {}
  const [msg, setMsg] = useState('')

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex' }}>
      <div onClick={onClose} style={{ flex:1, background:'rgba(0,0,0,0.5)' }} />
      <div style={{
        width: '480px', maxWidth:'100vw', height:'100%', overflowY:'auto',
        background:'#fff', padding:'24px', boxShadow:'-4px 0 24px rgba(0,0,0,0.15)',
        display:'flex', flexDirection:'column', gap:'16px',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ fontSize:'17px', fontWeight:600, margin:0 }}>{ed.titolo || 'Evento'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'20px', color:COLORS.textSecondary }}>✕</button>
        </div>

        {(ed.foto_copertina_url || ed.foto_url) && (
          <img
            src={ed.foto_copertina_url || ed.foto_url}
            alt={ed.titolo}
            style={{ width:'100%', height:'180px', objectFit:'cover', borderRadius:'8px' }}
          />
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {ed.data_inizio && (
            <Row label="Data" val={new Date(ed.data_inizio).toLocaleDateString('it-IT',{dateStyle:'long'})} />
          )}
          {ed.luogo && <Row label="Luogo" val={ed.luogo} />}
          {ed.citta && <Row label="Città" val={ed.citta} />}
          {ed.tipologia && <Row label="Tipologia" val={ed.tipologia} />}
          {ed.compenso && <Row label="Compenso" val={ed.compenso} />}
          {ed.abbigliamento_richiesto && <Row label="Dress code" val={ed.abbigliamento_richiesto} />}
          {ed.hostess_richieste && <Row label="Figure richieste" val={ed.hostess_richieste} />}
        </div>

        {ed.descrizione && (
          <div>
            <div style={{ fontSize:'12px', fontWeight:600, color:COLORS.textSecondary, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Descrizione</div>
            <p style={{ fontSize:'13px', color:COLORS.text, lineHeight:1.7, margin:0 }}>{ed.descrizione}</p>
          </div>
        )}

        {alreadyApplied ? (
          <div className="success-banner" style={{ marginTop:'auto' }}>Hai già inviato una candidatura per questo evento.</div>
        ) : (
          <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:'10px' }}>
            <input
              placeholder="Messaggio opzionale"
              value={msg}
              onChange={e => setMsg(e.target.value)}
              style={{
                border:`1px solid ${COLORS.border}`, borderRadius:'4px',
                padding:'8px 12px', fontSize:'13px',
                fontFamily:'Montserrat,sans-serif', width:'100%', boxSizing:'border-box',
              }}
            />
            <Button loading={applying} onClick={() => onApply(event.entity_id, msg)}>
              Candidati
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, val }) {
  return (
    <div style={{ display:'flex', gap:'8px', fontSize:'13px', flexWrap:'wrap' }}>
      <span style={{ fontWeight:600, minWidth:'120px', flexShrink:0, color:COLORS.textSecondary }}>{label}</span>
      <span style={{ color:COLORS.text, minWidth:0 }}>{val}</span>
    </div>
  )
}

function AvailableEvents({ handleApiResponse }) {
  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [applying, setApplying] = useState(null)
  const [myApps,   setMyApps]   = useState([])
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [evRes, appRes] = await Promise.all([
      eventApi.list(),
      applicationApi.list(),
    ])
    setLoading(false)
    const evR  = handleApiResponse(evRes)
    const appR = handleApiResponse(appRes)
    if (evR.success)  setEvents(evR.data?.items ?? [])
    if (appR.success) setMyApps(appR.data?.items ?? [])
  }, [handleApiResponse])

  useEffect(() => { load() }, [load])

  const apply = async (event_id, messaggio) => {
    setApplying(event_id)
    const res = handleApiResponse(await applicationApi.submitForEvent(event_id, messaggio))
    setApplying(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else { setSelected(null); load() }
  }

  const appliedEventIds = new Set(myApps.map(a => a.data?.event_id).filter(Boolean))

  if (loading) return <div className="spinner" />
  if (!events.length) return <div className="empty-state">Nessun evento aperto alle candidature al momento.</div>

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'16px' }}>
        {events.map(ev => {
          const ed = ev.data ?? {}
          const applied = appliedEventIds.has(ev.entity_id)
          return (
            <Card key={ev.entity_id} style={{ padding:0, overflow:'hidden', cursor:'pointer' }}>
              {(ed.foto_copertina_url || ed.foto_url) ? (
                <img
                  src={ed.foto_copertina_url || ed.foto_url}
                  alt={ed.titolo}
                  style={{ width:'100%', height:'160px', objectFit:'cover', display:'block' }}
                />
              ) : (
                <div style={{ width:'100%', height:'120px', background:'#630E33', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ color:'#fff', fontSize:'13px', fontWeight:500, letterSpacing:'0.05em' }}>MADE EVENTS</span>
                </div>
              )}
              <div style={{ padding:'16px' }}>
                <div style={{ fontSize:'14px', fontWeight:600, marginBottom:'6px' }}>{ed.titolo || 'Evento'}</div>
                {ed.data_inizio && (
                  <div style={{ fontSize:'12px', color:COLORS.textSecondary, marginBottom:'2px' }}>
                    {new Date(ed.data_inizio).toLocaleDateString('it-IT',{dateStyle:'medium'})}
                  </div>
                )}
                {ed.citta && (
                  <div style={{ fontSize:'12px', color:COLORS.textSecondary, marginBottom:'8px' }}>{ed.citta}</div>
                )}
                {ed.compenso && (
                  <div style={{ fontSize:'12px', color:COLORS.success, fontWeight:500, marginBottom:'8px' }}>{ed.compenso}</div>
                )}
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  <button
                    onClick={() => setSelected(ev)}
                    style={{
                      flex:1, padding:'7px 12px', fontSize:'12px', fontWeight:500,
                      border:`1px solid ${COLORS.border}`, borderRadius:'4px',
                      background:'none', cursor:'pointer', fontFamily:'Montserrat,sans-serif',
                      color:COLORS.text,
                    }}
                  >
                    Vedi dettagli
                  </button>
                  {applied ? (
                    <span style={{
                      flex:1, padding:'7px 12px', fontSize:'12px', fontWeight:500,
                      background:'#E8F5E9', color:'#2E7D32', borderRadius:'4px',
                      textAlign:'center', border:'1px solid #C8E6C9',
                    }}>
                      Candidato
                    </span>
                  ) : (
                    <button
                      onClick={() => apply(ev.entity_id, '')}
                      disabled={applying === ev.entity_id}
                      style={{
                        flex:1, padding:'7px 12px', fontSize:'12px', fontWeight:500,
                        background:'#630E33', color:'#fff', border:'none', borderRadius:'4px',
                        cursor: applying === ev.entity_id ? 'wait' : 'pointer',
                        fontFamily:'Montserrat,sans-serif',
                      }}
                    >
                      {applying === ev.entity_id ? '...' : 'Candidati'}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {selected && (
        <EventDetailDrawer
          event={selected}
          onClose={() => setSelected(null)}
          onApply={apply}
          applying={applying === selected.entity_id}
          alreadyApplied={appliedEventIds.has(selected.entity_id)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// LE MIE CANDIDATURE
// ---------------------------------------------------------------------------

function MyApplications({ handleApiResponse }) {
  const [apps,    setApps]    = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = handleApiResponse(await applicationApi.list())
    setLoading(false)
    if (res.success) setApps(res.data?.items ?? [])
  }, [handleApiResponse])

  useEffect(() => { load() }, [load])

  const withdraw = async (entity_id) => {
    if (!window.confirm('Ritirare la candidatura?')) return
    setActionLoading(entity_id)
    const res = handleApiResponse(await applicationApi.withdraw(entity_id))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  if (loading) return <div className="spinner" />
  if (!apps.length) return <div className="empty-state">Nessuna candidatura.</div>

  return (
    <div style={{ overflowX:'auto' }}>
      <table className="data-table">
        <thead>
          <tr><th>Evento / Turno</th><th>Messaggio</th><th>Stato</th><th>Azioni</th></tr>
        </thead>
        <tbody>
          {apps.map(a => (
            <tr key={a.entity_id}>
              <td>{a.data?.event_titolo || a.data?.shift_ruolo || a.data?.shift_id || a.data?.event_id || '—'}</td>
              <td style={{ maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {a.data?.messaggio || '—'}
              </td>
              <td><StatusBadge status={a.status} /></td>
              <td>
                {a.status === 'PENDING' && (
                  <Button
                    size="sm"
                    variant="danger"
                    loading={actionLoading === a.entity_id}
                    onClick={() => withdraw(a.entity_id)}
                  >
                    Ritira
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// I MIEI TURNI (ASSIGNMENT)
// ---------------------------------------------------------------------------

function MyAssignments({ handleApiResponse }) {
  const [assignments, setAssignments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = handleApiResponse(await assignmentApi.list())
    setLoading(false)
    if (res.success) setAssignments(res.data?.items ?? [])
  }, [handleApiResponse])

  useEffect(() => { load() }, [load])

  const checkin = async (entity_id) => {
    setActionLoading(entity_id + '_in')
    let lat = null, lng = null
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((res,rej) => navigator.geolocation.getCurrentPosition(res,rej,{timeout:5000}))
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {}
    }
    const res = handleApiResponse(await assignmentApi.checkin(entity_id, lat, lng))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  const checkout = async (entity_id) => {
    setActionLoading(entity_id + '_out')
    let lat = null, lng = null
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((res,rej) => navigator.geolocation.getCurrentPosition(res,rej,{timeout:5000}))
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {}
    }
    const res = handleApiResponse(await assignmentApi.checkout(entity_id, lat, lng))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  if (loading) return <div className="spinner" />
  if (!assignments.length) return <div className="empty-state">Nessun turno assegnato.</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      {assignments.map(a => (
        <Card key={a.entity_id}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
            <div>
              <div style={{ fontSize:'15px', fontWeight:500, marginBottom:'4px' }}>{a.data?.shift_ruolo ?? 'Turno'}</div>
              <div style={{ fontSize:'13px', color:COLORS.textSecondary }}>
                {a.data?.shift_inizio ? new Date(a.data.shift_inizio).toLocaleString('it-IT',{dateStyle:'medium',timeStyle:'short'}) : '—'}
              </div>
              {a.data?.checkin_ts  && <div style={{ fontSize:'12px', color:COLORS.success, marginTop:'4px'  }}>Check-in: {new Date(a.data.checkin_ts).toLocaleTimeString('it-IT',{timeStyle:'short'})}</div>}
              {a.data?.checkout_ts && <div style={{ fontSize:'12px', color:COLORS.success }}>Check-out: {new Date(a.data.checkout_ts).toLocaleTimeString('it-IT',{timeStyle:'short'})}</div>}
              {a.data?.ore_lavorate !== undefined && <div style={{ fontSize:'12px', color:COLORS.textSecondary }}>Ore lavorate: {a.data.ore_lavorate}</div>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px' }}>
              <StatusBadge status={a.status} />
              {a.status === 'CONFIRMED' && (
                <Button size="sm" loading={actionLoading === a.entity_id + '_in'} onClick={() => checkin(a.entity_id)}>
                  Check-in
                </Button>
              )}
              {a.status === 'CHECKED_IN' && (
                <Button size="sm" variant="secondary" loading={actionLoading === a.entity_id + '_out'} onClick={() => checkout(a.entity_id)}>
                  Check-out
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PROFILO — mirror 1:1 delle 7 sezioni del questionario di registrazione.
// Stessi campi, stesse opzioni: le sezioni 1-6 riusano gli stessi componenti
// Section*Fields del questionario (frontend/src/components/registration/sections/),
// la sezione 7 (Foto Profilo) riusa gli stessi FOTO_FIELDS ma con l'endpoint
// di upload per talent già approvati (document.upload) invece di quello
// pubblico di registrazione (talent.uploadRegistrationDoc).
// ---------------------------------------------------------------------------

function countFilled(checks) {
  return { filled: checks.filter(Boolean).length, total: checks.length }
}

const PROFILE_SECTIONS = [
  { id: 'S1', title: 'Dati Personali',
    completeness: d => countFilled([!!d.genere, !!d.nascita_citta, !!d.nascita_provincia, !!d.residenza_citta, !!d.residenza_provincia, !!(d.domicilio_coincide || d.domicilio_provincia)]) },
  { id: 'S2', title: 'Profilo Fisico',
    completeness: d => {
      const isMale = d.genere === 'M'
      return countFilled([!!d.altezza, !!d.taglia_tshirt, !!d.taglia_pantalone, ...(isMale ? [] : [!!d.taglia_gonna]), !!d.numero_scarpe, !!d.piercing_visibili, !!d.tatuaggi_visibili, ...(d.tatuaggi_visibili === 'Sì' ? [!!d.tatuaggi_dove] : [])])
    } },
  { id: 'S3', title: 'Disponibilità Logistica',
    completeness: d => countFilled([!!d.patente_tipologie?.length, !!d.automunita, !!d.province_lavoro?.length, !!d.disponibilita_trasferte, !!d.disponibilita_weekend, !!d.disponibilita_serali]) },
  { id: 'S4', title: 'Lingue',
    completeness: d => countFilled([!!d.lingua_inglese]) },
  { id: 'S5', title: 'Profilo Professionale',
    completeness: d => countFilled([!!d.titolo_studio, !!d.professione_attuale?.length, !!d.anni_esperienza_settore]) },
  { id: 'S6', title: 'Dotazione Personale',
    completeness: () => countFilled([true]) },
  { id: 'S7', title: 'Foto Profilo',
    completeness: d => countFilled([!!d.foto_busto_url, !!d.foto_intera_url]) },
]

function globalCompleteness(data) {
  // Stessa logica a 7 sezioni pass/fail usata dal badge % in admin/LeadPage.jsx
  // e dalla mail di sollecito (backend/RegistrationFlow.js inviaEmailSollecito).
  const passed = PROFILE_SECTIONS.filter(sec => {
    const r = sec.completeness(data)
    return r.filled === r.total
  }).length
  return Math.round((passed / PROFILE_SECTIONS.length) * 100)
}

function ProgressBar({ pct, height = 6, style }) {
  const color = pct >= 70 ? '#10B981' : pct >= 40 ? '#F97316' : '#EF4444'
  return (
    <div style={{ height, background:'#f0f0f0', borderRadius:height/2, overflow:'hidden', ...style }}>
      <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:height/2, transition:'width 0.3s' }} />
    </div>
  )
}

function PhotoExpiryBadge({ fotoDate }) {
  if (!fotoDate) return <span style={{ fontSize:11, color:COLORS.textSecondary }}>Data caricamento non disponibile</span>
  const upload  = new Date(fotoDate)
  if (isNaN(upload)) return null
  const expiry  = new Date(upload)
  expiry.setMonth(expiry.getMonth() + 6)
  const daysLeft = Math.ceil((expiry - Date.now()) / 86400000)
  const status   = daysLeft < 0 ? 'expired' : daysLeft < 60 ? 'expiring' : 'ok'
  const cfg = {
    expired:  { bg:'#FFEBEE', color:'#C62828', label:`Scadute il ${expiry.toLocaleDateString('it-IT')}` },
    expiring: { bg:'#FFF3E0', color:'#E65100', label:`Scade tra ${daysLeft} giorni` },
    ok:       { bg:'#E8F5E9', color:'#2E7D32', label:`Valide fino al ${expiry.toLocaleDateString('it-IT')}` },
  }[status]
  return (
    <span style={{ fontSize:11, fontWeight:600, background:cfg.bg, color:cfg.color, padding:'3px 10px', borderRadius:10 }}>
      {cfg.label}
    </span>
  )
}

const SECTION_FIELDS_COMPONENT = {
  S1: Section1Fields,
  S2: Section2Fields,
  S3: Section3Fields,
  S4: Section4Fields,
  S5: Section5Fields,
  S6: Section6Fields,
}

function SectionCardShell({ sec, filled, total, children }) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0
  return (
    <div style={{ background:'#fff', border:`1px solid ${COLORS.border}`, borderRadius:8, padding:'20px', marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:COLORS.text }}>
          {sec.id} — {sec.title}
        </div>
        <span style={{ fontSize:11, color:COLORS.textSecondary }}>{filled}/{total}</span>
      </div>
      <ProgressBar pct={pct} style={{ marginBottom:16 }} />
      {children}
    </div>
  )
}

// Sezioni 1-6: stessi componenti campo del questionario, alimentati con lo
// stato locale del form dell'area riservata.
function SectionCard({ sec, form, onChange }) {
  const { filled, total } = sec.completeness(form)
  const Fields = SECTION_FIELDS_COMPONENT[sec.id]
  return (
    <SectionCardShell sec={sec} filled={filled} total={total}>
      <Fields data={form} onChange={onChange} errors={{}} />
    </SectionCardShell>
  )
}

// Sezione 7 — Foto Profilo: stessi FOTO_FIELDS/criteri del questionario, ma
// l'upload va su document.upload (endpoint per talent già approvati) invece
// di talent.uploadRegistrationDoc (endpoint pubblico pre-approvazione).
function FotoProfiloCard({ sec, form, onChange, talentProfileId, handleApiResponse }) {
  const { filled, total } = sec.completeness(form)
  const [uploadState, setUploadState]   = useState({})
  const [uploadErrors, setUploadErrors] = useState({})

  async function handleFile(fieldKey, { base64, filename, mimeType }) {
    setUploadState(prev => ({ ...prev, [fieldKey]: 'uploading' }))
    setUploadErrors(prev => ({ ...prev, [fieldKey]: null }))
    const res = handleApiResponse(await documentApi.upload(talentProfileId, fieldKey, base64, filename, mimeType))
    if (!res.success) {
      setUploadState(prev => ({ ...prev, [fieldKey]: 'error' }))
      setUploadErrors(prev => ({ ...prev, [fieldKey]: getErrorMessage(res.error) }))
      return
    }
    setUploadState(prev => ({ ...prev, [fieldKey]: 'done' }))
    onChange(`${fieldKey}_url`, res.data?.url)
  }

  function handleClear(fieldKey) {
    setUploadState(prev => ({ ...prev, [fieldKey]: undefined }))
    onChange(`${fieldKey}_url`, '')
  }

  return (
    <SectionCardShell sec={sec} filled={filled} total={total}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '4px',
        padding: '14px 18px', marginBottom: '20px',
      }}>
        <p style={{ fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500, color: COLORS.textSecondary, marginBottom: '10px' }}>
          Criteri di non accettazione
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {CRITERI_NON_ACCETTAZIONE.map(c => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: COLORS.textSecondary }}>
              <span style={{ color: COLORS.error, fontWeight: 600, flexShrink: 0 }}>✗</span> {c}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {Object.entries(FOTO_FIELDS).map(([fieldKey, cfg]) => (
          <div key={fieldKey}>
            <FileUpload
              label={cfg.label}
              accept={cfg.accept}
              maxMB={cfg.maxMB}
              required={cfg.required}
              uploaded={uploadState[fieldKey] === 'done' || !!form[`${fieldKey}_url`]}
              uploadedUrl={form[`${fieldKey}_url`]}
              onFile={fileData => handleFile(fieldKey, fileData)}
              onClear={() => handleClear(fieldKey)}
              error={uploadErrors[fieldKey]}
              hint={cfg.hint}
            />
            {uploadState[fieldKey] === 'uploading' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '1.5px' }} />
                <span style={{ fontSize: '12px', color: COLORS.textSecondary }}>Caricamento in corso…</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {form.foto_busto_url && (
        <div style={{ marginTop: 16 }}>
          <PhotoExpiryBadge fotoDate={form.foto_caricata_il} />
        </div>
      )}
      {form.cv_url && (
        <div style={{ marginTop: 8 }}>
          <a href={form.cv_url} target="_blank" rel="noreferrer" style={{ color:COLORS.accent, fontSize:13, fontWeight:500, textDecoration:'none' }}>
            Apri CV →
          </a>
        </div>
      )}
    </SectionCardShell>
  )
}

function MyProfile({ handleApiResponse }) {
  const [profile,  setProfile]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState({})
  const [pending,  setPending]  = useState(false)

  useEffect(() => {
    (async () => {
      const res = handleApiResponse(await talentApi.list())
      setLoading(false)
      if (res.success && res.data?.items?.length) {
        const p = res.data.items[0]
        setProfile(p)
        // Stessi nomi campo del questionario in entrambe le direzioni — nessuna
        // trasformazione necessaria, il form è un mirror diretto di profile.data.
        setForm({ ...(p.data ?? {}) })
        setPending(p.status === 'PENDING_REVIEW')
      }
    })()
  }, [handleApiResponse])

  const onChange = useCallback((key, value) => {
    setForm(f => ({ ...f, [key]: value }))
  }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!profile?.entity_id) return
    setSaving(true)
    const payload = { entity_id: profile.entity_id, ...form }
    const res = handleApiResponse(await talentApi.updateProfile(payload))
    setSaving(false)
    if (!res.success) {
      alert(getErrorMessage(res.error))
    } else {
      setPending(true)
      setProfile(p => ({ ...p, status: 'PENDING_REVIEW' }))
    }
  }

  if (loading) return <div className="spinner" />
  if (!profile) return (
    <div className="info-banner">
      Profilo talent non trovato. Se hai già completato la registrazione, contatta l&apos;agenzia.
      <br />
      <a href="/registrazione/completa" style={{ color:COLORS.accent, fontWeight:600, marginTop:'8px', display:'inline-block' }}>
        Completa la registrazione →
      </a>
    </div>
  )

  const d   = profile.data ?? {}
  const pct = globalCompleteness(form)

  return (
    <form onSubmit={save}>
      {/* Header: avatar + global progress */}
      <Card style={{ marginBottom:16, padding:'20px' }}>
        <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
          {d.foto_busto_url ? (
            <img src={driveThumbUrl(d.foto_busto_url, 128)} alt={d.nome} style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:`2px solid ${COLORS.border}`, flexShrink:0 }} />
          ) : (
            <div style={{ width:64, height:64, borderRadius:'50%', background:'#630E33', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, color:'#fff', fontWeight:700, flexShrink:0 }}>
              {(d.nome?.[0] ?? '?').toUpperCase()}
            </div>
          )}
          <div style={{ flex:'1 1 160px', minWidth:0 }}>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis' }}>{d.nome} {d.cognome}</div>
            <div style={{ fontSize:12, color:COLORS.textSecondary, marginBottom:6, overflow:'hidden', textOverflow:'ellipsis' }}>{d.email_contatto}</div>
            <StatusBadge status={profile.status} />
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:22, fontWeight:300, color: pct >= 70 ? '#10B981' : pct >= 40 ? '#F97316' : '#EF4444' }}>{pct}%</div>
            <div style={{ fontSize:10, color:COLORS.textSecondary }}>completato</div>
          </div>
        </div>
        <ProgressBar pct={pct} height={8} />
      </Card>

      {pending && (
        <div style={{
          background:'#FFFDE7', border:'1px solid #F9A825', borderRadius:8,
          padding:'12px 16px', marginBottom:16, fontSize:13, color:'#E65100', fontWeight:500,
        }}>
          Modifiche inviate — in attesa di approvazione admin.
        </div>
      )}

      {pct < 100 && (
        <div style={{
          background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 8,
          padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
          <span style={{ fontSize: 13, color: '#5D4037', lineHeight: 1.6 }}>
            Completa tutte le sezioni del tuo profilo per poter ricevere offerte di lavoro.
          </span>
        </div>
      )}

      {PROFILE_SECTIONS.map(sec => (
        sec.id === 'S7'
          ? <FotoProfiloCard key={sec.id} sec={sec} form={form} onChange={onChange} talentProfileId={profile.entity_id} handleApiResponse={handleApiResponse} />
          : <SectionCard key={sec.id} sec={sec} form={form} onChange={onChange} />
      ))}

      <div style={{ paddingBottom:32 }}>
        <Button type="submit" loading={saving}>Salva Modifiche</Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

export default function UserPortal() {
  const { handleApiResponse } = useAuth()

  return (
    <Layout sidebarItems={SIDEBAR_ITEMS}>
      <h1 style={{ ...COMPONENT_STYLES.sectionTitle }}>Il Mio Portale</h1>

      <div id="events">
        <SectionTitle>Offerte di Lavoro</SectionTitle>
        <AvailableEvents handleApiResponse={handleApiResponse} />
      </div>

      <div id="applications">
        <SectionTitle>Le Mie Candidature</SectionTitle>
        <MyApplications handleApiResponse={handleApiResponse} />
      </div>

      <div id="assignments">
        <SectionTitle>I Miei Turni</SectionTitle>
        <MyAssignments handleApiResponse={handleApiResponse} />
      </div>

      <div id="profile">
        <SectionTitle>Il Mio Profilo</SectionTitle>
        <MyProfile handleApiResponse={handleApiResponse} />
      </div>
    </Layout>
  )
}
