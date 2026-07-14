// === LAYOUT — MADE EVENTS Platform ===
import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { COLORS, COMPONENT_STYLES, LAYOUT, LETTER_SPACING, FONTS } from '../styles/theme'
import { useAuth } from '../contexts/AuthContext'

// ---------------------------------------------------------------------------
// HEADER
// ---------------------------------------------------------------------------

function Header({ onMenuToggle, showMenu }) {
  const { user, logout, isAuthenticated, role } = useAuth()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login')
    } catch (err) {
      console.error('Logout error:', err)
      navigate('/login')
    } finally {
      setLoggingOut(false)
    }
  }

  const navLinks = []
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    navLinks.push({ to: '/admin',    label: 'Gestione' })
  }
  if (role === 'USER') {
    navLinks.push({ to: '/portale',  label: 'Il Mio Portale' })
  }
  if (role === 'CLIENTE') {
    navLinks.push({ to: '/cliente',  label: 'I Miei Eventi' })
  }

  return (
    <header style={COMPONENT_STYLES.header}>
      {/* Logo */}
      <div style={COMPONENT_STYLES.logo}>
        {/* Hamburger — mobile only */}
        <button
          className="show-mobile"
          onClick={onMenuToggle}
          style={{
            background:  'none',
            border:      'none',
            cursor:      'pointer',
            padding:     '6px',
            marginRight: '8px',
            display:     'flex',
            flexDirection: 'column',
            gap:         '4px',
          }}
          aria-label="Menu"
        >
          {[0,1,2].map(i => (
            <span key={i} style={{ display:'block', width:'20px', height:'1px', background: COLORS.text }} />
          ))}
        </button>

        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="2" fill={COLORS.accent} />
          <path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="logo-text" style={{ letterSpacing: LETTER_SPACING.logo, fontSize:'22px', fontWeight:600 }}>MADE EVENTS</span>
      </div>

      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', gap:'32px' }}>
        {isAuthenticated && navLinks.map(l => (
          <NavLink key={l.to} to={l.to}>{l.label}</NavLink>
        ))}

        {isAuthenticated ? (
          <div style={{ position:'relative' }}>
            <button
              onClick={() => setUserMenuOpen(p => !p)}
              style={{
                ...COMPONENT_STYLES.navLink,
                display:    'flex',
                alignItems: 'center',
                gap:        '6px',
              }}
            >
              <span style={{
                width:        '28px',
                height:       '28px',
                borderRadius: '50%',
                background:   COLORS.accentLight,
                color:        COLORS.accent,
                display:      'flex',
                alignItems:   'center',
                justifyContent:'center',
                fontSize:     '12px',
                fontWeight:   500,
              }}>
                {(user?.email?.[0] ?? '?').toUpperCase()}
              </span>
              <span className="hide-mobile" style={{ fontSize:'13px', letterSpacing:'1px', textTransform:'uppercase' }}>
                {user?.email?.split('@')[0] ?? 'Account'}
              </span>
            </button>

            {userMenuOpen && (
              <div style={{
                position:    'absolute',
                top:         '40px',
                right:       0,
                background:  COLORS.bg,
                border:      `1px solid ${COLORS.border}`,
                borderRadius:'4px',
                minWidth:    '160px',
                zIndex:      200,
                overflow:    'hidden',
              }}>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  style={{
                    ...COMPONENT_STYLES.navLink,
                    display:  'block',
                    width:    '100%',
                    padding:  '12px 16px',
                    textAlign:'left',
                    fontSize: '13px',
                    color:    COLORS.error,
                    opacity:  loggingOut ? 0.6 : 1,
                    cursor:   loggingOut ? 'wait' : 'pointer',
                  }}
                >
                  {loggingOut ? 'Disconnessione...' : 'Logout'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <NavLink to="/login">Accedi</NavLink>
        )}
      </nav>
    </header>
  )
}

function NavLink({ to, children }) {
  const location = useLocation()
  const active   = location.pathname.startsWith(to)
  return (
    <Link
      to={to}
      style={{
        ...COMPONENT_STYLES.navLink,
        borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
        color:        active ? COLORS.accent : COLORS.text,
      }}
    >
      {children}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// SIDEBAR
// ---------------------------------------------------------------------------

export function Sidebar({ items, open }) {
  const location = useLocation()

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <nav style={{ paddingLeft: 24 }}>
        {items.map((item, i) => {
          if (item.type === 'section') {
            return (
              <div
                key={i}
                style={{
                  padding:       '16px 24px 6px',
                  fontSize:      '10px',
                  fontWeight:    500,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  color:         COLORS.textSecondary,
                }}
              >
                {item.label}
              </div>
            )
          }

          const isHash  = item.to && item.to.includes('#')
          const active  = item.exact
            ? location.pathname === item.to
            : !isHash && location.pathname.startsWith(item.to)

          const linkStyle = {
            display:       'block',
            padding:       '10px 24px',
            fontSize:      '13px',
            fontWeight:    500,
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            color:         active ? COLORS.accent : COLORS.text,
            background:    active ? COLORS.accentLight : 'transparent',
            borderLeft:    active ? `3px solid ${COLORS.accent}` : '3px solid transparent',
            textDecoration:'none',
            transition:    'background 0.2s',
          }

          if (isHash) {
            return (
              <a key={i} href={item.to} style={linkStyle}>
                {item.label}
              </a>
            )
          }

          return (
            <Link key={i} to={item.to} style={linkStyle}>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// FOOTER
// ---------------------------------------------------------------------------

function Footer() {
  return (
    <footer style={COMPONENT_STYLES.footer}>
      <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
        <span>© {new Date().getFullYear()} MADE EVENTS — Tutti i diritti riservati</span>
        <span style={{ letterSpacing:'2px', fontSize:'11px', textTransform:'uppercase' }}>v1.0.0</span>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// MAIN LAYOUT WRAPPER
// ---------------------------------------------------------------------------

export default function Layout({ children, sidebarItems }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      <Header onMenuToggle={() => setMenuOpen(p => !p)} showMenu={menuOpen} />

      {sidebarItems ? (
        <div className="main-with-sidebar">
          <Sidebar items={sidebarItems} open={menuOpen} />
          <main className="main-content" onClick={() => setMenuOpen(false)}>
            {children}
          </main>
        </div>
      ) : (
        <main className="main-content">
          {children}
        </main>
      )}

      <Footer />
    </div>
  )
}
