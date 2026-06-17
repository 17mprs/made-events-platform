// === BUTTON — MADE EVENTS Platform ===
import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES, FONTS, LETTER_SPACING, RADIUS } from '../styles/theme'

export default function Button({
  children,
  variant  = 'primary',   // 'primary' | 'secondary' | 'danger'
  size     = 'md',        // 'md' | 'sm'
  loading  = false,
  disabled = false,
  type     = 'button',
  onClick,
  style,
  ...props
}) {
  const [hovered, setHovered] = useState(false)

  const base = variant === 'primary'
    ? COMPONENT_STYLES.buttonPrimary
    : variant === 'danger'
    ? COMPONENT_STYLES.buttonDanger
    : COMPONENT_STYLES.buttonSecondary

  const sizeOverride = size === 'sm' ? COMPONENT_STYLES.buttonSmall : {}

  let hoverOverride = {}
  if (hovered && !disabled && !loading) {
    if (variant === 'primary')   hoverOverride = { background: COLORS.accentHover }
    if (variant === 'secondary') hoverOverride = { background: COLORS.accentLight }
    if (variant === 'danger')    hoverOverride = { background: COLORS.errorLight }
  }

  const computed = {
    ...base,
    ...sizeOverride,
    ...hoverOverride,
    opacity: disabled || loading ? 0.6 : 1,
    cursor:  disabled || loading ? 'not-allowed' : 'pointer',
    position: 'relative',
    ...style,
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      style={computed}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <span
          style={{
            display:      'inline-block',
            width:        '14px',
            height:       '14px',
            border:       `2px solid rgba(255,255,255,0.4)`,
            borderTopColor: variant === 'primary' ? '#fff' : COLORS.accent,
            borderRadius: '50%',
            animation:    'spin 0.7s linear infinite',
            marginRight:  children ? '8px' : 0,
            flexShrink:   0,
          }}
        />
      )}
      {children}
    </button>
  )
}
