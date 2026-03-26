// === CARD — MADE EVENT Platform ===
import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../styles/theme'

export default function Card({ children, header, footer, hoverable = false, style, onClick }) {
  const [hovered, setHovered] = useState(false)

  const cardStyle = {
    ...COMPONENT_STYLES.card,
    cursor: hoverable || onClick ? 'pointer' : 'default',
    borderColor: hovered && (hoverable || onClick) ? COLORS.accent : COLORS.border,
    ...style,
  }

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {header && (
        <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${COLORS.border}` }}>
          {header}
        </div>
      )}
      {children}
      {footer && (
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${COLORS.border}` }}>
          {footer}
        </div>
      )}
    </div>
  )
}
