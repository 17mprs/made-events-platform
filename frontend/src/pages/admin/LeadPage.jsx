// === LEAD PAGE — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getErrorMessage } from '../../api/client'
import adminStore from '../../store/adminStore'
import Layout from '../../components/Layout'
import { ADMIN_SIDEBAR, PageHeader, TalentAvatar, LeadBadge, FILTER_INPUT, PAGE_SIZE, Pagination } from './shared'

// ---------------------------------------------------------------------------
// LEADS SECTION — exported for reuse in AdminDashboard overview
// ---------------------------------------------------------------------------

export function LeadsSection({ handleApiResponse }) {
  const [leads,   setLeads]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await adminStore.ensure()
    setLoading(false)
    if (!data) { setError('Errore nel caricamento dati.'); return }
    const seen = new Set()
    const bozze = (data.leads ?? []).filter(l => {
      const key = (l.data?.email ?? l.entity_id ?? '').toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return l.status === 'PARTIAL'
    })
    bozze.sort((a, b) =>
      new Date(b.data?.registration_started_at || 0) - new Date(a.data?.registration_started_at || 0)
    )
    setLeads(bozze)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])

  const filtered = useMemo(() => {
    if (!search.trim()) return leads
    const q = search.toLowerCase()
    return leads.filter(l =>
      `${l.data?.nome ?? ''} ${l.data?.cognome ?? ''}`.toLowerCase().includes(q) ||
      (l.data?.email ?? '').toLowerCase().includes(q)
    )
  }, [leads, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
        <span style={{ fontSize:12, color:'#8888A0', marginLeft:'auto', whiteSpace:'nowrap' }}>
          {filtered.length} bozze
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">Nessun lead in bozza.</div>
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
                  <th>Iscritto il</th>
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
                    <td style={{ fontSize:12, color:'#8888A0' }}>
                      {l.data?.registration_started_at
                        ? new Date(l.data.registration_started_at).toLocaleDateString('it-IT')
                        : '—'}
                    </td>
                    <td><LeadBadge status={l.status} /></td>
                    <td>
                      <button
                        onClick={() => alert(`Sollecito inviato a ${l.data?.email ?? 'il candidato'}`)}
                        onMouseEnter={e => { e.currentTarget.style.background='#7A1E2C'; e.currentTarget.style.color='#fff' }}
                        onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#7A1E2C' }}
                        style={{
                          background:'none', border:'1px solid #7A1E2C', color:'#7A1E2C',
                          borderRadius:6, padding:'4px 12px', fontSize:11,
                          cursor:'pointer', fontFamily:'Montserrat,sans-serif',
                          whiteSpace:'nowrap', transition:'background 0.15s, color 0.15s',
                        }}
                      >
                        Sollecita completamento
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// PAGE WRAPPER
// ---------------------------------------------------------------------------

export default function LeadPage() {
  const { handleApiResponse } = useAuth()
  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageHeader
        title="Lead Talent"
        subtitle="Candidature in bozza — step 1 non completato"
      />
      <LeadsSection handleApiResponse={handleApiResponse} />
    </Layout>
  )
}
