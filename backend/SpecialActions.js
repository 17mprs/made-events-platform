// === SPECIAL_ACTIONS.JS — MADE EVENT Platform v1.0 ===
// Azioni operative critiche con business logic specifica:
//   - application.submit  (RB-01, RB-03)
//   - assignment.checkin  (RB-04 + finestra temporale)
//   - assignment.checkout (calcolo timesheet automatico)

// ---------------------------------------------------------------------------
// APPLICATION.SUBMIT
// ---------------------------------------------------------------------------

/**
 * Un talent (USER) si candida a uno shift.
 * Regole (PRD RB-01, RB-03, BIZ_001/002/003, WF_003/004):
 *   - Shift deve essere OPEN
 *   - Talent deve avere TALENT_PROFILE in stato APPROVED o ACTIVE
 *   - Non deve esserci già una APPLICATION attiva (PENDING/APPROVED) per questo shift+talent
 */
function handleApplicationSubmit(payload, auth) {
  var valid = requireFields(payload, ['shift_id']);
  if (valid) return valid;

  // Recupera TALENT_PROFILE dell'utente corrente
  var profile = findTalentProfileByUserId_(auth.user_id, auth.tenant_id);
  if (!profile) {
    return errorResponse('BIZ_003', 'Nessun profilo talent trovato per il tuo account');
  }

  // Profilo deve essere APPROVED o ACTIVE (RB-03, BIZ_002)
  var approvedStatuses = [ENTITY_STATUS.TALENT_PROFILE.APPROVED, ENTITY_STATUS.TALENT_PROFILE.ACTIVE];
  if (approvedStatuses.indexOf(profile.status) === -1) {
    return errorResponse('BIZ_002', 'Il tuo profilo talent non è ancora approvato. Stato attuale: ' + profile.status);
  }

  // Recupera shift
  var shift = getEntityById(payload.shift_id, auth.tenant_id);
  if (!shift || shift.type !== 'SHIFT') {
    return errorResponse('SYS_002', 'Shift non trovato');
  }

  // Shift deve essere OPEN (WF_003)
  if (shift.status !== ENTITY_STATUS.SHIFT.OPEN) {
    if (shift.status === ENTITY_STATUS.SHIFT.FULL) {
      return errorResponse('WF_004', 'Lo shift è al completo');
    }
    return errorResponse('WF_003', 'Lo shift non è aperto alle candidature. Stato: ' + shift.status);
  }

  // Controlla candidatura duplicata (RB-01, BIZ_001)
  var existingApp = findActiveApplication_(payload.shift_id, profile.entity_id, auth.tenant_id);
  if (existingApp) {
    return errorResponse('BIZ_001', 'Hai già una candidatura attiva per questo shift', 'shift_id');
  }

  // Controlla overlap orario (PRD: warn in MVP, block in Fase 2)
  var overlapCheck = getConfig('tenant.overlap_check', auth.tenant_id);
  if (overlapCheck === 'block') {
    var overlapResult = checkTimeOverlap_(profile.entity_id, shift, auth.tenant_id);
    if (overlapResult) {
      return errorResponse('BIZ_004', 'Hai già un assignment confermato in un orario sovrapposto');
    }
  }

  // Crea APPLICATION(PENDING)
  var application = createEntity('APPLICATION', ENTITY_STATUS.APPLICATION.PENDING, {
    shift_id:                payload.shift_id,
    talent_profile_id:       profile.entity_id,
    messaggio:               payload.messaggio              || '',
    disponibilita_confermata: payload.disponibilita_confermata || false
  }, auth.tenant_id, auth.user_id);

  return successResponse({
    application_id: application.entity_id,
    status:         ENTITY_STATUS.APPLICATION.PENDING,
    shift_id:       payload.shift_id,
    message:        'Candidatura inviata. In attesa di approvazione.'
  });
}

// ---------------------------------------------------------------------------
// ASSIGNMENT.CHECKIN
// ---------------------------------------------------------------------------

/**
 * Il talent effettua il check-in per il proprio assignment.
 * Regole (PRD RB-04):
 *   - Assignment deve essere CONFIRMED
 *   - Finestra temporale: max 30 min prima dell'inizio shift
 *   - Idempotente se già CHECKED_IN (ritorna successo senza scrivere)
 */
function handleAssignmentCheckin(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var assignment = getEntityById(payload.entity_id, auth.tenant_id);
  if (!assignment || assignment.type !== 'ASSIGNMENT') {
    return errorResponse('SYS_002', 'Assignment non trovato');
  }

  // USER può fare checkin solo sul proprio assignment
  if (auth.role === ROLES.USER) {
    var profile = findTalentProfileByUserId_(auth.user_id, auth.tenant_id);
    if (!profile || assignment.data.talent_profile_id !== profile.entity_id) {
      return errorResponse('AUTH_005', 'Puoi fare check-in solo sul tuo assignment');
    }
  }

  // Idempotenza: già CHECKED_IN → risposta success, nessuna scrittura
  if (assignment.status === ENTITY_STATUS.ASSIGNMENT.CHECKED_IN) {
    return successResponse({
      assignment_id: assignment.entity_id,
      status:        ENTITY_STATUS.ASSIGNMENT.CHECKED_IN,
      checkin:       assignment.data.checkin,
      message:       'Check-in già effettuato'
    });
  }

  // Deve essere CONFIRMED (RB-04)
  if (assignment.status !== ENTITY_STATUS.ASSIGNMENT.CONFIRMED) {
    return errorResponse('WF_002',
      'Il check-in richiede stato CONFIRMED. Stato attuale: ' + assignment.status);
  }

  // Verifica finestra temporale (max 30 min prima dell'inizio shift)
  var shift = getEntityById(assignment.data.shift_id, auth.tenant_id);
  if (shift) {
    var windowCheck = checkCheckinWindow_(shift);
    if (!windowCheck.ok) {
      return errorResponse('WF_002', windowCheck.message);
    }
  }

  var now = new Date();
  var checkinData = {
    timestamp: now.toISOString(),
    lat:       payload.lat || null,
    lng:       payload.lng || null
  };

  // Aggiorna dati e transiziona stato
  updateEntityData(assignment.entity_id, { checkin: checkinData }, auth.tenant_id, auth.user_id);
  updateRow('Entities', assignment.entity_id, { status: ENTITY_STATUS.ASSIGNMENT.CHECKED_IN });

  // Log obbligatorio PRD
  logCheckin(assignment.entity_id, auth.user_id, auth.tenant_id, payload.lat, payload.lng);

  return successResponse({
    assignment_id: assignment.entity_id,
    status:        ENTITY_STATUS.ASSIGNMENT.CHECKED_IN,
    checkin:       checkinData,
    message:       'Check-in effettuato alle ' + now.toISOString()
  });
}

// ---------------------------------------------------------------------------
// ASSIGNMENT.CHECKOUT
// ---------------------------------------------------------------------------

/**
 * Il talent effettua il check-out e il sistema calcola il timesheet.
 * Regole (PRD RB-04):
 *   - Assignment deve essere CHECKED_IN
 *   - Side effect: calcola ore_lavorate e minuti_lavorati
 */
function handleAssignmentCheckout(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var assignment = getEntityById(payload.entity_id, auth.tenant_id);
  if (!assignment || assignment.type !== 'ASSIGNMENT') {
    return errorResponse('SYS_002', 'Assignment non trovato');
  }

  // USER può fare checkout solo sul proprio assignment
  if (auth.role === ROLES.USER) {
    var profile = findTalentProfileByUserId_(auth.user_id, auth.tenant_id);
    if (!profile || assignment.data.talent_profile_id !== profile.entity_id) {
      return errorResponse('AUTH_005', 'Puoi fare check-out solo sul tuo assignment');
    }
  }

  // Idempotenza: già CHECKED_OUT → risposta success
  if (assignment.status === ENTITY_STATUS.ASSIGNMENT.CHECKED_OUT) {
    return successResponse({
      assignment_id: assignment.entity_id,
      status:        ENTITY_STATUS.ASSIGNMENT.CHECKED_OUT,
      timesheet:     assignment.data.timesheet,
      message:       'Check-out già effettuato'
    });
  }

  // Check-out senza check-in: blocco hard (RB-04, WF_002)
  if (assignment.status === ENTITY_STATUS.ASSIGNMENT.CONFIRMED) {
    return errorResponse('WF_002', 'Impossibile fare check-out senza aver fatto check-in');
  }

  if (assignment.status !== ENTITY_STATUS.ASSIGNMENT.CHECKED_IN) {
    return errorResponse('WF_002',
      'Il check-out richiede stato CHECKED_IN. Stato attuale: ' + assignment.status);
  }

  // Calcola timesheet
  var now = new Date();
  var checkinTs = new Date(assignment.data.checkin.timestamp);
  var timesheet = calcTimesheet(checkinTs, now);

  var checkoutData = {
    timestamp: now.toISOString(),
    lat:       payload.lat || null,
    lng:       payload.lng || null
  };

  // Aggiorna dati poi transiziona
  updateEntityData(assignment.entity_id, {
    checkout:  checkoutData,
    timesheet: timesheet
  }, auth.tenant_id, auth.user_id);

  updateRow('Entities', assignment.entity_id, { status: ENTITY_STATUS.ASSIGNMENT.CHECKED_OUT });

  // Log obbligatorio PRD
  logCheckout(assignment.entity_id, auth.user_id, auth.tenant_id, timesheet);

  return successResponse({
    assignment_id: assignment.entity_id,
    status:        ENTITY_STATUS.ASSIGNMENT.CHECKED_OUT,
    checkout:      checkoutData,
    timesheet:     timesheet,
    message:       'Check-out effettuato. Ore lavorate: ' + timesheet.ore_lavorate + 'h ' + timesheet.minuti_lavorati + 'min'
  });
}

// ---------------------------------------------------------------------------
// HELPERS PRIVATI
// ---------------------------------------------------------------------------

/**
 * Cerca APPLICATION attiva (PENDING o APPROVED) per shift+talent.
 * Usata per prevenire candidature duplicate (RB-01, BIZ_001).
 */
function findActiveApplication_(shiftId, talentProfileId, tenantId) {
  var activeStatuses = [
    ENTITY_STATUS.APPLICATION.PENDING,
    ENTITY_STATUS.APPLICATION.APPROVED
  ];
  var all = getAllRows('Entities');
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.type !== 'APPLICATION') continue;
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

/**
 * Verifica finestra di check-in: max 30 min prima dell'inizio shift.
 * Ritorna { ok: true } o { ok: false, message }.
 */
function checkCheckinWindow_(shift) {
  var shiftData = shift.data;
  if (!shiftData.data || !shiftData.orario_inizio) {
    // Data/orario non configurati: check-in sempre permesso
    return { ok: true };
  }

  try {
    // Parse: "2025-06-15" + "09:00" → timestamp
    var shiftDateStr  = String(shiftData.data).split('T')[0]; // gestisce sia date ISO che YYYY-MM-DD
    var shiftTimeStr  = String(shiftData.orario_inizio);      // es. "09:00" o "09:00:00"
    var shiftStart    = new Date(shiftDateStr + 'T' + shiftTimeStr + ':00');

    if (isNaN(shiftStart.getTime())) return { ok: true }; // formato non parsabile: skip check

    var now              = Date.now();
    var shiftStartMs     = shiftStart.getTime();
    var thirtyMinMs      = 30 * 60 * 1000;

    if (now < shiftStartMs - thirtyMinMs) {
      var minutiMancanti = Math.round((shiftStartMs - now) / 60000);
      return {
        ok: false,
        message: 'Check-in disponibile 30 minuti prima dell\'inizio turno. Mancano ancora ' + minutiMancanti + ' minuti.'
      };
    }
  } catch (e) {
    // In caso di errore nel parsing, non blocchiamo il check-in
    return { ok: true };
  }

  return { ok: true };
}

/**
 * Verifica overlap orario tra uno shift e gli assignment confermati del talent.
 * Ritorna true se c'è overlap.
 */
function checkTimeOverlap_(talentProfileId, shift, tenantId) {
  var shiftData = shift.data;
  if (!shiftData.data || !shiftData.orario_inizio || !shiftData.orario_fine) return false;

  try {
    var dateStr = String(shiftData.data).split('T')[0];
    var newStart = new Date(dateStr + 'T' + shiftData.orario_inizio + ':00').getTime();
    var newEnd   = new Date(dateStr + 'T' + shiftData.orario_fine   + ':00').getTime();

    var activeStatuses = [
      ENTITY_STATUS.ASSIGNMENT.CONFIRMED,
      ENTITY_STATUS.ASSIGNMENT.CHECKED_IN
    ];

    var all = getAllRows('Entities');
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.type !== 'ASSIGNMENT') continue;
      if (String(e.tenant_id) !== String(tenantId)) continue;
      if (String(e.deleted).toLowerCase() === 'true') continue;
      if (activeStatuses.indexOf(e.status) === -1) continue;

      var d = parseJSON(e.data);
      if (String(d.talent_profile_id) !== String(talentProfileId)) continue;
      if (String(d.shift_id) === String(shift.entity_id)) continue; // stesso shift, skip

      // Recupera orari dell'assignment esistente
      var existingShift = getEntityById(d.shift_id, tenantId);
      if (!existingShift) continue;
      var es = existingShift.data;
      if (!es.data || !es.orario_inizio || !es.orario_fine) continue;

      var exDateStr = String(es.data).split('T')[0];
      if (exDateStr !== dateStr) continue; // giorni diversi, nessun overlap

      var exStart = new Date(exDateStr + 'T' + es.orario_inizio + ':00').getTime();
      var exEnd   = new Date(exDateStr + 'T' + es.orario_fine   + ':00').getTime();

      // Overlap: nuovo turno si sovrappone a quello esistente
      if (newStart < exEnd && newEnd > exStart) return true;
    }
  } catch (e) {
    return false; // in caso di errore, non blocca
  }

  return false;
}
