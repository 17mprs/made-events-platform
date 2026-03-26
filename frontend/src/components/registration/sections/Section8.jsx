// === SEZIONE 8 — DOCUMENTI E FOTO ===
// Upload file reali verso GAS via base64.
// Ogni file viene caricato appena selezionato (prima del submit finale).
import React, { useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../../../styles/theme'
import FileUpload from '../FileUpload'
import SectionShell from '../SectionShell'
import { talentApi, getErrorMessage } from '../../../api/client'

const CRITERI_NON_ACCETTAZIONE = [
  'Con altre persone',
  'Con filtri / ritocchi',
  'Con loghi / scritte',
  'Con occhiali da sole',
  'Sfocate o scattate da lontano',
  'Con cornici decorative',
  'Bassa risoluzione',
  'Formato stories / screenshot',
]

// Campi file con metadati
const FILE_FIELDS = {
  // DOCUMENTI
  doc_identita:  { label: 'Documento di identità', accept: 'image/jpeg,image/png,application/pdf', maxMB: 5, required: true, group: 'Documenti di identità' },
  doc_cf:        { label: 'Codice fiscale (tessera o documento)', accept: 'image/jpeg,image/png,application/pdf', maxMB: 5, required: true, group: 'Documenti di identità' },
  // FOTO PROFILO
  foto_busto:    { label: 'Foto mezzo busto / primo piano', accept: 'image/jpeg,image/png', maxMB: 5, required: true, group: 'Foto profilo', hint: 'Sfondo neutro, viso frontale, espressione naturale.' },
  foto_intera:   { label: 'Foto figura intera', accept: 'image/jpeg,image/png', maxMB: 5, required: true, group: 'Foto profilo', hint: 'Sfondo neutro, outfit professionale.' },
  foto_extra:    { label: 'Foto aggiuntiva', accept: 'image/jpeg,image/png', maxMB: 5, required: false, group: 'Foto profilo', hint: 'Opzionale.' },
  // CV E ATTESTATI
  cv:            { label: 'Curriculum vitae', accept: 'application/pdf', maxMB: 10, required: true, group: 'CV e attestati', hint: 'Formato PDF, max 10MB.' },
  attestato_haccp:     { label: 'Attestato HACCP', accept: 'application/pdf', maxMB: 10, required: false, group: 'CV e attestati', hint: 'Opzionale.' },
  attestato_sicurezza: { label: 'Attestato Sicurezza sul lavoro', accept: 'application/pdf', maxMB: 10, required: false, group: 'CV e attestati', hint: 'Opzionale.' },
}

const GROUPS = ['Documenti di identità', 'Foto profilo', 'CV e attestati']

export default function Section8({ data, onChange, leadId, email, onNext, onBack, loading: parentLoading }) {
  const [uploadState, setUploadState]   = useState({}) // { [fieldKey]: 'uploading' | 'done' | 'error' }
  const [uploadErrors, setUploadErrors] = useState({})
  const [formErrors,   setFormErrors]   = useState({})

  function setUpState(key, state) {
    setUploadState(prev => ({ ...prev, [key]: state }))
  }

  async function handleFile(fieldKey, { base64, filename, mimeType }) {
    setUpState(fieldKey, 'uploading')
    setUploadErrors(prev => ({ ...prev, [fieldKey]: null }))

    const res = await talentApi.uploadRegistrationDoc(leadId, email, fieldKey, base64, filename, mimeType)
    if (!res.success) {
      setUpState(fieldKey, 'error')
      setUploadErrors(prev => ({ ...prev, [fieldKey]: getErrorMessage(res.error) }))
      return
    }
    setUpState(fieldKey, 'done')
    onChange(`${fieldKey}_url`, res.data.url)
  }

  function handleClear(fieldKey) {
    setUpState(fieldKey, undefined)
    onChange(`${fieldKey}_url`, '')
  }

  function validate() {
    const e = {}
    Object.entries(FILE_FIELDS).forEach(([key, cfg]) => {
      if (cfg.required && !data[`${key}_url`]) {
        e[key] = 'File obbligatorio'
      }
      if (uploadState[key] === 'uploading') {
        e[key] = 'Attendi il completamento del caricamento'
      }
    })
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const anyUploading = Object.values(uploadState).some(s => s === 'uploading')

  return (
    <SectionShell
      number={8}
      title="Documenti e Foto"
      description="Carica i documenti richiesti. I file vengono salvati in modo sicuro su Google Drive."
      onBack={onBack}
      onNext={() => { if (validate()) onNext() }}
      loading={parentLoading || anyUploading}
      nextLabel="Invia profilo"
    >
      {/* Criteri non accettazione foto */}
      <div style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '4px',
        padding: '16px 20px',
        marginBottom: '32px',
      }}>
        <p style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: COLORS.textSecondary, marginBottom: '12px' }}>
          Criteri di non accettazione per le foto
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {CRITERI_NON_ACCETTAZIONE.map(c => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: COLORS.textSecondary }}>
              <span style={{ color: COLORS.error, fontWeight: 600, flexShrink: 0 }}>✗</span> {c}
            </div>
          ))}
        </div>
      </div>

      {/* Gruppi file */}
      {GROUPS.map(group => (
        <div key={group} style={{ marginBottom: '36px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.textSecondary, fontWeight: 500, marginBottom: '16px', paddingBottom: '8px', borderBottom: `1px solid ${COLORS.border}` }}>
            {group}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(FILE_FIELDS)
              .filter(([, cfg]) => cfg.group === group)
              .map(([fieldKey, cfg]) => (
                <div key={fieldKey}>
                  <FileUpload
                    label={cfg.label}
                    accept={cfg.accept}
                    maxMB={cfg.maxMB}
                    required={cfg.required}
                    uploaded={uploadState[fieldKey] === 'done' || !!data[`${fieldKey}_url`]}
                    uploadedUrl={data[`${fieldKey}_url`]}
                    onFile={(fileData) => handleFile(fieldKey, fileData)}
                    onClear={() => handleClear(fieldKey)}
                    error={uploadErrors[fieldKey] || formErrors[fieldKey]}
                    hint={cfg.hint}
                  />
                  {uploadState[fieldKey] === 'uploading' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '1.5px' }} />
                      <span style={{ fontSize: '12px', color: COLORS.textSecondary }}>Caricamento in corso…</span>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      ))}
    </SectionShell>
  )
}
