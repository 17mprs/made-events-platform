// === CANDIDATURE PAGE — MADE EVENTS Platform ===
// Database storico completo: VISTA 1 per candidatura / VISTA 2 per evento
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { applicationApi, talentApi, contractApi, getErrorMessage } from '../../api/client'
import adminStore from '../../store/adminStore'
import Layout from '../../components/Layout'
import Button from '../../components/Button'
import { ADMIN_SIDEBAR, PageHeader, TalentAvatar, ScoreBar, FILTER_INPUT } from './shared'
import { COLORS } from '../../styles/theme'
import { ContractPreviewModal } from '../admin/EventiPage'

// ---------------------------------------------------------------------------
// STATUS META
// ---------------------------------------------------------------------------

function statusMeta(status) {
  switch (status) {
    case 'INVITED':        return { label:'Invitato',        bg:'#EFF6FF', color:'#1D4ED8' }
    case 'PENDING':        return { label:'In attesa',       bg:'#FFF7ED', color:'#C2410C' }
    case 'DOCS_REQUESTED': return { label:'Docs richiesti',  bg:'#FAF5FF', color:'#7C3AED' }
    case 'DOCS_RECEIVED':  return { label:'Docs ricevuti',   bg:'#F0F9FF', color:'#0369A1' }
    case 'APPROVED':       return { label:'Approvato',       bg:'#F0FDF4', color:'#15803D' }
    case 'REJECTED':       return { label:'Rifiutato',       bg:'#FFF1F2', color:'#BE123C' }
    case 'WITHDRAWN':      return { label:'Ritirato',        bg:'#F9FAFB', color:'#6B7280' }
    default:               return { label: status,           bg:'#F9FAFB', color:'#6B7280' }
  }
}

function StatusPill({ status }) {
  const m = statusMeta(status)
  return (
    <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:10, fontSize:11, fontWeight:600, background:m.bg, color:m.color }}>
      {m.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// INLINE CTA per stato
// ---------------------------------------------------------------------------

function AppCtas({ app, onApprove, onReject, onRequestDocs, onConfirmDocs, onContract, actionLoading }) {
  const id = app.entity_id
  const busy = (k) => actionLoading === id + k
  const BTN = (label, color, onClick, loadKey) => (
    <button
      key={label}
      disabled={!!actionLoading}
      onClick={onClick}
      style={{
        background:'none', border:`1px solid ${color}`, color,
        borderRadius:5, padding:'3px 8px', fontSize:10, fontWeight:600,
        cursor: actionLoading ? 'not-allowed' : 'pointer',
        fontFamily:'Montserrat,sans-serif', opacity: busy(loadKey) ? 0.5 : 1,
        whiteSpace:'nowrap',
      }}
    >
      {busy(loadKey) ? '…' : label}
    </button>
  )

  const s = app.status
  return (
    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
      {(s === 'INVITED' || s === 'PENDING') && <>
        {BTN('Accetta',      '#15803D', () => onApprove(id),      '_ap')}
        {BTN('Rifiuta',      '#BE123C', () => onReject(id),       '_rj')}
        {BTN('Richiedi docs','#7C3AED', () => onRequestDocs(id),  '_rd')}
      </>}
      {s === 'DOCS_REQUESTED' &&
        BTN('Docs ricevuti', '#0369A1', () => onConfirmDocs(id), '_dc')}
      {s === 'DOCS_RECEIVED' && <>
        {BTN('Approva', '#15803D', () => onApprove(id), '_ap')}
        {BTN('Rifiuta', '#BE123C', () => onReject(id),  '_rj')}
      </>}
      {s === 'APPROVED' &&
        BTN('Contratto', '#C8A96E', () => onContract(app), '_ct')}
    </div>
  )
}

// ---------------------------------------------------------------------------
// VISTA 1 — per candidatura
// ---------------------------------------------------------------------------

function Vista1({ apps, talentMap, eventMap, actionLoading, onApprove, onReject, onRequestDocs, onConfirmDocs, onContract,
                  filterEvento, setFilterEvento, filterCitta, setFilterCitta,
                  filterStatus, setFilterStatus, filterMese, setFilterMese,
                  sortBy, setSortBy, eventTitles, mesiDisponibili }) {
  const filtered = useMemo(() => {
    let list = [...apps]
    if (filterStatus !== 'ALL') list = list.filter(a => a.status === filterStatus)
    if (filterEvento !== 'ALL') list = list.filter(a => (a.data?.event_titolo ?? '') === filterEvento)
    if (filterCitta.trim()) {
      const q = filterCitta.trim().toLowerCase()
      list = list.filter(a => {
        const t = talentMap[a.data?.talent_profile_id]
        return (t?.data?.citta ?? '').toLowerCase().includes(q)
      })
    }
    if (filterMese !== 'ALL') {
      list = list.filter(a => {
        if (!a.created_at) return false
        const d = new Date(a.created_at)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}` === filterMese
      })
    }
    if (sortBy === 'score') {
      list.sort((a, b) => {
        const ta = talentMap[a.data?.talent_profile_id]
        const tb = talentMap[b.data?.talent_profile_id]
        return (Number(tb?.data?.score) || 0) - (Number(ta?.data?.score) || 0)
      })
    } else {
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    }
    return list
  }, [apps, filterStatus, filterEvento, filterCitta, filterMese, sortBy, talentMap])

  return (
    <>
      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        <select value={filterEvento} onChange={e => setFilterEvento(e.target.value)} style={{ ...FILTER_INPUT, maxWidth:220 }}>
          <option value="ALL">Tutti gli eventi</option>
          {eventTitles.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input placeholder="Filtra per città…" value={filterCitta} onChange={e => setFilterCitta(e.target.value)} style={{ ...FILTER_INPUT, minWidth:140 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={FILTER_INPUT}>
          <option value="ALL">Tutti gli stati</option>
          <option value="INVITED">Invitato</option>
          <option value="PENDING">In attesa</option>
          <option value="DOCS_REQUESTED">Docs richiesti</option>
          <option value="DOCS_RECEIVED">Docs ricevuti</option>
          <option value="APPROVED">Approvato</option>
          <option value="REJECTED">Rifiutato</option>
          <option value="WITHDRAWN">Ritirato</option>
        </select>
        <select value={filterMese} onChange={e => setFilterMese(e.target.value)} style={{ ...FILTER_INPUT, minWidth:140 }}>
          <option value="ALL">Tutti i periodi</option>
          {mesiDisponibili.map(m => {
            const [y, mo] = m.split('-')
            const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('it-IT', { month:'long', year:'numeric' })
            return <option key={m} value={m}>{label}</option>
          })}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={FILTER_INPUT}>
          <option value="data">Data candidatura ↓</option>
          <option value="score">Score talent ↓</option>
        </select>
        <span style={{ fontSize:12, color:'#8888A0', marginLeft:'auto', whiteSpace:'nowrap' }}>{filtered.length} candidature</span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">Nessuna candidatura con questi filtri.</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width:42 }}></th>
                <th>Talent</th>
                <th>Evento</th>
                <th>Data evento</th>
                <th>Città</th>
                <th style={{ minWidth:90 }}>Score</th>
                <th>Stato</th>
                <th>Cand.</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const t    = talentMap[a.data?.talent_profile_id]
                const ev   = eventMap[a.data?.event_id]
                const td   = t?.data ?? {}
                const nome = td.nome ? `${td.nome} ${td.cognome ?? ''}`.trim() : (a.data?.talent_name ?? '—')
                const evData    = ev?.data ?? {}
                const dataEvt   = evData.data_inizio ? new Date(evData.data_inizio).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'2-digit' }) : '—'
                const dataCand  = a.created_at ? new Date(a.created_at).toLocaleDateString('it-IT', { day:'2-digit', month:'short' }) : '—'

                return (
                  <tr key={a.entity_id}>
                    <td><TalentAvatar nome={nome} fotoUrl={td.foto_busto_url} size={34} /></td>
                    <td style={{ fontWeight:500 }}>{nome}</td>
                    <td style={{ fontSize:12, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {evData.titolo ?? a.data?.event_titolo ?? '—'}
                    </td>
                    <td style={{ fontSize:12, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>{dataEvt}</td>
                    <td style={{ fontSize:12, color:COLORS.textSecondary }}>{td.citta ?? '—'}</td>
                    <td style={{ minWidth:90 }}>
                      {td.score != null ? <ScoreBar score={td.score} /> : <span style={{ color:COLORS.textSecondary, fontSize:12 }}>—</span>}
                    </td>
                    <td><StatusPill status={a.status} /></td>
                    <td style={{ fontSize:12, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>{dataCand}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <AppCtas
                        app={a}
                        onApprove={onApprove}
                        onReject={onReject}
                        onRequestDocs={onRequestDocs}
                        onConfirmDocs={onConfirmDocs}
                        onContract={onContract}
                        actionLoading={actionLoading}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// VISTA 2 — per evento
// ---------------------------------------------------------------------------

function Vista2({ apps, talentMap, eventMap, actionLoading, onApprove, onReject, onRequestDocs, onConfirmDocs, onContract }) {
  const [expandedId, setExpandedId] = useState(null)

  // Group apps by event_id, including events without any apps (stale)
  const groups = useMemo(() => {
    const map = {}
    apps.forEach(a => {
      const eid = a.data?.event_id ?? '__unknown__'
      if (!map[eid]) map[eid] = []
      map[eid].push(a)
    })
    // Sort by most recent app
    return Object.entries(map).sort(([, aa], [, bb]) => {
      const latestA = Math.max(...aa.map(a => new Date(a.created_at || 0)))
      const latestB = Math.max(...bb.map(b => new Date(b.created_at || 0)))
      return latestB - latestA
    })
  }, [apps])

  const STATUS_ORDER = ['PENDING','INVITED','DOCS_REQUESTED','DOCS_RECEIVED','APPROVED','REJECTED','WITHDRAWN']

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {groups.map(([eid, eventApps]) => {
        const ev = eventMap[eid]
        const ed = ev?.data ?? {}
        const approvedCount  = eventApps.filter(a => a.status === 'APPROVED').length
        const required       = Number(ed.hostess_richieste ?? 0)
        const isOpen         = expandedId === eid
        const dataEvt        = ed.data_inizio ? new Date(ed.data_inizio).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' }) : '—'

        // Sort apps by status priority within event
        const sortedApps = [...eventApps].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))

        return (
          <div key={eid} style={{ border:`1px solid ${COLORS.border}`, borderRadius:8, overflow:'hidden', background:'#fff' }}>
            {/* Card header */}
            <div
              onClick={() => setExpandedId(isOpen ? null : eid)}
              style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14, cursor:'pointer', background: isOpen ? '#fafafa' : '#fff' }}
            >
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14, color:COLORS.text, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {ed.titolo ?? '(evento sconosciuto)'}
                </div>
                <div style={{ fontSize:12, color:COLORS.textSecondary }}>
                  {dataEvt}{ed.luogo ? ` · ${ed.luogo}` : ''}
                </div>
              </div>
              {required > 0 && (
                <span style={{ fontSize:12, fontWeight:700, color: approvedCount >= required ? '#15803D' : '#C2410C', whiteSpace:'nowrap' }}>
                  {approvedCount}/{required} approvati
                </span>
              )}
              <span style={{ fontSize:12, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>{eventApps.length} cand.</span>
              <span style={{ fontSize:16, color:COLORS.textSecondary, lineHeight:1 }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* Expanded list */}
            {isOpen && (
              <div style={{ borderTop:`1px solid ${COLORS.border}`, padding:'12px 18px', display:'flex', flexDirection:'column', gap:8 }}>
                {sortedApps.map(a => {
                  const t    = talentMap[a.data?.talent_profile_id]
                  const td   = t?.data ?? {}
                  const nome = td.nome ? `${td.nome} ${td.cognome ?? ''}`.trim() : (a.data?.talent_name ?? '—')
                  return (
                    <div key={a.entity_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:6, background:'#fafafa' }}>
                      <TalentAvatar nome={nome} fotoUrl={td.foto_busto_url} size={32} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:COLORS.text }}>{nome}</div>
                        <div style={{ fontSize:11, color:COLORS.textSecondary }}>{td.citta ?? '—'}</div>
                      </div>
                      {td.score != null && <div style={{ width:80, flexShrink:0 }}><ScoreBar score={td.score} /></div>}
                      <StatusPill status={a.status} />
                      <AppCtas
                        app={a}
                        onApprove={onApprove}
                        onReject={onReject}
                        onRequestDocs={onRequestDocs}
                        onConfirmDocs={onConfirmDocs}
                        onContract={onContract}
                        actionLoading={actionLoading}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------------------------

export default function CandidaturePage() {
  const { handleApiResponse } = useAuth()

  const [apps,          setApps]          = useState([])
  const [talentMap,     setTalentMap]     = useState({})
  const [eventMap,      setEventMap]      = useState({})
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [vista,         setVista]         = useState('candidatura') // 'candidatura' | 'evento'
  const [contractApp,   setContractApp]   = useState(null) // { talent, event }

  // Filters (Vista 1)
  const [filterEvento,  setFilterEvento]  = useState('ALL')
  const [filterCitta,   setFilterCitta]   = useState('')
  const [filterStatus,  setFilterStatus]  = useState('ALL')
  const [filterMese,    setFilterMese]    = useState('ALL')
  const [sortBy,        setSortBy]        = useState('data')

  const load = useCallback(async () => {
    setLoading(true)
    const [appRes, talRes, storeData] = await Promise.all([
      applicationApi.list().then(r => handleApiResponse(r)),
      talentApi.list().then(r => handleApiResponse(r)),
      adminStore.ensure(),
    ])
    setLoading(false)

    if (appRes.success) setApps(appRes.data?.items ?? [])
    if (talRes.success) {
      const m = {}
      ;(talRes.data?.items ?? []).forEach(t => { m[t.entity_id] = t })
      setTalentMap(m)
    }
    if (storeData) {
      const m = {}
      ;(storeData.events ?? []).forEach(e => { m[e.entity_id] = e })
      setEventMap(m)
    }
  }, [handleApiResponse])

  useEffect(() => { load() }, [load])

  const approve = async (entity_id) => {
    setActionLoading(entity_id + '_ap')
    const res = handleApiResponse(await applicationApi.approve(entity_id))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  const reject = async (entity_id) => {
    const motivo = window.prompt('Motivo del rifiuto (opzionale):') ?? ''
    setActionLoading(entity_id + '_rj')
    const res = handleApiResponse(await applicationApi.reject(entity_id, motivo))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  const requestDocs = async (entity_id) => {
    setActionLoading(entity_id + '_rd')
    const res = handleApiResponse(await applicationApi.updateStatus(entity_id, 'DOCS_REQUESTED'))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  const confirmDocs = async (entity_id) => {
    setActionLoading(entity_id + '_dc')
    const res = handleApiResponse(await applicationApi.updateStatus(entity_id, 'DOCS_RECEIVED'))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  const openContract = (app) => {
    const talent = talentMap[app.data?.talent_profile_id] ?? null
    const event  = eventMap[app.data?.event_id] ?? null
    setContractApp({ talent, event })
  }

  const eventTitles = useMemo(() => {
    const s = new Set(apps.map(a => a.data?.event_titolo).filter(Boolean))
    return [...s].sort()
  }, [apps])

  const mesiDisponibili = useMemo(() => {
    const s = new Set()
    apps.forEach(a => {
      if (a.created_at) {
        const d = new Date(a.created_at)
        s.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`)
      }
    })
    return [...s].sort().reverse()
  }, [apps])

  const pendingCount = apps.filter(a => a.status === 'PENDING' || a.status === 'DOCS_RECEIVED').length

  const TAB = (active) => ({
    padding:'8px 18px', fontSize:13, fontWeight:600, background:'none', border:'none', cursor:'pointer',
    borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
    color: active ? COLORS.accent : COLORS.textSecondary,
    fontFamily:'Montserrat,sans-serif', marginBottom:-1,
  })

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageHeader
        title="Candidature"
        subtitle={loading ? '' : `${pendingCount > 0 ? `${pendingCount} in attesa · ` : ''}${apps.length} totali`}
      />

      {/* Vista switcher */}
      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.border}`, marginBottom:20 }}>
        <button style={TAB(vista === 'candidatura')} onClick={() => setVista('candidatura')}>Per candidatura</button>
        <button style={TAB(vista === 'evento')}      onClick={() => setVista('evento')}>Per evento</button>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : apps.length === 0 ? (
        <div className="empty-state">Nessuna candidatura.</div>
      ) : vista === 'candidatura' ? (
        <Vista1
          apps={apps}
          talentMap={talentMap}
          eventMap={eventMap}
          actionLoading={actionLoading}
          onApprove={approve}
          onReject={reject}
          onRequestDocs={requestDocs}
          onConfirmDocs={confirmDocs}
          onContract={openContract}
          filterEvento={filterEvento}   setFilterEvento={setFilterEvento}
          filterCitta={filterCitta}     setFilterCitta={setFilterCitta}
          filterStatus={filterStatus}   setFilterStatus={setFilterStatus}
          filterMese={filterMese}       setFilterMese={setFilterMese}
          sortBy={sortBy}               setSortBy={setSortBy}
          eventTitles={eventTitles}
          mesiDisponibili={mesiDisponibili}
        />
      ) : (
        <Vista2
          apps={apps}
          talentMap={talentMap}
          eventMap={eventMap}
          actionLoading={actionLoading}
          onApprove={approve}
          onReject={reject}
          onRequestDocs={requestDocs}
          onConfirmDocs={confirmDocs}
          onContract={openContract}
        />
      )}

      {contractApp && (
        <ContractPreviewModal
          talent={contractApp.talent}
          event={contractApp.event}
          onClose={() => setContractApp(null)}
        />
      )}
    </Layout>
  )
}
