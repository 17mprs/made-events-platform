// === SEZIONE 7 — DATI FISCALI E BANCARI ===
import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../../../styles/theme'
import Input from '../../Input'
import SectionShell from '../SectionShell'

function validateCF(cf) {
  return /^[A-Z0-9]{16}$/i.test(cf.replace(/\s/g, ''))
}

function validatePIVA(piva) {
  return /^\d{11}$/.test(piva.replace(/\s/g, ''))
}

function validateIBAN(iban) {
  const clean = iban.replace(/\s/g, '').toUpperCase()
  return /^IT\d{2}[A-Z0-9]{23}$/.test(clean) // IT + 2 check + 23 chars = 27 totale
}

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

export default function Section7({ data, onChange, onNext, onBack, loading }) {
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    const cf   = (data.codice_fiscale || '').trim()
    const piva = (data.partita_iva || '').trim()
    const iban = (data.iban || '').trim()

    if (!cf)                    e.codice_fiscale = 'Il codice fiscale è obbligatorio'
    else if (!validateCF(cf))   e.codice_fiscale = 'Formato non valido (16 caratteri alfanumerici)'

    if (piva && !validatePIVA(piva)) e.partita_iva = 'Formato non valido (11 cifre)'

    if (!iban)                   e.iban = 'L\'IBAN è obbligatorio'
    else if (!validateIBAN(iban)) e.iban = 'Formato non valido — deve iniziare con IT e avere 27 caratteri'

    if (!data.disponibile_chiamata)  e.disponibile_chiamata  = 'Seleziona un\'opzione'
    if (!data.disponibile_ritenuta)  e.disponibile_ritenuta  = 'Seleziona un\'opzione'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <SectionShell
      number={7}
      title="Dati Fiscali e Bancari"
      description="Necessari per la gestione dei pagamenti. Tutti i dati sono trattati in conformità al GDPR."
      onBack={onBack}
      onNext={() => { if (validate()) onNext() }}
      loading={loading}
    >
      <div className="form-grid">
        <Input
          label="Codice Fiscale *"
          value={data.codice_fiscale || ''}
          onChange={e => onChange('codice_fiscale', e.target.value.toUpperCase())}
          placeholder="RSSMRA80A01H501Z"
          helper="16 caratteri alfanumerici"
          error={errors.codice_fiscale}
          maxLength={16}
        />

        <Input
          label="Partita IVA"
          value={data.partita_iva || ''}
          onChange={e => onChange('partita_iva', e.target.value)}
          placeholder="12345678901"
          helper="11 cifre — opzionale"
          error={errors.partita_iva}
          maxLength={11}
        />

        <div className="form-field-full">
          <Input
            label="IBAN *"
            value={data.iban || ''}
            onChange={e => onChange('iban', e.target.value.toUpperCase())}
            placeholder="IT60 X054 2811 1010 0000 0123 456"
            helper="IT + 25 caratteri (27 totali) — puoi inserirlo con spazi"
            error={errors.iban}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '28px' }}>
        <RadioYesNo
          label="Disponibile contratto a chiamata"
          name="disp_chiamata"
          value={data.disponibile_chiamata || ''}
          onChange={v => onChange('disponibile_chiamata', v)}
          required
          error={errors.disponibile_chiamata}
        />
        <RadioYesNo
          label="Disponibile ritenuta d'acconto"
          name="disp_ritenuta"
          value={data.disponibile_ritenuta || ''}
          onChange={v => onChange('disponibile_ritenuta', v)}
          required
          error={errors.disponibile_ritenuta}
        />
      </div>

      {/* Info box */}
      <div style={{
        marginTop: '24px',
        background: '#FFF8E1',
        border: `1px solid #FFE082`,
        borderRadius: '4px',
        padding: '12px 16px',
        fontSize: '12px',
        color: '#5D4037',
        lineHeight: 1.6,
      }}>
        I tuoi dati fiscali e bancari sono utilizzati esclusivamente per l'emissione di pagamenti relativi
        agli incarichi svolti. Non vengono condivisi con terze parti.
      </div>
    </SectionShell>
  )
}
