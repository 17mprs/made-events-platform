// === SECTION SHELL — MADE EVENT ===
// Wrapper condiviso per ogni sezione: titolo numerato + pulsanti Indietro/Salva.
import React from 'react'
import { COLORS, LETTER_SPACING } from '../../styles/theme'
import Button from '../Button'

export default function SectionShell({ number, title, description, onBack, onNext, loading, children, nextLabel = 'Salva e continua →' }) {
  return (
    <div>
      {/* Titolo sezione */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: COLORS.accent, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 500, flexShrink: 0,
          }}>
            {number}
          </span>
          <h3 style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.text, margin: 0 }}>
            {title}
          </h3>
        </div>
        {description && (
          <p style={{ fontSize: '13px', color: COLORS.textSecondary, lineHeight: 1.7, marginLeft: '40px' }}>
            {description}
          </p>
        )}
        <div style={{ height: '1px', background: COLORS.border, marginTop: '16px' }} />
      </div>

      {/* Contenuto */}
      {children}

      {/* Azioni */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '36px', paddingTop: '24px', borderTop: `1px solid ${COLORS.border}` }}>
        {onBack && (
          <Button variant="secondary" type="button" onClick={onBack} disabled={loading}>
            ← Indietro
          </Button>
        )}
        <Button type="button" onClick={onNext} loading={loading} style={{ marginLeft: onBack ? 'auto' : undefined }}>
          {nextLabel}
        </Button>
      </div>
    </div>
  )
}
