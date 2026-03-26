// === CLIENTI PAGE — MADE EVENT Platform ===
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { clientApi, getErrorMessage } from '../../api/client'
import { COLORS, COMPONENT_STYLES } from '../../styles/theme'
import Layout from '../../components/Layout'
import Button from '../../components/Button'
import Card from '../../components/Card'
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
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:300 }} />
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

export default function ClientiPage() {
  const { handleApiResponse } = useAuth()
  const [clients,  setClients]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = handleApiResponse(await clientApi.list())
    setLoading(false)
    if (!res.success) { setError(getErrorMessage(res.error)); return }
    setClients(res.data?.items ?? [])
  }, [handleApiResponse])

  useEffect(() => { load() }, [load])

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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.entity_id}>
                  <td style={{ fontWeight:600 }}>{c.data?.ragione_sociale}</td>
                  <td style={{ fontSize:12, color:'#8888A0' }}>{c.data?.partita_iva || '—'}</td>
                  <td>{c.data?.referente_nome ? `${c.data.referente_nome} ${c.data.referente_cognome ?? ''}`.trim() : '—'}</td>
                  <td style={{ fontSize:12, color:'#8888A0' }}>{c.data?.email || '—'}</td>
                  <td>{c.data?.citta || '—'}</td>
                  <td>
                    <button
                      onClick={() => { setEditing(c); setShowForm(true) }}
                      onMouseEnter={e => { e.currentTarget.style.background='#7A1E2C'; e.currentTarget.style.color='#fff' }}
                      onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#7A1E2C' }}
                      style={{
                        background:'none', border:'1px solid #7A1E2C', color:'#7A1E2C',
                        borderRadius:6, padding:'4px 12px', fontSize:11,
                        cursor:'pointer', fontFamily:'Montserrat,sans-serif',
                        transition:'background 0.15s, color 0.15s',
                      }}
                    >
                      Modifica
                    </button>
                  </td>
                </tr>
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
