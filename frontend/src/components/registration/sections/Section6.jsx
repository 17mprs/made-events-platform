// === SEZIONE 6 — DOTAZIONE PERSONALE ===
import React from 'react'
import SectionShell from '../SectionShell'
import MultiCheckbox from '../MultiCheckbox'
import { COLORS, COMPONENT_STYLES } from '../../../styles/theme'

const DOTAZIONE_OPTIONS = [
  'Tailleur pantalone e giacca nero',
  'Camicia bianca classica',
  'Camicia nera classica',
  'Décolleté nere con tacco',
  'Scarpe eleganti nere basse (mocassino / ballerina / stringata)',
  'Tubino nero',
  'Sneaker bianche',
]

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
    </SectionShell>
  )
}
