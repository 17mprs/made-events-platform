// === APP.JSX — MADE EVENT Platform ===
import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

import LoginPage          from './pages/LoginPage'
import AdminDashboard     from './pages/AdminDashboard'
import LeadPage           from './pages/admin/LeadPage'
import TalentPage         from './pages/admin/TalentPage'
import EventiPage         from './pages/admin/EventiPage'
import ClientiPage        from './pages/admin/ClientiPage'
import CandidaturePage    from './pages/admin/CandidaturePage'
import UserPortal         from './pages/UserPortal'
import ClientPortal       from './pages/ClientPortal'
import RegisterUser       from './pages/RegisterUser'
import RegisterAzienda    from './pages/RegisterAzienda'
import RegisterComplete   from './pages/RegisterComplete'
import DemoReset          from './pages/DemoReset'
import FAQPage            from './pages/FAQPage'

// ---------------------------------------------------------------------------
// ROUTE GUARDS
// ---------------------------------------------------------------------------

function RequireAuth({ children, allowedRoles }) {
  const { isAuthenticated, role } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return children
}

function RootRedirect() {
  const { isAuthenticated, role } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return <Navigate to="/admin"   replace />
  if (role === 'USER')                              return <Navigate to="/portale" replace />
  if (role === 'CLIENTE')                           return <Navigate to="/cliente" replace />

  return <Navigate to="/login" replace />
}

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <Routes>
      <Route path="/"              element={<RootRedirect />} />
      <Route path="/login"         element={<LoginPage />} />
      <Route path="/registrazione"          element={<RegisterUser />} />
      <Route path="/registrazione/completa" element={<RegisterComplete />} />
      <Route path="/azienda"                element={<RegisterAzienda />} />
      {import.meta.env.DEV && (
        <Route path="/demo-reset" element={<DemoReset />} />
      )}

      <Route
        path="/admin"
        element={<RequireAuth allowedRoles={['SUPER_ADMIN', 'ADMIN']}><AdminDashboard /></RequireAuth>}
      />
      <Route
        path="/admin/lead"
        element={<RequireAuth allowedRoles={['SUPER_ADMIN', 'ADMIN']}><LeadPage /></RequireAuth>}
      />
      <Route
        path="/admin/talent"
        element={<RequireAuth allowedRoles={['SUPER_ADMIN', 'ADMIN']}><TalentPage /></RequireAuth>}
      />
      <Route
        path="/admin/eventi"
        element={<RequireAuth allowedRoles={['SUPER_ADMIN', 'ADMIN']}><EventiPage /></RequireAuth>}
      />
      <Route
        path="/admin/clienti"
        element={<RequireAuth allowedRoles={['SUPER_ADMIN', 'ADMIN']}><ClientiPage /></RequireAuth>}
      />
      <Route
        path="/admin/candidature"
        element={<RequireAuth allowedRoles={['SUPER_ADMIN', 'ADMIN']}><CandidaturePage /></RequireAuth>}
      />

      <Route
        path="/portale/faq"
        element={<RequireAuth allowedRoles={['USER']}><FAQPage /></RequireAuth>}
      />
      <Route
        path="/portale/*"
        element={
          <RequireAuth allowedRoles={['USER']}>
            <UserPortal />
          </RequireAuth>
        }
      />

      <Route
        path="/cliente/*"
        element={
          <RequireAuth allowedRoles={['CLIENTE']}>
            <ClientPortal />
          </RequireAuth>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
