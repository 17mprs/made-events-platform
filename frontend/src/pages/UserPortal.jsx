// === USER PORTAL — MADE EVENT Platform ===
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  shiftApi, applicationApi, assignmentApi, talentApi,
  getErrorMessage,
} from '../api/client'
import { COLORS, COMPONENT_STYLES, LETTER_SPACING } from '../styles/theme'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Card   from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import Input from '../components/Input'

const SIDEBAR_ITEMS = [
  { type:'section', label:'Talent' },
  { label:'Turni Disponibili', to:'/portale#shifts' },
  { label:'Le Mie Candidature', to:'/portale#applications' },
  { label:'I Miei Turni',       to:'/portale#assignments' },
  { type:'section', label:'Account' },
  { label:'Il Mio Profilo',    to:'/portale#profile' },
]

function SectionTitle({ children, id }) {
  return <h2 id={id} style={{ ...COMPONENT_STYLES.sectionTitle, marginTop:'48px' }}>{children}</h2>
}

// ---------------------------------------------------------------------------
// TURNI DISPONIBILI
// ---------------------------------------------------------------------------

function AvailableShifts({ handleApiResponse }) {
  const [shifts,  setShifts]  = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(null)
  const [messages, setMessages] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = handleApiResponse(await shiftApi.list({ status:'OPEN' }))
    setLoading(false)
    if (res.success) setShifts(res.data?.items ?? [])
  }, [handleApiResponse])

  useEffect(() => { load() }, [load])

  const apply = async (shift_id) => {
    setApplying(shift_id)
    const res = handleApiResponse(
      await applicationApi.submit(shift_id, messages[shift_id] ?? '')
    )
    setApplying(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else { alert('Candidatura inviata!'); load() }
  }

  if (loading) return <div className="spinner" />
  if (!shifts.length) return <div className="empty-state">Nessun turno disponibile al momento.</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      {shifts.map(s => (
        <Card key={s.entity_id}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px' }}>
            <div>
              <div style={{ fontSize:'15px', fontWeight:500, marginBottom:'6px' }}>{s.data?.ruolo}</div>
              <div style={{ fontSize:'13px', color:COLORS.textSecondary, marginBottom:'4px' }}>
                {s.data?.data_inizio ? new Date(s.data.data_inizio).toLocaleString('it-IT',{dateStyle:'medium',timeStyle:'short'}) : '—'}
                {s.data?.data_fine   ? ` → ${new Date(s.data.data_fine).toLocaleString('it-IT',{timeStyle:'short'})}` : ''}
              </div>
              {s.data?.location && (
                <div style={{ fontSize:'12px', color:COLORS.textSecondary }}>{s.data.location}</div>
              )}
              {s.data?.compenso_orario && (
                <div style={{ fontSize:'12px', color:COLORS.success, marginTop:'4px', fontWeight:500 }}>
                  €{s.data.compenso_orario}/h
                </div>
              )}
              {s.data?.note && (
                <div style={{ fontSize:'12px', color:COLORS.textSecondary, marginTop:'8px' }}>{s.data.note}</div>
              )}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', minWidth:'200px' }}>
              <input
                placeholder="Messaggio (opzionale)"
                value={messages[s.entity_id] ?? ''}
                onChange={e => setMessages(p=>({...p,[s.entity_id]:e.target.value}))}
                style={{
                  border:`1px solid ${COLORS.border}`, borderRadius:'4px',
                  padding:'8px 12px', fontSize:'13px',
                  fontFamily:'Montserrat,sans-serif', width:'100%',
                }}
              />
              <Button
                size="sm"
                loading={applying === s.entity_id}
                onClick={() => apply(s.entity_id)}
              >
                Candidati
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LE MIE CANDIDATURE
// ---------------------------------------------------------------------------

function MyApplications({ handleApiResponse }) {
  const [apps,    setApps]    = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = handleApiResponse(await applicationApi.list())
    setLoading(false)
    if (res.success) setApps(res.data?.items ?? [])
  }, [handleApiResponse])

  useEffect(() => { load() }, [load])

  const withdraw = async (entity_id) => {
    if (!window.confirm('Ritirare la candidatura?')) return
    setActionLoading(entity_id)
    const res = handleApiResponse(await applicationApi.withdraw(entity_id))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  if (loading) return <div className="spinner" />
  if (!apps.length) return <div className="empty-state">Nessuna candidatura.</div>

  return (
    <div style={{ overflowX:'auto' }}>
      <table className="data-table">
        <thead>
          <tr><th>Turno</th><th>Messaggio</th><th>Stato</th><th>Azioni</th></tr>
        </thead>
        <tbody>
          {apps.map(a => (
            <tr key={a.entity_id}>
              <td>{a.data?.shift_ruolo ?? a.data?.shift_id}</td>
              <td style={{ maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {a.data?.messaggio || '—'}
              </td>
              <td><StatusBadge status={a.status} /></td>
              <td>
                {a.status === 'PENDING' && (
                  <Button
                    size="sm"
                    variant="danger"
                    loading={actionLoading === a.entity_id}
                    onClick={() => withdraw(a.entity_id)}
                  >
                    Ritira
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// I MIEI TURNI (ASSIGNMENT)
// ---------------------------------------------------------------------------

function MyAssignments({ handleApiResponse }) {
  const [assignments, setAssignments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = handleApiResponse(await assignmentApi.list())
    setLoading(false)
    if (res.success) setAssignments(res.data?.items ?? [])
  }, [handleApiResponse])

  useEffect(() => { load() }, [load])

  const checkin = async (entity_id) => {
    setActionLoading(entity_id + '_in')
    let lat = null, lng = null
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((res,rej) => navigator.geolocation.getCurrentPosition(res,rej,{timeout:5000}))
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {}
    }
    const res = handleApiResponse(await assignmentApi.checkin(entity_id, lat, lng))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  const checkout = async (entity_id) => {
    setActionLoading(entity_id + '_out')
    let lat = null, lng = null
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((res,rej) => navigator.geolocation.getCurrentPosition(res,rej,{timeout:5000}))
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {}
    }
    const res = handleApiResponse(await assignmentApi.checkout(entity_id, lat, lng))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  if (loading) return <div className="spinner" />
  if (!assignments.length) return <div className="empty-state">Nessun turno assegnato.</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      {assignments.map(a => (
        <Card key={a.entity_id}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
            <div>
              <div style={{ fontSize:'15px', fontWeight:500, marginBottom:'4px' }}>{a.data?.shift_ruolo ?? 'Turno'}</div>
              <div style={{ fontSize:'13px', color:COLORS.textSecondary }}>
                {a.data?.shift_inizio ? new Date(a.data.shift_inizio).toLocaleString('it-IT',{dateStyle:'medium',timeStyle:'short'}) : '—'}
              </div>
              {a.data?.checkin_ts  && <div style={{ fontSize:'12px', color:COLORS.success, marginTop:'4px'  }}>Check-in: {new Date(a.data.checkin_ts).toLocaleTimeString('it-IT',{timeStyle:'short'})}</div>}
              {a.data?.checkout_ts && <div style={{ fontSize:'12px', color:COLORS.success }}>Check-out: {new Date(a.data.checkout_ts).toLocaleTimeString('it-IT',{timeStyle:'short'})}</div>}
              {a.data?.ore_lavorate !== undefined && <div style={{ fontSize:'12px', color:COLORS.textSecondary }}>Ore lavorate: {a.data.ore_lavorate}</div>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px' }}>
              <StatusBadge status={a.status} />
              {a.status === 'CONFIRMED' && (
                <Button size="sm" loading={actionLoading === a.entity_id + '_in'} onClick={() => checkin(a.entity_id)}>
                  Check-in
                </Button>
              )}
              {a.status === 'CHECKED_IN' && (
                <Button size="sm" variant="secondary" loading={actionLoading === a.entity_id + '_out'} onClick={() => checkout(a.entity_id)}>
                  Check-out
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PROFILO
// ---------------------------------------------------------------------------

function MyProfile({ handleApiResponse }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState({})
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    (async () => {
      const res = handleApiResponse(await talentApi.list())
      setLoading(false)
      if (res.success && res.data?.items?.length) {
        const p = res.data.items[0]
        setProfile(p)
        setForm({
          disponibilita:         p.data?.disponibilita ?? '',
          lingue:                (p.data?.lingue ?? []).join(', '),
          skills:                (p.data?.skills ?? []).join(', '),
          note:                  p.data?.note ?? '',
          telefono:              p.data?.telefono ?? '',
        })
      }
    })()
  }, [handleApiResponse])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const res = handleApiResponse(await talentApi.updateProfile({
      ...form,
      lingue: form.lingue.split(',').map(x=>x.trim()).filter(Boolean),
      skills: form.skills.split(',').map(x=>x.trim()).filter(Boolean),
    }))
    setSaving(false)
    if (!res.success) alert(getErrorMessage(res.error))
    else { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }

  if (loading) return <div className="spinner" />
  if (!profile) return <div className="info-banner">Profilo talent non trovato. Verifica di aver completato la registrazione.</div>

  return (
    <Card>
      <div style={{ marginBottom:'16px' }}>
        <div style={{ fontSize:'16px', fontWeight:500 }}>{profile.data?.nome} {profile.data?.cognome}</div>
        <div style={{ fontSize:'13px', color:COLORS.textSecondary }}>{profile.data?.email}</div>
        <div style={{ marginTop:'8px' }}><StatusBadge status={profile.status} /></div>
      </div>

      {saved && <div className="success-banner">Profilo aggiornato.</div>}

      <form onSubmit={save}>
        <div className="form-grid">
          <Input
            label="Telefono"
            value={form.telefono}
            onChange={e => setForm(p=>({...p,telefono:e.target.value}))}
          />
          <Input
            label="Disponibilità"
            value={form.disponibilita}
            onChange={e => setForm(p=>({...p,disponibilita:e.target.value}))}
            helper="es. Week-end, Sera, Full-time"
          />
          <Input
            label="Lingue (separate da virgola)"
            value={form.lingue}
            onChange={e => setForm(p=>({...p,lingue:e.target.value}))}
            helper="es. Italiano, Inglese, Francese"
          />
          <Input
            label="Skills (separate da virgola)"
            value={form.skills}
            onChange={e => setForm(p=>({...p,skills:e.target.value}))}
          />
          <div className="form-field-full">
            <Input
              label="Note"
              value={form.note}
              onChange={e => setForm(p=>({...p,note:e.target.value}))}
            />
          </div>
        </div>
        <div style={{ marginTop:'16px' }}>
          <Button type="submit" loading={saving}>Salva Profilo</Button>
        </div>
      </form>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

export default function UserPortal() {
  const { handleApiResponse } = useAuth()

  return (
    <Layout sidebarItems={SIDEBAR_ITEMS}>
      <h1 style={{ ...COMPONENT_STYLES.sectionTitle }}>Il Mio Portale</h1>

      <div id="shifts">
        <SectionTitle>Turni Disponibili</SectionTitle>
        <AvailableShifts handleApiResponse={handleApiResponse} />
      </div>

      <div id="applications">
        <SectionTitle>Le Mie Candidature</SectionTitle>
        <MyApplications handleApiResponse={handleApiResponse} />
      </div>

      <div id="assignments">
        <SectionTitle>I Miei Turni</SectionTitle>
        <MyAssignments handleApiResponse={handleApiResponse} />
      </div>

      <div id="profile">
        <SectionTitle>Il Mio Profilo</SectionTitle>
        <MyProfile handleApiResponse={handleApiResponse} />
      </div>
    </Layout>
  )
}
