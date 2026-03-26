// === TALENT PAGE — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { talentApi, getErrorMessage } from '../../api/client'
import adminStore from '../../store/adminStore'
import Layout from '../../components/Layout'
import {
  ADMIN_SIDEBAR, PageHeader,
  TalentAvatar, LeadBadge, ScoreBar, LeadDrawer,
  FILTER_INPUT, PAGE_SIZE, Pagination,
} from './shared'

// ---------------------------------------------------------------------------
// TALENTS SECTION — exported for reuse in AdminDashboard overview
// ---------------------------------------------------------------------------

export function TalentsSection({ handleApiResponse }) {
  const [items,         setItems]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [search,        setSearch]        = useState('')
  const [filterStatus,  setFilterStatus]  = useState('ALL')
  const [sortScore,     setSortScore]     = useState('DESC')
  const [page,          setPage]          = useState(1)
  const [selected,      setSelected]      = useState(null)
  const [nota,          setNota]          = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await adminStore.ensure()
    setLoading(false)
    if (!data) { setError('Errore nel caricamento dati.'); return }
    const seen = new Set()
    const profili = (data.leads ?? []).filter(l => {
      const key = (l.data?.email ?? l.entity_id ?? '').toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return l.status === 'COMPLETED_PENDING_APPROVAL' || l.status === 'APPROVED'
    })
    setItems(profili)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [filterStatus, search, sortScore])

  const filtered = useMemo(() => {
    let list = [...items]
    if (filterStatus !== 'ALL') list = list.filter(l => l.status === filterStatus)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(l =>
        `${l.data?.nome ?? ''} ${l.data?.cognome ?? ''}`.toLowerCase().includes(q) ||
        (l.data?.email ?? '').toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => sortScore === 'DESC'
      ? (Number(b.data?.score) || 0) - (Number(a.data?.score) || 0)
      : (Number(a.data?.score) || 0) - (Number(b.data?.score) || 0)
    )
    return list
  }, [items, filterStatus, search, sortScore])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleAction = async (type, entity_id) => {
    if (type === 'approve') {
      setActionLoading(entity_id + '_approve')
      const res = handleApiResponse(await talentApi.approve(entity_id, nota))
      setActionLoading(null)
      if (res.success) { setSelected(null); await adminStore.refresh(); load() }
      else alert(getErrorMessage(res.error))
    } else if (type === 'reject') {
      const motivo = nota.trim() || window.prompt('Motivo del rifiuto:') || ''
      setActionLoading(entity_id + '_reject')
      const res = handleApiResponse(await talentApi.reject(entity_id, motivo))
      setActionLoading(null)
      if (res.success) { setSelected(null); await adminStore.refresh(); load() }
      else alert(getErrorMessage(res.error))
    } else if (type === 'modifiche') {
      alert('Funzione in arrivo: invierà un email al candidato con richiesta di aggiornamento profilo.')
    }
  }

  if (loading) return <div className="spinner" />
  if (error)   return <div className="error-banner">{error}</div>

  return (
    <div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        <input
          placeholder="Cerca nome o email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...FILTER_INPUT, minWidth:180 }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={FILTER_INPUT}>
          <option value="ALL">Tutti</option>
          <option value="COMPLETED_PENDING_APPROVAL">In Attesa</option>
          <option value="APPROVED">Approvato</option>
        </select>
        <select value={sortScore} onChange={e => setSortScore(e.target.value)} style={FILTER_INPUT}>
          <option value="DESC">Score ↓</option>
          <option value="ASC">Score ↑</option>
        </select>
        <span style={{ fontSize:12, color:'#8888A0', marginLeft:'auto', whiteSpace:'nowrap' }}>
          {filtered.length} profili
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">Nessun profilo talent.</div>
      ) : (
        <>
          <div style={{ overflowX:'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width:48 }}></th>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Città</th>
                  <th style={{ minWidth:120 }}>Score</th>
                  <th>Stato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(l => (
                  <tr key={l.entity_id}>
                    <td><TalentAvatar nome={l.data?.nome} fotoUrl={l.data?.foto_busto_url} size={36} /></td>
                    <td>{l.data?.nome} {l.data?.cognome}</td>
                    <td style={{ color:'#8888A0', fontSize:12 }}>{l.data?.email}</td>
                    <td>{l.data?.citta ?? '—'}</td>
                    <td><ScoreBar score={l.data?.score} /></td>
                    <td><LeadBadge status={l.status} /></td>
                    <td>
                      <button
                        onClick={() => { setSelected(l); setNota('') }}
                        onMouseEnter={e => { e.currentTarget.style.background='#7A1E2C'; e.currentTarget.style.color='#fff' }}
                        onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#7A1E2C' }}
                        style={{
                          background:'none', border:'1px solid #7A1E2C', color:'#7A1E2C',
                          borderRadius:6, padding:'4px 12px', fontSize:11,
                          cursor:'pointer', fontFamily:'Montserrat,sans-serif',
                          whiteSpace:'nowrap', transition:'background 0.15s, color 0.15s',
                        }}
                      >
                        Visualizza →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}

      {selected && (
        <LeadDrawer
          lead={selected}
          nota={nota}
          onNotaChange={setNota}
          onClose={() => setSelected(null)}
          onAction={handleAction}
          actionLoading={actionLoading}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PAGE WRAPPER
// ---------------------------------------------------------------------------

export default function TalentPage() {
  const { handleApiResponse } = useAuth()
  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageHeader
        title="Profili Talent"
        subtitle="Gestisci i profili talent — approvazione e revisione"
      />
      <TalentsSection handleApiResponse={handleApiResponse} />
    </Layout>
  )
}
