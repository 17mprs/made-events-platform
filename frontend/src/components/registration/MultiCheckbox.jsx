// === MULTI CHECKBOX — MADE EVENTS ===
// Gruppo di checkbox per selezione multipla.
// Props:
//   options: [{value, label}] | string[]
//   value: string[]  (valori selezionati)
//   onChange: (newArray) => void
//   exclusive?: string  — valore che esclude tutti gli altri (es. "Nessuna")
//   columns?: 1 | 2 | 3  (default 2)
import React from 'react'
import { COLORS, COMPONENT_STYLES } from '../../styles/theme'

export default function MultiCheckbox({ options = [], value = [], onChange, exclusive, columns = 2, error }) {
  const normalized = options.map(o => typeof o === 'string' ? { value: o, label: o } : o)

  function toggle(opt) {
    if (exclusive && opt === exclusive) {
      // Selezionare "esclusivo" → deseleziona tutto il resto
      const next = value.includes(exclusive) ? [] : [exclusive]
      onChange(next)
      return
    }
    // Selezionare normale → deseleziona il valore esclusivo se presente
    let next = value.includes(opt)
      ? value.filter(v => v !== opt)
      : [...value.filter(v => v !== exclusive), opt]
    onChange(next)
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '10px',
      }}>
        {normalized.map(opt => {
          const checked = value.includes(opt.value)
          return (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                padding: '10px 12px',
                border: `1px solid ${checked ? COLORS.accent : COLORS.border}`,
                borderRadius: '4px',
                background: checked ? COLORS.accentLight : '#fff',
                transition: 'border-color 0.2s, background 0.2s',
                fontSize: '13px',
                color: COLORS.text,
                lineHeight: 1.4,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(opt.value)}
                style={{ marginTop: '1px', accentColor: COLORS.accent, flexShrink: 0 }}
              />
              {opt.label}
            </label>
          )
        })}
      </div>
      {error && (
        <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '6px' }}>{error}</p>
      )}
    </div>
  )
}
