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
    product:   'MADE EVENT Platform',
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
    case 'talent.list':              return handleTalentList(payload, auth);
    case 'talent.get':               return handleTalentGet(payload, auth);
    case 'talent.updateProfile':     return handleTalentUpdateProfile(payload, auth);
    case 'talent.updateScoreAdmin':  return handleUpdateScoreAdmin(payload, auth);
    case 'talent.updateEventiPreCRM': return handleUpdateEventiPreCRM(payload, auth);

    // CLIENT
    case 'client.create': return handleClientCreate(payload, auth);
    case 'client.list':   return handleClientList(payload, auth);
    case 'client.get':    return handleClientGet(payload, auth);
    case 'client.update': return handleClientUpdate(payload, auth);

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
    case 'application.reject':             return handleApplicationReject(payload, auth);
    case 'application.withdraw':           return handleApplicationWithdraw(payload, auth);
    case 'application.list':               return handleApplicationList(payload, auth);
    case 'application.updateStatus':       return handleApplicationUpdateStatus(payload, auth);
    case 'application.markEventCompleted': return handleMarkEventCompleted(payload, auth);

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
    case 'lead.list':    return handleLeadList(payload, auth);
    case 'lead.update':  return handleLeadUpdate(payload, auth);
    case 'lead.solicit': return handleLeadSolicit(payload, auth);

    // CONTRACT
    case 'contract.generate': return handleContractGenerate(payload, auth);

    // EMAIL
    case 'email.sendCustom':       return handleEmailSendCustom(payload, auth);
    case 'email.sendConvocazione': return handleEmailSendConvocazione(payload, auth);

    // LOGGING
    case 'log.view': return handleLogView(payload, auth);

    // DASHBOARD
    case 'dashboard.bootstrap': return handleDashboardBootstrap(payload, auth);

    // SYSTEM
    case 'config.get':  return handleConfigGet(payload, auth);
    case 'demo.reset':  return handleDemoReset(payload, auth);

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

function logError_(module, action, message, stack, userId, tenantId) {
  try {
    appendRow_('ErrorLog', {
      error_id:  Utilities.getUuid(),
      timestamp: new Date(),
      level:     'ERROR',
      module:    module || '',
      message:   message || '',
      stack:     (stack || '').substring(0, 500),
      user_id:   userId  || '',
      tenant_id: tenantId || '',
      action:    action  || ''
    });
  } catch (e) {
    Logger.log('ErrorLog write failed: ' + e.message);
  }
}
