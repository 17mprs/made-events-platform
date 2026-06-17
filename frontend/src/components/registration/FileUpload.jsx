// === FILE UPLOAD — MADE EVENTS ===
// Componente upload file singolo con:
//   - validazione tipo MIME e dimensione
//   - lettura come base64 per invio a GAS
//   - preview nome file + stato (idle | ready | uploaded | error)
//
// Props:
//   label: string
//   accept: string  (es. "image/jpeg,image/png,application/pdf")
//   maxMB: number
//   required?: boolean
//   uploaded?: boolean   — true se già caricato (mostra checkmark)
//   uploadedUrl?: string — URL del file già caricato
//   onFile: ({ file, base64, filename, mimeType }) => void
//   onClear: () => void
//   error?: string
//   hint?: string
import React, { useRef, useState } from 'react'
import { COLORS, COMPONENT_STYLES } from '../../styles/theme'

export default function FileUpload({
  label,
  accept,
  maxMB = 5,
  required,
  uploaded,
  uploadedUrl,
  onFile,
  onClear,
  error,
  hint,
}) {
  const inputRef   = useRef(null)
  const [localErr, setLocalErr] = useState(null)
  const [fileName, setFileName] = useState(null)

  const displayError = error || localErr

  function handleChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLocalErr(null)

    // Validazione dimensione
    if (file.size > maxMB * 1024 * 1024) {
      setLocalErr(`Il file supera il limite di ${maxMB}MB`)
      e.target.value = ''
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      // Rimuove il prefisso "data:[mime];base64,"
      const base64 = ev.target.result.split(',')[1]
      onFile({ file, base64, filename: file.name, mimeType: file.type })
    }
    reader.onerror = () => {
      setLocalErr('Impossibile leggere il file. Riprova.')
      setFileName(null)
      if (inputRef.current) inputRef.current.value = ''
    }
    reader.readAsDataURL(file)
  }

  function handleClear(e) {
    e.stopPropagation()
    setFileName(null)
    setLocalErr(null)
    if (inputRef.current) inputRef.current.value = ''
    onClear?.()
  }

  const isReady    = !!fileName && !displayError
  const isUploaded = uploaded && !fileName

  return (
    <div>
      <label style={COMPONENT_STYLES.label}>
        {label}{required && ' *'}
      </label>

      {hint && (
        <p style={{ fontSize: '12px', color: COLORS.textSecondary, marginBottom: '8px', lineHeight: 1.5 }}>
          {hint}
        </p>
      )}

      {/* Drop zone / click area */}
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1px dashed ${displayError ? COLORS.error : isUploaded || isReady ? COLORS.accent : COLORS.border}`,
          borderRadius: '4px',
          padding: '16px 20px',
          cursor: 'pointer',
          background: isUploaded ? COLORS.accentLight : isReady ? '#F8FCF8' : '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          transition: 'border-color 0.2s, background 0.2s',
        }}
      >
        {/* Icona stato */}
        <span style={{ fontSize: '20px', flexShrink: 0 }}>
          {isUploaded ? '✓' : isReady ? '📄' : '⬆'}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {isUploaded ? (
            <span style={{ fontSize: '13px', color: COLORS.accent, fontWeight: 500 }}>
              File caricato
              {uploadedUrl && (
                <a
                  href={uploadedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ marginLeft: '8px', fontSize: '12px', color: COLORS.textSecondary }}
                >
                  (visualizza)
                </a>
              )}
            </span>
          ) : isReady ? (
            <span style={{ fontSize: '13px', color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
              {fileName}
            </span>
          ) : (
            <span style={{ fontSize: '13px', color: COLORS.textSecondary }}>
              Clicca per selezionare — max {maxMB}MB
            </span>
          )}
          <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>
            {accept?.replace(/application\//g, '').replace(/image\//g, '').toUpperCase().replace(/,/g, ', ')}
          </span>
        </div>

        {(isReady || isUploaded) && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: COLORS.textSecondary, fontSize: '16px', padding: '2px',
              flexShrink: 0,
            }}
            title="Rimuovi"
          >
            ✕
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {displayError && (
        <p style={{ fontSize: '12px', color: COLORS.error, marginTop: '4px' }}>{displayError}</p>
      )}
    </div>
  )
}
