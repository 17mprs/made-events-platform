// === CLIENT PORTAL — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { eventApi, shiftApi, assignmentApi, getErrorMessage } from '../api/client'
import { COLORS, COMPONENT_STYLES } from '../styles/theme'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Card   from '../components/Card'
import StatusBadge from '../components/StatusBadge'

const SIDEBAR_ITEMS = [
  { type:'section', label:'Azienda' },
  { label:'I Miei Eventi', to:'/cliente#events' },
  { label:'Turni & Staff',  to:'/cliente#shifts' },
]

function SectionTitle({ children, id }) {
  return <h2 id={id} style={{ ...COMPONENT_STYLES.sectionTitle, marginTop:'48px' }}>{children}</h2>
}

// ---------------------------------------------------------------------------
// EVENTI DEL CLIENTE
// ---------------------------------------------------------------------------

function ClientEvents({ handleApiResponse, onSelectEvent, selectedEventId }) {
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const res = handleApiResponse(await eventApi.list())
      setLoading(false)
      if (res.success) setEvents(res.data?.items ?? [])
    })()
  }, [handleApiResponse])

  if (loading) return <div className="spinner" />
  if (!events.length) return <div className="empty-state">Nessun evento associato al tuo account.</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
      {events.map(ev => (
        <Card
          key={ev.entity_id}
          hoverable
          onClick={() => onSelectEvent(ev.entity_id === selectedEventId ? null : ev.entity_id)}
          style={{
            borderColor: ev.entity_id === selectedEventId ? COLORS.accent : COLORS.border,
          }}
        >
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <div style={{ fontSize:'15px', fontWeight:500, marginBottom:'4px' }}>{ev.data?.titolo}</div>
              <div style={{ fontSize:'13px', color:COLORS.textSecondary }}>
                {ev.data?.data_inizio ? new Date(ev.data.data_inizio).toLocaleDateString('it-IT', { dateStyle:'long' }) : '—'}
                {ev.data?.luogo ? ` · ${ev.data.luogo}` : ''}
              </div>
            </div>
            <StatusBadge status={ev.status} />
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TURNI E ASSIGNMENT PER EVENTO SELEZIONATO
// ---------------------------------------------------------------------------

function EventShifts({ eventId, handleApiResponse }) {
  const [shifts,      setShifts]      = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [shRes, asRes] = await Promise.all([
      handleApiResponse(await shiftApi.list({ event_id: eventId })),
      handleApiResponse(await assignmentApi.list({ event_id: eventId })),
    ])
    setLoading(false)
    if (shRes.success) setShifts(shRes.data?.items ?? [])
    if (asRes.success) setAssignments(asRes.data?.items ?? [])
  }, [eventId, handleApiResponse])

  useEffect(() => { load() }, [load])

  const validate = async (entity_id) => {
    setActionLoading(entity_id)
    const res = handleApiResponse(await assignmentApi.validate(entity_id))
    setActionLoading(null)
    if (!res.success) alert(getErrorMessage(res.error))
    else load()
  }

  if (loading) return <div style={{ padding:'20px' }}><div className="spinner" /></div>

  if (!shifts.length && !assignments.length) {
    return <div className="empty-state">Nessun turno per questo evento.</div>
  }

  return (
    <div>
      {shifts.map(s => {
        const shiftAssignments = assignments.filter(a => a.data?.shift_id === s.entity_id)
        return (
          <div key={s.entity_id} style={{ marginBottom:'24px' }}>
            <div style={{
              display:       'flex',
              alignItems:    'center',
              gap:           '12px',
              marginBottom:  '12px',
              paddingBottom: '8px',
              borderBottom:  `1px solid ${COLORS.border}`,
            }}>
              <span style={{ fontSize:'13px', fontWeight:500, letterSpacing:'1px', textTransform:'uppercase' }}>
                {s.data?.ruolo}
              </span>
              <span style={{ fontSize:'12px', color:COLORS.textSecondary }}>
                {s.data?.data_inizio ? new Date(s.data.data_inizio).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}) : ''}
                {s.data?.data_fine   ? ` → ${new Date(s.data.data_fine).toLocaleString('it-IT',{timeStyle:'short'})}` : ''}
              </span>
              <StatusBadge status={s.status} />
            </div>

            {shiftAssignments.length === 0 ? (
              <div style={{ fontSize:'13px', color:COLORS.textSecondary, paddingLeft:'16px' }}>
                Nessun talent assegnato.
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Talent</th>
                      <th>Check-in</th>
                      <th>Check-out</th>
                      <th>Ore</th>
                      <th>Stato</th>
                      <th>Valida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftAssignments.map(a => (
                      <tr key={a.entity_id}>
                        <td>{a.data?.talent_name ?? a.data?.talent_profile_id}</td>
                        <td>{a.data?.checkin_ts  ? new Date(a.data.checkin_ts).toLocaleTimeString('it-IT',{timeStyle:'short'}) : '—'}</td>
                        <td>{a.data?.checkout_ts ? new Date(a.data.checkout_ts).toLocaleTimeString('it-IT',{timeStyle:'short'}) : '—'}</td>
                        <td>{a.data?.ore_lavorate ?? '—'}</td>
                        <td><StatusBadge status={a.status} /></td>
                        <td>
                          {a.status === 'CHECKED_OUT' && (
                            <Button
                              size="sm"
                              loading={actionLoading === a.entity_id}
                              onClick={() => validate(a.entity_id)}
                            >
                              Valida
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

export default function ClientPortal() {
  const { handleApiResponse } = useAuth()
  const [selectedEventId, setSelectedEventId] = useState(null)

  return (
    <Layout sidebarItems={SIDEBAR_ITEMS}>
      <h1 style={{ ...COMPONENT_STYLES.sectionTitle }}>Portale Azienda</h1>

      <div id="events">
        <SectionTitle>I Miei Eventi</SectionTitle>
        <ClientEvents
          handleApiResponse={handleApiResponse}
          onSelectEvent={setSelectedEventId}
          selectedEventId={selectedEventId}
        />
      </div>

      <div id="shifts">
        <SectionTitle>Turni & Staff</SectionTitle>
        {selectedEventId ? (
          <EventShifts eventId={selectedEventId} handleApiResponse={handleApiResponse} />
        ) : (
          <div className="info-banner">Seleziona un evento dalla lista per visualizzarne i turni e lo staff.</div>
        )}
      </div>
    </Layout>
  )
}
