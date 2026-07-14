// === SEZIONE 1 — DATI PERSONALI ===
import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../../../styles/theme'
import Input from '../../Input'
import SectionShell from '../SectionShell'
import { PROVINCE_ALFA } from '../data/province'
import CittaProvinciaSelect from '../../shared/CittaProvinciaSelect'

// Campi della sezione, esportati a parte così l'area riservata (UserPortal.jsx)
// può renderli identici, senza la cornice/navigazione del wizard.
export function Section1Fields({ data, onChange, errors = {} }) {
  return (
    <>
      {/* Genere */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 500, marginBottom: '16px' }}>
          Sei un uomo o una donna? *
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          {[{ label: 'Donna', value: 'F' }, { label: 'Uomo', value: 'M' }].map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: COLORS.text }}>
              <input
                type="radio"
                name="genere"
                value={opt.value}
                checked={data.genere === opt.value}
                onChange={() => onChange('genere', opt.value)}
                style={{ accentColor: COLORS.accent }}
              />
              {opt.label}
            </label>
          ))}
        </div>
        {errors.genere && <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '6px' }}>{errors.genere}</p>}
      </div>

      {/* Luogo di nascita */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 500, marginBottom: '16px' }}>
          Luogo di nascita
        </div>
        <CittaProvinciaSelect
          citta={data.nascita_citta || ''}
          provincia={data.nascita_provincia || ''}
          onChange={({ citta, provincia }) => {
            onChange('nascita_citta', citta)
            onChange('nascita_provincia', provincia)
          }}
        />
      </div>

      {/* Residenza */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 500, marginBottom: '16px' }}>
          Città di residenza
        </div>
        <CittaProvinciaSelect
          citta={data.residenza_citta || ''}
          provincia={data.residenza_provincia || ''}
          onChange={({ citta, provincia }) => {
            onChange('residenza_citta', citta)
            onChange('residenza_provincia', provincia)
          }}
          required
        />
        {errors.residenza_citta && <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '6px' }}>{errors.residenza_citta}</p>}
        {errors.residenza_provincia && <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '4px' }}>{errors.residenza_provincia}</p>}
      </div>

      {/* Domicilio */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 500, marginBottom: '16px' }}>
          Città di domicilio
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '16px' }}>
          <input
            type="checkbox"
            checked={!!data.domicilio_coincide}
            onChange={e => onChange('domicilio_coincide', e.target.checked)}
            style={{ accentColor: COLORS.accent }}
          />
          <span style={{ fontSize: '13px', color: COLORS.text }}>Coincide con la residenza</span>
        </label>

        {!data.domicilio_coincide && (
          <div style={{ maxWidth: '320px' }}>
            <label style={COMPONENT_STYLES.label}>Provincia di domicilio *</label>
            <select
              value={data.domicilio_provincia || ''}
              onChange={e => onChange('domicilio_provincia', e.target.value)}
              style={{ ...COMPONENT_STYLES.input, borderColor: errors.domicilio_provincia ? COLORS.error : COLORS.border }}
            >
              <option value="">— Seleziona —</option>
              {PROVINCE_ALFA.map(p => (
                <option key={p.sigla} value={p.sigla}>{p.nome} ({p.sigla})</option>
              ))}
            </select>
            {errors.domicilio_provincia && <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '4px' }}>{errors.domicilio_provincia}</p>}
          </div>
        )}
      </div>

      {/* Social */}
      <div>
        <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 500, marginBottom: '16px' }}>
          Profili Social (opzionali)
        </div>
        <div className="form-grid">
          <Input
            label="Instagram"
            value={data.instagram || ''}
            onChange={e => onChange('instagram', e.target.value)}
            placeholder="@tuo_profilo"
            helper="Solo username, senza @"
          />
          <Input
            label="Facebook"
            value={data.facebook || ''}
            onChange={e => onChange('facebook', e.target.value)}
            placeholder="Nome profilo o URL"
          />
        </div>
      </div>
    </>
  )
}

export default function Section1({ data, onChange, onNext, loading }) {
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!data.genere) e.genere = 'Seleziona un\'opzione'
    // Luogo di nascita
    if (!data.nascita_citta) e.nascita_citta = 'Campo obbligatorio'
    if (!data.nascita_provincia) e.nascita_provincia = 'Seleziona la provincia'
    // Residenza
    if (!data.residenza_citta || data.residenza_citta.trim().length < 2) e.residenza_citta = 'Campo obbligatorio'
    if (!data.residenza_provincia) e.residenza_provincia = 'Seleziona la provincia'
    // Domicilio
    if (!data.domicilio_coincide && !data.domicilio_provincia) e.domicilio_provincia = 'Seleziona la provincia'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (validate()) onNext()
  }

  return (
    <SectionShell
      number={1}
      title="Dati Personali"
      description="Luogo di nascita, residenza, domicilio e profili social."
      onNext={handleNext}
      loading={loading}
    >
      <Section1Fields data={data} onChange={onChange} errors={errors} />
    </SectionShell>
  )
}
