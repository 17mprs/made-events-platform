// === LEAD PAGE — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { leadApi, getErrorMessage } from '../../api/client'
import adminStore from '../../store/adminStore'
import Layout from '../../components/Layout'
import { ADMIN_SIDEBAR, PageHeader, TalentAvatar, LeadBadge, FILTER_INPUT, Pagination } from './shared'

// ---------------------------------------------------------------------------
// SOLLECITI COUNTER BADGE
// ---------------------------------------------------------------------------

function SollecitiCounter({ data }) {
  const count = [data?.sollecito_1_inviato, data?.sollecito_2_inviato, data?.sollecito_finale_inviato]
    .filter(Boolean).length
  const color = count === 0 ? '#22c55e' : count < 3 ? '#f97316' : '#ef4444'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 12,
      background: color + '22', color, fontSize: 11, fontWeight: 700, marginLeft: 6,
      border: `1px solid ${color}44`,
    }}>
      {count}/3
    </span>
  )
}

// ---------------------------------------------------------------------------
// LEADS SECTION — exported for reuse in AdminDashboard overview
// ---------------------------------------------------------------------------

export function LeadsSection({ handleApiResponse, pageSize = 10, showPageSizeSelect = false }) {
  const [leads,      setLeads]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)
  const [perPage,    setPerPage]    = useState(pageSize)
  const [rowLoading, setRowLoading] = useState({}) // { [entity_id]: 'solicit'|'reset'|null }

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
  useEffect(() => { setPage(1) }, [perPage])

  const filtered = useMemo(() => {
    if (!search.trim()) return leads
    const q = search.toLowerCase()
    return leads.filter(l =>
      `${l.data?.nome ?? ''} ${l.data?.cognome ?? ''}`.toLowerCase().includes(q) ||
      (l.data?.email ?? '').toLowerCase().includes(q)
    )
  }, [leads, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const paginated  = filtered.slice((page - 1) * perPage, page * perPage)

  function hasSolleciti(l) {
    return !!(l.data?.sollecito_1_inviato || l.data?.sollecito_2_inviato || l.data?.sollecito_finale_inviato)
  }

  async function handleSolicit(entity_id) {
    setRowLoading(prev => ({ ...prev, [entity_id]: 'solicit' }))
    const res = await leadApi.solicit(entity_id)
    setRowLoading(prev => ({ ...prev, [entity_id]: null }))
    if (!res.success) {
      alert(getErrorMessage(res.error))
      return
    }
    await adminStore.refresh()
    load()
  }

  async function handleReset(entity_id) {
    setRowLoading(prev => ({ ...prev, [entity_id]: 'reset' }))
    const res = await leadApi.update(entity_id, {
      sollecito_1_inviato: '',
      sollecito_2_inviato: '',
      sollecito_finale_inviato: '',
      ultimo_sollecito: '',
    })
    setRowLoading(prev => ({ ...prev, [entity_id]: null }))
    if (!res.success) {
      alert(getErrorMessage(res.error))
      return
    }
    await adminStore.refresh()
    load()
  }

  if (loading) return <div className="spinner" />
  if (error)   return <div className="error-banner">{error}</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input
          placeholder="Cerca nome o email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...FILTER_INPUT, minWidth: 180 }}
        />
        {showPageSizeSelect && (
          <select
            value={perPage}
            onChange={e => setPerPage(Number(e.target.value))}
            style={{ ...FILTER_INPUT, width: 'auto' }}
          >
            {[5, 10, 20, 50].map(n => (
              <option key={n} value={n}>{n} per pagina</option>
            ))}
          </select>
        )}
        <span style={{ fontSize: 12, color: '#8888A0', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {filtered.length} bozze
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">Nessun lead in bozza.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Città</th>
                  <th>Iscritto il</th>
                  <th>Stato</th>
                  <th>Solleciti</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(l => {
                  const busy = rowLoading[l.entity_id]
                  return (
                    <tr key={l.entity_id}>
                      <td><TalentAvatar nome={l.data?.nome} fotoUrl={l.data?.foto_busto_url} size={36} /></td>
                      <td>{l.data?.nome} {l.data?.cognome}</td>
                      <td style={{ color: '#8888A0', fontSize: 12 }}>{l.data?.email}</td>
                      <td>{l.data?.citta ?? '—'}</td>
                      <td style={{ fontSize: 12, color: '#8888A0' }}>
                        {l.data?.registration_started_at
                          ? new Date(l.data.registration_started_at).toLocaleDateString('it-IT')
                          : '—'}
                      </td>
                      <td>
                        <LeadBadge status={l.status} />
                      </td>
                      <td>
                        <SollecitiCounter data={l.data} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
                          <button
                            disabled={!!busy}
                            onClick={() => handleSolicit(l.entity_id)}
                            onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = '#630E33'; e.currentTarget.style.color = '#fff' } }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#630E33' }}
                            style={{
                              background: 'none', border: '1px solid #630E33', color: '#630E33',
                              borderRadius: 6, padding: '4px 12px', fontSize: 11,
                              cursor: busy ? 'wait' : 'pointer', fontFamily: 'Montserrat,sans-serif',
                              whiteSpace: 'nowrap', transition: 'background 0.15s, color 0.15s',
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            {busy === 'solicit' ? '…' : 'Sollecita completamento'}
                          </button>
                          {hasSolleciti(l) && (
                            <button
                              disabled={!!busy}
                              onClick={() => handleReset(l.entity_id)}
                              onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = '#6b7280'; e.currentTarget.style.color = '#fff' } }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280' }}
                              style={{
                                background: 'none', border: '1px solid #6b7280', color: '#6b7280',
                                borderRadius: 6, padding: '4px 10px', fontSize: 11,
                                cursor: busy ? 'wait' : 'pointer', fontFamily: 'Montserrat,sans-serif',
                                whiteSpace: 'nowrap', transition: 'background 0.15s, color 0.15s',
                                opacity: busy ? 0.6 : 1,
                              }}
                            >
                              {busy === 'reset' ? '…' : 'Reset solleciti'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
      <LeadsSection handleApiResponse={handleApiResponse} showPageSizeSelect={true} />
    </Layout>
  )
}
