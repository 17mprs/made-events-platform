// === SEZIONE 5 — PROFILO PROFESSIONALE ===
import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../../../styles/theme'
import Input from '../../Input'
import SectionShell from '../SectionShell'
import MultiCheckbox from '../MultiCheckbox'
import { TITOLI_STUDIO, PROFESSIONI, TIPOLOGIE_ESPERIENZA, ANNI_ESPERIENZA } from '../questionnaireOptions'

export function Section5Fields({ data, onChange, errors = {} }) {
  const [altroProfessione, setAltroProfessione] = useState(
    (data.professione_attuale || []).find(v => !PROFESSIONI.slice(0, -1).includes(v) && v !== 'Altro') || ''
  )

  function isCustom(v) {
    return !PROFESSIONI.includes(v)
  }

  function handleProfessioneChange(values) {
    // Se "Altro" viene rimosso, pulisce il testo libero
    if (!values.includes('Altro')) setAltroProfessione('')
    onChange('professione_attuale', values)
  }

  function handleAltroBlur() {
    if (altroProfessione && (data.professione_attuale || []).includes('Altro')) {
      // Sostituisce "Altro" con il testo libero nell'array salvato
      const without = (data.professione_attuale || []).filter(v => v !== 'Altro' && !isCustom(v))
      onChange('professione_attuale', [...without, altroProfessione])
    }
  }

  return (
    <>
      {/* Titolo di studio */}
      <div style={{ marginBottom: '28px' }}>
        <div className="form-grid">
          <div>
            <label style={{ ...COMPONENT_STYLES.label, color: errors.titolo_studio ? COLORS.error : COLORS.textSecondary }}>
              Titolo di studio *
            </label>
            <select
              value={data.titolo_studio || ''}
              onChange={e => onChange('titolo_studio', e.target.value)}
              style={{ ...COMPONENT_STYLES.input, borderColor: errors.titolo_studio ? COLORS.error : COLORS.border }}
            >
              <option value="">— Seleziona —</option>
              {TITOLI_STUDIO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.titolo_studio && <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '4px' }}>{errors.titolo_studio}</p>}
          </div>

          <Input
            label="Indirizzo / Specializzazione"
            value={data.titolo_studio_indirizzo || ''}
            onChange={e => onChange('titolo_studio_indirizzo', e.target.value)}
            placeholder="es. Scienze della comunicazione, Liceo scientifico..."
            helper="Opzionale"
          />
        </div>
      </div>

      {/* Professione attuale */}
      <div style={{ marginBottom: '28px' }}>
        <label style={COMPONENT_STYLES.label}>Professione attuale *</label>
        {errors.professione_attuale && (
          <p style={{ fontSize: '12px', color: COLORS.error, marginBottom: '8px' }}>{errors.professione_attuale}</p>
        )}
        <MultiCheckbox
          options={PROFESSIONI}
          value={(data.professione_attuale || []).map(v => isCustom(v) ? 'Altro' : v)}
          onChange={handleProfessioneChange}
          columns={3}
        />
        {(data.professione_attuale || []).includes('Altro') && (
          <div style={{ marginTop: '12px', maxWidth: '320px' }}>
            <Input
              label="Specifica"
              value={altroProfessione}
              onChange={e => setAltroProfessione(e.target.value)}
              onBlur={handleAltroBlur}
              placeholder="Descrivi la tua professione..."
            />
          </div>
        )}
      </div>

      {/* Tipologie esperienza */}
      <div style={{ marginBottom: '28px' }}>
        <label style={COMPONENT_STYLES.label}>Tipologie di esperienza nel settore</label>
        <p style={{ fontSize: '12px', color: COLORS.textSecondary, marginBottom: '10px' }}>
          Seleziona tutte quelle in cui hai esperienza (non obbligatorio, ma migliora il tuo punteggio).
        </p>
        <MultiCheckbox
          options={TIPOLOGIE_ESPERIENZA}
          value={data.tipologie_esperienza || []}
          onChange={v => onChange('tipologie_esperienza', v)}
          columns={3}
        />
      </div>

      {/* Anni esperienza */}
      <div style={{ maxWidth: '280px' }}>
        <label style={{ ...COMPONENT_STYLES.label, color: errors.anni_esperienza_settore ? COLORS.error : COLORS.textSecondary }}>
          Anni di esperienza nel settore eventi *
        </label>
        <select
          value={data.anni_esperienza_settore || ''}
          onChange={e => onChange('anni_esperienza_settore', e.target.value)}
          style={{ ...COMPONENT_STYLES.input, borderColor: errors.anni_esperienza_settore ? COLORS.error : COLORS.border }}
        >
          <option value="">— Seleziona —</option>
          {ANNI_ESPERIENZA.map(a => <option key={a} value={a}>{a} anni</option>)}
        </select>
        {errors.anni_esperienza_settore && (
          <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '4px' }}>{errors.anni_esperienza_settore}</p>
        )}
      </div>
    </>
  )
}

export default function Section5({ data, onChange, onNext, onBack, loading }) {
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!data.titolo_studio)               e.titolo_studio = 'Seleziona il titolo di studio'
    if (!data.professione_attuale?.length) e.professione_attuale = 'Seleziona almeno un\'opzione'
    if (!data.anni_esperienza_settore)     e.anni_esperienza_settore = 'Seleziona gli anni di esperienza'
    // Tipologie non obbligatorie
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <SectionShell
      number={5}
      title="Profilo Professionale"
      description="Formazione, occupazione attuale e tipologie di esperienza nel settore eventi."
      onBack={onBack}
      onNext={() => { if (validate()) onNext() }}
      loading={loading}
    >
      <Section5Fields data={data} onChange={onChange} errors={errors} />
    </SectionShell>
  )
}
