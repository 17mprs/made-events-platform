// === ADMIN DASHBOARD (OVERVIEW) — MADE EVENTS Platform ===
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { COLORS, COMPONENT_STYLES } from '../styles/theme'
import Layout from '../components/Layout'
import Card from '../components/Card'
import { ADMIN_SIDEBAR } from './admin/shared'
import { LeadsSection }          from './admin/LeadPage'
import { TalentsSection, PendingApprovalSection } from './admin/TalentPage'
import adminStore from '../store/adminStore'

// ---------------------------------------------------------------------------
// STAT CARD
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, to }) {
  const navigate = useNavigate()
  return (
    <Card
      onClick={to ? () => navigate(to) : undefined}
      hoverable={!!to}
      style={{ cursor: to ? 'pointer' : 'default' }}
    >
      <div style={{ fontSize:'11px', letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.textSecondary }}>
        {label}
      </div>
      <div style={{ fontSize:'32px', fontWeight:300, color:COLORS.text, margin:'8px 0 4px' }}>
        {value ?? '—'}
      </div>
      {sub && <div style={{ fontSize:'12px', color:COLORS.textSecondary }}>{sub}</div>}
      {to && (
        <div style={{ marginTop:12, fontSize:11, color:COLORS.accent, letterSpacing:'0.5px', fontWeight:600 }}>
          Gestisci →
        </div>
      )}
    </Card>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ ...COMPONENT_STYLES.sectionTitle, marginTop:48, marginBottom:20 }}>
      {children}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const { handleApiResponse } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false

    function computeStats(data) {
      if (!data) return
      const leads  = data.leads        ?? []
      const events = data.events       ?? []
      const apps   = data.applications ?? []
      setStats({
        leads:        leads.filter(l => l.status === 'PARTIAL').length,
        pendingTalent: leads.filter(l => l.status === 'COMPLETED_PENDING_APPROVAL').length,
        events:        events.filter(e => e.status === 'LIVE').length,
        pendingApps:   apps.filter(a => a.status === 'PENDING').length,
      })
    }

    // Dati già in cache → aggiorna subito senza aspettare la promise
    const cached = adminStore.getData()
    if (cached) computeStats(cached)

    // Forza caricamento se stale
    adminStore.ensure().then(data => {
      if (!cancelled) computeStats(data)
    })

    // Re-render ad ogni notifica dallo store (load completato, refresh, ecc.)
    const unsub = adminStore.subscribe(() => {
      if (!cancelled) computeStats(adminStore.getData())
    })

    return () => { cancelled = true; unsub() }
  }, [])

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      {/* KPI cards */}
      <h1 style={{ ...COMPONENT_STYLES.sectionTitle, marginBottom:8 }}>Overview</h1>
      <p style={{ fontSize:13, color:COLORS.textSecondary, marginBottom:28 }}>
        Riepilogo attività piattaforma MADE EVENTS.
      </p>

      <div className="stats-grid">
        <StatCard
          label="Lead totali"
          value={stats?.leads}
          sub="Candidature ricevute"
          to="/admin/lead"
        />
        <StatCard
          label="Talent da approvare"
          value={stats?.pendingTalent}
          sub="Profili in attesa"
          to="/admin/talent"
        />
        <StatCard
          label="Eventi"
          value={stats?.events}
          sub="Totale nel sistema"
          to="/admin/eventi"
        />
        <StatCard
          label="Candidature in attesa"
          value={stats?.pendingApps}
          sub="Da elaborare"
          to="/admin/candidature"
        />
      </div>

      {/* Lead Talent section */}
      <SectionTitle>Lead Talent</SectionTitle>
      <LeadsSection handleApiResponse={handleApiResponse} />

      {/* Talent da approvare */}
      <SectionTitle>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          Talent da approvare
          {stats?.pendingTalent > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, background: '#EF4444', color: '#fff',
              borderRadius: 12, padding: '2px 10px', lineHeight: 1,
            }}>
              {stats.pendingTalent} nuov{stats.pendingTalent !== 1 ? 'i' : 'o'}
            </span>
          )}
        </span>
      </SectionTitle>
      <PendingApprovalSection handleApiResponse={handleApiResponse} />

      {/* Profili Talent section */}
      <SectionTitle>Profili Talent</SectionTitle>
      <TalentsSection handleApiResponse={handleApiResponse} />
    </Layout>
  )
}
