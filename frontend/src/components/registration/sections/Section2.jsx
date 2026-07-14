// === SEZIONE 2 — PROFILO FISICO ===
import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../../../styles/theme'
import Input from '../../Input'
import SectionShell from '../SectionShell'
import { ALTEZZE, TAGLIE_SHIRT, TAGLIE_NUM, SCARPE } from '../questionnaireOptions'

function FieldError({ msg }) {
  if (!msg) return null
  return <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '4px' }}>{msg}</p>
}

function RadioGroup({ label, name, value, onChange, required, error }) {
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
      <FieldError msg={error} />
    </div>
  )
}

const SEL_LABELS = { altezza: 'Altezza (cm)', taglia_tshirt: 'Taglia t-shirt / giacca', taglia_pantalone: 'Taglia pantalone IT', taglia_gonna: 'Taglia gonna / abito IT', numero_scarpe: 'Numero scarpe' }
const SEL_OPTIONS = { altezza: ALTEZZE, taglia_tshirt: TAGLIE_SHIRT, taglia_pantalone: TAGLIE_NUM, taglia_gonna: TAGLIE_NUM, numero_scarpe: SCARPE }

export function Section2Fields({ data, onChange, errors = {} }) {
  const isMale = data.genere === 'M'

  function sel(key) {
    return (
      <div>
        <label style={COMPONENT_STYLES.label}>{SEL_LABELS[key]} *</label>
        <select
          value={data[key] || ''}
          onChange={e => onChange(key, e.target.value)}
          style={{ ...COMPONENT_STYLES.input, borderColor: errors[key] ? COLORS.error : COLORS.border }}
        >
          <option value="">— Seleziona —</option>
          {SEL_OPTIONS[key].map(v => <option key={v} value={String(v)}>{v}</option>)}
        </select>
        <FieldError msg={errors[key]} />
      </div>
    )
  }

  return (
    <>
      <div className="form-grid">
        {sel('altezza')}
        {sel('taglia_tshirt')}
        {sel('taglia_pantalone')}
        {!isMale && sel('taglia_gonna')}
        {sel('numero_scarpe')}
        {!isMale && <div />}
      </div>

      <div className="form-grid" style={{ marginTop: '28px', gap: '24px' }}>
        <RadioGroup
          label="Piercing visibili in viso"
          name="piercing_visibili"
          value={data.piercing_visibili || ''}
          onChange={v => onChange('piercing_visibili', v)}
          required
          error={errors.piercing_visibili}
        />

        <div>
          <RadioGroup
            label="Tatuaggi visibili"
            name="tatuaggi_visibili"
            value={data.tatuaggi_visibili || ''}
            onChange={v => {
              onChange('tatuaggi_visibili', v)
              if (v === 'No') onChange('tatuaggi_dove', '')
            }}
            required
            error={errors.tatuaggi_visibili}
          />
          {data.tatuaggi_visibili === 'Sì' && (
            <div style={{ marginTop: '12px' }}>
              <Input
                label="Dove sono visibili? *"
                value={data.tatuaggi_dove || ''}
                onChange={e => onChange('tatuaggi_dove', e.target.value)}
                placeholder="es. avambraccio sinistro, collo..."
                error={errors.tatuaggi_dove}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function Section2({ data, onChange, onNext, onBack, loading }) {
  const [errors, setErrors] = useState({})
  const isMale = data.genere === 'M'

  function validate() {
    const e = {}
    if (!data.altezza)           e.altezza = 'Obbligatorio'
    if (!data.taglia_tshirt)     e.taglia_tshirt = 'Obbligatorio'
    if (!data.taglia_pantalone)  e.taglia_pantalone = 'Obbligatorio'
    if (!isMale && !data.taglia_gonna) e.taglia_gonna = 'Obbligatorio'
    if (!data.numero_scarpe)     e.numero_scarpe = 'Obbligatorio'
    if (!data.piercing_visibili) e.piercing_visibili = 'Seleziona un\'opzione'
    if (!data.tatuaggi_visibili) e.tatuaggi_visibili = 'Seleziona un\'opzione'
    if (data.tatuaggi_visibili === 'Sì' && !data.tatuaggi_dove) e.tatuaggi_dove = 'Specifica dove sono visibili'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <SectionShell
      number={2}
      title="Profilo Fisico"
      description="Tutti i campi di questa sezione sono obbligatori."
      onBack={onBack}
      onNext={() => { if (validate()) onNext() }}
      loading={loading}
    >
      <Section2Fields data={data} onChange={onChange} errors={errors} />
    </SectionShell>
  )
}
