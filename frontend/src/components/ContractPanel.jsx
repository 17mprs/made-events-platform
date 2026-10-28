// === CONTRACT PANEL — MADE EVENTS Platform ===
// Admin: stato del contratto di una candidatura e azioni (genera/rigenera, anteprima, invia al
// talent, annulla). Condiviso da EventiPage e CandidaturePage. Nessun generatore lato browser:
// il PDF è sempre quello vero prodotto dal backend (contract.generate / contract.get).
import React, { createContext, useCallback, useEffect, useState } from 'react'
import { COLORS } from '../styles/theme'
import { contractApi, downloadContractPdf, getErrorMessage } from '../api/client'
import { useContractGenerator } from './ContractMissingModal'

const DAY_MS = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// HELPER
// ---------------------------------------------------------------------------

export function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Giorni rimasti alla scadenza (arrotondati per eccesso; <= 0 = scade oggi o scaduto). */
export function daysLeft(expiresAt) {
  const t = expiresAt ? new Date(expiresAt).getTime() : NaN
  return isNaN(t) ? null : Math.ceil((t - Date.now()) / DAY_MS)
}

export function base64ToBlobUrl(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
}

/** Messaggio leggibile per gli errori del flusso contratto. audience: 'admin' | 'talent'. */
export function contractErrorText(error, audience = 'admin') {
  if (!error) return 'Errore sconosciuto.'
  const msg = error.message
  switch (error.code) {
    case 'CT_FORCED':
      return 'Contratto generato con campi vuoti: completa i dati del talent e dell\'evento, poi rigeneralo prima di inviarlo.'
    case 'CT_LEGACY':
      return audience === 'talent'
        ? 'Questo contratto è stato generato con una versione precedente del sistema e va rigenerato: contatta il team.'
        : 'Contratto generato con una versione precedente del sistema: rigeneralo prima di inviarlo o farlo firmare.'
    case 'CT_STALE':
      return audience === 'talent'
        ? 'Questo contratto non è più valido per il tuo incarico attuale (turno o incarico cambiati). Contatta il team: riceverai un contratto aggiornato.'
        : 'Il contratto non corrisponde più all\'incarico attuale (turno o incarico cambiati): rigeneralo.'
    case 'CT_EXPIRED':
      return 'Il contratto è scaduto: contatta il team.'
    case 'CT_INTEGRITY':
      return 'Il contratto non è verificabile: contatta il team.'
    default:
      // I messaggi del backend sono già in italiano e specifici; getErrorMessage li maschererebbe (es. WF_002).
      return msg || getErrorMessage(error)
  }
}

// ---------------------------------------------------------------------------
// BADGE STATO CONTRATTO
// ---------------------------------------------------------------------------

export function contractBadgeMeta(c) {
  if (!c) return null
  switch (c.stato) {
    case 'GENERATED': return { label: c.forced ? 'Generato · campi vuoti' : 'Generato', bg: '#F3F4F6', color: '#4B5563' }
    case 'SENT': {
      if (c.scaduto) return { label: 'Inviato · scaduto', bg: '#FEF2F2', color: '#B91C1C' }
      const n = daysLeft(c.expires_at)
      const txt = n === null ? 'Inviato' : n <= 0 ? 'Inviato · scade oggi' : `Inviato · scade tra ${n} ${n === 1 ? 'giorno' : 'giorni'}`
      return { label: txt, bg: '#FFF7ED', color: '#C2410C' }
    }
    case 'SIGNED':   return { label: 'Firmato',   bg: '#F0FDF4', color: '#15803D' }
    case 'DECLINED': return { label: 'Rifiutato', bg: '#FEF2F2', color: '#B91C1C' }
    case 'EXPIRED':  return { label: 'Scaduto',   bg: '#F3F4F6', color: '#6B7280' }
    case 'VOID':     return { label: 'Annullato', bg: '#F3F4F6', color: '#6B7280' }
    default:         return { label: c.stato, bg: '#F3F4F6', color: '#4B5563' }
  }
}

export function ContractBadge({ contract, style }) {
  const m = contractBadgeMeta(contract)
  if (!m) return null
  return (
    <span title="Stato del contratto" style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 9, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.3px', whiteSpace: 'nowrap', background: m.bg, color: m.color, ...style,
    }}>
      {m.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// CONTRATTI PER CANDIDATURA (badge sulle righe)
// ---------------------------------------------------------------------------

/** Contesto per le righe che mostrano il badge senza dover far passare le props. */
export const ContractsContext = createContext({ byApp: {}, reload: () => {}, open: () => {} })

/**
 * Carica con contract.list (uno per evento) l'ultimo contratto di ogni candidatura.
 * @returns {{ byApp: Object<string, object>, reload: Function }}
 */
export function useApplicationContracts(eventIds, handleApiResponse) {
  const [byApp, setByApp] = useState({})
  const key = [...new Set((eventIds || []).filter(Boolean))].sort().join(',')

  const reload = useCallback(async () => {
    if (!key) { setByApp({}); return }
    const api = handleApiResponse || (r => r)
    const results = await Promise.all(key.split(',').map(id => contractApi.list({ event_id: id })))
    const m = {}
    results.forEach(r => {
      const res = api(r)
      if (!res.success) return
      ;(res.data?.items ?? []).forEach(c => {
        const cur = m[c.application_id]
        if (!cur || (Number(c.version) || 0) > (Number(cur.version) || 0)) m[c.application_id] = c
      })
    })
    setByApp(m)
  }, [key, handleApiResponse])

  useEffect(() => { reload() }, [reload])
  return { byApp, reload }
}

// ---------------------------------------------------------------------------
// ANTEPRIMA PDF (condivisa con il portale talent)
// ---------------------------------------------------------------------------

export function PdfPreviewModal({ pdfBase64, filename, title, onClose }) {
  // L'URL si crea e si revoca nello stesso effetto (in StrictMode l'effetto gira due volte: un URL
  // creato nel render verrebbe revocato dalla prima pulizia e l'iframe resterebbe vuoto).
  const [url, setUrl] = useState(null)
  useEffect(() => {
    const u = base64ToBlobUrl(pdfBase64)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [pdfBase64])
  const btn = { padding: '7px 14px', borderRadius: 6, fontSize: 12, fontFamily: 'Montserrat,sans-serif', cursor: 'pointer', background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.text }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, width: 860, maxWidth: '100%', height: '90vh', display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat,sans-serif', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14, flex: 1, minWidth: 160 }}>{title || 'Contratto'}</strong>
          <button type="button" style={btn} disabled={!url} onClick={() => window.open(url, '_blank', 'noopener')}>Apri in una scheda</button>
          <button type="button" style={btn} onClick={() => downloadContractPdf({ pdf_base64: pdfBase64, filename })}>Scarica</button>
          <button type="button" style={{ ...btn, background: COLORS.accent, color: '#fff', border: 'none' }} onClick={onClose}>Chiudi</button>
        </div>
        {url && <iframe title="Anteprima contratto" src={url} style={{ flex: 1, width: '100%', border: 'none', background: '#f5f5f5' }} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PANNELLO ADMIN
// ---------------------------------------------------------------------------

export function ContractPanelModal({ applicationId, talentId, eventId, talentName, eventTitle, handleApiResponse, onClose, onChanged }) {
  const api = handleApiResponse || (r => r)
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(null)       // 'preview' | 'send' | 'void'
  const [msg, setMsg]         = useState(null)       // { ok, text }
  const [confirm, setConfirm] = useState(null)       // 'send' | 'void' | 'regen'
  const [reason, setReason]   = useState('')
  const [preview, setPreview] = useState(null)       // { pdfBase64, filename, title }

  const reload = useCallback(async () => {
    const res = api(await contractApi.list({ application_id: applicationId }))
    setLoading(false)
    if (res.success) { setItems(res.data?.items ?? []); return res.data?.items ?? [] }
    setMsg({ ok: false, text: contractErrorText(res.error) })
    return []
  }, [applicationId])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { reload() }, [reload])

  const { start, busy: genBusy, modal: missingModal } = useContractGenerator({
    handleApiResponse,
    onResult: async r => {
      if (r.ok) {
        const list = await reload()
        const v = r.data?.version ?? '—'
        setMsg(list[0]?.forced
          ? { ok: false, text: `Contratto generato con campi vuoti (versione ${v}): non si può inviare. Completa i dati e rigenera.` }
          : { ok: true, text: `Contratto generato (versione ${v}). Controlla l'anteprima, poi invialo al talent.` })
        onChanged?.()
      } else {
        setMsg({ ok: false, text: contractErrorText({ message: r.message }) })
      }
    },
  })

  const latest = items[0] || null
  const working = !!busy || genBusy

  async function doPreview() {
    if (!latest || working) return
    setBusy('preview'); setMsg(null)
    const res = api(await contractApi.get(latest.entity_id))
    setBusy(null)
    if (res.success && res.data?.pdf_base64) {
      setPreview({ pdfBase64: res.data.pdf_base64, filename: latest.filename || 'Contratto.pdf', title: `Contratto v${latest.version ?? ''} — ${talentName}` })
    } else {
      setMsg({ ok: false, text: contractErrorText(res.error) })
    }
  }

  async function doSend() {
    setBusy('send'); setMsg(null)
    const res = api(await contractApi.send(latest.entity_id))
    setBusy(null); setConfirm(null)
    if (res.success) {
      setMsg({ ok: true, text: `Contratto inviato a ${talentName}: scade il ${fmtDateTime(res.data?.expires_at)}.` })
      reload(); onChanged?.()
    } else {
      setMsg({ ok: false, text: contractErrorText(res.error) })
    }
  }

  async function doVoid() {
    setBusy('void'); setMsg(null)
    const res = api(await contractApi.void(latest.entity_id, reason.trim()))
    setBusy(null); setConfirm(null); setReason('')
    if (res.success) {
      setMsg({ ok: true, text: res.data?.posto_liberato ? 'Contratto annullato: posto liberato (candidatura di nuovo in attesa).' : 'Contratto annullato.' })
      reload(); onChanged?.()
    } else {
      setMsg({ ok: false, text: contractErrorText(res.error) })
    }
  }

  function doRegenerate() {
    setConfirm(null); setMsg(null)
    start(talentId, eventId)
  }

  // ---- stato e azioni consentite
  const st = latest?.stato
  const isLive = st === 'GENERATED' || st === 'SENT'
  const blockedSend = latest && (latest.forced || latest.legacy)
  const blockedText = latest?.legacy
    ? 'Contratto generato con una versione precedente del sistema: rigeneralo prima di inviarlo.'
    : 'Contratto generato con campi vuoti: completa i dati e rigenera prima di inviarlo.'

  const btn = (kind = 'neutral', disabled = false) => ({
    padding: '8px 14px', borderRadius: 6, fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : (working ? 'wait' : 'pointer'), opacity: disabled ? 0.5 : 1,
    ...(kind === 'primary' ? { background: COLORS.accent, color: '#fff', border: 'none' }
      : kind === 'danger'  ? { background: 'none', color: '#B91C1C', border: '1px solid #B91C1C' }
      : { background: 'none', color: COLORS.text, border: `1px solid ${COLORS.border}` }),
  })

  return (
    <>
    <div onClick={() => { if (!working) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, padding: 24, width: 560, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', fontFamily: 'Montserrat,sans-serif', color: COLORS.text, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Contratto — {talentName || 'Talent'}</h3>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 16 }}>{eventTitle || ''}</div>

        {loading ? <div className="spinner" /> : !latest ? (
          <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 }}>Nessun contratto generato per questa candidatura.</div>
        ) : (
          <div style={{ padding: '12px 14px', background: '#F8F8FB', border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <ContractBadge contract={latest} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Versione {latest.version ?? '—'}</span>
            </div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.7 }}>
              <div>Generato il {fmtDateTime(latest.generato_il)}</div>
              {latest.sent_at && <div>Inviato il {fmtDateTime(latest.sent_at)}{st === 'SENT' && <> · scade il <strong>{fmtDateTime(latest.expires_at)}</strong></>}</div>}
              {st === 'SIGNED' && <div style={{ color: '#15803D' }}>Firmato il {fmtDateTime(latest.accepted_at || latest.signed_at)}: incarico confermato</div>}
              {st === 'DECLINED' && <div>Rifiutato il {fmtDateTime(latest.declined_at)}</div>}
            </div>
            {isLive && blockedSend && st === 'GENERATED' && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 6, fontSize: 12, color: '#9A3412' }}>
                {blockedText}
              </div>
            )}
          </div>
        )}

        {msg && (
          <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 6, fontSize: 12, background: msg.ok ? '#E8F5E9' : '#FFEBEE', color: msg.ok ? '#2E7D32' : '#C62828' }}>{msg.text}</div>
        )}

        {confirm === 'send' && (
          <div style={{ marginBottom: 14, padding: 12, border: `1px solid ${COLORS.accent}`, borderRadius: 8, fontSize: 12 }}>
            <div style={{ marginBottom: 10 }}>Invio il contratto a <strong>{talentName}</strong>? Riceverà una mail (senza allegato) e potrà leggerlo e firmarlo nel portale entro 7 giorni.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={btn('primary')} disabled={working} onClick={doSend}>{busy === 'send' ? 'Invio…' : 'Conferma invio'}</button>
              <button type="button" style={btn()} disabled={working} onClick={() => setConfirm(null)}>Annulla</button>
            </div>
          </div>
        )}
        {confirm === 'void' && (
          <div style={{ marginBottom: 14, padding: 12, border: '1px solid #B91C1C', borderRadius: 8, fontSize: 12 }}>
            <div style={{ marginBottom: 8 }}>
              Annullare il contratto?{st === 'SENT' && ' Il talent non potrà più firmarlo e il posto torna libero.'}
            </div>
            <input type="text" maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo (facoltativo)"
              style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: '6px 8px', fontSize: 12, marginBottom: 8, fontFamily: 'Montserrat,sans-serif' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={{ ...btn('danger'), background: '#B91C1C', color: '#fff' }} disabled={working} onClick={doVoid}>{busy === 'void' ? 'Annullamento…' : 'Conferma annullamento'}</button>
              <button type="button" style={btn()} disabled={working} onClick={() => { setConfirm(null); setReason('') }}>Indietro</button>
            </div>
          </div>
        )}
        {confirm === 'regen' && (
          <div style={{ marginBottom: 14, padding: 12, border: '1px solid #C2410C', borderRadius: 8, fontSize: 12 }}>
            <div style={{ marginBottom: 10 }}>Il contratto già inviato verrà annullato (il talent riceverà una mail) e dovrai inviare quello nuovo. Rigenerare?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={btn('primary')} disabled={working} onClick={doRegenerate}>Conferma e rigenera</button>
              <button type="button" style={btn()} disabled={working} onClick={() => setConfirm(null)}>Indietro</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {latest && (
            <button type="button" style={btn()} disabled={working} onClick={doPreview}>{busy === 'preview' ? 'Apertura…' : 'Anteprima'}</button>
          )}
          {st === 'GENERATED' && (
            <button type="button" style={btn('primary', blockedSend)} disabled={working || blockedSend} onClick={() => setConfirm('send')}
              title={blockedSend ? blockedText : 'Invia il contratto al talent'}>
              Invia al talent
            </button>
          )}
          {isLive && (
            <button type="button" style={btn('danger')} disabled={working} onClick={() => setConfirm('void')}>Annulla</button>
          )}
          {st !== 'SIGNED' && (
            <button type="button" style={btn(!latest ? 'primary' : 'neutral')} disabled={working}
              onClick={() => (st === 'SENT' ? setConfirm('regen') : doRegenerate())}>
              {genBusy ? 'Generazione…' : (latest ? 'Rigenera' : 'Genera contratto')}
            </button>
          )}
          <button type="button" style={{ ...btn(), marginLeft: 'auto' }} disabled={working} onClick={onClose}>Chiudi</button>
        </div>

        {items.length > 1 && (
          <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: COLORS.textSecondary, marginBottom: 6 }}>Versioni precedenti</div>
            {items.slice(1).map(c => (
              <div key={c.entity_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0' }}>
                <span style={{ width: 28, color: COLORS.textSecondary }}>v{c.version ?? '—'}</span>
                <ContractBadge contract={c} />
                <span style={{ color: COLORS.textSecondary }}>{fmtDateTime(c.generato_il)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    {missingModal}
    {preview && <PdfPreviewModal {...preview} onClose={() => setPreview(null)} />}
    </>
  )
}
