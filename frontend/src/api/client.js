// === API/CLIENT.JS — MADE EVENTS Platform ===
// Wrapper fetch verso il Google Apps Script endpoint.
//
// ISTRUZIONE: dopo aver pubblicato la Web App dal GAS Editor,
// sostituire GAS_ENDPOINT con l'URL fornito da GAS
// (es. https://script.google.com/macros/s/AKfycby.../exec)

export const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxx22bM7g-QPdhh_fqSy1mwhKQdh8zg6f3IgK2ah8P8F_cSEOtaKM_l66G2gs9CKm3i/exec'

// ---------------------------------------------------------------------------
// CORE FETCH
// ---------------------------------------------------------------------------

/**
 * Invia una request al backend GAS.
 * Usa Content-Type: text/plain per evitare CORS preflight con GAS.
 */
const GAS_TIMEOUT_MS        = 45_000  // 45s — copre cold start GAS (~15-30s)
const GAS_UPLOAD_TIMEOUT_MS = 120_000 // 120s — per upload file base64 (cold start + Drive write)

async function gasPost(action, payload = {}, token = null, timeoutMs = GAS_TIMEOUT_MS) {
  const body = { action, payload }
  if (token) body.token = token

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(GAS_ENDPOINT, {
      method:   'POST',
      redirect: 'follow',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      body:     JSON.stringify(body),
      signal:   controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      return { success: false, error: { code: 'SYS_001', message: `HTTP ${res.status}` } }
    }

    return await res.json()
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      return { success: false, error: { code: 'SYS_003', message: 'Timeout — server non raggiungibile' } }
    }
    return {
      success: false,
      error: { code: 'SYS_001', message: err.message || 'Errore di connessione al server' },
    }
  }
}

// ---------------------------------------------------------------------------
// TOKEN HELPERS
// ---------------------------------------------------------------------------

export function getToken() {
  return localStorage.getItem('made_event_token')
}

export function setToken(token) {
  localStorage.setItem('made_event_token', token)
}

export function removeToken() {
  localStorage.removeItem('made_event_token')
}

/** Decodifica il payload del token (base64 web-safe) senza verifica firma. */
export function decodeToken(token) {
  if (!token) return null
  try {
    const [payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// ERROR CODE → MESSAGGIO UI (PRD BLOCK:API_CONTRACT)
// ---------------------------------------------------------------------------

export const ERROR_MESSAGES = {
  AUTH_001: 'Sessione non valida. Effettua il login.',
  AUTH_002: 'Sessione scaduta. Effettua nuovamente il login.',
  AUTH_003: 'Credenziali non valide.',
  AUTH_004: 'Account non attivo. Contatta l\'amministratore.',
  AUTH_005: 'Non hai i permessi per questa operazione.',
  AUTH_006: 'Accesso non autorizzato.',
  VAL_001:  'Compila tutti i campi obbligatori.',
  VAL_002:  'Formato non valido.',
  VAL_004:  'Email già registrata.',
  WF_001:   'Operazione non consentita nello stato attuale.',
  WF_002:   'Entità non nello stato corretto.',
  WF_003:   'Il turno non è aperto alle candidature.',
  WF_004:   'Il turno è al completo.',
  BIZ_001:  'Hai già una candidatura attiva per questo turno.',
  BIZ_002:  'Il tuo profilo non è ancora approvato.',
  BIZ_003:  'Profilo talent non trovato per il tuo account.',
  BIZ_004:  'Hai già un turno nello stesso orario.',
  SYS_001:  'Errore di sistema. Riprova tra qualche istante.',
  SYS_002:  'Elemento non trovato.',
  SYS_003:  'Timeout. Riprova.',
}

export function getErrorMessage(error) {
  if (!error) return 'Errore sconosciuto.'
  return ERROR_MESSAGES[error.code] || error.message || 'Errore sconosciuto.'
}

/** Verifica se l'errore richiede redirect al login */
export function isAuthError(error) {
  return error && (error.code === 'AUTH_001' || error.code === 'AUTH_002')
}

// ---------------------------------------------------------------------------
// API ACTIONS — organizzate per modulo
// ---------------------------------------------------------------------------

const t = () => getToken()

export const authApi = {
  login:                (email, password)           => gasPost('auth.login',                { email, password }),
  logout:               ()                          => gasPost('auth.logout',               {}, t()),
  getMe:                ()                          => gasPost('auth.getMe',                {}, t()),
  changePassword:       (old_password, new_password) =>
                                                       gasPost('auth.changePassword',       { old_password, new_password }, t()),
  requestPasswordReset: (email)                     => gasPost('auth.requestPasswordReset', { email }),
  validateResetToken:   (token)                     => gasPost('auth.validateResetToken',   { token }),
  confirmPasswordReset: (token, new_password)       => gasPost('auth.confirmPasswordReset', { token, new_password }),
}

export const userApi = {
  list:       (payload = {})   => gasPost('user.list',       payload,  t()),
  get:        (user_id)        => gasPost('user.get',        { user_id }, t()),
  create:     (payload)        => gasPost('user.create',     payload,  t()),
  update:     (payload)        => gasPost('user.update',     payload,  t()),
  deactivate: (user_id)        => gasPost('user.deactivate', { user_id }, t()),
}

export const talentApi = {
  registerStep1:  (payload)   => gasPost('talent.registerStep1', payload),
  registerStep2:  (payload)   => gasPost('talent.registerStep2', payload),
  registerStep3:  (payload)   => gasPost('talent.registerStep3', payload),
  getLead:        (lead_token) => gasPost('talent.getLead', { lead_token }),
  uploadRegistrationDoc: (lead_id, email, tipo_doc, file_base64, filename, mime_type) =>
    gasPost('talent.uploadRegistrationDoc', { lead_id, email, tipo_doc, file_base64, filename, mime_type }, null, GAS_UPLOAD_TIMEOUT_MS),
  list:           (payload = {}) => gasPost('talent.list',        payload, t()),
  get:            (entity_id) => gasPost('talent.get',            { entity_id }, t()),
  approve:        (entity_id, nota) => gasPost('talent.approve',  { entity_id, nota }, t()),
  reject:         (entity_id, nota_rifiuto) =>
                                  gasPost('talent.reject',        { entity_id, nota_rifiuto }, t()),
  updateProfile:    (payload)               => gasPost('talent.updateProfile',    payload, t()),
  updateScoreAdmin:    (entity_id, score_admin)   => gasPost('talent.updateScoreAdmin',    { entity_id, score_admin }, t()),
  updateEventiPreCRM: (entity_id, eventi_precrm) => gasPost('talent.updateEventiPreCRM', { entity_id, eventi_precrm }, t()),
  generateCard:       (talent_id)                => gasPost('talent.generateCard',        { talent_id },               t(), GAS_UPLOAD_TIMEOUT_MS),
}

export const leadApi = {
  list:       (payload = {})    => gasPost('lead.list',       payload,               t()),
  solicit:    (entity_id)       => gasPost('lead.solicit',    { entity_id },          t()),
  update:     (entity_id, data) => gasPost('lead.update',     { entity_id, ...data }, t()),
  getByEmail: (email)           => gasPost('lead.getByEmail', { email }),
}

export const clientApi = {
  create:     (payload)   => gasPost('client.create',     payload,       t()),
  list:       (payload={})=> gasPost('client.list',       payload,       t()),
  get:        (entity_id) => gasPost('client.get',        { entity_id }, t()),
  update:     (payload)   => gasPost('client.update',     payload,       t()),
  softDelete: (entity_id) => gasPost('client.softDelete', { entity_id }, t()),
}

export const eventApi = {
  create:       (payload)          => gasPost('event.create',       payload, t()),
  list:         (payload = {})     => gasPost('event.list',         payload, t()),
  get:          (entity_id)        => gasPost('event.get',          { entity_id }, t()),
  update:       (payload)          => gasPost('event.update',       payload, t()),
  updateStatus: (entity_id, new_status) =>
                                      gasPost('event.updateStatus', { entity_id, new_status }, t()),
  cancel:       (entity_id)        => gasPost('event.cancel',       { entity_id }, t()),
  softDelete:          (entity_id) => gasPost('event.softDelete',         { entity_id }, t()),
  getMatchingTalents:  (event_id)  => gasPost('event.getMatchingTalents', { event_id  }, t()),
}

export const shiftApi = {
  create:       (payload)          => gasPost('shift.create',       payload, t()),
  list:         (payload = {})     => gasPost('shift.list',         payload, t()),
  get:          (entity_id)        => gasPost('shift.get',          { entity_id }, t()),
  updateStatus: (entity_id, new_status) =>
                                      gasPost('shift.updateStatus', { entity_id, new_status }, t()),
}

export const applicationApi = {
  submit:         (shift_id, messaggio = '') =>
                    gasPost('application.submit',       { shift_id, messaggio }, t()),
  submitForEvent: (event_id, messaggio = '') =>
                    gasPost('application.submit',       { event_id, messaggio }, t()),
  invite:         (talent_profile_id, event_id, messaggio = '') =>
                    gasPost('application.invite',       { talent_profile_id, event_id, messaggio }, t()),
  approve:        (entity_id)              => gasPost('application.approve',      { entity_id }, t()),
  reject:         (entity_id, nota_rifiuto = '') =>
                    gasPost('application.reject',       { entity_id, nota_rifiuto }, t()),
  withdraw:       (entity_id)              => gasPost('application.withdraw',     { entity_id }, t()),
  list:           (payload = {})           => gasPost('application.list',         payload, t()),
  listAll:        ()                       => gasPost('application.listAll',      {},       t()),
  updateStatus:   (entity_id, new_status)  => gasPost('application.updateStatus', { entity_id, new_status }, t()),
  markEventCompleted: (application_id)     => gasPost('application.markEventCompleted', { application_id }, t()),
}

export const assignmentApi = {
  list:          (payload = {}) => gasPost('assignment.list',          payload, t()),
  checkin:       (entity_id, lat = null, lng = null) =>
                                   gasPost('assignment.checkin',       { entity_id, lat, lng }, t()),
  checkout:      (entity_id, lat = null, lng = null) =>
                                   gasPost('assignment.checkout',      { entity_id, lat, lng }, t()),
  validate:      (entity_id)    => gasPost('assignment.validate',      { entity_id }, t()),
  updatePayment: (entity_id)    => gasPost('assignment.updatePayment', { entity_id }, t()),
}

export const dashboardApi = {
  bootstrap: () => gasPost('dashboard.bootstrap', {}, t()),
}

export const contractApi = {
  generate: (talent_profile_id, event_id) =>
    gasPost('contract.generate', { talent_profile_id, event_id }, t()),
}

export const documentApi = {
  upload: (talent_profile_id, tipo_documento, file_base64, filename, mime_type) =>
    gasPost('document.upload', { talent_profile_id, tipo_documento, file_base64, filename, mime_type }, t()),
  get:    (talent_profile_id, tipo_documento) =>
    gasPost('document.get', { talent_profile_id, tipo_documento }, t()),
}

export const emailApi = {
  sendCustom: (to, nome, body, tipo = 'custom') =>
    gasPost('email.sendCustom', { to, nome, body, tipo }, t()),
  sendConvocazione: (to, nome, titolo_evento, data_evento, luogo_evento, body) =>
    gasPost('email.sendConvocazione', { to, nome, titolo_evento, data_evento, luogo_evento, body }, t()),
}

export const newsletterApi = {
  preview:      (tier)    => gasPost('newsletter.preview',      { tier },    t()),
  setFrequency: (payload) => gasPost('newsletter.setFrequency', payload,     t()),
}
