// === USER PORTAL — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  eventApi, applicationApi, assignmentApi, talentApi,
  getErrorMessage,
} from '../api/client'
import { COLORS, COMPONENT_STYLES, LETTER_SPACING } from '../styles/theme'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Card   from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import Input from '../components/Input'

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
    <div style={{ display:'flex', gap:'8px', fontSize:'13px' }}>
      <span style={{ fontWeight:600, minWidth:'120px', color:COLORS.textSecondary }}>{label}</span>
      <span style={{ color:COLORS.text }}>{val}</span>
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
// PROFILO — 8 sezioni complete
// ---------------------------------------------------------------------------

const PROFILE_SECTIONS = [
  {
    id: 'S1', title: 'Dati Personali',
    fields: ['nome','cognome','email_contatto','telefono','data_nascita','citta_nascita','nazionalita','indirizzo_residenza','numero_documento','stato_emissione_documento'],
    labels: { nome:'Nome', cognome:'Cognome', email_contatto:'Email', telefono:'Telefono', data_nascita:'Data di nascita', citta_nascita:'Città di nascita', nazionalita:'Nazionalità', indirizzo_residenza:'Indirizzo residenza', numero_documento:'N° documento', stato_emissione_documento:'Stato emissione doc.' },
    readonly: ['nome','cognome','email_contatto'],
  },
  {
    id: 'S2', title: 'Profilo Fisico',
    fields: ['altezza','taglia','capelli','occhi','corporatura'],
    labels: { altezza:'Altezza (cm)', taglia:'Taglia', capelli:'Capelli', occhi:'Occhi', corporatura:'Corporatura' },
  },
  {
    id: 'S3', title: 'Logistica',
    fields: ['citta','province_operativita','automunita','disponibile_trasferte','disponibile_weekend'],
    labels: { citta:'Città di residenza', province_operativita:'Province operative', automunita:'Automunita', disponibile_trasferte:'Disponibile trasferte', disponibile_weekend:'Disponibile week-end' },
    array: ['province_operativita'],
    bool: ['automunita','disponibile_trasferte','disponibile_weekend'],
  },
  {
    id: 'S4', title: 'Lingue',
    fields: ['lingue'],
    labels: { lingue:'Lingue e livelli' },
    array: ['lingue'],
  },
  {
    id: 'S5', title: 'Esperienza',
    fields: ['esperienza_anni','skills','esperienze_precedenti'],
    labels: { esperienza_anni:'Anni di esperienza', skills:'Skills', esperienze_precedenti:'Esperienze precedenti' },
    array: ['skills'],
  },
  {
    id: 'S6', title: 'Attrezzatura',
    fields: ['attrezzatura'],
    labels: { attrezzatura:'Attrezzatura personale' },
  },
  {
    id: 'S7', title: 'Fiscale / Bancario',
    fields: ['codice_fiscale','iban','intestatario_conto','partita_iva','disponibile_chiamata','disponibile_ritenuta'],
    labels: { codice_fiscale:'Codice fiscale', iban:'IBAN', intestatario_conto:'Intestatario conto', partita_iva:'Partita IVA (se presente)', disponibile_chiamata:'Disponibile con chiamata diretta', disponibile_ritenuta:'Disponibile con ritenuta d\'acconto' },
    bool: ['disponibile_chiamata','disponibile_ritenuta'],
  },
  {
    id: 'S8', title: 'Documenti',
    fields: ['doc_identita_url','doc_cf_url','cv_url'],
    labels: { doc_identita_url:'Documento identità (URL)', doc_cf_url:'Codice fiscale documento (URL)', cv_url:'CV (URL)' },
  },
]

function profileToForm(d) {
  const f = {}
  PROFILE_SECTIONS.forEach(sec => {
    sec.fields.forEach(key => {
      const v = d[key]
      if (sec.array?.includes(key)) {
        f[key] = Array.isArray(v) ? v.join(', ') : (v ?? '')
      } else if (sec.bool?.includes(key)) {
        f[key] = v === true || v === 'Sì' || v === 'true' ? 'Sì' : (v === false || v === 'No' || v === 'false' ? 'No' : '')
      } else {
        f[key] = v !== undefined && v !== null ? String(v) : ''
      }
    })
  })
  return f
}

function formToPayload(form) {
  const p = {}
  PROFILE_SECTIONS.forEach(sec => {
    sec.fields.forEach(key => {
      if (sec.readonly?.includes(key)) return
      const v = form[key] ?? ''
      if (sec.array?.includes(key)) {
        p[key] = v.split(',').map(x => x.trim()).filter(Boolean)
      } else if (sec.bool?.includes(key)) {
        p[key] = v === 'Sì'
      } else {
        p[key] = v
      }
    })
  })
  return p
}

function sectionCompleteness(sec, data) {
  if (sec.special) {
    const hasPhoto = !!(data.foto_busto_url || data.foto_intera_url)
    return { filled: hasPhoto ? 1 : 0, total: 1 }
  }
  let filled = 0
  const total = sec.fields.filter(k => !sec.readonly?.includes(k)).length
  sec.fields.forEach(key => {
    if (sec.readonly?.includes(key)) return
    const v = data[key]
    if (Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && String(v).trim() !== '')) filled++
  })
  return { filled, total }
}

function globalCompleteness(data) {
  let filled = 0, total = 0
  PROFILE_SECTIONS.forEach(sec => {
    const r = sectionCompleteness(sec, data)
    filled += r.filled
    total  += r.total
  })
  return total > 0 ? Math.round((filled / total) * 100) : 0
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

const DASHED_INPUT = {
  border: '1.5px dashed #630E3344',
  borderRadius: '4px',
  padding: '7px 10px',
  fontSize: '13px',
  fontFamily: 'Montserrat,sans-serif',
  width: '100%',
  boxSizing: 'border-box',
  background: '#fafafa',
  color: COLORS.text,
  outline: 'none',
}

const FILLED_INPUT = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: '4px',
  padding: '7px 10px',
  fontSize: '13px',
  fontFamily: 'Montserrat,sans-serif',
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
  color: COLORS.text,
  outline: 'none',
}

function ProfileField({ label, fieldKey, value, onChange, readonly, multiline, placeholder }) {
  const isEmpty = !value || value.trim() === ''
  const style = readonly
    ? { ...FILLED_INPUT, background:'#f5f5f5', color:COLORS.textSecondary, cursor:'default' }
    : isEmpty ? DASHED_INPUT : FILLED_INPUT

  return (
    <div>
      <label style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', color:COLORS.textSecondary, display:'block', marginBottom:4 }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          readOnly={readonly}
          placeholder={placeholder || (isEmpty ? 'Non compilato' : '')}
          rows={3}
          style={{ ...style, resize:'vertical' }}
        />
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          readOnly={readonly}
          placeholder={placeholder || (isEmpty ? 'Non compilato' : '')}
          style={style}
        />
      )}
    </div>
  )
}

function SectionCard({ sec, form, setForm, data }) {
  const { filled, total } = sectionCompleteness(sec, formToPayload(form))
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0

  if (sec.special) {
    const fotoDate = data?.foto_caricata_il || data?.updated_at
    return (
      <div style={{ background:'#fff', border:`1px solid ${COLORS.border}`, borderRadius:8, padding:'20px', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:COLORS.text }}>
            {sec.id} — {sec.title}
          </div>
          <span style={{ fontSize:11, color:COLORS.textSecondary }}>{filled}/{total}</span>
        </div>
        <ProgressBar pct={pct} style={{ marginBottom:16 }} />

        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
          {[
            ['Foto busto', data?.foto_busto_url],
            ['Foto intera', data?.foto_intera_url],
          ].filter(([, u]) => u).map(([lbl, url]) => (
            <div key={lbl} style={{ textAlign:'center' }}>
              <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={lbl} style={{ width:80, height:96, objectFit:'cover', borderRadius:6, border:`1px solid ${COLORS.border}`, display:'block' }} />
              </a>
              <div style={{ fontSize:10, color:COLORS.textSecondary, marginTop:4 }}>{lbl}</div>
            </div>
          ))}
          {!data?.foto_busto_url && !data?.foto_intera_url && (
            <div style={{ fontSize:12, color:COLORS.textSecondary }}>Nessuna foto caricata</div>
          )}
        </div>
        <div style={{ marginBottom:8 }}>
          <PhotoExpiryBadge fotoDate={fotoDate} />
        </div>
        {data?.cv_url && (
          <div style={{ marginTop:8 }}>
            <a href={data.cv_url} target="_blank" rel="noreferrer" style={{ color:COLORS.accent, fontSize:13, fontWeight:500, textDecoration:'none' }}>
              Apri CV →
            </a>
          </div>
        )}
        <div style={{ marginTop:8, fontSize:11, color:COLORS.textSecondary }}>
          Per aggiornare foto e CV contatta l&apos;agenzia.
        </div>
      </div>
    )
  }

  return (
    <div style={{ background:'#fff', border:`1px solid ${COLORS.border}`, borderRadius:8, padding:'20px', marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:COLORS.text }}>
          {sec.id} — {sec.title}
        </div>
        <span style={{ fontSize:11, color:COLORS.textSecondary }}>{filled}/{total}</span>
      </div>
      <ProgressBar pct={pct} style={{ marginBottom:16 }} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
        {sec.fields.filter(k => !sec.readonly?.includes(k)).map(key => {
          const isFullWidth = key === 'esperienze_precedenti' || key === 'attrezzatura' || key.endsWith('_url')
          const isBool = sec.bool?.includes(key)
          const isUrl  = key.endsWith('_url')
          return (
            <div key={key} style={isFullWidth ? { gridColumn:'1 / -1' } : {}}>
              {isBool ? (
                <div>
                  <label style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', color:COLORS.textSecondary, display:'block', marginBottom:4 }}>
                    {sec.labels[key] || key}
                  </label>
                  <select
                    value={form[key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ ...FILLED_INPUT }}
                  >
                    <option value="">— Seleziona —</option>
                    <option value="Sì">Sì</option>
                    <option value="No">No</option>
                  </select>
                </div>
              ) : isUrl ? (
                <div>
                  <label style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', color:COLORS.textSecondary, display:'block', marginBottom:4 }}>
                    {sec.labels[key] || key}
                  </label>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input
                      value={form[key] ?? ''}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder="Incolla URL Google Drive…"
                      style={{ ...((form[key] ?? '').trim() ? FILLED_INPUT : DASHED_INPUT) }}
                    />
                    {(form[key] ?? '').trim() && (
                      <a href={form[key]} target="_blank" rel="noreferrer" style={{ fontSize:12, color:COLORS.accent, whiteSpace:'nowrap', fontWeight:500 }}>
                        Apri →
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <ProfileField
                  label={sec.labels[key] || key}
                  fieldKey={key}
                  value={form[key] ?? ''}
                  onChange={v => setForm(f => ({ ...f, [key]: v }))}
                  multiline={key === 'esperienze_precedenti' || key === 'attrezzatura'}
                  placeholder={sec.array?.includes(key) ? (key === 'lingue' ? 'es. Italiano, Inglese B2' : key === 'province_operativita' ? 'es. Roma, Milano' : key === 'skills' ? 'es. Accoglienza, Promoter' : '') : undefined}
                />
              )}
            </div>
          )
        })}
        {sec.readonly?.map(key => (
          <div key={key}>
            <ProfileField
              label={sec.labels[key] || key}
              fieldKey={key}
              value={form[key] ?? ''}
              onChange={() => {}}
              readonly
            />
          </div>
        ))}
      </div>
    </div>
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
        setForm(profileToForm(p.data ?? {}))
        setPending(p.status === 'PENDING_REVIEW')
      }
    })()
  }, [handleApiResponse])

  const save = async (e) => {
    e.preventDefault()
    if (!profile?.entity_id) return
    setSaving(true)
    const payload = { entity_id: profile.entity_id, ...formToPayload(form) }
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
  const pct = globalCompleteness(formToPayload(form))

  return (
    <form onSubmit={save}>
      {/* Header: avatar + global progress */}
      <Card style={{ marginBottom:16, padding:'20px' }}>
        <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:14 }}>
          {d.foto_busto_url ? (
            <img src={d.foto_busto_url} alt={d.nome} style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:`2px solid ${COLORS.border}` }} />
          ) : (
            <div style={{ width:64, height:64, borderRadius:'50%', background:'#630E33', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, color:'#fff', fontWeight:700 }}>
              {(d.nome?.[0] ?? '?').toUpperCase()}
            </div>
          )}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:2 }}>{d.nome} {d.cognome}</div>
            <div style={{ fontSize:12, color:COLORS.textSecondary, marginBottom:6 }}>{d.email_contatto}</div>
            <StatusBadge status={profile.status} />
          </div>
          <div style={{ textAlign:'right' }}>
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

      {!d.codice_fiscale && (
        <div style={{
          background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 8,
          padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
          <span style={{ fontSize: 13, color: '#5D4037', lineHeight: 1.6 }}>
            Completa i tuoi <strong>dati fiscali</strong> e i <strong>documenti</strong> per poter ricevere offerte di lavoro.
          </span>
        </div>
      )}

      {PROFILE_SECTIONS.map(sec => (
        <SectionCard key={sec.id} sec={sec} form={form} setForm={setForm} data={d} />
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
