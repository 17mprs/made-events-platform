// === EVENTI PAGE — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../contexts/AuthContext'
import { clientApi, eventApi, talentApi, applicationApi, shiftApi, newsletterApi, getErrorMessage } from '../../api/client'
import { ContractPanelModal, ContractBadge, useApplicationContracts } from '../../components/ContractPanel'
import adminStore from '../../store/adminStore'
import { COLORS, COMPONENT_STYLES } from '../../styles/theme'
import Layout from '../../components/Layout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import { ADMIN_SIDEBAR, PageHeader, TalentAvatar, ScoreBar, FILTER_INPUT, safeArray, showToast, driveThumbUrl } from './shared'
import { LINGUE_FISSE, DISPONIBILITA_TIPI } from '../../components/registration/questionnaireOptions'
import CittaProvinciaSelect from '../../components/shared/CittaProvinciaSelect'
import { calculateEventMatch as computeMatchPct } from 'virtual:match-score'

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' })
}

function statusMeta(status) {
  if (status === 'DRAFT')     return { label:'Bozza',         dot:'#9CA3AF', bg:'#F3F4F6', color:'#4B5563' }
  if (status === 'PLANNING')  return { label:'Pianificazione', dot:'#F97316', bg:'#FFF7ED', color:'#C2410C' }
  if (status === 'LIVE')      return { label:'Attivo',         dot:'#4CAF50', bg:'#F0FDF4', color:'#15803D' }
  if (status === 'COMPLETED') return { label:'Completato',     dot:'#42A5F5', bg:'#E3F2FD', color:'#1565C0' }
  if (status === 'CANCELLED') return { label:'Annullato',      dot:'#EF5350', bg:'#FFEBEE', color:'#C62828' }
  return                             { label:status,           dot:'#9CA3AF', bg:'#F3F4F6', color:'#4B5563' }
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

// approved = AWAITING_SIGNATURE + confermati (occupano il posto); confirmed = contratto firmato.
function SaturationBar({ approved, confirmed, required, onCountClick }) {
  if (!required || required <= 0) return null
  const pct      = (approved / required) * 100
  const over     = approved > required
  const clampPct = Math.min(pct, 100)
  const color    = over ? '#EF4444' : pct >= 80 ? '#F97316' : '#10B981'

  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, marginBottom:4 }}>
        <span style={{ color:COLORS.textSecondary, letterSpacing:'0.3px' }}>Saturazione</span>
        <span>
          <span
            onClick={onCountClick}
            title={onCountClick ? 'Vedi talent approvati' : undefined}
            style={{
              fontWeight:700, color,
              cursor: onCountClick ? 'pointer' : 'default',
              textDecoration: onCountClick ? 'underline' : 'none',
              ...(over ? { border:`1.5px solid ${color}`, borderRadius:10, padding:'1px 7px', fontSize:11 } : {}),
            }}
          >
            {approved}/{required}
          </span>
          <span style={{ color:COLORS.textSecondary, marginLeft:6 }}>approvati · {confirmed} confermati</span>
        </span>
      </div>
      <div style={{ height:5, background:'#f0f0f0', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${clampPct}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.3s' }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// STATUS TRANSITIONS (specchio delle regole backend Workflows.js)
// ---------------------------------------------------------------------------

const STATUS_TRANSITIONS = {
  DRAFT:     ['PLANNING', 'LIVE', 'COMPLETED'],
  PLANNING:  ['DRAFT',    'LIVE', 'COMPLETED'],
  LIVE:      ['DRAFT', 'PLANNING', 'COMPLETED'],
  COMPLETED: ['DRAFT', 'PLANNING', 'LIVE'],
}

// ---------------------------------------------------------------------------
// DELETE CONFIRM MODAL
// ---------------------------------------------------------------------------

function DeleteConfirmModal({ event, onConfirm, onClose, loading }) {
  const [code, setCode] = useState('')
  const isValid = code === '12345'
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300 }} />
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        background:'#fff', borderRadius:8, padding:32, width:420, maxWidth:'92vw',
        zIndex:301, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', fontFamily:'Montserrat,sans-serif',
      }}>
        <h3 style={{ margin:'0 0 8px', fontSize:16, fontWeight:700, color:'#C62828' }}>Elimina evento</h3>
        <p style={{ margin:'0 0 16px', fontSize:13, color:COLORS.textSecondary }}>
          Stai per eliminare <strong>"{event.data?.titolo}"</strong>. L'evento sparirà dalla lista. Questa azione non è reversibile dall'interfaccia.
        </p>
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', color:COLORS.textSecondary, display:'block', marginBottom:4 }}>
            Password
          </label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Password"
            autoComplete="off"
            autoFocus
            style={{
              border:`1.5px solid ${isValid ? '#4CAF50' : COLORS.border}`,
              borderRadius:4, padding:'9px 12px', fontSize:15,
              fontFamily:'monospace', letterSpacing:'4px', width:'100%',
              boxSizing:'border-box', outline:'none', transition:'border-color 0.2s',
            }}
          />
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button
            onClick={onClose}
            style={{ background:'none', border:'1px solid #e0e0e0', borderRadius:6, padding:'9px 20px', fontSize:13, cursor:'pointer', fontFamily:'Montserrat,sans-serif', color:'#333' }}
          >
            Annulla operazione
          </button>
          <Button variant="danger" disabled={!isValid} loading={loading} onClick={() => onConfirm(event.entity_id)}>
            Elimina evento
          </Button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// EVENT STATUS TOGGLE
// ---------------------------------------------------------------------------

function EventStatusToggle({ event, onChangeStatus, isChanging }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState(null)
  const buttonRef = useRef(null)
  const meta    = statusMeta(event.status)
  const options = STATUS_TRANSITIONS[event.status] ?? []

  // Nessuna transizione di stato disponibile (es. CANCELLED, non mappato in
  // STATUS_TRANSITIONS) → badge statico, non serve più un dropdown interattivo
  // ora che "Elimina evento" è un pulsante separato nella card, non più qui dentro.
  if (!options.length) {
    return (
      <span style={{
        display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px',
        borderRadius:20, background:meta.bg, color:meta.color,
        fontSize:10, fontWeight:700, letterSpacing:'0.3px',
      }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:meta.dot, flexShrink:0 }} />
        {meta.label}
      </span>
    )
  }

  const handleToggle = () => {
    if (isChanging) return
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const dropdownHeight = options.length * 40 + 16
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpward = spaceBelow < dropdownHeight + 20
      setPos({
        top:        openUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left:       rect.left,
        openUpward,
      })
    }
    setOpen(o => !o)
  }

  // Chiude il dropdown se l'utente scrolla o ridimensiona la finestra
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  // Anche senza transizioni di stato disponibili (es. CANCELLED, non presente in
  // STATUS_TRANSITIONS) il pulsante resta interattivo: il dropdown contiene
  // sempre l'opzione "Elimina evento", che altrimenti diventerebbe irraggiungibile.

  return (
    <div style={{ position:'relative' }}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={isChanging}
        style={{
          display:'inline-flex', alignItems:'center', gap:5,
          background:meta.bg, border:`1px solid ${meta.color}44`,
          borderRadius:20, padding:'4px 12px', fontSize:10, fontWeight:700,
          cursor: isChanging ? 'not-allowed' : 'pointer',
          color:meta.color, fontFamily:'Montserrat,sans-serif',
          opacity: isChanging ? 0.6 : 1, letterSpacing:'0.3px', transition:'opacity 0.15s',
        }}
      >
        <span style={{ width:6, height:6, borderRadius:'50%', background: isChanging ? '#bbb' : meta.dot, flexShrink:0 }} />
        {isChanging ? '…' : meta.label}
        {!isChanging && <span style={{ fontSize:8, marginLeft:2, opacity:0.6 }}>▾</span>}
      </button>

      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:2000 }} />
          <div style={{
            position:'fixed',
            top:  pos.top,
            left: pos.left,
            zIndex:2001,
            background:'#fff', border:`1px solid ${COLORS.border}`,
            borderRadius:8,
            boxShadow: pos.openUpward ? '0 -4px 16px rgba(0,0,0,0.12)' : '0 4px 16px rgba(0,0,0,0.12)',
            minWidth:160, overflow:'hidden', fontFamily:'Montserrat,sans-serif',
          }}>
            {options.map((next, idx) => {
              const nm = statusMeta(next)
              return (
                <button
                  key={next}
                  onClick={() => { setOpen(false); onChangeStatus(event.entity_id, next) }}
                  style={{
                    width:'100%', textAlign:'left', background:'none',
                    border:'none',
                    borderBottom: idx < options.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                    padding:'10px 14px', cursor:'pointer',
                    fontSize:12, fontWeight:600, color:COLORS.text,
                    display:'flex', alignItems:'center', gap:8, transition:'background 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = nm.bg }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                >
                  <span style={{ width:7, height:7, borderRadius:'50%', background:nm.dot, flexShrink:0 }} />
                  {nm.label}
                </button>
              )
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EVENT FORM DRAWER (Nuovo / Duplica / Modifica)
// ---------------------------------------------------------------------------

function EventFormDrawer({ onClose, onSaved, clients, prefill, isEdit, handleApiResponse, onClientCreated }) {
  const BLANK_CLIENT = { ragione_sociale:'', partita_iva:'', referente_nome:'', referente_cognome:'', email:'', telefono:'', citta:'' }
  const [showNewClient,  setShowNewClient]  = useState(false)
  const [clientForm,     setClientForm]     = useState(BLANK_CLIENT)
  const [clientSaving,   setClientSaving]   = useState(false)
  const [clientError,    setClientError]    = useState(null)

  const setC = key => e => setClientForm(p => ({ ...p, [key]: e.target.value }))

  async function handleClientSave(e) {
    e.preventDefault()
    if (!clientForm.ragione_sociale.trim()) { setClientError('Ragione sociale obbligatoria'); return }
    setClientSaving(true); setClientError(null)
    const res = await clientApi.create(clientForm)
    setClientSaving(false)
    if (!res.success) { setClientError(res.error?.message || 'Errore creazione cliente'); return }
    const newClient = res.data.client
    onClientCreated?.(newClient)
    setForm(p => ({ ...p, client_id: newClient.entity_id }))
    setShowNewClient(false)
    setClientForm(BLANK_CLIENT)
  }

  const [form, setForm] = useState({
    titolo:             prefill?.titolo             ?? '',
    descrizione:        prefill?.descrizione        ?? '',
    data_inizio:        isEdit ? (prefill?.data_inizio ? prefill.data_inizio.slice(0,16) : '') : '',
    data_fine:          isEdit ? (prefill?.data_fine   ? prefill.data_fine.slice(0,16)   : '') : '',
    luogo:              prefill?.luogo              ?? '',
    citta:              prefill?.citta              ?? '',
    provincia:          prefill?.provincia          ?? '',
    client_id:          prefill?.client_id          ?? '',
    foto_url:           prefill?.foto_url           ?? '',
    hostess_richieste:  prefill?.hostess_richieste  ?? '',
    compenso:           prefill?.compenso           ?? '',
    compenso_importo:   prefill?.compenso_importo   ?? '',
    compenso_unita:     prefill?.compenso_unita     ?? '',
    steward_richiesti:  prefill?.steward_richiesti  ?? 0,
    anni_esperienza_minimi: prefill?.anni_esperienza_minimi ?? '',
    richiede_trasferte: prefill?.richiede_trasferte ?? false,
    richiede_weekend:   prefill?.richiede_weekend   ?? false,
    // Requisiti Talent
    sesso_richiesto:           prefill?.sesso_richiesto           ?? 'Indifferente',
    altezza_minima:            prefill?.altezza_minima            ?? '',
    taglia_richiesta:          prefill?.taglia_richiesta          ?? '',
    lingue_richieste:          prefill?.lingue_richieste          ?? [],
    ruoli_richiesti:           prefill?.ruoli_richiesti           ?? [],
    automunita:                prefill?.automunita                ?? 'Indifferente',
    priorita_lavorato_con_noi: prefill?.priorita_lavorato_con_noi ?? false,
  })
  const [richiedeStewarde, setRichiedeStewarde] = useState((prefill?.steward_richiesti ?? 0) > 0)
  const [saving, setSaving] = useState(false)
  const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }))
  const setCheck = key => e => setForm(p => ({ ...p, [key]: e.target.checked }))

  const save = async (e) => {
    e.preventDefault()
    if (!form.client_id) {
      alert('Seleziona un cliente per questo evento')
      return
    }
    if (!form.provincia) {
      alert('Seleziona la provincia dell\'evento')
      return
    }
    if (!form.citta || form.citta.trim().length < 2) {
      alert('Inserisci la città dell\'evento')
      return
    }
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
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:300 }} />
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
              <label style={LBL}>Cliente *</label>
              <select
                value={form.client_id}
                onChange={set('client_id')}
                style={{ ...COMPONENT_STYLES.input, borderColor: !form.client_id ? '#F97316' : undefined }}
              >
                <option value="">— Seleziona cliente —</option>
                {clients.map(c => <option key={c.entity_id} value={c.entity_id}>{c.data?.ragione_sociale}</option>)}
              </select>
              {!form.client_id && (
                <div style={{ fontSize:11, color:'#C2410C', marginTop:3 }}>Obbligatorio</div>
              )}
              <button
                type="button"
                onClick={() => { setClientError(null); setShowNewClient(true) }}
                style={{
                  background: 'none', border: 'none', color: COLORS.accent,
                  fontSize: 12, cursor: 'pointer', padding: '4px 0',
                  marginTop: 4, textDecoration: 'underline', fontFamily: 'Montserrat,sans-serif',
                }}
              >
                ⊕ Crea nuovo cliente
              </button>

              {showNewClient && createPortal(
                <>
                  <div
                    style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:302 }}
                  />
                  <div style={{
                    position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                    zIndex:303, background:'#fff', borderRadius:8, padding:28, width:420, maxWidth:'92vw',
                    fontFamily:'Montserrat,sans-serif', boxShadow:'0 8px 48px rgba(0,0,0,0.28)',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                      <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#1A1A2E' }}>Nuovo cliente</h3>
                      <button onClick={() => setShowNewClient(false)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#666', lineHeight:1 }}>✕</button>
                    </div>
                    <form onSubmit={handleClientSave}>
                      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                        {[
                          { label:'Ragione sociale *', key:'ragione_sociale', required:true },
                          { label:'Partita IVA',       key:'partita_iva' },
                          { label:'Referente nome',    key:'referente_nome' },
                          { label:'Referente cognome', key:'referente_cognome' },
                          { label:'Email',             key:'email',    type:'email' },
                          { label:'Telefono',          key:'telefono' },
                          { label:'Città',             key:'citta' },
                        ].map(({ label, key, required, type }) => (
                          <div key={key}>
                            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#444', marginBottom:3, textTransform:'uppercase', letterSpacing:0.5 }}>{label}</label>
                            <input
                              type={type || 'text'}
                              value={clientForm[key]}
                              onChange={setC(key)}
                              required={!!required}
                              style={{
                                width:'100%', padding:'8px 10px', border:'1px solid #ddd', borderRadius:4,
                                fontSize:13, fontFamily:'Montserrat,sans-serif', boxSizing:'border-box',
                                outline:'none',
                              }}
                            />
                          </div>
                        ))}
                        {clientError && <p style={{ margin:0, fontSize:12, color:'#C62828' }}>{clientError}</p>}
                        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                          <button
                            type="button" onClick={() => setShowNewClient(false)}
                            style={{ padding:'8px 18px', border:'1px solid #ddd', borderRadius:4, background:'none', fontSize:13, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}
                          >Annulla</button>
                          <button
                            type="submit" disabled={clientSaving}
                            style={{ padding:'8px 18px', border:'none', borderRadius:4, background: clientSaving ? '#ccc' : COLORS.accent, color:'#fff', fontSize:13, fontWeight:600, cursor: clientSaving ? 'default' : 'pointer', fontFamily:'Montserrat,sans-serif' }}
                          >{clientSaving ? 'Salvataggio…' : 'Crea cliente'}</button>
                        </div>
                      </div>
                    </form>
                  </div>
                </>,
                document.body
              )}
            </div>

            <CittaProvinciaSelect
              label="Località evento"
              citta={form.citta}
              provincia={form.provincia}
              onChange={({ citta, provincia }) => setForm(p => ({ ...p, citta, provincia }))}
              required
            />
            <Input label="Indirizzo/Sede" value={form.luogo} onChange={set('luogo')} placeholder="Indirizzo dettagliato (via, numero, padiglione)" />
            <Input label="Data inizio *" type="datetime-local" value={form.data_inizio} onChange={set('data_inizio')} required={!isEdit} />
            <Input label="Data fine" type="datetime-local" value={form.data_fine} onChange={set('data_fine')} />

            <div className="grid-2-collapse" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Input label="Hostess richieste" type="number" min="0" value={form.hostess_richieste} onChange={set('hostess_richieste')} placeholder="es. 10" />
              <Input label="Min. anni esperienza" type="number" min="0" value={form.anni_esperienza_minimi} onChange={set('anni_esperienza_minimi')} placeholder="es. 2" />
            </div>
            <Input label="Compenso (€)" value={form.compenso} onChange={set('compenso')} placeholder="es. €42,00 netti" />
            <div className="grid-2-collapse" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Input label="Importo compenso (€)" type="number" min="0" step="0.01" value={form.compenso_importo} onChange={set('compenso_importo')} placeholder="es. 42,00" />
              <div>
                <label style={{ display:'block', fontSize:12, color:COLORS.textSecondary, marginBottom:6 }}>Unità compenso</label>
                <select value={form.compenso_unita} onChange={set('compenso_unita')} style={{ width:'100%', padding:'10px 12px', fontSize:14, border:`1px solid ${COLORS.border}`, borderRadius:4, background:'#fff' }}>
                  <option value="">—</option>
                  <option value="orario">Orario</option>
                  <option value="forfait">Forfait</option>
                </select>
              </div>
            </div>

            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
              fontSize: 13, color: COLORS.textSecondary, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={richiedeStewarde}
                onChange={(e) => {
                  setRichiedeStewarde(e.target.checked)
                  if (!e.target.checked) setForm(prev => ({ ...prev, steward_richiesti: 0 }))
                }}
              />
              Servono anche steward
            </label>

            {richiedeStewarde && (
              <Input
                label="Steward richiesti"
                type="number"
                min="1"
                value={form.steward_richiesti || ''}
                onChange={(e) => setForm(prev => ({ ...prev, steward_richiesti: parseInt(e.target.value) || 0 }))}
              />
            )}

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

            {/* ── REQUISITI TALENT ── */}
            <div style={{ paddingTop:12, borderTop:`1px solid ${COLORS.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:12 }}>
                Requisiti Talent
              </div>

              <div className="grid-2-collapse" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={LBL}>Sesso richiesto</label>
                  <select value={form.sesso_richiesto} onChange={set('sesso_richiesto')} style={{ ...COMPONENT_STYLES.input }}>
                    <option value="Indifferente">Indifferente</option>
                    <option value="F">Femminile</option>
                    <option value="M">Maschile</option>
                  </select>
                </div>
                <div>
                  <label style={LBL}>Automunita</label>
                  <select value={form.automunita} onChange={set('automunita')} style={{ ...COMPONENT_STYLES.input }}>
                    <option value="Indifferente">Indifferente</option>
                    <option value="Sì">Richiesta</option>
                    <option value="No">Non necessaria</option>
                  </select>
                </div>
                <Input label="Altezza minima (cm)" type="number" min="140" max="220" value={form.altezza_minima} onChange={set('altezza_minima')} placeholder="es. 170" />
                <div>
                  <label style={LBL}>Taglia</label>
                  <select value={form.taglia_richiesta} onChange={set('taglia_richiesta')} style={{ ...COMPONENT_STYLES.input }}>
                    <option value="">Qualsiasi</option>
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop:12 }}>
                <label style={LBL}>Lingue richieste</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
                  {['Italiano','Inglese','Francese','Spagnolo','Tedesco'].map(lang => (
                    <label key={lang} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, cursor:'pointer' }}>
                      <input
                        type="checkbox"
                        checked={(form.lingue_richieste ?? []).includes(lang)}
                        onChange={e => {
                          const cur = form.lingue_richieste ?? []
                          setForm(p => ({ ...p, lingue_richieste: e.target.checked ? [...cur, lang] : cur.filter(l => l !== lang) }))
                        }}
                      />
                      {lang}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginTop:12 }}>
                <label style={LBL}>Ruolo richiesto</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
                  {['Accoglienza','Accrediti','Guardaroba','Promoter','Modella','Coordinatrice'].map(ruolo => (
                    <label key={ruolo} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, cursor:'pointer' }}>
                      <input
                        type="checkbox"
                        checked={(form.ruoli_richiesti ?? []).includes(ruolo)}
                        onChange={e => {
                          const cur = form.ruoli_richiesti ?? []
                          setForm(p => ({ ...p, ruoli_richiesti: e.target.checked ? [...cur, ruolo] : cur.filter(r => r !== ruolo) }))
                        }}
                      />
                      {ruolo}
                    </label>
                  ))}
                </div>
              </div>

              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer', marginTop:12 }}>
                <input
                  type="checkbox"
                  checked={form.priorita_lavorato_con_noi ?? false}
                  onChange={e => setForm(p => ({ ...p, priorita_lavorato_con_noi: e.target.checked }))}
                />
                Priorità talent che hanno già lavorato con noi
              </label>
            </div>
          </div>

          <div style={{ marginTop:24, display:'flex', gap:10, flexWrap:'wrap' }}>
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
// MATCH SCORE (front-end, mirrors backend calculateEventMatch, zero latency)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SHIFT SECTION — turni multipli per evento
// ---------------------------------------------------------------------------

function ShiftSection({ eventId, handleApiResponse }) {
  const BG = '#0E0E16'; const BD = '#2A2A3A'; const TEXT = '#E8E8F0'; const MUTED = '#8888A0'

  const [open,          setOpen]          = useState(false)
  const [shifts,        setShifts]        = useState([])
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [showAddForm,   setShowAddForm]   = useState(false)
  const [addForm,       setAddForm]       = useState({
    data:'', orario_inizio:'', orario_fine:'',
    posti_disponibili:'1', ruolo:'Hostess', dress_code:'', note_operational:'',
  })
  const [saving,     setSaving]     = useState(false)
  const [cancelling, setCancelling] = useState(null)

  const loadShifts = useCallback(async () => {
    setLoadingShifts(true)
    const res = handleApiResponse(await shiftApi.list({ event_id: eventId }))
    setLoadingShifts(false)
    if (res.success) setShifts(res.data?.items ?? [])
  }, [eventId, handleApiResponse])

  useEffect(() => { loadShifts() }, [loadShifts])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    const res = handleApiResponse(await shiftApi.create({
      event_id:          eventId,
      data:              addForm.data,
      orario_inizio:     addForm.orario_inizio,
      orario_fine:       addForm.orario_fine,
      posti_disponibili: Number(addForm.posti_disponibili) || 1,
      ruolo:             addForm.ruolo,
      dress_code:        addForm.dress_code,
      note_operational:  addForm.note_operational,
    }))
    setSaving(false)
    if (res.success) {
      setShowAddForm(false)
      setAddForm({ data:'', orario_inizio:'', orario_fine:'', posti_disponibili:'1', ruolo:'Hostess', dress_code:'', note_operational:'' })
      loadShifts()
    } else {
      alert(getErrorMessage(res.error))
    }
  }

  const handleCancelShift = async (shiftId) => {
    if (!window.confirm('Annullare questo turno?')) return
    setCancelling(shiftId)
    handleApiResponse(await shiftApi.updateStatus(shiftId, 'CANCELLED'))
    setCancelling(null)
    loadShifts()
  }

  const statusBadge = (status) => {
    const MAP = {
      OPEN:      { label:'Aperto',    bg:'#166534', color:'#86EFAC' },
      FULL:      { label:'Completo',  bg:'#92400E', color:'#FCD34D' },
      CLOSED:    { label:'Chiuso',    bg:'#374151', color:'#9CA3AF' },
      CANCELLED: { label:'Annullato', bg:'#7F1D1D', color:'#FCA5A5' },
    }
    const s = MAP[status] || { label: status, bg:'#1A1A24', color:MUTED }
    return (
      <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:8, background:s.bg, color:s.color, letterSpacing:'0.5px', textTransform:'uppercase' }}>
        {s.label}
      </span>
    )
  }

  const fmtShiftDate = (iso) => {
    if (!iso) return '—'
    try { return new Date(iso).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' }) }
    catch { return iso }
  }

  const inp = { background:'#111118', border:`1px solid ${BD}`, color:TEXT, borderRadius:5, padding:'7px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none', width:'100%', boxSizing:'border-box' }
  const setF = key => e => setAddForm(p => ({ ...p, [key]: e.target.value }))

  return (
    <div style={{ borderTop:`1px solid ${BD}`, borderBottom:`1px solid ${BD}`, marginTop:10, marginBottom:4 }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width:'100%', background:'none', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', fontFamily:'Montserrat,sans-serif' }}
      >
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', color:MUTED }}>
          📅 Turni {loadingShifts ? '…' : `(${shifts.length})`}
        </span>
        <span style={{ fontSize:10, color:MUTED }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ paddingBottom:12 }}>
          {/* Lista turni */}
          {shifts.length === 0 && !loadingShifts ? (
            <div style={{ fontSize:12, color:MUTED, fontStyle:'italic', marginBottom:10 }}>Nessun turno. Aggiungine uno.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
              {shifts.map(s => {
                const sd = s.data ?? {}
                const postiConfermati  = sd.posti_confermati ?? 0          // contratto firmato
                const postiApprovati   = sd.posti_approvati ?? postiConfermati   // posto occupato (anche in attesa di firma)
                const postiDisponibili = sd.posti_disponibili ?? 0
                const postiPieno = postiApprovati >= postiDisponibili
                return (
                  <div key={s.entity_id} style={{ background:'#1A1A24', borderRadius:7, padding:'9px 12px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:TEXT }}>
                        {fmtShiftDate(sd.data)}&nbsp;·&nbsp;{sd.orario_inizio || '—'} → {sd.orario_fine || '—'}
                      </div>
                      <div style={{ fontSize:11, color:MUTED, marginTop:2, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span>{sd.ruolo || '—'}</span>
                        <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:8, background: postiPieno ? '#7F1D1D' : '#166534', color: postiPieno ? '#FCA5A5' : '#86EFAC', letterSpacing:'0.5px' }}>
                          {postiApprovati} approvati · {postiConfermati} confermati / {postiDisponibili} posti
                        </span>
                        {sd.dress_code && <span>·&nbsp;{sd.dress_code}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                      {statusBadge(s.status)}
                      {s.status === 'OPEN' && (
                        <button
                          onClick={() => handleCancelShift(s.entity_id)}
                          disabled={cancelling === s.entity_id}
                          style={{ background:'none', border:'1px solid #7F1D1D', color:'#FCA5A5', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', fontFamily:'Montserrat,sans-serif', opacity: cancelling === s.entity_id ? 0.5 : 1 }}
                        >
                          {cancelling === s.entity_id ? '…' : '✕ Annulla'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add form toggle */}
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              style={{ fontSize:11, fontWeight:600, color:'#630E33', background:'none', border:'1px dashed #630E33', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}
            >
              + Aggiungi turno
            </button>
          ) : (
            <form onSubmit={handleCreate} style={{ background:'#1A1A24', borderRadius:8, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8, marginTop:6 }}>
              <div className="grid-3-collapse" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                <div>
                  <div style={{ fontSize:10, color:MUTED, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Data *</div>
                  <input type="date" required value={addForm.data} onChange={setF('data')} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize:10, color:MUTED, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Ora inizio *</div>
                  <input type="time" required value={addForm.orario_inizio} onChange={setF('orario_inizio')} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize:10, color:MUTED, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Ora fine *</div>
                  <input type="time" required value={addForm.orario_fine} onChange={setF('orario_fine')} style={inp} />
                </div>
              </div>
              <div className="grid-2-collapse" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div>
                  <div style={{ fontSize:10, color:MUTED, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Posti *</div>
                  <input type="number" min="1" required value={addForm.posti_disponibili} onChange={setF('posti_disponibili')} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize:10, color:MUTED, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Ruolo *</div>
                  <select value={addForm.ruolo} onChange={setF('ruolo')} style={inp}>
                    {['Hostess','Steward','Modella','Promoter'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, color:MUTED, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Dress code</div>
                <input value={addForm.dress_code} onChange={setF('dress_code')} placeholder="es. Abito nero elegante" style={inp} />
              </div>
              <div>
                <div style={{ fontSize:10, color:MUTED, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Note operative</div>
                <input value={addForm.note_operational} onChange={setF('note_operational')} placeholder="Istruzioni per il turno" style={inp} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                <button type="button" onClick={() => setShowAddForm(false)} style={{ background:'none', border:`1px solid ${BD}`, color:MUTED, borderRadius:6, padding:'7px 14px', fontSize:11, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>
                  Annulla
                </button>
                <button type="submit" disabled={saving} style={{ background: saving ? '#333' : '#630E33', color:'#fff', border:'none', borderRadius:6, padding:'7px 16px', fontSize:11, fontWeight:700, cursor: saving ? 'wait' : 'pointer', fontFamily:'Montserrat,sans-serif' }}>
                  {saving ? 'Salvataggio…' : 'Crea turno'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// TALENT EVENT DRAWER — 3 tab: Potenziali / In Attesa / Approvati
// ---------------------------------------------------------------------------

const APPLICATION_STATUS_RANK = {
  REJECTED: 0, WITHDRAWN: 0,
  PENDING: 1, INVITED: 1,
  DOCS_REQUESTED: 2,
  DOCS_RECEIVED: 3,
  APPROVED: 4,
}

function TalentEventDrawer({ event, allTalents, onClose, handleApiResponse, initialTab = 'potenziali' }) {
  const d = event.data ?? {}
  const [tab,           setTab]           = useState(initialTab)
  const [applications,  setApplications]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [contractPanel,   setContractPanel]   = useState(null) // { applicationId, talentId, talentName } | null
  const [markingCompleted, setMarkingCompleted] = useState(null)
  const [profileModal,    setProfileModal]    = useState(null) // { t, matchPct } | null
  const [showExtraProvincia, setShowExtraProvincia] = useState(false)
  const [shifts,        setShifts]        = useState([])

  const loadApps = useCallback(async () => {
    setLoading(true)
    const res = handleApiResponse(await applicationApi.list({ event_id: event.entity_id }))
    setLoading(false)
    if (res.success) setApplications(res.data?.items ?? [])
  }, [event.entity_id, handleApiResponse])

  const loadShifts = useCallback(async () => {
    const res = handleApiResponse(await shiftApi.list({ event_id: event.entity_id }))
    if (res.success) setShifts(res.data?.items ?? [])
  }, [event.entity_id, handleApiResponse])

  useEffect(() => { loadApps() }, [loadApps])
  useEffect(() => { loadShifts() }, [loadShifts])

  const handleAssignShift = async (appId, shiftId) => {
    setActionLoading(appId + '_as')
    const res = handleApiResponse(await applicationApi.assignShift(appId, shiftId))
    setActionLoading(null)
    if (res.success) {
      await Promise.all([loadApps(), loadShifts()])
    } else {
      alert(getErrorMessage(res.error))
    }
  }

  // Sync tab when initialTab prop changes (e.g. click on saturation count)
  useEffect(() => { setTab(initialTab) }, [initialTab])

  // Talent lookup: entity_id → talent
  const talentMap = useMemo(() => {
    const m = {}
    allTalents.forEach(t => { m[t.entity_id] = t })
    return m
  }, [allTalents])

  // Split applications by status + collect applied IDs
  const { pendingApps, approvedApps, appliedIds } = useMemo(() => {
    // Dedup: un talent può avere più APPLICATION sullo stesso evento (una per shift/turno).
    // Tieni solo quella con lo status più avanzato nel workflow.
    const byTalent = new Map()
    applications.forEach(a => {
      const tid = a.data?.talent_profile_id
      if (!tid) return
      const existing = byTalent.get(tid)
      const rank = APPLICATION_STATUS_RANK[a.status] ?? 0
      if (!existing || rank > (APPLICATION_STATUS_RANK[existing.status] ?? 0)) {
        byTalent.set(tid, a)
      }
    })
    const deduped = Array.from(byTalent.values())

    const pendingApps  = []
    const approvedApps = []
    const appliedIds   = new Set()
    deduped.forEach(a => {
      appliedIds.add(a.data.talent_profile_id)
      const s = a.status
      if (s === 'PENDING' || s === 'INVITED') pendingApps.push(a)
      else if (s === 'APPROVED')              approvedApps.push(a)
    })
    return { pendingApps, approvedApps, appliedIds }
  }, [applications])

  // allTalents (prop) è troncato alla prima pagina APPROVED (vedi handleTalentList
  // lato backend, che pagina PRIMA di filtrare per status) — per le tab Attesa/
  // Approvati, che elencano application su talent già approvati, il profilo può
  // mancare da talentMap anche se il talent è regolarmente approvato. Fetch
  // esplicito dei profili mancanti per entity_id, in batch, per completare la map.
  const [fetchedTalents, setFetchedTalents] = useState({})
  const fetchAttemptedRef = useRef(new Set())

  useEffect(() => {
    const missingIds = Array.from(new Set(
      [...pendingApps, ...approvedApps]
        .map(a => a.data?.talent_profile_id)
        .filter(id => id && !talentMap[id] && !fetchAttemptedRef.current.has(id))
    ))
    if (missingIds.length === 0) return
    missingIds.forEach(id => fetchAttemptedRef.current.add(id))

    let cancelled = false
    Promise.all(missingIds.map(id =>
      talentApi.get(id).then(r => ({ id, res: handleApiResponse(r) }))
    )).then(results => {
      if (cancelled) return
      setFetchedTalents(prev => {
        const next = { ...prev }
        results.forEach(({ id, res }) => {
          if (res.success && res.data?.talent) next[id] = res.data.talent
        })
        return next
      })
    })
    return () => { cancelled = true }
  }, [pendingApps, approvedApps, talentMap, handleApiResponse])

  const mergedTalentMap = useMemo(() => ({ ...talentMap, ...fetchedTalents }), [talentMap, fetchedTalents])

  // TAB A — talent APPROVED non ancora candidati, filtrati per requisiti evento + match %
  const potenziali = useMemo(() => {
    const luogo = (d.luogo ?? '').toUpperCase()
    return allTalents
      .filter(t => {
        if (appliedIds.has(t.entity_id)) return false
        const td = t.data ?? {}

        // Geo: province_lavoro o città vs luogo evento, o disponibilità trasferte
        const provinces = td.province_lavoro ?? td.province_operativita ?? []
        const cityMatch = provinces.some(p => luogo.includes(p.toUpperCase())) ||
          (td.citta && luogo.includes(td.citta.toUpperCase()))
        if (!cityMatch && td.disponibilita_trasferte !== 'Sì') return false

        if (d.richiede_weekend   && td.disponibilita_weekend   !== 'Sì') return false
        if (d.richiede_trasferte && td.disponibilita_trasferte !== 'Sì') return false

        const minEsp = Number(d.anni_esperienza_minimi) || 0
        if (minEsp > 0 && parseEsperienza(td.anni_esperienza_settore) < minEsp) return false

        if (d.sesso_richiesto && d.sesso_richiesto !== 'Indifferente') {
          if ((td.genere || td.sesso) && (td.genere || td.sesso) !== d.sesso_richiesto) return false
        }
        if (d.altezza_minima && Number(td.altezza) < Number(d.altezza_minima)) return false
        if (d.automunita && d.automunita !== 'Indifferente') {
          if (d.automunita === 'Sì' && td.automunita !== 'Sì') return false
        }
        if ((d.lingue_richieste ?? []).length > 0) {
          const talentLingue = [
            td.lingua_inglese, td.lingua_francese, td.lingua_spagnolo, td.lingua_tedesco,
            ...((td.altre_lingue ?? []).map(l => l.nome || '')),
            ...((td.lingue ?? []).map(l => typeof l === 'string' ? l : (l.nome || ''))),
          ].filter(Boolean).map(l => l.toLowerCase())
          if (!d.lingue_richieste.every(l => talentLingue.some(tl => tl.includes(l.toLowerCase())))) return false
        }

        return true
      })
      .map(t => ({ ...t, _matchPct: computeMatchPct(d, t.data ?? {}) }))
      .sort((a, b) => b._matchPct - a._matchPct || (Number(b.data?.score) || 0) - (Number(a.data?.score) || 0))
  }, [allTalents, appliedIds, d])

  // Split potenziali per zona — provincia evento (d.provincia) vs province_lavoro
  // del talent — per evidenziare i match geografici in cima.
  const { potenzialiInZona, potenzialiExtraProvincia } = useMemo(() => {
    const provincia = d.provincia
    if (!provincia) return { potenzialiInZona: potenziali, potenzialiExtraProvincia: [] }
    const inZona = []
    const extra  = []
    potenziali.forEach(t => {
      const provs = t.data?.province_lavoro ?? t.data?.province_operativita ?? []
      if (provs.includes(provincia)) inZona.push(t)
      else extra.push(t)
    })
    return { potenzialiInZona: inZona, potenzialiExtraProvincia: extra }
  }, [potenziali, d.provincia])

  const handleInvite = async (talentId) => {
    setActionLoading(talentId)
    const res = handleApiResponse(await applicationApi.invite(talentId, event.entity_id))
    setActionLoading(null)
    if (res.success) await loadApps()
    else alert(getErrorMessage(res.error))
  }

  const handleApprove = async (appId) => {
    setActionLoading(appId + '_ap')
    const res = handleApiResponse(await applicationApi.approve(appId))
    setActionLoading(null)
    if (res.success) loadApps()
    else alert(getErrorMessage(res.error))
  }

  const handleReject = async (appId) => {
    setActionLoading(appId + '_rj')
    const res = handleApiResponse(await applicationApi.reject(appId))
    setActionLoading(null)
    if (res.success) loadApps()
    else alert(getErrorMessage(res.error))
  }

  // Ultimo contratto di ogni candidatura dell'evento (badge sulla riga)
  const { byApp: contractsByApp, reload: reloadContracts } = useApplicationContracts([event.entity_id], handleApiResponse)

  const handleRevoke = async (appId) => {
    if (!window.confirm('Sei sicuro di voler annullare?')) return
    setActionLoading(appId + '_rv')
    const res = handleApiResponse(await applicationApi.revoke(appId))
    setActionLoading(null)
    if (res.success) loadApps()
    else alert(getErrorMessage(res.error))
  }

  const handleMarkCompleted = async (applicationId) => {
    if (!window.confirm('Confermi che questo evento è stato completato per questo talent?')) return
    setMarkingCompleted(applicationId)
    const res = handleApiResponse(await applicationApi.markEventCompleted(applicationId))
    setMarkingCompleted(null)
    if (res.success) {
      await loadApps()
    } else {
      alert(getErrorMessage(res.error))
    }
  }

  const TABS = [
    { key:'potenziali', label:`Potenziali (${potenziali.length})` },
    { key:'attesa',     label:`In Attesa (${pendingApps.length})` },
    { key:'approvati',  label:`Approvati (${approvedApps.length})` },
  ]
  const BG = '#0E0E16'; const BD = '#2A2A3A'; const TEXT = '#E8E8F0'; const MUTED = '#8888A0'

  // Mini talent row component (defined inline to use closure vars)
  const TRow = ({ t, app, matchPct, children, dangerAction }) => {
    const [rowHovered, setRowHovered] = useState(false)
    const td   = t?.data ?? app?.data ?? {}
    const nome = td.nome ? `${td.nome} ${td.cognome ?? ''}`.trim() : (app?.data?.talent_name ?? '—')
    const badgeColor = matchPct >= 80 ? '#16A34A' : matchPct >= 60 ? '#D97706' : '#6B7280'
    return (
      <div
        onMouseEnter={dangerAction ? () => setRowHovered(true) : undefined}
        onMouseLeave={dangerAction ? () => setRowHovered(false) : undefined}
        style={{
          background: dangerAction && rowHovered ? 'rgba(229,62,62,0.08)' : '#1A1A24',
          borderRadius:8, padding:'12px 14px', display:'flex', gap:12, alignItems:'center', flexWrap:'wrap',
          transition:'background 0.15s',
        }}
      >
        <TalentAvatar nome={nome} fotoUrl={td.foto_busto_url} size={40} />
        <div style={{ flex:1, minWidth:140 }}>
          <div style={{ fontSize:13, fontWeight:600, color:TEXT, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            {nome}
            {matchPct != null && (
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:badgeColor, color:'#fff', flexShrink:0 }}>
                {matchPct}% match
              </span>
            )}
          </div>
          <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>
            {td.citta ?? '—'}{td.score != null ? ` · score ${td.score}` : ''}
          </div>
          {td.score != null && <div style={{ marginTop:4 }}><ScoreBar score={td.score} /></div>}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end', alignItems:'center', marginLeft:'auto' }}>
          {t && (
            <button
              onClick={() => setProfileModal({ t, matchPct })}
              style={BTN('#8888A0')}
              title="Vedi profilo rapido"
            >
              Profilo
            </button>
          )}
          {children}
          {dangerAction && (
            <button
              onClick={dangerAction.onClick}
              disabled={dangerAction.busy}
              style={{
                ...BTN('#e53e3e'), color:'#e53e3e',
                opacity: rowHovered ? (dangerAction.busy ? 0.6 : 1) : 0,
                pointerEvents: rowHovered ? 'auto' : 'none',
                transition:'opacity 0.15s',
                cursor: dangerAction.busy ? 'wait' : 'pointer',
              }}
              title="Annulla turno"
            >
              {dangerAction.busy ? '…' : '✕'}
            </button>
          )}
        </div>
      </div>
    )
  }

  const BTN = (color) => ({
    background:'none', border:`1px solid ${color}`, color,
    borderRadius:6, padding:'5px 10px', fontSize:11,
    cursor:'pointer', fontFamily:'Montserrat,sans-serif', whiteSpace:'nowrap',
  })

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300 }} />
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:540, maxWidth:'96vw',
        background:BG, borderLeft:`1px solid ${BD}`,
        zIndex:301, display:'flex', flexDirection:'column',
        fontFamily:'Montserrat, sans-serif',
      }}>
        {/* Header */}
        <div style={{ padding:'24px 28px 0', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
            <div>
              <h2 style={{ fontSize:17, fontWeight:700, margin:0, color:TEXT }}>Talent per evento</h2>
              <div style={{ fontSize:12, color:MUTED, marginTop:3 }}>{d.titolo}</div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:MUTED, fontSize:18, cursor:'pointer', padding:'4px 8px', lineHeight:1 }}>✕</button>
          </div>

          {/* Requisiti pillole */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
            {d.luogo            && <span style={{ fontSize:10, background:'#1A1A24', color:MUTED, padding:'2px 8px', borderRadius:10 }}>📍 {d.luogo}</span>}
            {d.richiede_trasferte && <span style={{ fontSize:10, background:'#1A1A24', color:MUTED, padding:'2px 8px', borderRadius:10 }}>Trasferte</span>}
            {d.richiede_weekend   && <span style={{ fontSize:10, background:'#1A1A24', color:MUTED, padding:'2px 8px', borderRadius:10 }}>Weekend</span>}
            {Number(d.anni_esperienza_minimi) > 0 && <span style={{ fontSize:10, background:'#1A1A24', color:MUTED, padding:'2px 8px', borderRadius:10 }}>Esp. ≥ {d.anni_esperienza_minimi}y</span>}
            {d.sesso_richiesto && d.sesso_richiesto !== 'Indifferente' && <span style={{ fontSize:10, background:'#1A1A24', color:MUTED, padding:'2px 8px', borderRadius:10 }}>Sesso: {d.sesso_richiesto}</span>}
            {d.altezza_minima  && <span style={{ fontSize:10, background:'#1A1A24', color:MUTED, padding:'2px 8px', borderRadius:10 }}>Altezza ≥ {d.altezza_minima}cm</span>}
            {(d.lingue_richieste ?? []).map(l => <span key={l} style={{ fontSize:10, background:'#1A1A24', color:MUTED, padding:'2px 8px', borderRadius:10 }}>{l}</span>)}
          </div>

          <ShiftSection eventId={event.entity_id} handleApiResponse={handleApiResponse} />

          {/* Tab switcher */}
          <div style={{ display:'flex', borderBottom:`1px solid ${BD}` }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding:'10px 14px', fontSize:12, fontWeight:600,
                background:'none', border:'none', cursor:'pointer',
                borderBottom: tab === t.key ? '2px solid #630E33' : '2px solid transparent',
                color: tab === t.key ? '#E8B4BC' : MUTED,
                fontFamily:'Montserrat,sans-serif', marginBottom:-1,
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 28px 24px' }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner" /></div>
          ) : tab === 'potenziali' ? (
            potenziali.length === 0 ? (
              <div style={{ color:MUTED, fontSize:13, textAlign:'center', marginTop:40 }}>
                Nessun talent compatibile con i requisiti di questo evento.
              </div>
            ) : (
              <>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:MUTED, marginBottom:8 }}>
                  In zona
                </div>
                {potenzialiInZona.length === 0 ? (
                  <div style={{ color:MUTED, fontSize:12, marginBottom:10 }}>Nessun talent in zona.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {potenzialiInZona.map(t => (
                      <TRow key={t.entity_id} t={t} matchPct={t._matchPct}>
                        <button
                          onClick={() => actionLoading !== t.entity_id && handleInvite(t.entity_id)}
                          disabled={actionLoading === t.entity_id}
                          style={{ ...BTN('#630E33'), color:'#E8B4BC', opacity: actionLoading === t.entity_id ? 0.5 : 1 }}
                        >
                          {actionLoading === t.entity_id ? '…' : 'Invita'}
                        </button>
                      </TRow>
                    ))}
                  </div>
                )}

                {potenzialiExtraProvincia.length > 0 && (
                  <div style={{ marginTop:14 }}>
                    <button
                      type="button"
                      onClick={() => setShowExtraProvincia(v => !v)}
                      style={{ background:'none', border:'none', color:'#E8B4BC', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Montserrat,sans-serif', padding:0, marginBottom: showExtraProvincia ? 10 : 0 }}
                    >
                      {showExtraProvincia
                        ? '← Nascondi extra provincia'
                        : `Mostra altri talent → (${potenzialiExtraProvincia.length} extra provincia)`}
                    </button>
                    {showExtraProvincia && (
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:MUTED, marginBottom:8 }}>
                          Extra provincia
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                          {potenzialiExtraProvincia.map(t => (
                            <TRow key={t.entity_id} t={t} matchPct={t._matchPct}>
                              <button
                                onClick={() => actionLoading !== t.entity_id && handleInvite(t.entity_id)}
                                disabled={actionLoading === t.entity_id}
                                style={{ ...BTN('#630E33'), color:'#E8B4BC', opacity: actionLoading === t.entity_id ? 0.5 : 1 }}
                              >
                                {actionLoading === t.entity_id ? '…' : 'Invita'}
                              </button>
                            </TRow>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          ) : tab === 'attesa' ? (
            pendingApps.length === 0 ? (
              <div style={{ color:MUTED, fontSize:13, textAlign:'center', marginTop:40 }}>
                Nessuna candidatura in attesa.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {pendingApps.map(a => (
                  <TRow key={a.entity_id} t={mergedTalentMap[a.data?.talent_profile_id]} app={a} matchPct={computeMatchPct(d, mergedTalentMap[a.data?.talent_profile_id]?.data ?? {})}>
                    <button
                      onClick={() => handleApprove(a.entity_id)}
                      disabled={!!(actionLoading)}
                      style={{ ...BTN('#10B981'), opacity: actionLoading === a.entity_id + '_ap' ? 0.5 : 1 }}
                    >
                      {actionLoading === a.entity_id + '_ap' ? '…' : 'Accetta'}
                    </button>
                    <button
                      onClick={() => handleReject(a.entity_id)}
                      disabled={!!(actionLoading)}
                      style={{ ...BTN('#EF4444'), opacity: actionLoading === a.entity_id + '_rj' ? 0.5 : 1 }}
                    >
                      {actionLoading === a.entity_id + '_rj' ? '…' : 'Rifiuta'}
                    </button>
                  </TRow>
                ))}
              </div>
            )
          ) : ( /* tab === 'approvati' */
            approvedApps.length === 0 ? (
              <div style={{ color:MUTED, fontSize:13, textAlign:'center', marginTop:40 }}>
                Nessun talent approvato per questo evento.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {approvedApps.map(a => {
                  const t = mergedTalentMap[a.data?.talent_profile_id]
                  const mcBusy = markingCompleted === a.entity_id
                  const rvBusy = actionLoading === a.entity_id + '_rv'
                  const asBusy = actionLoading === a.entity_id + '_as'
                  return (
                    <TRow
                      key={a.entity_id} t={t} app={a} matchPct={computeMatchPct(d, t?.data ?? {})}
                      dangerAction={{ onClick: () => handleRevoke(a.entity_id), busy: rvBusy }}
                    >
                      <select
                        value={a.data?.shift_id || ''}
                        disabled={asBusy}
                        onChange={e => handleAssignShift(a.entity_id, e.target.value)}
                        style={{ ...BTN('#6b7280'), color: a.data?.shift_id ? TEXT : MUTED, background:'#1A1A24', maxWidth:170, opacity: asBusy ? 0.6 : 1 }}
                        title="Assegna turno"
                      >
                        <option value="">— Nessun turno —</option>
                        {shifts.map(s => {
                          const sd = s.data ?? {}
                          const dataFmt = sd.data ? new Date(sd.data).toLocaleDateString('it-IT', { day:'2-digit', month:'short' }) : '—'
                          return (
                            <option key={s.entity_id} value={s.entity_id}>
                              {dataFmt} {sd.orario_inizio}→{sd.orario_fine} · {sd.ruolo} ({sd.posti_approvati ?? sd.posti_confermati ?? 0} appr. · {sd.posti_confermati ?? 0} conf. / {sd.posti_disponibili ?? 0} posti)
                            </option>
                          )
                        })}
                      </select>
                      <ContractBadge contract={contractsByApp[a.entity_id]} />
                      <button
                        onClick={() => setContractPanel({ applicationId: a.entity_id, talentId: a.data?.talent_profile_id, talentName: `${t?.data?.nome ?? ''} ${t?.data?.cognome ?? ''}`.trim() })}
                        style={{ ...BTN('#C8A96E'), color:'#C8A96E' }}
                        title="Contratto: genera, anteprima, invia al talent"
                      >
                        Contratto
                      </button>
                      {a.data?.evento_completato ? (
                        <span style={{ fontSize:10, color:'#16A34A', fontWeight:700, whiteSpace:'nowrap', padding:'5px 6px' }}>✓ Done</span>
                      ) : (
                        <button
                          onClick={() => handleMarkCompleted(a.entity_id)}
                          disabled={mcBusy}
                          style={{ ...BTN('#16A34A'), color:'#16A34A', opacity: mcBusy ? 0.5 : 1 }}
                          title="Segna evento completato per questo talent"
                        >
                          {mcBusy ? '…' : '✓'}
                        </button>
                      )}
                    </TRow>
                  )
                })}
              </div>
            )
          )}
        </div>
      </div>

      {contractPanel && (
        <ContractPanelModal
          applicationId={contractPanel.applicationId}
          talentId={contractPanel.talentId}
          eventId={event.entity_id}
          talentName={contractPanel.talentName}
          eventTitle={d.titolo}
          handleApiResponse={handleApiResponse}
          onClose={() => setContractPanel(null)}
          onChanged={reloadContracts}
        />
      )}

      {profileModal && (
        <TalentProfileMiniModal
          talent={profileModal.t}
          matchPct={profileModal.matchPct}
          onClose={() => setProfileModal(null)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// MINI MODAL — profilo rapido talent (dal drawer "Talent per evento")
// ---------------------------------------------------------------------------

function TalentProfileMiniModal({ talent, matchPct, onClose }) {
  const td   = talent?.data ?? {}
  const nome = [td.nome, td.cognome].filter(Boolean).join(' ') || '—'
  const fotoUrl = td.foto_busto_url ? driveThumbUrl(td.foto_busto_url, 200) : null

  const lingueParlate = LINGUE_FISSE
    .filter(l => td[l.value] && td[l.value] !== 'Non conosco')
    .map(l => `${l.label}: ${td[l.value]}`)

  const disponibilita = DISPONIBILITA_TIPI.map(dp => ({ label: dp.label, ok: td[dp.value] === 'Sì' }))
  const tipologie = safeArray(td.tipologie_esperienza)

  return createPortal(
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:500 }} />
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        background:'#fff', borderRadius:10, padding:28, width:400, maxWidth:'92vw',
        maxHeight:'85vh', overflowY:'auto', zIndex:501,
        boxShadow:'0 20px 60px rgba(0,0,0,0.3)', fontFamily:'Montserrat,sans-serif',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div style={{ display:'flex', gap:14, alignItems:'center' }}>
            {fotoUrl ? (
              <img src={fotoUrl} alt={nome} style={{ width:80, height:80, borderRadius:'50%', objectFit:'cover', border:`1px solid ${COLORS.border}`, flexShrink:0 }} />
            ) : (
              <div style={{ width:80, height:80, borderRadius:'50%', background:'#630E33', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, color:'#fff', fontWeight:700, flexShrink:0 }}>
                {(nome[0] ?? '?').toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:COLORS.text }}>{nome}</div>
              <div style={{ fontSize:12, color:COLORS.textSecondary, marginTop:2 }}>{td.citta ?? td.residenza_citta ?? '—'}</div>
              {matchPct != null && (
                <span style={{ display:'inline-block', marginTop:6, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, background: matchPct >= 80 ? '#16A34A' : matchPct >= 60 ? '#D97706' : '#6B7280', color:'#fff' }}>
                  {matchPct}% match
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:COLORS.textSecondary, padding:'4px 8px', lineHeight:1 }}>✕</button>
        </div>

        {td.score != null && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:COLORS.textSecondary, marginBottom:4 }}>Score generale: <strong style={{ color:COLORS.text }}>{td.score}</strong></div>
            <ScoreBar score={td.score} />
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:6 }}>Lingue</div>
          <div style={{ fontSize:13, color:COLORS.text }}>
            {lingueParlate.length ? lingueParlate.join(' · ') : '—'}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:6 }}>Disponibilità</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {disponibilita.map(dp => (
              <span key={dp.label} style={{
                fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:10,
                background: dp.ok ? '#E8F5E9' : '#F5F5F5', color: dp.ok ? '#2E7D32' : '#999',
              }}>
                {dp.ok ? '✓' : '✗'} {dp.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:6 }}>Tipologie esperienza</div>
          <div style={{ fontSize:13, color:COLORS.text }}>
            {tipologie.length ? tipologie.join(', ') : '—'}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

// ---------------------------------------------------------------------------
// EVENT CARD
// ---------------------------------------------------------------------------

const EventCard = React.memo(function EventCard({ event, clients, onDuplica, onModifica, onMatchTalent, onChangeStatus, onRequestDelete, isChanging, isClosed, onToggleClosed, richiestaVal, onSetRichieste, onSaveRichieste }) {
  const d       = event.data ?? {}
  const sm      = statusMeta(event.status)
  const client  = clients.find(c => c.entity_id === d.client_id)
  const confirmed  = Number(d.confirmed_count ?? d.posti_confermati ?? 0)
  const approved   = Number(d.approved_count ?? confirmed)   // prima del flusso contratto approvati = confermati
  const required   = richiestaVal ?? Number(d.hostess_richieste ?? 0)

  const coverUrl = d.foto_copertina_url || d.foto_url

  return (
    <div style={{
      borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column',
      boxShadow:'0 2px 12px rgba(0,0,0,0.08)',
      transition:'transform 0.2s',
      willChange:'transform',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)' }}
    >
      {/* MAGAZINE HEADER — photo + bordeaux gradient overlay + white text */}
      <div style={{
        height:220, position:'relative', flexShrink:0, overflow:'hidden',
        background:`linear-gradient(135deg, #4A1020 0%, #630E33 100%)`,
      }}>
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}
          />
        )}
        {/* Bordeaux gradient overlay */}
        <div style={{
          position:'absolute', inset:0,
          background:'linear-gradient(to bottom, rgba(60,10,20,0.15) 0%, rgba(60,10,20,0.75) 60%, rgba(60,10,20,0.92) 100%)',
        }} />

        {/* Status badge — top right */}
        <div style={{ position:'absolute', top:12, right:12, zIndex:2 }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background:'rgba(20,10,16,0.72)', color:'#fff', fontSize:10, fontWeight:700, letterSpacing:'0.5px' }}>
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

        {/* Compenso */}
        {d.compenso && (
          <div style={{ fontSize:11, color:COLORS.textSecondary, marginTop:4 }}>
            💶 <span style={{ fontWeight:600, color:COLORS.text }}>{d.compenso}</span>
          </div>
        )}

        {/* Hostess richieste inline input */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
          <span style={{ fontSize:11, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>Hostess richieste:</span>
          <input
            type="number"
            min="1"
            max="200"
            value={richiestaVal ?? (d.hostess_richieste || '')}
            placeholder="—"
            onChange={e => onSetRichieste(event.entity_id, e.target.value === '' ? 0 : Number(e.target.value))}
            onBlur={e => onSaveRichieste(event.entity_id, e.target.value === '' ? 0 : Number(e.target.value))}
            style={{ width:52, border:'1px solid #e0e0e0', borderRadius:4, padding:'3px 6px', fontSize:12, fontFamily:'Montserrat,sans-serif', outline:'none' }}
          />
        </div>

        {/* Saturation bar — count click apre TAB Approvati */}
        {required > 0 && (
          <SaturationBar
            approved={approved}
            confirmed={confirmed}
            required={required}
            onCountClick={() => onMatchTalent(event, 'approvati')}
          />
        )}
      </div>

      {/* Actions row */}
      <div style={{ padding:'10px 12px 12px', borderTop:`1px solid ${COLORS.border}`, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        {/* Status toggle */}
        <EventStatusToggle
          event={event}
          onChangeStatus={onChangeStatus}
          isChanging={isChanging}
        />

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
            onClick={() => onMatchTalent(event, 'potenziali')}
            title="Talent per questo evento"
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
          <button
            onClick={() => onRequestDelete(event)}
            title="Elimina evento"
            style={{ background:'none', border:'1px solid #C62828', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:600, cursor:'pointer', color:'#C62828', fontFamily:'Montserrat,sans-serif' }}
            onMouseEnter={e => { e.currentTarget.style.background='#C62828'; e.currentTarget.style.color='#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#C62828' }}
          >
            Elimina
          </button>
        </div>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// NEWSLETTER PREVIEW MODAL
// ---------------------------------------------------------------------------

function NewsletterPreviewModal({ tier, html, stats, onClose }) {
  const ACCENT = COLORS.accent
  return createPortal(
    <div style={{
      position:'fixed', inset:0, zIndex:400,
      background:'rgba(0,0,0,0.72)', display:'flex', flexDirection:'column',
    }}>
      {/* Topbar */}
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
        background:'#1A1A2E', flexShrink:0,
      }}>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:700, fontSize:13, color:'#fff', letterSpacing:1 }}>
            ANTEPRIMA NEWSLETTER — {tier}
          </span>
          {stats && (
            <span style={{ marginLeft:16, fontSize:12, color:'#aaa' }}>
              {stats.destinatari} destinatari · {stats.eventi} eventi
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background:ACCENT, border:'none', borderRadius:4, padding:'6px 18px',
            color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', letterSpacing:1,
          }}
        >CHIUDI</button>
      </div>
      {/* iframe */}
      <div style={{ flex:1, overflow:'hidden', background:'#f0f0f0', padding:'24px 0' }}>
        <iframe
          title={`preview-${tier}`}
          srcDoc={html}
          style={{
            display:'block', margin:'0 auto', width:'100%', maxWidth:680,
            height:'100%', border:'none', borderRadius:4,
            boxShadow:'0 4px 32px rgba(0,0,0,0.25)',
          }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>,
    document.body
  )
}

// ---------------------------------------------------------------------------
// NEWSLETTER SETTINGS MODAL
// ---------------------------------------------------------------------------

function NewsletterSettingsModal({ currentSettings, onSave, onClose }) {
  const ACCENT = COLORS.accent
  const [t1, setT1] = useState(String(currentSettings.tier1_days ?? 7))
  const [t2, setT2] = useState(String(currentSettings.tier2_days ?? 14))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function handleSave() {
    const v1 = parseInt(t1), v2 = parseInt(t2)
    if (isNaN(v1) || v1 < 1 || isNaN(v2) || v2 < 1) {
      setErr('Inserisci valori >= 1')
      return
    }
    setSaving(true); setErr(null)
    const res = await newsletterApi.setFrequency({ tier1_days: v1, tier2_days: v2 })
    setSaving(false)
    if (res.success) { onSave(res.data); onClose() }
    else setErr(res.error?.message || 'Errore salvataggio')
  }

  return createPortal(
    <div style={{
      position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.55)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        background:'#fff', borderRadius:8, padding:32, width:360, maxWidth:'92vw', boxSizing:'border-box',
        boxShadow:'0 8px 48px rgba(0,0,0,0.22)', fontFamily:'Montserrat,sans-serif',
      }}>
        <h3 style={{ margin:'0 0 6px', fontSize:16, fontWeight:700, color:'#1A1A2E' }}>
          Frequenza newsletter
        </h3>
        <p style={{ margin:'0 0 24px', fontSize:12, color:'#888' }}>
          Il trigger gira ogni giorno alle 10:00 ma invia solo se passati N giorni dall'ultimo invio.
        </p>

        <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:4 }}>
          TIER 1 — profilo incompleto (ogni N giorni)
        </label>
        <input
          type="number" min={1} value={t1}
          onChange={e => setT1(e.target.value)}
          style={{
            width:'100%', padding:'8px 12px', border:`1px solid #ddd`, borderRadius:4,
            fontSize:14, marginBottom:16, boxSizing:'border-box',
          }}
        />

        <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#444', marginBottom:4 }}>
          TIER 2 — talent approvati (ogni N giorni)
        </label>
        <input
          type="number" min={1} value={t2}
          onChange={e => setT2(e.target.value)}
          style={{
            width:'100%', padding:'8px 12px', border:`1px solid #ddd`, borderRadius:4,
            fontSize:14, marginBottom:20, boxSizing:'border-box',
          }}
        />

        {err && <p style={{ margin:'0 0 12px', fontSize:12, color:'#C62828' }}>{err}</p>}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding:'8px 18px', border:`1px solid #ddd`, borderRadius:4,
              background:'none', fontSize:13, cursor:'pointer',
            }}
          >Annulla</button>
          <button
            onClick={handleSave} disabled={saving}
            style={{
              padding:'8px 18px', border:'none', borderRadius:4,
              background: saving ? '#ccc' : ACCENT, color:'#fff',
              fontSize:13, fontWeight:600, cursor: saving ? 'default' : 'pointer',
            }}
          >{saving ? 'Salvataggio…' : 'Salva'}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ---------------------------------------------------------------------------
// NEWSLETTER PANEL
// ---------------------------------------------------------------------------

function NewsletterPanel({ onPreview, onOpenSettings }) {
  const ACCENT = COLORS.accent
  const [loading, setLoading] = useState(null)       // 'TIER1' | 'TIER2' | null
  const [testEmail, setTestEmail] = useState('')
  const [sending, setSending] = useState(null)        // 'TIER1' | 'TIER2' | null
  const [sendResult, setSendResult] = useState(null)  // { ok, message }

  async function handlePreview(tier) {
    setLoading(tier)
    const res = await newsletterApi.preview(tier)
    setLoading(null)
    onPreview(tier, res)
  }

  async function handleSendToOne(tier) {
    if (!testEmail.trim()) return
    setSending(tier)
    setSendResult(null)
    const action = tier === 'TIER1' ? newsletterApi.sendTier1ToOne : newsletterApi.sendTier2ToOne
    const res = await action(testEmail.trim())
    setSending(null)
    setSendResult(
      res.success
        ? { ok: true, message: `Email inviata a ${res.data.to}` }
        : { ok: false, message: getErrorMessage(res.error) }
    )
  }

  return (
    <div style={{
      display:'flex', flexDirection:'column', gap:10,
      padding:'12px 16px', marginBottom:20, borderRadius:6,
      background:'#FDF6F7', border:`1px solid ${ACCENT}22`,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:ACCENT, textTransform:'uppercase', marginRight:4 }}>
          Newsletter
        </span>

        <button
          onClick={() => handlePreview('TIER1')} disabled={loading !== null}
          style={{
            padding:'6px 14px', border:`1px solid ${ACCENT}`, borderRadius:4,
            background: loading === 'TIER1' ? ACCENT : '#fff', color: loading === 'TIER1' ? '#fff' : ACCENT,
            fontSize:12, fontWeight:600, cursor: loading ? 'default' : 'pointer', letterSpacing:0.5,
          }}
        >{loading === 'TIER1' ? 'Carico…' : 'Preview TIER1'}</button>

        <button
          onClick={() => handlePreview('TIER2')} disabled={loading !== null}
          style={{
            padding:'6px 14px', border:`1px solid ${ACCENT}`, borderRadius:4,
            background: loading === 'TIER2' ? ACCENT : '#fff', color: loading === 'TIER2' ? '#fff' : ACCENT,
            fontSize:12, fontWeight:600, cursor: loading ? 'default' : 'pointer', letterSpacing:0.5,
          }}
        >{loading === 'TIER2' ? 'Carico…' : 'Preview TIER2'}</button>

        <button
          onClick={onOpenSettings}
          title="Impostazioni frequenza"
          style={{
            marginLeft:'auto', padding:'6px 12px', border:`1px solid #ddd`, borderRadius:4,
            background:'none', fontSize:12, color:'#666', cursor:'pointer',
          }}
        >⚙ Frequenza</button>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <input
          type="email"
          value={testEmail}
          onChange={e => setTestEmail(e.target.value)}
          placeholder="email destinatario di test"
          style={{ padding:'6px 10px', border:'1px solid #ddd', borderRadius:4, fontSize:12, minWidth:220 }}
        />
        <button
          onClick={() => handleSendToOne('TIER1')}
          disabled={!testEmail.trim() || sending !== null}
          style={{
            padding:'6px 12px', border:`1px solid ${ACCENT}`, borderRadius:4,
            background:'#fff', color:ACCENT, fontSize:12, fontWeight:600,
            cursor: sending ? 'default' : 'pointer',
          }}
        >{sending === 'TIER1' ? 'Invio…' : 'Invia TIER1 a questo contatto'}</button>
        <button
          onClick={() => handleSendToOne('TIER2')}
          disabled={!testEmail.trim() || sending !== null}
          style={{
            padding:'6px 12px', border:`1px solid ${ACCENT}`, borderRadius:4,
            background:'#fff', color:ACCENT, fontSize:12, fontWeight:600,
            cursor: sending ? 'default' : 'pointer',
          }}
        >{sending === 'TIER2' ? 'Invio…' : 'Invia TIER2 a questo contatto'}</button>

        {sendResult && (
          <span style={{ fontSize:12, fontWeight:600, color: sendResult.ok ? '#2E7D32' : '#C62828' }}>
            {sendResult.ok ? '✓ ' : '✕ '}{sendResult.message}
          </span>
        )}
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
  const [deleteModal,  setDeleteModal]  = useState(null)
  const [deleting,     setDeleting]     = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [formPrefill,  setFormPrefill]  = useState(null)
  const [isEdit,       setIsEdit]       = useState(false)
  const [matchEvent,   setMatchEvent]   = useState(null)
  const [matchTab,     setMatchTab]     = useState('potenziali')

  // Per-card local state (needs backend to persist)
  const [closedSet,    setClosedSet]    = useState(new Set())   // entity_ids with closed selection
  const [richieste,    setRichieste]    = useState({})          // entity_id → number

  // Newsletter
  const [nlPreview,    setNlPreview]    = useState(null)        // { tier, html, stats }
  const [nlSettings,   setNlSettings]   = useState(false)
  const [nlFreq,       setNlFreq]       = useState({ tier1_days: 7, tier2_days: 14 })

  // Ref per accesso stabile a closedSet dentro useCallback senza dipendenza
  const closedSetRef = useRef(closedSet)
  closedSetRef.current = closedSet

  const load = useCallback(async () => {
    setLoading(true)
    const [storeData, clRes, talRes] = await Promise.all([
      adminStore.refresh(),
      clientApi.list().then(r => handleApiResponse(r)),
      talentApi.list({ status: 'APPROVED' }).then(r => handleApiResponse(r)),
    ])
    setLoading(false)
    if (!storeData) { setError('Errore nel caricamento dati.'); return }
    const events = storeData.events ?? []
    setEvents(events)
    // Inizializza closedSet dai dati backend (selezioni_chiuse persistite)
    setClosedSet(new Set(events.filter(e => e.data?.selezioni_chiuse).map(e => e.entity_id)))
    if (clRes.success) setClients(clRes.data?.items ?? [])
    // BUG-2 fix: usa TALENT_PROFILE entities (entity_id corretto per application.invite)
    if (talRes.success) setAllTalents(talRes.data?.items ?? [])
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
        const aPct = aReq > 0 ? (Number(a.data?.approved_count ?? a.data?.confirmed_count ?? 0) / aReq) : 0
        const bPct = bReq > 0 ? (Number(b.data?.approved_count ?? b.data?.confirmed_count ?? 0) / bReq) : 0
        return bPct - aPct
      })
    }
    return list
  }, [events, filterStatus, filterCitta, sortBy, richieste])

  const doUpdateStatus = async (entity_id, new_status) => {
    const prevEvents = events
    setEvents(prev => prev.map(e => e.entity_id === entity_id ? { ...e, status: new_status } : e))
    const res = handleApiResponse(await eventApi.updateStatus(entity_id, new_status))
    if (!res.success) {
      setEvents(prevEvents)
      alert(getErrorMessage(res.error))
    }
  }

  const handleChangeStatus = useCallback((entity_id, new_status) => {
    doUpdateStatus(entity_id, new_status)
  }, [doUpdateStatus])

  const handleRequestDelete = useCallback((event) => {
    setDeleteModal(event)
  }, [])

  const handleConfirmDelete = async (entity_id) => {
    setDeleting(true)
    const res = handleApiResponse(await eventApi.softDelete(entity_id))
    setDeleting(false)
    if (!res.success) {
      alert(getErrorMessage(res.error))
      return
    }
    setDeleteModal(null)
    await load()
    showToast('Eliminato')
  }

  const handleDuplica = useCallback((event) => {
    setFormPrefill(event.data ?? {})
    setIsEdit(false)
    setShowForm(true)
  }, [])

  const handleModifica = useCallback((event) => {
    setFormPrefill({ entity_id: event.entity_id, ...(event.data ?? {}) })
    setIsEdit(true)
    setShowForm(true)
  }, [])

  const handleMatchTalent = useCallback((ev, tab = 'potenziali') => {
    setMatchEvent(ev)
    setMatchTab(tab)
  }, [])

  const handleFormClose = () => { setShowForm(false); setFormPrefill(null); setIsEdit(false) }
  const handleFormSaved = () => { handleFormClose(); load() }

  const handleToggleClosed = useCallback(async (entity_id) => {
    const wasClosed = closedSetRef.current.has(entity_id)
    const newClosed = !wasClosed
    // Aggiornamento ottimistico
    setClosedSet(prev => {
      const next = new Set(prev)
      newClosed ? next.add(entity_id) : next.delete(entity_id)
      return next
    })
    const res = handleApiResponse(await eventApi.update({ entity_id, selezioni_chiuse: newClosed }))
    if (!res.success) {
      // Revert su errore
      setClosedSet(prev => {
        const next = new Set(prev)
        wasClosed ? next.add(entity_id) : next.delete(entity_id)
        return next
      })
      alert(getErrorMessage(res.error))
    }
  }, [handleApiResponse])

  const handleSetRichieste = useCallback((entity_id, val) => {
    setRichieste(prev => ({ ...prev, [entity_id]: val }))
  }, [])

  const handleSaveRichieste = useCallback(async (entity_id, val) => {
    const res = handleApiResponse(await eventApi.update({ entity_id, hostess_richieste: Number(val) || 0 }))
    if (!res.success) alert(getErrorMessage(res.error))
  }, [handleApiResponse])

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

      {/* Newsletter panel */}
      <NewsletterPanel
        onPreview={(tier, res) => {
          if (res.success) setNlPreview({ tier, html: res.data.html, stats: res.data.stats })
        }}
        onOpenSettings={() => setNlSettings(true)}
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
          <option value="DRAFT">Bozze</option>
          <option value="PLANNING">Pianificazione</option>
          <option value="LIVE">Attivi</option>
          <option value="COMPLETED">Completati</option>
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
              onDuplica={handleDuplica}
              onModifica={handleModifica}
              onMatchTalent={handleMatchTalent}
              onChangeStatus={handleChangeStatus}
              onRequestDelete={handleRequestDelete}
              isChanging={toggling === ev.entity_id}
              isClosed={closedSet.has(ev.entity_id)}
              onToggleClosed={handleToggleClosed}
              richiestaVal={richieste[ev.entity_id]}
              onSetRichieste={handleSetRichieste}
              onSaveRichieste={handleSaveRichieste}
            />
          ))}
        </div>
      )}

      {deleteModal && (
        <DeleteConfirmModal
          event={deleteModal}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteModal(null)}
          loading={deleting}
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
          onClientCreated={c => setClients(prev => [...prev, c])}
        />
      )}

      {matchEvent && (
        <TalentEventDrawer
          event={matchEvent}
          allTalents={allTalents}
          onClose={() => setMatchEvent(null)}
          handleApiResponse={handleApiResponse}
          initialTab={matchTab}
        />
      )}

      {nlPreview && (
        <NewsletterPreviewModal
          tier={nlPreview.tier}
          html={nlPreview.html}
          stats={nlPreview.stats}
          onClose={() => setNlPreview(null)}
        />
      )}

      {nlSettings && (
        <NewsletterSettingsModal
          currentSettings={nlFreq}
          onSave={(saved) => setNlFreq(saved)}
          onClose={() => setNlSettings(false)}
        />
      )}
    </Layout>
  )
}
