// === EVENTI PAGE — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { clientApi, applicationApi, getErrorMessage } from '../../api/client'
import adminStore from '../../store/adminStore'
import { COLORS, COMPONENT_STYLES } from '../../styles/theme'
import Layout from '../../components/Layout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import { ADMIN_SIDEBAR, PageHeader, TalentAvatar, ScoreBar, FILTER_INPUT } from './shared'

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' })
}

function statusMeta(status) {
  if (status === 'LIVE')      return { label:'Attivo',     dot:'#4CAF50', bg:'#E8F5E9', color:'#2E7D32' }
  if (status === 'PLANNING')  return { label:'Non attivo', dot:'#bbb',    bg:'#f5f5f5', color:'#666' }
  if (status === 'COMPLETED') return { label:'Completato', dot:'#42A5F5', bg:'#E3F2FD', color:'#1565C0' }
  if (status === 'CANCELLED') return { label:'Annullato',  dot:'#EF5350', bg:'#FFEBEE', color:'#C62828' }
  return                             { label:status,       dot:'#bbb',    bg:'#f5f5f5', color:'#666' }
}

// Parses anni_esperienza_settore string to number
function parseEsperienza(val) {
  if (!val) return 0
  if (val.includes('5')) return 5
  if (val.includes('3')) return 3
  if (val.includes('1')) return 1
  return 0
}

// ---------------------------------------------------------------------------
// SATURATION BAR
// ---------------------------------------------------------------------------

function SaturationBar({ confirmed, required }) {
  if (!required || required <= 0) return null
  const pct     = (confirmed / required) * 100
  const over    = confirmed > required
  const clampPct = Math.min(pct, 100)
  const color   = over ? '#EF4444' : pct >= 80 ? '#F97316' : '#10B981'

  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, marginBottom:4 }}>
        <span style={{ color:COLORS.textSecondary, letterSpacing:'0.3px' }}>Saturazione</span>
        <span style={{
          fontWeight:700, color,
          ...(over ? {
            border:`1.5px solid ${color}`, borderRadius:10,
            padding:'1px 7px', fontSize:11,
          } : {}),
        }}>
          {confirmed}/{required}
        </span>
      </div>
      <div style={{ height:5, background:'#f0f0f0', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${clampPct}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.3s' }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ACTIVATION MODAL
// ---------------------------------------------------------------------------

function ActivationModal({ event, onConfirm, onCancel, loading }) {
  const d = event.data ?? {}
  return (
    <>
      <div onClick={onCancel} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300 }} />
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        background:'#fff', borderRadius:8, padding:32, width:400, maxWidth:'92vw',
        zIndex:301, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', fontFamily:'Montserrat,sans-serif',
      }}>
        <h3 style={{ margin:'0 0 8px', fontSize:16, fontWeight:700, color:COLORS.text }}>Attiva evento</h3>
        <p style={{ margin:'0 0 16px', fontSize:13, color:COLORS.textSecondary }}>
          Stai per rendere questo evento <strong>pubblicamente attivo</strong>.
        </p>
        <div style={{ background:'#fafafa', border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'14px 16px', marginBottom:20 }}>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:6, color:COLORS.text }}>{d.titolo}</div>
          {d.luogo && <div style={{ fontSize:12, color:COLORS.textSecondary, marginBottom:3 }}>📍 {d.luogo}</div>}
          <div style={{ fontSize:12, color:COLORS.textSecondary }}>
            🗓 {fmtDate(d.data_inizio)}{d.data_fine ? ` → ${fmtDate(d.data_fine)}` : ''}
          </div>
        </div>
        {!d.data_inizio && (
          <div style={{ background:COLORS.warningLight, color:COLORS.warning, padding:'10px 14px', borderRadius:6, fontSize:12, marginBottom:16 }}>
            ⚠ Nessuna data impostata. Aggiungi una data prima di attivare.
          </div>
        )}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ background:'none', border:'1px solid #e0e0e0', borderRadius:6, padding:'9px 20px', fontSize:13, cursor:'pointer', fontFamily:'Montserrat,sans-serif', color:'#333' }}>
            Annulla
          </button>
          <Button onClick={onConfirm} loading={loading} disabled={!d.data_inizio}>Attiva</Button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// EVENT FORM DRAWER (Nuovo / Duplica / Modifica)
// ---------------------------------------------------------------------------

function EventFormDrawer({ onClose, onSaved, clients, prefill, isEdit, handleApiResponse }) {
  const [form, setForm] = useState({
    titolo:             prefill?.titolo             ?? '',
    descrizione:        prefill?.descrizione        ?? '',
    data_inizio:        isEdit ? (prefill?.data_inizio ? prefill.data_inizio.slice(0,16) : '') : '',
    data_fine:          isEdit ? (prefill?.data_fine   ? prefill.data_fine.slice(0,16)   : '') : '',
    luogo:              prefill?.luogo              ?? '',
    client_id:          prefill?.client_id          ?? '',
    foto_url:           prefill?.foto_url           ?? '',
    hostess_richieste:  prefill?.hostess_richieste  ?? '',
    anni_esperienza_minimi: prefill?.anni_esperienza_minimi ?? '',
    richiede_trasferte: prefill?.richiede_trasferte ?? false,
    richiede_weekend:   prefill?.richiede_weekend   ?? false,
  })
  const [saving, setSaving] = useState(false)
  const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }))
  const setCheck = key => e => setForm(p => ({ ...p, [key]: e.target.checked }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    if (isEdit) {
      const res = handleApiResponse(await eventApi.update({ entity_id: prefill.entity_id, ...form }))
      setSaving(false)
      if (!res.success) { alert(getErrorMessage(res.error)); return }
      onSaved()
      return
    }
    const res = handleApiResponse(await eventApi.create(form))
    setSaving(false)
    if (!res.success) { alert(getErrorMessage(res.error)); return }
    onSaved()
  }

  const LBL = COMPONENT_STYLES.label

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:300 }} />
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:500, maxWidth:'96vw',
        background:'#fff', borderLeft:`1px solid ${COLORS.border}`,
        zIndex:301, overflowY:'auto', padding:32,
        fontFamily:'Montserrat, sans-serif',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:COLORS.text }}>
            {isEdit ? 'Modifica evento' : prefill ? 'Duplica evento' : 'Nuovo evento'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#666', padding:'4px 8px', lineHeight:1 }}>✕</button>
        </div>

        {prefill && !isEdit && (
          <div style={{ background:COLORS.accentLight, color:COLORS.accent, padding:'10px 14px', borderRadius:6, fontSize:12, marginBottom:20 }}>
            Stai duplicando "{prefill.titolo}". Inserisci le nuove date.
          </div>
        )}

        <form onSubmit={save}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Input label="Titolo *" value={form.titolo} onChange={set('titolo')} required />

            <div>
              <label style={LBL}>Cliente</label>
              <select value={form.client_id} onChange={set('client_id')} style={{ ...COMPONENT_STYLES.input }}>
                <option value="">— Seleziona —</option>
                {clients.map(c => <option key={c.entity_id} value={c.entity_id}>{c.data?.ragione_sociale}</option>)}
              </select>
            </div>

            <Input label="Luogo / Città" value={form.luogo} onChange={set('luogo')} />
            <Input label="Data inizio *" type="datetime-local" value={form.data_inizio} onChange={set('data_inizio')} required={!isEdit} />
            <Input label="Data fine" type="datetime-local" value={form.data_fine} onChange={set('data_fine')} />

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Input label="Hostess richieste" type="number" min="1" value={form.hostess_richieste} onChange={set('hostess_richieste')} placeholder="es. 10" />
              <Input label="Min. anni esperienza" type="number" min="0" value={form.anni_esperienza_minimi} onChange={set('anni_esperienza_minimi')} placeholder="es. 2" />
            </div>

            <div style={{ display:'flex', gap:20 }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.richiede_trasferte} onChange={setCheck('richiede_trasferte')} />
                Richiede trasferte
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.richiede_weekend} onChange={setCheck('richiede_weekend')} />
                Richiede weekend
              </label>
            </div>

            <div>
              <label style={LBL}>Foto URL</label>
              <input type="url" placeholder="https://images.unsplash.com/..." value={form.foto_url} onChange={set('foto_url')} style={{ ...COMPONENT_STYLES.input }} />
            </div>

            <div>
              <label style={LBL}>Descrizione</label>
              <textarea value={form.descrizione} onChange={set('descrizione')} rows={3} style={{ ...COMPONENT_STYLES.input, resize:'vertical', minHeight:80 }} />
            </div>
          </div>

          <div style={{ marginTop:24, display:'flex', gap:10 }}>
            <Button type="submit" loading={saving}>{isEdit ? 'Salva modifiche' : 'Salva evento'}</Button>
            <button type="button" onClick={onClose} style={{ background:'none', border:'1px solid #e0e0e0', borderRadius:6, padding:'9px 18px', fontSize:13, cursor:'pointer', fontFamily:'Montserrat,sans-serif', color:'#333' }}>
              Annulla
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// MATCH TALENT DRAWER (per-card)
// ---------------------------------------------------------------------------

function MatchTalentDrawer({ event, allTalents, onClose, handleApiResponse }) {
  const d = event.data ?? {}
  const [inviteLoading, setInviteLoading] = useState(null) // entity_id being invited
  const [invited,       setInvited]       = useState(new Set())

  const handleInvite = async (talentId) => {
    setInviteLoading(talentId)
    const res = handleApiResponse(await applicationApi.invite(talentId, event.entity_id))
    setInviteLoading(null)
    if (res.success) {
      setInvited(prev => new Set(prev).add(talentId))
    } else {
      alert(getErrorMessage(res.error))
    }
  }

  // Extract province codes from luogo (e.g. "(MI)", "Milano" → "MI")
  const luogo = (d.luogo ?? '').toUpperCase()

  const compatible = useMemo(() => {
    return allTalents.filter(t => {
      const td = t.data ?? {}
      // Province match: any talent province appears in luogo string
      const provinces = td.province_lavoro ?? []
      const cityMatch = provinces.some(p => luogo.includes(p.toUpperCase())) ||
        (td.citta && luogo.includes(td.citta.toUpperCase()))

      if (!cityMatch && !td.disponibilita_trasferte === 'Sì') {
        // If no city match and no trasferte, skip
        if (td.disponibilita_trasferte !== 'Sì') return false
      }

      // Weekend check
      if (d.richiede_weekend && td.disponibilita_weekend !== 'Sì') return false

      // Trasferte check
      if (d.richiede_trasferte && td.disponibilita_trasferte !== 'Sì') return false

      // Anni esperienza check
      const minEsp = Number(d.anni_esperienza_minimi) || 0
      if (minEsp > 0 && parseEsperienza(td.anni_esperienza_settore) < minEsp) return false

      return true
    }).sort((a, b) => (Number(b.data?.score) || 0) - (Number(a.data?.score) || 0))
  }, [allTalents, d, luogo])

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:300 }} />
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:520, maxWidth:'96vw',
        background:'#0E0E16', borderLeft:'1px solid #2A2A3A',
        zIndex:301, overflowY:'auto', padding:32,
        fontFamily:'Montserrat, sans-serif',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:17, fontWeight:700, margin:0, color:'#E8E8F0' }}>Talent compatibili</h2>
            <div style={{ fontSize:12, color:'#8888A0', marginTop:4 }}>{d.titolo}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#8888A0', fontSize:18, cursor:'pointer', padding:'4px 8px', lineHeight:1 }}>✕</button>
        </div>

        {d.luogo && (
          <div style={{ fontSize:12, color:'#8888A0', marginBottom:6 }}>📍 {d.luogo}</div>
        )}

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          {d.richiede_trasferte && <span style={{ fontSize:11, background:'#1A1A24', color:'#8888A0', padding:'3px 8px', borderRadius:10 }}>Trasferte</span>}
          {d.richiede_weekend   && <span style={{ fontSize:11, background:'#1A1A24', color:'#8888A0', padding:'3px 8px', borderRadius:10 }}>Weekend</span>}
          {d.anni_esperienza_minimi > 0 && <span style={{ fontSize:11, background:'#1A1A24', color:'#8888A0', padding:'3px 8px', borderRadius:10 }}>Esp. ≥ {d.anni_esperienza_minimi} anni</span>}
        </div>

        {compatible.length === 0 ? (
          <div style={{ color:'#8888A0', fontSize:13 }}>Nessun talent compatibile trovato con i filtri dell'evento.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {compatible.map(t => {
              const td = t.data ?? {}
              return (
                <div key={t.entity_id} style={{ background:'#1A1A24', borderRadius:8, padding:'14px 16px', display:'flex', gap:14, alignItems:'center' }}>
                  <TalentAvatar nome={td.nome} fotoUrl={td.foto_busto_url} size={44} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:'#E8E8F0' }}>{td.nome} {td.cognome}</div>
                    <div style={{ fontSize:11, color:'#8888A0', marginTop:2 }}>{td.citta ?? '—'} · {td.disponibilita_trasferte === 'Sì' ? 'Trasferte ✓' : 'No trasferte'}</div>
                    <div style={{ marginTop:6 }}><ScoreBar score={td.score} /></div>
                  </div>
                  <button
                    onClick={() => !invited.has(t.entity_id) && handleInvite(t.entity_id)}
                    disabled={inviteLoading === t.entity_id || invited.has(t.entity_id)}
                    style={{
                      background: invited.has(t.entity_id) ? '#2A2A3A' : 'none',
                      border:'1px solid #7A1E2C', color: invited.has(t.entity_id) ? '#8888A0' : '#7A1E2C',
                      borderRadius:6, padding:'5px 12px', fontSize:11,
                      cursor: invited.has(t.entity_id) ? 'default' : 'pointer',
                      fontFamily:'Montserrat,sans-serif', whiteSpace:'nowrap', flexShrink:0,
                      opacity: inviteLoading === t.entity_id ? 0.5 : 1,
                    }}
                  >
                    {inviteLoading === t.entity_id ? '…' : invited.has(t.entity_id) ? 'Invitato ✓' : 'Invita'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// EVENT CARD
// ---------------------------------------------------------------------------

function EventCard({ event, clients, onToggle, onDuplica, onModifica, onMatchTalent, toggling, closedSet, onToggleClosed, richieste, onSetRichieste }) {
  const d          = event.data ?? {}
  const sm         = statusMeta(event.status)
  const client     = clients.find(c => c.entity_id === d.client_id)
  const canToggle  = event.status === 'LIVE' || event.status === 'PLANNING'
  const isToggling = toggling === event.entity_id
  const isClosed   = closedSet.has(event.entity_id)
  const confirmed  = Number(d.confirmed_count ?? d.posti_confermati ?? 0)
  const required   = richieste[event.entity_id] ?? Number(d.hostess_richieste ?? 0)

  const coverUrl = d.foto_copertina_url || d.foto_url

  return (
    <div style={{
      borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column',
      boxShadow:'0 2px 12px rgba(0,0,0,0.08)', transition:'box-shadow 0.2s, transform 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.15)'; e.currentTarget.style.transform='translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform='translateY(0)' }}
    >
      {/* MAGAZINE HEADER — photo + bordeaux gradient overlay + white text */}
      <div style={{
        height:220, position:'relative', flexShrink:0, overflow:'hidden',
        background: coverUrl ? 'transparent' : `linear-gradient(135deg, #4A1020 0%, #7A1E2C 100%)`,
        backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {/* Bordeaux gradient overlay */}
        <div style={{
          position:'absolute', inset:0,
          background:'linear-gradient(to bottom, rgba(60,10,20,0.15) 0%, rgba(60,10,20,0.75) 60%, rgba(60,10,20,0.92) 100%)',
        }} />

        {/* Status badge — top right */}
        <div style={{ position:'absolute', top:12, right:12, zIndex:2 }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(4px)', color:'#fff', fontSize:10, fontWeight:700, letterSpacing:'0.5px', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:sm.dot, flexShrink:0 }} />
            {sm.label}
          </span>
        </div>
        {isClosed && (
          <div style={{ position:'absolute', top:12, left:12, zIndex:2 }}>
            <span style={{ fontSize:9, fontWeight:800, background:'rgba(255,255,255,0.15)', backdropFilter:'blur(4px)', color:'#fff', padding:'3px 8px', borderRadius:10, letterSpacing:'1px', textTransform:'uppercase' }}>Chiuse</span>
          </div>
        )}

        {/* Text overlay — bottom */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'0 16px 14px', zIndex:2 }}>
          <h3 style={{ margin:'0 0 4px', fontSize:15, fontWeight:700, color:'#fff', lineHeight:1.3, textShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>{d.titolo}</h3>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {client && <span style={{ fontSize:11, color:'rgba(255,255,255,0.8)' }}>🏢 {client.data?.ragione_sociale}</span>}
            {d.luogo && <span style={{ fontSize:11, color:'rgba(255,255,255,0.8)' }}>📍 {d.luogo}</span>}
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>🗓 {fmtDate(d.data_inizio)}{d.data_fine ? ` — ${fmtDate(d.data_fine)}` : ''}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:'12px 16px 10px', flex:1, display:'flex', flexDirection:'column', gap:4, background:'#fff' }}>

        {/* Hostess richieste inline input */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
          <span style={{ fontSize:11, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>Hostess richieste:</span>
          <input
            type="number"
            min="1"
            max="200"
            value={richieste[event.entity_id] ?? (d.hostess_richieste || '')}
            placeholder="—"
            onChange={e => onSetRichieste(event.entity_id, e.target.value === '' ? 0 : Number(e.target.value))}
            style={{ width:52, border:'1px solid #e0e0e0', borderRadius:4, padding:'3px 6px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none' }}
          />
        </div>

        {/* Saturation bar */}
        {required > 0 && <SaturationBar confirmed={confirmed} required={required} />}
      </div>

      {/* Actions row */}
      <div style={{ padding:'10px 12px 12px', borderTop:`1px solid ${COLORS.border}`, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        {/* Toggle ATTIVO/NON ATTIVO */}
        {canToggle && (
          <button
            onClick={() => onToggle(event)}
            disabled={isToggling}
            style={{
              display:'inline-flex', alignItems:'center', gap:5,
              background:'none', border:`1px solid ${isToggling ? '#e0e0e0' : sm.color + '66'}`,
              borderRadius:20, padding:'4px 12px', fontSize:10, fontWeight:600,
              cursor: isToggling ? 'not-allowed' : 'pointer',
              color:sm.color, fontFamily:'Montserrat,sans-serif',
              opacity: isToggling ? 0.6 : 1,
            }}
          >
            <span style={{ width:7, height:7, borderRadius:'50%', background: isToggling ? '#bbb' : sm.dot, flexShrink:0 }} />
            {isToggling ? '…' : sm.label}
          </button>
        )}

        {/* CHIUDI / APRI SELEZIONI */}
        <button
          onClick={() => onToggleClosed(event.entity_id)}
          style={{
            background: isClosed ? '#333' : 'none',
            border: isClosed ? '1px solid #333' : '1px solid #e0e0e0',
            color: isClosed ? '#fff' : COLORS.textSecondary,
            borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:600,
            cursor:'pointer', fontFamily:'Montserrat,sans-serif',
            transition:'all 0.15s',
          }}
        >
          {isClosed ? 'Selezioni chiuse' : 'Chiudi selezioni'}
        </button>

        {/* Right-side buttons */}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button
            onClick={() => onMatchTalent(event)}
            title="Talent compatibili"
            style={{ background:'none', border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'4px 10px', fontSize:10, cursor:'pointer', color:COLORS.textSecondary, fontFamily:'Montserrat,sans-serif' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=COLORS.accent; e.currentTarget.style.color=COLORS.accent }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=COLORS.border; e.currentTarget.style.color=COLORS.textSecondary }}
          >
            Talent →
          </button>
          <button
            onClick={() => onDuplica(event)}
            style={{ background:'none', border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'4px 10px', fontSize:10, cursor:'pointer', color:COLORS.textSecondary, fontFamily:'Montserrat,sans-serif' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=COLORS.accent; e.currentTarget.style.color=COLORS.accent }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=COLORS.border; e.currentTarget.style.color=COLORS.textSecondary }}
          >
            Duplica
          </button>
          <button
            onClick={() => onModifica(event)}
            style={{ background:'none', border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'4px 10px', fontSize:10, cursor:'pointer', color:COLORS.textSecondary, fontFamily:'Montserrat,sans-serif' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=COLORS.accent; e.currentTarget.style.color=COLORS.accent }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=COLORS.border; e.currentTarget.style.color=COLORS.textSecondary }}
          >
            Modifica
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

export default function EventiPage() {
  const { handleApiResponse } = useAuth()
  const [events,       setEvents]       = useState([])
  const [clients,      setClients]      = useState([])
  const [allTalents,   setAllTalents]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  // Filters + sort
  const [filterCitta,  setFilterCitta]  = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [sortBy,       setSortBy]       = useState('data')     // 'data' | 'saturazione'

  // UI state
  const [toggling,     setToggling]     = useState(null)
  const [activModal,   setActivModal]   = useState(null)
  const [showForm,     setShowForm]     = useState(false)
  const [formPrefill,  setFormPrefill]  = useState(null)
  const [isEdit,       setIsEdit]       = useState(false)
  const [matchEvent,   setMatchEvent]   = useState(null)

  // Per-card local state (needs backend to persist)
  const [closedSet,    setClosedSet]    = useState(new Set())   // entity_ids with closed selection
  const [richieste,    setRichieste]    = useState({})          // entity_id → number

  const load = useCallback(async () => {
    setLoading(true)
    const [storeData, clRes] = await Promise.all([
      adminStore.refresh(),
      handleApiResponse(await clientApi.list()),
    ])
    setLoading(false)
    if (!storeData) { setError('Errore nel caricamento dati.'); return }
    setEvents(storeData.events ?? [])
    if (clRes.success) setClients(clRes.data?.items ?? [])
    const seen = new Set()
    const approved = (storeData.leads ?? []).filter(l => {
      const key = (l.data?.email ?? l.entity_id).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return l.status === 'APPROVED'
    })
    setAllTalents(approved)
  }, [handleApiResponse])

  useEffect(() => { load() }, [load])

  // Filtered + sorted events
  const displayed = useMemo(() => {
    let list = [...events]
    if (filterStatus !== 'ALL') list = list.filter(e => e.status === filterStatus)
    if (filterCitta.trim()) {
      const q = filterCitta.trim().toLowerCase()
      list = list.filter(e => (e.data?.luogo ?? '').toLowerCase().includes(q))
    }
    if (sortBy === 'data') {
      list.sort((a, b) => new Date(a.data?.data_inizio || 0) - new Date(b.data?.data_inizio || 0))
    } else if (sortBy === 'saturazione') {
      list.sort((a, b) => {
        const aReq = richieste[a.entity_id] ?? Number(a.data?.hostess_richieste ?? 1)
        const bReq = richieste[b.entity_id] ?? Number(b.data?.hostess_richieste ?? 1)
        const aPct = aReq > 0 ? (Number(a.data?.confirmed_count ?? 0) / aReq) : 0
        const bPct = bReq > 0 ? (Number(b.data?.confirmed_count ?? 0) / bReq) : 0
        return bPct - aPct
      })
    }
    return list
  }, [events, filterStatus, filterCitta, sortBy, richieste])

  const handleToggle = (event) => {
    if (event.status === 'LIVE') {
      if (window.confirm(`Disattivare "${event.data?.titolo}"?`)) doUpdateStatus(event.entity_id, 'PLANNING')
    } else if (event.status === 'PLANNING') {
      setActivModal(event)
    }
  }

  const doUpdateStatus = async (entity_id, new_status) => {
    setToggling(entity_id)
    const res = handleApiResponse(await eventApi.updateStatus(entity_id, new_status))
    setToggling(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  const handleActivConfirm = async () => {
    if (!activModal) return
    await doUpdateStatus(activModal.entity_id, 'LIVE')
    setActivModal(null)
  }

  const handleDuplica = (event) => {
    setFormPrefill(event.data ?? {})
    setIsEdit(false)
    setShowForm(true)
  }

  const handleModifica = (event) => {
    setFormPrefill({ entity_id: event.entity_id, ...(event.data ?? {}) })
    setIsEdit(true)
    setShowForm(true)
  }

  const handleFormClose = () => { setShowForm(false); setFormPrefill(null); setIsEdit(false) }
  const handleFormSaved = () => { handleFormClose(); load() }

  const handleToggleClosed = (entity_id) => {
    setClosedSet(prev => {
      const next = new Set(prev)
      next.has(entity_id) ? next.delete(entity_id) : next.add(entity_id)
      return next
    })
  }

  const handleSetRichieste = (entity_id, val) => {
    setRichieste(prev => ({ ...prev, [entity_id]: val }))
  }

  const TAB = (active) => ({
    padding:'9px 18px', fontSize:13, fontWeight:600,
    background:'none', border:'none', cursor:'pointer',
    borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
    color: active ? COLORS.accent : COLORS.textSecondary,
    fontFamily:'Montserrat,sans-serif',
  })

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageHeader
        title="Eventi"
        subtitle={loading ? '' : `${displayed.length} eventi`}
        action={<Button onClick={() => { setFormPrefill(null); setIsEdit(false); setShowForm(true) }}>+ Nuovo Evento</Button>}
      />

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20, alignItems:'center' }}>
        <input
          placeholder="Filtra per città…"
          value={filterCitta}
          onChange={e => setFilterCitta(e.target.value)}
          style={{ ...FILTER_INPUT, minWidth:160 }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={FILTER_INPUT}>
          <option value="ALL">Tutti gli stati</option>
          <option value="LIVE">Attivi</option>
          <option value="PLANNING">Non attivi</option>
          <option value="COMPLETED">Completati</option>
          <option value="CANCELLED">Annullati</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={FILTER_INPUT}>
          <option value="data">Ordina per data</option>
          <option value="saturazione">Ordina per saturazione</option>
        </select>
        <span style={{ fontSize:12, color:'#8888A0', marginLeft:'auto', whiteSpace:'nowrap' }}>
          {displayed.length} eventi
        </span>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="error-banner">{error}</div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">Nessun evento. Crea il primo con "+ Nuovo Evento".</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20 }}>
          {displayed.map(ev => (
            <EventCard
              key={ev.entity_id}
              event={ev}
              clients={clients}
              onToggle={handleToggle}
              onDuplica={handleDuplica}
              onModifica={handleModifica}
              onMatchTalent={setMatchEvent}
              toggling={toggling}
              closedSet={closedSet}
              onToggleClosed={handleToggleClosed}
              richieste={richieste}
              onSetRichieste={handleSetRichieste}
            />
          ))}
        </div>
      )}

      {activModal && (
        <ActivationModal
          event={activModal}
          onConfirm={handleActivConfirm}
          onCancel={() => setActivModal(null)}
          loading={toggling === activModal?.entity_id}
        />
      )}

      {showForm && (
        <EventFormDrawer
          onClose={handleFormClose}
          onSaved={handleFormSaved}
          clients={clients}
          prefill={formPrefill}
          isEdit={isEdit}
          handleApiResponse={handleApiResponse}
        />
      )}

      {matchEvent && (
        <MatchTalentDrawer
          event={matchEvent}
          allTalents={allTalents}
          onClose={() => setMatchEvent(null)}
          handleApiResponse={handleApiResponse}
        />
      )}
    </Layout>
  )
}
