// === TALENT PAGE — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { talentApi, getErrorMessage } from '../../api/client'
import adminStore from '../../store/adminStore'
import Layout from '../../components/Layout'
import { COLORS } from '../../styles/theme'
import {
  ADMIN_SIDEBAR, PageHeader,
  TalentAvatar, LeadBadge, ScoreBar, LeadDrawer,
  FILTER_INPUT, PAGE_SIZE, Pagination,
} from './shared'

// ---------------------------------------------------------------------------
// PHOTO EXPIRY HELPER
// ---------------------------------------------------------------------------

function photoExpiryStatus(talent) {
  const d = talent.data ?? {}
  const raw = d.data_caricamento_foto || d.foto_caricata_il || d.foto_updated_at || talent.updated_at
  if (!raw) return { status: 'unknown', label: null, color: null }
  const uploadDate = new Date(raw)
  if (isNaN(uploadDate)) return { status: 'unknown', label: null, color: null }
  const expiry = new Date(uploadDate)
  expiry.setMonth(expiry.getMonth() + 6)
  const now = new Date()
  const msLeft = expiry - now
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
  const twoMonthsMs = 60 * 24 * 60 * 60 * 1000
  if (msLeft < 0) return { status: 'expired',  label: `Scadute il ${expiry.toLocaleDateString('it-IT')}`,              color: '#EF4444', days: daysLeft }
  if (msLeft < twoMonthsMs) return { status: 'expiring', label: `Scade tra ${daysLeft} giorni (${expiry.toLocaleDateString('it-IT')})`, color: '#F97316', days: daysLeft }
  return { status: 'ok', label: `Valide fino al ${expiry.toLocaleDateString('it-IT')}`, color: '#10B981', days: daysLeft }
}

// ---------------------------------------------------------------------------
// TALENT PROFILE CHANGES DRAWER — diff + approvazione modifiche
// ---------------------------------------------------------------------------

function TalentChangesDrawer({ profile, onClose, onApprove, onReject, actionLoading }) {
  const [nota, setNota] = useState('')
  const d       = profile.data ?? {}
  const pending = d.pending_data ?? {}

  const LABELS = {
    telefono:'Telefono', data_nascita:'Data nascita', citta_nascita:'Città nascita',
    nazionalita:'Nazionalità', indirizzo_residenza:'Indirizzo', numero_documento:'N° documento',
    stato_emissione_documento:'Stato emissione', altezza:'Altezza', taglia:'Taglia',
    capelli:'Capelli', occhi:'Occhi', corporatura:'Corporatura', citta:'Città',
    province_operativita:'Province op.', automunita:'Automunita', disponibile_trasferte:'Trasferte',
    disponibile_weekend:'Week-end', lingue:'Lingue', esperienza_anni:'Anni esp.',
    skills:'Skills', esperienze_precedenti:'Esperienze', attrezzatura:'Attrezzatura',
    codice_fiscale:'CF', iban:'IBAN', intestatario_conto:'Intestatario', partita_iva:'P.IVA',
    disponibilita:'Disponibilità', note:'Note',
  }

  const changedKeys = Object.keys(pending).filter(k => {
    const oldVal = JSON.stringify(d[k] ?? '')
    const newVal = JSON.stringify(pending[k] ?? '')
    return oldVal !== newVal
  })

  const fmt = v => Array.isArray(v) ? v.join(', ') : (v === true ? 'Sì' : v === false ? 'No' : String(v ?? '—'))

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:500 }} />
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:520, maxWidth:'96vw',
        background:'#fff', borderLeft:`1px solid ${COLORS.border}`,
        zIndex:501, overflowY:'auto', padding:28, fontFamily:'Montserrat,sans-serif',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:COLORS.text }}>
              Modifiche in attesa
            </h2>
            <div style={{ fontSize:12, color:COLORS.textSecondary, marginTop:3 }}>
              {d.nome} {d.cognome} · inviato {d.pending_submitted_at ? new Date(d.pending_submitted_at).toLocaleDateString('it-IT') : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#666' }}>✕</button>
        </div>

        {changedKeys.length === 0 ? (
          <div style={{ fontSize:13, color:COLORS.textSecondary, padding:'16px 0' }}>Nessuna modifica rilevata.</div>
        ) : (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:COLORS.textSecondary, marginBottom:10 }}>
              {changedKeys.length} campo{changedKeys.length !== 1 ? 'i' : ''} modificato{changedKeys.length !== 1 ? 'i' : ''}
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#f5f5f5' }}>
                  <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:600, color:COLORS.textSecondary, width:'28%' }}>Campo</th>
                  <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:600, color:'#C62828' }}>Valore attuale</th>
                  <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:600, color:'#2E7D32' }}>Nuovo valore</th>
                </tr>
              </thead>
              <tbody>
                {changedKeys.map(k => (
                  <tr key={k} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                    <td style={{ padding:'8px 10px', fontWeight:600, color:COLORS.text }}>{LABELS[k] || k}</td>
                    <td style={{ padding:'8px 10px', color:'#C62828', background:'#FFF3F3' }}>{fmt(d[k])}</td>
                    <td style={{ padding:'8px 10px', color:'#2E7D32', background:'#F3FFF3' }}>{fmt(pending[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ borderTop:`1px solid ${COLORS.border}`, paddingTop:16, marginBottom:12 }}>
          <label style={{ fontSize:11, color:COLORS.textSecondary, display:'block', marginBottom:4 }}>
            Nota (opzionale — visibile al talent in caso di rifiuto)
          </label>
          <textarea
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder="Motivo del rifiuto..."
            rows={2}
            style={{
              width:'100%', border:`1px solid ${COLORS.border}`, borderRadius:6,
              padding:'8px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif',
              resize:'vertical', boxSizing:'border-box', color:COLORS.text,
            }}
          />
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <button
            onClick={() => onApprove(profile.entity_id)}
            disabled={!!actionLoading}
            style={{
              padding:'10px 16px', background:'#10B981', color:'#fff', border:'none',
              borderRadius:6, fontSize:13, fontWeight:600, cursor:actionLoading ? 'wait' : 'pointer',
              fontFamily:'Montserrat,sans-serif',
            }}
          >
            {actionLoading === profile.entity_id + '_approve' ? 'Approvando…' : 'Approva modifiche'}
          </button>
          <button
            onClick={() => onReject(profile.entity_id, nota)}
            disabled={!!actionLoading}
            style={{
              padding:'10px 16px', background:'none', color:'#EF4444',
              border:'1px solid #EF4444', borderRadius:6, fontSize:13, fontWeight:600,
              cursor:actionLoading ? 'wait' : 'pointer', fontFamily:'Montserrat,sans-serif',
            }}
          >
            {actionLoading === profile.entity_id + '_reject' ? 'Rifiutando…' : 'Rifiuta modifiche'}
          </button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// TALENT PROFILE DRAWER — scheda completa con timer foto
// ---------------------------------------------------------------------------

function TalentProfileDrawer({ talent, onClose }) {
  const d = talent.data ?? {}
  const nome = `${d.nome ?? ''} ${d.cognome ?? ''}`.trim() || '—'
  const photoExp = photoExpiryStatus(talent)

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:400 }} />
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:560, maxWidth:'96vw',
        background:'#fff', borderLeft:`1px solid ${COLORS.border}`,
        zIndex:401, overflowY:'auto', padding:32, fontFamily:'Montserrat,sans-serif',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:COLORS.text }}>Scheda Talent</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#666', padding:'4px 8px', lineHeight:1 }}>✕</button>
        </div>

        {/* Foto + info base */}
        <div style={{ display:'flex', gap:20, marginBottom:24, alignItems:'flex-start' }}>
          <TalentAvatar nome={nome} fotoUrl={d.foto_busto_url} size={80} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:20, fontWeight:700, color:COLORS.text, marginBottom:4 }}>{nome}</div>
            <div style={{ fontSize:13, color:COLORS.textSecondary, marginBottom:2 }}>{d.email ?? '—'}</div>
            <div style={{ fontSize:13, color:COLORS.textSecondary, marginBottom:8 }}>{d.citta ?? '—'}</div>
            <LeadBadge status={talent.status} />
          </div>
        </div>

        {/* Timer scadenza foto */}
        {photoExp.label && (
          <div style={{
            padding:'12px 14px', borderRadius:8, marginBottom:20,
            background: photoExp.status === 'expired' ? '#FFF0F0' : photoExp.status === 'expiring' ? '#FFF8F0' : '#F0FAF4',
            border: `1px solid ${photoExp.color}44`,
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:12,
          }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:photoExp.color }}>
                {photoExp.status === 'expired'  ? '⛔ Foto scadute — profilo bloccato' :
                 photoExp.status === 'expiring' ? '⚠️ Foto in scadenza' : '✓ Foto valide'}
              </div>
              <div style={{ fontSize:11, color:COLORS.textSecondary, marginTop:2 }}>{photoExp.label}</div>
            </div>
            {(photoExp.status === 'expired' || photoExp.status === 'expiring') && (
              <button
                onClick={() => alert(`Richiesta aggiornamento foto inviata a ${d.email ?? 'il talent'}.`)}
                style={{
                  flexShrink:0, background:'none', border:`1px solid ${photoExp.color}`,
                  color:photoExp.color, borderRadius:6, padding:'5px 10px', fontSize:11,
                  cursor:'pointer', fontFamily:'Montserrat,sans-serif', whiteSpace:'nowrap',
                }}
              >
                Richiedi aggiornamento
              </button>
            )}
          </div>
        )}

        {/* Score */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:8 }}>Score</div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ fontSize:32, fontWeight:300, color:COLORS.text }}>{d.score ?? '—'}</div>
            <div style={{ flex:1 }}><ScoreBar score={d.score} /></div>
          </div>
        </div>

        {/* Dati anagrafici */}
        <div style={{ borderTop:`1px solid ${COLORS.border}`, paddingTop:20, marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:12 }}>Dati anagrafici</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {[
              ['Telefono',           d.telefono],
              ['Data di nascita',    d.data_nascita],
              ['Sesso',              d.sesso],
              ['Altezza',            d.altezza ? `${d.altezza} cm` : null],
              ['Taglia',             d.taglia],
              ['Residenza',          d.citta],
              ['Province lavoro',    (d.province_lavoro ?? []).join(', ') || null],
              ['Lingue',             (d.lingue ?? []).join(', ') || null],
              ['Automunita',         d.automunita],
              ['Disp. trasferte',    d.disponibilita_trasferte],
              ['Disp. weekend',      d.disponibilita_weekend],
              ['Anni esperienza',    d.anni_esperienza_settore],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize:10, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:13, color:COLORS.text }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Skills */}
        {(d.skills ?? []).length > 0 && (
          <div style={{ borderTop:`1px solid ${COLORS.border}`, paddingTop:20, marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:8 }}>Skills</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {d.skills.map(s => (
                <span key={s} style={{ fontSize:11, background:'#f5f5f5', color:COLORS.text, padding:'3px 10px', borderRadius:10 }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Foto galleria */}
        {(d.foto_busto_url || d.foto_intera_url || d.foto_profilo_url) && (
          <div style={{ borderTop:`1px solid ${COLORS.border}`, paddingTop:20, marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:10 }}>Foto</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {[['Busto', d.foto_busto_url], ['Intera', d.foto_intera_url], ['Profilo', d.foto_profilo_url]]
                .filter(([, u]) => u)
                .map(([label, url]) => (
                  <div key={label} style={{ textAlign:'center' }}>
                    <a href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={label} style={{ width:100, height:120, objectFit:'cover', borderRadius:6, border:`1px solid ${COLORS.border}`, display:'block' }} />
                    </a>
                    <div style={{ fontSize:10, color:COLORS.textSecondary, marginTop:4 }}>{label}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* CV */}
        {d.cv_url && (
          <div style={{ borderTop:`1px solid ${COLORS.border}`, paddingTop:20, marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:8 }}>Curriculum</div>
            <a href={d.cv_url} target="_blank" rel="noreferrer" style={{ color:COLORS.accent, fontSize:13, textDecoration:'underline' }}>
              Apri CV →
            </a>
          </div>
        )}

        {/* Note */}
        {d.note && (
          <div style={{ borderTop:`1px solid ${COLORS.border}`, paddingTop:20 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:8 }}>Note</div>
            <div style={{ fontSize:13, color:COLORS.text, lineHeight:1.6 }}>{d.note}</div>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// TALENTS SECTION — exported for reuse in AdminDashboard overview
// ---------------------------------------------------------------------------

export function TalentsSection({ handleApiResponse }) {
  const [items,          setItems]          = useState([])
  const [profiles,       setProfiles]       = useState([])   // TALENT_PROFILE entities
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [search,         setSearch]         = useState('')
  const [filterStatus,   setFilterStatus]   = useState('ALL')
  const [sortScore,      setSortScore]      = useState('DESC')
  const [page,           setPage]           = useState(1)
  const [selected,       setSelected]       = useState(null)        // LeadDrawer
  const [selectedScheda, setSelectedScheda] = useState(null)        // TalentProfileDrawer
  const [selectedChanges,setSelectedChanges]= useState(null)        // TalentChangesDrawer
  const [nota,           setNota]           = useState('')
  const [actionLoading,  setActionLoading]  = useState(null)

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
    setProfiles(data.talent_profiles ?? [])
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [filterStatus, search, sortScore])

  // Build a map email→profile for badge lookup
  const profileByEmail = useMemo(() => {
    const m = {}
    profiles.forEach(p => {
      const email = (p.data?.email_contatto || '').toLowerCase()
      if (email) m[email] = p
    })
    return m
  }, [profiles])

  const pendingProfiles = useMemo(() =>
    profiles.filter(p => p.status === 'PENDING_REVIEW'),
  [profiles])

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

  const handleApproveChanges = async (profile_id) => {
    setActionLoading(profile_id + '_approve')
    const res = handleApiResponse(await talentApi.approve(profile_id))
    setActionLoading(null)
    if (res.success) { setSelectedChanges(null); await adminStore.refresh(); load() }
    else alert(getErrorMessage(res.error))
  }

  const handleRejectChanges = async (profile_id, nota_rifiuto) => {
    setActionLoading(profile_id + '_reject')
    const res = handleApiResponse(await talentApi.reject(profile_id, nota_rifiuto))
    setActionLoading(null)
    if (res.success) { setSelectedChanges(null); await adminStore.refresh(); load() }
    else alert(getErrorMessage(res.error))
  }

  if (loading) return <div className="spinner" />
  if (error)   return <div className="error-banner">{error}</div>

  const BTN = {
    background:'none', border:'1px solid #7A1E2C', color:'#7A1E2C',
    borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer',
    fontFamily:'Montserrat,sans-serif', whiteSpace:'nowrap',
    transition:'background 0.15s, color 0.15s',
  }
  const hover = (e, on) => {
    e.currentTarget.style.background = on ? '#7A1E2C' : 'none'
    e.currentTarget.style.color      = on ? '#fff'    : '#7A1E2C'
  }

  return (
    <div>
      {/* Banner modifiche in attesa dai profili TALENT_PROFILE */}
      {pendingProfiles.length > 0 && (
        <div style={{
          background:'#FFF8E1', border:'1px solid #F9A825', borderRadius:8,
          padding:'12px 16px', marginBottom:16, display:'flex', flexWrap:'wrap', gap:8, alignItems:'center',
        }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#E65100' }}>
            {pendingProfiles.length} profilo{pendingProfiles.length !== 1 ? 'i' : ''} con modifiche in attesa:
          </span>
          {pendingProfiles.map(p => (
            <button
              key={p.entity_id}
              onClick={() => setSelectedChanges(p)}
              style={{
                background:'#E65100', color:'#fff', border:'none', borderRadius:6,
                padding:'4px 12px', fontSize:11, fontWeight:600, cursor:'pointer',
                fontFamily:'Montserrat,sans-serif',
              }}
            >
              {p.data?.nome} {p.data?.cognome}
            </button>
          ))}
        </div>
      )}

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
                  <th>Foto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(l => {
                  const photoExp = photoExpiryStatus(l)
                  const email    = (l.data?.email ?? '').toLowerCase()
                  const linkedProfile = profileByEmail[email]
                  const hasPending    = linkedProfile?.status === 'PENDING_REVIEW'
                  return (
                    <tr key={l.entity_id}>
                      <td><TalentAvatar nome={l.data?.nome} fotoUrl={l.data?.foto_busto_url} size={36} /></td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          {l.data?.nome} {l.data?.cognome}
                          {hasPending && (
                            <span style={{
                              fontSize:9, fontWeight:700, background:'#FFF3E0', color:'#E65100',
                              border:'1px solid #F9A825', padding:'2px 7px', borderRadius:10, whiteSpace:'nowrap',
                            }}>
                              MODIFICHE IN ATTESA
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ color:'#8888A0', fontSize:12 }}>{l.data?.email}</td>
                      <td>{l.data?.citta ?? '—'}</td>
                      <td><ScoreBar score={l.data?.score} /></td>
                      <td><LeadBadge status={l.status} /></td>
                      <td>
                        {photoExp.status === 'expired' && (
                          <span style={{ fontSize:10, fontWeight:700, color:'#EF4444', background:'#FFEBEE', padding:'2px 7px', borderRadius:10, whiteSpace:'nowrap' }}>
                            Foto scadute
                          </span>
                        )}
                        {photoExp.status === 'expiring' && (
                          <span style={{ fontSize:10, fontWeight:700, color:'#F97316', background:'#FFF3E0', padding:'2px 7px', borderRadius:10, whiteSpace:'nowrap' }}>
                            In scadenza
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {linkedProfile && (
                            <button
                              onClick={() => setSelectedScheda(linkedProfile)}
                              onMouseEnter={e => hover(e,true)} onMouseLeave={e => hover(e,false)}
                              style={BTN}
                            >
                              Scheda
                            </button>
                          )}
                          {hasPending && (
                            <button
                              onClick={() => setSelectedChanges(linkedProfile)}
                              style={{
                                ...BTN, border:'1px solid #E65100', color:'#E65100',
                              }}
                            >
                              Modifiche →
                            </button>
                          )}
                          {l.status === 'COMPLETED_PENDING_APPROVAL' && (
                            <button
                              onClick={() => { setSelected(l); setNota('') }}
                              onMouseEnter={e => hover(e,true)} onMouseLeave={e => hover(e,false)}
                              style={BTN}
                            >
                              Revisiona →
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

      {selectedScheda && (
        <TalentProfileDrawer
          talent={selectedScheda}
          onClose={() => setSelectedScheda(null)}
        />
      )}

      {selectedChanges && (
        <TalentChangesDrawer
          profile={selectedChanges}
          onClose={() => setSelectedChanges(null)}
          onApprove={handleApproveChanges}
          onReject={handleRejectChanges}
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
