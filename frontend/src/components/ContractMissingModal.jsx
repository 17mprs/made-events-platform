// === CONTRACT MISSING MODAL — MADE EVENTS Platform ===
// Gate soft del contratto: contract.check → se mancano dati mostra la modale,
// altrimenti genera. Usato da EventiPage e TalentPage tramite useContractGenerator.
import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COLORS } from '../styles/theme'
import { contractApi, talentApi, downloadContractPdf, contractErrorMessage, getErrorMessage } from '../api/client'

const TIPI_DOCUMENTO = [
  { value: 'carta_identita', label: "Carta d'identità" },
  { value: 'passaporto',     label: 'Passaporto' },
  { value: 'patente',        label: 'Patente' },
  { value: 'permesso',       label: 'Permesso di soggiorno' },
]

const FIELD_STYLE = {
  width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: 4,
  padding: '7px 9px', fontSize: 13, fontFamily: 'Montserrat,sans-serif', background: '#fff', color: COLORS.text,
}

/**
 * Orchestra check → (modale) → generate. onResult({ ok } | { ok:false, message }).
 * Un solo flusso alla volta: i click ripetuti mentre una chiamata è in corso sono ignorati.
 */
export function useContractGenerator({ onResult, handleApiResponse }) {
  // Sessione scaduta: handleApiResponse svuota il token (→ redirect al login)
  const api = handleApiResponse || (r => r)
  const [state, setState] = useState(null)   // { talentId, eventId, missing }
  const [busy, setBusy]   = useState(false)
  const lock = useRef(false)

  async function exclusive(fn) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try { return await fn() } finally { lock.current = false; setBusy(false) }
  }

  async function generate(talentId, eventId, force) {
    const res = api(await contractApi.generate(talentId, eventId, force))
    if (res.success && res.data?.pdf_base64) {
      downloadContractPdf(res.data)
      setState(null)
      onResult({ ok: true })
    } else {
      onResult({ ok: false, message: contractErrorMessage(res.error) })
    }
  }

  async function checkAndGenerate(talentId, eventId) {
    const chk = api(await contractApi.check(talentId, eventId))
    if (!chk.success) {
      setState(null)
      onResult({ ok: false, message: contractErrorMessage(chk.error) })
      return
    }
    const missing = chk.data?.missing ?? []
    if (missing.length === 0) return generate(talentId, eventId, false)
    setState({ talentId, eventId, missing, completeness: chk.data?.completeness ?? null })
  }

  const start = (talentId, eventId) => exclusive(() => checkAndGenerate(talentId, eventId))

  const modal = state && (
    <ContractMissingModal
      missing={state.missing}
      completeness={state.completeness}
      talentId={state.talentId}
      busy={busy}
      handleApiResponse={api}
      onClose={() => { if (!busy) setState(null) }}
      onSavedRecheck={() => exclusive(() => checkAndGenerate(state.talentId, state.eventId))}
      onForce={() => exclusive(() => generate(state.talentId, state.eventId, true))}
    />
  )

  return { start, busy, modal }
}

export default function ContractMissingModal({ missing, completeness, talentId, busy, handleApiResponse = r => r, onClose, onSavedRecheck, onForce }) {
  const navigate = useNavigate()
  const inlineFields = missing.filter(m => m.source === 'talent' && m.inline)
  const otherTalent  = missing.filter(m => m.source === 'talent' && !m.inline)
  const linked       = missing.filter(m => m.source !== 'talent')
  const [values, setValues]   = useState({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [confirmForce, setConfirmForce] = useState(false)
  const working = busy || saving

  const filled = inlineFields.filter(m => String(values[m.field] ?? '').trim() !== '')

  async function handleSave() {
    if (working || filled.length === 0) return
    setSaving(true)
    setError(null)
    const payload = { entity_id: talentId }
    filled.forEach(m => { payload[m.field] = String(values[m.field]).trim() })
    const res = handleApiResponse(await talentApi.updateProfile(payload))
    setSaving(false)
    if (!res.success) {
      // Una sola scrittura sul profilo: se fallisce non è stato salvato nulla.
      setError(res.error?.message || getErrorMessage(res.error))
      return
    }
    setValues({})
    onSavedRecheck()
  }

  function renderInput(m) {
    const v = values[m.field] ?? ''
    const set = e => setValues(p => ({ ...p, [m.field]: e.target.value }))
    if (m.field === 'tipo_documento') {
      return (
        <select value={v} onChange={set} style={FIELD_STYLE} disabled={working}>
          <option value="">Seleziona…</option>
          {TIPI_DOCUMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      )
    }
    if (m.field === 'scadenza_documento' || m.field === 'data_nascita') {
      return <input type="date" value={v} onChange={set} style={FIELD_STYLE} disabled={working} />
    }
    return (
      <input type="text" maxLength={200} value={v} disabled={working}
        onChange={m.field === 'codice_fiscale' ? e => setValues(p => ({ ...p, [m.field]: e.target.value.toUpperCase() })) : set}
        style={FIELD_STYLE} />
    )
  }

  const btn = { padding: '8px 16px', borderRadius: 6, fontSize: 12, fontFamily: 'Montserrat,sans-serif', cursor: working ? 'wait' : 'pointer' }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:2100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:8, padding:24, width:520, maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', fontFamily:'Montserrat,sans-serif', boxShadow:'0 20px 60px rgba(0,0,0,0.3)', color: COLORS.text }}>
        <h3 style={{ margin:'0 0 6px', fontSize:15, fontWeight:700 }}>Dati mancanti per il contratto</h3>
        <p style={{ margin:'0 0 16px', fontSize:12, color: COLORS.textSecondary }}>
          {missing.length} {missing.length === 1 ? 'dato mancante' : 'dati mancanti'}. Completali oppure genera comunque: i campi vuoti resteranno “[DA COMPILARE]” nel PDF.
        </p>

        {completeness && (
          <div style={{ margin:'0 0 16px', padding:'10px 12px', background:'#F8F8FB', borderRadius:6, border:`1px solid ${COLORS.border}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:600, marginBottom:6 }}>
              <span>Dati contratto del talent</span><span>{completeness.pct}%</span>
            </div>
            <div style={{ height:6, background:'#eee', borderRadius:3, overflow:'hidden' }}>
              <div style={{ width:`${completeness.pct}%`, height:'100%', background: completeness.pct >= 70 ? '#10B981' : completeness.pct >= 40 ? '#F97316' : '#EF4444' }} />
            </div>
            {completeness.mancanti.length > 0 && (
              <div style={{ marginTop:6, fontSize:11, color: COLORS.textSecondary }}>
                Mancano: {completeness.mancanti.map(m => m.label).join(', ')}
              </div>
            )}
          </div>
        )}

        {inlineFields.map(m => (
          <div key={m.field} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 3 }}>{m.label}</div>
            {renderInput(m)}
          </div>
        ))}

        {otherTalent.map(m => (
          <div key={m.field} style={{ marginBottom: 10, fontSize: 12 }}>
            <strong>{m.label}</strong>
            <span style={{ color: COLORS.textSecondary }}> — il talent deve compilarlo dal portale</span>
          </div>
        ))}

        {linked.map(m => (
          <div key={m.field} style={{ marginBottom: 10, fontSize: 12, display:'flex', justifyContent:'space-between', gap: 12, alignItems:'center' }}>
            <span><strong>{m.label}</strong></span>
            <button type="button" disabled={working} onClick={() => { onClose(); navigate('/admin/eventi') }}
              style={{ background:'none', border:'none', color: COLORS.accent, textDecoration:'underline', cursor:'pointer', fontSize: 12, padding: 0, fontFamily:'Montserrat,sans-serif' }}>
              {m.source === 'turno' ? 'Modifica turno' : 'Modifica evento'}
            </button>
          </div>
        ))}

        {error && <div style={{ margin:'8px 0', padding:'8px 12px', background:'#FFEBEE', borderRadius:6, fontSize:12, color:'#C62828' }}>{error}</div>}

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end', marginTop:18, alignItems:'center' }}>
          <button type="button" disabled title="in arrivo" style={{ ...btn, background:'#f5f5f5', border:`1px solid ${COLORS.border}`, color:'#999', cursor:'not-allowed', marginRight:'auto' }}>
            Richiedi al talent
          </button>
          <button type="button" onClick={onClose} disabled={working} style={{ ...btn, background:'none', border:`1px solid ${COLORS.border}`, color: COLORS.text }}>Annulla</button>
          {confirmForce ? (
            <button type="button" onClick={onForce} disabled={working}
              style={{ ...btn, background:'#C62828', border:'none', color:'#fff', fontWeight:700 }}>
              {working ? 'Generazione…' : 'Conferma: genera con campi vuoti'}
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmForce(true)} disabled={working}
              style={{ ...btn, background:'none', border:'1px solid #C62828', color:'#C62828' }}>
              Genera comunque
            </button>
          )}
          {inlineFields.length > 0 && (
            <button type="button" onClick={handleSave} disabled={working || filled.length === 0}
              style={{ ...btn, background: filled.length ? COLORS.accent : '#f5f5f5', border:'none', color: filled.length ? '#fff' : '#999', fontWeight:700, cursor: working ? 'wait' : (filled.length ? 'pointer' : 'not-allowed') }}>
              {saving ? 'Salvataggio…' : 'Salva e continua'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
