// === SEZIONE 4 — LINGUE ===
import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../../../styles/theme'
import Input from '../../Input'
import SectionShell from '../SectionShell'
import { LIVELLI_INGLESE, LIVELLI_ALTRA } from '../questionnaireOptions'

function LinguaSelect({ label, fieldKey, value, onChange, options, required, error }) {
  return (
    <div>
      <label style={COMPONENT_STYLES.label}>{label}{required && ' *'}</label>
      <select
        value={value || ''}
        onChange={e => onChange(fieldKey, e.target.value)}
        style={{ ...COMPONENT_STYLES.input, borderColor: error ? COLORS.error : COLORS.border }}
      >
        <option value="">— Seleziona livello —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '4px' }}>{error}</p>}
    </div>
  )
}

export function Section4Fields({ data, onChange, errors = {} }) {
  const altreLingue = data.altre_lingue || []

  function updateAltra(index, field, value) {
    const updated = altreLingue.map((l, i) => i === index ? { ...l, [field]: value } : l)
    onChange('altre_lingue', updated)
  }

  function addAltra() {
    onChange('altre_lingue', [...altreLingue, { nome: '', livello: '' }])
  }

  function removeAltra(index) {
    onChange('altre_lingue', altreLingue.filter((_, i) => i !== index))
  }

  return (
    <>
      {/* Lingue principali */}
      <div className="form-grid" style={{ marginBottom: data.lingua_inglese ? '8px' : '28px' }}>
        <LinguaSelect
          label="Inglese"
          fieldKey="lingua_inglese"
          value={data.lingua_inglese}
          onChange={onChange}
          options={LIVELLI_INGLESE}
          required
          error={errors.lingua_inglese}
        />
        <LinguaSelect
          label="Francese"
          fieldKey="lingua_francese"
          value={data.lingua_francese}
          onChange={onChange}
          options={LIVELLI_ALTRA}
        />
        <LinguaSelect
          label="Spagnolo"
          fieldKey="lingua_spagnolo"
          value={data.lingua_spagnolo}
          onChange={onChange}
          options={LIVELLI_ALTRA}
        />
        <LinguaSelect
          label="Tedesco"
          fieldKey="lingua_tedesco"
          value={data.lingua_tedesco}
          onChange={onChange}
          options={LIVELLI_ALTRA}
        />
      </div>

      {/* Certificazione inglese */}
      {data.lingua_inglese && (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: '28px',
          fontSize: 13, color: COLORS.textSecondary, cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={data.inglese_certificato || false}
            onChange={e => onChange('inglese_certificato', e.target.checked)}
            style={{ accentColor: COLORS.accent }}
          />
          Ho una certificazione linguistica (C1/C2)
        </label>
      )}

      {/* Altre lingue */}
      <div>
        <label style={COMPONENT_STYLES.label}>Altre lingue (opzionale)</label>
        {altreLingue.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label={i === 0 ? 'Nome lingua' : undefined}
                value={l.nome}
                onChange={e => updateAltra(i, 'nome', e.target.value)}
                placeholder="es. Russo, Arabo, Cinese..."
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...COMPONENT_STYLES.label, visibility: i === 0 ? 'visible' : 'hidden' }}>Livello</label>
              <select
                value={l.livello || ''}
                onChange={e => updateAltra(i, 'livello', e.target.value)}
                style={{
                  ...COMPONENT_STYLES.input,
                  borderColor: errors[`altra_lingue_${i}`] ? COLORS.error : COLORS.border,
                }}
              >
                <option value="">— Livello —</option>
                {LIVELLI_ALTRA.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {errors[`altra_lingue_${i}`] && (
                <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '4px' }}>{errors[`altra_lingue_${i}`]}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeAltra(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textSecondary, fontSize: '18px', paddingBottom: '14px', flexShrink: 0 }}
              title="Rimuovi"
            >
              ✕
            </button>
          </div>
        ))}
        {altreLingue.length < 4 && (
          <button
            type="button"
            onClick={addAltra}
            style={{
              background: 'none', border: `1px dashed ${COLORS.border}`, borderRadius: '4px',
              cursor: 'pointer', color: COLORS.accent, fontSize: '13px', padding: '10px 16px',
              fontFamily: 'inherit', letterSpacing: '0.5px',
            }}
          >
            + Aggiungi lingua
          </button>
        )}
      </div>
    </>
  )
}

export default function Section4({ data, onChange, onNext, onBack, loading }) {
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!data.lingua_inglese) e.lingua_inglese = 'Il livello di inglese è obbligatorio'
    const altre = data.altre_lingue || []
    altre.forEach((l, i) => {
      if (l.nome && !l.livello) e[`altra_lingue_${i}`] = 'Seleziona il livello'
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <SectionShell
      number={4}
      title="Lingue"
      description="Indica il tuo livello per ogni lingua. L'inglese è obbligatorio."
      onBack={onBack}
      onNext={() => { if (validate()) onNext() }}
      loading={loading}
    >
      <Section4Fields data={data} onChange={onChange} errors={errors} />
    </SectionShell>
  )
}
