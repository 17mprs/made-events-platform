// === SEZIONE 6 — DOTAZIONE PERSONALE ===
import React from 'react'
import SectionShell from '../SectionShell'
import MultiCheckbox from '../MultiCheckbox'
import { COLORS, COMPONENT_STYLES } from '../../../styles/theme'
import { DOTAZIONE_OPTIONS } from '../questionnaireOptions'

export function Section6Fields({ data, onChange }) {
  return (
    <div>
      <label style={COMPONENT_STYLES.label}>Abbigliamento disponibile (opzionale)</label>
      <p style={{ fontSize: '12px', color: COLORS.textSecondary, marginBottom: '16px', lineHeight: 1.6 }}>
        Avere questi capi può aumentare le possibilità di selezione per eventi che richiedono un determinato dress code.
      </p>
      <MultiCheckbox
        options={DOTAZIONE_OPTIONS}
        value={data.dotazione_personale || []}
        onChange={v => onChange('dotazione_personale', v)}
        columns={2}
      />
    </div>
  )
}

export default function Section6({ data, onChange, onNext, onBack, loading, nextLabel }) {
  return (
    <SectionShell
      number={6}
      title="Dotazione Personale"
      description="Indica gli indumenti che possiedi. Nessuna selezione è obbligatoria."
      onBack={onBack}
      onNext={onNext}
      loading={loading}
      nextLabel={nextLabel}
    >
      <Section6Fields data={data} onChange={onChange} />
    </SectionShell>
  )
}
