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
    APPROVED:       ['PENDING'], // annulla turno: revoca approvazione
    // REJECTED, WITHDRAWN: terminali
  },
  ASSIGNMENT: {
    AWAITING_SIGNATURE: ['CONFIRMED', 'CANCELLED'],   // CONFIRMED solo con contratto firmato (contract.accept)
    CONFIRMED:   ['CHECKED_IN',  'CANCELLED', 'NO_SHOW'],
    CHECKED_IN:  ['CHECKED_OUT'],
    CHECKED_OUT: ['VALIDATED'],
    VALIDATED:   ['PAID']
    // PAID, CANCELLED, NO_SHOW: terminali
  },
  CONTRATTO: {
    GENERATED: ['SENT', 'VOID'],
    SENT:      ['SIGNED', 'DECLINED', 'EXPIRED', 'VOID']
    // SIGNED, DECLINED, EXPIRED, VOID: terminali
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

    // APPLICATION APPROVED → crea ASSIGNMENT(AWAITING_SIGNATURE) + controlla SHIFT FULL
    case 'APPLICATION:APPROVED':
      return sideEffect_ApplicationApproved_(entity, auth);

    // APPLICATION APPROVED → PENDING (annulla turno) → cancella ASSIGNMENT collegato
    case 'APPLICATION:PENDING':
      if (oldStatus === ENTITY_STATUS.APPLICATION.APPROVED) {
        return sideEffect_ApplicationRevoked_(entity, auth);
      }
      return null;

    // LEAD_TALENT APPROVED → crea USER + TALENT_PROFILE (delegato a SpecialActions)
    // Gestito direttamente in handleTalentApprove per avere accesso ai payload extra.

    // ASSIGNMENT CHECKED_OUT → calcola timesheet (fatto in SpecialActions.checkout)
    // Non serve qui perché checkout aggiorna già i dati prima di chiamare questa funzione.

    // ASSIGNMENT CANCELLED → libera il posto, ricalcola SHIFT + EVENT saturazione
    case 'ASSIGNMENT:CANCELLED':
      return sideEffect_AssignmentCancelled_(entity, auth);

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

  // Crea ASSIGNMENT in attesa di firma: il posto è occupato, ma l'incarico diventa
  // CONFIRMED solo con il contratto firmato (contract.accept). Il check-in richiede CONFIRMED.
  var assignment = createEntity('ASSIGNMENT', ENTITY_STATUS.ASSIGNMENT.AWAITING_SIGNATURE, {
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

  // Aggiorna posti_confermati sullo shift. Candidatura diretta a evento
  // (shift_id vuoto): checkShiftFullness_ non fa nulla senza uno shift,
  // quindi ricalcola la saturazione dell'evento direttamente — altrimenti
  // confirmed_count resta 0 per ogni nuova approvazione senza turno.
  if (appData.shift_id) {
    checkShiftFullness_(appData.shift_id, auth.tenant_id);
  } else if (appData.event_id) {
    checkEventSaturation_(appData.event_id, auth.tenant_id);
  }

  // Log obbligatorio PRD: creazione assignment
  logAssignmentCreated(
    assignment.entity_id, appData.shift_id,
    appData.talent_profile_id, auth.user_id, auth.tenant_id
  );

  // Email notifica talent — candidatura approvata, con rimando al portale (SENZA token di
  // sessione nel link: il contratto da firmare si vede solo dopo il login). Non blocca
  // l'approvazione se fallisce, ma l'esito è registrato da sendEmail_ in ErrorLog e
  // restituito come email_sent.
  var appMailOk = null;
  try {
    var talentProfile = getEntityById(appData.talent_profile_id, auth.tenant_id);
    if (talentProfile && talentProfile.data.email_contatto) {
      var shift = getEntityById(appData.shift_id, auth.tenant_id);
      var event = getEntityById(appData.event_id, auth.tenant_id);
      if (shift) {
        var eventLink = getFrontendUrl() + '/portale';
        appMailOk = withMailCtx_({ entity_type: 'APPLICATION', entity_id: appData.talent_profile_id, actor: auth.user_id, tenant_id: auth.tenant_id }, function() {
          return sendApplicationApprovedEmail(
            talentProfile.data.email_contatto,
            (talentProfile.data.nome || '') + ' ' + (talentProfile.data.cognome || ''),
            event ? event.data : {},
            shift.data,
            eventLink
          );
        });
      }
    }
  } catch (emailErr) {
    appMailOk = false;
    logError_({ severity: 'ERROR', module: 'WORKFLOWS', action: 'application.approve.mail', entity_type: 'APPLICATION', actor: auth.user_id, tenant_id: auth.tenant_id, message: 'Email candidatura approvata: eccezione ' + emailErr.message, stack: emailErr.stack });
  }

  return successResponse({ assignment_id: assignment.entity_id, email_sent: appMailOk });
}

// ---------------------------------------------------------------------------
// SIDE EFFECT: APPLICATION REVOKED (annulla turno, APPROVED → PENDING)
// ---------------------------------------------------------------------------

function sideEffect_ApplicationRevoked_(application, auth) {
  var appData = application.data;

  var assignment = findAssignment_(appData.shift_id, appData.talent_profile_id, auth.tenant_id);
  if (assignment) {
    transitionEntityStatus('ASSIGNMENT', assignment, ENTITY_STATUS.ASSIGNMENT.CANCELLED, auth);
  }

  return successResponse({ application_id: application.entity_id });
}

// ---------------------------------------------------------------------------
// SIDE EFFECT: ASSIGNMENT CANCELLED
// ---------------------------------------------------------------------------

function sideEffect_AssignmentCancelled_(assignment, auth) {
  // Stesso gap di sideEffect_ApplicationApproved_: se l'ASSIGNMENT non ha
  // shift_id (candidatura diretta a evento), checkShiftFullness_ non fa
  // nulla — risali all'evento via application_id per ricalcolare comunque.
  if (assignment.data.shift_id) {
    checkShiftFullness_(assignment.data.shift_id, auth.tenant_id);
  } else if (assignment.data.application_id) {
    var app = getEntityById(assignment.data.application_id, auth.tenant_id);
    if (app && app.data.event_id) {
      checkEventSaturation_(app.data.event_id, auth.tenant_id);
    }
  }
  return successResponse({ shift_id: assignment.data.shift_id });
}

// ---------------------------------------------------------------------------
// STATI ASSIGNMENT CHE OCCUPANO UN POSTO
// Unica definizione, usata da saturazione, ricerca assignment e backfill.
//   approvati  = AWAITING_SIGNATURE + tutti i confermati  → occupano il posto
//   confermati = approvati meno AWAITING_SIGNATURE         → incarico confermato (contratto firmato o legacy)
// ---------------------------------------------------------------------------

function activeAssignmentStatuses_() {
  return [
    ENTITY_STATUS.ASSIGNMENT.AWAITING_SIGNATURE,
    ENTITY_STATUS.ASSIGNMENT.CONFIRMED,
    ENTITY_STATUS.ASSIGNMENT.CHECKED_IN,
    ENTITY_STATUS.ASSIGNMENT.CHECKED_OUT,
    ENTITY_STATUS.ASSIGNMENT.VALIDATED,
    ENTITY_STATUS.ASSIGNMENT.PAID
  ];
}

function isConfirmedAssignmentStatus_(status) {
  return status !== ENTITY_STATUS.ASSIGNMENT.AWAITING_SIGNATURE &&
         activeAssignmentStatuses_().indexOf(status) !== -1;
}

// ---------------------------------------------------------------------------
// SHIFT FULLNESS CHECK
// ---------------------------------------------------------------------------

/**
 * Conta gli ASSIGNMENT attivi dello shift in due modi:
 *   posti_approvati  = AWAITING_SIGNATURE + confermati (occupano il posto)
 *   posti_confermati = solo confermati (contratto firmato / incarico confermato)
 * Se approvati >= posti_disponibili: SHIFT → FULL.
 * Se approvati < posti_disponibili e SHIFT era FULL: SHIFT → OPEN.
 */
function checkShiftFullness_(shiftId, tenantId) {
  var shift = getEntityById(shiftId, tenantId);
  if (!shift || shift.status === ENTITY_STATUS.SHIFT.CANCELLED) return;

  var activeStatuses = activeAssignmentStatuses_();

  var allAssignments = getAllRows('Entities');
  var count = 0;
  var confirmed = 0;
  for (var i = 0; i < allAssignments.length; i++) {
    var e = allAssignments[i];
    if (e.type !== 'ASSIGNMENT') continue;
    if (String(e.tenant_id) !== String(tenantId)) continue;
    if (String(e.deleted).toLowerCase() === 'true') continue;
    var d = parseJSON(e.data);
    if (String(d.shift_id) !== String(shiftId)) continue;
    if (activeStatuses.indexOf(e.status) !== -1) {
      count++;
      if (isConfirmedAssignmentStatus_(e.status)) confirmed++;
    }
  }

  // Due contatori: approvati (posto occupato) e confermati (firmati)
  updateEntityData(shiftId, { posti_approvati: count, posti_confermati: confirmed }, tenantId, 'system');

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

  if (shift.data.event_id) {
    checkEventSaturation_(shift.data.event_id, tenantId);
  }
}

/**
 * Ricalcola sull'EVENT approved_count (AWAITING_SIGNATURE + confermati) e
 * confirmed_count (solo confermati): somma degli ASSIGNMENT attivi su tutti gli
 * SHIFT dell'evento. Chiamata da checkShiftFullness_ per tenere sincronizzato
 * il badge saturazione ("X/Y") nella card evento.
 */
function checkEventSaturation_(eventId, tenantId) {
  var activeStatuses = activeAssignmentStatuses_();

  var all = getAllRows('Entities');

  var shiftIds = {};
  for (var i = 0; i < all.length; i++) {
    var s = all[i];
    if (s.type !== 'SHIFT') continue;
    if (String(s.tenant_id) !== String(tenantId)) continue;
    if (String(s.deleted).toLowerCase() === 'true') continue;
    var sd = parseJSON(s.data);
    if (String(sd.event_id) === String(eventId)) shiftIds[s.entity_id] = true;
  }

  // Fallback: ASSIGNMENT con shift_id vuoto — risali via application_id
  // all'APPLICATION per recuperare l'event_id (ASSIGNMENT.data non ha event_id).
  var applicationIds = {};
  for (var k = 0; k < all.length; k++) {
    var p = all[k];
    if (p.type !== 'APPLICATION') continue;
    if (String(p.tenant_id) !== String(tenantId)) continue;
    if (String(p.deleted).toLowerCase() === 'true') continue;
    var pd = parseJSON(p.data);
    if (String(pd.event_id) === String(eventId)) applicationIds[p.entity_id] = true;
  }

  var count = 0;
  var confirmed = 0;
  for (var j = 0; j < all.length; j++) {
    var a = all[j];
    if (a.type !== 'ASSIGNMENT') continue;
    if (String(a.tenant_id) !== String(tenantId)) continue;
    if (String(a.deleted).toLowerCase() === 'true') continue;
    var ad = parseJSON(a.data);
    if (!shiftIds[ad.shift_id]) {
      if (!applicationIds[ad.application_id]) continue;
    }
    if (activeStatuses.indexOf(a.status) !== -1) {
      count++;
      if (isConfirmedAssignmentStatus_(a.status)) confirmed++;
    }
  }

  updateEntityData(eventId, { approved_count: count, confirmed_count: confirmed }, tenantId, 'system');
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
    transitionTalentToApproved_(lead, ENTITY_STATUS.TALENT_PROFILE.APPROVED, mergedData);
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
  var tempPwd = generateTempPassword();
  if (existingUser) {
    userId = existingUser.user_id;
    if (String(existingUser.role) === ROLES.USER) {
      // Mai più approvazione senza accesso: nuova password temporanea anche se lo USER esiste già.
      updateRow('Users', existingUser.user_id, {
        password_hash: hashPassword(tempPwd),
        pwd_version:   (parseInt(existingUser.pwd_version, 10) || 0) + 1
      });
    } else {
      // Account staff con la stessa email: non si tocca la sua password.
      tempPwd = null;
      logError_({ severity: 'WARN', module: 'WORKFLOWS', action: 'talent.approve', entity_type: 'LEAD_TALENT', entity_id: lead.entity_id,
        actor: auth.user_id, tenant_id: auth.tenant_id, message: 'Email gia associata a un utente non-talent (' + existingUser.role + '): password non reimpostata' });
    }
  } else {
    // Crea USER con password temporanea
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
    // Crea TALENT_PROFILE — il questionario (leadData) è la fonte madre di tutti i
    // dati del profilo: copiamo l'intero oggetto (tutte le 7 sezioni) e sovrascriviamo
    // solo i campi derivati/specifici del TALENT_PROFILE.
    var profile = createEntity('TALENT_PROFILE', ENTITY_STATUS.TALENT_PROFILE.APPROVED, Object.assign({}, leadData, {
      lead_id:              lead.entity_id,
      user_id:              userId,
      email_contatto:       leadData.email             || '',
      citta:                leadData.citta             || leadData.residenza_citta || '',
      citta_nascita:        leadData.nascita_citta     || '',
      province_operativita: leadData.province_lavoro   || leadData.province_operativita || [],
      rating:               0,
      stato_verifica:       'verified',
      documenti: {
        cv:   leadData.cv_url         ? { file_id: '', url: leadData.cv_url,         status: 'valid', uploaded_at: new Date().toISOString() } : {},
        foto: leadData.foto_busto_url ? { file_id: '', url: leadData.foto_busto_url, status: 'valid', uploaded_at: new Date().toISOString() } : {},
        carta_identita: {}
      },
      score:                 leadData.score                 || 0,
      score_questionario:   leadData.score_questionario    || 0,
      score_admin:          leadData.score_admin           || 5,
      ranking:              leadData.ranking               || 'D',
      eventi_crm_completati: 0,
      eventi_precrm:        leadData.eventi_precrm         || 0,
      stato_profilo:        'approvato',
      credentials_sent:       false,
      credentials_sent_at:    '',
      credentials_last_error: '',
      credentials_attempts:   0
    }), auth.tenant_id, auth.user_id);
    profileId = profile.entity_id;
  }

  // Transiziona LEAD → APPROVED (status + stato_profilo allineati)
  transitionTalentToApproved_(lead, ENTITY_STATUS.LEAD_TALENT.APPROVED);
  if (existingProfile) {
    updateEntityData(profileId, { stato_profilo: 'approvato' }, auth.tenant_id, auth.user_id);
  }

  // Log obbligatorio PRD: approvazione talent
  logTalentApproved(lead.entity_id, userId, profileId, auth.user_id, auth.tenant_id);

  // Email credenziali: credentials_sent=TRUE solo se l'invio riesce davvero.
  // Se fallisce lo stato resta APPROVED con credentials_sent=FALSE (+ ERROR in ErrorLog)
  // e l'admin / il watchdog possono ripetere l'invio.
  var credRes = deliverTalentCredentials_(profileId, auth.tenant_id, leadData.email, leadData.nome, tempPwd, auth, false);

  var result = {
    lead_id:    lead.entity_id,
    user_id:    userId,
    profile_id: profileId,
    email:      leadData.email,
    credentials_sent:  credRes.ok,
    credentials_error: credRes.ok ? '' : credRes.error
  };
  if (tempPwd) result.temp_password = tempPwd;

  return successResponse(result);
}

/**
 * Unica funzione di transizione verso APPROVED per lead e profili talent:
 * scrive status e stato_profilo ('approvato') nella stessa updateRow, così
 * colonna e JSON interno non possono più divergere.
 * @param {object} entity       entità con .data già parsato
 * @param {string} newStatus
 * @param {object} [dataOverride] dati da scrivere al posto di entity.data
 */
function transitionTalentToApproved_(entity, newStatus, dataOverride) {
  var data = Object.assign({}, dataOverride || entity.data || {}, { stato_profilo: 'approvato' });
  updateRow('Entities', entity.entity_id, {
    status:     newStatus,
    data:       serializeJSON(data),
    updated_at: new Date()
  });
  return data;
}

/**
 * Invia le credenziali (tempPwd valorizzata) o la sola conferma approvazione
 * (tempPwd null, account staff) e registra l'esito sul TALENT_PROFILE.
 * credentials_sent=TRUE SOLO dopo ok:true. Non lancia mai.
 * @param {boolean} manual  true = azione admin: azzera il contatore tentativi
 * @returns {{ok:boolean, error:string}}
 */
function deliverTalentCredentials_(profileId, tenantId, email, nome, tempPwd, auth, manual) {
  var actor = (auth && auth.user_id) || 'system';
  var ctx = { entity_type: 'TALENT_PROFILE', entity_id: profileId, actor: actor, tenant_id: tenantId };
  var res;
  try {
    res = tempPwd
      ? sendWelcomeEmail(email, nome, tempPwd, undefined, ctx)
      : sendProfileApprovedEmail(email, nome, ctx);
  } catch (e) {
    res = { ok: false, error: 'EXCEPTION: ' + e.message };
    logError_({ severity: 'ERROR', module: 'WORKFLOWS', action: 'talent.credentials', entity_type: 'TALENT_PROFILE',
      entity_id: profileId, actor: actor, tenant_id: tenantId, message: 'Eccezione invio credenziali: ' + e.message, stack: e.stack });
  }

  var nowIso = new Date().toISOString();
  var prev = 0;
  try {
    var cur = getEntityById(profileId, tenantId);
    prev = manual ? 0 : (parseInt(cur && cur.data && cur.data.credentials_attempts, 10) || 0);
  } catch (e) {}
  var upd = res.ok
    ? { credentials_sent: true,  credentials_sent_at: nowIso, credentials_last_error: '', credentials_attempts: prev + 1 }
    : { credentials_sent: false, credentials_last_error: String(res.error || 'UNKNOWN').substring(0, 300),
        credentials_last_attempt_at: nowIso, credentials_attempts: prev + 1 };
  try {
    updateEntityData(profileId, upd, tenantId, actor);
  } catch (e) {
    logError_({ severity: 'ERROR', module: 'WORKFLOWS', action: 'talent.credentials.flag', entity_type: 'TALENT_PROFILE',
      entity_id: profileId, actor: actor, tenant_id: tenantId, message: 'Scrittura flag credentials_sent fallita: ' + e.message, stack: e.stack });
  }
  return { ok: !!res.ok, error: res.ok ? '' : String(res.error || 'UNKNOWN') };
}

/**
 * Admin: rigenera una password temporanea e reinvia l'accesso a un talent
 * già approvato. Action 'talent.resendCredentials'.
 */
function handleTalentResendCredentials(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var profile = getEntityById(payload.entity_id, auth.tenant_id);
  if (!profile || profile.type !== 'TALENT_PROFILE') return errorResponse('SYS_002', 'Profilo talent non trovato');
  if (profile.status !== ENTITY_STATUS.TALENT_PROFILE.APPROVED && profile.status !== ENTITY_STATUS.TALENT_PROFILE.ACTIVE) {
    return errorResponse('WF_002', 'Il profilo deve essere APPROVED o ACTIVE. Stato attuale: ' + profile.status);
  }

  var user = findTalentUser_(profile);
  if (!user) {
    logError_({ severity: 'ERROR', module: 'WORKFLOWS', action: 'talent.resendCredentials', entity_type: 'TALENT_PROFILE',
      entity_id: profile.entity_id, actor: auth.user_id, tenant_id: auth.tenant_id, message: 'USER collegato al profilo non trovato' });
    return errorResponse('SYS_002', 'Account utente collegato non trovato');
  }
  if (String(user.role) !== ROLES.USER) {
    return errorResponse('WF_002', 'L\'account collegato non è un account talent: password non reimpostabile da qui');
  }

  // Il talent ha già fatto login: resettare la password lo sloggherebbe. Serve conferma esplicita.
  if (user.last_login && payload.confirm_reset !== true) {
    return errorResponse('WF_CONFIRM', 'Il talent ha già acceduto (ultimo login ' + formatLastLogin_(user.last_login) + '): conferma il reset password');
  }

  var tempPwd = generateTempPassword();
  updateRow('Users', user.user_id, {
    password_hash: hashPassword(tempPwd),
    pwd_version:   (parseInt(user.pwd_version, 10) || 0) + 1
  });

  var res = deliverTalentCredentials_(profile.entity_id, auth.tenant_id, user.email, profile.data.nome || '', tempPwd, auth, true);
  logActivity({
    level: res.ok ? 'INFO' : 'ERROR', module: 'WORKFLOWS', action: 'talent.resendCredentials',
    entity_type: 'TALENT_PROFILE', entity_id: profile.entity_id, user_id: auth.user_id, tenant_id: auth.tenant_id,
    note: res.ok ? 'ok' : res.error
  });
  if (!res.ok) return errorResponse('SYS_001', 'Invio email fallito: ' + res.error);
  return successResponse({ profile_id: profile.entity_id, credentials_sent: true });
}

function formatLastLogin_(v) {
  if (!v) return '';
  var d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/**
 * Sola lettura: ultimo login dell'account collegato, per il popup di conferma
 * di "Reinvia accesso". Action 'talent.credentialsInfo'.
 */
function handleTalentCredentialsInfo(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;
  var profile = getEntityById(payload.entity_id, auth.tenant_id);
  if (!profile || profile.type !== 'TALENT_PROFILE') return errorResponse('SYS_002', 'Profilo talent non trovato');
  var user = findTalentUser_(profile);
  return successResponse({
    user_found:       !!user,
    last_login:       user ? formatLastLogin_(user.last_login) : '',
    credentials_sent: profile.data.credentials_sent === undefined ? null : profile.data.credentials_sent
  });
}

// ---------------------------------------------------------------------------
// RICHIESTA RECENSIONE GOOGLE — 'talent.previewReviewRequest' / 'talent.sendReviewRequest'
// Campi su TALENT_PROFILE.data: review_request_sent_at, review_request_count, review_request_by
// ---------------------------------------------------------------------------

/**
 * Controlli comuni ad anteprima e invio (profilo esistente, non eliminato,
 * APPROVED, email valida) + stato cooldown. Nessun dato sensibile nel risultato.
 * @returns {{profile:object, email:string, can_send:boolean, reason:string,
 *            already_sent_at:string, cooldown_active:boolean}}
 */
function reviewRequestCheck_(entityId, tenantId) {
  var profile = getEntityById(entityId, tenantId);   // esclude già i soft-deleted
  var out = { profile: null, email: '', can_send: false, reason: '', already_sent_at: '', cooldown_active: false };
  if (!profile || profile.type !== 'TALENT_PROFILE' || String(profile.deleted).toLowerCase() === 'true') {
    out.reason = 'Profilo talent non trovato';
    return out;
  }
  out.profile = profile;
  var d = profile.data || {};
  out.already_sent_at = d.review_request_sent_at ? String(d.review_request_sent_at) : '';
  if (profile.status !== ENTITY_STATUS.TALENT_PROFILE.APPROVED) {
    out.reason = 'Il profilo deve essere APPROVED. Stato attuale: ' + profile.status;
    return out;
  }
  out.email = String(d.email || d.email_contatto || '').trim();
  if (!out.email || !isValidEmail(out.email)) {
    out.reason = 'Email del talent assente o non valida';
    return out;
  }
  if (out.already_sent_at) {
    var t = new Date(out.already_sent_at).getTime();
    out.cooldown_active = !isNaN(t) && (Date.now() - t) < REVIEW_REQUEST_COOLDOWN_DAYS * 24 * 3600 * 1000;
  }
  out.can_send = true;
  return out;
}

function formatItDate_(iso) {
  var d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : Utilities.formatDate(d, 'Europe/Rome', 'dd/MM/yyyy');
}

/** Sola lettura: restituisce l'email ESATTA che verrebbe inviata. */
function handleTalentPreviewReviewRequest(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;
  var chk = reviewRequestCheck_(payload.entity_id, auth.tenant_id);
  if (!chk.profile) return errorResponse('SYS_002', chk.reason);
  var m = buildReviewRequestEmail_(chk.profile.data.nome || '');
  return successResponse({
    subject:         m.subject,
    html:            m.html,
    to_masked:       chk.email ? maskEmail_(chk.email) : '',
    already_sent_at: chk.already_sent_at,
    cooldown_active: chk.cooldown_active,
    can_send:        chk.can_send,
    reason:          chk.reason
  });
}

function handleTalentSendReviewRequest(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;
  if (payload.confirm !== true) return errorResponse('VAL_001', 'Conferma esplicita richiesta (confirm:true)', 'confirm');

  var chk = reviewRequestCheck_(payload.entity_id, auth.tenant_id);
  if (!chk.profile) return errorResponse('SYS_002', chk.reason);
  if (!chk.can_send) return errorResponse('WF_002', chk.reason);
  if (chk.cooldown_active && payload.force !== true) {
    return errorResponse('WF_COOLDOWN', 'Richiesta già inviata il ' + formatItDate_(chk.already_sent_at) +
      ' (cooldown ' + REVIEW_REQUEST_COOLDOWN_DAYS + ' giorni)');
  }

  var profile = chk.profile;
  var mod = (_mailCtx && _mailCtx.module) || 'WORKFLOWS';   // i test impostano module=TEST
  var ctx = { module: mod, mailType: 'REVIEW_REQUEST', entity_type: 'TALENT_PROFILE',
              entity_id: profile.entity_id, actor: auth.user_id, tenant_id: auth.tenant_id };
  var res;
  try {
    res = withMailCtx_(ctx, function() { return sendReviewRequestEmail(chk.email, profile.data.nome || '', ctx); });
  } catch (e) {
    res = { ok: false, error: 'EXCEPTION: ' + e.message };
  }

  if (!res.ok) {
    // QUOTA_RESERVE è uno stato atteso (già loggato WARN da sendEmail_): niente alert P2.
    if (String(res.error).indexOf('QUOTA_RESERVE') !== 0) {
      logError_({ severity: 'ERROR', error_class: 'EMAIL_SEND', priority: 'P2', module: mod, action: 'talent.sendReviewRequest',
        entity_type: 'TALENT_PROFILE', entity_id: profile.entity_id, actor: auth.user_id, tenant_id: auth.tenant_id,
        message: 'Invio richiesta recensione fallito: ' + res.error });
    }
    logActivity({ level: 'ERROR', module: 'WORKFLOWS', action: 'talent.sendReviewRequest', entity_type: 'TALENT_PROFILE',
      entity_id: profile.entity_id, user_id: auth.user_id, tenant_id: auth.tenant_id, note: String(res.error).substring(0, 200) });
    var friendly = String(res.error).indexOf('QUOTA_RESERVE') === 0
      ? 'Quota email giornaliera quasi esaurita: riprova domani (le ultime mail sono riservate a credenziali e approvazioni)'
      : 'Invio email fallito: ' + res.error;
    return errorResponse('SYS_001', friendly);
  }

  var nowIso = new Date().toISOString();
  var count = (parseInt(profile.data.review_request_count, 10) || 0) + 1;
  try {
    updateEntityData(profile.entity_id, { review_request_sent_at: nowIso, review_request_count: count, review_request_by: auth.user_id },
      auth.tenant_id, auth.user_id);
  } catch (e) {
    logError_({ severity: 'ERROR', module: mod, action: 'talent.sendReviewRequest.flag', entity_type: 'TALENT_PROFILE',
      entity_id: profile.entity_id, actor: auth.user_id, tenant_id: auth.tenant_id,
      message: 'Mail inviata ma scrittura review_request_* fallita: ' + e.message, stack: e.stack });
  }
  logActivity({ level: 'INFO', module: 'WORKFLOWS', action: 'talent.sendReviewRequest', entity_type: 'TALENT_PROFILE',
    entity_id: profile.entity_id, user_id: auth.user_id, tenant_id: auth.tenant_id,
    note: 'ok n=' + count + (payload.force === true ? ' force' : '') });
  return successResponse({ profile_id: profile.entity_id, review_request_sent_at: nowIso, review_request_count: count });
}

// ---------------------------------------------------------------------------
// TEST MANUALI (editor GAS)
// ---------------------------------------------------------------------------

/** Genera l'HTML senza inviare nulla; scrive nel Log lunghezza, oggetto, presenza link CTA. */
function testReviewRequestPreview() {
  var m = buildReviewRequestEmail_('Test');
  Logger.log('subject=' + m.subject);
  Logger.log('html_length=' + m.html.length + ' | text_length=' + m.text.length);
  Logger.log('cta_link_in_html=' + (m.html.indexOf('href="' + GOOGLE_REVIEW_URL + '"') !== -1) +
             ' | cta_link_in_text=' + (m.text.indexOf(GOOGLE_REVIEW_URL) !== -1));
  Logger.log('contiene_svg=' + /<svg/i.test(m.html));
}

/**
 * Invia SOLO a madeeventssrls@gmail.com, con profilo fittizio (soft-deleted a fine test).
 * Percorre l'intero handler (controlli, invio, scrittura review_request_*).
 * Mai verso talent reali: destinatario hardcoded.
 */
function testReviewRequestSendToSelf() {
  var SELF = 'madeeventssrls@gmail.com';
  var tenantId = getDefaultTenantId_();
  if (!tenantId || String(tenantId).toUpperCase() === 'UUID') throw new Error('Nessun tenant attivo valido');
  var profile = createEntity('TALENT_PROFILE', ENTITY_STATUS.TALENT_PROFILE.APPROVED, {
    nome: 'Test', cognome: 'ReviewRequest', email: SELF, stato_profilo: 'approvato'
  }, tenantId, 'system');
  try {
    var res = withMailCtx_({ module: 'TEST' }, function() {
      return handleTalentSendReviewRequest({ entity_id: profile.entity_id, confirm: true }, { user_id: 'system', tenant_id: tenantId });
    });
    Logger.log('esito=' + JSON.stringify(res));
    var after = getEntityById(profile.entity_id, tenantId);
    Logger.log('flag=' + JSON.stringify({ sent_at: after.data.review_request_sent_at, count: after.data.review_request_count, by: after.data.review_request_by }));
  } finally {
    softDelete('Entities', profile.entity_id, 'system');
  }
}

/**
 * AUDIT SOLA LETTURA — 'admin.auditCredentials'.
 * TALENT_PROFILE APPROVED il cui USER non ha mai fatto login (o non esiste).
 * Nessuna scrittura.
 */
function handleAuditCredentials(payload, auth) {
  var list = collectAuditCredentials_(auth.tenant_id);
  return successResponse({ count: list.length, profiles: list });
}

/**
 * Logica condivisa dell'audit credenziali (SOLA LETTURA).
 * @param {string|null} tenantId  null = tutti i tenant (uso da editor GAS)
 */
function collectAuditCredentials_(tenantId) {
  var users = getAllRows('Users');
  var byId = {}, byEmail = {};
  users.forEach(function(u) {
    byId[String(u.user_id)] = u;
    byEmail[String(u.email).toLowerCase().trim()] = u;
  });

  var list = [];
  getAllRows('Entities').forEach(function(r) {
    if (r.type !== 'TALENT_PROFILE' || r.status !== ENTITY_STATUS.TALENT_PROFILE.APPROVED) return;
    if (tenantId && String(r.tenant_id) !== String(tenantId)) return;
    var d = parseJSON(r.data) || {};
    var email = String(d.email || d.email_contatto || '').toLowerCase().trim();
    var u = (d.user_id && byId[String(d.user_id)]) || byEmail[email] || null;
    if (u && u.last_login) return;
    list.push({
      entity_id:        r.entity_id,
      nome:             ((d.nome || '') + ' ' + (d.cognome || '')).trim(),
      email:            email,
      approvato_il:     formatLastLogin_(r.created_at),
      user_found:       !!u,
      credentials_sent: d.credentials_sent === undefined ? null : d.credentials_sent,
      credentials_last_error: d.credentials_last_error || '',
      last_login:       u ? formatLastLogin_(u.last_login) : ''
    });
  });
  list.sort(function(a, b) { return String(a.approvato_il).localeCompare(String(b.approvato_il)); });
  return list;
}

/**
 * Da eseguire dall'editor GAS: scrive nel Log (Visualizza → Log di esecuzione) i TALENT_PROFILE
 * APPROVED il cui USER non ha mai fatto login. SOLA LETTURA: nessuna scrittura su sheet,
 * nessuna mail, nessuna modifica password.
 */
function auditCredentialsReport() {
  var list = collectAuditCredentials_(null);
  Logger.log('=== AUDIT CREDENZIALI — profili APPROVED senza login: ' + list.length + ' ===');
  Logger.log('nome | email | approvato_il | credentials_sent | last_login | account');
  list.forEach(function(p) {
    Logger.log([
      p.nome || '(senza nome)', p.email || '(senza email)', p.approvato_il || '',
      p.credentials_sent === null ? 'n/d (storico)' : String(p.credentials_sent),
      p.last_login || 'mai', p.user_found ? 'USER ok' : 'USER MANCANTE'
    ].join(' | '));
  });
  var noFlag = list.filter(function(p) { return p.credentials_sent === null; }).length;
  var failed = list.filter(function(p) { return p.credentials_sent === false; }).length;
  Logger.log('=== di cui: credentials_sent=false: ' + failed + ' | flag assente (storici): ' + noFlag + ' | USER mancante: ' +
    list.filter(function(p) { return !p.user_found; }).length + ' ===');
}

/** USER collegato a un TALENT_PROFILE (user_id nel JSON, fallback sull'email). */
function findTalentUser_(profile) {
  var d = profile.data || {};
  var users = getAllRows('Users');
  var byEmail = null;
  var email = String(d.email || d.email_contatto || '').toLowerCase().trim();
  for (var i = 0; i < users.length; i++) {
    if (d.user_id && String(users[i].user_id) === String(d.user_id)) return users[i];
    if (!byEmail && email && String(users[i].email).toLowerCase().trim() === email) byEmail = users[i];
  }
  return byEmail;
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
    transitionTalentToApproved_(lead, ENTITY_STATUS.TALENT_PROFILE.APPROVED, restoredData);
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

/**
 * "Annulla turno" — revoca una candidatura già APPROVATA e riporta il
 * talent in IN_ATTESA (PENDING). Cancella l'ASSIGNMENT collegato e
 * ricalcola saturazione SHIFT + EVENT (side effect APPLICATION:PENDING).
 */
function handleApplicationRevoke(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var application = getEntityById(payload.entity_id, auth.tenant_id);
  if (!application || application.type !== 'APPLICATION') {
    return errorResponse('SYS_002', 'Candidatura non trovata');
  }
  if (application.status !== ENTITY_STATUS.APPLICATION.APPROVED) {
    return errorResponse('WF_002',
      'La candidatura deve essere APPROVED per essere annullata. Stato attuale: ' + application.status);
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var freshApp = getEntityById(payload.entity_id, auth.tenant_id);
    if (!isTransitionAllowed_('APPLICATION', freshApp.status, ENTITY_STATUS.APPLICATION.PENDING)) {
      return errorResponse('WF_002', 'Transizione PENDING non consentita dallo stato: ' + freshApp.status);
    }

    return transitionEntityStatus('APPLICATION', freshApp, ENTITY_STATUS.APPLICATION.PENDING, auth);

  } catch (e) {
    return errorResponse('SYS_001', 'Impossibile acquisire lock: ' + e.message);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Assegna (o rimuove, con shift_id = '') il turno di una candidatura già
 * APPROVATA — copre il caso "candidatura diretta a evento" dove shift_id
 * è vuoto in fase di submit. Aggiorna anche l'ASSIGNMENT collegato e
 * ricalcola saturazione SHIFT (vecchio+nuovo) + EVENT.
 */
function handleApplicationAssignShift(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var application = getEntityById(payload.entity_id, auth.tenant_id);
  if (!application || application.type !== 'APPLICATION') {
    return errorResponse('SYS_002', 'Candidatura non trovata');
  }
  if (application.status !== ENTITY_STATUS.APPLICATION.APPROVED) {
    return errorResponse('WF_002',
      'La candidatura deve essere APPROVED per assegnare un turno. Stato attuale: ' + application.status);
  }

  var newShiftId = payload.shift_id || '';
  if (newShiftId) {
    var shift = getEntityById(newShiftId, auth.tenant_id);
    if (!shift || shift.type !== 'SHIFT') {
      return errorResponse('SYS_002', 'Turno non trovato');
    }
    if (String(shift.data.event_id) !== String(application.data.event_id)) {
      return errorResponse('VAL_002', 'Il turno selezionato non appartiene a questo evento');
    }
  }

  var oldShiftId = application.data.shift_id || '';

  updateEntityData(application.entity_id, { shift_id: newShiftId }, auth.tenant_id, auth.user_id);

  var assignment = findAssignmentByApplicationId_(application.entity_id, auth.tenant_id);
  if (assignment) {
    updateEntityData(assignment.entity_id, { shift_id: newShiftId }, auth.tenant_id, auth.user_id);
  } else if (newShiftId) {
    assignment = createEntity('ASSIGNMENT', ENTITY_STATUS.ASSIGNMENT.CONFIRMED, {
      shift_id:           newShiftId,
      talent_profile_id:  application.data.talent_profile_id,
      application_id:     application.entity_id,
      note_admin:         '',
      checkin:            {},
      checkout:           {},
      timesheet:          {},
      reminder_24h_sent:  false,
      reminder_2h_sent:   false
    }, auth.tenant_id, auth.user_id);
  }

  if (oldShiftId && oldShiftId !== newShiftId) checkShiftFullness_(oldShiftId, auth.tenant_id);
  if (newShiftId) checkShiftFullness_(newShiftId, auth.tenant_id);

  return successResponse({ application_id: application.entity_id, shift_id: newShiftId });
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

// ---------------------------------------------------------------------------
// APPLICATION: MARK EVENT COMPLETED
// ---------------------------------------------------------------------------

function handleMarkEventCompleted(payload, auth) {
  if (!auth || (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SUPER_ADMIN)) {
    return errorResponse('AUTH_003', 'Permesso negato');
  }

  var valid = requireFields(payload, ['application_id']);
  if (valid) return valid;

  var app = getEntityById(payload.application_id, auth.tenant_id);
  if (!app || app.type !== 'APPLICATION') {
    return errorResponse('SYS_002', 'Candidatura non trovata');
  }

  if (app.status !== ENTITY_STATUS.APPLICATION.APPROVED) {
    return errorResponse('VAL_001', 'Solo candidature approvate possono essere segnate come completate');
  }

  var appData = app.data || {};
  if (appData.evento_completato === true) {
    return errorResponse('VAL_001', 'Evento già segnato come completato');
  }

  updateEntityData(payload.application_id, {
    evento_completato:    true,
    evento_completato_at: new Date().toISOString()
  }, auth.tenant_id, auth.user_id);

  var talentId = appData.talent_profile_id;
  var eventId  = appData.event_id;

  if (!talentId) {
    return errorResponse('SYS_002', 'talent_profile_id mancante in application');
  }

  var talent = getEntityById(talentId, auth.tenant_id);
  if (!talent || talent.type !== 'TALENT_PROFILE') {
    return errorResponse('SYS_002', 'Talent non trovato');
  }

  var td          = talent.data || {};
  var eventiCRM   = parseInt(td.eventi_crm_completati) || 0;
  var eventiPreCRM = parseInt(td.eventi_precrm) || 0;
  var eventiIDs   = Array.isArray(td.eventi_crm_ids) ? td.eventi_crm_ids : [];

  eventiCRM += 1;
  if (eventId && eventiIDs.indexOf(eventId) === -1) {
    eventiIDs.push(eventId);
  }

  var scoreQuestionario = calculateQuestionarioScore(td);
  var scoreAdmin        = td.score_admin || 5;
  var scoreFinal        = calculateFinalScore(scoreQuestionario, scoreAdmin);

  updateEntityData(talentId, {
    eventi_crm_completati: eventiCRM,
    eventi_crm_ids:        eventiIDs,
    eventi_made_totali:    eventiCRM + eventiPreCRM,
    score_questionario:    scoreQuestionario,
    score:                 scoreFinal
  }, auth.tenant_id, auth.user_id);

  return successResponse({
    message:               'Evento segnato come completato',
    eventi_crm_completati: eventiCRM,
    eventi_made_totali:    eventiCRM + eventiPreCRM,
    score:                 scoreFinal
  });
}

function findAssignment_(shiftId, talentProfileId, tenantId) {
  var all = getAllRows('Entities');
  var activeStatuses = activeAssignmentStatuses_();
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

function findAssignmentByApplicationId_(applicationId, tenantId) {
  var all = getAllRows('Entities');
  var activeStatuses = activeAssignmentStatuses_();
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.type !== 'ASSIGNMENT') continue;
    if (tenantId && String(e.tenant_id) !== String(tenantId)) continue;
    if (String(e.deleted).toLowerCase() === 'true') continue;
    if (activeStatuses.indexOf(e.status) === -1) continue;
    var d = parseJSON(e.data);
    if (String(d.application_id) === String(applicationId)) {
      e.data = d;
      return e;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// BACKFILL — recupera i dati del questionario persi dai TALENT_PROFILE
// approvati prima del fix del mapping LEAD → TALENT_PROFILE (BUG7).
// Azione admin 'talent.backfillFromLead'. Di default gira in dry-run: passa
// { dryRun: false } esplicitamente per scrivere davvero. Non sovrascrive mai
// un campo già valorizzato nel TALENT_PROFILE — riempie solo i vuoti.
// ---------------------------------------------------------------------------

var BACKFILL_LEAD_BOOKKEEPING_FIELDS_ = [
  'lead_token', 'gdpr_consent', 'gdpr_timestamp', 'stato_profilo',
  'step_completed', 'sezione_completata', 'registration_started_at', 'registration_completed_at',
  'ultimo_accesso', 'ultimo_sollecito', 'sollecito_1_inviato', 'sollecito_2_inviato', 'sollecito_finale_inviato',
  'score', 'score_questionario', 'score_admin', 'ranking'
];

function backfillIsEmpty_(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

function handleTalentBackfillFromLead(payload, auth) {
  var dryRun = payload.dryRun !== false; // default true — serve dryRun:false esplicito per scrivere

  var allEntities = getAllRows('Entities');
  var leadsById = {};
  for (var i = 0; i < allEntities.length; i++) {
    if (allEntities[i].type === 'LEAD_TALENT') leadsById[allEntities[i].entity_id] = allEntities[i];
  }

  var report = [];
  for (var j = 0; j < allEntities.length; j++) {
    var e = allEntities[j];
    if (e.type !== 'TALENT_PROFILE') continue;
    if (auth.tenant_id && String(e.tenant_id) !== String(auth.tenant_id)) continue;

    var profileData = parseJSON(e.data);
    var lead = leadsById[profileData.lead_id];
    if (!lead) continue;
    var leadData = parseJSON(lead.data);

    var patch = {};

    // Campi con nome diverso tra LEAD_TALENT e TALENT_PROFILE
    var mapped = {
      email_contatto:       leadData.email,
      citta_nascita:        leadData.nascita_citta,
      province_operativita: leadData.province_lavoro
    };
    for (var mk in mapped) {
      if (backfillIsEmpty_(profileData[mk]) && !backfillIsEmpty_(mapped[mk])) patch[mk] = mapped[mk];
    }

    // Tutti gli altri campi del questionario, stesso nome in entrambi
    for (var key in leadData) {
      if (BACKFILL_LEAD_BOOKKEEPING_FIELDS_.indexOf(key) !== -1) continue;
      if (mapped.hasOwnProperty(key)) continue;
      if (backfillIsEmpty_(profileData[key]) && !backfillIsEmpty_(leadData[key])) patch[key] = leadData[key];
    }

    if (Object.keys(patch).length === 0) continue;

    report.push({ entity_id: e.entity_id, lead_id: lead.entity_id, fields_backfilled: Object.keys(patch) });

    if (!dryRun) {
      updateEntityData(e.entity_id, patch, e.tenant_id, auth.user_id);
    }
  }

  return successResponse({
    dry_run: dryRun,
    profiles_updated: report.length,
    details: report
  });
}

// ---------------------------------------------------------------------------
// BACKFILL — ricalcola confirmed_count sugli EVENT esistenti, creati prima
// del fix saturazione evento (checkEventSaturation_ non esisteva ancora).
// Azione admin 'event.backfillSaturation'. Default dry-run: passa
// { dryRun: false } esplicitamente per scrivere davvero.
// ---------------------------------------------------------------------------

function handleEventBackfillSaturation(payload, auth) {
  var dryRun = payload.dryRun !== false; // default true — serve dryRun:false esplicito per scrivere

  var all = getAllRows('Entities');
  var report = [];

  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.type !== 'EVENT') continue;
    if (String(e.deleted).toLowerCase() === 'true') continue;
    if (auth.tenant_id && String(e.tenant_id) !== String(auth.tenant_id)) continue;

    var before = Number(parseJSON(e.data).confirmed_count) || 0;

    if (!dryRun) {
      checkEventSaturation_(e.entity_id, e.tenant_id);
    }

    var after = dryRun ? before : Number(parseJSON(getEntityById(e.entity_id, e.tenant_id).data).confirmed_count) || 0;

    if (dryRun) {
      // In dry-run non scriviamo: calcola cosa DIVENTEREBBE senza salvare,
      // riusando la stessa logica di conteggio di checkEventSaturation_.
      after = countActiveAssignmentsForEvent_(e.entity_id, e.tenant_id);
    }

    if (before !== after) {
      report.push({ entity_id: e.entity_id, titolo: parseJSON(e.data).titolo || '', before: before, after: after });
    }
  }

  return successResponse({
    dry_run: dryRun,
    events_changed: report.length,
    details: report
  });
}

// Stessa logica di conteggio di checkEventSaturation_ per confirmed_count, senza
// scrivere — usata dal backfill in dry-run per mostrare cosa cambierebbe.
function countActiveAssignmentsForEvent_(eventId, tenantId) {
  var activeStatuses = activeAssignmentStatuses_();

  var all = getAllRows('Entities');

  var shiftIds = {};
  for (var i = 0; i < all.length; i++) {
    var s = all[i];
    if (s.type !== 'SHIFT') continue;
    if (String(s.tenant_id) !== String(tenantId)) continue;
    if (String(s.deleted).toLowerCase() === 'true') continue;
    var sd = parseJSON(s.data);
    if (String(sd.event_id) === String(eventId)) shiftIds[s.entity_id] = true;
  }

  var count = 0;
  for (var j = 0; j < all.length; j++) {
    var a = all[j];
    if (a.type !== 'ASSIGNMENT') continue;
    if (String(a.tenant_id) !== String(tenantId)) continue;
    if (String(a.deleted).toLowerCase() === 'true') continue;
    var ad = parseJSON(a.data);
    if (!shiftIds[ad.shift_id]) continue;
    // Stesso conteggio di confirmed_count (solo confermati)
    if (activeStatuses.indexOf(a.status) !== -1 && isConfirmedAssignmentStatus_(a.status)) count++;
  }

  return count;
}

// ---------------------------------------------------------------------------
// BACKFILL — crea gli ASSIGNMENT mancanti per APPLICATION già APPROVED,
// approvate prima che sideEffect_ApplicationApproved_ creasse sempre un
// ASSIGNMENT (root cause saturazione bloccata a 0 per candidature vecchie).
// Azione admin 'event.backfillMissingAssignments'. Default dry-run: passa
// { dryRun: false } esplicitamente per scrivere davvero.
// ---------------------------------------------------------------------------

function handleEventBackfillMissingAssignments(payload, auth) {
  var dryRun = payload.dryRun !== false; // default true — serve dryRun:false esplicito per scrivere

  var all = getAllRows('Entities');
  var report = [];
  var touchedEvents = {};

  for (var i = 0; i < all.length; i++) {
    var app = all[i];
    if (app.type !== 'APPLICATION') continue;
    if (app.status !== ENTITY_STATUS.APPLICATION.APPROVED) continue;
    if (String(app.deleted).toLowerCase() === 'true') continue;
    if (auth.tenant_id && String(app.tenant_id) !== String(auth.tenant_id)) continue;

    var appData = parseJSON(app.data);
    var existing = findAssignmentByApplicationId_(app.entity_id, app.tenant_id);
    if (existing) continue; // già a posto, non è nel gap

    report.push({
      application_id:     app.entity_id,
      event_id:            appData.event_id || '',
      talent_profile_id:   appData.talent_profile_id || '',
      shift_id:            appData.shift_id || ''
    });

    if (!dryRun) {
      var assignment = createEntity('ASSIGNMENT', ENTITY_STATUS.ASSIGNMENT.CONFIRMED, {
        shift_id:           appData.shift_id || '',
        talent_profile_id:  appData.talent_profile_id,
        application_id:     app.entity_id,
        note_admin:         '',
        checkin:            {},
        checkout:           {},
        timesheet:          {},
        reminder_24h_sent:  false,
        reminder_2h_sent:   false
      }, app.tenant_id, auth.user_id);

      report[report.length - 1].assignment_id = assignment.entity_id;

      if (appData.shift_id) {
        checkShiftFullness_(appData.shift_id, app.tenant_id); // cascata anche a checkEventSaturation_
      } else if (appData.event_id) {
        touchedEvents[appData.event_id + '::' + app.tenant_id] = true;
      }
    }
  }

  if (!dryRun) {
    for (var key in touchedEvents) {
      var parts = key.split('::');
      checkEventSaturation_(parts[0], parts[1]);
    }
  }

  return successResponse({
    dry_run: dryRun,
    assignments_created: dryRun ? 0 : report.length,
    gaps_found: report.length,
    details: report
  });
}

// ---------------------------------------------------------------------------
// BACKFILL — assegna shift_id agli ASSIGNMENT che ne sono privi (candidature
// dirette a evento, mai passate da uno SHIFT). Risolve l'evento via
// application_id → APPLICATION.data.event_id, poi sceglie il primo SHIFT
// dell'evento con posti disponibili (fallback: il primo in assoluto).
// NOTA: APPLICATION/ASSIGNMENT non hanno un campo ruolo — non esiste dato
// su cui fare un vero match "tipo ruolo compatibile", quindi il criterio
// si riduce a disponibilità posti sul turno.
// Azione admin 'event.backfillAssignmentShiftIds'. Default dry-run: passa
// { dryRun: false } esplicitamente per scrivere davvero.
// ---------------------------------------------------------------------------

function handleEventBackfillAssignmentShiftIds(payload, auth) {
  var dryRun = payload.dryRun !== false; // default true — serve dryRun:false esplicito per scrivere

  var all = getAllRows('Entities');
  var report = [];
  var touchedEvents = {};

  var applicationsById = {};
  for (var i = 0; i < all.length; i++) {
    var p = all[i];
    if (p.type !== 'APPLICATION') continue;
    if (String(p.deleted).toLowerCase() === 'true') continue;
    applicationsById[p.entity_id] = p;
  }

  var shiftsByEvent = {};
  for (var j = 0; j < all.length; j++) {
    var s = all[j];
    if (s.type !== 'SHIFT') continue;
    if (String(s.deleted).toLowerCase() === 'true') continue;
    var sd = parseJSON(s.data);
    if (!sd.event_id) continue;
    var key = sd.event_id + '::' + s.tenant_id;
    if (!shiftsByEvent[key]) shiftsByEvent[key] = [];
    shiftsByEvent[key].push({ entity_id: s.entity_id, data: sd });
  }

  for (var k = 0; k < all.length; k++) {
    var a = all[k];
    if (a.type !== 'ASSIGNMENT') continue;
    if (String(a.deleted).toLowerCase() === 'true') continue;
    if (auth.tenant_id && String(a.tenant_id) !== String(auth.tenant_id)) continue;

    var ad = parseJSON(a.data);
    if (ad.shift_id) continue; // già valorizzato, non è nel gap

    var app = applicationsById[ad.application_id];
    if (!app) continue; // nessuna APPLICATION collegata, non risolvibile
    var appData = parseJSON(app.data);
    if (!appData.event_id) continue; // nessun event_id risolvibile

    var candidates = shiftsByEvent[appData.event_id + '::' + a.tenant_id] || [];
    if (candidates.length === 0) continue; // nessun turno per l'evento

    var chosen = null;
    for (var m = 0; m < candidates.length; m++) {
      var c = candidates[m];
      var postiDisp = Number(c.data.posti_disponibili) || 0;
      var postiConf = Number(c.data.posti_approvati != null ? c.data.posti_approvati : c.data.posti_confermati) || 0;
      if (postiConf < postiDisp) { chosen = c; break; }
    }
    if (!chosen) chosen = candidates[0];

    report.push({
      assignment_id:      a.entity_id,
      application_id:     ad.application_id,
      event_id:            appData.event_id,
      shift_id_assegnato:  chosen.entity_id
    });

    if (!dryRun) {
      updateEntityData(a.entity_id, { shift_id: chosen.entity_id }, a.tenant_id, 'system');
      logError_('WORKFLOWS', 'event.backfillAssignmentShiftIds',
        'backfill assignment_id=' + a.entity_id + ' | shift_id_assegnato=' + chosen.entity_id,
        '', 'system', a.tenant_id);
      touchedEvents[appData.event_id + '::' + a.tenant_id] = true;
    }
  }

  if (!dryRun) {
    for (var key2 in touchedEvents) {
      var parts = key2.split('::');
      checkEventSaturation_(parts[0], parts[1]);
    }
  }

  return successResponse({
    dry_run: dryRun,
    assignments_updated: dryRun ? 0 : report.length,
    gaps_found: report.length,
    details: report
  });
}

// ---------------------------------------------------------------------------
// AUDIT — incarichi già CONFIRMED prima del flusso contratto (SOLA LETTURA)
// Da lanciare a mano dall'editor GAS. Nessuna scrittura, nessuna mail: serve a sapere
// quanti ASSIGNMENT restano "grandfathered" (CONFIRMED senza contratto firmato).
// ---------------------------------------------------------------------------

function auditConfirmedAssignments() {
  var all = getAllRows('Entities');
  var byTenant = {};
  var signedApps = {};
  all.forEach(function(e) {
    if (e.type !== 'CONTRATTO' || e.status !== ENTITY_STATUS.CONTRATTO.SIGNED) return;
    if (String(e.deleted).toLowerCase() === 'true') return;
    signedApps[parseJSON(e.data).application_id] = true;
  });

  all.forEach(function(e) {
    if (e.type !== 'ASSIGNMENT') return;
    if (String(e.deleted).toLowerCase() === 'true') return;
    var t = byTenant[e.tenant_id] || (byTenant[e.tenant_id] = { confirmed: 0, confirmed_con_contratto_firmato: 0, awaiting_signature: 0, altri_attivi: 0 });
    if (e.status === ENTITY_STATUS.ASSIGNMENT.CONFIRMED) {
      t.confirmed++;
      if (signedApps[parseJSON(e.data).application_id]) t.confirmed_con_contratto_firmato++;
    } else if (e.status === ENTITY_STATUS.ASSIGNMENT.AWAITING_SIGNATURE) {
      t.awaiting_signature++;
    } else if (activeAssignmentStatuses_().indexOf(e.status) !== -1) {
      t.altri_attivi++;
    }
  });

  Logger.log('=== AUDIT ASSIGNMENT CONFIRMED (sola lettura) ===');
  Object.keys(byTenant).forEach(function(tenantId) {
    var t = byTenant[tenantId];
    Logger.log('tenant ' + tenantId + ' | CONFIRMED: ' + t.confirmed + ' (di cui con contratto firmato: ' + t.confirmed_con_contratto_firmato +
      ') | AWAITING_SIGNATURE: ' + t.awaiting_signature + ' | altri attivi (check-in..pagato): ' + t.altri_attivi);
  });
  Logger.log('I CONFIRMED esistenti NON vengono migrati: restano tali (grandfathering).');
  return byTenant;
}
