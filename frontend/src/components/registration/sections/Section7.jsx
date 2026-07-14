// === SEZIONE 7 — FOTO PROFILO ===
// Upload foto profilo via base64 verso GAS.
// Ogni foto viene caricata appena selezionata (prima del submit finale).
import React, { useState } from 'react'
import { COLORS } from '../../../styles/theme'
import FileUpload from '../FileUpload'
import SectionShell from '../SectionShell'
import { talentApi, getErrorMessage } from '../../../api/client'
import { CRITERI_NON_ACCETTAZIONE, FOTO_FIELDS } from '../questionnaireOptions'

export default function Section7({ data, onChange, leadId, email, onNext, onBack, loading: parentLoading }) {
  const [uploadState, setUploadState]   = useState({})
  const [uploadErrors, setUploadErrors] = useState({})
  const [formErrors,   setFormErrors]   = useState({})

  function setUpState(key, state) {
    setUploadState(prev => ({ ...prev, [key]: state }))
  }

  async function handleFile(fieldKey, { base64, filename, mimeType }) {
    setUpState(fieldKey, 'uploading')
    setUploadErrors(prev => ({ ...prev, [fieldKey]: null }))
    try {
      const res = await talentApi.uploadRegistrationDoc(leadId, email, fieldKey, base64, filename, mimeType)
      if (!res.success) {
        setUpState(fieldKey, 'error')
        setUploadErrors(prev => ({ ...prev, [fieldKey]: getErrorMessage(res.error) }))
        return
      }
      const url = res.data?.url
      if (!url) {
        console.error('[Section7] upload ok but no url in response', res)
        setUpState(fieldKey, 'error')
        setUploadErrors(prev => ({ ...prev, [fieldKey]: 'Caricamento completato ma URL non ricevuto.' }))
        return
      }
      setUpState(fieldKey, 'done')
      onChange(`${fieldKey}_url`, url)
    } catch (err) {
      console.error('[Section7] handleFile threw', fieldKey, err)
      setUpState(fieldKey, 'error')
      setUploadErrors(prev => ({ ...prev, [fieldKey]: 'Errore imprevisto durante il caricamento.' }))
    }
  }

  function handleClear(fieldKey) {
    setUpState(fieldKey, undefined)
    onChange(`${fieldKey}_url`, '')
  }

  function validate() {
    const e = {}
    Object.entries(FOTO_FIELDS).forEach(([key, cfg]) => {
      if (cfg.required && !data[`${key}_url`]) {
        e[key] = 'Foto obbligatoria'
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
      number={7}
      title="Foto Profilo"
      description="Carica le tue foto profilo. Vengono salvate in modo sicuro su Google Drive."
      onBack={onBack}
      onNext={() => { if (validate()) onNext() }}
      loading={parentLoading || anyUploading}
      nextLabel="Invia candidatura →"
    >
      {/* Criteri di non accettazione */}
      <div style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '4px',
        padding: '16px 20px',
        marginBottom: '32px',
      }}>
        <p style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500, color: COLORS.textSecondary, marginBottom: '12px' }}>
          Criteri di non accettazione
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {CRITERI_NON_ACCETTAZIONE.map(c => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: COLORS.textSecondary }}>
              <span style={{ color: COLORS.error, fontWeight: 600, flexShrink: 0 }}>✗</span> {c}
            </div>
          ))}
        </div>
      </div>

      {/* Campi upload */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {Object.entries(FOTO_FIELDS).map(([fieldKey, cfg]) => (
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
        ))}
      </div>
    </SectionShell>
  )
}
