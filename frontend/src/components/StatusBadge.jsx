// === STATUS BADGE — MADE EVENTS Platform ===
import React from 'react'
import { COLORS } from '../styles/theme'

const STATUS_CONFIG = {
  // LEAD_TALENT / TALENT_PROFILE
  PARTIAL:                    { label: 'Bozza',             bg: '#F5F5F5', color: COLORS.textSecondary },
  COMPLETED_PENDING_APPROVAL: { label: 'In Attesa',         bg: '#FFF3E0', color: COLORS.warning },
  APPROVED:                   { label: 'Approvato',         bg: COLORS.successLight, color: COLORS.success },
  REJECTED:                   { label: 'Rifiutato',         bg: COLORS.errorLight,   color: COLORS.error },

  // EVENT
  DRAFT:      { label: 'Bozza',       bg: '#F5F5F5',        color: COLORS.textSecondary },
  PLANNING:   { label: 'Pianificazione', bg: '#E3F2FD',     color: '#1565C0' },
  LIVE:       { label: 'Live',        bg: COLORS.successLight, color: COLORS.success },
  COMPLETED:  { label: 'Completato',  bg: '#F3E5F5',        color: '#6A1B9A' },
  CANCELLED:  { label: 'Annullato',   bg: COLORS.errorLight, color: COLORS.error },

  // SHIFT
  OPEN:   { label: 'Aperto',   bg: COLORS.successLight, color: COLORS.success },
  FULL:   { label: 'Completo', bg: '#FFF3E0',           color: COLORS.warning },
  CLOSED: { label: 'Chiuso',   bg: '#F5F5F5',           color: COLORS.textSecondary },

  // APPLICATION
  PENDING:   { label: 'In Attesa',    bg: '#FFF3E0',        color: COLORS.warning },
  WITHDRAWN: { label: 'Ritirata',     bg: '#F5F5F5',        color: COLORS.textSecondary },

  // ASSIGNMENT
  CONFIRMED:    { label: 'Confermato',   bg: '#E3F2FD',     color: '#1565C0' },
  CHECKED_IN:   { label: 'Check-in',    bg: COLORS.successLight, color: COLORS.success },
  CHECKED_OUT:  { label: 'Check-out',   bg: '#F3E5F5',     color: '#6A1B9A' },
  VALIDATED:    { label: 'Validato',    bg: COLORS.successLight, color: COLORS.success },
  PAID:         { label: 'Pagato',      bg: '#E8F5E9',     color: '#1B5E20' },
  NO_SHOW:      { label: 'No Show',     bg: COLORS.errorLight, color: COLORS.error },
}

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status ?? '—',
    bg:    '#F5F5F5',
    color: COLORS.textSecondary,
  }

  return (
    <span
      style={{
        display:       'inline-block',
        padding:       '3px 10px',
        borderRadius:  '12px',
        fontSize:      '11px',
        fontWeight:    500,
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
        background:    cfg.bg,
        color:         cfg.color,
        whiteSpace:    'nowrap',
      }}
    >
      {cfg.label}
    </span>
  )
}
