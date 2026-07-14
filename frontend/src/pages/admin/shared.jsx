// === ADMIN SHARED — MADE EVENTS Platform ===
import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../../styles/theme'
import Button from '../../components/Button'

// ---------------------------------------------------------------------------
// SIDEBAR CONFIG — route-based (no hash)
// ---------------------------------------------------------------------------

export const ADMIN_SIDEBAR = [
  { type:'section', label:'Dashboard' },
  { label:'Overview',       to:'/admin',           exact:true },
  { type:'section', label:'Talent' },
  { label:'Lead',           to:'/admin/lead' },
  { label:'Profili Talent', to:'/admin/talent' },
  { type:'section', label:'Operativo' },
  { label:'Clienti',        to:'/admin/clienti' },
  { label:'Eventi',         to:'/admin/eventi' },
  { label:'Candidature',    to:'/admin/candidature' },
]

// ---------------------------------------------------------------------------
// PAGE HEADER
// ---------------------------------------------------------------------------

export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:32, flexWrap:'wrap', gap:12 }}>
      <div style={{ minWidth:0 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', color:COLORS.text }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin:'6px 0 0', fontSize:13, color:COLORS.textSecondary }}>{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LEAD STATUS BADGE
// ---------------------------------------------------------------------------

export const LEAD_STATUS_META = {
  PARTIAL:                    { label:'Bozza',      bg:'#f5f5f5', color:'#666666' },
  COMPLETED_PENDING_APPROVAL: { label:'In Attesa',  bg:'#FFF3E0', color:'#E65100' },
  APPROVED:                   { label:'Approvato',  bg:'#E8F5E9', color:'#2E7D32' },
  REJECTED:                   { label:'Rifiutato',  bg:'#FFEBEE', color:'#C62828' },
}

export function LeadBadge({ status }) {
  const meta = LEAD_STATUS_META[status] ?? { label: status, bg:'#f5f5f5', color:'#666666' }
  return (
    <span style={{
      display:'inline-block', padding:'4px 12px', borderRadius:12,
      fontSize:11, fontWeight:600, letterSpacing:'0.5px',
      background:meta.bg, color:meta.color, whiteSpace:'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// SCORE BAR
// ---------------------------------------------------------------------------

export function ScoreBar({ score }) {
  const s = Number(score) || 0
  const color = s >= 80 ? '#10B981' : s >= 60 ? '#F59E0B' : s >= 40 ? '#F97316' : '#EF4444'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:6, background:'#f0f0f0', borderRadius:3, minWidth:60 }}>
        <div style={{ width:`${Math.min(s,100)}%`, height:'100%', background:color, borderRadius:3 }} />
      </div>
      <span style={{ fontSize:12, fontWeight:700, color, minWidth:24, textAlign:'right' }}>{s}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TALENT AVATAR
// ---------------------------------------------------------------------------

// Le foto talent sono su Drive con link "view" (drive.google.com/file/d/ID/view),
// non utilizzabile come <img src> — va convertito in link thumbnail incorporabile.
export function driveThumbUrl(url, size = 200) {
  if (typeof url !== 'string') return url
  const m = url.match(/\/file\/d\/([^/]+)/)
  if (!m) return url
  return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${size}`
}

export function TalentAvatar({ nome, fotoUrl, size = 40 }) {
  const [err, setErr] = useState(false)
  if (fotoUrl && !err) {
    return (
      <img
        src={driveThumbUrl(fotoUrl, Math.max(size * 2, 80))}
        alt={nome}
        onError={() => setErr(true)}
        style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}
      />
    )
  }
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background:'#630E33', color:'#fff', flexShrink:0,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:Math.round(size * 0.38), fontWeight:700,
    }}>
      {(nome?.[0] ?? '?').toUpperCase()}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FILTER INPUT STYLE + PAGINATION HELPERS
// ---------------------------------------------------------------------------

export const FILTER_INPUT = {
  background:'#ffffff', border:'1px solid #e0e0e0', color:'#333333',
  borderRadius:6, padding:'7px 12px', fontSize:12,
  fontFamily:'Montserrat, sans-serif', outline:'none',
}

export const PAGE_SIZE = 20

export function pageBtn(disabled, active = false) {
  return {
    background: active ? COLORS.accent : '#1A1A24',
    border:`1px solid ${active ? COLORS.accent : '#2A2A3A'}`,
    color: disabled ? '#444' : '#E8E8F0',
    borderRadius:6, padding:'6px 11px', fontSize:12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily:'Montserrat, sans-serif',
  }
}

export function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:16, alignItems:'center' }}>
      <button onClick={() => onPage(p => Math.max(1, p-1))} disabled={page===1} style={pageBtn(page===1)}>←</button>
      {Array.from({ length:totalPages }, (_,i) => i+1).map(n => (
        <button key={n} onClick={() => onPage(n)} style={pageBtn(false, n===page)}>{n}</button>
      ))}
      <button onClick={() => onPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} style={pageBtn(page===totalPages)}>→</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LEAD DRAWER (approval panel)
// ---------------------------------------------------------------------------

export function LeadDrawer({ lead, nota, onNotaChange, onClose, onAction, actionLoading }) {
  if (!lead) return null
  const d = lead.data ?? {}

  const row = (label, value) => value ? (
    <div key={label} style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap' }}>
      <span style={{ fontSize:12, color:'#8888A0', minWidth:150, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:12, color:'#E8E8F0', minWidth:0, wordBreak:'break-word' }}>{value}</span>
    </div>
  ) : null

  return (
    <>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200 }} />
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:440, maxWidth:'95vw',
        background:'#0E0E16', borderLeft:'1px solid #2A2A3A',
        zIndex:201, overflowY:'auto', padding:32,
        fontFamily:'Montserrat, sans-serif',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, margin:0, color:'#E8E8F0' }}>{d.nome} {d.cognome}</h2>
            <div style={{ fontSize:12, color:'#8888A0', marginTop:4 }}>{d.email}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#8888A0', fontSize:18, cursor:'pointer', padding:'4px 8px', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:20 }}>
          <TalentAvatar nome={d.nome} fotoUrl={d.foto_busto_url} size={64} />
          <div style={{ flex:1 }}>
            <LeadBadge status={lead.status} />
            {lead.status !== 'PARTIAL' && <div style={{ marginTop:8 }}><ScoreBar score={d.score} /></div>}
          </div>
        </div>

        <div style={{ borderTop:'1px solid #2A2A3A', marginBottom:16 }} />

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, letterSpacing:'1px', color:'#8888A0', textTransform:'uppercase', marginBottom:10 }}>Anagrafica</div>
          {row('Telefono', d.telefono)}
          {row('Città', d.citta)}
          {row('Residenza', d.residenza_citta ? `${d.residenza_citta}${d.residenza_provincia ? ' ('+d.residenza_provincia+')' : ''}` : null)}
          {row('Sezione completata', d.sezione_completata > 0 ? `${d.sezione_completata} / 7` : '1 / 7 (solo dati base)')}
          {row('Registrazione', d.registration_completed_at ? new Date(d.registration_completed_at).toLocaleDateString('it-IT') : null)}
        </div>

        {lead.status !== 'PARTIAL' && (
          <>
            <div style={{ borderTop:'1px solid #2A2A3A', marginBottom:16 }} />
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, letterSpacing:'1px', color:'#8888A0', textTransform:'uppercase', marginBottom:10 }}>Profilo</div>
              {row('Altezza', d.altezza ? `${d.altezza} cm` : null)}
              {row('Taglia t-shirt', d.taglia_tshirt)}
              {row('Numero scarpe', d.numero_scarpe)}
              {row('Inglese', d.lingua_inglese)}
              {row('Altra lingua', d.lingua_francese && d.lingua_francese !== 'Non conosco' ? `Francese: ${d.lingua_francese}` : d.lingua_spagnolo && d.lingua_spagnolo !== 'Non conosco' ? `Spagnolo: ${d.lingua_spagnolo}` : null)}
              {row('Anni esperienza', d.anni_esperienza_settore)}
              {row('Tipologie', (d.tipologie_esperienza ?? []).slice(0,3).join(', ') + ((d.tipologie_esperienza ?? []).length > 3 ? '…' : '') || null)}
              {row('Patente', (d.patente_tipologie ?? []).join(', ') || null)}
              {row('Trasferte', d.disponibilita_trasferte)}
              {row('Weekend', d.disponibilita_weekend)}
              {row('Ranking', d.ranking)}
            </div>
          </>
        )}

        {lead.status === 'COMPLETED_PENDING_APPROVAL' && (
          <>
            <div style={{ borderTop:'1px solid #2A2A3A', marginBottom:16 }} />
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:'#8888A0', display:'block', marginBottom:4 }}>Nota (opzionale)</label>
              <textarea
                value={nota}
                onChange={e => onNotaChange(e.target.value)}
                placeholder="Aggiungi una nota..."
                rows={2}
                style={{ width:'100%', background:'#1A1A24', border:'1px solid #2A2A3A', color:'#E8E8F0', borderRadius:6, padding:'8px 10px', fontSize:12, fontFamily:'Montserrat, sans-serif', resize:'vertical', boxSizing:'border-box' }}
              />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <Button onClick={() => onAction('approve', lead.entity_id)} loading={actionLoading === lead.entity_id + '_approve'}>Approva</Button>
              <Button variant="secondary" onClick={() => onAction('modifiche', lead.entity_id)}>Richiedi Modifiche</Button>
              <Button variant="danger" onClick={() => onAction('reject', lead.entity_id)} loading={actionLoading === lead.entity_id + '_reject'}>Rifiuta</Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
