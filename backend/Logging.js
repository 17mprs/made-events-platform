// === LOGGING.JS — MADE EVENT Platform v1.0 ===
// Sistema di audit e accesso logging (PRD BLOCK:LOGGING).
//
// ACTIVITYLOG — foglio ActivityLog:
//   log_id | timestamp | level | module | action | entity_type | entity_id |
//   user_id | tenant_id | old_status | new_status | old_value | new_value | note
//
// ACCESSLOG — foglio AccessLog:
//   log_id | timestamp | event_type | user_id | email | tenant_id | detail
//
// Livelli: CRITICAL | ERROR | WARNING | INFO
//
// DA LOGGARE SEMPRE (obbligatorio PRD):
//   login (ok e fallito), logout, token invalido/scaduto, accesso cross-tenant,
//   approvazione talent, creazione assignment, checkin, checkout,
//   tutte le transizioni di stato, cambio password, attivazione/disattivazione user.

// ---------------------------------------------------------------------------
// ACTIVITYLOG
// ---------------------------------------------------------------------------

/**
 * Scrive una riga in ActivityLog.
 * @param {object} params
 *   level        CRITICAL | ERROR | WARNING | INFO
 *   module       nome modulo (es. 'AUTH', 'WORKFLOWS', 'SPECIAL_ACTIONS')
 *   action       action string (es. 'talent.approve', 'assignment.checkin')
 *   entity_type  tipo entità (es. 'ASSIGNMENT') — opzionale
 *   entity_id    UUID entità — opzionale
 *   user_id      chi ha eseguito l'azione — opzionale
 *   tenant_id    — opzionale
 *   old_status   — opzionale
 *   new_status   — opzionale
 *   old_value    oggetto/stringa da serializzare — opzionale
 *   new_value    oggetto/stringa da serializzare — opzionale
 *   note         stringa libera — opzionale
 */
function logActivity(params) {
  try {
    appendRow_('ActivityLog', {
      log_id:      Utilities.getUuid(),
      timestamp:   new Date(),
      level:       params.level       || 'INFO',
      module:      params.module      || '',
      action:      params.action      || '',
      entity_type: params.entity_type || '',
      entity_id:   params.entity_id   || '',
      user_id:     params.user_id     || '',
      tenant_id:   params.tenant_id   || '',
      old_status:  params.old_status  || '',
      new_status:  params.new_status  || '',
      old_value:   serializeJSON(params.old_value  || ''),
      new_value:   serializeJSON(params.new_value  || ''),
      note:        params.note        || ''
    });
  } catch (e) {
    Logger.log('[LOGGING] logActivity failed: ' + e.message);
  }
}

// ---------------------------------------------------------------------------
// ACCESSLOG
// ---------------------------------------------------------------------------

/**
 * Scrive una riga in AccessLog.
 * event_type: LOGIN | LOGOUT | LOGIN_FAILED | TOKEN_INVALID | TOKEN_EXPIRED |
 *             ACCESS_DENIED | PASSWORD_CHANGED | USER_DEACTIVATED
 */
function logAccess(eventType, userId, email, tenantId, detail) {
  try {
    appendRow_('AccessLog', {
      log_id:     Utilities.getUuid(),
      timestamp:  new Date(),
      event_type: eventType  || '',
      user_id:    userId     || '',
      email:      email      || '',
      tenant_id:  tenantId   || '',
      detail:     detail     || ''
    });
  } catch (e) {
    Logger.log('[LOGGING] logAccess failed: ' + e.message);
  }
}

// ---------------------------------------------------------------------------
// SHORTCUTS SEMANTICI (usati dai moduli)
// ---------------------------------------------------------------------------

function logLogin(userId, email, tenantId) {
  logAccess('LOGIN', userId, email, tenantId, 'Login riuscito');
  logActivity({
    level: 'INFO', module: 'AUTH', action: 'auth.login',
    user_id: userId, tenant_id: tenantId, note: email
  });
}

function logLoginFailed(email, detail) {
  logAccess('LOGIN_FAILED', '', email, '', detail || 'Credenziali non valide');
}

function logLogout(userId, email, tenantId) {
  logAccess('LOGOUT', userId, email, tenantId, '');
  logActivity({
    level: 'INFO', module: 'AUTH', action: 'auth.logout',
    user_id: userId, tenant_id: tenantId
  });
}

function logTokenInvalid(detail) {
  logAccess('TOKEN_INVALID', '', '', '', detail || '');
}

function logTokenExpired(userId, tenantId) {
  logAccess('TOKEN_EXPIRED', userId, '', tenantId, '');
}

function logAccessDenied(userId, tenantId, action, reason) {
  logAccess('ACCESS_DENIED', userId, '', tenantId, 'action=' + action + ' reason=' + (reason || ''));
  logActivity({
    level: 'WARNING', module: 'AUTH', action: action,
    user_id: userId, tenant_id: tenantId, note: reason || 'Permesso negato'
  });
}

function logPasswordChanged(userId, tenantId) {
  logAccess('PASSWORD_CHANGED', userId, '', tenantId, '');
  logActivity({
    level: 'INFO', module: 'AUTH', action: 'auth.changePassword',
    user_id: userId, tenant_id: tenantId
  });
}

function logUserDeactivated(targetUserId, byUserId, tenantId) {
  logAccess('USER_DEACTIVATED', byUserId, '', tenantId, 'target_user_id=' + targetUserId);
  logActivity({
    level: 'WARNING', module: 'AUTH', action: 'user.deactivate',
    entity_type: 'USER', entity_id: targetUserId,
    user_id: byUserId, tenant_id: tenantId
  });
}

function logStateTransition(entityType, entityId, oldStatus, newStatus, userId, tenantId, action) {
  logActivity({
    level:       'INFO',
    module:      'WORKFLOWS',
    action:      action || (entityType.toLowerCase() + '.updateStatus'),
    entity_type: entityType,
    entity_id:   entityId,
    user_id:     userId,
    tenant_id:   tenantId,
    old_status:  oldStatus,
    new_status:  newStatus
  });
}

function logTalentApproved(leadId, userId, profileId, byUserId, tenantId) {
  logActivity({
    level:       'INFO',
    module:      'WORKFLOWS',
    action:      'talent.approve',
    entity_type: 'LEAD_TALENT',
    entity_id:   leadId,
    user_id:     byUserId,
    tenant_id:   tenantId,
    old_status:  'COMPLETED_PENDING_APPROVAL',
    new_status:  'APPROVED',
    new_value:   { user_id: userId, profile_id: profileId },
    note:        'USER e TALENT_PROFILE creati'
  });
}

function logAssignmentCreated(assignmentId, shiftId, talentProfileId, userId, tenantId) {
  logActivity({
    level:       'INFO',
    module:      'WORKFLOWS',
    action:      'assignment.create',
    entity_type: 'ASSIGNMENT',
    entity_id:   assignmentId,
    user_id:     userId,
    tenant_id:   tenantId,
    new_status:  'CONFIRMED',
    note:        'shift_id=' + shiftId + ' talent_profile_id=' + talentProfileId
  });
}

function logCheckin(assignmentId, userId, tenantId, lat, lng) {
  logActivity({
    level:       'INFO',
    module:      'SPECIAL_ACTIONS',
    action:      'assignment.checkin',
    entity_type: 'ASSIGNMENT',
    entity_id:   assignmentId,
    user_id:     userId,
    tenant_id:   tenantId,
    old_status:  'CONFIRMED',
    new_status:  'CHECKED_IN',
    note:        lat && lng ? 'lat=' + lat + ' lng=' + lng : ''
  });
}

function logCheckout(assignmentId, userId, tenantId, timesheet) {
  logActivity({
    level:       'INFO',
    module:      'SPECIAL_ACTIONS',
    action:      'assignment.checkout',
    entity_type: 'ASSIGNMENT',
    entity_id:   assignmentId,
    user_id:     userId,
    tenant_id:   tenantId,
    old_status:  'CHECKED_IN',
    new_status:  'CHECKED_OUT',
    note:        timesheet ? timesheet.ore_lavorate + 'h ' + timesheet.minuti_lavorati + 'min' : ''
  });
}

// ---------------------------------------------------------------------------
// LOG VIEW HANDLER (router)
// ---------------------------------------------------------------------------

function handleLogView(payload, auth) {
  var logType = payload.log_type || 'activity'; // 'activity' | 'access' | 'error'
  var sheetKey;

  if (logType === 'access') {
    sheetKey = 'AccessLog';
  } else if (logType === 'error') {
    sheetKey = 'ErrorLog';
  } else {
    sheetKey = 'ActivityLog';
  }

  var rows = getAllRows(sheetKey);

  // ADMIN vede solo il proprio tenant
  if (auth.role === ROLES.ADMIN) {
    rows = rows.filter(function(r) {
      return String(r.tenant_id) === String(auth.tenant_id) || !r.tenant_id;
    });
  }

  // Filtri opzionali
  if (payload.action) {
    rows = rows.filter(function(r) { return r.action === payload.action; });
  }
  if (payload.entity_type) {
    rows = rows.filter(function(r) { return r.entity_type === payload.entity_type; });
  }
  if (payload.level) {
    rows = rows.filter(function(r) { return r.level === payload.level; });
  }
  if (payload.user_id) {
    rows = rows.filter(function(r) { return String(r.user_id) === String(payload.user_id); });
  }

  // Più recenti prima
  rows.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

  return successResponse(paginateResults(rows, payload.page, payload.limit));
}
