// === CLIENTI PAGE — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { clientApi, getErrorMessage } from '../../api/client'
import adminStore from '../../store/adminStore'
import { COLORS, COMPONENT_STYLES } from '../../styles/theme'
import Layout from '../../components/Layout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import { ADMIN_SIDEBAR, PageHeader } from './shared'

const EMPTY_FORM = {
  ragione_sociale:'', partita_iva:'', email:'',
  telefono:'', referente_nome:'', referente_cognome:'',
  indirizzo:'', citta:'',
}

function ClientFormDrawer({ onClose, onSaved, prefill, handleApiResponse }) {
  const isEdit = !!prefill?.entity_id
  const [form, setForm] = useState(isEdit ? { ...EMPTY_FORM, ...prefill.data } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const res = isEdit
      ? handleApiResponse(await clientApi.update({ entity_id: prefill.entity_id, ...form }))
      : handleApiResponse(await clientApi.create(form))
    setSaving(false)
    if (!res.success) { alert(getErrorMessage(res.error)); return }
    onSaved()
  }

  return (
    <>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:300 }} />
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:480, maxWidth:'95vw',
        background:'#fff', borderLeft:'1px solid #eaeaea',
        zIndex:301, overflowY:'auto', padding:32,
        fontFamily:'Montserrat, sans-serif',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:COLORS.text }}>
            {isEdit ? 'Modifica cliente' : 'Nuovo cliente'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#666', padding:'4px 8px', lineHeight:1 }}>✕</button>
        </div>

        <form onSubmit={save}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Input label="Ragione sociale *" value={form.ragione_sociale} onChange={set('ragione_sociale')} required />
            <Input label="Partita IVA" value={form.partita_iva} onChange={set('partita_iva')} />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} />
            <Input label="Telefono" value={form.telefono} onChange={set('telefono')} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Input label="Nome referente" value={form.referente_nome} onChange={set('referente_nome')} />
              <Input label="Cognome referente" value={form.referente_cognome} onChange={set('referente_cognome')} />
            </div>
            <Input label="Indirizzo" value={form.indirizzo} onChange={set('indirizzo')} />
            <Input label="Città" value={form.citta} onChange={set('citta')} />
          </div>
          <div style={{ marginTop:24, display:'flex', gap:10 }}>
            <Button type="submit" loading={saving}>
              {isEdit ? 'Salva modifiche' : 'Crea cliente'}
            </Button>
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
// EVENT STATUS BADGE (inline)
// ---------------------------------------------------------------------------

function eventStatusBadge(status) {
  const map = {
    LIVE:      { label:'Attivo',     color:'#15803D', bg:'#F0FDF4' },
    PLANNING:  { label:'Non attivo', color:'#6B7280', bg:'#F9FAFB' },
    COMPLETED: { label:'Completato', color:'#1D4ED8', bg:'#EFF6FF' },
    CANCELLED: { label:'Annullato',  color:'#BE123C', bg:'#FFF1F2' },
  }
  const m = map[status] ?? { label: status, color:'#6B7280', bg:'#F9FAFB' }
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, background:m.bg, color:m.color }}>
      {m.label}
    </span>
  )
}

export default function ClientiPage() {
  const { handleApiResponse } = useAuth()
  const [clients,  setClients]  = useState([])
  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const storeData = await adminStore.refresh()
    setLoading(false)
    if (!storeData) { setError('Errore nel caricamento dati.'); return }
    const seen = new Set()
    const dedupedClients = (storeData.clients ?? []).filter(c => {
      if (!c.entity_id || seen.has(c.entity_id)) return false
      seen.add(c.entity_id)
      return true
    })
    setClients(dedupedClients)
    setEvents(storeData.events ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'new') {
      setEditing(null)
      setShowForm(true)
    }
  }, [])

  const handleClose = () => { setShowForm(false); setEditing(null) }
  const handleSaved = () => { handleClose(); load() }

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageHeader
        title="Clienti"
        subtitle={`${clients.length} clienti`}
        action={<Button onClick={() => { setEditing(null); setShowForm(true) }}>+ Nuovo Cliente</Button>}
      />

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="error-banner">{error}</div>
      ) : clients.length === 0 ? (
        <div className="empty-state">Nessun cliente. Aggiungine uno con "+ Nuovo Cliente".</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ragione Sociale</th>
                <th>Partita IVA</th>
                <th>Referente</th>
                <th>Email</th>
                <th>Città</th>
                <th>Eventi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <ClientRowAccordion
                  key={c.entity_id}
                  client={c}
                  events={events}
                  onEdit={() => { setEditing(c); setShowForm(true) }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ClientFormDrawer
          onClose={handleClose}
          onSaved={handleSaved}
          prefill={editing}
          handleApiResponse={handleApiResponse}
        />
      )}
    </Layout>
  )
}

// ---------------------------------------------------------------------------
// CLIENT ROW WITH ACCORDION
// ---------------------------------------------------------------------------

function ClientRowAccordion({ client, events, onEdit }) {
  const [open, setOpen] = useState(false)
  const clientEvents = events.filter(e => String(e.data?.client_id) === String(client.entity_id))

  return (
    <>
      <tr>
        <td style={{ fontWeight:600 }}>{client.data?.ragione_sociale}</td>
        <td style={{ fontSize:12, color:'#8888A0' }}>{client.data?.partita_iva || '—'}</td>
        <td>{client.data?.referente_nome ? `${client.data.referente_nome} ${client.data.referente_cognome ?? ''}`.trim() : '—'}</td>
        <td style={{ fontSize:12, color:'#8888A0' }}>{client.data?.email || '—'}</td>
        <td>{client.data?.citta || '—'}</td>
        <td>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              background:'none', border:`1px solid ${COLORS.border}`, borderRadius:6,
              padding:'3px 10px', fontSize:11, cursor:'pointer', color:COLORS.textSecondary,
              fontFamily:'Montserrat,sans-serif', whiteSpace:'nowrap',
            }}
          >
            {open ? '▲' : '▼'} {clientEvents.length} eventi
          </button>
        </td>
        <td>
          <button
            onClick={onEdit}
            onMouseEnter={e => { e.currentTarget.style.background='#630E33'; e.currentTarget.style.color='#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#630E33' }}
            style={{
              background:'none', border:'1px solid #630E33', color:'#630E33',
              borderRadius:6, padding:'4px 12px', fontSize:11,
              cursor:'pointer', fontFamily:'Montserrat,sans-serif',
              transition:'background 0.15s, color 0.15s',
            }}
          >
            Modifica
          </button>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={7} style={{ padding:0, background:'#fafafa', borderBottom:`1px solid ${COLORS.border}` }}>
            <div style={{ padding:'10px 18px 14px' }}>
              {clientEvents.length === 0 ? (
                <span style={{ fontSize:12, color:COLORS.textSecondary, fontStyle:'italic' }}>Nessun evento assegnato</span>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {clientEvents.map(ev => {
                    const ed = ev.data ?? {}
                    const dataEvt   = ed.data_inizio ? new Date(ed.data_inizio).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' }) : '—'
                    const approvati = Number(ed.confirmed_count ?? ed.posti_confermati ?? 0)
                    const richiesti = Number(ed.hostess_richieste ?? 0)
                    return (
                      <div key={ev.entity_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 12px', background:'#fff', borderRadius:6, border:`1px solid ${COLORS.border}` }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <span style={{ fontSize:13, fontWeight:500, color:COLORS.text }}>{ed.titolo ?? '—'}</span>
                          {ed.luogo && <span style={{ fontSize:11, color:COLORS.textSecondary, marginLeft:8 }}>📍 {ed.luogo}</span>}
                        </div>
                        <span style={{ fontSize:12, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>{dataEvt}</span>
                        {richiesti > 0 && (
                          <span style={{ fontSize:11, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>
                            {approvati}/{richiesti}
                          </span>
                        )}
                        {eventStatusBadge(ev.status)}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
