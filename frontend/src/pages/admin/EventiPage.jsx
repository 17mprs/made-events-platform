// === EVENTI PAGE — MADE EVENTS Platform ===
import { Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber, AlignmentType } from 'docx'
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../contexts/AuthContext'
import { clientApi, eventApi, talentApi, applicationApi, contractApi, shiftApi, newsletterApi, getErrorMessage } from '../../api/client'
import adminStore from '../../store/adminStore'
import { COLORS, COMPONENT_STYLES } from '../../styles/theme'
import Layout from '../../components/Layout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import { ADMIN_SIDEBAR, PageHeader, TalentAvatar, ScoreBar, FILTER_INPUT } from './shared'
import CittaProvinciaSelect from '../../components/shared/CittaProvinciaSelect'

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

function SaturationBar({ confirmed, required, onCountClick }) {
  if (!required || required <= 0) return null
  const pct      = (confirmed / required) * 100
  const over     = confirmed > required
  const clampPct = Math.min(pct, 100)
  const color    = over ? '#EF4444' : pct >= 80 ? '#F97316' : '#10B981'

  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, marginBottom:4 }}>
        <span style={{ color:COLORS.textSecondary, letterSpacing:'0.3px' }}>Saturazione</span>
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
            Per confermare digita il codice
          </label>
          <div style={{ fontSize:12, color:COLORS.textSecondary, marginBottom:8 }}>
            Codice: <strong style={{ fontFamily:'monospace', fontSize:14 }}>12345</strong>
          </div>
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="12345"
            autoFocus
            style={{
              border:`1.5px solid ${isValid ? '#4CAF50' : COLORS.border}`,
              borderRadius:4, padding:'9px 12px', fontSize:15,
              fontFamily:'Montserrat,sans-serif', width:'100%',
              boxSizing:'border-box', outline:'none', transition:'border-color 0.2s',
            }}
          />
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
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

function EventStatusToggle({ event, onChangeStatus, onRequestDelete, isChanging }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState(null)
  const buttonRef = useRef(null)
  const meta    = statusMeta(event.status)
  const options = STATUS_TRANSITIONS[event.status] ?? []

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
            <button
              onClick={() => { setOpen(false); onRequestDelete(event) }}
              style={{
                width:'100%', textAlign:'left', background:'none',
                border:'none', borderTop:`1px solid ${COLORS.border}`,
                padding:'10px 14px', cursor:'pointer',
                fontSize:12, fontWeight:600, color:'#C62828',
                display:'flex', alignItems:'center', gap:8, transition:'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FFEBEE' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ fontSize:14 }}>🗑</span>
              Elimina evento
            </button>
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

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Input label="Hostess richieste" type="number" min="0" value={form.hostess_richieste} onChange={set('hostess_richieste')} placeholder="es. 10" />
              <Input label="Min. anni esperienza" type="number" min="0" value={form.anni_esperienza_minimi} onChange={set('anni_esperienza_minimi')} placeholder="es. 2" />
            </div>
            <Input label="Compenso (€)" value={form.compenso} onChange={set('compenso')} placeholder="es. €42,00 netti" />

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

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
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
// CONTRACT PREVIEW MODAL
// ---------------------------------------------------------------------------

export function ContractPreviewModal({ talent, event, onClose }) {
  const td = talent?.data ?? {}
  const ed = event?.data ?? {}

  useEffect(() => {
    const el = document.createElement('style')
    el.id = '__contract_print_css__'
    el.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #contract-printable, #contract-printable * { visibility: visible !important; }
        #contract-printable {
          position: fixed !important;
          top: 0 !important; left: 0 !important; right: 0 !important;
          padding: 15mm 20mm !important;
          background: white !important;
          overflow: visible !important;
          max-width: none !important;
        }
        .contract-chrome { display: none !important; }
      }
    `
    document.head.appendChild(el)
    return () => { document.head.querySelector('#__contract_print_css__')?.remove() }
  }, [])

  const missing = (label) => (
    <span style={{ color:'#C62828', fontWeight:600, background:'#FFF3F3', padding:'0 3px', borderRadius:2 }}>
      [DATO MANCANTE – {label}]
    </span>
  )

  const nomeCognome = [td.nome, td.cognome].filter(Boolean).join(' ') || null
  const dataEvento  = ed.data_inizio
    ? new Date(ed.data_inizio).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' })
    : null
  const dataFirma = new Date().toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' })

  const S = {
    page:     { fontFamily:'Montserrat,sans-serif', fontSize:'10pt', lineHeight:1.7, color:'#111', background:'#fff', padding:'40px 48px', maxWidth:794, width:'100%', boxSizing:'border-box' },
    h1:       { fontSize:'14pt', fontWeight:700, color:'#630E33', textAlign:'center', margin:'0 0 2px', letterSpacing:'0.5px' },
    sub:      { fontSize:'8.5pt', color:'#888', textAlign:'center', margin:'0 0 20px' },
    divider:  { borderTop:'1px solid #ddd', margin:'18px 0' },
    artTitle: { fontSize:'10pt', fontWeight:700, color:'#630E33', margin:'18px 0 5px' },
    p:        { margin:'4px 0', fontSize:'10pt' },
    dataRow:  { display:'flex', gap:16, marginBottom:3 },
    dataLbl:  { fontSize:'9.5pt', color:'#555', minWidth:190, flexShrink:0 },
    dataVal:  { fontSize:'9.5pt', fontWeight:500 },
    sigRow:   { display:'flex', gap:60, marginTop:40 },
    sigBox:   { flex:1 },
    sigLine:  { borderTop:'1.5px solid #111', marginTop:44, marginBottom:5 },
    sigName:  { fontSize:'9pt', color:'#555' },
  }

  const DR = ({ label, val, labelM }) => (
    <div style={S.dataRow}>
      <span style={S.dataLbl}>{label}</span>
      <span style={S.dataVal}>{val ? val : missing(labelM || label)}</span>
    </div>
  )

  const downloadDocx = async () => {

    const MAROON = '7A1E2C'; const GRAY = '888888'; const RED = 'C62828'
    const PT11 = 22; const PT14 = 28; const PT9 = 18
    const CM2_5 = 1418 // 2.5cm in twips (1cm = 567twips)

    const v = (x) => (x && String(x).trim()) ? String(x).trim() : null

    const AT = (text) => new Paragraph({
      children: [new TextRun({ text, bold: true, color: MAROON, size: PT11 })],
      spacing: { before: 280, after: 100 },
    })
    const BP = (text) => new Paragraph({
      children: [new TextRun({ text, size: PT11 })],
      spacing: { after: 80 },
    })
    const DL = (label, value) => new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: PT11 }),
        v(value)
          ? new TextRun({ text: v(value), size: PT11 })
          : new TextRun({ text: '[DATO MANCANTE]', bold: true, color: RED, size: PT11 }),
      ],
      spacing: { after: 60 },
    })
    const LI = (text) => new Paragraph({
      children: [new TextRun({ text: `\u2022 ${text}`, size: PT11 })],
      indent: { left: 360 },
      spacing: { after: 60 },
    })

    const nomeParts = (nomeCognome || 'Talent').replace(/\s+/g, '_')
    const dataParts = ed.data_inizio
      ? new Date(ed.data_inizio).toISOString().slice(0,10).replace(/-/g,'')
      : 'ND'

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: CM2_5, right: CM2_5, bottom: CM2_5, left: CM2_5 } } },
        headers: {
          default: new Header({
            children: [new Paragraph({
              children: [new TextRun({ text: '[LOGO]', bold: true, color: MAROON, size: PT14 })],
              alignment: AlignmentType.CENTER,
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              children: [
                new TextRun({ text: 'Made Events S.r.l.s. \u2014 Via Montepulciano 60, Roma \u2014 C.F. 16645801008 \u2014 Pagina ', size: PT9, color: GRAY }),
                new TextRun({ children: [PageNumber.CURRENT], size: PT9, color: GRAY }),
              ],
              alignment: AlignmentType.CENTER,
            })],
          }),
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'CONTRATTO DI COLLABORAZIONE OCCASIONALE', bold: true, color: MAROON, size: PT14 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Made Events S.r.l.s. \u2014 Via Montepulciano 60, Roma \u2014 C.F. / P.IVA 16645801008', size: PT9, color: GRAY })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
          }),
          AT('PARTI CONTRAENTI'),
          new Paragraph({
            children: [
              new TextRun({ text: 'Committente: ', bold: true, size: PT11 }),
              new TextRun({ text: 'Made Events S.r.l.s., con sede legale in Via Montepulciano 60, Roma, C.F. / P.IVA 16645801008', size: PT11 }),
            ],
            spacing: { after: 80 },
          }),
          BP('Prestatore:'),
          DL('Nome e Cognome',   nomeCognome),
          DL('Codice Fiscale',   td.codice_fiscale),
          DL('Data di nascita',  td.data_nascita),
          DL('Luogo di nascita', td.citta_nascita),
          DL('Nazionalit\u00e0', td.nazionalita),
          DL('Residenza',        td.indirizzo_residenza),
          DL('N\u00b0 Documento',td.numero_documento),
          DL('Emesso da',        td.stato_emissione_documento),
          AT("Art. 1 \u2013 OGGETTO DELL'INCARICO"),
          BP('Il Prestatore si impegna a svolgere attivit\u00e0 di Hostess/Steward/Promoter per conto del Committente.'),
          DL('Tipologia evento',        ed.tipologia),
          DL('Data',                    dataEvento),
          DL('Luogo',                   ed.luogo),
          DL('Orario',                  ed.orario),
          DL('Abbigliamento richiesto', ed.abbigliamento_richiesto),
          AT('Art. 2 \u2013 NATURA DEL RAPPORTO'),
          BP("La prestazione oggetto del presente accordo \u00e8 da intendersi occasionale, senza alcun vincolo di subordinazione n\u00e9 oneri previdenziali a carico del Committente. La Risorsa dichiara di non aver percepito, nel corso dell'anno solare, compensi complessivi superiori a \u20ac 5.000,00 derivanti da prestazioni di lavoro occasionale. La prestazione avr\u00e0 carattere esclusivamente autonomo e professionale; pertanto, ogni responsabilit\u00e0, ivi compresa quella infortunistica, resta a carico del Prestatore."),
          AT('Art. 3 \u2013 CORRISPETTIVO E PAGAMENTO'),
          DL('Compenso', ed.compenso),
          BP("Il pagamento avverr\u00e0 a 30 giorni fine mese tramite bonifico bancario. Il pagamento \u00e8 subordinato a: corretta esecuzione della prestazione, invio della documentazione richiesta (ritenuta d'acconto o fattura), effettivo incasso da parte del Committente. In assenza dei dati richiesti, il pagamento sar\u00e0 posticipato. Eventuali ore extra saranno riconosciute solo se autorizzate preventivamente."),
          AT('Art. 4 \u2013 RECESSO E PENALI'),
          BP('Il Prestatore potr\u00e0 recedere con preavviso minimo di 48 ore, motivando la propria decisione. In caso di mancato preavviso o assenza sar\u00e0 applicata una penale di \u20ac150,00, fatto salvo il risarcimento di eventuali danni ulteriori. La mancata presentazione o ritardi superiori a 15 minuti senza preavviso saranno considerati grave inadempienza.'),
          AT('Art. 5 \u2013 ANNULLAMENTO O MODIFICHE'),
          BP("Il Committente si riserva il diritto di annullare l'attivit\u00e0 o modificare orari, luogo o mansioni. Le variazioni saranno comunicate tempestivamente. La Risorsa potr\u00e0 accettare o rifiutare entro 24 ore. Il compenso sar\u00e0 proporzionato alle ore effettivamente svolte."),
          AT('Art. 6 \u2013 SVOLGIMENTO DEL SERVIZIO'),
          BP('La Risorsa si impegna a:'),
          LI('rispettare gli orari di convocazione;'),
          LI('attenersi alle indicazioni operative;'),
          LI('mantenere un comportamento professionale.'),
          BP('\u00c8 fatto divieto di utilizzare il telefono durante il servizio (salvo autorizzazione) e di allontanarsi dalla postazione senza consenso.'),
          AT('Art. 7 \u2013 DRESS CODE'),
          BP("La Risorsa \u00e8 tenuta a rispettare il dress code indicato. Il mancato rispetto potr\u00e0 comportare esclusione dall'attivit\u00e0 e mancato riconoscimento del compenso."),
          AT('Art. 8 \u2013 INTERRUZIONE DEL SERVIZIO'),
          BP('In caso di comportamento non conforme, il Committente si riserva il diritto di interrompere la prestazione. In tal caso non sar\u00e0 dovuto il compenso per le ore non svolte.'),
          AT('Art. 9 \u2013 RISERVATEZZA'),
          BP('Il Prestatore si impegna a non divulgare informazioni relative a cliente, evento e attivit\u00e0 svolta. La violazione comporta risoluzione del contratto ed eventuali azioni legali.'),
          AT('Art. 10 \u2013 NON CONCORRENZA'),
          BP("Il Prestatore si impegna a non contattare direttamente il cliente del Committente n\u00e9 ad accettare incarichi senza previa comunicazione e autorizzazione da parte dell'Agenzia. Eventuali contatti ricevuti dovranno essere comunicati entro 24 ore a Made Events S.r.l.s. Tale obbligo si estende anche per un periodo successivo alla conclusione della collaborazione. L'inadempienza potr\u00e0 comportare l'avvio di azioni a tutela del Committente."),
          AT('Art. 11 \u2013 RESPONSABILIT\u00c0'),
          BP('Il Prestatore \u00e8 responsabile per eventuali danni arrecati a persone, cose o immagine del cliente.'),
          AT('Art. 12 \u2013 TRATTAMENTO DATI E IMMAGINE'),
          BP("La Risorsa autorizza il trattamento dei propri dati personali ai sensi del D.Lgs. 196/2003 e del Regolamento UE 679/2016 (GDPR), esclusivamente per le finalit\u00e0 connesse al presente rapporto. Durante lo svolgimento dell'attivit\u00e0 potranno essere realizzati contenuti fotografici e video a fini di reportistica interna e promozione aziendale. La Risorsa autorizza l'utilizzo di tali materiali, purch\u00e9 non lesivi della propria immagine, dignit\u00e0 e professionalit\u00e0."),
          AT('Art. 13 \u2013 FORO COMPETENTE'),
          BP('Per ogni controversia \u00e8 competente in via esclusiva il Foro di Roma.'),
          AT('Art. 14 \u2013 ACCETTAZIONE'),
          BP('Il Prestatore dichiara di aver letto e accettato tutte le condizioni.'),
          new Paragraph({ children: [new TextRun({ text: '\u2500'.repeat(60), color: GRAY, size: PT9 })], spacing: { before: 280, after: 280 } }),
          BP(`Data: ${dataFirma} \u2014 Roma`),
          new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 560 } }),
          new Paragraph({
            children: [new TextRun({ text: '_'.repeat(32) + '          ' + '_'.repeat(32), size: PT11 })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Il Committente' + ' '.repeat(40) + 'Il Prestatore', size: PT11 })],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Made Events S.r.l.s.' + ' '.repeat(34) + (nomeCognome || '[DATO MANCANTE]'), bold: true, size: PT11 }),
            ],
          }),
        ],
      }],
    })

    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Contratto_${nomeParts}_${dataParts}.docx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const btnPrimary   = { background:'#630E33', color:'#fff', border:'none', borderRadius:6, padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }
  const btnSecondary = { background:'none', border:'1px solid rgba(255,255,255,0.3)', color:'#ccc', borderRadius:6, padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:600 }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)' }} />

      <div style={{ position:'relative', zIndex:1, height:'100%', overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 16px 48px' }}>

        {/* Chrome bar */}
        <div className="contract-chrome" style={{
          position:'sticky', top:0, zIndex:10,
          display:'flex', alignItems:'center', gap:10,
          background:'rgba(10,10,16,0.9)', backdropFilter:'blur(10px)',
          padding:'10px 20px', borderRadius:8, marginBottom:16,
          width:'100%', maxWidth:794, boxSizing:'border-box',
        }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#fff', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            Contratto — {nomeCognome || 'Talent'}
          </span>
          <button onClick={() => window.print()} style={btnPrimary}>Stampa / PDF</button>
          <button onClick={downloadDocx} style={{ ...btnPrimary, background:'#1D4ED8' }}>Scarica .docx</button>
          <button onClick={() => alert('Funzione invio email in arrivo')} style={btnSecondary}>Invia per email</button>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#999', fontSize:18, cursor:'pointer', padding:'4px 8px', lineHeight:1 }}>✕</button>
        </div>

        {/* A4 Contract */}
        <div id="contract-printable" style={S.page}>

          <p style={S.h1}>CONTRATTO DI COLLABORAZIONE OCCASIONALE</p>
          <p style={S.sub}>Made Events S.r.l.s. — Via Montepulciano 60, Roma — C.F. / P.IVA 16645801008</p>
          <div style={S.divider} />

          <p style={{ ...S.artTitle, marginTop:0 }}>PARTI CONTRAENTI</p>
          <p style={S.p}><strong>Committente:</strong> Made Events S.r.l.s., con sede legale in Via Montepulciano 60, Roma, C.F. / P.IVA 16645801008</p>
          <p style={{ ...S.p, marginTop:8 }}><strong>Prestatore:</strong></p>
          <div style={{ marginTop:8, marginBottom:4 }}>
            <DR label="Nome e Cognome"   val={nomeCognome}              labelM="Nome / Cognome" />
            <DR label="Codice Fiscale"   val={td.codice_fiscale}        labelM="Codice Fiscale" />
            <DR label="Data di nascita"  val={td.data_nascita}          labelM="Data di nascita" />
            <DR label="Luogo di nascita" val={td.citta_nascita}         labelM="Città di nascita" />
            <DR label="Nazionalità"      val={td.nazionalita}           labelM="Nazionalità" />
            <DR label="Residenza"        val={td.indirizzo_residenza}   labelM="Indirizzo di residenza" />
            <DR label="N° Documento"     val={td.numero_documento}      labelM="Numero documento" />
            <DR label="Emesso da"        val={td.stato_emissione_documento} labelM="Stato emissione documento" />
          </div>

          <div style={S.divider} />

          <p style={S.artTitle}>Art. 1 – OGGETTO DELL&apos;INCARICO</p>
          <p style={S.p}>Il Prestatore si impegna a svolgere attività di Hostess/Steward/Promoter per conto del Committente.</p>
          <div style={{ marginTop:8, marginBottom:4 }}>
            <DR label="Tipologia evento"        val={ed.tipologia}               labelM="Tipologia evento" />
            <DR label="Data"                    val={dataEvento}                 labelM="Data evento" />
            <DR label="Luogo"                   val={ed.luogo}                   labelM="Luogo evento" />
            <DR label="Orario"                  val={ed.orario}                  labelM="Orario" />
            <DR label="Abbigliamento richiesto" val={ed.abbigliamento_richiesto} labelM="Abbigliamento richiesto" />
          </div>

          <p style={S.artTitle}>Art. 2 – NATURA DEL RAPPORTO</p>
          <p style={S.p}>La prestazione oggetto del presente accordo è da intendersi occasionale, senza alcun vincolo di subordinazione né oneri previdenziali a carico del Committente. La Risorsa dichiara di non aver percepito, nel corso dell&apos;anno solare, compensi complessivi superiori a € 5.000,00 derivanti da prestazioni di lavoro occasionale. La prestazione avrà carattere esclusivamente autonomo e professionale; pertanto, ogni responsabilità, ivi compresa quella infortunistica, resta a carico del Prestatore.</p>

          <p style={S.artTitle}>Art. 3 – CORRISPETTIVO E PAGAMENTO</p>
          <p style={S.p}>Il compenso sarà quello indicato nei dettagli attività: <strong>{ed.compenso ? ed.compenso : missing('Compenso')}</strong>. Il pagamento avverrà a 30 giorni fine mese tramite bonifico bancario. Il pagamento è subordinato a: corretta esecuzione della prestazione, invio della documentazione richiesta (ritenuta d&apos;acconto o fattura), effettivo incasso da parte del Committente. In assenza dei dati richiesti, il pagamento sarà posticipato. Eventuali ore extra saranno riconosciute solo se autorizzate preventivamente.</p>

          <p style={S.artTitle}>Art. 4 – RECESSO E PENALI</p>
          <p style={S.p}>Il Prestatore potrà recedere con preavviso minimo di 48 ore, motivando la propria decisione. In caso di mancato preavviso o assenza sarà applicata una penale di €150,00, fatto salvo il risarcimento di eventuali danni ulteriori. La mancata presentazione o ritardi superiori a 15 minuti senza preavviso saranno considerati grave inadempienza.</p>

          <p style={S.artTitle}>Art. 5 – ANNULLAMENTO O MODIFICHE</p>
          <p style={S.p}>Il Committente si riserva il diritto di annullare l&apos;attività o modificare orari, luogo o mansioni. Le variazioni saranno comunicate tempestivamente. La Risorsa potrà accettare o rifiutare entro 24 ore. Il compenso sarà proporzionato alle ore effettivamente svolte.</p>

          <p style={S.artTitle}>Art. 6 – SVOLGIMENTO DEL SERVIZIO</p>
          <p style={S.p}>La Risorsa si impegna a:</p>
          <ul style={{ margin:'5px 0 5px 22px', padding:0 }}>
            <li style={S.p}>rispettare gli orari di convocazione;</li>
            <li style={S.p}>attenersi alle indicazioni operative;</li>
            <li style={S.p}>mantenere un comportamento professionale.</li>
          </ul>
          <p style={S.p}>È fatto divieto di utilizzare il telefono durante il servizio (salvo autorizzazione) e di allontanarsi dalla postazione senza consenso.</p>

          <p style={S.artTitle}>Art. 7 – DRESS CODE</p>
          <p style={S.p}>La Risorsa è tenuta a rispettare il dress code indicato. Il mancato rispetto potrà comportare esclusione dall&apos;attività e mancato riconoscimento del compenso.</p>

          <p style={S.artTitle}>Art. 8 – INTERRUZIONE DEL SERVIZIO</p>
          <p style={S.p}>In caso di comportamento non conforme, il Committente si riserva il diritto di interrompere la prestazione. In tal caso non sarà dovuto il compenso per le ore non svolte.</p>

          <p style={S.artTitle}>Art. 9 – RISERVATEZZA</p>
          <p style={S.p}>Il Prestatore si impegna a non divulgare informazioni relative a cliente, evento e attività svolta. La violazione comporta risoluzione del contratto ed eventuali azioni legali.</p>

          <p style={S.artTitle}>Art. 10 – NON CONCORRENZA</p>
          <p style={S.p}>Il Prestatore si impegna a non contattare direttamente il cliente del Committente né ad accettare incarichi senza previa comunicazione e autorizzazione da parte dell&apos;Agenzia. Eventuali contatti ricevuti dovranno essere comunicati entro 24 ore a Made Events S.r.l.s. Tale obbligo si estende anche per un periodo successivo alla conclusione della collaborazione. L&apos;inadempienza potrà comportare l&apos;avvio di azioni a tutela del Committente.</p>

          <p style={S.artTitle}>Art. 11 – RESPONSABILITÀ</p>
          <p style={S.p}>Il Prestatore è responsabile per eventuali danni arrecati a persone, cose o immagine del cliente.</p>

          <p style={S.artTitle}>Art. 12 – TRATTAMENTO DATI E IMMAGINE</p>
          <p style={S.p}>La Risorsa autorizza il trattamento dei propri dati personali ai sensi del D.Lgs. 196/2003 e del Regolamento UE 679/2016 (GDPR), esclusivamente per le finalità connesse al presente rapporto. Durante lo svolgimento dell&apos;attività potranno essere realizzati contenuti fotografici e video a fini di reportistica interna e promozione aziendale. La Risorsa autorizza l&apos;utilizzo di tali materiali, purché non lesivi della propria immagine, dignità e professionalità.</p>

          <p style={S.artTitle}>Art. 13 – FORO COMPETENTE</p>
          <p style={S.p}>Per ogni controversia è competente in via esclusiva il Foro di Roma.</p>

          <p style={S.artTitle}>Art. 14 – ACCETTAZIONE</p>
          <p style={S.p}>Il Prestatore dichiara di aver letto e accettato tutte le condizioni.</p>

          <div style={{ ...S.divider, marginTop:28 }} />

          <p style={{ ...S.p, marginBottom:6 }}>Le parti dichiarano di aver letto, compreso e accettato integralmente il presente contratto.</p>
          <p style={S.p}><strong>Data:</strong> {dataFirma} — Roma</p>

          <div style={S.sigRow}>
            <div style={S.sigBox}>
              <div style={S.sigLine} />
              <div style={S.sigName}>Il Committente</div>
              <div style={{ ...S.sigName, fontWeight:600 }}>Made Events S.r.l.s.</div>
            </div>
            <div style={S.sigBox}>
              <div style={S.sigLine} />
              <div style={S.sigName}>Il Prestatore</div>
              <div style={{ ...S.sigName, fontWeight:600 }}>{nomeCognome || missing('Nome Cognome')}</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MATCH SCORE (front-end, mirrors backend calculateEventMatch, zero latency)
// ---------------------------------------------------------------------------

function computeMatchPct(ed, td) {
  if (!ed || !td) return 50
  let score = 0, maxScore = 0

  // HARD: sesso (15)
  if (ed.sesso_richiesto && ed.sesso_richiesto !== 'Indifferente') {
    maxScore += 15
    if ((td.genere || td.sesso) === ed.sesso_richiesto) score += 15
    else return 0
  }
  // HARD: altezza (10)
  if (ed.altezza_minima) {
    maxScore += 10
    if (Number(td.altezza) >= Number(ed.altezza_minima)) score += 10
    else return 0
  }
  // HARD: taglia (10)
  if (ed.taglia_richiesta && ed.taglia_richiesta !== 'Indifferente' && ed.taglia_richiesta !== '') {
    maxScore += 10
    if ((td.taglia_pantalone || td.taglia) === ed.taglia_richiesta) score += 10
    else return 0
  }
  // HARD: lingue (15)
  const lingueRichieste = ed.lingue_richieste ?? []
  if (lingueRichieste.length > 0) {
    maxScore += 15
    const tLingue = [
      td.lingua_inglese, td.lingua_francese, td.lingua_spagnolo, td.lingua_tedesco,
      ...((td.altre_lingue ?? []).map(l => l.nome || '')),
      ...((td.lingue ?? []).map(l => typeof l === 'string' ? l : (l.nome || ''))),
    ].filter(Boolean).map(l => l.toLowerCase())
    const hasAll = lingueRichieste.every(r => tLingue.some(tl => tl.includes(r.toLowerCase())))
    if (hasAll) score += 15
    else return 0
  }

  // SOFT: esperienza (12/5)
  if (Number(ed.anni_esperienza_minimi) > 0) {
    maxScore += 12
    if (parseEsperienza(td.anni_esperienza_settore) >= Number(ed.anni_esperienza_minimi)) score += 12
    else score += 5
  }
  // SOFT: provincia (10/3)
  if (ed.provincia) {
    maxScore += 10
    const provs = td.province_lavoro ?? td.province_operativita ?? []
    if (provs.includes(ed.provincia)) score += 10; else score += 3
  }
  // SOFT: automunita (8/2)
  if (ed.automunita === 'Sì') {
    maxScore += 8
    if (td.automunita === 'Sì') score += 8; else score += 2
  }
  // SOFT: trasferte (8/2)
  if (ed.richiede_trasferte) {
    maxScore += 8
    if (td.disponibilita_trasferte === 'Sì') score += 8; else score += 2
  }
  // SOFT: weekend (6)
  if (ed.richiede_weekend) {
    maxScore += 6
    if (td.disponibilita_weekend === 'Sì') score += 6
  }
  // SOFT: ruoli (10/3)
  const ruoli = ed.ruoli_richiesti ?? []
  if (ruoli.length > 0) {
    maxScore += 10
    const tip = td.tipologie_esperienza ?? []
    if (ruoli.some(r => tip.includes(r))) score += 10; else score += 3
  }
  // Bonus: ha lavorato con noi (10)
  if (ed.priorita_lavorato_con_noi) {
    const eventiMade = (Number(td.eventi_crm_completati) || 0) + (Number(td.eventi_precrm) || 0)
    if (eventiMade > 0) { maxScore += 10; score += 10 }
  }

  if (maxScore === 0) return 50
  return Math.round((score / maxScore) * 100)
}

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
                return (
                  <div key={s.entity_id} style={{ background:'#1A1A24', borderRadius:7, padding:'9px 12px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:TEXT }}>
                        {fmtShiftDate(sd.data)}&nbsp;·&nbsp;{sd.orario_inizio || '—'} → {sd.orario_fine || '—'}
                      </div>
                      <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>
                        {sd.ruolo || '—'}&nbsp;·&nbsp;{sd.posti_confermati ?? 0}/{sd.posti_disponibili ?? 0} posti
                        {sd.dress_code && <span>&nbsp;·&nbsp;{sd.dress_code}</span>}
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
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
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
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
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

function TalentEventDrawer({ event, allTalents, onClose, handleApiResponse, initialTab = 'potenziali' }) {
  const d = event.data ?? {}
  const [tab,           setTab]           = useState(initialTab)
  const [applications,  setApplications]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [contractData,    setContractData]    = useState(null)
  const [markingCompleted, setMarkingCompleted] = useState(null)

  const loadApps = useCallback(async () => {
    setLoading(true)
    const res = handleApiResponse(await applicationApi.list({ event_id: event.entity_id }))
    setLoading(false)
    if (res.success) setApplications(res.data?.items ?? [])
  }, [event.entity_id, handleApiResponse])

  useEffect(() => { loadApps() }, [loadApps])

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
    const pendingApps  = []
    const approvedApps = []
    const appliedIds   = new Set()
    applications.forEach(a => {
      if (a.data?.talent_profile_id) appliedIds.add(a.data.talent_profile_id)
      const s = a.status
      if (s === 'PENDING' || s === 'INVITED') pendingApps.push(a)
      else if (s === 'APPROVED')              approvedApps.push(a)
    })
    return { pendingApps, approvedApps, appliedIds }
  }, [applications])

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

  const handleContractGenerate = async (talentProfileId, appId) => {
    setActionLoading(appId + '_ct')
    const res = handleApiResponse(await contractApi.generate(talentProfileId, event.entity_id))
    setActionLoading(null)
    if (res.success && res.data?.url) {
      window.open(res.data.url, '_blank')
    } else {
      alert(getErrorMessage(res.error))
    }
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
  const TRow = ({ t, app, matchPct, children }) => {
    const td   = t?.data ?? app?.data ?? {}
    const nome = td.nome ? `${td.nome} ${td.cognome ?? ''}`.trim() : (app?.data?.talent_name ?? '—')
    const badgeColor = matchPct >= 80 ? '#16A34A' : matchPct >= 60 ? '#D97706' : '#6B7280'
    return (
      <div style={{ background:'#1A1A24', borderRadius:8, padding:'12px 14px', display:'flex', gap:12, alignItems:'center' }}>
        <TalentAvatar nome={nome} fotoUrl={td.foto_busto_url} size={40} />
        <div style={{ flex:1, minWidth:0 }}>
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
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>{children}</div>
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
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {potenziali.map(t => (
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
            )
          ) : tab === 'attesa' ? (
            pendingApps.length === 0 ? (
              <div style={{ color:MUTED, fontSize:13, textAlign:'center', marginTop:40 }}>
                Nessuna candidatura in attesa.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {pendingApps.map(a => (
                  <TRow key={a.entity_id} t={talentMap[a.data?.talent_profile_id]} app={a}>
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
                  const t = talentMap[a.data?.talent_profile_id]
                  const ctBusy = actionLoading === a.entity_id + '_ct'
                  const mcBusy = markingCompleted === a.entity_id
                  return (
                    <TRow key={a.entity_id} t={t} app={a}>
                      <button
                        disabled={ctBusy}
                        onClick={() => handleContractGenerate(a.data?.talent_profile_id, a.entity_id)}
                        style={{ ...BTN('#C8A96E'), color:'#C8A96E', opacity: ctBusy ? 0.5 : 1, minWidth: 80 }}
                        title="Genera contratto Google Doc"
                      >
                        {ctBusy ? '…' : 'Contratto'}
                      </button>
                      <button
                        onClick={() => setContractData({ talent: t ?? null })}
                        style={{ ...BTN('#6b7280'), color:'#8888A0' }}
                        title="Anteprima e download .docx offline"
                      >
                        .docx
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

      {contractData && (
        <ContractPreviewModal
          talent={contractData.talent}
          event={event}
          onClose={() => setContractData(null)}
        />
      )}
    </>
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
          onRequestDelete={onRequestDelete}
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
        background:'#fff', borderRadius:8, padding:32, width:360,
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
  const [loading, setLoading] = useState(null)   // 'TIER1' | 'TIER2' | null

  async function handlePreview(tier) {
    setLoading(tier)
    const res = await newsletterApi.preview(tier)
    setLoading(null)
    onPreview(tier, res)
  }

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
      padding:'12px 16px', marginBottom:20, borderRadius:6,
      background:'#FDF6F7', border:`1px solid ${ACCENT}22`,
    }}>
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
        const aPct = aReq > 0 ? (Number(a.data?.confirmed_count ?? 0) / aReq) : 0
        const bPct = bReq > 0 ? (Number(b.data?.confirmed_count ?? 0) / bReq) : 0
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
    const prevEvents = events
    setEvents(prev => prev.filter(e => e.entity_id !== entity_id))
    setDeleteModal(null)
    const res = handleApiResponse(await eventApi.softDelete(entity_id))
    if (!res.success) {
      setEvents(prevEvents)
      alert(getErrorMessage(res.error))
    } else {
      load()
    }
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
          loading={false}
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
