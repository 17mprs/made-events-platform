// === REGISTRATION PROGRESS BAR — MADE EVENT ===
import React from 'react'
import { COLORS } from '../../styles/theme'

const SECTION_LABELS = [
  'Dati Personali',
  'Profilo Fisico',
  'Disponibilità',
  'Lingue',
  'Professionale',
  'Dotazione',
]

export default function ProgressBar({ current }) {
  const pct = Math.round((current / SECTION_LABELS.length) * 100)

  return (
    <div style={{ marginBottom: '40px' }}>
      {/* Top row: sezione corrente + contatore */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.accent }}>
          {SECTION_LABELS[current - 1]}
        </span>
        <span style={{ fontSize: '11px', color: COLORS.textSecondary, letterSpacing: '1px' }}>
          {current} / {SECTION_LABELS.length}
        </span>
      </div>

      {/* Barra continua */}
      <div style={{ height: '3px', background: COLORS.border, borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: COLORS.accent,
          borderRadius: '2px',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Pallini sezioni */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
        {SECTION_LABELS.map((label, i) => {
          const n = i + 1
          const done    = n < current
          const active  = n === current
          const pending = n > current
          return (
            <div
              key={n}
              title={label}
              style={{
                width: '8px', height: '8px',
                borderRadius: '50%',
                background: done || active ? COLORS.accent : COLORS.border,
                opacity: active ? 1 : done ? 0.7 : 0.3,
                transition: 'background 0.3s, opacity 0.3s',
                flexShrink: 0,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
