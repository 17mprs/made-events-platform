// === CANDIDATURE PAGE — MADE EVENTS Platform ===
// 3 tab: ATTIVE (in corso) | STORICO (tutte + eventi archiviati) | INSIGHT (analytics)
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { applicationApi, talentApi, getErrorMessage } from '../../api/client'
import adminStore from '../../store/adminStore'
import Layout from '../../components/Layout'
import { ADMIN_SIDEBAR, PageHeader, TalentAvatar, ScoreBar, FILTER_INPUT } from './shared'
import { COLORS } from '../../styles/theme'
import { ContractPreviewModal } from '../admin/EventiPage'

// ---------------------------------------------------------------------------
// HELPERS
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

function fmtDate(iso, opts = { day:'2-digit', month:'short', year:'2-digit' }) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', opts)
}

// ---------------------------------------------------------------------------
// APP CTAs — inline action buttons (TAB 1 only)
// ---------------------------------------------------------------------------

function AppCtas({ app, onApprove, onReject, onRequestDocs, onConfirmDocs, onContract, actionLoading }) {
  const id   = app.entity_id
  const busy = (k) => actionLoading === id + k
  const BTN  = (label, color, onClick, loadKey) => (
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
        {BTN('Accetta',       '#15803D', () => onApprove(id),     '_ap')}
        {BTN('Rifiuta',       '#BE123C', () => onReject(id),      '_rj')}
        {BTN('Richiedi docs', '#7C3AED', () => onRequestDocs(id), '_rd')}
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
// TAB 1 — VISTA 1: per candidatura
// ---------------------------------------------------------------------------

function Vista1({ apps, talentMap, eventMap, actionLoading, onApprove, onReject,
                  onRequestDocs, onConfirmDocs, onContract,
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
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === filterMese
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
            const label = new Date(Number(y), Number(mo)-1, 1).toLocaleDateString('it-IT', { month:'long', year:'numeric' })
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
                const t     = talentMap[a.data?.talent_profile_id]
                const ev    = eventMap[a.data?.event_id]
                const td    = t?.data ?? {}
                const nome  = td.nome ? `${td.nome} ${td.cognome ?? ''}`.trim() : (a.data?.talent_name ?? '—')
                const evData = ev?.data ?? {}
                return (
                  <tr key={a.entity_id}>
                    <td><TalentAvatar nome={nome} fotoUrl={td.foto_busto_url} size={34} /></td>
                    <td style={{ fontWeight:500 }}>{nome}</td>
                    <td style={{ fontSize:12, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {evData.titolo ?? a.data?.event_titolo ?? '—'}
                    </td>
                    <td style={{ fontSize:12, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>
                      {fmtDate(evData.data_inizio)}
                    </td>
                    <td style={{ fontSize:12, color:COLORS.textSecondary }}>{td.citta ?? '—'}</td>
                    <td style={{ minWidth:90 }}>
                      {td.score != null ? <ScoreBar score={td.score} /> : <span style={{ color:COLORS.textSecondary, fontSize:12 }}>—</span>}
                    </td>
                    <td><StatusPill status={a.status} /></td>
                    <td style={{ fontSize:12, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>{fmtDate(a.created_at, { day:'2-digit', month:'short' })}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <AppCtas app={a} onApprove={onApprove} onReject={onReject}
                        onRequestDocs={onRequestDocs} onConfirmDocs={onConfirmDocs}
                        onContract={onContract} actionLoading={actionLoading} />
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
// TAB 1 — VISTA 2: per evento
// ---------------------------------------------------------------------------

function Vista2({ apps, talentMap, eventMap, actionLoading, onApprove, onReject, onRequestDocs, onConfirmDocs, onContract }) {
  const [expandedId, setExpandedId] = useState(null)
  const STATUS_ORDER = ['PENDING','INVITED','DOCS_REQUESTED','DOCS_RECEIVED','APPROVED','REJECTED','WITHDRAWN']

  const groups = useMemo(() => {
    const map = {}
    apps.forEach(a => {
      const eid = a.data?.event_id ?? '__unknown__'
      if (!map[eid]) map[eid] = []
      map[eid].push(a)
    })
    return Object.entries(map).sort(([, aa], [, bb]) => {
      const latestA = Math.max(...aa.map(a => new Date(a.created_at || 0)))
      const latestB = Math.max(...bb.map(b => new Date(b.created_at || 0)))
      return latestB - latestA
    })
  }, [apps])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {groups.map(([eid, eventApps]) => {
        const ev            = eventMap[eid]
        const ed            = ev?.data ?? {}
        const approvedCount = eventApps.filter(a => a.status === 'APPROVED').length
        const required      = Number(ed.hostess_richieste ?? 0)
        const isOpen        = expandedId === eid
        const sortedApps    = [...eventApps].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))

        return (
          <div key={eid} style={{ border:`1px solid ${COLORS.border}`, borderRadius:8, overflow:'hidden', background:'#fff' }}>
            <div onClick={() => setExpandedId(isOpen ? null : eid)}
              style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', cursor:'pointer', background: isOpen ? '#fafafa' : '#fff' }}
            >
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14, color:COLORS.text, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {ed.titolo ?? '(evento sconosciuto)'}
                </div>
                <div style={{ fontSize:12, color:COLORS.textSecondary }}>
                  {fmtDate(ed.data_inizio, { day:'2-digit', month:'short', year:'numeric' })}{ed.luogo ? ` · ${ed.luogo}` : ''}
                </div>
              </div>
              {required > 0 && (
                <span style={{ fontSize:12, fontWeight:700, color: approvedCount >= required ? '#15803D' : '#C2410C', whiteSpace:'nowrap' }}>
                  {approvedCount}/{required} approvati
                </span>
              )}
              <span style={{ fontSize:12, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>{eventApps.length} cand.</span>
              <span style={{ fontSize:16, color:COLORS.textSecondary }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div style={{ borderTop:`1px solid ${COLORS.border}`, padding:'12px 18px', display:'flex', flexDirection:'column', gap:8 }}>
                {sortedApps.map(a => {
                  const t    = talentMap[a.data?.talent_profile_id]
                  const td   = t?.data ?? {}
                  const nome = td.nome ? `${td.nome} ${td.cognome ?? ''}`.trim() : (a.data?.talent_name ?? '—')
                  return (
                    <div key={a.entity_id} style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', padding:'8px 10px', borderRadius:6, background:'#fafafa' }}>
                      <TalentAvatar nome={nome} fotoUrl={td.foto_busto_url} size={32} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:COLORS.text }}>{nome}</div>
                        <div style={{ fontSize:11, color:COLORS.textSecondary }}>{td.citta ?? '—'}</div>
                      </div>
                      {td.score != null && <div style={{ width:80, flexShrink:0 }}><ScoreBar score={td.score} /></div>}
                      <StatusPill status={a.status} />
                      <AppCtas app={a} onApprove={onApprove} onReject={onReject}
                        onRequestDocs={onRequestDocs} onConfirmDocs={onConfirmDocs}
                        onContract={onContract} actionLoading={actionLoading} />
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
// TAB 2 — STORICO
// ---------------------------------------------------------------------------

function StoricoTab({ appsAll, loadingAll }) {
  const [search,       setSearch]       = useState('')
  const [filterAnno,   setFilterAnno]   = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterCitta,  setFilterCitta]  = useState('')
  const [sortBy,       setSortBy]       = useState('data')

  const anni = useMemo(() => {
    const s = new Set()
    appsAll.forEach(a => { if (a.created_at) s.add(String(new Date(a.created_at).getFullYear())) })
    return [...s].sort().reverse()
  }, [appsAll])

  const filtered = useMemo(() => {
    let list = [...appsAll]
    if (filterStatus !== 'ALL') list = list.filter(a => a.status === filterStatus)
    if (filterAnno !== 'ALL')   list = list.filter(a => a.created_at && String(new Date(a.created_at).getFullYear()) === filterAnno)
    if (filterCitta.trim()) {
      const q = filterCitta.trim().toLowerCase()
      list = list.filter(a => (a.talent_snapshot?.citta ?? '').toLowerCase().includes(q))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(a => {
        const ts = a.talent_snapshot ?? {}
        return `${ts.nome} ${ts.cognome}`.toLowerCase().includes(q)
      })
    }
    if (sortBy === 'score') {
      list.sort((a, b) => (b.talent_snapshot?.score ?? 0) - (a.talent_snapshot?.score ?? 0))
    } else {
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    }
    return list
  }, [appsAll, filterStatus, filterAnno, filterCitta, search, sortBy])

  if (loadingAll) return <div className="spinner" />

  return (
    <>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        <input
          placeholder="Cerca talent…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...FILTER_INPUT, minWidth:160 }}
        />
        <select value={filterAnno} onChange={e => setFilterAnno(e.target.value)} style={FILTER_INPUT}>
          <option value="ALL">Tutti gli anni</option>
          {anni.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={FILTER_INPUT}>
          <option value="ALL">Tutti gli stati</option>
          <option value="INVITED">Invitato</option>
          <option value="PENDING">In attesa</option>
          <option value="APPROVED">Approvato</option>
          <option value="REJECTED">Rifiutato</option>
          <option value="WITHDRAWN">Ritirato</option>
        </select>
        <input
          placeholder="Città…"
          value={filterCitta} onChange={e => setFilterCitta(e.target.value)}
          style={{ ...FILTER_INPUT, minWidth:100 }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={FILTER_INPUT}>
          <option value="data">Data ↓</option>
          <option value="score">Score ↓</option>
        </select>
        <span style={{ fontSize:12, color:'#8888A0', marginLeft:'auto', whiteSpace:'nowrap' }}>
          {filtered.length} candidature totali
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">Nessun risultato.</div>
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
                <th>Stato cand.</th>
                <th>Data cand.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const ts  = a.talent_snapshot ?? {}
                const ev  = a.event_snapshot  ?? {}
                const nome = ts.nome ? `${ts.nome} ${ts.cognome ?? ''}`.trim() : '—'
                return (
                  <tr key={a.entity_id}>
                    <td><TalentAvatar nome={nome} fotoUrl={ts.foto_busto_url} size={34} /></td>
                    <td style={{ fontWeight:500 }}>{nome}</td>
                    <td style={{ fontSize:12, maxWidth:170, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      <span style={{ color: ev.deleted ? '#9CA3AF' : COLORS.text }}>
                        {ev.titolo || '—'}
                      </span>
                      {ev.deleted && (
                        <span style={{ marginLeft:6, fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:8, background:'#F3F4F6', color:'#6B7280' }}>
                          Archiviato
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize:12, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>{fmtDate(ev.data_inizio)}</td>
                    <td style={{ fontSize:12, color:COLORS.textSecondary }}>{ts.citta || '—'}</td>
                    <td style={{ minWidth:90 }}>
                      {ts.score != null ? <ScoreBar score={ts.score} /> : <span style={{ color:COLORS.textSecondary, fontSize:12 }}>—</span>}
                    </td>
                    <td><StatusPill status={a.status} /></td>
                    <td style={{ fontSize:12, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>
                      {fmtDate(a.created_at, { day:'2-digit', month:'short', year:'numeric' })}
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
// TAB 3 — INSIGHT
// ---------------------------------------------------------------------------

function InsightTab({ appsAll, allTalents, loadingAll }) {
  const ACCENT = COLORS.accent

  // SEZIONE A — Top talent affidabilità: APPROVED su eventi COMPLETED
  const topAffidabili = useMemo(() => {
    const map = {}
    appsAll.forEach(a => {
      if (a.status !== 'APPROVED') return
      if ((a.event_snapshot?.status ?? '') !== 'COMPLETED') return
      const tid = a.data?.talent_profile_id
      if (!tid) return
      if (!map[tid]) map[tid] = { ...a.talent_snapshot, talent_id: tid, count: 0 }
      map[tid].count++
    })
    return Object.values(map)
      .sort((a, b) => b.count - a.count || (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 10)
  }, [appsAll])

  // SEZIONE B — Talent più attivi: totale candidature non rifiutate
  const topAttivi = useMemo(() => {
    const map = {}
    appsAll.forEach(a => {
      if (a.status === 'REJECTED' || a.status === 'WITHDRAWN') return
      const tid = a.data?.talent_profile_id
      if (!tid) return
      if (!map[tid]) map[tid] = { ...a.talent_snapshot, talent_id: tid, count: 0 }
      map[tid].count++
    })
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [appsAll])

  // SEZIONE C — Alert: APPROVED talent senza candidature negli ultimi 60 giorni
  const disponibili = useMemo(() => {
    const CUTOFF = Date.now() - 60 * 24 * 60 * 60 * 1000
    const lastApp = {}
    appsAll.forEach(a => {
      const tid = a.data?.talent_profile_id
      if (!tid) return
      const t = new Date(a.created_at || 0).getTime()
      if (!lastApp[tid] || t > lastApp[tid]) lastApp[tid] = t
    })
    return allTalents
      .filter(t => {
        if (t.status !== 'APPROVED' && t.status !== 'ACTIVE') return false
        const last = lastApp[t.entity_id] || 0
        return last < CUTOFF
      })
      .sort((a, b) => (b.data?.score ?? 0) - (a.data?.score ?? 0))
      .slice(0, 20)
  }, [appsAll, allTalents])

  if (loadingAll) return <div className="spinner" />

  const SectionTitle = ({ children }) => (
    <div style={{ marginBottom:16, paddingBottom:8, borderBottom:`2px solid ${ACCENT}22` }}>
      <div style={{ display:'inline-block', width:28, height:3, background:ACCENT, borderRadius:2, verticalAlign:'middle', marginRight:8 }} />
      <span style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:ACCENT }}>
        {children}
      </span>
    </div>
  )

  const TalentCard = ({ item, badge }) => {
    const nome = item.nome ? `${item.nome} ${item.cognome ?? ''}`.trim() : '—'
    return (
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
        background:'#fff', border:`1px solid ${COLORS.border}`, borderRadius:8,
      }}>
        <TalentAvatar nome={nome} fotoUrl={item.foto_busto_url} size={40} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:COLORS.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nome}</div>
          <div style={{ fontSize:11, color:COLORS.textSecondary }}>{item.citta || '—'}</div>
          {item.score != null && <div style={{ marginTop:3, width:80 }}><ScoreBar score={item.score} /></div>}
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:20, fontWeight:700, color:ACCENT, lineHeight:1 }}>{item.count ?? ''}</div>
          <div style={{ fontSize:10, color:COLORS.textSecondary, marginTop:2 }}>{badge}</div>
        </div>
      </div>
    )
  }

  const AlertCard = ({ talent }) => {
    const d    = talent.data ?? {}
    const nome = d.nome ? `${d.nome} ${d.cognome ?? ''}`.trim() : '—'
    return (
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
        background:'#fff', border:`1px solid ${COLORS.border}`, borderRadius:8,
      }}>
        <TalentAvatar nome={nome} fotoUrl={d.foto_busto_url} size={36} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:500, color:COLORS.text }}>{nome}</div>
          <div style={{ fontSize:11, color:COLORS.textSecondary }}>{d.citta || '—'}</div>
        </div>
        {d.score != null && <div style={{ width:80 }}><ScoreBar score={d.score} /></div>}
        <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:8, background:'#F0FDF4', color:'#15803D', whiteSpace:'nowrap' }}>
          Disponibile
        </span>
        {d.email && (
          <a
            href={`mailto:${d.email}`}
            style={{ fontSize:11, padding:'4px 10px', border:`1px solid ${ACCENT}`, borderRadius:4, color:ACCENT, textDecoration:'none', fontWeight:600, whiteSpace:'nowrap', fontFamily:'Montserrat,sans-serif' }}
          >
            Contatta
          </a>
        )}
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:36 }}>

      {/* SEZIONE A */}
      <div>
        <SectionTitle>Top talent per affidabilità</SectionTitle>
        <p style={{ margin:'0 0 14px', fontSize:12, color:COLORS.textSecondary }}>
          Classifica per numero di eventi completati con stato APPROVED.
        </p>
        {topAffidabili.length === 0 ? (
          <div className="empty-state">Nessun evento completato registrato.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:10 }}>
            {topAffidabili.map((item, i) => (
              <TalentCard key={item.talent_id} item={item} badge={`event${item.count !== 1 ? 'i' : 'o'} completat${item.count !== 1 ? 'i' : 'o'}`} />
            ))}
          </div>
        )}
      </div>

      {/* SEZIONE B */}
      <div>
        <SectionTitle>Talent più attivi</SectionTitle>
        <p style={{ margin:'0 0 14px', fontSize:12, color:COLORS.textSecondary }}>
          Top 10 per numero totale di candidature (esclusi rifiutati e ritirati).
        </p>
        {topAttivi.length === 0 ? (
          <div className="empty-state">Nessuna candidatura registrata.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:10 }}>
            {topAttivi.map(item => (
              <TalentCard key={item.talent_id} item={item} badge={`candidatur${item.count !== 1 ? 'e' : 'a'}`} />
            ))}
          </div>
        )}
      </div>

      {/* SEZIONE C */}
      <div>
        <SectionTitle>Alert disponibilità</SectionTitle>
        <p style={{ margin:'0 0 14px', fontSize:12, color:COLORS.textSecondary }}>
          Talent approvati senza candidature negli ultimi 60 giorni — da coinvolgere nei prossimi eventi.
        </p>
        {disponibili.length === 0 ? (
          <div className="empty-state">Tutti i talent approvati sono stati recentemente attivi.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {disponibili.map(t => <AlertCard key={t.entity_id} talent={t} />)}
          </div>
        )}
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------------------------

export default function CandidaturePage() {
  const { handleApiResponse } = useAuth()

  // TAB 1 data
  const [apps,          setApps]          = useState([])
  const [talentMap,     setTalentMap]     = useState({})
  const [eventMap,      setEventMap]      = useState({})
  const [allTalents,    setAllTalents]    = useState([])
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [contractApp,   setContractApp]   = useState(null)

  // TAB 2/3 data (lazy)
  const [appsAll,    setAppsAll]    = useState([])
  const [loadingAll, setLoadingAll] = useState(false)
  const [allLoaded,  setAllLoaded]  = useState(false)

  // Tabs
  const [tab,   setTab]   = useState('attive')   // 'attive' | 'storico' | 'insight'
  const [vista, setVista] = useState('candidatura')  // sub-view in TAB 1

  // Filters (Vista1)
  const [filterEvento,  setFilterEvento]  = useState('ALL')
  const [filterCitta,   setFilterCitta]   = useState('')
  const [filterStatus,  setFilterStatus]  = useState('ALL')
  const [filterMese,    setFilterMese]    = useState('ALL')
  const [sortBy,        setSortBy]        = useState('data')

  // ── Load TAB 1 ────────────────────────────────────────────────────────────
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
      const items = talRes.data?.items ?? []
      setAllTalents(items)
      const m = {}
      items.forEach(t => { m[t.entity_id] = t })
      setTalentMap(m)
    }
    if (storeData) {
      const m = {}
      ;(storeData.events ?? []).forEach(e => { m[e.entity_id] = e })
      setEventMap(m)
    }
  }, [handleApiResponse])

  useEffect(() => { load() }, [load])

  // ── Lazy load TAB 2/3 ─────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (allLoaded || loadingAll) return
    setLoadingAll(true)
    const res = await applicationApi.listAll()
    setLoadingAll(false)
    if (res.success) {
      setAppsAll(res.data?.items ?? [])
      setAllLoaded(true)
    }
  }, [allLoaded, loadingAll])

  const switchTab = (t) => {
    setTab(t)
    if (t === 'storico' || t === 'insight') loadAll()
  }

  // ── Actions ───────────────────────────────────────────────────────────────
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
        s.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
      }
    })
    return [...s].sort().reverse()
  }, [apps])

  const pendingCount = apps.filter(a => a.status === 'PENDING' || a.status === 'DOCS_RECEIVED').length

  const TAB_BTN = (key, label, count) => {
    const active = tab === key
    return (
      <button
        onClick={() => switchTab(key)}
        style={{
          padding:'8px 20px', fontSize:13, fontWeight:600, background:'none', border:'none',
          cursor:'pointer', fontFamily:'Montserrat,sans-serif', marginBottom:-1,
          borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
          color: active ? COLORS.accent : COLORS.textSecondary,
        }}
      >
        {label}
        {count > 0 && (
          <span style={{ marginLeft:6, fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:8, background:COLORS.accent, color:'#fff' }}>
            {count}
          </span>
        )}
      </button>
    )
  }

  const SUB_BTN = (key, label) => {
    const active = vista === key
    return (
      <button
        onClick={() => setVista(key)}
        style={{
          padding:'5px 14px', fontSize:12, fontWeight:600, borderRadius:4, cursor:'pointer',
          fontFamily:'Montserrat,sans-serif', border:`1px solid ${active ? COLORS.accent : COLORS.border}`,
          background: active ? COLORS.accent : 'transparent',
          color: active ? '#fff' : COLORS.textSecondary,
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageHeader
        title="Candidature"
        subtitle={loading ? '' : `${pendingCount > 0 ? `${pendingCount} in attesa · ` : ''}${apps.length} attive`}
      />

      {/* Tab switcher */}
      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.border}`, marginBottom:20 }}>
        {TAB_BTN('attive',   'Attive',   pendingCount)}
        {TAB_BTN('storico',  'Storico',  0)}
        {TAB_BTN('insight',  'Insight',  0)}
      </div>

      {/* TAB 1 — ATTIVE */}
      {tab === 'attive' && (
        loading ? <div className="spinner" /> :
        apps.length === 0 ? <div className="empty-state">Nessuna candidatura attiva.</div> : (
          <>
            <div style={{ display:'flex', gap:6, marginBottom:16 }}>
              {SUB_BTN('candidatura', 'Per candidatura')}
              {SUB_BTN('evento',      'Per evento')}
            </div>
            {vista === 'candidatura' ? (
              <Vista1
                apps={apps} talentMap={talentMap} eventMap={eventMap}
                actionLoading={actionLoading}
                onApprove={approve} onReject={reject}
                onRequestDocs={requestDocs} onConfirmDocs={confirmDocs}
                onContract={openContract}
                filterEvento={filterEvento}   setFilterEvento={setFilterEvento}
                filterCitta={filterCitta}     setFilterCitta={setFilterCitta}
                filterStatus={filterStatus}   setFilterStatus={setFilterStatus}
                filterMese={filterMese}       setFilterMese={setFilterMese}
                sortBy={sortBy}               setSortBy={setSortBy}
                eventTitles={eventTitles}     mesiDisponibili={mesiDisponibili}
              />
            ) : (
              <Vista2
                apps={apps} talentMap={talentMap} eventMap={eventMap}
                actionLoading={actionLoading}
                onApprove={approve} onReject={reject}
                onRequestDocs={requestDocs} onConfirmDocs={confirmDocs}
                onContract={openContract}
              />
            )}
          </>
        )
      )}

      {/* TAB 2 — STORICO */}
      {tab === 'storico' && (
        <StoricoTab appsAll={appsAll} loadingAll={loadingAll} />
      )}

      {/* TAB 3 — INSIGHT */}
      {tab === 'insight' && (
        <InsightTab appsAll={appsAll} allTalents={allTalents} loadingAll={loadingAll} />
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
