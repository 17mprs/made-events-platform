// === SKELETON CARD — MADE EVENTS Platform ===
// Rettangoli grigi animati (pulse) per stati di caricamento nelle pagine admin.

import React from 'react'

// Keyframes iniettati una sola volta nel <style> globale
if (typeof document !== 'undefined' && !document.getElementById('skeleton-pulse-style')) {
  const style = document.createElement('style')
  style.id = 'skeleton-pulse-style'
  style.textContent = `
    @keyframes skeleton-pulse {
      0%   { opacity: 1; }
      50%  { opacity: 0.45; }
      100% { opacity: 1; }
    }
    .skeleton-pulse {
      animation: skeleton-pulse 1.5s ease-in-out infinite;
      background: #e8e8e8;
      border-radius: 4px;
    }
  `
  document.head.appendChild(style)
}

/** Singola riga skeleton (rettangolo grigio pulsante). */
function SkeletonLine({ width = '100%', height = 14, style: extraStyle }) {
  return (
    <div
      className="skeleton-pulse"
      style={{ width, height, borderRadius: 4, ...extraStyle }}
    />
  )
}

/**
 * Card skeleton per lista eventi (magazine card, 220px).
 * Mostra una photo area + 3 righe di testo.
 */
function SkeletonEventCard() {
  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: '1px solid #f0f0f0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      background: '#fff',
    }}>
      {/* Photo area */}
      <div className="skeleton-pulse" style={{ height: 220, borderRadius: 0 }} />
      {/* Body */}
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonLine height={16} width="75%" />
        <SkeletonLine height={12} width="50%" />
        <SkeletonLine height={12} width="60%" />
        <SkeletonLine height={8}  width="40%" style={{ marginTop: 4 }} />
      </div>
    </div>
  )
}

/**
 * Card skeleton per righe tabella (talent/lead/candidature).
 * Mostra avatar + 2 righe di testo.
 */
function SkeletonTableRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
      {/* Avatar */}
      <div className="skeleton-pulse" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SkeletonLine height={13} width="45%" />
        <SkeletonLine height={11} width="30%" />
      </div>
      <SkeletonLine height={24} width={64} style={{ borderRadius: 12 }} />
    </div>
  )
}

/**
 * SkeletonCard — componente generico con variante.
 *
 * @param {object} props
 * @param {'event'|'table'|'stat'} props.variant  - tipo di skeleton
 * @param {number} props.count                    - quante istanze renderizzare
 */
export default function SkeletonCard({ variant = 'event', count = 1 }) {
  const items = Array.from({ length: count })

  if (variant === 'event') {
    return (
      <>
        {items.map((_, i) => <SkeletonEventCard key={i} />)}
      </>
    )
  }

  if (variant === 'table') {
    return (
      <div>
        {items.map((_, i) => <SkeletonTableRow key={i} />)}
      </div>
    )
  }

  if (variant === 'stat') {
    return (
      <>
        {items.map((_, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0',
            padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <SkeletonLine height={11} width="50%" />
            <SkeletonLine height={32} width="40%" />
            <SkeletonLine height={11} width="60%" />
          </div>
        ))}
      </>
    )
  }

  return null
}
