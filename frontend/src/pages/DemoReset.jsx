// === DEMO RESET — MADE EVENTS Platform ===
// Pagina di reset dati demo. Solo in development.
// Accessibile a /demo-reset (nessun auth richiesto in dev).

import React, { useState } from 'react'
import { GAS_ENDPOINT, getToken } from '../api/client'

const COLORS = {
  bg:      '#0B0B0F',
  surface: '#1A1A24',
  border:  '#2A2A3A',
  accent:  '#630E33',
  accentH: '#9B2535',
  text:    '#E8E8F0',
  muted:   '#8888A0',
  success: '#2ECC71',
  warn:    '#F39C12',
  error:   '#E74C3C',
}

const s = {
  page: {
    minHeight: '100vh', background: COLORS.bg, color: COLORS.text,
    fontFamily: "'Montserrat', sans-serif", padding: '40px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  card: {
    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
    borderRadius: 12, padding: '36px 40px', maxWidth: 600, width: '100%',
  },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 8, color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.muted, marginBottom: 32 },
  btn: (variant = 'accent', disabled = false) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '12px 24px', borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 14,
    background: disabled ? '#333' : variant === 'accent' ? COLORS.accent : '#2A2A3A',
    color: disabled ? COLORS.muted : COLORS.text,
    opacity: disabled ? 0.7 : 1, transition: 'background 0.2s',
    textDecoration: 'none',
  }),
  linkRow: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 },
  linkItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', background: '#12121A', borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
  },
  label: { fontSize: 12, color: COLORS.muted, marginBottom: 2 },
  value: { fontSize: 13, color: COLORS.text, wordBreak: 'break-all' },
  log: {
    marginTop: 20, padding: 16, background: '#0A0A12', borderRadius: 8,
    border: `1px solid ${COLORS.border}`, fontFamily: 'monospace', fontSize: 12,
    color: COLORS.success, lineHeight: 1.6, maxHeight: 200, overflowY: 'auto',
  },
  badge: (color) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11,
    fontWeight: 600, background: color + '22', color: color,
  }),
  divider: { borderTop: `1px solid ${COLORS.border}`, margin: '24px 0' },
}

const FRONTEND = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin

export default function DemoReset() {
  const [status, setStatus]     = useState('idle')  // idle | loading | done | error
  const [result, setResult]     = useState(null)
  const [log, setLog]           = useState([])

  function addLog(msg) {
    setLog(prev => [...prev, msg])
  }

  async function handleReset() {
    setStatus('loading')
    setLog([])
    addLog('Connessione al backend GAS...')

    try {
      const token = getToken()
      if (!token) {
        addLog('[ERRORE] Nessun token admin. Fai login prima.')
        setStatus('error')
        return
      }

      addLog('Invio richiesta demo.reset...')
      const res = await fetch(GAS_ENDPOINT, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'demo.reset', payload: {}, token }),
      })

      const json = await res.json()

      if (!json.success) {
        addLog('[ERRORE] ' + (json.error?.message || 'Risposta non valida'))
        setStatus('error')
        return
      }

      addLog('[OK] Demo data ripristinati.')
      addLog('[OK] Lead creati: ' + json.data.leads_count)
      addLog('[OK] Token fresco: ' + json.data.fresh_token)
      setResult(json.data)
      setStatus('done')
    } catch (err) {
      addLog('[ERRORE] ' + err.message)
      setStatus('error')
    }
  }

  const freshToken  = result?.fresh_token || ''
  const formUrl     = freshToken ? `${FRONTEND}/registrazione/completa?token=${freshToken}` : ''
  const adminUrl    = `${FRONTEND}/admin`
  const loginUrl    = `${FRONTEND}/login`

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={s.badge(COLORS.warn)}>DEV ONLY</span>
        </div>
        <h1 style={s.title}>Demo Reset</h1>
        <p style={s.subtitle}>
          Cancella tutti i lead <code>@demo.it</code> esistenti e ricrea 7 profili demo.<br />
          Richiede un utente SUPER_ADMIN loggato.
        </p>

        <button
          style={s.btn('accent', status === 'loading')}
          onClick={handleReset}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Reset in corso...' : 'Resetta dati demo'}
        </button>

        {log.length > 0 && (
          <div style={s.log}>
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}

        {status === 'done' && result && (
          <>
            <div style={s.divider} />
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: COLORS.success }}>
              ✓ Reset completato — link demo
            </div>

            <div style={s.linkRow}>
              <div style={s.linkItem}>
                <div style={{ flex: 1 }}>
                  <div style={s.label}>Form registrazione (Chiara De Luca — profilo vuoto)</div>
                  <div style={s.value}>{formUrl || '—'}</div>
                </div>
                {formUrl && (
                  <a href={formUrl} target="_blank" rel="noreferrer" style={s.btn('secondary')}>
                    Apri
                  </a>
                )}
              </div>

              <div style={s.linkItem}>
                <div style={{ flex: 1 }}>
                  <div style={s.label}>Login admin</div>
                  <div style={s.value}>admin@madeevent.it / Made2024!</div>
                </div>
                <a href={loginUrl} target="_blank" rel="noreferrer" style={s.btn('secondary')}>
                  Login
                </a>
              </div>

              <div style={s.linkItem}>
                <div style={{ flex: 1 }}>
                  <div style={s.label}>Admin dashboard — lista candidati</div>
                  <div style={s.value}>{adminUrl}#leads</div>
                </div>
                <a href={adminUrl + '#leads'} target="_blank" rel="noreferrer" style={s.btn('secondary')}>
                  Apri
                </a>
              </div>
            </div>

            <div style={s.divider} />
            <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.7 }}>
              <strong style={{ color: COLORS.text }}>Profili creati:</strong><br />
              5 profili <em>in attesa di approvazione</em> — score 45–92<br />
              1 profilo <em>in compilazione</em> (Alessandro Gatti — sezione 3/8)<br />
              1 profilo <em>fresco</em> (Chiara De Luca — form vuoto)
            </div>
          </>
        )}
      </div>
    </div>
  )
}
