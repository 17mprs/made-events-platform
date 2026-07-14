// === SEZIONE 3 — DISPONIBILITÀ LOGISTICA ===
import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../../../styles/theme'
import SectionShell from '../SectionShell'
import MultiCheckbox from '../MultiCheckbox'
import { PROVINCE_ALFA } from '../data/province'
import { PATENTI } from '../questionnaireOptions'

export const PROVINCE_OPTIONS = PROVINCE_ALFA.map(p => ({
  value: p.sigla,
  label: `${p.nome} (${p.sigla})`,
}))

function RadioYesNo({ label, name, value, onChange, required, error }) {
  return (
    <div>
      <label style={COMPONENT_STYLES.label}>{label}{required && ' *'}</label>
      <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
        {['Sì', 'No'].map(opt => (
          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: COLORS.text }}>
            <input
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              style={{ accentColor: COLORS.accent }}
            />
            {opt}
          </label>
        ))}
      </div>
      {error && <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '4px' }}>{error}</p>}
    </div>
  )
}

export function Section3Fields({ data, onChange, errors = {} }) {
  return (
    <>
      {/* Patente */}
      <div style={{ marginBottom: '28px' }}>
        <label style={COMPONENT_STYLES.label}>Tipologia patente *</label>
        <MultiCheckbox
          options={PATENTI}
          value={data.patente_tipologie || []}
          onChange={v => onChange('patente_tipologie', v)}
          exclusive="Nessuna"
          columns={3}
          error={errors.patente_tipologie}
        />
      </div>

      {/* Auto */}
      <div style={{ marginBottom: '28px' }}>
        <RadioYesNo
          label="Automunita"
          name="automunita"
          value={data.automunita || ''}
          onChange={v => onChange('automunita', v)}
          required
          error={errors.automunita}
        />
      </div>

      {/* Province lavoro */}
      <div style={{ marginBottom: '28px' }}>
        <label style={COMPONENT_STYLES.label}>Province disponibile a lavorare *</label>
        <p style={{ fontSize: '12px', color: COLORS.textSecondary, marginBottom: '10px' }}>
          Seleziona tutte le province dove sei disponibile a lavorare.
        </p>
        <MultiCheckbox
          options={PROVINCE_OPTIONS}
          value={data.province_lavoro || []}
          onChange={v => onChange('province_lavoro', v)}
          columns={3}
          error={errors.province_lavoro}
        />
      </div>

      {/* Disponibilità */}
      <div className="grid-3-collapse">
        <RadioYesNo
          label="Disponibile trasferte"
          name="disp_trasferte"
          value={data.disponibilita_trasferte || ''}
          onChange={v => onChange('disponibilita_trasferte', v)}
          required
          error={errors.disponibilita_trasferte}
        />
        <RadioYesNo
          label="Disponibile weekend"
          name="disp_weekend"
          value={data.disponibilita_weekend || ''}
          onChange={v => onChange('disponibilita_weekend', v)}
          required
          error={errors.disponibilita_weekend}
        />
        <RadioYesNo
          label="Disponibile serali/notturni"
          name="disp_serali"
          value={data.disponibilita_serali || ''}
          onChange={v => onChange('disponibilita_serali', v)}
          required
          error={errors.disponibilita_serali}
        />
      </div>
    </>
  )
}

export default function Section3({ data, onChange, onNext, onBack, loading }) {
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!data.patente_tipologie?.length)  e.patente_tipologie  = 'Seleziona almeno un\'opzione'
    if (!data.automunita)                 e.automunita          = 'Seleziona un\'opzione'
    if (!data.province_lavoro?.length)    e.province_lavoro     = 'Seleziona almeno una provincia'
    if (!data.disponibilita_trasferte)    e.disponibilita_trasferte = 'Seleziona un\'opzione'
    if (!data.disponibilita_weekend)      e.disponibilita_weekend   = 'Seleziona un\'opzione'
    if (!data.disponibilita_serali)       e.disponibilita_serali    = 'Seleziona un\'opzione'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <SectionShell
      number={3}
      title="Disponibilità Logistica"
      description="Tutti i campi di questa sezione sono obbligatori."
      onBack={onBack}
      onNext={() => { if (validate()) onNext() }}
      loading={loading}
    >
      <Section3Fields data={data} onChange={onChange} errors={errors} />
    </SectionShell>
  )
}
