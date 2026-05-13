import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../../styles/theme'
import { PROVINCE_ALFA } from '../registration/data/province'

export default function CittaProvinciaSelect({
  citta,
  provincia,
  onChange,
  label,
  required = true,
  disabled = false,
}) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? PROVINCE_ALFA.filter(p =>
        p.sigla.toLowerCase().includes(search.toLowerCase()) ||
        p.nome.toLowerCase().includes(search.toLowerCase())
      )
    : PROVINCE_ALFA

  const handleSearch = (e) => {
    const val = e.target.value
    setSearch(val)
    const matches = PROVINCE_ALFA.filter(p =>
      p.sigla.toLowerCase().includes(val.toLowerCase()) ||
      p.nome.toLowerCase().includes(val.toLowerCase())
    )
    if (matches.length === 1) onChange({ citta, provincia: matches[0].sigla })
  }

  const handleProvinciaChange = (e) => {
    onChange({ citta, provincia: e.target.value })
    setSearch('')
  }

  const handleCittaChange = (e) => {
    onChange({ citta: e.target.value, provincia })
  }

  const selectedLabel = provincia
    ? PROVINCE_ALFA.find(p => p.sigla === provincia)?.nome || ''
    : ''

  return (
    <div>
      {label && (
        <label style={COMPONENT_STYLES.label}>
          {label}{required && ' *'}
        </label>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="text"
            placeholder="🔍 Cerca provincia..."
            value={search || (provincia && !search ? selectedLabel : '')}
            onChange={handleSearch}
            onFocus={() => setSearch('')}
            disabled={disabled}
            style={{
              ...COMPONENT_STYLES.input,
              fontSize: 13,
              fontFamily: 'Montserrat, sans-serif',
            }}
          />
          <select
            value={provincia}
            onChange={handleProvinciaChange}
            disabled={disabled}
            style={{ ...COMPONENT_STYLES.input }}
          >
            <option value="">— Provincia —</option>
            {filtered.map(p => (
              <option key={p.sigla} value={p.sigla}>{p.sigla} — {p.nome}</option>
            ))}
          </select>
        </div>

        <input
          type="text"
          placeholder="Città"
          value={citta}
          onChange={handleCittaChange}
          disabled={disabled}
          style={{
            ...COMPONENT_STYLES.input,
            height: 'fit-content',
            alignSelf: 'end',
          }}
        />
      </div>
    </div>
  )
}
