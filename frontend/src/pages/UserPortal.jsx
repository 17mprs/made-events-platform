// === USER PORTAL — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  eventApi, applicationApi, assignmentApi, talentApi, documentApi, shiftApi, contractApi,
  getErrorMessage,
} from '../api/client'
import { PdfPreviewModal, contractErrorText, fmtDateTime, daysLeft } from '../components/ContractPanel'
import { COLORS, COMPONENT_STYLES, LETTER_SPACING } from '../styles/theme'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Card   from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import Input from '../components/Input'
import FileUpload from '../components/registration/FileUpload'
import CropModal from '../components/registration/CropModal'
import { Section1Fields } from '../components/registration/sections/Section1'
import { Section2Fields } from '../components/registration/sections/Section2'
import { Section3Fields } from '../components/registration/sections/Section3'
import { Section4Fields } from '../components/registration/sections/Section4'
import { Section5Fields } from '../components/registration/sections/Section5'
import { Section6Fields } from '../components/registration/sections/Section6'
import { FOTO_FIELDS, CRITERI_NON_ACCETTAZIONE, FOTO_CROP_ASPECT } from '../components/registration/questionnaireOptions'

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
  { label:'Contratti',          to:'/portale#contracts' },
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

function EventDetailDrawer({ event, shifts = [], onClose, onApply, applying, alreadyApplied }) {
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

        {shifts.length > 0 && (
          <div>
            <div style={{ fontSize:'12px', fontWeight:600, color:COLORS.textSecondary, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>
              Turni
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {shifts.map(shift => {
                const sd = shift.data ?? {}
                let dataLabel = sd.data || ''
                const parsed = sd.data ? new Date(sd.data) : null
                if (parsed && !isNaN(parsed.getTime())) {
                  dataLabel = parsed.toLocaleDateString('it-IT', { dateStyle: 'medium' })
                }
                return (
                  <div key={shift.entity_id} style={{ border:`1px solid ${COLORS.border}`, borderRadius:'6px', padding:'10px 12px' }}>
                    {sd.ruolo && (
                      <div style={{ fontSize:'13px', fontWeight:600, marginBottom:'2px' }}>{sd.ruolo}</div>
                    )}
                    <div style={{ fontSize:'12px', color:COLORS.text }}>
                      {dataLabel && <span>{dataLabel}</span>}
                      {(sd.orario_inizio || sd.orario_fine) && (
                        <span>{dataLabel ? ' · ' : ''}{sd.orario_inizio || '?'} – {sd.orario_fine || '?'}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
  const [selectedShifts, setSelectedShifts] = useState([])

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
                    onClick={() => {
                      setSelected(ev)
                      setSelectedShifts([])
                      shiftApi.list({ event_id: ev.entity_id })
                        .then(res => setSelectedShifts(res?.data?.items || []))
                        .catch(() => setSelectedShifts([]))
                    }}
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
          shifts={selectedShifts}
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
              {a.status === 'AWAITING_SIGNATURE' && (
                <a href="#contracts" style={{ fontSize:'12px', color:COLORS.accent }}>Firma il contratto per confermare</a>
              )}
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
// CONTRATTI — lettura, firma con codice via email, rifiuto
// ---------------------------------------------------------------------------

// Clausole da approvare specificamente (doppia sottoscrizione). L'elenco numerico è da
// confermare col consulente legale: va allineato agli articoli del template Doc del contratto.
const CLAUSOLE_SPECIFICHE = '4, 10 e 13'
const CODE_COOLDOWN_MS = 60 * 1000   // stessa attesa applicata dal backend tra due richieste di codice

function talentContractMeta(c) {
  if (c.stato === 'SENT') {
    if (c.scaduto) return { label: 'Scaduto', bg: '#FEF2F2', color: '#B91C1C' }
    const n = daysLeft(c.expires_at)
    return { label: n !== null && n <= 0 ? 'Da firmare · scade oggi' : `Da firmare${n !== null ? ` · scade tra ${n} ${n === 1 ? 'giorno' : 'giorni'}` : ''}`, bg: '#FFF7ED', color: '#C2410C' }
  }
  if (c.stato === 'SIGNED')   return { label: 'Firmato',   bg: '#F0FDF4', color: '#15803D' }
  if (c.stato === 'DECLINED') return { label: 'Rifiutato', bg: '#FEF2F2', color: '#B91C1C' }
  if (c.stato === 'EXPIRED')  return { label: 'Scaduto',   bg: '#F3F4F6', color: '#6B7280' }
  return { label: c.stato, bg: '#F3F4F6', color: '#4B5563' }
}

function ContractCard({ c, handleApiResponse, onChanged, onPreview, notify }) {
  const [code, setCode]           = useState('')
  const [agree1, setAgree1]       = useState(false)
  const [agree2, setAgree2]       = useState(false)
  const [busy, setBusy]           = useState(null)      // 'code' | 'accept' | 'decline' | 'pdf'
  const [codeSent, setCodeSent]   = useState(false)
  const [until, setUntil]         = useState(0)         // fine dell'attesa per un nuovo codice
  const [, tick]                  = useState(0)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason]       = useState('')
  const [err, setErr]             = useState(null)

  useEffect(() => {
    if (until <= Date.now()) return undefined
    const id = setInterval(() => { tick(n => n + 1); if (Date.now() >= until) clearInterval(id) }, 1000)
    return () => clearInterval(id)
  }, [until])

  const meta = talentContractMeta(c)
  const canSign = c.stato === 'SENT' && !c.scaduto
  const wait = Math.max(0, Math.ceil((until - Date.now()) / 1000))
  const codeOk = /^\d{6}$/.test(code)
  const ev = c.evento || {}, tr = c.turno || {}

  async function openPdf() {
    setBusy('pdf'); setErr(null)
    const res = handleApiResponse(await contractApi.get(c.entity_id))
    setBusy(null)
    if (res.success && res.data?.pdf_base64) {
      onPreview({ pdfBase64: res.data.pdf_base64, filename: c.filename || 'Contratto.pdf', title: ev.titolo ? `Contratto — ${ev.titolo}` : 'Contratto' })
    } else {
      setErr(contractErrorText(res.error, 'talent'))
    }
  }

  async function requestCode() {
    setBusy('code'); setErr(null)
    const res = handleApiResponse(await contractApi.requestCode(c.entity_id))
    setBusy(null)
    if (res.success) {
      setCodeSent(true); setUntil(Date.now() + CODE_COOLDOWN_MS)
    } else {
      if (res.error?.code === 'CT_CODE_WAIT') setUntil(Date.now() + CODE_COOLDOWN_MS)
      setErr(contractErrorText(res.error, 'talent'))
    }
  }

  async function accept() {
    setBusy('accept'); setErr(null)
    const res = handleApiResponse(await contractApi.accept({
      entity_id: c.entity_id, codice: code,
      accetta_contratto: agree1, accetta_clausole_specifiche: agree2,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    }))
    setBusy(null)
    if (res.success) {
      notify({ ok: true, text: res.data?.already_signed ? 'Questo contratto risultava già firmato.' : 'Contratto firmato: il tuo incarico è confermato.' })
      onChanged()
      return
    }
    const k = res.error?.code
    if (k === 'CT_CODE_LOCKED' || k === 'CT_CODE_EXPIRED' || k === 'CT_CODE_REQUIRED' || (k === 'CT_CODE_INVALID' && /esauriti/.test(res.error.message))) {
      setCode(''); setCodeSent(false)
    }
    setErr(k === 'SYS_002' ? 'Questo contratto non è più disponibile: contatta il team.' : contractErrorText(res.error, 'talent'))
  }

  async function decline() {
    setBusy('decline'); setErr(null)
    const res = handleApiResponse(await contractApi.decline(c.entity_id, reason.trim()))
    setBusy(null)
    if (res.success) {
      notify({ ok: true, text: 'Hai rifiutato il contratto: la candidatura è stata ritirata.' })
      onChanged()
    } else {
      setErr(res.error?.code === 'SYS_002' ? 'Questo contratto non è più disponibile: contatta il team.' : contractErrorText(res.error, 'talent'))
    }
  }

  return (
    <Card>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ fontSize:'15px', fontWeight:500, marginBottom:'4px' }}>{ev.titolo || 'Contratto'}</div>
          <div style={{ fontSize:'13px', color:COLORS.textSecondary }}>
            {tr.data ? new Date(tr.data).toLocaleDateString('it-IT', { dateStyle:'medium' }) : ''}
            {tr.orario_inizio ? ` · ${tr.orario_inizio}${tr.orario_fine ? `–${tr.orario_fine}` : ''}` : ''}
            {ev.luogo ? ` · ${ev.luogo}` : ''}
          </div>
          {c.stato === 'SENT' && <div style={{ fontSize:'12px', color:COLORS.textSecondary, marginTop:4 }}>Da firmare entro il {fmtDateTime(c.expires_at)}</div>}
          {c.stato === 'SIGNED' && <div style={{ fontSize:'12px', color:'#15803D', marginTop:4 }}>Firmato il {fmtDateTime(c.accepted_at || c.signed_at)} · incarico confermato</div>}
          {c.stato === 'DECLINED' && <div style={{ fontSize:'12px', color:COLORS.textSecondary, marginTop:4 }}>Rifiutato il {fmtDateTime(c.declined_at)}</div>}
          {c.stato === 'EXPIRED' && <div style={{ fontSize:'12px', color:COLORS.textSecondary, marginTop:4 }}>Non firmato entro la scadenza: contatta il team se sei ancora disponibile.</div>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px' }}>
          <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:12, fontSize:11, fontWeight:600, letterSpacing:'0.4px', background:meta.bg, color:meta.color, whiteSpace:'nowrap' }}>{meta.label}</span>
          {(c.stato === 'SENT' || c.stato === 'SIGNED') && !c.scaduto && (
            <Button size="sm" variant="secondary" loading={busy === 'pdf'} onClick={openPdf}>Apri il contratto (PDF)</Button>
          )}
        </div>
      </div>

      {canSign && (
        <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${COLORS.border}` }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Firma il contratto</div>

          <div style={{ fontSize:13, marginBottom:6 }}>1. Richiedi il codice di firma: lo riceverai via email (valido 10 minuti).</div>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
            <Button size="sm" variant="secondary" loading={busy === 'code'} disabled={wait > 0} onClick={requestCode}>
              {codeSent ? 'Invia un nuovo codice' : 'Invia il codice via email'}
            </Button>
            {wait > 0 && <span style={{ fontSize:12, color:COLORS.textSecondary }}>Puoi chiedere un nuovo codice tra {wait} s</span>}
            {codeSent && wait === 0 && <span style={{ fontSize:12, color:COLORS.textSecondary }}>Controlla la tua casella email.</span>}
            {codeSent && wait > 0 && <span style={{ fontSize:12, color:'#15803D' }}>Codice inviato: controlla la tua casella email.</span>}
          </div>

          <div style={{ fontSize:13, marginBottom:6 }}>2. Inserisci il codice di 6 cifre.</div>
          <div style={{ maxWidth:200, marginBottom:14 }}>
            <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" />
          </div>

          <div style={{ fontSize:13, marginBottom:6 }}>3. Conferma.</div>
          <label style={{ display:'flex', gap:8, alignItems:'flex-start', fontSize:13, marginBottom:8, cursor:'pointer' }}>
            <input type="checkbox" checked={agree1} onChange={e => setAgree1(e.target.checked)} style={{ marginTop:3, accentColor:COLORS.accent }} />
            <span>Ho letto e accetto il contratto.</span>
          </label>
          <label style={{ display:'flex', gap:8, alignItems:'flex-start', fontSize:13, marginBottom:14, cursor:'pointer' }}>
            <input type="checkbox" checked={agree2} onChange={e => setAgree2(e.target.checked)} style={{ marginTop:3, accentColor:COLORS.accent }} />
            <span>Accetto specificamente le clausole {CLAUSOLE_SPECIFICHE} del contratto.</span>
          </label>

          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
            <Button loading={busy === 'accept'} disabled={!agree1 || !agree2 || !codeOk || !!busy} onClick={accept}>Accetta e conferma incarico</Button>
            {!declining && <Button variant="secondary" disabled={!!busy} onClick={() => setDeclining(true)}>Rifiuta</Button>}
          </div>

          {declining && (
            <div style={{ marginTop:14, padding:12, border:`1px solid ${COLORS.border}`, borderRadius:8 }}>
              <div style={{ fontSize:13, marginBottom:8 }}>Se rifiuti, la candidatura viene ritirata e il posto torna libero. Motivo (facoltativo):</div>
              <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={2}
                style={{ width:'100%', boxSizing:'border-box', border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'8px 10px', fontSize:13, fontFamily:'inherit', marginBottom:8 }} />
              <div style={{ display:'flex', gap:8 }}>
                <Button size="sm" loading={busy === 'decline'} disabled={!!busy} onClick={decline}>Conferma il rifiuto</Button>
                <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => { setDeclining(false); setReason('') }}>Indietro</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {err && <div style={{ marginTop:12, padding:'8px 12px', background:'#FFEBEE', borderRadius:6, fontSize:12, color:'#C62828' }}>{err}</div>}
    </Card>
  )
}

function MyContracts({ handleApiResponse }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]         = useState(null)
  const [preview, setPreview] = useState(null)

  const load = useCallback(async () => {
    const res = handleApiResponse(await contractApi.list())
    setLoading(false)
    if (res.success) setItems(res.data?.items ?? [])
    else setMsg({ ok: false, text: contractErrorText(res.error, 'talent') })
  }, [handleApiResponse])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="spinner" />
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      {msg && <div style={{ padding:'8px 12px', borderRadius:6, fontSize:13, background: msg.ok ? '#E8F5E9' : '#FFEBEE', color: msg.ok ? '#2E7D32' : '#C62828' }}>{msg.text}</div>}
      {items.length === 0 ? (
        <div className="empty-state">Nessun contratto: quando una candidatura viene approvata, il contratto da firmare compare qui.</div>
      ) : items.map(c => (
        <ContractCard key={c.entity_id} c={c} handleApiResponse={handleApiResponse}
          onChanged={load} onPreview={setPreview} notify={setMsg} />
      ))}
      {preview && <PdfPreviewModal {...preview} onClose={() => setPreview(null)} />}
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

function isValidCodiceFiscale(v) {
  return /^[A-Z0-9]{16}$/.test(String(v || '').toUpperCase())
}
function isValidPartitaIva(v) {
  if (!v) return true // opzionale
  return /^\d{11}$/.test(String(v))
}
// Formato generale IBAN (qualunque paese): la lunghezza per paese e il checksum
// mod 97 li verifica il backend (talent.updateFiscal).
function isValidIban(v) {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(String(v || '').toUpperCase().replace(/\s/g, ''))
}

const PROFILE_SECTIONS = [
  { id: 'S1', title: 'Dati Personali',
    completeness: d => countFilled([!!d.genere, !!d.nascita_citta, !!d.nascita_provincia, !!d.data_nascita, !!d.residenza_citta, !!d.residenza_provincia, !!(d.domicilio_coincide || d.domicilio_provincia)]) },
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
  { id: 'S8', title: 'Dati Fiscali e Bancari',
    completeness: d => countFilled([isValidCodiceFiscale(d.codice_fiscale), isValidIban(d.iban), !!d.disponibile_chiamata, !!d.disponibile_ritenuta]) },
  { id: 'S9', title: 'Documenti',
    completeness: d => countFilled([!!d.doc_identita_url, !!d.doc_cf_url, !!d.cv_url]) },
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

function MissingFieldBanner({ children }) {
  return (
    <div style={{ background:'#630E33', color:'#fff', borderRadius:6, padding:'10px 14px', marginBottom:16, fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
      {children}
    </div>
  )
}

function SectionCardShell({ sec, filled, total, banner, children }) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0
  return (
    <div id={sec.id} style={{ background:'#fff', border:`1px solid ${COLORS.border}`, borderRadius:8, padding:'20px', marginBottom:16, scrollMarginTop:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:COLORS.text }}>
          {sec.id} — {sec.title}
        </div>
        <span style={{ fontSize:11, color:COLORS.textSecondary }}>{filled}/{total}</span>
      </div>
      <ProgressBar pct={pct} style={{ marginBottom:16 }} />
      {banner}
      {children}
    </div>
  )
}

// Sezioni 1-6: stessi componenti campo del questionario, alimentati con lo
// stato locale del form dell'area riservata.
function SectionCard({ sec, form, onChange }) {
  const { filled, total } = sec.completeness(form)
  const Fields = SECTION_FIELDS_COMPONENT[sec.id]
  const missingNascita = sec.id === 'S1' && !form.data_nascita
  const banner = missingNascita ? (
    <MissingFieldBanner>⚠️ Data di nascita mancante — completa ora per il tuo profilo</MissingFieldBanner>
  ) : null
  return (
    <SectionCardShell sec={sec} filled={filled} total={total} banner={banner}>
      <Fields data={form} onChange={onChange} errors={{}} highlightMissing={missingNascita} />
    </SectionCardShell>
  )
}

// Sezione 7 — Foto Profilo: stessi FOTO_FIELDS/criteri del questionario, ma
// l'upload va su document.upload (endpoint per talent già approvati) invece
// di talent.uploadRegistrationDoc (endpoint pubblico pre-approvazione).
// FOTO_CROP_ASPECT condiviso con Section7.jsx via questionnaireOptions.

function FotoProfiloCard({ sec, form, onChange, talentProfileId, handleApiResponse }) {
  const { filled, total } = sec.completeness(form)
  const [uploadState, setUploadState]   = useState({})
  const [uploadErrors, setUploadErrors] = useState({})
  const [cropModal, setCropModal] = useState({ isOpen: false, file: null, aspect: null, fieldKey: null, filename: null })

  async function uploadFile(fieldKey, base64, filename, mimeType) {
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

  function handleFile(fieldKey, { file, base64, filename, mimeType }) {
    const aspect = FOTO_CROP_ASPECT[fieldKey]
    if (aspect) {
      setCropModal({ isOpen: true, file, aspect, fieldKey, filename })
      return
    }
    uploadFile(fieldKey, base64, filename, mimeType)
  }

  function handleClear(fieldKey) {
    setUploadState(prev => ({ ...prev, [fieldKey]: undefined }))
    onChange(`${fieldKey}_url`, '')
  }

  function handleCropConfirm(base64DataUrl) {
    const { fieldKey, filename } = cropModal
    setCropModal({ isOpen: false, file: null, aspect: null, fieldKey: null, filename: null })
    const base64 = base64DataUrl.split(',')[1]
    const croppedFilename = filename.replace(/\.\w+$/, '') + '.jpg'
    uploadFile(fieldKey, base64, croppedFilename, 'image/jpeg')
  }

  function handleCropCancel() {
    setCropModal({ isOpen: false, file: null, aspect: null, fieldKey: null, filename: null })
  }

  const missingFoto = !form.foto_busto_url || !form.foto_intera_url
  const banner = missingFoto ? (
    <MissingFieldBanner>⚠️ Foto mancante — carica busto e figura intera per completare il profilo</MissingFieldBanner>
  ) : null

  return (
    <SectionCardShell sec={sec} filled={filled} total={total} banner={banner}>
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
              highlight={cfg.required && !form[`${fieldKey}_url`]}
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

      <CropModal
        isOpen={cropModal.isOpen}
        imageFile={cropModal.file}
        aspect={cropModal.aspect}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </SectionCardShell>
  )
}

// Sezione 8 — Dati Fiscali e Bancari: campi ex-questionario rimossi dalla
// registrazione (mai raccolti da nessuna sezione). Salvataggio indipendente
// dal form principale — chiama talent.updateProfile solo con questi 5 campi,
// perché sono dati sensibili che l'utente deve poter confermare a parte.
function FiscalRadioGroup({ label, name, value, onChange, error }) {
  return (
    <div>
      <label style={COMPONENT_STYLES.label}>{label} *</label>
      <div style={{ display:'flex', gap:20, marginTop:4 }}>
        {['Sì', 'No'].map(opt => (
          <label key={opt} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, color:COLORS.text }}>
            <input
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              style={{ accentColor: COLORS.accent }}
            />
            {opt}
          </label>
        ))}
      </div>
      {error && <p style={{ fontSize:12, color:COLORS.error, marginTop:4 }}>{error}</p>}
    </div>
  )
}

// Barra "Dati contratto": valori calcolati dal backend (contractDataCompleteness_),
// così coincidono con quelli della modale contratto. Non incide sulla % del profilo.
function ContractDataBar({ data }) {
  if (!data) return null
  return (
    <div style={{ marginBottom:20, padding:'12px 14px', background:'#F8F8FB', borderRadius:8, border:`1px solid ${COLORS.border}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:600, marginBottom:6 }}>
        <span>Dati contratto: {data.pct}%</span>
        {data.pct === 100 && <span style={{ color:'#10B981' }}>✓ Completi</span>}
      </div>
      <ProgressBar pct={data.pct} />
      {data.mancanti.length > 0 && (
        <div style={{ marginTop:8, fontSize:12, color:COLORS.textSecondary }}>Da completare: {data.mancanti.map(m => m.label).join(', ')}</div>
      )}
    </div>
  )
}

// Campi salvati da S8 con talent.updateFiscal (scrittura diretta, validata dal backend).
const FISCALE_SAVE_FIELDS = [
  'codice_fiscale', 'partita_iva', 'iban', 'intestatario_conto', 'regime_fiscale',
  'disponibile_chiamata', 'disponibile_ritenuta',
  'residenza_indirizzo', 'numero_documento', 'tipo_documento', 'scadenza_documento', 'stato_emissione_documento',
]
// Dati documento verificati dal team: sola lettura quando dati_documento_verificati è attivo.
const DOC_LOCKED_FIELDS = ['residenza_indirizzo', 'numero_documento', 'tipo_documento', 'scadenza_documento']
const REGIMI_FISCALI = [
  { value: 'occasionale', label: "Prestazione occasionale (ritenuta d'acconto)" },
  { value: 'forfettario', label: 'Partita IVA — regime forfettario' },
  { value: 'ordinario',   label: 'Partita IVA — regime ordinario' },
]
const TIPI_DOCUMENTO = [
  { value: 'carta_identita', label: "Carta d'identità" },
  { value: 'passaporto',     label: 'Passaporto' },
  { value: 'patente',        label: 'Patente' },
  { value: 'permesso',       label: 'Permesso di soggiorno' },
]

// data_nascita nel Sheet è GG/MM/AAAA; l'input date lavora in AAAA-MM-GG.
function isoToItalianDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
function italianDateToIso(it) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(it || '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

function SelectField({ label, value, onChange, options, error, disabled, helper }) {
  return (
    <div style={{ width:'100%' }}>
      <label style={COMPONENT_STYLES.label}>{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{ ...COMPONENT_STYLES.input, borderColor: error ? COLORS.error : COLORS.border, background: disabled ? '#f5f5f5' : '#fff' }}
      >
        <option value="">— seleziona —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span style={{ fontSize:12, color:COLORS.error, marginTop:4, display:'block' }}>{error}</span>}
      {!error && helper && <span style={{ fontSize:12, color:COLORS.textSecondary, marginTop:4, display:'block' }}>{helper}</span>}
    </div>
  )
}

function FiscaleCard({ sec, form, onChange, handleApiResponse, contractData, onContractData }) {
  const { filled, total } = sec.completeness(form)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [errors, setErrors] = useState({})
  // Data e città di nascita: mostrate solo se mancanti al momento dell'apertura.
  const [showBirthDate] = useState(() => !form.data_nascita)
  const [showBirthCity] = useState(() => !form.nascita_citta)
  const showBirth = showBirthDate || showBirthCity
  const verified = form.dati_documento_verificati === true
  const locked = f => verified && !!form[f]
  const today = new Date().toISOString().slice(0, 10)

  // Intestatario precompilato col nome del talent finché il campo non è mai stato valorizzato
  // (undefined = mai salvato; '' = svuotato dall'utente). Si salva col pulsante.
  const nomeTalent = [form.nome, form.cognome].filter(Boolean).join(' ')
  const intestatario = form.intestatario_conto === undefined ? nomeTalent : form.intestatario_conto

  function validate() {
    const e = {}
    if (!isValidCodiceFiscale(form.codice_fiscale)) e.codice_fiscale = 'Codice fiscale non valido (16 caratteri alfanumerici)'
    if (!isValidPartitaIva(form.partita_iva)) e.partita_iva = 'Partita IVA non valida (11 cifre)'
    if ((form.regime_fiscale === 'forfettario' || form.regime_fiscale === 'ordinario') && !form.partita_iva) {
      e.partita_iva = 'Obbligatoria per il regime scelto'
    }
    if (!isValidIban(form.iban)) e.iban = 'IBAN non valido (codice paese + cifre, senza simboli)'
    if (!form.disponibile_chiamata) e.disponibile_chiamata = 'Campo obbligatorio'
    if (!form.disponibile_ritenuta) e.disponibile_ritenuta = 'Campo obbligatorio'
    if (form.scadenza_documento && form.scadenza_documento < today && !locked('scadenza_documento')) {
      e.scadenza_documento = 'Documento scaduto'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    setSaved(false)
    const payload = {}
    FISCALE_SAVE_FIELDS.forEach(f => { if (form[f] !== undefined && form[f] !== null) payload[f] = form[f] })
    if (intestatario) payload.intestatario_conto = intestatario
    if (showBirth) {
      if (showBirthDate && form.data_nascita)  payload.data_nascita  = form.data_nascita
      if (showBirthCity && form.nascita_citta) payload.nascita_citta = form.nascita_citta
    }
    const res = handleApiResponse(await talentApi.updateFiscal(payload))
    setSaving(false)
    if (!res.success) {
      // Errore di validazione del backend: mostrato sotto il campo, non in un alert.
      if (res.error?.field) setErrors({ [res.error.field]: res.error.message })
      else alert(res.error?.message || getErrorMessage(res.error))
      return
    }
    setErrors({})
    setSaved(true)
    const td = res.data?.talent
    if (td?.data) {
      // Valori normalizzati dal server (IBAN senza spazi, CF maiuscolo, flag intestatario…).
      [...FISCALE_SAVE_FIELDS, 'data_nascita', 'nascita_citta', 'intestatario_diverso', 'dati_documento_verificati']
        .forEach(f => { if (td.data[f] !== undefined) onChange(f, td.data[f]) })
    }
    if (td?.contract_data) onContractData?.(td.contract_data)
  }

  const intestatarioDiverso = !!form.intestatario_conto && form.intestatario_diverso === true

  return (
    <SectionCardShell sec={sec} filled={filled} total={total}>
      <ContractDataBar data={contractData} />
      <div className="form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
        <Input
          label="Codice Fiscale *"
          value={form.codice_fiscale || ''}
          onChange={e => onChange('codice_fiscale', e.target.value.toUpperCase())}
          maxLength={16}
          placeholder="— non compilato —"
          error={errors.codice_fiscale}
        />
        <SelectField
          label="Regime fiscale"
          value={form.regime_fiscale}
          onChange={v => onChange('regime_fiscale', v)}
          options={REGIMI_FISCALI}
          error={errors.regime_fiscale}
        />
        <Input
          label={form.regime_fiscale === 'forfettario' || form.regime_fiscale === 'ordinario' ? 'Partita IVA *' : 'Partita IVA (opzionale)'}
          value={form.partita_iva || ''}
          onChange={e => onChange('partita_iva', e.target.value)}
          maxLength={11}
          placeholder="— non compilato —"
          error={errors.partita_iva}
        />
        <Input
          label="IBAN *"
          value={form.iban || ''}
          onChange={e => onChange('iban', e.target.value.toUpperCase())}
          maxLength={42}
          placeholder="— non compilato —"
          error={errors.iban}
          helper="Accettiamo IBAN italiani ed esteri (area SEPA). Se lo modifichi, ti avvisiamo via email."
        />
        <Input
          label="Intestatario del conto"
          value={intestatario || ''}
          onChange={e => onChange('intestatario_conto', e.target.value)}
          maxLength={200}
          error={errors.intestatario_conto}
          helper={intestatarioDiverso
            ? 'Intestatario diverso dal tuo nome: il team è stato avvisato.'
            : 'Se è diverso dal tuo nome, avvisiamo il team per un controllo.'}
        />
        <FiscalRadioGroup
          label="Disponibile a chiamata diretta"
          name="disponibile_chiamata"
          value={form.disponibile_chiamata}
          onChange={v => onChange('disponibile_chiamata', v)}
          error={errors.disponibile_chiamata}
        />
        <FiscalRadioGroup
          label="Disponibile a ritenuta d'acconto"
          name="disponibile_ritenuta"
          value={form.disponibile_ritenuta}
          onChange={v => onChange('disponibile_ritenuta', v)}
          error={errors.disponibile_ritenuta}
        />
      </div>

      <div style={{ margin:'28px 0 12px', fontSize:12, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:COLORS.textSecondary }}>
        Documento di identità e residenza
      </div>
      {verified && (
        <p style={{ margin:'0 0 12px', fontSize:12, color:COLORS.textSecondary }}>
          I dati già verificati dal team sono in sola lettura: per modificarli contatta il team.
        </p>
      )}
      <div className="form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
        <Input
          label="Indirizzo di residenza (via e civico)"
          value={form.residenza_indirizzo || ''}
          onChange={e => onChange('residenza_indirizzo', e.target.value)}
          maxLength={200}
          disabled={locked('residenza_indirizzo')}
          error={errors.residenza_indirizzo}
          style={{ gridColumn: '1 / -1' }}
        />
        <SelectField
          label="Tipo documento"
          value={form.tipo_documento}
          onChange={v => onChange('tipo_documento', v)}
          options={TIPI_DOCUMENTO}
          disabled={locked('tipo_documento')}
          error={errors.tipo_documento}
        />
        <Input
          label="Numero documento"
          value={form.numero_documento || ''}
          onChange={e => onChange('numero_documento', e.target.value)}
          maxLength={200}
          disabled={locked('numero_documento')}
          error={errors.numero_documento}
        />
        <Input
          label="Scadenza documento"
          type="date"
          value={form.scadenza_documento || ''}
          min={today}
          onChange={e => onChange('scadenza_documento', e.target.value)}
          disabled={locked('scadenza_documento')}
          error={errors.scadenza_documento}
        />
        <Input
          label="Stato di emissione"
          value={form.stato_emissione_documento || ''}
          onChange={e => onChange('stato_emissione_documento', e.target.value)}
          maxLength={200}
          placeholder="Italia"
          error={errors.stato_emissione_documento}
        />
      </div>

      {showBirth && (
        <>
          <div style={{ margin:'28px 0 12px', fontSize:12, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:COLORS.textSecondary }}>
            Dati di nascita mancanti
          </div>
          <div className="form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
            {showBirthDate && (
              <Input
                label="Data di nascita"
                type="date"
                max={today}
                min="1900-01-01"
                value={italianDateToIso(form.data_nascita)}
                onChange={e => onChange('data_nascita', isoToItalianDate(e.target.value))}
                error={errors.data_nascita}
              />
            )}
            {showBirthCity && (
              <Input
                label="Città di nascita"
                value={form.nascita_citta || ''}
                onChange={e => onChange('nascita_citta', e.target.value)}
                maxLength={200}
                error={errors.nascita_citta}
              />
            )}
          </div>
        </>
      )}

      <div style={{ marginTop:20, display:'flex', alignItems:'center', gap:12 }}>
        <Button type="button" onClick={handleSave} loading={saving}>Salva Dati Fiscali</Button>
        {saved && <span style={{ fontSize:13, color:'#10B981', fontWeight:500 }}>✓ Salvato</span>}
      </div>
    </SectionCardShell>
  )
}

// Sezione 9 — Documenti: stesso meccanismo di upload immediato di
// FotoProfiloCard (document.upload salva su Drive + shortcut field
// non appena il file viene selezionato — nessun pulsante Salva separato,
// coerente col comportamento già esistente per le foto).
const DOCUMENTI_FIELDS = {
  doc_identita:        { label: 'Documento di identità', accept: 'image/jpeg,image/png,application/pdf', maxMB: 5, required: true },
  doc_cf:              { label: 'Codice fiscale (tessera o documento)', accept: 'image/jpeg,image/png,application/pdf', maxMB: 5, required: true },
  cv:                  { label: 'Curriculum vitae', accept: 'application/pdf', maxMB: 10, required: true, hint: 'Formato PDF, max 10MB.' },
  attestato_haccp:     { label: 'Attestato HACCP', accept: 'application/pdf', maxMB: 10, required: false, hint: 'Opzionale.' },
  attestato_sicurezza: { label: 'Attestato Sicurezza sul lavoro', accept: 'application/pdf', maxMB: 10, required: false, hint: 'Opzionale.' },
}

function DocumentiCard({ sec, form, onChange, talentProfileId, handleApiResponse }) {
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
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {Object.entries(DOCUMENTI_FIELDS).map(([fieldKey, cfg]) => (
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
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                <div className="spinner" style={{ width:14, height:14, borderWidth:'1.5px' }} />
                <span style={{ fontSize:12, color:COLORS.textSecondary }}>Caricamento in corso…</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCardShell>
  )
}

function MyProfile({ handleApiResponse }) {
  const [profile,  setProfile]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState({})
  const [pending,  setPending]  = useState(false)
  const [searchParams] = useSearchParams()

  // Deep-link ?section=S1 / ?section=S7 dalla mail di sollecito — scrolla alla
  // sezione richiesta appena il profilo (e quindi le sezioni) sono nel DOM.
  useEffect(() => {
    if (!profile) return
    const sectionId = searchParams.get('section')
    if (!sectionId) return
    const el = document.getElementById(sectionId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [profile, searchParams])

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
      setProfile(p => ({ ...p, status: 'PENDING_REVIEW', contract_data: res.data?.talent?.contract_data ?? p.contract_data }))
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
  const fiscaleDocIncompleto = ['S8', 'S9'].some(id => {
    const sec = PROFILE_SECTIONS.find(s => s.id === id)
    const r   = sec.completeness(form)
    return r.filled < r.total
  })

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

      {fiscaleDocIncompleto && (
        <div style={{
          background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8,
          padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📋</span>
          <span style={{ fontSize: 13, color: '#B71C1C', lineHeight: 1.6 }}>
            Completa i tuoi dati fiscali e carica i documenti per poter ricevere offerte di lavoro.
          </span>
        </div>
      )}

      {PROFILE_SECTIONS.map(sec => (
        sec.id === 'S7' ? <FotoProfiloCard  key={sec.id} sec={sec} form={form} onChange={onChange} talentProfileId={profile.entity_id} handleApiResponse={handleApiResponse} />
        : sec.id === 'S8' ? <FiscaleCard    key={sec.id} sec={sec} form={form} onChange={onChange} handleApiResponse={handleApiResponse} contractData={profile.contract_data} onContractData={cd => setProfile(p => ({ ...p, contract_data: cd }))} />
        : sec.id === 'S9' ? <DocumentiCard  key={sec.id} sec={sec} form={form} onChange={onChange} talentProfileId={profile.entity_id} handleApiResponse={handleApiResponse} />
        : <SectionCard key={sec.id} sec={sec} form={form} onChange={onChange} />
      ))}

      <div style={{ paddingBottom:32 }}>
        <Button type="submit" loading={saving}>Salva Modifiche</Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// CTA INLINE — sezione bloccata (profilo non approvato)
// ---------------------------------------------------------------------------

function SectionLockedCTA({ kind, lead, profile }) {
  const navigate = useNavigate()
  const nome = kind === 'partial' ? (lead?.nome || '') : (profile?.data?.nome || '')
  const greeting = nome ? `Ciao ${nome},` : ''

  const copy = {
    none: {
      text: 'Completa la tua registrazione per accedere alle offerte di lavoro e candidarti agli eventi.',
      cta: { label: 'COMPLETA LA REGISTRAZIONE', onClick: () => navigate('/registrazione') },
    },
    partial: {
      text: `${greeting} hai lasciato la registrazione a metà. Riprendi da dove eri rimasto per accedere alle offerte di lavoro.`,
      cta: { label: 'RIPRENDI', onClick: () => navigate(`/registrazione/completa?token=${lead?.lead_token}`) },
    },
    pending: {
      text: `${greeting} il tuo profilo è in fase di revisione. Ti contatteremo appena approvato!`,
      cta: null,
    },
  }[kind]

  return (
    <div style={{ textAlign:'center', padding:'48px 24px', background:COLORS.accentLight, borderRadius:'8px' }}>
      <p style={{ fontSize:'14px', color:COLORS.text, lineHeight:1.8, maxWidth:'420px', margin: copy.cta ? '0 auto 24px' : '0 auto' }}>
        {copy.text}
      </p>
      {copy.cta && <Button onClick={copy.cta.onClick}>{copy.cta.label}</Button>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

export default function UserPortal() {
  const { handleApiResponse } = useAuth()
  const [gate, setGate] = useState({ loading: true, kind: 'ok', lead: null, profile: null })

  useEffect(() => {
    (async () => {
      const res = handleApiResponse(await talentApi.list())
      const items = res.data?.items || []
      if (items.length > 0) {
        const p = items[0]
        setGate({ loading: false, kind: p.status === 'APPROVED' ? 'ok' : 'pending', profile: p, lead: null })
      } else if (res.data?.lead) {
        setGate({ loading: false, kind: 'partial', lead: res.data.lead, profile: null })
      } else {
        setGate({ loading: false, kind: 'none', lead: null, profile: null })
      }
    })()
  }, [handleApiResponse])

  const gated = (Comp) => {
    if (gate.loading) return <div className="spinner" />
    if (gate.kind === 'ok') return <Comp handleApiResponse={handleApiResponse} />
    return <SectionLockedCTA kind={gate.kind} lead={gate.lead} profile={gate.profile} />
  }

  return (
    <Layout sidebarItems={SIDEBAR_ITEMS}>
      <h1 style={{ ...COMPONENT_STYLES.sectionTitle }}>Il Mio Portale</h1>

      <div id="events">
        <SectionTitle>Offerte di Lavoro</SectionTitle>
        {gated(AvailableEvents)}
      </div>

      <div id="applications">
        <SectionTitle>Le Mie Candidature</SectionTitle>
        {gated(MyApplications)}
      </div>

      <div id="assignments">
        <SectionTitle>I Miei Turni</SectionTitle>
        {gated(MyAssignments)}
      </div>

      <div id="contracts">
        <SectionTitle>Contratti</SectionTitle>
        {gated(MyContracts)}
      </div>

      <div id="profile">
        <SectionTitle>Il Mio Profilo</SectionTitle>
        <MyProfile handleApiResponse={handleApiResponse} />
      </div>
    </Layout>
  )
}
