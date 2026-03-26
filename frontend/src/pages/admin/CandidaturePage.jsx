// === CANDIDATURE PAGE — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { applicationApi, getErrorMessage } from '../../api/client'
import adminStore from '../../store/adminStore'
import Layout from '../../components/Layout'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
import { ADMIN_SIDEBAR, PageHeader, TalentAvatar, ScoreBar, FILTER_INPUT } from './shared'
import { COLORS } from '../../styles/theme'

export default function CandidaturePage() {
  const { handleApiResponse } = useAuth()

  const [apps,          setApps]          = useState([])
  const [talentMap,     setTalentMap]     = useState({})   // entity_id → lead item
  const [activeEvents,  setActiveEvents]  = useState([])   // LIVE events
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  // Filters
  const [filterEvento,  setFilterEvento]  = useState('ALL')
  const [filterCitta,   setFilterCitta]   = useState('')
  const [filterStatus,  setFilterStatus]  = useState('ALL')

  // Sort
  const [sortBy,        setSortBy]        = useState('data')   // 'data' | 'score'

  const load = useCallback(async () => {
    setLoading(true)
    const storeData = await adminStore.refresh()
    setLoading(false)

    if (storeData) {
      setApps(storeData.applications ?? [])
      setActiveEvents((storeData.events ?? []).filter(e => e.status === 'LIVE'))
      const map = {}
      ;(storeData.leads ?? []).forEach(l => { map[l.entity_id] = l })
      setTalentMap(map)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const approve = async (entity_id) => {
    setActionLoading(entity_id + '_approve')
    const res = handleApiResponse(await applicationApi.approve(entity_id))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  const reject = async (entity_id) => {
    const motivo = window.prompt('Motivo del rifiuto (opzionale):') ?? ''
    setActionLoading(entity_id + '_reject')
    const res = handleApiResponse(await applicationApi.reject(entity_id, motivo))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  // Build enriched apps with talent data
  const enriched = useMemo(() => {
    return apps.map(a => {
      const talent = talentMap[a.data?.talent_profile_id] ?? null
      return { ...a, _talent: talent }
    })
  }, [apps, talentMap])

  const filtered = useMemo(() => {
    let list = [...enriched]

    if (filterStatus !== 'ALL') list = list.filter(a => a.status === filterStatus)

    if (filterEvento !== 'ALL') {
      list = list.filter(a => (a.data?.event_titolo ?? '') === filterEvento)
    }

    if (filterCitta.trim()) {
      const q = filterCitta.trim().toLowerCase()
      list = list.filter(a => {
        const citta = a._talent?.data?.citta ?? ''
        return citta.toLowerCase().includes(q)
      })
    }

    if (sortBy === 'score') {
      list.sort((a, b) =>
        (Number(b._talent?.data?.score) || 0) - (Number(a._talent?.data?.score) || 0)
      )
    } else {
      // sort by created_at (entity_id is prefixed with timestamp in GAS)
      list.sort((a, b) => b.entity_id.localeCompare(a.entity_id))
    }

    return list
  }, [enriched, filterStatus, filterEvento, filterCitta, sortBy])

  // Unique event titles from all apps (for filter dropdown)
  const eventTitles = useMemo(() => {
    const titles = new Set(apps.map(a => a.data?.event_titolo).filter(Boolean))
    return [...titles].sort()
  }, [apps])

  const pendingCount = apps.filter(a => a.status === 'PENDING').length

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageHeader
        title="Candidature"
        subtitle={pendingCount > 0 ? `${pendingCount} in attesa di risposta` : `${apps.length} candidature totali`}
      />

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        <select value={filterEvento} onChange={e => setFilterEvento(e.target.value)} style={{ ...FILTER_INPUT, maxWidth:220 }}>
          <option value="ALL">Tutti gli eventi</option>
          {eventTitles.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <input
          placeholder="Filtra per città…"
          value={filterCitta}
          onChange={e => setFilterCitta(e.target.value)}
          style={{ ...FILTER_INPUT, minWidth:140 }}
        />

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={FILTER_INPUT}>
          <option value="ALL">Tutti gli stati</option>
          <option value="PENDING">In attesa</option>
          <option value="APPROVED">Accettate</option>
          <option value="REJECTED">Rifiutate</option>
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={FILTER_INPUT}>
          <option value="data">Più recenti</option>
          <option value="score">Score talent ↓</option>
        </select>

        <span style={{ fontSize:12, color:'#8888A0', marginLeft:'auto', whiteSpace:'nowrap' }}>
          {filtered.length} candidature
        </span>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : filtered.length === 0 ? (
        <div className="empty-state">Nessuna candidatura.</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width:48 }}></th>
                <th>Talent</th>
                <th>Città</th>
                <th style={{ minWidth:100 }}>Score</th>
                <th>Evento</th>
                <th>Turno</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const td = a._talent?.data ?? {}
                const nome = td.nome ? `${td.nome} ${td.cognome ?? ''}`.trim() : (a.data?.talent_name ?? '—')
                const fotoUrl = td.foto_busto_url ?? null
                const citta   = td.citta ?? '—'
                const score   = td.score

                return (
                  <tr key={a.entity_id}>
                    <td>
                      <TalentAvatar nome={nome} fotoUrl={fotoUrl} size={34} />
                    </td>
                    <td style={{ fontWeight:500 }}>{nome}</td>
                    <td style={{ fontSize:12, color:COLORS.textSecondary }}>{citta}</td>
                    <td style={{ minWidth:100 }}>
                      {score != null ? <ScoreBar score={score} /> : <span style={{ color:COLORS.textSecondary, fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ fontSize:12 }}>{a.data?.event_titolo ?? '—'}</td>
                    <td style={{ fontSize:12, color:COLORS.textSecondary }}>{a.data?.shift_ruolo ?? a.data?.shift_id ?? '—'}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>
                      {a.status === 'PENDING' && (
                        <div className="actions-row">
                          <Button
                            size="sm"
                            loading={actionLoading === a.entity_id + '_approve'}
                            onClick={() => approve(a.entity_id)}
                          >
                            Accetta
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={actionLoading === a.entity_id + '_reject'}
                            onClick={() => reject(a.entity_id)}
                          >
                            Rifiuta
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
