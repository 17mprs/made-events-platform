// === CODE.JS — MADE EVENT Platform v1.0 ===
// Router principale: doPost riceve JSON, autentica, smista su action.
// doGet: health check.

// ---------------------------------------------------------------------------
// HTTP ENTRY POINTS
// ---------------------------------------------------------------------------

function doGet(e) {
  return jsonResponse_(successResponse({
    status:    'ok',
    version:   SYSTEM_CONFIG.VERSION,
    product:   'MADE EVENTS Platform',
    timestamp: new Date().toISOString()
  }));
}

function doPost(e) {
  var raw = '';
  try {
    if (e && e.postData && e.postData.contents) {
      raw = e.postData.contents;
    } else if (e && e.parameter && e.parameter.payload) {
      raw = e.parameter.payload;
    } else if (e && e.parameters) {
      var keys = Object.keys(e.parameters);
      if (keys.length > 0) {
        raw = decodeURIComponent(keys.map(function(k) {
          var vals = e.parameters[k];
          return (vals && vals[0] !== '') ? k + '=' + vals[0] : k;
        }).join('&'));
      }
    }
    var body = JSON.parse(raw || '{}');
  } catch (err) {
    return jsonResponse_(errorResponse('SYS_001', 'JSON non valido: ' + (raw || '').substring(0, 200)));
  }

  var action  = body.action;
  var token   = body.token  || null;
  var payload = body.payload || {};

  if (!action) {
    return jsonResponse_(errorResponse('VAL_001', 'Campo "action" obbligatorio'));
  }

  try {
    var result = handleRequest(action, payload, token);
    return jsonResponse_(result);
  } catch (err) {
    logError_('CODE', action, err.message, err.stack || '', null, null);
    return jsonResponse_(errorResponse('SYS_001', 'Errore interno: ' + err.message));
  }
}

// ---------------------------------------------------------------------------
// ROUTER PRINCIPALE
// ---------------------------------------------------------------------------

// Actions pubbliche (nessun token richiesto)
var PUBLIC_ACTIONS = {
  'auth.login':                    true,
  'auth.requestPasswordReset':     true,
  'auth.validateResetToken':       true,
  'auth.confirmPasswordReset':     true,
  'talent.registerStep1':          true,
  'talent.registerStep2':          true,
  'talent.registerStep3':          true,
  'talent.getLead':                true,
  'talent.uploadRegistrationDoc':  true,
  'lead.getByEmail':               true,
};

function handleRequest(action, payload, token) {
  // --- Azioni pubbliche ---
  if (PUBLIC_ACTIONS[action]) {
    switch (action) {
      case 'auth.login':                return login(payload.email, payload.password);
      case 'auth.requestPasswordReset': return handleRequestPasswordReset(payload);
      case 'auth.validateResetToken':   return handleValidateResetToken(payload);
      case 'auth.confirmPasswordReset': return handleConfirmPasswordReset(payload);
      case 'talent.registerStep1': return handleRegisterStep1(payload);
      case 'talent.registerStep2': return handleRegisterStep2(payload);
      case 'talent.registerStep3': return handleRegisterStep3(payload);
      case 'talent.getLead':               return handleGetLead(payload);
      case 'talent.uploadRegistrationDoc': return handleUploadRegistrationDoc(payload);
      case 'lead.getByEmail':              return handleLeadGetByEmail(payload);
    }
  }

  // --- Tutte le altre: verifica token ---
  var tokenCheck = verifyToken(token);
  if (!tokenCheck.valid) {
    var tokenMsg = tokenCheck.error === 'AUTH_002' ? 'Token scaduto' : 'Token mancante o non valido';
    return errorResponse(tokenCheck.error || 'AUTH_001', tokenMsg);
  }

  var auth = tokenCheck.payload; // { user_id, tenant_id, role, email, pwd_version, iat, exp }

  // Verifica permesso per l'action
  var perm = checkPermission(auth.role, action);
  if (!perm.allowed) {
    return errorResponse('AUTH_005', 'Permesso insufficiente per: ' + action);
  }

  // Tenant isolation check: il tenant nel token deve corrispondere al dato richiesto
  // (ogni handler può fare ulteriori controlli granulari)

  // --- Dispatch ---
  switch (action) {

    // AUTH
    case 'auth.getMe':          return getCurrentUser(token);
    case 'auth.logout':         return handleLogout(token, auth);
    case 'auth.changePassword': return handleChangePassword(payload, auth);

    // USER MANAGEMENT
    case 'user.create':     return handleUserCreate(payload, auth);
    case 'user.list':       return handleUserList(payload, auth);
    case 'user.get':        return handleUserGet(payload, auth);
    case 'user.update':     return handleUserUpdate(payload, auth);
    case 'user.deactivate': return handleUserDeactivate(payload, auth);

    // TALENT
    case 'talent.approve':           return handleTalentApprove(payload, auth);
    case 'talent.reject':            return handleTalentReject(payload, auth);
    case 'talent.resendCredentials': return handleTalentResendCredentials(payload, auth);
    case 'talent.list':              return handleTalentList(payload, auth);
    case 'talent.get':               return handleTalentGet(payload, auth);
    case 'talent.updateProfile':     return handleTalentUpdateProfile(payload, auth);
    case 'talent.updateScoreAdmin':  return handleUpdateScoreAdmin(payload, auth);
    case 'talent.updateEventiPreCRM': return handleUpdateEventiPreCRM(payload, auth);
    case 'talent.generateCard':      return handleGenerateTalentCard(payload, auth);
    case 'talent.softDelete':        return handleTalentSoftDelete(payload, auth);

    // CLIENT
    case 'client.create':     return handleClientCreate(payload, auth);
    case 'client.list':       return handleClientList(payload, auth);
    case 'client.get':        return handleClientGet(payload, auth);
    case 'client.update':     return handleClientUpdate(payload, auth);
    case 'client.softDelete': return handleClientSoftDelete(payload, auth);

    // EVENT
    case 'event.create':       return handleEventCreate(payload, auth);
    case 'event.list':         return handleEventList(payload, auth);
    case 'event.get':          return handleEventGet(payload, auth);
    case 'event.update':       return handleEventUpdate(payload, auth);
    case 'event.updateStatus': return handleEventUpdateStatus(payload, auth);
    case 'event.cancel':       return handleEventCancel(payload, auth);
    case 'event.softDelete':          return handleEventSoftDelete(payload, auth);
    case 'event.getMatchingTalents':  return handleGetMatchingTalents(payload, auth);

    // SHIFT
    case 'shift.create':       return handleShiftCreate(payload, auth);
    case 'shift.list':         return handleShiftList(payload, auth);
    case 'shift.get':          return handleShiftGet(payload, auth);
    case 'shift.updateStatus': return handleShiftUpdateStatus(payload, auth);

    // APPLICATION
    case 'application.submit':       return handleApplicationSubmit(payload, auth);
    case 'application.invite':       return handleApplicationInvite(payload, auth);
    case 'application.approve':            return handleApplicationApprove(payload, auth);
    case 'application.revoke':             return handleApplicationRevoke(payload, auth);
    case 'application.assignShift':        return handleApplicationAssignShift(payload, auth);
    case 'application.reject':             return handleApplicationReject(payload, auth);
    case 'application.withdraw':           return handleApplicationWithdraw(payload, auth);
    case 'application.list':               return handleApplicationList(payload, auth);
    case 'application.updateStatus':       return handleApplicationUpdateStatus(payload, auth);
    case 'application.markEventCompleted': return handleMarkEventCompleted(payload, auth);
    case 'application.listAll':           return handleApplicationListAll(payload, auth);

    // ASSIGNMENT
    case 'assignment.list':          return handleAssignmentList(payload, auth);
    case 'assignment.checkin':       return handleAssignmentCheckin(payload, auth);
    case 'assignment.checkout':      return handleAssignmentCheckout(payload, auth);
    case 'assignment.validate':      return handleAssignmentValidate(payload, auth);
    case 'assignment.updatePayment': return handleAssignmentUpdatePayment(payload, auth);

    // TENANT
    case 'tenant.list': return handleTenantList(payload, auth);
    case 'tenant.get':  return handleTenantGet(payload, auth);

    // DRIVE / DOCUMENTI
    case 'document.upload': return handleDocumentUpload(payload, auth);
    case 'document.get':    return handleDocumentGet(payload, auth);
    case 'document.delete': return handleDocumentDelete(payload, auth);
    case 'drive.setup':     return handleDriveSetup(payload, auth);

    // LEAD
    case 'lead.list':       return handleLeadList(payload, auth);
    case 'lead.update':     return handleLeadUpdate(payload, auth);
    case 'lead.solicit':    return handleLeadSolicit(payload, auth);
    case 'lead.softDelete': return handleLeadSoftDelete(payload, auth);

    // LEGACY IMPORT (recupero talent vecchio DB, 2026-09)
    case 'lead.importLegacy':   return handleLeadImportLegacy(payload, auth);
    case 'lead.resetSolleciti': return handleLeadResetSolleciti(payload, auth);

    // CONTRACT
    case 'contract.generate': return handleContractGenerate(payload, auth);

    // EMAIL
    case 'email.sendCustom':       return handleEmailSendCustom(payload, auth);
    case 'email.sendConvocazione': return handleEmailSendConvocazione(payload, auth);

    // LOGGING
    case 'log.view': return handleLogView(payload, auth);

    // DASHBOARD
    case 'dashboard.bootstrap': return handleDashboardBootstrap(payload, auth);

    // NEWSLETTER
    case 'newsletter.preview':          return getNewsletterPreview(payload.tier);
    case 'newsletter.setFrequency':     return handleNewsletterSetFrequency(payload, auth);
    case 'newsletter.sendTier1ToOne':   return handleNewsletterSendTier1ToOne(payload);
    case 'newsletter.sendTier2ToOne':   return handleNewsletterSendTier2ToOne(payload);

    // SYSTEM
    case 'config.get':  return handleConfigGet(payload, auth);
    case 'demo.reset':  return handleDemoReset(payload, auth);

    // BACKFILL (BUG7)
    case 'talent.backfillFromLead': return handleTalentBackfillFromLead(payload, auth);
    case 'event.backfillSaturation': return handleEventBackfillSaturation(payload, auth);
    case 'event.backfillMissingAssignments': return handleEventBackfillMissingAssignments(payload, auth);
    case 'event.backfillAssignmentShiftIds': return handleEventBackfillAssignmentShiftIds(payload, auth);

    // DEBUG TOOLS (SUPER_ADMIN only — pagina /admin/debug)
    case 'debug.matchBreakdown': return handleDebugMatchBreakdown(payload, auth);
    case 'debug.inspectEntity':  return handleDebugInspectEntity(payload, auth);

    default:
      return errorResponse('VAL_002', 'Action "' + action + '" non riconosciuta');
  }
}

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

function handleConfigGet(payload, authPayload) {
  if (payload.key) {
    var val = getConfig(payload.key, authPayload.tenant_id);
    return successResponse({ key: payload.key, value: val });
  }
  // Ritorna tutte le config del tenant
  var rows = getAllRows('SystemConfig');
  var tenantId = authPayload.tenant_id;
  var filtered = rows.filter(function(r) {
    return r.scope === 'SYSTEM' || r.scope === 'FEATURE' || String(r.tenant_id) === String(tenantId);
  });
  return successResponse({ configs: filtered });
}

// ---------------------------------------------------------------------------
// RESPONSE HELPERS
// ---------------------------------------------------------------------------

function successResponse(data) {
  return { success: true, data: data };
}

function errorResponse(code, message, field) {
  var err = { code: code, message: message };
  if (field) err.field = field;
  return { success: false, error: err };
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// ERROR LOG HELPER (usato dal router e dai moduli)
// ---------------------------------------------------------------------------

// Colonne aggiunte in fondo a ErrorLog (le 9 originali restano intatte).
var ERRORLOG_EXTRA_COLUMNS = [
  'severity', 'entity_type', 'entity_id', 'actor', 'input',
  'deployment_id', 'fingerprint', 'alert_sent', 'alert_sent_at'
];

var DEPLOYMENT_ID = 'AKfycbywK-f8EOav2gS7MKNlLRT38eVe9h4SH827Zv91kFp7l0A4LEg2s13IJXwvwNns_UKA-g';

/**
 * Punto unico di scrittura errori. Due forme:
 *   logError_({ severity, module, action, entity_type, entity_id, actor,
 *               message, stack, input, user_id, tenant_id })      // preferita
 *   logError_(module, action, message, stack, userId, tenantId)   // legacy (severity ERROR)
 * severity: INFO | WARN | ERROR. Solo ERROR genera alert (alert_sent=FALSE).
 * Non lancia mai: un fallimento del log non deve rompere il flusso chiamante.
 */
function logError_(ctxOrModule, action, message, stack, userId, tenantId) {
  try {
    var ctx = (ctxOrModule && typeof ctxOrModule === 'object')
      ? ctxOrModule
      : { module: ctxOrModule, action: action, message: message, stack: stack, user_id: userId, tenant_id: tenantId };

    var severity = String(ctx.severity || 'ERROR').toUpperCase();
    if (severity !== 'INFO' && severity !== 'WARN' && severity !== 'ERROR') severity = 'ERROR';
    var msg = String(ctx.message || '');
    var act = String(ctx.action || '');
    var actor = ctx.actor || ctx.user_id || '';

    ensureErrorLogColumns_();
    appendRow_('ErrorLog', {
      error_id:      Utilities.getUuid(),
      timestamp:     new Date(),
      level:         severity,
      module:        ctx.module || '',
      message:       msg.substring(0, 2000),
      stack:         String(ctx.stack || '').substring(0, 4000),
      user_id:       ctx.user_id || actor || '',
      tenant_id:     ctx.tenant_id || '',
      action:        act,
      severity:      severity,
      entity_type:   ctx.entity_type || '',
      entity_id:     ctx.entity_id || '',
      actor:         actor,
      input:         ctx.input !== undefined ? sanitizeForLog_(ctx.input) : '',
      deployment_id: DEPLOYMENT_ID,
      fingerprint:   errorFingerprint_(act, msg),
      alert_sent:    severity === 'ERROR' ? false : '',
      alert_sent_at: ''
    });
  } catch (e) {
    Logger.log('ErrorLog write failed: ' + e.message);
  }
}

/** Aggiunge in fondo a ErrorLog le colonne mancanti (idempotente, cache per esecuzione). */
var _errorLogColsOk = false;
function ensureErrorLogColumns_() {
  if (_errorLogColsOk) return;
  var sheet = getSheet('ErrorLog');
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });
  var missing = ERRORLOG_EXTRA_COLUMNS.filter(function(c) { return headers.indexOf(c) === -1; });
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
  }
  _errorLogColsOk = true;
}

/** Hash stabile action+messaggio (uuid/numeri normalizzati) per dedup alert. */
function errorFingerprint_(action, message) {
  var norm = String(message || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
    .replace(/\d+/g, '#')
    .substring(0, 200);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(action || '') + '|' + norm);
  return digest.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('').substring(0, 12);
}

/** Maschera un indirizzo email per i log: m***@gmail.com */
function maskEmail_(email) {
  var s = String(email || '');
  var at = s.indexOf('@');
  if (at < 1) return s ? '***' : '';
  return s.charAt(0) + '***' + s.substring(at);
}

/**
 * Serializza un input per il log SENZA PII/segreti: chiavi sensibili oscurate,
 * email mascherate, stringhe troncate, profondità limitata.
 */
function sanitizeForLog_(value) {
  var SENSITIVE = /pass|pwd|token|secret|hash|authorization|cookie|iban|codice_fiscale|\bcf\b|email|mail|telefono|phone|cellulare|nome|cognome|indirizzo|file_base64|data_nascita/i;
  function walk(v, depth) {
    if (v === null || v === undefined) return v;
    if (typeof v === 'string') {
      return v.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, function(m) { return maskEmail_(m); }).substring(0, 200);
    }
    if (typeof v !== 'object') return v;
    if (depth >= 3) return '[...]';
    if (Array.isArray(v)) return v.slice(0, 10).map(function(x) { return walk(x, depth + 1); });
    var out = {};
    Object.keys(v).slice(0, 30).forEach(function(k) {
      out[k] = SENSITIVE.test(k) ? '[redacted]' : walk(v[k], depth + 1);
    });
    return out;
  }
  try {
    return JSON.stringify(walk(value, 0)).substring(0, 1000);
  } catch (e) {
    return '[unserializable]';
  }
}
