// === TALENT PAGE — MADE EVENTS Platform ===
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { talentApi, leadApi, applicationApi, contractApi, emailApi, getErrorMessage } from '../../api/client'
import adminStore from '../../store/adminStore'
import Layout from '../../components/Layout'
import { COLORS } from '../../styles/theme'
import {
  ADMIN_SIDEBAR, PageHeader,
  TalentAvatar, LeadBadge, ScoreBar,
  FILTER_INPUT, PAGE_SIZE, Pagination,
  driveThumbUrl, safeArray,
  DeleteEntityButton, showToast,
} from './shared'
import { TAGLIE_SHIRT, TIPOLOGIE_ESPERIENZA, LINGUE_FISSE, DISPONIBILITA_TIPI } from '../../components/registration/questionnaireOptions'

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function isDriveUrl(url) {
  return typeof url === 'string' && (url.includes('drive.google.com') || url.includes('docs.google.com'))
}

/** Cerca la foto profilo in più campi in ordine di priorità. */
function getFotoUrl(data) {
  return data?.foto_busto_url || data?.documenti?.foto?.url || data?.foto_url || null
}

// ---------------------------------------------------------------------------
// PHOTO EXPIRY HELPER
// ---------------------------------------------------------------------------

function photoExpiryStatus(talent) {
  const d = talent.data ?? {}
  const raw = d.data_caricamento_foto || d.foto_caricata_il || d.foto_updated_at || talent.updated_at
  if (!raw) return { status: 'unknown', label: null, color: null }
  const uploadDate = new Date(raw)
  if (isNaN(uploadDate)) return { status: 'unknown', label: null, color: null }
  const expiry = new Date(uploadDate)
  expiry.setMonth(expiry.getMonth() + 6)
  const now = new Date()
  const msLeft = expiry - now
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
  const twoMonthsMs = 60 * 24 * 60 * 60 * 1000
  if (msLeft < 0) return { status: 'expired',  label: `Scadute il ${expiry.toLocaleDateString('it-IT')}`,              color: '#EF4444', days: daysLeft }
  if (msLeft < twoMonthsMs) return { status: 'expiring', label: `Scade tra ${daysLeft} giorni (${expiry.toLocaleDateString('it-IT')})`, color: '#F97316', days: daysLeft }
  return { status: 'ok', label: `Valide fino al ${expiry.toLocaleDateString('it-IT')}`, color: '#10B981', days: daysLeft }
}

// ---------------------------------------------------------------------------
// REVIEW DRAWER — scheda completa revisione per COMPLETED_PENDING_APPROVAL
// ---------------------------------------------------------------------------

function ReviewDrawer({ lead, onClose, onApprove, onReject, onDeleted, actionLoading }) {
  const d = lead.data ?? {}
  const nome = `${d.nome ?? ''} ${d.cognome ?? ''}`.trim() || '—'

  const [nota,              setNota]             = useState('')
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  const [lightboxUrl,       setLightboxUrl]       = useState(null)
  const [showEmailModal,    setShowEmailModal]     = useState(false)
  const [showSocialModal,   setShowSocialModal]    = useState(false)
  const [emailBody,         setEmailBody]          = useState(
    `Ciao ${d.nome || ''},\n\nIl team MADE EVENTS ha esaminato il tuo profilo.\n\nPer ulteriori informazioni non esitare a contattarci.\n\nIl team MADE EVENTS`
  )
  const [emailSending,      setEmailSending]       = useState(false)
  const [emailResult,       setEmailResult]        = useState(null) // null | 'sent' | 'error'
  const [socialText,        setSocialText]         = useState(
    `Ciao ${d.nome || ''}, seguici su Instagram @madeevents e Facebook Made Events per restare aggiornata sulle opportunità di lavoro!`
  )
  const [socialSending,     setSocialSending]      = useState(false)
  const [socialResult,      setSocialResult]       = useState(null)
  const [copied,            setCopied]             = useState(false)
  const [openSections,      setOpenSections]       = useState({ dati: true, fisico: false, disp: false, lingue: false, exp: false, dot: false })

  const toggleSection = (k) => setOpenSections(prev => ({ ...prev, [k]: !prev[k] }))

  const photos = [
    { key: 'foto_busto',  label: 'Mezzo busto',   url: d.foto_busto_url || d.documenti?.foto?.url || d.foto_url },
    { key: 'foto_intera', label: 'Figura intera',  url: d.foto_intera_url },
    { key: 'foto_extra',  label: 'Aggiuntiva',     url: d.foto_extra_url  },
  ].filter(p => p.url)

  const accSection = (k, label, children) => (
    <div key={k} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <button
        onClick={() => toggleSection(k)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 0', fontFamily: 'Montserrat, sans-serif',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.textSecondary }}>
          {label}
        </span>
        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{openSections[k] ? '▲' : '▼'}</span>
      </button>
      {openSections[k] && <div style={{ paddingBottom: 16 }}>{children}</div>}
    </div>
  )

  const field = (label, value) => value ? (
    <div key={label} style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.textSecondary, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: COLORS.text }}>{value}</div>
    </div>
  ) : null

  const grid = (items) => (
    <div className="grid-2-collapse" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
      {items}
    </div>
  )

  const handleSendEmail = async () => {
    setEmailSending(true)
    setEmailResult(null)
    const res = await emailApi.sendCustom(d.email, d.nome || '', emailBody, 'custom')
    setEmailSending(false)
    if (res.success) {
      setEmailResult('sent')
      setTimeout(() => { setEmailResult(null); setShowEmailModal(false) }, 2000)
    } else {
      setEmailResult('error')
    }
  }

  const handleSendSocial = async () => {
    setSocialSending(true)
    setSocialResult(null)
    const res = await emailApi.sendCustom(d.email, d.nome || '', socialText, 'social')
    setSocialSending(false)
    if (res.success) {
      setSocialResult('sent')
      setTimeout(() => { setSocialResult(null); setShowSocialModal(false) }, 2000)
    } else {
      setSocialResult('error')
    }
  }

  return (
    <>
      {/* Lightbox — only for non-Drive URLs */}
      {lightboxUrl && !isDriveUrl(lightboxUrl) && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <img src={lightboxUrl} alt="foto" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxUrl(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <>
          <div onClick={() => { if (!emailSending) setShowEmailModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 650 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: '#fff', borderRadius: 8, padding: 28, width: 480, maxWidth: '90vw', zIndex: 651,
            fontFamily: 'Montserrat, sans-serif', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: COLORS.text }}>Invia email a {d.nome}</h3>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 10 }}>A: <strong>{d.email}</strong></div>
            <textarea
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              disabled={emailSending}
              rows={7}
              style={{ width: '100%', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: 'Montserrat, sans-serif', resize: 'vertical', boxSizing: 'border-box', color: COLORS.text, opacity: emailSending ? 0.7 : 1 }}
            />
            {emailResult === 'sent' && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#E8F5E9', borderRadius: 6, fontSize: 12, color: '#2E7D32', fontWeight: 600 }}>
                ✓ Email inviata con successo
              </div>
            )}
            {emailResult === 'error' && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#FFEBEE', borderRadius: 6, fontSize: 12, color: '#C62828' }}>
                Errore nell'invio. Usa il client email come alternativa.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                onClick={() => window.open(`mailto:${d.email}?subject=MADE EVENTS&body=${encodeURIComponent(emailBody)}`)}
                style={{ padding: '7px 12px', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'Montserrat, sans-serif', color: COLORS.textSecondary }}
              >
                Apri client email
              </button>
              <button onClick={() => { if (!emailSending) setShowEmailModal(false) }} style={{ padding: '7px 14px', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'Montserrat, sans-serif', color: COLORS.text }}>
                Annulla
              </button>
              <button
                onClick={handleSendEmail}
                disabled={emailSending || !emailBody.trim()}
                style={{ padding: '8px 20px', background: emailSending ? '#ccc' : COLORS.accent, color: '#fff', border: 'none', borderRadius: 6, cursor: emailSending ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Montserrat, sans-serif' }}
              >
                {emailSending ? 'Invio…' : 'Invia →'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Social Modal */}
      {showSocialModal && (
        <>
          <div onClick={() => { if (!socialSending) setShowSocialModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 650 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: '#fff', borderRadius: 8, padding: 28, width: 440, maxWidth: '90vw', zIndex: 651,
            fontFamily: 'Montserrat, sans-serif', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: COLORS.text }}>Invita sui social</h3>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 }}>A: <strong>{d.email}</strong></div>
            <textarea
              value={socialText}
              onChange={e => setSocialText(e.target.value)}
              disabled={socialSending}
              rows={4}
              style={{ width: '100%', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '10px 12px', fontSize: 13, fontFamily: 'Montserrat, sans-serif', resize: 'vertical', boxSizing: 'border-box', color: COLORS.text, lineHeight: 1.6, marginBottom: 12 }}
            />
            {socialResult === 'sent' && (
              <div style={{ marginBottom: 10, padding: '8px 12px', background: '#E8F5E9', borderRadius: 6, fontSize: 12, color: '#2E7D32', fontWeight: 600 }}>
                ✓ Messaggio inviato via email
              </div>
            )}
            {socialResult === 'error' && (
              <div style={{ marginBottom: 10, padding: '8px 12px', background: '#FFEBEE', borderRadius: 6, fontSize: 12, color: '#C62828' }}>
                Errore nell'invio email.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => { navigator.clipboard?.writeText(socialText); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                style={{ flex: 1, padding: '9px 0', background: copied ? '#10B981' : 'none', color: copied ? '#fff' : COLORS.text, border: `1px solid ${copied ? '#10B981' : COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'Montserrat, sans-serif', fontWeight: 600, transition: 'all 0.2s' }}
              >
                {copied ? '✓ Copiato' : 'Copia'}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(socialText)}`}
                target="_blank" rel="noreferrer"
                style={{ flex: 1, padding: '9px 0', background: '#25D366', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                WhatsApp
              </a>
              <button
                onClick={handleSendSocial}
                disabled={socialSending}
                style={{ flex: 1, padding: '9px 0', background: socialSending ? '#ccc' : COLORS.accent, color: '#fff', border: 'none', borderRadius: 6, cursor: socialSending ? 'wait' : 'pointer', fontSize: 12, fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
              >
                {socialSending ? 'Invio…' : 'Invia email'}
              </button>
            </div>
            <button onClick={() => { if (!socialSending) setShowSocialModal(false) }} style={{ width: '100%', marginTop: 10, padding: '8px 0', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'Montserrat, sans-serif', color: COLORS.textSecondary }}>
              Chiudi
            </button>
          </div>
        </>
      )}

      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500 }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 620, maxWidth: '96vw',
        background: '#fff', borderLeft: `1px solid ${COLORS.border}`,
        zIndex: 501, display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat, sans-serif',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.text }}>{nome}</h2>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 3 }}>{d.email}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666', padding: '4px 8px', lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <LeadBadge status={lead.status} />
            <div style={{ flex: 1, maxWidth: 200 }}><ScoreBar score={d.score} /></div>
            {d.ranking && <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>Rank {d.ranking}</span>}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* FOTO */}
          {photos.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.textSecondary, marginBottom: 12 }}>Foto</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {photos.map(p => (
                  <div key={p.key} style={{ textAlign: 'center' }}>
                    {isDriveUrl(p.url) ? (
                      <div style={{ position: 'relative', width: 140, height: 180 }}>
                        <img
                          src={driveThumbUrl(p.url, 300)}
                          alt={p.label}
                          style={{ width: 140, height: 180, objectFit: 'cover', borderRadius: 6, border: `1px solid ${COLORS.border}`, display: 'block' }}
                        />
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            position: 'absolute', bottom: 4, left: 4, right: 4, textAlign: 'center',
                            fontSize: 10, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.55)',
                            borderRadius: 4, padding: '2px 0', textDecoration: 'none',
                          }}
                        >
                          Apri foto →
                        </a>
                      </div>
                    ) : (
                      <img
                        src={p.url}
                        alt={p.label}
                        onClick={() => setLightboxUrl(p.url)}
                        style={{ width: 140, height: 180, objectFit: 'cover', borderRadius: 6, border: `1px solid ${COLORS.border}`, cursor: 'zoom-in', display: 'block' }}
                      />
                    )}
                    <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>{p.label}</div>
                  </div>
                ))}
                {photos.length === 0 && (
                  <div style={{ fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic' }}>Foto non caricate</div>
                )}
              </div>
            </div>
          )}

          {/* DATI QUESTIONARIO — accordion */}
          <div style={{ marginBottom: 20 }}>
            {accSection('dati', 'Dati Personali', grid([
              field('Genere', d.genere === 'F' ? 'Donna' : d.genere === 'M' ? 'Uomo' : d.genere),
              field('Data nascita', d.data_nascita),
              field('Città nascita', d.nascita_citta ? `${d.nascita_citta}${d.nascita_provincia ? ' ('+d.nascita_provincia+')' : ''}` : null),
              field('Nazionalità', d.nazionalita),
              field('Città residenza', d.residenza_citta ? `${d.residenza_citta}${d.residenza_provincia ? ' ('+d.residenza_provincia+')' : ''}` : null),
              field('Città', d.citta),
              field('Telefono', d.telefono),
              field('Instagram', d.instagram),
              field('Facebook', d.facebook),
            ]))}

            {accSection('fisico', 'Profilo Fisico', grid([
              field('Altezza', d.altezza ? `${d.altezza} cm` : null),
              field('Taglia t-shirt', d.taglia_tshirt),
              field('Taglia pantalone', d.taglia_pantalone),
              field('Taglia gonna', d.taglia_gonna),
              field('N° scarpe', d.numero_scarpe),
              field('Piercing visibili', d.piercing_visibili),
              field('Tatuaggi visibili', d.tatuaggi_visibili),
              field('Dove tatuaggi', d.tatuaggi_dove),
            ]))}

            {accSection('disp', 'Disponibilità', grid([
              field('Province lavoro', safeArray(d.province_lavoro).join(', ') || null),
              field('Patente', safeArray(d.patente_tipologie).join(', ') || null),
              field('Automunita', d.automunita),
              field('Trasferte', d.disponibilita_trasferte),
              field('Weekend', d.disponibilita_weekend),
              field('Serate', d.disponibilita_serali),
            ]))}

            {accSection('lingue', 'Lingue', grid([
              field('Inglese', d.lingua_inglese),
              field('Francese', d.lingua_francese && d.lingua_francese !== 'Non conosco' ? d.lingua_francese : null),
              field('Spagnolo', d.lingua_spagnolo && d.lingua_spagnolo !== 'Non conosco' ? d.lingua_spagnolo : null),
              field('Tedesco', d.lingua_tedesco && d.lingua_tedesco !== 'Non conosco' ? d.lingua_tedesco : null),
              ...safeArray(d.altre_lingue).map((l, i) =>
                field(`Altra ${i+1}`, l?.nome && l?.livello ? `${l.nome}: ${l.livello}` : l?.nome || (typeof l === 'string' ? l : null))
              ),
            ]))}

            {accSection('exp', 'Esperienza Professionale', grid([
              field('Titolo studio', d.titolo_studio),
              field('Indirizzo studio', d.titolo_studio_indirizzo),
              field('Professione attuale', safeArray(d.professione_attuale).join(', ') || null),
              field('Anni esperienza', d.anni_esperienza_settore),
              field('Tipologie', safeArray(d.tipologie_esperienza).join(', ') || null),
            ]))}

            {accSection('dot', 'Dotazione', safeArray(d.dotazione_personale).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {safeArray(d.dotazione_personale).map(item => (
                  <span key={item} style={{ fontSize: 11, background: '#f5f5f5', color: COLORS.text, padding: '3px 10px', borderRadius: 10 }}>{item}</span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Nessun capo indicato</div>
            ))}
          </div>

          {/* SCORE */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.textSecondary, marginBottom: 12 }}>Score Profilo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 36, fontWeight: 300, color: COLORS.text, minWidth: 52 }}>{d.score ?? '—'}</div>
              <div style={{ flex: 1 }}><ScoreBar score={d.score} /></div>
            </div>
          </div>

          {/* Documenti */}
          {(d.cv_url || d.doc_identita_url || d.doc_cf_url) && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.textSecondary, marginBottom: 10 }}>Documenti</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[['CV', d.cv_url], ['Documento identità', d.doc_identita_url], ['Cod. fiscale doc.', d.doc_cf_url]]
                  .filter(([, u]) => u)
                  .map(([label, url]) => (
                    <a key={label} href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: COLORS.accent, textDecoration: 'underline' }}>
                      {label} →
                    </a>
                  ))}
              </div>
            </div>
          )}

          <div style={{ height: 16 }} />
        </div>

        {/* Sticky bottom actions */}
        <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: '12px 24px', flexShrink: 0, background: '#fff' }}>
          {showRejectConfirm && (
            <div style={{ marginBottom: 10 }}>
              <textarea
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Motivo del rifiuto (obbligatorio)..."
                rows={2}
                style={{ width: '100%', border: `1px solid #EF4444`, borderRadius: 6, padding: '8px 10px', fontSize: 12, fontFamily: 'Montserrat, sans-serif', resize: 'vertical', boxSizing: 'border-box', color: COLORS.text }}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => onApprove(lead.entity_id)}
              disabled={!!actionLoading}
              style={{ flex: '1 1 100px', padding: '9px 12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: actionLoading ? 'wait' : 'pointer', fontFamily: 'Montserrat, sans-serif' }}
            >
              {actionLoading === lead.entity_id + '_approve' ? 'Approvando…' : 'APPROVA'}
            </button>
            {!showRejectConfirm ? (
              <button
                onClick={() => setShowRejectConfirm(true)}
                style={{ flex: '1 1 100px', padding: '9px 12px', background: 'none', color: '#EF4444', border: '1px solid #EF4444', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}
              >
                RIFIUTA
              </button>
            ) : (
              <button
                onClick={() => { if (!nota.trim()) return; onReject(lead.entity_id, nota) }}
                disabled={!nota.trim() || !!actionLoading}
                style={{ flex: '1 1 100px', padding: '9px 12px', background: !nota.trim() ? '#f5f5f5' : '#EF4444', color: !nota.trim() ? '#999' : '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: !nota.trim() ? 'not-allowed' : 'pointer', fontFamily: 'Montserrat, sans-serif' }}
              >
                {actionLoading === lead.entity_id + '_reject' ? 'Rifiutando…' : 'Conferma rifiuto'}
              </button>
            )}
            <button
              onClick={() => { setEmailResult(null); setShowEmailModal(true) }}
              style={{ padding: '9px 12px', background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}
            >
              Invia email
            </button>
            <button
              onClick={() => { setSocialResult(null); setShowSocialModal(true) }}
              style={{ padding: '9px 12px', background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}
            >
              Invita social
            </button>
            <DeleteEntityButton
              label="Elimina"
              confirmText="Elimina questo lead. Inserisci la password per confermare."
              onConfirm={async () => {
                const res = await leadApi.softDelete(lead.entity_id)
                if (!res.success) return false
                await adminStore.refresh()
                onDeleted?.()
                onClose()
                showToast('Eliminato')
                return true
              }}
            />
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// TALENT PROFILE CHANGES DRAWER — diff + approvazione modifiche
// ---------------------------------------------------------------------------

function TalentChangesDrawer({ profile, onClose, onApprove, onReject, actionLoading }) {
  const [nota, setNota] = useState('')
  const d       = profile.data ?? {}
  const pending = d.pending_data ?? {}

  const LABELS = {
    telefono:'Telefono', data_nascita:'Data nascita', citta_nascita:'Città nascita',
    nazionalita:'Nazionalità', indirizzo_residenza:'Indirizzo', numero_documento:'N° documento',
    stato_emissione_documento:'Stato emissione', altezza:'Altezza', taglia:'Taglia',
    capelli:'Capelli', occhi:'Occhi', corporatura:'Corporatura', citta:'Città',
    province_operativita:'Province op.', automunita:'Automunita', disponibile_trasferte:'Trasferte',
    disponibile_weekend:'Week-end', lingue:'Lingue', esperienza_anni:'Anni esp.',
    skills:'Skills', esperienze_precedenti:'Esperienze', attrezzatura:'Attrezzatura',
    codice_fiscale:'CF', iban:'IBAN', intestatario_conto:'Intestatario', partita_iva:'P.IVA',
    disponibilita:'Disponibilità', note:'Note',
  }

  const changedKeys = Object.keys(pending).filter(k => {
    const oldVal = JSON.stringify(d[k] ?? '')
    const newVal = JSON.stringify(pending[k] ?? '')
    return oldVal !== newVal
  })

  const fmt = v => Array.isArray(v) ? v.join(', ') : (v === true ? 'Sì' : v === false ? 'No' : String(v ?? '—'))

  return (
    <>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:500 }} />
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:520, maxWidth:'96vw',
        background:'#fff', borderLeft:`1px solid ${COLORS.border}`,
        zIndex:501, overflowY:'auto', padding:28, fontFamily:'Montserrat,sans-serif',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:COLORS.text }}>Modifiche in attesa</h2>
            <div style={{ fontSize:12, color:COLORS.textSecondary, marginTop:3 }}>
              {d.nome} {d.cognome} · inviato {d.pending_submitted_at ? new Date(d.pending_submitted_at).toLocaleDateString('it-IT') : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#666' }}>✕</button>
        </div>

        {changedKeys.length === 0 ? (
          <div style={{ fontSize:13, color:COLORS.textSecondary, padding:'16px 0' }}>Nessuna modifica rilevata.</div>
        ) : (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:COLORS.textSecondary, marginBottom:10 }}>
              {changedKeys.length} campo{changedKeys.length !== 1 ? 'i' : ''} modificato{changedKeys.length !== 1 ? 'i' : ''}
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#f5f5f5' }}>
                    <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:600, color:COLORS.textSecondary, width:'28%' }}>Campo</th>
                    <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:600, color:'#C62828' }}>Valore attuale</th>
                    <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:600, color:'#2E7D32' }}>Nuovo valore</th>
                  </tr>
                </thead>
                <tbody>
                  {changedKeys.map(k => (
                    <tr key={k} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                      <td style={{ padding:'8px 10px', fontWeight:600, color:COLORS.text }}>{LABELS[k] || k}</td>
                      <td style={{ padding:'8px 10px', color:'#C62828', background:'#FFF3F3' }}>{fmt(d[k])}</td>
                      <td style={{ padding:'8px 10px', color:'#2E7D32', background:'#F3FFF3' }}>{fmt(pending[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ borderTop:`1px solid ${COLORS.border}`, paddingTop:16, marginBottom:12 }}>
          <label style={{ fontSize:11, color:COLORS.textSecondary, display:'block', marginBottom:4 }}>
            Nota (opzionale — visibile al talent in caso di rifiuto)
          </label>
          <textarea
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder="Motivo del rifiuto..."
            rows={2}
            style={{ width:'100%', border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'8px 10px', fontSize:12, fontFamily:'Montserrat,sans-serif', resize:'vertical', boxSizing:'border-box', color:COLORS.text }}
          />
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <button
            onClick={() => onApprove(profile.entity_id)}
            disabled={!!actionLoading}
            style={{ padding:'10px 16px', background:'#10B981', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:actionLoading ? 'wait' : 'pointer', fontFamily:'Montserrat,sans-serif' }}
          >
            {actionLoading === profile.entity_id + '_approve' ? 'Approvando…' : 'Approva modifiche'}
          </button>
          <button
            onClick={() => onReject(profile.entity_id, nota)}
            disabled={!!actionLoading}
            style={{ padding:'10px 16px', background:'none', color:'#EF4444', border:'1px solid #EF4444', borderRadius:6, fontSize:13, fontWeight:600, cursor:actionLoading ? 'wait' : 'pointer', fontFamily:'Montserrat,sans-serif' }}
          >
            {actionLoading === profile.entity_id + '_reject' ? 'Rifiutando…' : 'Rifiuta modifiche'}
          </button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// TALENT PROFILE DRAWER — scheda completa talent approvato
// ---------------------------------------------------------------------------

function TalentProfileDrawer({ talent, onClose, onSuspended, handleApiResponse }) {
  const d = talent.data ?? {}
  const nome = `${d.nome ?? ''} ${d.cognome ?? ''}`.trim() || '—'
  const photoExp = photoExpiryStatus(talent)

  const [openSections,  setOpenSections]  = useState({ dati:true, fisico:false, disp:false, lingue:false, exp:false, dot:false, documenti:true, eventi:true, storico:false })
  const toggleSection = k => setOpenSections(p => ({ ...p, [k]: !p[k] }))

  const [showIban,    setShowIban]    = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState(null)

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailBody,      setEmailBody]      = useState(`Ciao ${d.nome || ''},\n\nIl team MADE EVENTS ha esaminato il tuo profilo.\n\nPer ulteriori informazioni non esitare a contattarci.\n\nIl team MADE EVENTS`)
  const [emailSending,   setEmailSending]   = useState(false)
  const [emailResult,    setEmailResult]    = useState(null)

  const [showSocialModal, setShowSocialModal] = useState(false)
  const [socialText,      setSocialText]      = useState(`Ciao ${d.nome || ''}, seguici su Instagram @madeevents e Facebook Made Events per restare aggiornata sulle opportunità di lavoro!`)
  const [socialSending,   setSocialSending]   = useState(false)
  const [socialResult,    setSocialResult]    = useState(null)
  const [copied,          setCopied]          = useState(false)

  const [fotoEmailSending, setFotoEmailSending] = useState(false)
  const [fotoEmailResult,  setFotoEmailResult]  = useState(null)

  const [docEmailSending, setDocEmailSending] = useState(false)
  const [docEmailResult,  setDocEmailResult]  = useState(null)

  const [convocaEvent,   setConvocaEvent]   = useState(null)
  const [convocaBody,    setConvocaBody]    = useState('')
  const [convocaSending, setConvocaSending] = useState(false)
  const [convocaResult,  setConvocaResult]  = useState(null)

  const [showSospendiModal, setShowSospendiModal] = useState(false)
  const [sospendiNota,      setSospendiNota]      = useState('')
  const [sospendiLoading,   setSospendiLoading]   = useState(false)

  const [showContractModal, setShowContractModal] = useState(false)
  const [contractEventId,   setContractEventId]   = useState('')
  const [contractLoading,   setContractLoading]   = useState(false)
  const [contractResult,    setContractResult]    = useState(null)

  const [cardLoading, setCardLoading] = useState(false)
  const [cardError,   setCardError]   = useState(null)

  // Score admin override
  const [localScore,          setLocalScore]          = useState(d.score ?? null)
  const [editableScoreAdmin,  setEditableScoreAdmin]  = useState(d.score_admin ?? 5)
  const [scoreAdminSaving,    setScoreAdminSaving]    = useState(false)
  const scoreQuestionario = d.score_questionario ?? 0

  const calculatePreviewScore = (scoreQ, scoreA) =>
    Math.round((scoreQ * 0.65) + ((scoreA / 10) * 100 * 0.35))

  const handleSaveScoreAdmin = async () => {
    setScoreAdminSaving(true)
    const res = handleApiResponse
      ? handleApiResponse(await talentApi.updateScoreAdmin(talent.entity_id, editableScoreAdmin))
      : await talentApi.updateScoreAdmin(talent.entity_id, editableScoreAdmin)
    setScoreAdminSaving(false)
    if (res.success) {
      setLocalScore(res.data?.score ?? calculatePreviewScore(scoreQuestionario, editableScoreAdmin))
    } else {
      alert(getErrorMessage(res.error))
    }
  }

  // Eventi pre-CRM
  const [editableEventiPreCRM, setEditableEventiPreCRM] = useState(d.eventi_precrm ?? 0)
  const [savedEventiPreCRM,    setSavedEventiPreCRM]    = useState(d.eventi_precrm ?? 0)

  const handleSaveEventiPreCRM = async () => {
    const res = handleApiResponse
      ? handleApiResponse(await talentApi.updateEventiPreCRM(talent.entity_id, editableEventiPreCRM))
      : await talentApi.updateEventiPreCRM(talent.entity_id, editableEventiPreCRM)
    if (res.success) {
      setSavedEventiPreCRM(editableEventiPreCRM)
    } else {
      alert(getErrorMessage(res.error))
    }
  }

  const [history,        setHistory]        = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const activeEvents = useMemo(() =>
    (adminStore.getData()?.events ?? []).filter(e => e.status === 'LIVE' || e.status === 'PLANNING'),
  [])
  const eventMap = useMemo(() => {
    const m = {}
    ;(adminStore.getData()?.events ?? []).forEach(e => { m[e.entity_id] = e })
    return m
  }, [])

  const loadStorico = useCallback(async () => {
    if (history !== null || historyLoading) return
    setHistoryLoading(true)
    const res = await applicationApi.list({ talent_profile_id: talent.entity_id })
    setHistoryLoading(false)
    setHistory(res.success ? (res.data?.items ?? []) : [])
  }, [history, historyLoading, talent.entity_id])

  useEffect(() => {
    if (openSections.storico) loadStorico()
  }, [openSections.storico])

  const accSection = (k, label, children) => (
    <div key={k} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
      <button onClick={() => toggleSection(k)} style={{ width:'100%', background:'none', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', fontFamily:'Montserrat,sans-serif' }}>
        <span style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary }}>{label}</span>
        <span style={{ fontSize:11, color:COLORS.textSecondary }}>{openSections[k] ? '▲' : '▼'}</span>
      </button>
      {openSections[k] && <div style={{ paddingBottom:16 }}>{children}</div>}
    </div>
  )

  const fld = (label, value) => value ? (
    <div key={label} style={{ marginBottom:8 }}>
      <div style={{ fontSize:10, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:13, color:COLORS.text }}>{value}</div>
    </div>
  ) : null

  const grid2 = items => <div className="grid-2-collapse" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px' }}>{items}</div>

  // Fallback su forme legacy per profili approvati prima del fix BUG7 —
  // stessa catena di getFotoUrl() usata per l'avatar in lista.
  const photos = [
    { key:'busto',  label:'Mezzo busto',   url: d.foto_busto_url  || d.documenti?.foto?.url || d.foto_url },
    { key:'intera', label:'Figura intera', url: d.foto_intera_url },
    { key:'extra',  label:'Aggiuntiva',    url: d.foto_extra_url  },
  ].filter(p => p.url)

  const renderPhoto = p => isDriveUrl(p.url) ? (
    <div style={{ position:'relative', width:120, height:150 }}>
      <img src={driveThumbUrl(p.url, 260)} alt={p.label}
        style={{ width:120, height:150, objectFit:'cover', borderRadius:6, border:`1px solid ${COLORS.border}`, display:'block' }} />
      <a href={p.url} target="_blank" rel="noreferrer"
        style={{ position:'absolute', bottom:4, left:4, right:4, textAlign:'center', fontSize:10, fontWeight:600, color:'#fff', background:'rgba(0,0,0,0.55)', borderRadius:4, padding:'2px 0', textDecoration:'none' }}>
        Apri foto →
      </a>
    </div>
  ) : (
    <img src={p.url} alt={p.label} onClick={() => setLightboxUrl(p.url)}
      style={{ width:120, height:150, objectFit:'cover', borderRadius:6, border:`1px solid ${COLORS.border}`, cursor:'zoom-in', display:'block' }} />
  )

  const maskedIban = useMemo(() => {
    if (!d.iban) return null
    const s = d.iban.replace(/\s/g, '')
    return s.length < 8 ? s : s.slice(0, 4) + '****' + s.slice(-4)
  }, [d.iban])

  const statusBadge = s => {
    const MAP = { PENDING:{bg:'#FFF3E0',color:'#E65100',label:'In attesa'}, APPROVED:{bg:'#E8F5E9',color:'#2E7D32',label:'Approvata'}, REJECTED:{bg:'#FFEBEE',color:'#C62828',label:'Rifiutata'}, CONFIRMED:{bg:'#E3F2FD',color:'#1565C0',label:'Confermata'}, WITHDRAWN:{bg:'#F5F5F5',color:'#757575',label:'Ritirata'}, INVITED:{bg:'#F3E5F5',color:'#7B1FA2',label:'Invitata'} }
    const c = MAP[s] || { bg:'#F5F5F5', color:'#757575', label: s }
    return <span style={{ fontSize:10, fontWeight:700, background:c.bg, color:c.color, padding:'2px 8px', borderRadius:10 }}>{c.label}</span>
  }

  const handleSendEmail = async () => {
    setEmailSending(true); setEmailResult(null)
    const res = await emailApi.sendCustom(d.email, d.nome || '', emailBody, 'custom')
    setEmailSending(false)
    if (res.success) { setEmailResult('sent'); setTimeout(() => { setEmailResult(null); setShowEmailModal(false) }, 2000) }
    else setEmailResult('error')
  }

  const handleSendSocial = async () => {
    setSocialSending(true); setSocialResult(null)
    const res = await emailApi.sendCustom(d.email, d.nome || '', socialText, 'social')
    setSocialSending(false)
    if (res.success) { setSocialResult('sent'); setTimeout(() => { setSocialResult(null); setShowSocialModal(false) }, 2000) }
    else setSocialResult('error')
  }

  const handleRichiestaFoto = async () => {
    setFotoEmailSending(true); setFotoEmailResult(null)
    const msg = `Ciao ${d.nome || ''},\n\nLe tue foto nel nostro archivio stanno per scadere (o sono già scadute). Per continuare a ricevere proposte di lavoro, carica nuove foto di mezzo busto e figura intera accedendo alla piattaforma.\n\nGrazie per la collaborazione.\nIl team MADE EVENTS`
    const res = await emailApi.sendCustom(d.email, d.nome || '', msg, 'custom')
    setFotoEmailSending(false)
    if (res.success) { setFotoEmailResult('sent'); setTimeout(() => setFotoEmailResult(null), 3000) }
    else setFotoEmailResult('error')
  }

  const handleRichiestaDoc = async () => {
    setDocEmailSending(true); setDocEmailResult(null)
    const msg = `Ciao ${d.nome || ''},\n\nPer completare il tuo profilo, ti chiediamo di caricare i seguenti documenti mancanti:\n• Documento d'identità (fronte/retro)\n• Curriculum vitae aggiornato\n\nAccedi alla piattaforma e carica i documenti nella tua area personale.\n\nGrazie.\nIl team MADE EVENTS`
    const res = await emailApi.sendCustom(d.email, d.nome || '', msg, 'custom')
    setDocEmailSending(false)
    if (res.success) { setDocEmailResult('sent'); setTimeout(() => setDocEmailResult(null), 3000) }
    else setDocEmailResult('error')
  }

  const openConvoca = evt => {
    const ed = evt.data ?? {}
    const dataStr = ed.data_evento ? new Date(ed.data_evento).toLocaleDateString('it-IT') : '—'
    const luogo = ed.citta ?? ed.location ?? '—'
    setConvocaEvent(evt)
    setConvocaBody(`Ciao ${d.nome || ''},\n\nSiamo lieti di invitarti come hostess/steward per il nostro prossimo evento:\n\n📅 ${ed.titolo ?? ''}\n📆 Data: ${dataStr}\n📍 Luogo: ${luogo}\n\nSe sei disponibile, ti chiediamo di confermare la tua partecipazione accedendo alla piattaforma al più presto.\n\nIl team MADE EVENTS`)
    setConvocaResult(null)
  }

  const handleSendConvoca = async () => {
    if (!convocaEvent) return
    const ed = convocaEvent.data ?? {}
    const dataStr = ed.data_evento ? new Date(ed.data_evento).toLocaleDateString('it-IT') : ''
    setConvocaSending(true)
    const res = await emailApi.sendConvocazione(d.email, d.nome || '', ed.titolo ?? '', dataStr, ed.citta ?? ed.location ?? '', convocaBody)
    setConvocaSending(false)
    if (res.success) { setConvocaResult('sent'); setTimeout(() => { setConvocaResult(null); setConvocaEvent(null) }, 2000) }
    else setConvocaResult('error')
  }

  const handleSospendi = async () => {
    if (!sospendiNota.trim()) return
    setSospendiLoading(true)
    const res = handleApiResponse
      ? handleApiResponse(await talentApi.reject(talent.entity_id, sospendiNota))
      : await talentApi.reject(talent.entity_id, sospendiNota)
    setSospendiLoading(false)
    if (res.success) { await adminStore.refresh(); onSuspended?.(); onClose() }
    else alert(getErrorMessage(res.error))
  }

  const handleGeneraContratto = async () => {
    if (!contractEventId) return
    setContractLoading(true)
    const res = await contractApi.generate(talent.entity_id, contractEventId)
    setContractLoading(false)
    if (res.success) setContractResult('ok')
    else setContractResult('error')
  }

  const handleGeneraScheda = async () => {
    setCardLoading(true)
    setCardError(null)
    const res = await talentApi.generateCard(talent.entity_id)
    setCardLoading(false)
    if (res.success && res.data?.pdf_url) {
      window.open(res.data.pdf_url, '_blank')
    } else {
      setCardError(getErrorMessage(res.error))
    }
  }

  const BTN_OUTLINE = { background:'none', border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'7px 14px', cursor:'pointer', fontSize:12, fontFamily:'Montserrat,sans-serif', color:COLORS.text }

  return (
    <>
      {/* Lightbox */}
      {lightboxUrl && !isDriveUrl(lightboxUrl) && (
        <div onClick={() => setLightboxUrl(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <img src={lightboxUrl} alt="foto" style={{ maxWidth:'90vw', maxHeight:'90vh', objectFit:'contain', borderRadius:8 }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxUrl(null)} style={{ position:'absolute', top:20, right:20, background:'rgba(0,0,0,0.5)', border:'none', color:'#fff', fontSize:24, cursor:'pointer', width:40, height:40, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <>
          <div onClick={() => { if (!emailSending) setShowEmailModal(false) }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:650 }} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#fff', borderRadius:8, padding:28, width:480, maxWidth:'90vw', zIndex:651, fontFamily:'Montserrat,sans-serif', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin:'0 0 12px', fontSize:15, fontWeight:700, color:COLORS.text }}>Invia email a {d.nome}</h3>
            <div style={{ fontSize:11, color:COLORS.textSecondary, marginBottom:10 }}>A: <strong>{d.email}</strong></div>
            <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} disabled={emailSending} rows={7}
              style={{ width:'100%', border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'8px 12px', fontSize:13, fontFamily:'Montserrat,sans-serif', resize:'vertical', boxSizing:'border-box', color:COLORS.text }} />
            {emailResult === 'sent'  && <div style={{ marginTop:10, padding:'8px 12px', background:'#E8F5E9', borderRadius:6, fontSize:12, color:'#2E7D32', fontWeight:600 }}>✓ Email inviata con successo</div>}
            {emailResult === 'error' && <div style={{ marginTop:10, padding:'8px 12px', background:'#FFEBEE', borderRadius:6, fontSize:12, color:'#C62828' }}>Errore nell'invio. Usa il client email come alternativa.</div>}
            <div style={{ display:'flex', gap:8, marginTop:14, justifyContent:'flex-end' }}>
              <button onClick={() => window.open(`mailto:${d.email}?subject=MADE EVENTS&body=${encodeURIComponent(emailBody)}`)} style={{ ...BTN_OUTLINE, fontSize:11, color:COLORS.textSecondary }}>Apri client email</button>
              <button onClick={() => { if (!emailSending) setShowEmailModal(false) }} style={BTN_OUTLINE}>Annulla</button>
              <button onClick={handleSendEmail} disabled={emailSending || !emailBody.trim()} style={{ padding:'8px 20px', background: emailSending ? '#ccc' : COLORS.accent, color:'#fff', border:'none', borderRadius:6, cursor: emailSending ? 'wait' : 'pointer', fontSize:12, fontWeight:700, fontFamily:'Montserrat,sans-serif' }}>
                {emailSending ? 'Invio…' : 'Invia →'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Social Modal */}
      {showSocialModal && (
        <>
          <div onClick={() => { if (!socialSending) setShowSocialModal(false) }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:650 }} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#fff', borderRadius:8, padding:28, width:440, maxWidth:'90vw', zIndex:651, fontFamily:'Montserrat,sans-serif', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin:'0 0 12px', fontSize:15, fontWeight:700, color:COLORS.text }}>Invita sui social</h3>
            <div style={{ fontSize:11, color:COLORS.textSecondary, marginBottom:8 }}>A: <strong>{d.email}</strong></div>
            <textarea value={socialText} onChange={e => setSocialText(e.target.value)} disabled={socialSending} rows={4}
              style={{ width:'100%', border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'10px 12px', fontSize:13, fontFamily:'Montserrat,sans-serif', resize:'vertical', boxSizing:'border-box', color:COLORS.text, lineHeight:1.6, marginBottom:12 }} />
            {socialResult === 'sent'  && <div style={{ marginBottom:10, padding:'8px 12px', background:'#E8F5E9', borderRadius:6, fontSize:12, color:'#2E7D32', fontWeight:600 }}>✓ Messaggio inviato via email</div>}
            {socialResult === 'error' && <div style={{ marginBottom:10, padding:'8px 12px', background:'#FFEBEE', borderRadius:6, fontSize:12, color:'#C62828' }}>Errore nell'invio email.</div>}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button onClick={() => { navigator.clipboard?.writeText(socialText); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                style={{ flex:1, padding:'9px 0', background: copied ? '#10B981' : 'none', color: copied ? '#fff' : COLORS.text, border:`1px solid ${copied ? '#10B981' : COLORS.border}`, borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'Montserrat,sans-serif', fontWeight:600, transition:'all 0.2s' }}>
                {copied ? '✓ Copiato' : 'Copia'}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(socialText)}`} target="_blank" rel="noreferrer"
                style={{ flex:1, padding:'9px 0', background:'#25D366', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontFamily:'Montserrat,sans-serif', fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>WhatsApp</a>
              <button onClick={handleSendSocial} disabled={socialSending}
                style={{ flex:1, padding:'9px 0', background: socialSending ? '#ccc' : COLORS.accent, color:'#fff', border:'none', borderRadius:6, cursor: socialSending ? 'wait' : 'pointer', fontSize:12, fontFamily:'Montserrat,sans-serif', fontWeight:700 }}>
                {socialSending ? 'Invio…' : 'Invia email'}
              </button>
            </div>
            <button onClick={() => { if (!socialSending) setShowSocialModal(false) }} style={{ width:'100%', marginTop:10, padding:'8px 0', background:'none', border:`1px solid ${COLORS.border}`, borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'Montserrat,sans-serif', color:COLORS.textSecondary }}>Chiudi</button>
          </div>
        </>
      )}

      {/* Convoca Modal */}
      {convocaEvent && (
        <>
          <div onClick={() => { if (!convocaSending) setConvocaEvent(null) }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:650 }} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#fff', borderRadius:8, padding:28, width:500, maxWidth:'90vw', zIndex:651, fontFamily:'Montserrat,sans-serif', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin:'0 0 4px', fontSize:15, fontWeight:700, color:COLORS.text }}>Convoca per evento</h3>
            <div style={{ fontSize:12, color:COLORS.textSecondary, marginBottom:12 }}><strong>{convocaEvent.data?.titolo}</strong> · A: {d.email}</div>
            <textarea value={convocaBody} onChange={e => setConvocaBody(e.target.value)} disabled={convocaSending} rows={8}
              style={{ width:'100%', border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'8px 12px', fontSize:13, fontFamily:'Montserrat,sans-serif', resize:'vertical', boxSizing:'border-box', color:COLORS.text, lineHeight:1.6 }} />
            {convocaResult === 'sent'  && <div style={{ marginTop:10, padding:'8px 12px', background:'#E8F5E9', borderRadius:6, fontSize:12, color:'#2E7D32', fontWeight:600 }}>✓ Email di convocazione inviata</div>}
            {convocaResult === 'error' && <div style={{ marginTop:10, padding:'8px 12px', background:'#FFEBEE', borderRadius:6, fontSize:12, color:'#C62828' }}>Errore nell'invio.</div>}
            <div style={{ display:'flex', gap:8, marginTop:14, justifyContent:'flex-end' }}>
              <button onClick={() => { if (!convocaSending) setConvocaEvent(null) }} style={BTN_OUTLINE}>Annulla</button>
              <button onClick={handleSendConvoca} disabled={convocaSending || !convocaBody.trim()}
                style={{ padding:'8px 20px', background: convocaSending ? '#ccc' : COLORS.accent, color:'#fff', border:'none', borderRadius:6, cursor: convocaSending ? 'wait' : 'pointer', fontSize:12, fontWeight:700, fontFamily:'Montserrat,sans-serif' }}>
                {convocaSending ? 'Invio…' : 'Invia convocazione →'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sospendi Modal */}
      {showSospendiModal && (
        <>
          <div onClick={() => { if (!sospendiLoading) setShowSospendiModal(false) }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:650 }} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#fff', borderRadius:8, padding:28, width:420, maxWidth:'90vw', zIndex:651, fontFamily:'Montserrat,sans-serif', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin:'0 0 8px', fontSize:15, fontWeight:700, color:'#C62828' }}>Sospendi profilo</h3>
            <div style={{ fontSize:13, color:COLORS.textSecondary, marginBottom:16 }}>
              Questa azione sospende il profilo di <strong>{nome}</strong>. Il talent non potrà più accedere alla piattaforma fino a nuova approvazione.
            </div>
            <label style={{ fontSize:11, color:COLORS.textSecondary, display:'block', marginBottom:4 }}>Motivo (obbligatorio)</label>
            <textarea value={sospendiNota} onChange={e => setSospendiNota(e.target.value)} rows={3} placeholder="Motivo della sospensione..."
              style={{ width:'100%', border:'1px solid #EF4444', borderRadius:6, padding:'8px 10px', fontSize:13, fontFamily:'Montserrat,sans-serif', resize:'vertical', boxSizing:'border-box', color:COLORS.text }} />
            <div style={{ display:'flex', gap:8, marginTop:14, justifyContent:'flex-end' }}>
              <button onClick={() => { if (!sospendiLoading) setShowSospendiModal(false) }} style={BTN_OUTLINE}>Annulla</button>
              <button onClick={handleSospendi} disabled={!sospendiNota.trim() || sospendiLoading}
                style={{ padding:'8px 20px', background: !sospendiNota.trim() ? '#f5f5f5' : '#EF4444', color: !sospendiNota.trim() ? '#999' : '#fff', border:'none', borderRadius:6, cursor: !sospendiNota.trim() ? 'not-allowed' : 'pointer', fontSize:12, fontWeight:700, fontFamily:'Montserrat,sans-serif' }}>
                {sospendiLoading ? 'Sospensione…' : 'Conferma sospensione'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Contract Modal */}
      {showContractModal && (
        <>
          <div onClick={() => { if (!contractLoading) setShowContractModal(false) }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:650 }} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#fff', borderRadius:8, padding:28, width:440, maxWidth:'90vw', zIndex:651, fontFamily:'Montserrat,sans-serif', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin:'0 0 12px', fontSize:15, fontWeight:700, color:COLORS.text }}>Genera contratto</h3>
            <div style={{ fontSize:13, color:COLORS.textSecondary, marginBottom:16 }}>Talent: <strong>{nome}</strong></div>
            {activeEvents.length === 0 ? (
              <div style={{ fontSize:13, color:COLORS.textSecondary, marginBottom:16 }}>Nessun evento LIVE o PLANNING disponibile.</div>
            ) : (
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, color:COLORS.textSecondary, display:'block', marginBottom:6 }}>Evento</label>
                <select value={contractEventId} onChange={e => setContractEventId(e.target.value)}
                  style={{ width:'100%', border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'8px 10px', fontSize:13, fontFamily:'Montserrat,sans-serif', color:COLORS.text, background:'#fff' }}>
                  <option value="">Seleziona evento…</option>
                  {activeEvents.map(e => <option key={e.entity_id} value={e.entity_id}>{e.data?.titolo ?? e.entity_id}</option>)}
                </select>
              </div>
            )}
            {contractResult === 'ok'    && <div style={{ marginBottom:12, padding:'8px 12px', background:'#E8F5E9', borderRadius:6, fontSize:12, color:'#2E7D32', fontWeight:600 }}>✓ Contratto generato con successo</div>}
            {contractResult === 'error' && <div style={{ marginBottom:12, padding:'8px 12px', background:'#FFEBEE', borderRadius:6, fontSize:12, color:'#C62828' }}>Errore nella generazione del contratto.</div>}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { if (!contractLoading) { setShowContractModal(false); setContractResult(null); setContractEventId('') } }} style={BTN_OUTLINE}>Chiudi</button>
              <button onClick={handleGeneraContratto} disabled={!contractEventId || contractLoading}
                style={{ padding:'8px 20px', background: !contractEventId ? '#f5f5f5' : COLORS.accent, color: !contractEventId ? '#999' : '#fff', border:'none', borderRadius:6, cursor: contractLoading ? 'wait' : (!contractEventId ? 'not-allowed' : 'pointer'), fontSize:12, fontWeight:700, fontFamily:'Montserrat,sans-serif', display:'inline-flex', alignItems:'center', gap:8 }}>
                {contractLoading && <span className="spinner" style={{ width:12, height:12, borderWidth:'1.5px', borderTopColor:'#fff', borderColor:'rgba(255,255,255,0.3)' }} />}
                {contractLoading ? 'Generazione…' : 'Genera contratto'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Backdrop */}
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:400 }} />

      {/* Drawer */}
      <div style={{ position:'fixed', right:0, top:0, bottom:0, width:680, maxWidth:'96vw', background:'#fff', borderLeft:`1px solid ${COLORS.border}`, zIndex:401, display:'flex', flexDirection:'column', fontFamily:'Montserrat,sans-serif' }}>

        {/* Header */}
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              <TalentAvatar nome={nome} fotoUrl={getFotoUrl(d)} size={56} />
              <div>
                <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:COLORS.text }}>{nome}</h2>
                <div style={{ fontSize:12, color:COLORS.textSecondary, marginTop:2 }}>{d.email ?? '—'}</div>
                <div style={{ fontSize:12, color:COLORS.textSecondary }}>{d.citta ?? d.residenza_citta ?? '—'}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#666', padding:'4px 8px', lineHeight:1 }}>✕</button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:12 }}>
            <LeadBadge status={talent.status} />
            <div style={{ flex:1, maxWidth:200 }}><ScoreBar score={localScore ?? d.score} /></div>
            {(localScore ?? d.score) != null && <span style={{ fontSize:13, fontWeight:700, color:COLORS.text }}>{localScore ?? d.score}<span style={{ fontSize:10, color:COLORS.textSecondary }}>/100</span></span>}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 28px' }}>

          {/* SCORE BREAKDOWN + ADMIN OVERRIDE */}
          <div style={{ marginBottom:20, padding:'16px 18px', background:'#F8F8FB', borderRadius:8, border:`1px solid ${COLORS.border}` }}>
            <div style={{ display:'flex', gap:24, marginBottom:12 }}>
              <div>
                <div style={{ fontSize:10, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:2 }}>Score finale</div>
                <div style={{ fontSize:28, fontWeight:700, color:COLORS.accent, lineHeight:1 }}>{localScore ?? d.score ?? 0}<span style={{ fontSize:12, color:COLORS.textSecondary, fontWeight:400 }}>/100</span></div>
              </div>
              <div>
                <div style={{ fontSize:10, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:2 }}>Questionario (65%)</div>
                <div style={{ fontSize:16, fontWeight:600, color:COLORS.text }}>{scoreQuestionario}/100</div>
              </div>
              <div>
                <div style={{ fontSize:10, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:2 }}>Admin (35%)</div>
                <div style={{ fontSize:16, fontWeight:600, color:COLORS.text }}>{editableScoreAdmin}/10</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:11, color:COLORS.textSecondary, whiteSpace:'nowrap' }}>Valutazione admin:</span>
              <input
                type="range" min="1" max="10" step="1"
                value={editableScoreAdmin}
                onChange={e => setEditableScoreAdmin(parseInt(e.target.value))}
                style={{ flex:1, accentColor: COLORS.accent }}
              />
              <span style={{ fontSize:15, fontWeight:700, color:COLORS.accent, minWidth:32 }}>{editableScoreAdmin}/10</span>
            </div>
            {editableScoreAdmin !== (d.score_admin ?? 5) && (
              <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:10 }}>
                <button
                  onClick={handleSaveScoreAdmin}
                  disabled={scoreAdminSaving}
                  style={{ background:COLORS.accent, color:'#fff', border:'none', borderRadius:6, padding:'6px 14px', fontSize:11, fontWeight:700, cursor: scoreAdminSaving ? 'wait' : 'pointer', fontFamily:'Montserrat,sans-serif', opacity: scoreAdminSaving ? 0.6 : 1 }}
                >
                  {scoreAdminSaving ? 'Salvataggio…' : 'Salva valutazione'}
                </button>
                <span style={{ fontSize:11, color:COLORS.textSecondary }}>
                  Score finale: <strong style={{ color:COLORS.accent }}>{calculatePreviewScore(scoreQuestionario, editableScoreAdmin)}/100</strong>
                </span>
              </div>
            )}
          </div>

          {/* EVENTI MADE */}
          <div style={{ marginBottom:20, padding:'14px 18px', background:'#F8F8FB', borderRadius:8, border:`1px solid ${COLORS.border}` }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:10 }}>🎯 Eventi MADE EVENTS</div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:10, color:COLORS.textSecondary, marginBottom:2 }}>Dal CRM</div>
                <div style={{ fontSize:18, fontWeight:700, color:COLORS.text }}>{d.eventi_crm_completati ?? 0}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div>
                  <div style={{ fontSize:10, color:COLORS.textSecondary, marginBottom:2 }}>Pre-CRM</div>
                  <input
                    type="number" min="0" max="100"
                    value={editableEventiPreCRM}
                    onChange={e => setEditableEventiPreCRM(parseInt(e.target.value) || 0)}
                    style={{ width:52, border:`1px solid ${COLORS.border}`, borderRadius:4, padding:'4px 6px', fontSize:13, fontFamily:'Montserrat,sans-serif', textAlign:'center' }}
                  />
                </div>
                {editableEventiPreCRM !== savedEventiPreCRM && (
                  <button
                    onClick={handleSaveEventiPreCRM}
                    style={{ marginTop:16, background:'none', border:`1px solid ${COLORS.accent}`, color:COLORS.accent, borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}
                  >
                    Salva
                  </button>
                )}
              </div>
              <div style={{ padding:'8px 14px', background:'#fff', borderRadius:6, border:`1px solid ${COLORS.border}` }}>
                <div style={{ fontSize:10, color:COLORS.textSecondary }}>TOTALE</div>
                <div style={{ fontSize:20, fontWeight:700, color:COLORS.accent }}>{(d.eventi_crm_completati ?? 0) + editableEventiPreCRM}</div>
              </div>
            </div>
          </div>

          {/* FOTO E SCADENZE */}
          {(photos.length > 0 || photoExp.label) && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:12 }}>Foto e scadenze</div>
              {photos.length > 0 && (
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
                  {photos.map(p => (
                    <div key={p.key} style={{ textAlign:'center' }}>
                      {renderPhoto(p)}
                      <div style={{ fontSize:10, color:COLORS.textSecondary, marginTop:4 }}>{p.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {photoExp.label && (
                <div style={{ padding:'12px 14px', borderRadius:8, background: photoExp.status === 'expired' ? '#FFF0F0' : photoExp.status === 'expiring' ? '#FFF8F0' : '#F0FAF4', border:`1px solid ${photoExp.color}44`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:photoExp.color }}>
                      {photoExp.status === 'expired' ? '⛔ Foto scadute' : photoExp.status === 'expiring' ? '⚠️ Foto in scadenza' : '✓ Foto valide'}
                    </div>
                    <div style={{ fontSize:11, color:COLORS.textSecondary, marginTop:2 }}>{photoExp.label}</div>
                  </div>
                  {(photoExp.status === 'expired' || photoExp.status === 'expiring') && (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                      <button onClick={handleRichiestaFoto} disabled={fotoEmailSending}
                        style={{ background:'none', border:`1px solid ${photoExp.color}`, color: fotoEmailSending ? '#ccc' : photoExp.color, borderRadius:6, padding:'5px 10px', fontSize:11, cursor: fotoEmailSending ? 'wait' : 'pointer', fontFamily:'Montserrat,sans-serif', whiteSpace:'nowrap' }}>
                        {fotoEmailSending ? 'Invio…' : 'Richiedi aggiornamento foto'}
                      </button>
                      {fotoEmailResult === 'sent'  && <span style={{ fontSize:10, color:'#2E7D32' }}>✓ Email inviata</span>}
                      {fotoEmailResult === 'error' && <span style={{ fontSize:10, color:'#C62828' }}>Errore invio</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* DATI ANAGRAFICI accordion */}
          <div style={{ marginBottom:20 }}>
            {accSection('dati', 'Dati Personali', grid2([
              fld('Genere', d.genere === 'F' ? 'Donna' : d.genere === 'M' ? 'Uomo' : d.genere),
              fld('Data nascita', d.data_nascita),
              fld('Città nascita', d.nascita_citta ? `${d.nascita_citta}${d.nascita_provincia ? ' ('+d.nascita_provincia+')' : ''}` : null),
              fld('Nazionalità', d.nazionalita),
              fld('Città residenza', d.residenza_citta ? `${d.residenza_citta}${d.residenza_provincia ? ' ('+d.residenza_provincia+')' : ''}` : d.citta),
              fld('Telefono', d.telefono),
              fld('Instagram', d.instagram),
              fld('Facebook', d.facebook),
            ]))}
            {accSection('fisico', 'Profilo Fisico', grid2([
              fld('Altezza', d.altezza ? `${d.altezza} cm` : null),
              fld('Taglia t-shirt', d.taglia_tshirt ?? d.taglia),
              fld('Taglia pantalone', d.taglia_pantalone),
              fld('Taglia gonna', d.taglia_gonna),
              fld('N° scarpe', d.numero_scarpe),
              fld('Piercing visibili', d.piercing_visibili),
              fld('Tatuaggi visibili', d.tatuaggi_visibili),
              fld('Dove tatuaggi', d.tatuaggi_dove),
            ]))}
            {accSection('disp', 'Disponibilità', grid2([
              fld('Province lavoro', safeArray(d.province_lavoro).join(', ') || null),
              fld('Patente', safeArray(d.patente_tipologie).join(', ') || null),
              fld('Automunita', d.automunita),
              fld('Trasferte', d.disponibilita_trasferte),
              fld('Weekend', d.disponibilita_weekend),
              fld('Serate', d.disponibilita_serali),
            ]))}
            {accSection('lingue', 'Lingue', grid2([
              fld('Inglese', d.lingua_inglese),
              fld('Francese', d.lingua_francese && d.lingua_francese !== 'Non conosco' ? d.lingua_francese : null),
              fld('Spagnolo', d.lingua_spagnolo && d.lingua_spagnolo !== 'Non conosco' ? d.lingua_spagnolo : null),
              fld('Tedesco', d.lingua_tedesco && d.lingua_tedesco !== 'Non conosco' ? d.lingua_tedesco : null),
              ...(safeArray(d.altre_lingue).length ? safeArray(d.altre_lingue) : safeArray(d.lingue).map(l => ({ nome: l }))).map((l, i) =>
                fld(`Altra ${i+1}`, typeof l === 'object' && l ? (l.nome && l.livello ? `${l.nome}: ${l.livello}` : l.nome) : l)
              ),
            ]))}
            {accSection('exp', 'Esperienza Professionale', grid2([
              fld('Titolo studio', d.titolo_studio),
              fld('Indirizzo studio', d.titolo_studio_indirizzo),
              fld('Professione attuale', safeArray(d.professione_attuale).join(', ') || null),
              fld('Anni esperienza', d.anni_esperienza_settore),
              fld('Tipologie', (safeArray(d.tipologie_esperienza).length ? safeArray(d.tipologie_esperienza) : safeArray(d.skills)).join(', ') || null),
            ]))}
            {accSection('dot', 'Dotazione', (safeArray(d.dotazione_personale).length ? safeArray(d.dotazione_personale) : safeArray(d.attrezzatura)).length > 0 ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {(safeArray(d.dotazione_personale).length ? safeArray(d.dotazione_personale) : safeArray(d.attrezzatura)).map(item => (
                  <span key={item} style={{ fontSize:11, background:'#f5f5f5', color:COLORS.text, padding:'3px 10px', borderRadius:10 }}>{item}</span>
                ))}
              </div>
            ) : <div style={{ fontSize:12, color:COLORS.textSecondary }}>Nessun capo indicato</div>)}
          </div>

          {/* CV E DOCUMENTI */}
          {accSection('documenti', 'CV e Documenti', (
            <div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:12 }}>
                {d.cv_url && <a href={d.cv_url} target="_blank" rel="noreferrer" style={{ fontSize:13, color:COLORS.accent, textDecoration:'none', padding:'8px 14px', border:`1px solid ${COLORS.accent}`, borderRadius:6, fontWeight:600 }}>📄 Apri CV →</a>}
                {d.doc_identita_url && <a href={d.doc_identita_url} target="_blank" rel="noreferrer" style={{ fontSize:13, color:COLORS.accent, textDecoration:'none', padding:'8px 14px', border:`1px solid ${COLORS.accent}`, borderRadius:6, fontWeight:600 }}>🪪 Documento identità →</a>}
                {d.doc_cf_url && <a href={d.doc_cf_url} target="_blank" rel="noreferrer" style={{ fontSize:13, color:COLORS.accent, textDecoration:'none', padding:'8px 14px', border:`1px solid ${COLORS.accent}`, borderRadius:6, fontWeight:600 }}>📋 Cod. Fiscale doc. →</a>}
                {!d.cv_url && !d.doc_identita_url && <span style={{ fontSize:12, color:COLORS.textSecondary }}>Nessun documento caricato.</span>}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:d.iban ? 12 : 0, flexWrap:'wrap' }}>
                <button onClick={handleRichiestaDoc} disabled={docEmailSending}
                  style={{ background:'none', border:`1px solid ${COLORS.border}`, color: docEmailSending ? '#ccc' : COLORS.text, borderRadius:6, padding:'6px 12px', fontSize:11, cursor: docEmailSending ? 'wait' : 'pointer', fontFamily:'Montserrat,sans-serif' }}>
                  {docEmailSending ? 'Invio…' : 'Richiedi documenti via email'}
                </button>
                {docEmailResult === 'sent'  && <span style={{ fontSize:11, color:'#2E7D32' }}>✓ Email inviata</span>}
                {docEmailResult === 'error' && <span style={{ fontSize:11, color:'#C62828' }}>Errore</span>}
              </div>
              {d.iban && (
                <div style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:6, padding:'12px 14px', marginTop:12 }}>
                  <div style={{ fontSize:10, letterSpacing:'1px', textTransform:'uppercase', color:COLORS.textSecondary, marginBottom:4 }}>IBAN</div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:14, fontFamily:'monospace', color:COLORS.text, letterSpacing:1 }}>{showIban ? d.iban : maskedIban}</span>
                    <button onClick={() => setShowIban(v => !v)}
                      style={{ background:'none', border:`1px solid ${COLORS.border}`, borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer', color:COLORS.textSecondary, fontFamily:'Montserrat,sans-serif' }}>
                      {showIban ? 'Nascondi' : 'Mostra IBAN'}
                    </button>
                  </div>
                  {d.intestatario_conto && <div style={{ fontSize:11, color:COLORS.textSecondary, marginTop:4 }}>Intestatario: {d.intestatario_conto}</div>}
                  {d.codice_fiscale && <div style={{ fontSize:11, color:COLORS.textSecondary, marginTop:2 }}>CF: {d.codice_fiscale}</div>}
                </div>
              )}
            </div>
          ))}

          {/* EVENTI ATTIVI — CONVOCA */}
          {accSection('eventi', 'Eventi Attivi — Convoca', (
            <div>
              {activeEvents.length === 0 ? (
                <div style={{ fontSize:12, color:COLORS.textSecondary }}>Nessun evento LIVE o PLANNING al momento.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {activeEvents.map(evt => {
                    const ed = evt.data ?? {}
                    const req = Number(ed.hostess_richieste) || 0
                    const conf = Number(ed.hostess_confermate ?? 0)
                    const pct = req > 0 ? Math.round((conf / req) * 100) : 0
                    const satColor = pct >= 100 ? '#EF4444' : pct >= 80 ? '#F97316' : '#10B981'
                    const dataStr = ed.data_evento ? new Date(ed.data_evento).toLocaleDateString('it-IT') : '—'
                    return (
                      <div key={evt.entity_id} style={{ border:`1px solid ${COLORS.border}`, borderRadius:8, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                        <div style={{ flex:1, minWidth:150 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:COLORS.text, marginBottom:2 }}>{ed.titolo ?? '—'}</div>
                          <div style={{ fontSize:11, color:COLORS.textSecondary }}>{dataStr} · {ed.citta ?? ed.location ?? '—'}</div>
                          {req > 0 && (
                            <div style={{ fontSize:11, marginTop:4 }}>
                              <span style={{ color:satColor, fontWeight:600 }}>{conf}/{req}</span>
                              <span style={{ color:COLORS.textSecondary }}> ({pct}%) </span>
                              <span style={{ fontSize:9, background:`${satColor}22`, color:satColor, padding:'1px 6px', borderRadius:8, fontWeight:700 }}>{evt.status}</span>
                            </div>
                          )}
                        </div>
                        <button onClick={() => openConvoca(evt)}
                          style={{ background:COLORS.accent, color:'#fff', border:'none', borderRadius:6, padding:'7px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Montserrat,sans-serif', whiteSpace:'nowrap' }}>
                          Convoca →
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {/* STORICO CANDIDATURE */}
          {accSection('storico', 'Storico Candidature', (
            <div>
              {historyLoading && <div className="spinner" style={{ margin:'16px 0' }} />}
              {!historyLoading && history !== null && history.length === 0 && (
                <div style={{ fontSize:12, color:COLORS.textSecondary }}>Nessuna candidatura nel database.</div>
              )}
              {!historyLoading && (history ?? []).length > 0 && (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#f5f5f5' }}>
                        <th style={{ padding:'7px 10px', textAlign:'left', color:COLORS.textSecondary, fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Evento</th>
                        <th style={{ padding:'7px 10px', textAlign:'left', color:COLORS.textSecondary, fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Data</th>
                        <th style={{ padding:'7px 10px', textAlign:'left', color:COLORS.textSecondary, fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(app => {
                        const evt = eventMap[app.data?.event_id ?? app.data?.shift_id]
                        const evtTitle = evt?.data?.titolo ?? app.data?.event_id ?? '—'
                        const appDate = app.created_at ? new Date(app.created_at).toLocaleDateString('it-IT') : '—'
                        return (
                          <tr key={app.entity_id} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                            <td style={{ padding:'8px 10px', color:COLORS.text }}>{evtTitle}</td>
                            <td style={{ padding:'8px 10px', color:COLORS.textSecondary }}>{appDate}</td>
                            <td style={{ padding:'8px 10px' }}>{statusBadge(app.status)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          <div style={{ height:16 }} />
        </div>

        {/* Sticky bottom actions */}
        <div style={{ borderTop:`1px solid ${COLORS.border}`, padding:'12px 28px', flexShrink:0, background:'#fff' }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => { setEmailResult(null); setShowEmailModal(true) }}
              style={{ flex:'1 1 90px', padding:'9px 12px', background:'none', border:`1px solid ${COLORS.border}`, color:COLORS.text, borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>
              Invia email
            </button>
            <button onClick={() => { setSocialResult(null); setShowSocialModal(true) }}
              style={{ flex:'1 1 90px', padding:'9px 12px', background:'none', border:`1px solid ${COLORS.border}`, color:COLORS.text, borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}>
              Invita social
            </button>
            <button onClick={() => { setSospendiNota(''); setShowSospendiModal(true) }}
              style={{ flex:'1 1 90px', padding:'9px 12px', background:'none', color:'#EF4444', border:'1px solid #EF4444', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'Montserrat,sans-serif', fontWeight:600 }}>
              Sospendi
            </button>
            <DeleteEntityButton
              label="Elimina"
              confirmText="Elimina il profilo talent. L'account utente collegato NON viene rimosso. Inserisci la password per confermare."
              style={{ flex:'1 1 90px', padding:'9px 12px' }}
              onConfirm={async () => {
                const res = await talentApi.softDelete(talent.entity_id)
                if (!res.success) return false
                await adminStore.refresh()
                onSuspended?.()
                onClose()
                showToast('Eliminato')
                return true
              }}
            />
            <button onClick={() => { setContractResult(null); setContractEventId(''); setShowContractModal(true) }}
              style={{ flex:'1 1 90px', padding:'9px 12px', background:COLORS.accent, color:'#fff', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'Montserrat,sans-serif', fontWeight:700 }}>
              Genera contratto
            </button>
            <button
              onClick={handleGeneraScheda}
              disabled={cardLoading}
              style={{ flex:'1 1 90px', padding:'9px 12px', background: cardLoading ? '#e0e0e0' : '#1565C0', color: cardLoading ? '#999' : '#fff', border:'none', borderRadius:6, fontSize:12, cursor: cardLoading ? 'wait' : 'pointer', fontFamily:'Montserrat,sans-serif', fontWeight:700, transition:'background 0.15s' }}
            >
              {cardLoading ? 'Generazione…' : '📄 Scheda PDF'}
            </button>
          </div>
          {cardError && (
            <div style={{ marginTop:8, padding:'8px 12px', background:'#FFEBEE', borderRadius:6, fontSize:12, color:'#C62828' }}>
              {cardError}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// GROUP HEADER — used inside TalentsSection to separate the two groups
// ---------------------------------------------------------------------------

function GroupHeader({ label, count, badgeColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 12px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: COLORS.textSecondary }}>
        {label}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 700, background: badgeColor + '22', color: badgeColor,
        border: `1px solid ${badgeColor}44`, borderRadius: 12, padding: '2px 10px', whiteSpace: 'nowrap',
      }}>
        {count} profil{count !== 1 ? 'i' : 'o'}
      </span>
      <div style={{ flex: 1, height: 1, background: COLORS.border }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// TALENTS SECTION — exported for reuse in AdminDashboard overview
// ---------------------------------------------------------------------------

export function TalentsSection({ handleApiResponse }) {
  const [items,          setItems]          = useState([])
  const [profiles,       setProfiles]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [search,         setSearch]         = useState('')
  const [filterStatus,   setFilterStatus]   = useState('ALL')
  const [sortScore,      setSortScore]      = useState('DESC')
  const [filterCitta,    setFilterCitta]    = useState('')
  const [filterLingue,   setFilterLingue]   = useState([])   // array di value da LINGUE_FISSE
  const [filterDisp,     setFilterDisp]     = useState('')   // value da DISPONIBILITA_TIPI
  const [filterEsp,      setFilterEsp]      = useState('')   // valore da TIPOLOGIE_ESPERIENZA
  const [filterAltezzaMin, setFilterAltezzaMin] = useState('')
  const [filterAltezzaMax, setFilterAltezzaMax] = useState('')
  const [filterTaglia,   setFilterTaglia]   = useState('')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [page,           setPage]           = useState(1)
  const [selectedReview, setSelectedReview] = useState(null)
  const [selectedScheda, setSelectedScheda] = useState(null)
  const [selectedChanges,setSelectedChanges]= useState(null)
  const [actionLoading,  setActionLoading]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await adminStore.ensure()
    setLoading(false)
    if (!data) { setError('Errore nel caricamento dati.'); return }
    const seen = new Set()
    const profili = (data.leads ?? []).filter(l => {
      const key = (l.data?.email ?? l.entity_id ?? '').toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return l.status === 'COMPLETED_PENDING_APPROVAL' || l.status === 'APPROVED'
    })
    setItems(profili)
    setProfiles(data.talent_profiles ?? [])
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [filterStatus, search, sortScore, filterCitta, filterLingue, filterDisp, filterEsp, filterAltezzaMin, filterAltezzaMax, filterTaglia])

  const cittaOptions = useMemo(() =>
    Array.from(new Set(items.map(l => l.data?.citta).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
  [items])

  const profileByEmail = useMemo(() => {
    const m = {}
    profiles.forEach(p => {
      const email = (p.data?.email_contatto || '').toLowerCase()
      if (email) m[email] = p
    })
    return m
  }, [profiles])

  const pendingProfiles = useMemo(() =>
    profiles.filter(p => p.status === 'PENDING_REVIEW'),
  [profiles])

  const filtered = useMemo(() => {
    let list = [...items]
    if (filterStatus !== 'ALL') list = list.filter(l => l.status === filterStatus)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(l =>
        `${l.data?.nome ?? ''} ${l.data?.cognome ?? ''}`.toLowerCase().includes(q) ||
        (l.data?.email ?? '').toLowerCase().includes(q)
      )
    }
    if (filterCitta) list = list.filter(l => l.data?.citta === filterCitta)
    if (filterLingue.length > 0) {
      list = list.filter(l => filterLingue.some(campo => {
        const v = l.data?.[campo]
        return !!v && v !== 'Non conosco'
      }))
    }
    if (filterDisp) list = list.filter(l => l.data?.[filterDisp] === 'Sì')
    if (filterEsp) list = list.filter(l => safeArray(l.data?.tipologie_esperienza).includes(filterEsp))
    if (filterAltezzaMin) list = list.filter(l => Number(l.data?.altezza) >= Number(filterAltezzaMin))
    if (filterAltezzaMax) list = list.filter(l => Number(l.data?.altezza) <= Number(filterAltezzaMax))
    if (filterTaglia) list = list.filter(l => l.data?.taglia_tshirt === filterTaglia)
    list.sort((a, b) => sortScore === 'DESC'
      ? (Number(b.data?.score) || 0) - (Number(a.data?.score) || 0)
      : (Number(a.data?.score) || 0) - (Number(b.data?.score) || 0)
    )
    return list
  }, [items, filterStatus, search, sortScore, filterCitta, filterLingue, filterDisp, filterEsp, filterAltezzaMin, filterAltezzaMax, filterTaglia])

  const pendingList  = filtered.filter(l => l.status === 'COMPLETED_PENDING_APPROVAL')
  const approvedList = filtered.filter(l => l.status === 'APPROVED')

  const handleApprove = async (entity_id) => {
    setActionLoading(entity_id + '_approve')
    const res = handleApiResponse(await talentApi.approve(entity_id))
    setActionLoading(null)
    if (res.success) { setSelectedReview(null); await adminStore.refresh(); load() }
    else alert(getErrorMessage(res.error))
  }

  const handleReject = async (entity_id, nota) => {
    const motivo = nota.trim() || window.prompt('Motivo del rifiuto:') || ''
    setActionLoading(entity_id + '_reject')
    const res = handleApiResponse(await talentApi.reject(entity_id, motivo))
    setActionLoading(null)
    if (res.success) { setSelectedReview(null); await adminStore.refresh(); load() }
    else alert(getErrorMessage(res.error))
  }

  const handleApproveChanges = async (profile_id) => {
    setActionLoading(profile_id + '_approve')
    const res = handleApiResponse(await talentApi.approve(profile_id))
    setActionLoading(null)
    if (res.success) { setSelectedChanges(null); await adminStore.refresh(); load() }
    else alert(getErrorMessage(res.error))
  }

  const handleRejectChanges = async (profile_id, nota_rifiuto) => {
    setActionLoading(profile_id + '_reject')
    const res = handleApiResponse(await talentApi.reject(profile_id, nota_rifiuto))
    setActionLoading(null)
    if (res.success) { setSelectedChanges(null); await adminStore.refresh(); load() }
    else alert(getErrorMessage(res.error))
  }

  if (loading) return <div className="spinner" />
  if (error)   return <div className="error-banner">{error}</div>

  const BTN = {
    background:'none', border:'1px solid #630E33', color:'#630E33',
    borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer',
    fontFamily:'Montserrat,sans-serif', whiteSpace:'nowrap',
    transition:'background 0.15s, color 0.15s',
  }
  const hover = (e, on) => {
    e.currentTarget.style.background = on ? '#630E33' : 'none'
    e.currentTarget.style.color      = on ? '#fff'    : '#630E33'
  }

  const renderRow = (l) => {
    const photoExp      = photoExpiryStatus(l)
    const email         = (l.data?.email ?? '').toLowerCase()
    const linkedProfile = profileByEmail[email]
    const hasPending    = linkedProfile?.status === 'PENDING_REVIEW'
    return (
      <tr key={l.entity_id}>
        <td><TalentAvatar nome={l.data?.nome} fotoUrl={getFotoUrl(l.data)} size={36} /></td>
        <td>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {l.data?.nome} {l.data?.cognome}
            {hasPending && (
              <span style={{ fontSize:9, fontWeight:700, background:'#FFF3E0', color:'#E65100', border:'1px solid #F9A825', padding:'2px 7px', borderRadius:10, whiteSpace:'nowrap' }}>
                MODIFICHE IN ATTESA
              </span>
            )}
          </div>
        </td>
        <td style={{ color:'#8888A0', fontSize:12 }}>{l.data?.email}</td>
        <td>{l.data?.citta ?? '—'}</td>
        <td><ScoreBar score={l.data?.score} /></td>
        <td>
          {photoExp.status === 'expired' && (
            <span style={{ fontSize:10, fontWeight:700, color:'#EF4444', background:'#FFEBEE', padding:'2px 7px', borderRadius:10, whiteSpace:'nowrap' }}>Foto scadute</span>
          )}
          {photoExp.status === 'expiring' && (
            <span style={{ fontSize:10, fontWeight:700, color:'#F97316', background:'#FFF3E0', padding:'2px 7px', borderRadius:10, whiteSpace:'nowrap' }}>In scadenza</span>
          )}
        </td>
        <td>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {linkedProfile && (
              <button onClick={() => setSelectedScheda(linkedProfile)} onMouseEnter={e => hover(e,true)} onMouseLeave={e => hover(e,false)} style={BTN}>
                Scheda
              </button>
            )}
            {hasPending && (
              <button onClick={() => setSelectedChanges(linkedProfile)} style={{ ...BTN, border:'1px solid #E65100', color:'#E65100' }}>
                Modifiche →
              </button>
            )}
            {l.status === 'COMPLETED_PENDING_APPROVAL' && (
              <button onClick={() => setSelectedReview(l)} onMouseEnter={e => hover(e,true)} onMouseLeave={e => hover(e,false)} style={BTN}>
                Revisiona →
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  const tableHead = (
    <thead>
      <tr>
        <th style={{ width:48 }}></th>
        <th>Nome</th>
        <th>Email</th>
        <th>Città</th>
        <th style={{ minWidth:120 }}>Score</th>
        <th>Foto</th>
        <th></th>
      </tr>
    </thead>
  )

  return (
    <div>
      {/* Banner modifiche in attesa dai profili TALENT_PROFILE */}
      {pendingProfiles.length > 0 && (
        <div style={{ background:'#FFF8E1', border:'1px solid #F9A825', borderRadius:8, padding:'12px 16px', marginBottom:16, display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#E65100' }}>
            {pendingProfiles.length} profilo{pendingProfiles.length !== 1 ? 'i' : ''} con modifiche in attesa:
          </span>
          {pendingProfiles.map(p => (
            <button
              key={p.entity_id}
              onClick={() => setSelectedChanges(p)}
              style={{ background:'#E65100', color:'#fff', border:'none', borderRadius:6, padding:'4px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Montserrat,sans-serif' }}
            >
              {p.data?.nome} {p.data?.cognome}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8, alignItems:'center' }}>
        <input placeholder="Cerca nome o email…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...FILTER_INPUT, minWidth:180 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={FILTER_INPUT}>
          <option value="ALL">Tutti</option>
          <option value="COMPLETED_PENDING_APPROVAL">In Attesa</option>
          <option value="APPROVED">Approvato</option>
        </select>
        <select value={sortScore} onChange={e => setSortScore(e.target.value)} style={FILTER_INPUT}>
          <option value="DESC">Score ↓</option>
          <option value="ASC">Score ↑</option>
        </select>
        <select value={filterCitta} onChange={e => setFilterCitta(e.target.value)} style={FILTER_INPUT}>
          <option value="">Città (tutte)</option>
          {cittaOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {LINGUE_FISSE.map(l => {
            const active = filterLingue.includes(l.value)
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => setFilterLingue(prev => active ? prev.filter(v => v !== l.value) : [...prev, l.value])}
                style={{
                  ...FILTER_INPUT, padding:'6px 10px', cursor:'pointer',
                  background: active ? '#630E33' : '#fff',
                  color: active ? '#fff' : '#333333',
                  border: `1px solid ${active ? '#630E33' : '#e0e0e0'}`,
                }}
              >
                {l.label}
              </button>
            )
          })}
        </div>
        <select value={filterDisp} onChange={e => setFilterDisp(e.target.value)} style={FILTER_INPUT}>
          <option value="">Disponibilità (tutte)</option>
          {DISPONIBILITA_TIPI.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setShowMoreFilters(v => !v)}
          style={{ ...FILTER_INPUT, cursor:'pointer', color:'#630E33', border:'1px solid #630E33', background:'none' }}
        >
          Altri filtri {showMoreFilters ? '▲' : '▼'}
        </button>
        <span style={{ fontSize:12, color:'#8888A0', marginLeft:'auto', whiteSpace:'nowrap' }}>{filtered.length} profili</span>
      </div>

      {showMoreFilters && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, alignItems:'center', padding:'10px 12px', background:'#F8F8FB', borderRadius:8, border:`1px solid ${COLORS.border}` }}>
          <select value={filterEsp} onChange={e => setFilterEsp(e.target.value)} style={FILTER_INPUT}>
            <option value="">Esperienza professionale (tutte)</option>
            {TIPOLOGIE_ESPERIENZA.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterTaglia} onChange={e => setFilterTaglia(e.target.value)} style={FILTER_INPUT}>
            <option value="">Taglia (tutte)</option>
            {TAGLIE_SHIRT.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12, color:'#8888A0' }}>Altezza</span>
            <input type="number" placeholder="da" value={filterAltezzaMin} onChange={e => setFilterAltezzaMin(e.target.value)} style={{ ...FILTER_INPUT, width:64 }} />
            <span style={{ fontSize:12, color:'#8888A0' }}>—</span>
            <input type="number" placeholder="a" value={filterAltezzaMax} onChange={e => setFilterAltezzaMax(e.target.value)} style={{ ...FILTER_INPUT, width:64 }} />
            <span style={{ fontSize:11, color:'#8888A0' }}>cm</span>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">Nessun profilo talent.</div>
      ) : (
        <>
          {(filterStatus === 'ALL' || filterStatus === 'COMPLETED_PENDING_APPROVAL') && (
            <>
              <GroupHeader label="In attesa di approvazione" count={pendingList.length} badgeColor="#E65100" />
              {pendingList.length === 0 ? (
                <div style={{ fontSize:12, color:COLORS.textSecondary, padding:'12px 0 4px' }}>Nessun profilo in attesa.</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table className="data-table">{tableHead}<tbody>{pendingList.map(renderRow)}</tbody></table>
                </div>
              )}
            </>
          )}

          {(filterStatus === 'ALL' || filterStatus === 'APPROVED') && (
            <>
              <GroupHeader label="Profili approvati — Database Talent" count={approvedList.length} badgeColor="#2E7D32" />
              {approvedList.length === 0 ? (
                <div style={{ fontSize:12, color:COLORS.textSecondary, padding:'12px 0 4px' }}>Nessun profilo approvato.</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table className="data-table">{tableHead}<tbody>{approvedList.map(renderRow)}</tbody></table>
                </div>
              )}
            </>
          )}

          <Pagination page={page} totalPages={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} onPage={setPage} />
        </>
      )}

      {selectedReview && (
        <ReviewDrawer lead={selectedReview} onClose={() => setSelectedReview(null)} onApprove={handleApprove} onReject={handleReject} onDeleted={load} actionLoading={actionLoading} />
      )}
      {selectedScheda && (
        <TalentProfileDrawer
          talent={selectedScheda}
          onClose={() => setSelectedScheda(null)}
          handleApiResponse={handleApiResponse}
          onSuspended={() => { adminStore.refresh().then(load) }}
        />
      )}
      {selectedChanges && (
        <TalentChangesDrawer profile={selectedChanges} onClose={() => setSelectedChanges(null)} onApprove={handleApproveChanges} onReject={handleRejectChanges} actionLoading={actionLoading} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PENDING APPROVAL SECTION — compact, for AdminDashboard overview
// ---------------------------------------------------------------------------

export function PendingApprovalSection({ handleApiResponse }) {
  const [items,         setItems]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [selectedReview,setSelectedReview]= useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await adminStore.ensure()
    setLoading(false)
    if (!data) return
    const seen = new Set()
    const pending = (data.leads ?? []).filter(l => {
      const key = (l.data?.email ?? l.entity_id ?? '').toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return l.status === 'COMPLETED_PENDING_APPROVAL'
    })
    setItems(pending)
  }, [])

  useEffect(() => { load() }, [load])

  const handleApprove = async (entity_id) => {
    setActionLoading(entity_id + '_approve')
    const res = handleApiResponse(await talentApi.approve(entity_id))
    setActionLoading(null)
    if (res.success) { setSelectedReview(null); await adminStore.refresh(); load() }
    else alert(getErrorMessage(res.error))
  }

  const handleReject = async (entity_id, nota) => {
    setActionLoading(entity_id + '_reject')
    const res = handleApiResponse(await talentApi.reject(entity_id, nota))
    setActionLoading(null)
    if (res.success) { setSelectedReview(null); await adminStore.refresh(); load() }
    else alert(getErrorMessage(res.error))
  }

  if (loading) return <div className="spinner" />
  if (items.length === 0) return (
    <div className="empty-state" style={{ padding: '20px 0' }}>Nessun profilo in attesa di approvazione.</div>
  )

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 48 }}></th>
              <th>Nome</th>
              <th>Email</th>
              <th>Città</th>
              <th style={{ minWidth: 120 }}>Score</th>
              <th>Data invio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(l => (
              <tr key={l.entity_id}>
                <td><TalentAvatar nome={l.data?.nome} fotoUrl={getFotoUrl(l.data)} size={36} /></td>
                <td style={{ fontWeight: 600 }}>{l.data?.nome} {l.data?.cognome}</td>
                <td style={{ color: '#8888A0', fontSize: 12 }}>{l.data?.email}</td>
                <td>{l.data?.citta ?? l.data?.residenza_citta ?? '—'}</td>
                <td><ScoreBar score={l.data?.score} /></td>
                <td style={{ fontSize: 12, color: COLORS.textSecondary }}>
                  {l.data?.registration_completed_at ? new Date(l.data.registration_completed_at).toLocaleDateString('it-IT') : '—'}
                </td>
                <td>
                  <button
                    onClick={() => setSelectedReview(l)}
                    style={{ background: 'none', border: '1px solid #630E33', color: '#630E33', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}
                  >
                    Revisiona →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedReview && (
        <ReviewDrawer lead={selectedReview} onClose={() => setSelectedReview(null)} onApprove={handleApprove} onReject={handleReject} onDeleted={load} actionLoading={actionLoading} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PAGE WRAPPER
// ---------------------------------------------------------------------------

export default function TalentPage() {
  const { handleApiResponse } = useAuth()
  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageHeader
        title="Profili Talent"
        subtitle="Gestisci i profili talent — approvazione e revisione"
      />
      <TalentsSection handleApiResponse={handleApiResponse} />
    </Layout>
  )
}
