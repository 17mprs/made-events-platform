// === DEBUG PAGE — MADE EVENTS Platform ===
// Pagina nascosta /admin/debug, solo SUPER_ADMIN. Tre tool diagnostici che
// sostituiscono l'accesso manuale al Google Sheet / GAS Editor:
//   1. Match score inspector — breakdown per campo di calculateEventMatch
//   2. Entity inspector       — dump raw data{} di una o più entity
//   3. Backfill runner        — dry-run + esecuzione dei backfill esistenti
import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { debugApi, getErrorMessage } from '../../api/client'
import Layout from '../../components/Layout'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { ADMIN_SIDEBAR, PageHeader, FILTER_INPUT } from './shared'
import { COLORS } from '../../styles/theme'

// ---------------------------------------------------------------------------
// SECTION — collassabile, stesso pattern di ClientRowAccordion (ClientiPage)
// ---------------------------------------------------------------------------

function Section({ title, subtitle, children }) {
  const [open, setOpen] = useState(true)
  return (
    <Card style={{ marginBottom: 20 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
      >
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:COLORS.text }}>{title}</div>
          {subtitle && <div style={{ fontSize:12, color:COLORS.textSecondary, marginTop:4 }}>{subtitle}</div>}
        </div>
        <span style={{ fontSize:14, color:COLORS.textSecondary }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ marginTop:20 }}>{children}</div>}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// TOOL 1 — MATCH SCORE INSPECTOR
// ---------------------------------------------------------------------------

const RESULT_COLORS = { pass:'#2E7D32', fail:'#C0392B', partial:'#E65100', skip:'#999999' }
const RESULT_LABELS = { pass:'PASS', fail:'FAIL', partial:'PARZIALE', skip:'—' }

function MatchInspector() {
  const { handleApiResponse } = useAuth()
  const [eventId, setEventId]   = useState('')
  const [talentId, setTalentId] = useState('')
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [result, setResult]     = useState(null)

  async function run() {
    if (!eventId || (!talentId && !email)) {
      setError('Serve event_id e (talent_profile_id oppure email)')
      return
    }
    setLoading(true); setError(null); setResult(null)
    const payload = talentId
      ? { event_id: eventId, talent_profile_id: talentId }
      : { event_id: eventId, email }
    const res = handleApiResponse(await debugApi.matchBreakdown(payload))
    setLoading(false)
    if (res.success) setResult(res.data)
    else setError(getErrorMessage(res.error))
  }

  return (
    <div>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        <input style={{ ...FILTER_INPUT, minWidth:220 }} placeholder="event_id" value={eventId} onChange={e => setEventId(e.target.value)} />
        <input style={{ ...FILTER_INPUT, minWidth:220 }} placeholder="talent_profile_id" value={talentId} onChange={e => setTalentId(e.target.value)} />
        <span style={{ fontSize:12, color:COLORS.textSecondary }}>oppure</span>
        <input style={{ ...FILTER_INPUT, minWidth:220 }} placeholder="email talent" value={email} onChange={e => setEmail(e.target.value)} />
        <Button onClick={run} loading={loading} size="sm">Calcola</Button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div>
          <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
            <div style={{ fontSize:28, fontWeight:700, color: result.breakdown.percentage === 0 ? COLORS.error : COLORS.accent }}>
              {result.breakdown.percentage}%
            </div>
            <div style={{ fontSize:13, color:COLORS.textSecondary }}>
              {result.event.titolo} — {result.talent.nome} {result.talent.cognome}
            </div>
          </div>

          {result.breakdown.hard_failed && (
            <div className="error-banner" style={{ marginBottom:16 }}>
              0% causato dal requisito HARD fallito: <strong>{result.breakdown.hard_failed}</strong>
            </div>
          )}
          {result.breakdown.no_requirements && (
            <div className="info-banner" style={{ marginBottom:16 }}>
              L'evento non ha nessun requisito impostato — score di default 50%.
            </div>
          )}
          {result.consistent === false && (
            <div className="error-banner" style={{ marginBottom:16 }}>
              ⚠ Il breakdown diverge dallo scoring live (calculateEventMatch) — le due funzioni sono divergenti, va indagato.
            </div>
          )}

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ textAlign:'left', borderBottom:`2px solid ${COLORS.border}` }}>
                  <th style={{ padding:'6px 8px' }}>Campo</th>
                  <th style={{ padding:'6px 8px' }}>Tipo</th>
                  <th style={{ padding:'6px 8px' }}>Evento</th>
                  <th style={{ padding:'6px 8px' }}>Talent</th>
                  <th style={{ padding:'6px 8px' }}>Esito</th>
                  <th style={{ padding:'6px 8px' }}>Punti</th>
                </tr>
              </thead>
              <tbody>
                {result.breakdown.fields.map(f => (
                  <tr key={f.key} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                    <td style={{ padding:'6px 8px' }}>{f.label}</td>
                    <td style={{ padding:'6px 8px' }}>{f.tipo}</td>
                    <td style={{ padding:'6px 8px' }}>{String(f.event_value)}</td>
                    <td style={{ padding:'6px 8px' }}>{String(f.talent_value)}</td>
                    <td style={{ padding:'6px 8px', color:RESULT_COLORS[f.result], fontWeight:700 }}>{RESULT_LABELS[f.result]}</td>
                    <td style={{ padding:'6px 8px' }}>{f.points}/{f.max_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TOOL 2 — ENTITY INSPECTOR
// ---------------------------------------------------------------------------

function EntityInspector() {
  const { handleApiResponse } = useAuth()
  const [mode, setMode]         = useState('id') // 'id' | 'search'
  const [entityId, setEntityId] = useState('')
  const [type, setType]         = useState('')
  const [field, setField]       = useState('')
  const [value, setValue]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [items, setItems]       = useState(null)

  async function run() {
    setLoading(true); setError(null); setItems(null)
    const payload = mode === 'id'
      ? { entity_id: entityId }
      : { type, field: field || undefined, value: field ? value : undefined }
    const res = handleApiResponse(await debugApi.inspectEntity(payload))
    setLoading(false)
    if (res.success) setItems(res.data.items)
    else setError(getErrorMessage(res.error))
  }

  return (
    <div>
      <div style={{ display:'flex', gap:16, marginBottom:16, fontSize:12 }}>
        <label style={{ cursor:'pointer' }}>
          <input type="radio" checked={mode === 'id'} onChange={() => setMode('id')} /> Per entity_id
        </label>
        <label style={{ cursor:'pointer' }}>
          <input type="radio" checked={mode === 'search'} onChange={() => setMode('search')} /> Per tipo + campo
        </label>
      </div>

      {mode === 'id' ? (
        <div style={{ display:'flex', gap:10, marginBottom:8 }}>
          <input style={{ ...FILTER_INPUT, minWidth:280 }} placeholder="entity_id" value={entityId} onChange={e => setEntityId(e.target.value)} />
          <Button onClick={run} loading={loading} size="sm" disabled={!entityId}>Cerca</Button>
        </div>
      ) : (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:8 }}>
          <input style={{ ...FILTER_INPUT, minWidth:160 }} placeholder="type (es. EVENT)" value={type} onChange={e => setType(e.target.value)} />
          <input style={{ ...FILTER_INPUT, minWidth:160 }} placeholder="campo data.* (opzionale)" value={field} onChange={e => setField(e.target.value)} />
          <input style={{ ...FILTER_INPUT, minWidth:160 }} placeholder="valore" value={value} onChange={e => setValue(e.target.value)} disabled={!field} />
          <Button onClick={run} loading={loading} size="sm" disabled={!type}>Cerca</Button>
        </div>
      )}

      <p style={{ fontSize:11, color:COLORS.textSecondary, marginBottom:16 }}>
        Ogni lettura viene registrata su ActivityLog (modulo DEBUG_TOOL).
      </p>

      {error && <div className="error-banner">{error}</div>}

      {items && items.length === 0 && <div className="empty-state">Nessun risultato.</div>}

      {items && items.map(it => (
        <div key={it.entity_id} style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, color:COLORS.textSecondary, marginBottom:6 }}>
            {it.type} — {it.entity_id}
            {it.deleted && <span style={{ color:COLORS.error, fontWeight:700 }}> · ELIMINATA (soft delete)</span>}
          </div>
          <pre style={{
            background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:6,
            padding:12, fontSize:12, overflow:'auto', maxHeight:400, margin:0,
          }}>
            {JSON.stringify(it, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TOOL 3 — BACKFILL RUNNER
// ---------------------------------------------------------------------------

const BACKFILLS = [
  {
    action: 'event.backfillSaturation',
    label:  'Ricalcola saturazione eventi',
    desc:   'Ricalcola confirmed_count su tutti gli EVENT dai relativi ASSIGNMENT attivi.',
  },
  {
    action: 'event.backfillMissingAssignments',
    label:  'ASSIGNMENT mancanti da candidature approvate',
    desc:   'Crea gli ASSIGNMENT mancanti per APPLICATION già APPROVED che non ne hanno uno.',
  },
  {
    action: 'event.backfillAssignmentShiftIds',
    label:  'shift_id mancanti su ASSIGNMENT',
    desc:   'Assegna shift_id agli ASSIGNMENT nati da candidatura diretta a evento (fix saturazione 16/09/2026).',
  },
  {
    action: 'talent.backfillFromLead',
    label:  'Recupero dati questionario talent',
    desc:   'Recupera campi mancanti sui TALENT_PROFILE già approvati dal LEAD_TALENT originale.',
  },
]

function BackfillRow({ item }) {
  const { handleApiResponse } = useAuth()
  const [dryRunResult, setDryRunResult] = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [executed, setExecuted]   = useState(null)

  async function runDry() {
    setLoading(true); setError(null); setExecuted(null)
    const res = handleApiResponse(await debugApi.runBackfill(item.action, true))
    setLoading(false)
    if (res.success) setDryRunResult(res.data)
    else setError(getErrorMessage(res.error))
  }

  async function runReal() {
    setLoading(true); setError(null)
    const res = handleApiResponse(await debugApi.runBackfill(item.action, false))
    setLoading(false)
    setConfirming(false)
    if (res.success) { setExecuted(res.data); setDryRunResult(null) }
    else setError(getErrorMessage(res.error))
  }

  const gaps = dryRunResult
    ? (dryRunResult.gaps_found ?? dryRunResult.events_changed ?? dryRunResult.profiles_updated ?? (dryRunResult.details || []).length)
    : null

  return (
    <div style={{ padding:'16px 0', borderBottom:`1px solid ${COLORS.border}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:COLORS.text }}>{item.label}</div>
          <div style={{ fontSize:12, color:COLORS.textSecondary, marginTop:2 }}>{item.desc}</div>
          <code style={{ fontSize:11, color:COLORS.textSecondary }}>{item.action}</code>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <Button variant="secondary" size="sm" onClick={runDry} loading={loading}>Dry-run</Button>
          <Button variant="danger" size="sm" disabled={!dryRunResult} onClick={() => setConfirming(true)}>Esegui</Button>
        </div>
      </div>

      {error && <div className="error-banner" style={{ marginTop:10 }}>{error}</div>}

      {dryRunResult && (
        <div style={{ marginTop:10, fontSize:12, color:COLORS.textSecondary }}>
          Dry-run: <strong>{gaps}</strong> elementi interessati.
          {dryRunResult.details && dryRunResult.details.length > 0 && (
            <pre style={{
              marginTop:6, background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:6,
              padding:10, fontSize:11, overflow:'auto', maxHeight:200,
            }}>
              {JSON.stringify(dryRunResult.details.slice(0, 20), null, 2)}
            </pre>
          )}
        </div>
      )}

      {executed && (
        <div className="success-banner" style={{ marginTop:10 }}>
          Eseguito — {JSON.stringify(executed)}
        </div>
      )}

      {confirming && (
        <div
          onClick={() => setConfirming(false)}
          style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.5)', padding:20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:8, padding:24, width:380, maxWidth:'100%' }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:8, color:COLORS.error }}>⚠ Conferma esecuzione</div>
            <p style={{ fontSize:13, color:COLORS.textSecondary, marginBottom:16, lineHeight:1.5 }}>
              Stai per eseguire <strong>{item.label}</strong> su produzione — <strong>{gaps}</strong> elementi verranno scritti (dal dry-run più recente). Confermi?
            </p>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button
                type="button" onClick={() => setConfirming(false)}
                style={{ background:'none', border:`1px solid ${COLORS.border}`, color:COLORS.text, borderRadius:6, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}
              >
                Annulla
              </button>
              <Button variant="danger" size="sm" onClick={runReal} loading={loading}>Esegui davvero</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BackfillRunner() {
  return (
    <div>
      {BACKFILLS.map(b => <BackfillRow key={b.action} item={b} />)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------

export default function DebugPage() {
  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageHeader title="Debug" subtitle="Strumenti diagnostici — solo SUPER_ADMIN" />

      <Section title="Match score inspector" subtitle="Breakdown per campo del calcolo evento ↔ talent">
        <MatchInspector />
      </Section>

      <Section title="Entity inspector" subtitle="Dump raw del campo data{} di una o più entity">
        <EntityInspector />
      </Section>

      <Section title="Backfill runner" subtitle="Dry-run obbligatorio prima di poter eseguire">
        <BackfillRunner />
      </Section>
    </Layout>
  )
}
