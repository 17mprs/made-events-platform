// === INPUT — MADE EVENT Platform ===
import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../styles/theme'

export default function Input({
  label,
  error,
  helper,
  id,
  style,
  ...props
}) {
  const [focused, setFocused] = useState(false)

  const inputStyle = {
    ...COMPONENT_STYLES.input,
    borderColor: error
      ? COLORS.error
      : focused
      ? COLORS.accent
      : COLORS.border,
    ...style,
  }

  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '_') : undefined)

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label htmlFor={inputId} style={COMPONENT_STYLES.label}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        style={inputStyle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '12px', color: COLORS.error, marginTop: '4px', display: 'block' }}>
          {error}
        </span>
      )}
      {!error && helper && (
        <span style={{ fontSize: '12px', color: COLORS.textSecondary, marginTop: '4px', display: 'block' }}>
          {helper}
        </span>
      )}
    </div>
  )
}
