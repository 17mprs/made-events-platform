// === WORKFLOWS.JS — MADE EVENT Platform v1.0 ===
// Motore di transizioni di stato per tutte le entità.
// Ogni transizione è validata; side effects eseguiti dopo la transizione.
// Rispetta RB-07: transizioni non definite → WF_001.
// Rispetta RB-08: side effects idempotenti.

// ---------------------------------------------------------------------------
// STATE MACHINE DEFINITIONS (PRD BLOCK:STATI)
// ---------------------------------------------------------------------------
//
// Formato: TIPO_ENTITA: { STATO_CORRENTE: [STATI_AMMESSI, ...] }
// '*' = qualsiasi stato corrente.

var STATE_TRANSITIONS = {
  LEAD_TALENT: {
    PARTIAL:                    ['COMPLETED_PENDING_APPROVAL'],
    COMPLETED_PENDING_APPROVAL: ['APPROVED', 'REJECTED']
  },
  TALENT_PROFILE: {
    PENDING_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED:       ['ACTIVE', 'REJECTED'],
    ACTIVE:         ['INACTIVE'],
    INACTIVE:       ['ACTIVE']
  },
  EVENT: {
    DRAFT:     ['PLANNING', 'LIVE', 'COMPLETED'],
    PLANNING:  ['DRAFT',    'LIVE', 'COMPLETED'],
    LIVE:      ['DRAFT', 'PLANNING', 'COMPLETED'],
    COMPLETED: ['DRAFT', 'PLANNING', 'LIVE'],
  },
  SHIFT: {
    OPEN:  ['FULL', 'CLOSED', 'CANCELLED'],
    FULL:  ['OPEN', 'CANCELLED'],
    CLOSED:['CANCELLED']
    // CANCELLED: terminale
  },
  APPLICATION: {
    INVITED:        ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'DOCS_REQUESTED'],
    PENDING:        ['APPROVED', 'REJECTED', 'WITHDRAWN', 'DOCS_REQUESTED'],
    DOCS_REQUESTED: ['DOCS_RECEIVED', 'REJECTED'],
    DOCS_RECEIVED:  ['APPROVED', 'REJECTED'],
    // APPROVED, REJECTED, WITHDRAWN: terminali
  },
  ASSIGNMENT: {
    CONFIRMED:   ['CHECKED_IN',  'CANCELLED', 'NO_SHOW'],
    CHECKED_IN:  ['CHECKED_OUT'],
    CHECKED_OUT: ['VALIDATED'],
    VALIDATED:   ['PAID']
    // PAID, CANCELLED, NO_SHOW: terminali
  }
};

// ---------------------------------------------------------------------------
// ENTRY POINT PUBBLICO
// ---------------------------------------------------------------------------

/**
 * Esegue la transizione di stato di un'entità.
 * Valida la transizione, la applica, esegue side effects.
 * @param {string} entityType - es. 'EVENT'
 * @param {object} entity     - entità già caricata (con data parsato)
 * @param {string} newStatus  - stato di destinazione
 * @param {object} auth       - token payload (user_id, tenant_id, role)
 * @returns {object} response standard { success, data/error }
 */
function transitionEntityStatus(entityType, entity, newStatus, auth) {
  var currentStatus = entity.status;

  // Verifica transizione ammessa
  if (!isTransitionAllowed_(entityType, currentStatus, newStatus)) {
    return errorResponse('WF_001',
      'Transizione non consentita: ' + entityType + ' ' + currentStatus + ' → ' + newStatus);
  }

  // Applica transizione
  updateRow('Entities', entity.entity_id, { status: newStatus });
  entity.status = newStatus;

  // Log obbligatorio PRD: tutte le transizioni di stato
  logStateTransition(entityType, entity.entity_id, currentStatus, newStatus,
    auth.user_id, auth.tenant_id, entityType.toLowerCase() + '.updateStatus');

  // Side effects
  var sideEffectResult = runSideEffects_(entityType, currentStatus, newStatus, entity, auth);
  if (sideEffectResult && !sideEffectResult.success) {
    // Side effect fallito: logga ma non blocca (la transizione è già avvenuta)
    logError_('WORKFLOWS', entityType + ':' + newStatus,
      'Side effect fallito: ' + sideEffectResult.error.message,
      '', auth.user_id, auth.tenant_id);
  }

  return successResponse({
    entity_id:  entity.entity_id,
    type:       entityType,
    old_status: currentStatus,
    new_status: newStatus,
    data:       entity.data
  });
}

// ---------------------------------------------------------------------------
// VALIDAZIONE TRANSIZIONI
// ---------------------------------------------------------------------------

function isTransitionAllowed_(entityType, currentStatus, newStatus) {
  var machine = STATE_TRANSITIONS[entityType];
  if (!machine) return false;

  // Controllo specifico per stato corrente
  var allowed = machine[currentStatus];
  if (allowed && allowed.indexOf(newStatus) !== -1) return true;

  // Fallback wildcard '*'
  var wildcard = machine['*'];
  if (wildcard && wildcard.indexOf(newStatus) !== -1) return true;

  return false;
}

// ---------------------------------------------------------------------------
// SIDE EFFECTS
// ---------------------------------------------------------------------------

/**
 * Esegue i side effects dopo una transizione.
 * Tutti i side effects devono essere idempotenti (RB-08).
 */
function runSideEffects_(entityType, oldStatus, newStatus, entity, auth) {
  var key = entityType + ':' + newStatus;

  switch (key) {

    // APPLICATION APPROVED → crea ASSIGNMENT(CONFIRMED) + controlla SHIFT FULL
    case 'APPLICATION:APPROVED':
      return sideEffect_ApplicationApproved_(entity, auth);

    // LEAD_TALENT APPROVED → crea USER + TALENT_PROFILE (delegato a SpecialActions)
    // Gestito direttamente in handleTalentApprove per avere accesso ai payload extra.

    // ASSIGNMENT CHECKED_OUT → calcola timesheet (fatto in SpecialActions.checkout)
    // Non serve qui perché checkout aggiorna già i dati prima di chiamare questa funzione.

    default:
      return null; // nessun side effect per questa transizione
  }
}

// ---------------------------------------------------------------------------
// SIDE EFFECT: APPLICATION APPROVED
// ---------------------------------------------------------------------------

function sideEffect_ApplicationApproved_(application, auth) {
  var appData = application.data;

  // Idempotenza: controlla se esiste già un ASSIGNMENT per questo shift+talent
  var existing = findAssignment_(appData.shift_id, appData.talent_profile_id, auth.tenant_id);
  if (existing) {
    // Assignment già esistente — nessuna azione (idempotente)
    return successResponse({ message: 'Assignment già esistente', entity_id: existing.entity_id });
  }

  // Crea ASSIGNMENT CONFIRMED
  var assignment = createEntity('ASSIGNMENT', ENTITY_STATUS.ASSIGNMENT.CONFIRMED, {
    shift_id:           appData.shift_id,
    talent_profile_id:  appData.talent_profile_id,
    application_id:     application.entity_id,
    note_admin:         '',
    checkin:            {},
    checkout:           {},
    timesheet:          {},
    reminder_24h_sent:  false,
    reminder_2h_sent:   false
  }, auth.tenant_id, auth.user_id);

  // Aggiorna posti_confermati sullo shift
  checkShiftFullness_(appData.shift_id, auth.tenant_id);

  // Log obbligatorio PRD: creazione assignment
  logAssignmentCreated(
    assignment.entity_id, appData.shift_id,
    appData.talent_profile_id, auth.user_id, auth.tenant_id
  );

  // Email notifica talent (best-effort: non blocca se fallisce)
  try {
    var talentProfile = getEntityById(appData.talent_profile_id, auth.tenant_id);
    if (talentProfile && talentProfile.data.email_contatto) {
      var shift = getEntityById(appData.shift_id, auth.tenant_id);
      if (shift) {
        sendAssignmentConfirmedEmail(
          talentProfile.data.email_contatto,
          (talentProfile.data.nome || '') + ' ' + (talentProfile.data.cognome || ''),
          shift.data,
          assignment.entity_id
        );
      }
    }
  } catch (emailErr) {
    Logger.log('[WORKFLOWS] Email assignment fallita: ' + emailErr.message);
  }

  return successResponse({ assignment_id: assignment.entity_id });
}

// ---------------------------------------------------------------------------
// SHIFT FULLNESS CHECK
// ---------------------------------------------------------------------------

/**
 * Conta gli ASSIGNMENT CONFIRMED/CHECKED_IN/CHECKED_OUT/VALIDATED/PAID per lo shift.
 * Se >= posti_disponibili: SHIFT → FULL.
 * Se < posti_disponibili e SHIFT era FULL: SHIFT → OPEN.
 */
function checkShiftFullness_(shiftId, tenantId) {
  var shift = getEntityById(shiftId, tenantId);
  if (!shift || shift.status === ENTITY_STATUS.SHIFT.CANCELLED) return;

  var activeStatuses = [
    ENTITY_STATUS.ASSIGNMENT.CONFIRMED,
    ENTITY_STATUS.ASSIGNMENT.CHECKED_IN,
    ENTITY_STATUS.ASSIGNMENT.CHECKED_OUT,
    ENTITY_STATUS.ASSIGNMENT.VALIDATED,
    ENTITY_STATUS.ASSIGNMENT.PAID
  ];

  var allAssignments = getAllRows('Entities');
  var count = 0;
  for (var i = 0; i < allAssignments.length; i++) {
    var e = allAssignments[i];
    if (e.type !== 'ASSIGNMENT') continue;
    if (String(e.tenant_id) !== String(tenantId)) continue;
    if (String(e.deleted).toLowerCase() === 'true') continue;
    var d = parseJSON(e.data);
    if (String(d.shift_id) !== String(shiftId)) continue;
    if (activeStatuses.indexOf(e.status) !== -1) count++;
  }

  // Aggiorna posti_confermati
  updateEntityData(shiftId, { posti_confermati: count }, tenantId, 'system');

  var posti = parseInt(shift.data.posti_disponibili) || 0;
  var isFull = count >= posti;
  var autoFull = String(getConfig('tenant.shift_full_auto', tenantId)) === 'true';

  if (autoFull) {
    if (isFull && shift.status === ENTITY_STATUS.SHIFT.OPEN) {
      updateRow('Entities', shiftId, { status: ENTITY_STATUS.SHIFT.FULL });
    } else if (!isFull && shift.status === ENTITY_STATUS.SHIFT.FULL) {
      updateRow('Entities', shiftId, { status: ENTITY_STATUS.SHIFT.OPEN });
    }
  }
}

// ---------------------------------------------------------------------------
// TALENT APPROVE (orchestrator — crea USER + TALENT_PROFILE)
// ---------------------------------------------------------------------------

function handleTalentApprove(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var lead = getEntityById(payload.entity_id, auth.tenant_id);
  if (!lead) return errorResponse('SYS_002', 'Entità non trovata');

  // TALENT_PROFILE in PENDING_REVIEW → approva le modifiche talent
  if (lead.type === 'TALENT_PROFILE') {
    if (lead.status !== ENTITY_STATUS.TALENT_PROFILE.PENDING_REVIEW) {
      return errorResponse('WF_002', 'Il profilo deve essere in PENDING_REVIEW. Stato attuale: ' + lead.status);
    }
    var pendingData = lead.data.pending_data || {};
    var mergedData = Object.assign({}, lead.data, pendingData);
    delete mergedData.pending_data;
    delete mergedData.pending_submitted_at;
    updateRow('Entities', lead.entity_id, {
      status:     ENTITY_STATUS.TALENT_PROFILE.APPROVED,
      data:       serializeJSON(mergedData),
      updated_at: new Date()
    });
    return successResponse({ profile_id: lead.entity_id, status: ENTITY_STATUS.TALENT_PROFILE.APPROVED });
  }

  if (lead.type !== 'LEAD_TALENT') return errorResponse('SYS_002', 'Lead talent non trovato');

  if (lead.status !== ENTITY_STATUS.LEAD_TALENT.COMPLETED_PENDING_APPROVAL) {
    return errorResponse('WF_002',
      'Il lead deve essere in stato COMPLETED_PENDING_APPROVAL per essere approvato. Stato attuale: ' + lead.status);
  }

  var leadData = lead.data;

  // Idempotenza: controlla se USER già esiste con questa email
  var existingUsers = getAllRows('Users');
  var existingUser = null;
  for (var i = 0; i < existingUsers.length; i++) {
    if (String(existingUsers[i].email).toLowerCase() === String(leadData.email).toLowerCase()) {
      existingUser = existingUsers[i];
      break;
    }
  }

  var userId;
  var tempPwd;
  if (existingUser) {
    userId  = existingUser.user_id;
    tempPwd = null; // password già esistente
  } else {
    // Crea USER con password temporanea
    tempPwd = generateTempPassword();
    var now = new Date();
    var newUser = appendRow_('Users', {
      user_id:       Utilities.getUuid(),
      tenant_id:     auth.tenant_id,
      email:         leadData.email.toLowerCase(),
      password_hash: hashPassword(tempPwd),
      role:          ROLES.USER,
      status:        'active',
      pwd_version:   0,
      created_at:    now,
      last_login:    '',
      updated_at:    now,
      deleted:       false,
      deleted_at:    '',
      deleted_by:    ''
    });
    userId = newUser.user_id;
  }

  // Idempotenza: controlla se TALENT_PROFILE già esiste per questo lead
  var existingProfile = null;
  var allEntities = getAllRows('Entities');
  for (var j = 0; j < allEntities.length; j++) {
    var e = allEntities[j];
    if (e.type !== 'TALENT_PROFILE') continue;
    if (String(e.tenant_id) !== String(auth.tenant_id)) continue;
    var d = parseJSON(e.data);
    if (String(d.lead_id) === String(lead.entity_id)) {
      existingProfile = e;
      break;
    }
  }

  var profileId;
  if (existingProfile) {
    profileId = existingProfile.entity_id;
  } else {
    // Crea TALENT_PROFILE
    var profile = createEntity('TALENT_PROFILE', ENTITY_STATUS.TALENT_PROFILE.APPROVED, {
      lead_id:              lead.entity_id,
      user_id:              userId,
      nome:                 leadData.nome,
      cognome:              leadData.cognome,
      telefono:             leadData.telefono,
      email_contatto:       leadData.email,
      citta:                leadData.citta            || '',
      province_operativita: leadData.province_operativita || [],
      lingue:               leadData.lingue           || [],
      altezza:              leadData.altezza          || '',
      taglia:               leadData.taglia           || '',
      skills:               leadData.skills           || [],
      esperienza_anni:      leadData.esperienza_anni  || 0,
      disponibilita:        leadData.disponibilita    || '',
      rating:               0,
      stato_verifica:       'verified',
      documenti: {
        cv:   leadData.cv_url   ? { file_id: '', url: leadData.cv_url,   status: 'valid', uploaded_at: new Date().toISOString() } : {},
        foto: leadData.foto_url ? { file_id: '', url: leadData.foto_url, status: 'valid', uploaded_at: new Date().toISOString() } : {},
        carta_identita: {}
      },
      score:                 leadData.score                 || 0,
      score_questionario:   leadData.score_questionario    || 0,
      score_admin:          leadData.score_admin           || 5,
      ranking:              leadData.ranking               || 'D',
      eventi_crm_completati: 0,
      eventi_precrm:        leadData.eventi_precrm         || 0
    }, auth.tenant_id, auth.user_id);
    profileId = profile.entity_id;
  }

  // Transiziona LEAD → APPROVED
  updateRow('Entities', lead.entity_id, { status: ENTITY_STATUS.LEAD_TALENT.APPROVED });

  // Log obbligatorio PRD: approvazione talent
  logTalentApproved(lead.entity_id, userId, profileId, auth.user_id, auth.tenant_id);

  // Email con credenziali (solo se nuova password generata)
  try {
    if (tempPwd) {
      sendWelcomeEmail(leadData.email, leadData.nome, tempPwd);
    } else {
      sendProfileApprovedEmail(leadData.email, leadData.nome);
    }
  } catch (emailErr) {
    Logger.log('[WORKFLOWS] Email approvazione fallita: ' + emailErr.message);
  }

  var result = {
    lead_id:    lead.entity_id,
    user_id:    userId,
    profile_id: profileId,
    email:      leadData.email
  };
  if (tempPwd) result.temp_password = tempPwd;

  return successResponse(result);
}

function handleTalentReject(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var lead = getEntityById(payload.entity_id, auth.tenant_id);
  if (!lead) return errorResponse('SYS_002', 'Entità non trovata');

  // TALENT_PROFILE in PENDING_REVIEW → rifiuta le modifiche, ripristina APPROVED
  if (lead.type === 'TALENT_PROFILE') {
    if (lead.status !== ENTITY_STATUS.TALENT_PROFILE.PENDING_REVIEW) {
      return errorResponse('WF_002', 'Il profilo deve essere in PENDING_REVIEW. Stato attuale: ' + lead.status);
    }
    var restoredData = Object.assign({}, lead.data);
    delete restoredData.pending_data;
    delete restoredData.pending_submitted_at;
    if (payload.nota_rifiuto) restoredData.nota_rifiuto_modifiche = payload.nota_rifiuto;
    updateRow('Entities', lead.entity_id, {
      status:     ENTITY_STATUS.TALENT_PROFILE.APPROVED,
      data:       serializeJSON(restoredData),
      updated_at: new Date()
    });
    return successResponse({ profile_id: lead.entity_id, status: ENTITY_STATUS.TALENT_PROFILE.APPROVED });
  }

  if (lead.type !== 'LEAD_TALENT') return errorResponse('SYS_002', 'Lead talent non trovato');

  if (lead.status !== ENTITY_STATUS.LEAD_TALENT.COMPLETED_PENDING_APPROVAL) {
    return errorResponse('WF_002',
      'Il lead deve essere in stato COMPLETED_PENDING_APPROVAL per essere rifiutato. Stato attuale: ' + lead.status);
  }

  updateRow('Entities', lead.entity_id, { status: ENTITY_STATUS.LEAD_TALENT.REJECTED });

  // Se c'era una nota di rifiuto, salvarla nei dati
  if (payload.nota_rifiuto) {
    updateEntityData(lead.entity_id, { nota_rifiuto: payload.nota_rifiuto }, auth.tenant_id, auth.user_id);
  }

  return successResponse({ lead_id: lead.entity_id, status: ENTITY_STATUS.LEAD_TALENT.REJECTED });
}

// ---------------------------------------------------------------------------
// APPLICATION APPROVE / REJECT / WITHDRAW
// ---------------------------------------------------------------------------

function handleApplicationApprove(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var application = getEntityById(payload.entity_id, auth.tenant_id);
  if (!application || application.type !== 'APPLICATION') {
    return errorResponse('SYS_002', 'Candidatura non trovata');
  }
  if (application.status !== ENTITY_STATUS.APPLICATION.PENDING) {
    return errorResponse('WF_002',
      'La candidatura deve essere PENDING per essere approvata. Stato attuale: ' + application.status);
  }

  // LockService: previeni race condition (due admin approvano simultaneamente)
  var lock = LockService.getScriptLock();
  var lockKey = 'application_approve_' + payload.entity_id;
  try {
    lock.waitLock(10000); // attesa max 10s

    // Rileggi lo stato dopo aver acquisito il lock (anti-race condition)
    var freshApp = getEntityById(payload.entity_id, auth.tenant_id);
    if (!isTransitionAllowed_('APPLICATION', freshApp.status, ENTITY_STATUS.APPLICATION.APPROVED)) {
      return errorResponse('WF_002', 'Transizione APPROVED non consentita dallo stato: ' + freshApp.status);
    }

    // Esegui transizione (side effect: crea ASSIGNMENT)
    var result = transitionEntityStatus('APPLICATION', freshApp, ENTITY_STATUS.APPLICATION.APPROVED, auth);
    return result;

  } catch (e) {
    return errorResponse('SYS_001', 'Impossibile acquisire lock: ' + e.message);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function handleApplicationReject(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var application = getEntityById(payload.entity_id, auth.tenant_id);
  if (!application || application.type !== 'APPLICATION') {
    return errorResponse('SYS_002', 'Candidatura non trovata');
  }
  if (!isTransitionAllowed_('APPLICATION', application.status, ENTITY_STATUS.APPLICATION.REJECTED)) {
    return errorResponse('WF_002', 'Transizione REJECTED non consentita dallo stato: ' + application.status);
  }

  if (payload.nota_rifiuto) {
    updateEntityData(application.entity_id, { nota_rifiuto: payload.nota_rifiuto }, auth.tenant_id, auth.user_id);
  }

  return transitionEntityStatus('APPLICATION', application, ENTITY_STATUS.APPLICATION.REJECTED, auth);
}

function handleApplicationWithdraw(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var application = getEntityById(payload.entity_id, auth.tenant_id);
  if (!application || application.type !== 'APPLICATION') {
    return errorResponse('SYS_002', 'Candidatura non trovata');
  }

  // USER può ritirare solo le proprie
  if (auth.role === ROLES.USER) {
    var profile = findTalentProfileByUserId_(auth.user_id, auth.tenant_id);
    if (!profile || application.data.talent_profile_id !== profile.entity_id) {
      return errorResponse('AUTH_005', 'Puoi ritirare solo le tue candidature');
    }
  }

  if (application.status !== ENTITY_STATUS.APPLICATION.PENDING) {
    return errorResponse('WF_002', 'Solo le candidature PENDING possono essere ritirate. Stato attuale: ' + application.status);
  }

  return transitionEntityStatus('APPLICATION', application, ENTITY_STATUS.APPLICATION.WITHDRAWN, auth);
}

// ---------------------------------------------------------------------------
// HELPER
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// APPLICATION.UPDATESTATUS — aggiorna a DOCS_REQUESTED o DOCS_RECEIVED (admin only)
// ---------------------------------------------------------------------------

function handleApplicationUpdateStatus(payload, auth) {
  var valid = requireFields(payload, ['entity_id', 'new_status']);
  if (valid) return valid;

  var allowed = [ENTITY_STATUS.APPLICATION.DOCS_REQUESTED, ENTITY_STATUS.APPLICATION.DOCS_RECEIVED];
  if (allowed.indexOf(payload.new_status) === -1) {
    return errorResponse('VAL_002', 'Status non supportato: ' + payload.new_status);
  }

  var application = getEntityById(payload.entity_id, auth.tenant_id);
  if (!application || application.type !== 'APPLICATION') {
    return errorResponse('SYS_002', 'Candidatura non trovata');
  }

  if (!isTransitionAllowed_('APPLICATION', application.status, payload.new_status)) {
    return errorResponse('WF_001', 'Transizione non consentita: ' + application.status + ' → ' + payload.new_status);
  }

  updateRow('Entities', payload.entity_id, { status: payload.new_status, updated_at: new Date() });
  logStateTransition('APPLICATION', payload.entity_id, application.status, payload.new_status,
    auth.user_id, auth.tenant_id, 'application.updateStatus');

  return successResponse({ entity_id: payload.entity_id, new_status: payload.new_status });
}

function findAssignment_(shiftId, talentProfileId, tenantId) {
  var all = getAllRows('Entities');
  var activeStatuses = [
    ENTITY_STATUS.ASSIGNMENT.CONFIRMED,
    ENTITY_STATUS.ASSIGNMENT.CHECKED_IN,
    ENTITY_STATUS.ASSIGNMENT.CHECKED_OUT,
    ENTITY_STATUS.ASSIGNMENT.VALIDATED,
    ENTITY_STATUS.ASSIGNMENT.PAID
  ];
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.type !== 'ASSIGNMENT') continue;
    if (tenantId && String(e.tenant_id) !== String(tenantId)) continue;
    if (String(e.deleted).toLowerCase() === 'true') continue;
    if (activeStatuses.indexOf(e.status) === -1) continue;
    var d = parseJSON(e.data);
    if (String(d.shift_id) === String(shiftId) && String(d.talent_profile_id) === String(talentProfileId)) {
      e.data = d;
      return e;
    }
  }
  return null;
}
