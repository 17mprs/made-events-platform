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
  'email.sendCustom': { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },

  // SYSTEM
  'config.get':    { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' },
  'config.update': { SUPER_ADMIN:'Y', ADMIN:'N', USER:'N', CLIENTE:'N' },
  'log.view':      { SUPER_ADMIN:'Y', ADMIN:'Y', USER:'N', CLIENTE:'N' }
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
