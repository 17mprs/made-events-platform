// === UTILS.JS — MADE EVENT Platform v1.0 ===
// Permission matrix (PRD), helpers condivisi, paginazione, validazione.

// ---------------------------------------------------------------------------
// PERMISSION MATRIX (PRD BLOCK:PERMISSION_MATRIX)
// Y = accesso pieno | O = solo propri dati | N = negato
// ---------------------------------------------------------------------------

var PERMISSION_MATRIX = {
  // AUTH
  'auth.login':          { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'Y', CLIENTE:'Y' },
  'auth.logout':         { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'Y', CLIENTE:'Y' },
  'auth.getMe':          { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'Y', CLIENTE:'Y' },
  'auth.changePassword': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'Y', CLIENTE:'Y' },

  // USER MANAGEMENT
  'user.create':         { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'user.list':           { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'user.get':            { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'O', CLIENTE:'N' },
  'user.update':         { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'O', CLIENTE:'N' },
  'user.deactivate':     { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // TALENT
  'talent.registerStep1': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'Y', CLIENTE:'N' },
  'talent.registerStep2': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'Y', CLIENTE:'N' },
  'talent.registerStep3': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'Y', CLIENTE:'N' },
  'talent.approve':       { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'talent.reject':        { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'talent.list':          { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'O', CLIENTE:'N' },
  'talent.get':           { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'O', CLIENTE:'N' },
  'talent.updateProfile': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'O', CLIENTE:'N' },

  // CLIENT
  'client.create':        { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'client.list':          { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'client.get':           { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'O' },
  'client.update':        { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // EVENT
  'event.create':         { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'event.list':           { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'Y', CLIENTE:'O' },
  'event.get':            { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'Y', CLIENTE:'O' },
  'event.updateStatus':   { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'event.cancel':         { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'event.softDelete':     { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // SHIFT
  'shift.create':         { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'shift.list':           { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'Y', CLIENTE:'O' },
  'shift.get':            { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'O', CLIENTE:'O' },
  'shift.updateStatus':   { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // APPLICATION
  'application.submit':   { SUPER_ADMIN:'N', ADMIN:'N', USER:'Y', CLIENTE:'N' },
  'application.approve':  { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'application.reject':   { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'application.withdraw': { SUPER_ADMIN:'N', ADMIN:'N', USER:'O', CLIENTE:'N' },
  'application.list':     { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'O', CLIENTE:'N' },

  // ASSIGNMENT
  'assignment.list':          { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'O', CLIENTE:'O' },
  'assignment.checkin':       { SUPER_ADMIN:'N', ADMIN:'N', USER:'O', CLIENTE:'N' },
  'assignment.checkout':      { SUPER_ADMIN:'N', ADMIN:'N', USER:'O', CLIENTE:'N' },
  'assignment.validate':      { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'O' },
  'assignment.updatePayment': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // LEAD
  'lead.list':     { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'lead.update':   { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'lead.solicit':  { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // CONTRACT
  'contract.generate': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // TENANT
  'tenant.list':   { SUPER_ADMIN:'Y', ADMIN:'N', USER:'N', CLIENTE:'N' },
  'tenant.get':    { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // DOCUMENTI / DRIVE
  'document.upload': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'O', CLIENTE:'N' },
  'document.get':    { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'O', CLIENTE:'N' },
  'document.delete': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'drive.setup':     { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // DASHBOARD
  'dashboard.bootstrap': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // EVENT (update)
  'event.update':        { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // APPLICATION (invite + updateStatus)
  'application.invite':        { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'application.updateStatus':  { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // EMAIL
  'email.sendCustom':       { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'email.sendConvocazione': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // SYSTEM
  'config.get':    { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'config.update': { SUPER_ADMIN:'Y', ADMIN:'N', USER:'N', CLIENTE:'N' },
  'log.view':      { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // TALENT SCORING
  'talent.updateScoreAdmin': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' }
};

// ---------------------------------------------------------------------------
// PERMISSION HELPERS
// ---------------------------------------------------------------------------

/**
 * Restituisce 'Y', 'O', o 'N' per ruolo + action.
 */
function getPermission(role, action) {
  var matrix = PERMISSION_MATRIX[action];
  if (!matrix) return 'N';
  return matrix[role] || 'N';
}

/**
 * Controlla permesso: ritorna { allowed, ownOnly }.
 * ownOnly=true significa che l'utente può accedere solo ai propri dati.
 */
function checkPermission(role, action) {
  var perm = getPermission(role, action);
  return {
    allowed: perm !== 'N',
    ownOnly: perm === 'O'
  };
}

// ---------------------------------------------------------------------------
// VALIDATION HELPERS
// ---------------------------------------------------------------------------

/**
 * Verifica che tutti i campi obbligatori siano presenti nel payload.
 * Ritorna errorResponse se mancante, null se tutto ok.
 */
function requireFields(payload, fields) {
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var v = payload[f];
    if (v === undefined || v === null || String(v).trim() === '') {
      return { success: false, error: { code: 'VAL_001', message: 'Campo obbligatorio mancante: ' + f, field: f } };
    }
  }
  return null;
}

/**
 * Verifica formato email (basic).
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

// ---------------------------------------------------------------------------
// PAGINAZIONE
// ---------------------------------------------------------------------------

/**
 * Pagina un array di items.
 * Ritorna { items, total, page, limit, pages }.
 */
function paginateResults(items, page, limit) {
  page  = Math.max(1, parseInt(page)  || 1);
  limit = Math.min(
    Math.max(1, parseInt(limit) || SYSTEM_CONFIG.PAGINATION_DEFAULT),
    SYSTEM_CONFIG.PAGINATION_MAX
  );
  var total = items.length;
  var start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total: total,
    page:  page,
    limit: limit,
    pages: Math.ceil(total / limit)
  };
}

// ---------------------------------------------------------------------------
// CONFIG RESOLUTION (PRD: tenant > system > hardcoded)
// ---------------------------------------------------------------------------

var CONFIG_DEFAULTS = {
  'auth.token_expiry_hours':      8,
  'auth.max_login_attempts':      5,
  'rate_limit.req_per_minute':    60,
  'reminder.enabled':             false,
  'tenant.shift_full_auto':       true,
  'talent.min_score_apply':       0,
  'talent.require_cv':            true,
  'checkin.geolocation_required': false,
  'checkin.radius_meters':        500
};

function getConfig(key, tenantId) {
  try {
    var rows = getAllRows('SystemConfig');
    if (tenantId) {
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].key) === key && String(rows[i].tenant_id) === String(tenantId)) {
          return rows[i].value;
        }
      }
    }
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].key) === key && rows[i].scope === 'SYSTEM') {
        return rows[i].value;
      }
    }
  } catch (e) {
    // foglio non disponibile
  }
  return CONFIG_DEFAULTS.hasOwnProperty(key) ? CONFIG_DEFAULTS[key] : null;
}

// ---------------------------------------------------------------------------
// UTILITY GENERICHE
// ---------------------------------------------------------------------------

function toISOString(date) {
  return (date || new Date()).toISOString();
}

function parseJSON(str) {
  if (!str || str === '') return {};
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch (e) { return {}; }
}

function serializeJSON(obj) {
  if (!obj) return '{}';
  if (typeof obj === 'string') return obj;
  try { return JSON.stringify(obj); } catch (e) { return '{}'; }
}

/**
 * Calcola ore e minuti tra due timestamp.
 */
function calcTimesheet(checkinTs, checkoutTs) {
  var diffMs = checkoutTs - checkinTs;
  if (diffMs < 0) diffMs = 0;
  var totalMinutes = Math.floor(diffMs / 60000);
  return {
    ore_lavorate:     Math.floor(totalMinutes / 60),
    minuti_lavorati:  totalMinutes % 60,
    totale_minuti:    totalMinutes
  };
}

/**
 * Genera password temporanea sicura (12 chars).
 */
function generateTempPassword() {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  var pwd = '';
  for (var i = 0; i < 12; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

// ---------------------------------------------------------------------------
// TALENT SCORING — Algoritmo questionario + formula pesata admin
// ---------------------------------------------------------------------------

function calculateQuestionarioScore(data) {
  var score = 0;

  // 1. INGLESE (14%)
  var ingleseMap = { 'Madrelingua':100, 'Fluente':90, 'Intermedio':60, 'Base':30 };
  var ingleseScore = ingleseMap[data.lingua_inglese] || 0;
  if (data.inglese_certificato && ingleseScore >= 60) ingleseScore = Math.min(ingleseScore + 10, 100);
  score += ingleseScore * 0.14;

  // 2. TAGLIA PANTALONE (10%)
  var taglia = parseInt(data.taglia_pantalone) || 0;
  var tagliaScore = taglia === 40 ? 100 : taglia === 38 ? 95 : taglia === 42 ? 80 : taglia === 44 ? 50 : taglia > 44 ? 20 : 60;
  score += tagliaScore * 0.10;

  // 3. ALTEZZA (10%)
  var altezza = parseInt(data.altezza) || 0;
  var altezzaScore = (altezza >= 170 && altezza <= 178) ? 100
    : (altezza >= 165 && altezza < 170) ? 80
    : (altezza > 178 && altezza <= 182) ? 85
    : altezza < 160 ? 0 : 50;
  score += altezzaScore * 0.10;

  // 4. ESPERIENZA ANNI (11%)
  var expMap = { 'Oltre 5':100, '3–5':80, '1–3':50, '0–1':10 };
  score += (expMap[data.anni_esperienza_settore] || 0) * 0.11;

  // 5. ALTRE LINGUE (8%)
  var altreLingue = Array.isArray(data.altre_lingue) ? data.altre_lingue.filter(function(l) { return l.nome && l.livello && l.livello !== 'Non conosco'; }).length : 0;
  // Conta anche lingue standard (francese, spagnolo, tedesco)
  var stdLingue = ['lingua_francese','lingua_spagnolo','lingua_tedesco'];
  for (var i = 0; i < stdLingue.length; i++) {
    if (data[stdLingue[i]] && data[stdLingue[i]] !== 'Non conosco') altreLingue++;
  }
  score += Math.min(altreLingue * 33, 100) * 0.08;

  // 6. AUTOMUNITA (7%)
  score += (data.automunita === 'Sì' ? 100 : 0) * 0.07;

  // 7. TAILLEUR (7%)
  var dotazione = Array.isArray(data.dotazione_personale) ? data.dotazione_personale : [];
  var hasTailleur = dotazione.some(function(d) { return d.indexOf('Tailleur') > -1 || d.indexOf('pantalone e giacca') > -1; });
  score += (hasTailleur ? 100 : 0) * 0.07;

  // 8. TATUAGGI (7%)
  score += (data.tatuaggi_visibili === 'No' ? 100 : 0) * 0.07;

  // 9. PIERCING (5%)
  score += (data.piercing_visibili === 'No' ? 100 : 0) * 0.05;

  // 10. TITOLO STUDIO (8%)
  var titoloMap = { 'Laurea magistrale':100, 'Laurea triennale':90, 'Laurea':85, 'Diploma':60, 'Media superiore':40, 'Licenza media':0 };
  score += (titoloMap[data.titolo_studio] || 0) * 0.08;

  // 11. TIPOLOGIE ESPERIENZA (10%)
  var tipologie = Array.isArray(data.tipologie_esperienza) ? data.tipologie_esperienza : [];
  score += Math.min((tipologie.length / 8) * 100, 100) * 0.10;

  return Math.round(Math.min(100, Math.max(0, score)));
}

function calculateFinalScore(scoreQuestionario, scoreAdmin) {
  var scoreAdminNorm = ((scoreAdmin || 5) / 10) * 100;
  return Math.round((scoreQuestionario * 0.65) + (scoreAdminNorm * 0.35));
}
