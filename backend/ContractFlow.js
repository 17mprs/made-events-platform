// === CONTRACT_FLOW.JS — MADE EVENT Platform ===
// Flusso contratto: invio → firma → conferma incarico.
//   contract.send         (ADMIN)  GENERATED → SENT
//   contract.get          (USER proprio | ADMIN)  PDF + metadati
//   contract.requestCode  (USER)   codice a 6 cifre via email (secondo fattore)
//   contract.accept       (USER)   SENT → SIGNED, ASSIGNMENT → CONFIRMED
//   contract.decline      (USER)   SENT → DECLINED, incarico annullato, candidatura ritirata
//   contract.void         (ADMIN)  GENERATED/SENT → VOID
// La generazione (GENERATED, VOID per rigenerazione) è in ContractManager.js; scadenze e
// reminder in Jobs.js (jobContractReminders). Nessuna azione è pubblica. Il PDF non viene
// mai condiviso su Drive: si legge solo da contract.get dopo il login.

// ---------------------------------------------------------------------------
// HELPER
// ---------------------------------------------------------------------------

/** SHA-256 in esadecimale di un array di byte (GAS restituisce byte con segno). */
function contractSha256Hex_(bytes) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return digest.map(function(b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function contractIsExpired_(d) {
  var t = d && d.expires_at ? new Date(d.expires_at).getTime() : 0;
  return !!t && !isNaN(t) && Date.now() > t;
}

/** Tutti i CONTRATTO di una candidatura, dal più recente (version desc). data già parsato. */
function listContractsByApplication_(applicationId, tenantId) {
  var all = getAllRows('Entities');
  var out = [];
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.type !== 'CONTRATTO') continue;
    if (tenantId && String(e.tenant_id) !== String(tenantId)) continue;
    if (String(e.deleted).toLowerCase() === 'true') continue;
    var d = parseJSON(e.data);
    if (String(d.application_id) !== String(applicationId)) continue;
    e.data = d;
    out.push(e);
  }
  out.sort(function(a, b) {
    var va = Number(a.data.version) || 0, vb = Number(b.data.version) || 0;
    if (va !== vb) return vb - va;
    return String(b.data.generato_il || '').localeCompare(String(a.data.generato_il || ''));
  });
  return out;
}

function withContractLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return errorResponse('SYS_001', 'Server occupato, riprova tra qualche secondo');
  }
  try {
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** Errore strutturato "dati mancanti" (stesso formato di contract.generate). */
function contractMissingError_(missing) {
  return { success: false, error: {
    code:    'CT_MISSING',
    message: 'Dati mancanti per il contratto: ' + missing.map(function(m) { return m.label; }).join(', '),
    missing: missing
  } };
}

/** Email del talent: account di login, altrimenti email di contatto del profilo. */
function talentContractEmail_(profileData) {
  var email = '';
  try {
    if (profileData && profileData.user_id) {
      var u = getRowById('Users', profileData.user_id);
      if (u && u.email) email = String(u.email);
    }
  } catch (e) {}
  return email || String((profileData && (profileData.email_contatto || profileData.email)) || '');
}

function contractAdminEmail_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || '';
}

function contractTalentName_(profileData) {
  return [(profileData && profileData.nome) || '', (profileData && profileData.cognome) || ''].join(' ').trim();
}

/** Metadati esposti al client: mai hash del codice, tentativi o user-agent. */
function contractMeta_(c) {
  var d = c.data || {};
  return {
    entity_id:      c.entity_id,
    application_id: d.application_id || '',
    event_id:       d.event_id || '',
    shift_id:       d.shift_id || '',
    stato:          c.status,
    version:        d.version || null,
    filename:       d.filename || '',
    sha256:         d.sha256 || '',
    generato_il:    d.generato_il || '',
    sent_at:        d.sent_at || '',
    expires_at:     d.expires_at || '',
    signed_at:      d.accepted_at || '',
    declined_at:    d.declined_at || '',
    scaduto:        c.status === ENTITY_STATUS.CONTRATTO.SENT && contractIsExpired_(d)
  };
}

/** Legge il PDF da Drive e verifica che coincida con l'impronta salvata alla generazione. */
function contractReadPdf_(c) {
  var d = c.data || {};
  if (!d.pdf_file_id) throw new Error('PDF non disponibile');
  var bytes = DriveApp.getFileById(d.pdf_file_id).getBlob().getBytes();
  if (d.sha256 && contractSha256Hex_(bytes) !== d.sha256) {
    throw new Error('Integrità del PDF non verificata (impronta diversa da quella salvata)');
  }
  return bytes;
}

function contractCodeHash_(contractId, code) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_256, 'ctcode:' + contractId + ':' + code, getTokenSecret_()));
}

function contractGenerateCode_() {
  var n = parseInt(Utilities.getUuid().replace(/-/g, '').substring(0, 8), 16) % 1000000;
  return ('000000' + n).slice(-6);
}

/**
 * Carica il contratto per un'azione USER: solo il proprio. Non trovato e "non tuo"
 * danno la stessa risposta (nessuna informazione sull'esistenza).
 * @returns {{error:object}|{contract:object, profile:object}}
 */
function contractLoadForUser_(contractId, auth, allowedStatuses) {
  var notFound = { error: errorResponse('SYS_002', 'Contratto non trovato') };
  var profile = findTalentProfileByUserId_(auth.user_id, auth.tenant_id);
  if (!profile) return notFound;
  var c = contractId ? getEntityById(contractId, auth.tenant_id) : null;
  if (!c || c.type !== 'CONTRATTO') return notFound;
  var d = c.data || {};
  if (String(d.talent_id) !== String(profile.entity_id)) return notFound;
  if (d.talent_user_id && String(d.talent_user_id) !== String(auth.user_id)) return notFound;
  if (allowedStatuses && allowedStatuses.indexOf(c.status) === -1) return notFound;
  return { contract: c, profile: profile };
}

/**
 * Libera il posto di una candidatura: APPROVED → PENDING (il side effect annulla
 * l'ASSIGNMENT e ricalcola la saturazione) e, con withdraw, PENDING → WITHDRAWN.
 * @returns {boolean} true se la candidatura era APPROVED ed è stata riportata a PENDING
 */
function contractReleaseSeat_(applicationId, auth, withdraw) {
  var app = getEntityById(applicationId, auth.tenant_id);
  if (!app || app.type !== 'APPLICATION') return false;
  var released = false;
  if (app.status === ENTITY_STATUS.APPLICATION.APPROVED) {
    var r = transitionEntityStatus('APPLICATION', app, ENTITY_STATUS.APPLICATION.PENDING, auth);
    released = !!(r && r.success);
  }
  if (withdraw && app.status === ENTITY_STATUS.APPLICATION.PENDING) {
    transitionEntityStatus('APPLICATION', app, ENTITY_STATUS.APPLICATION.WITHDRAWN, auth);
  }
  return released;
}

function contractMailContext_(c, tenantId) {
  return { entity_type: 'CONTRATTO', entity_id: c.entity_id, tenant_id: tenantId };
}

// ---------------------------------------------------------------------------
// contract.send (ADMIN)
// ---------------------------------------------------------------------------

function handleContractSend(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  return withContractLock_(function() {
    var c = getEntityById(payload.entity_id, auth.tenant_id);
    if (!c || c.type !== 'CONTRATTO') return errorResponse('SYS_002', 'Contratto non trovato');
    if (c.status !== ENTITY_STATUS.CONTRATTO.GENERATED) {
      return errorResponse('WF_002', 'Il contratto deve essere GENERATED per essere inviato. Stato attuale: ' + c.status);
    }
    var d = c.data || {};
    if (!d.sha256) {
      return errorResponse('CT_LEGACY', 'Contratto generato con una versione precedente del sistema: rigeneralo prima di inviarlo');
    }
    if (d.forzato === true) {
      return errorResponse('CT_FORCED', 'Il contratto è stato generato con campi vuoti: completa i dati e rigeneralo prima di inviarlo');
    }

    var ctx = loadContractContext_({ talent_profile_id: d.talent_id, event_id: d.event_id }, auth);
    if (ctx.error) return ctx.error;
    if (String(ctx.application.entity_id) !== String(d.application_id)) {
      return errorResponse('WF_002', 'La candidatura di questo contratto non è più quella approvata: rigenera il contratto');
    }

    var missing = collectMissing_(ctx.td, ctx.ed, ctx.shift.data || {});
    if (missing.length) return contractMissingError_(missing);

    var assignment = findAssignmentByApplicationId_(d.application_id, auth.tenant_id);
    if (!assignment) return errorResponse('WF_002', 'Nessun incarico attivo per questa candidatura');

    var to = talentContractEmail_(ctx.td);
    if (!to) return errorResponse('VAL_002', 'Il talent non ha un indirizzo email', 'email');

    var now = new Date();
    var expires = new Date(now.getTime() + CONTRACT_FLOW.EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Prima la mail: se non parte il contratto resta GENERATED e si può riprovare.
    var mailOk = sendContractToSignEmail(to, contractTalentName_(ctx.td), ctx.ed, ctx.shift.data, expires.toISOString(),
      contractMailContext_(c, auth.tenant_id));
    if (!mailOk) return errorResponse('SYS_001', "Invio dell'email al talent fallito: il contratto resta GENERATED, riprova");

    updateEntityData(c.entity_id, {
      destinatario:     to,
      sent_by:          auth.user_id,
      sent_at:          now.toISOString(),
      expires_at:       expires.toISOString(),
      reminder_sent_at: ''
    }, auth.tenant_id, auth.user_id);

    var r = transitionEntityStatus('CONTRATTO', c, ENTITY_STATUS.CONTRATTO.SENT, auth);
    if (!r.success) return r;
    return successResponse({ entity_id: c.entity_id, stato: ENTITY_STATUS.CONTRATTO.SENT, sent_at: now.toISOString(), expires_at: expires.toISOString() });
  });
}

// ---------------------------------------------------------------------------
// contract.get (USER proprio SENT/SIGNED | ADMIN qualsiasi)
// ---------------------------------------------------------------------------

function handleContractGet(payload, auth) {
  if (!payload.entity_id && !payload.application_id) {
    return errorResponse('VAL_001', 'Serve entity_id oppure application_id', 'entity_id');
  }
  var isAdmin = auth.role === ROLES.ADMIN || auth.role === ROLES.SUPER_ADMIN;
  var visibleToUser = [ENTITY_STATUS.CONTRATTO.SENT, ENTITY_STATUS.CONTRATTO.SIGNED];

  var c = null;
  if (isAdmin) {
    if (payload.entity_id) {
      c = getEntityById(payload.entity_id, auth.tenant_id);
      if (c && c.type !== 'CONTRATTO') c = null;
    } else {
      c = listContractsByApplication_(payload.application_id, auth.tenant_id)[0] || null;
    }
    if (!c) return errorResponse('SYS_002', 'Contratto non trovato');
  } else {
    var contractId = payload.entity_id;
    if (!contractId) {
      var mine = listContractsByApplication_(payload.application_id, auth.tenant_id).filter(function(x) {
        return visibleToUser.indexOf(x.status) !== -1;
      });
      contractId = mine[0] ? mine[0].entity_id : '';
    }
    var loaded = contractLoadForUser_(contractId, auth, visibleToUser);
    if (loaded.error) return loaded.error;
    c = loaded.contract;
    if (c.status === ENTITY_STATUS.CONTRATTO.SENT && contractIsExpired_(c.data)) {
      return errorResponse('CT_EXPIRED', 'Il contratto è scaduto: contatta il team');
    }
  }

  var out = { contract: contractMeta_(c) };
  if (payload.meta_only !== true) {
    try {
      out.pdf_base64 = Utilities.base64Encode(contractReadPdf_(c));
    } catch (e) {
      logError_({ severity: 'ERROR', module: 'CONTRACT_FLOW', action: 'contract.get', entity_type: 'CONTRATTO', entity_id: c.entity_id,
        actor: auth.user_id, tenant_id: auth.tenant_id, message: e.message, stack: e.stack || '' });
      return errorResponse('SYS_001', 'Contratto non leggibile: ' + e.message);
    }
  }
  return successResponse(out);
}

// ---------------------------------------------------------------------------
// contract.requestCode (USER)
// ---------------------------------------------------------------------------

function handleContractRequestCode(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var loaded = contractLoadForUser_(payload.entity_id, auth, [ENTITY_STATUS.CONTRATTO.SENT]);
  if (loaded.error) return loaded.error;

  return withContractLock_(function() {
    var c = getEntityById(payload.entity_id, auth.tenant_id);
    if (!c || c.status !== ENTITY_STATUS.CONTRATTO.SENT) return errorResponse('WF_002', 'Il contratto non è in attesa di firma');
    var d = c.data || {};
    if (contractIsExpired_(d)) return errorResponse('CT_EXPIRED', 'Il contratto è scaduto: contatta il team');

    var requests = Number(d.code_requests) || 0;
    if (requests >= CONTRACT_FLOW.CODE_MAX_REQUESTS) {
      return errorResponse('CT_CODE_LIMIT', 'Troppe richieste di codice per questo contratto: contatta il team');
    }
    var last = d.code_requested_at ? new Date(d.code_requested_at).getTime() : 0;
    if (last && !isNaN(last) && (Date.now() - last) < CONTRACT_FLOW.CODE_RESEND_COOLDOWN_MS) {
      return errorResponse('CT_CODE_WAIT', 'Attendi un minuto prima di richiedere un nuovo codice');
    }

    var code = contractGenerateCode_();
    var to = auth.email || talentContractEmail_(loaded.profile.data);
    var mailOk = sendContractCodeEmail(to, loaded.profile.data.nome || '', code, contractMailContext_(c, auth.tenant_id));
    if (!mailOk) return errorResponse('SYS_001', 'Invio del codice fallito: riprova tra poco');

    updateEntityData(c.entity_id, {
      code_hash:         contractCodeHash_(c.entity_id, code),   // solo l'hash: il codice non è salvato
      code_expires_at:   new Date(Date.now() + CONTRACT_FLOW.CODE_TTL_MS).toISOString(),
      code_attempts:     0,
      code_requested_at: new Date().toISOString(),
      code_requests:     requests + 1
    }, auth.tenant_id, auth.user_id);

    logActivity({ level: 'INFO', module: 'CONTRACT_FLOW', action: 'contract.requestCode', entity_type: 'CONTRATTO', entity_id: c.entity_id,
      user_id: auth.user_id, tenant_id: auth.tenant_id, note: 'richiesta ' + (requests + 1) + '/' + CONTRACT_FLOW.CODE_MAX_REQUESTS });
    return successResponse({ sent: true, expires_in_seconds: Math.round(CONTRACT_FLOW.CODE_TTL_MS / 1000) });
  });
}

// ---------------------------------------------------------------------------
// contract.accept (USER)
// ---------------------------------------------------------------------------

function handleContractAccept(payload, auth) {
  var valid = requireFields(payload, ['entity_id', 'codice']);
  if (valid) return valid;
  if (payload.accetta_contratto !== true) {
    return errorResponse('VAL_002', 'Devi accettare il contratto', 'accetta_contratto');
  }
  if (payload.accetta_clausole_specifiche !== true) {
    return errorResponse('VAL_002', 'Devi accettare le clausole specifiche', 'accetta_clausole_specifiche');
  }
  var codice = String(payload.codice).trim();
  if (!/^\d{6}$/.test(codice)) return errorResponse('VAL_002', 'Il codice è di 6 cifre', 'codice');
  var userAgent = String(payload.user_agent == null ? '' : payload.user_agent).trim().substring(0, CONTRACT_FLOW.USER_AGENT_MAX_LEN);

  var loaded = contractLoadForUser_(payload.entity_id, auth, [ENTITY_STATUS.CONTRATTO.SENT, ENTITY_STATUS.CONTRATTO.SIGNED]);
  if (loaded.error) return loaded.error;

  var notify = null;
  var res = withContractLock_(function() {
    var c = getEntityById(payload.entity_id, auth.tenant_id);
    if (!c) return errorResponse('SYS_002', 'Contratto non trovato');
    if (c.status === ENTITY_STATUS.CONTRATTO.SIGNED) {
      return successResponse({ already_signed: true, contract: contractMeta_(c) });   // doppio clic: idempotente
    }
    if (c.status !== ENTITY_STATUS.CONTRATTO.SENT) return errorResponse('WF_002', 'Il contratto non è in attesa di firma. Stato attuale: ' + c.status);
    var d = c.data || {};
    if (contractIsExpired_(d)) return errorResponse('CT_EXPIRED', 'Il contratto è scaduto: contatta il team');

    // --- codice di firma
    var codeExpires = d.code_expires_at ? new Date(d.code_expires_at).getTime() : 0;
    if (!d.code_hash || !codeExpires) return errorResponse('CT_CODE_REQUIRED', 'Richiedi prima il codice di firma', 'codice');
    if (Date.now() > codeExpires) {
      updateEntityData(c.entity_id, { code_hash: '', code_expires_at: '' }, auth.tenant_id, auth.user_id);
      return errorResponse('CT_CODE_EXPIRED', 'Codice scaduto: richiedine uno nuovo', 'codice');
    }
    var attempts = (Number(d.code_attempts) || 0) + 1;
    if (attempts > CONTRACT_FLOW.CODE_MAX_ATTEMPTS) {
      updateEntityData(c.entity_id, { code_hash: '', code_expires_at: '' }, auth.tenant_id, auth.user_id);
      return errorResponse('CT_CODE_LOCKED', 'Tentativi esauriti: richiedi un nuovo codice', 'codice');
    }
    if (contractCodeHash_(c.entity_id, codice) !== d.code_hash) {
      var upd = { code_attempts: attempts };
      var exhausted = attempts >= CONTRACT_FLOW.CODE_MAX_ATTEMPTS;
      if (exhausted) { upd.code_hash = ''; upd.code_expires_at = ''; }
      updateEntityData(c.entity_id, upd, auth.tenant_id, auth.user_id);
      return errorResponse('CT_CODE_INVALID', exhausted
        ? 'Codice errato: tentativi esauriti, richiedine uno nuovo'
        : 'Codice errato (' + (CONTRACT_FLOW.CODE_MAX_ATTEMPTS - attempts) + ' tentativi rimasti)', 'codice');
    }

    // --- il PDF accettato è quello generato: impronta ricalcolata dal file
    var acceptedHash;
    try {
      acceptedHash = contractSha256Hex_(contractReadPdf_(c));
    } catch (e) {
      logError_({ severity: 'ERROR', module: 'CONTRACT_FLOW', action: 'contract.accept', entity_type: 'CONTRATTO', entity_id: c.entity_id,
        actor: auth.user_id, tenant_id: auth.tenant_id, message: e.message, stack: e.stack || '' });
      return errorResponse('CT_INTEGRITY', 'Contratto non verificabile: contatta il team');
    }
    if (d.sha256 && acceptedHash !== d.sha256) return errorResponse('CT_INTEGRITY', 'Contratto non verificabile: contatta il team');

    var assignment = findAssignmentByApplicationId_(d.application_id, auth.tenant_id);
    if (!assignment) return errorResponse('WF_002', 'Incarico non più attivo: contatta il team');

    var now = new Date().toISOString();
    updateEntityData(c.entity_id, {
      accepted_at:              now,
      accepted_sha256:          acceptedHash,
      accepted_by:              auth.user_id,
      accepted_user_agent:      userAgent,
      accepted_user_agent_nota: 'dichiarato dal client, non verificato',
      code_hash: '', code_expires_at: '', code_attempts: 0
    }, auth.tenant_id, auth.user_id);

    var r = transitionEntityStatus('CONTRATTO', c, ENTITY_STATUS.CONTRATTO.SIGNED, auth);
    if (!r.success) return r;

    // Incarico confermato (gli incarichi già CONFIRMED, anteriori al flusso, restano tali)
    if (assignment.status === ENTITY_STATUS.ASSIGNMENT.AWAITING_SIGNATURE) {
      var r2 = transitionEntityStatus('ASSIGNMENT', assignment, ENTITY_STATUS.ASSIGNMENT.CONFIRMED, auth);
      if (r2.success) {
        if (assignment.data.shift_id) checkShiftFullness_(assignment.data.shift_id, auth.tenant_id);
        else if (d.event_id) checkEventSaturation_(d.event_id, auth.tenant_id);
      } else {
        // Il contratto è firmato (fonte di verità): la riconciliazione del job riallinea l'incarico.
        logError_({ severity: 'ERROR', module: 'CONTRACT_FLOW', action: 'contract.accept.assignment', entity_type: 'ASSIGNMENT',
          entity_id: assignment.entity_id, actor: auth.user_id, tenant_id: auth.tenant_id,
          message: 'Contratto firmato ma conferma incarico fallita: ' + (r2.error && r2.error.message) });
      }
    }

    logActivity({ level: 'INFO', module: 'CONTRACT_FLOW', action: 'contract.accept', entity_type: 'CONTRATTO', entity_id: c.entity_id,
      user_id: auth.user_id, tenant_id: auth.tenant_id, note: 'versione=' + (d.version || '') });

    notify = { c: c, d: d, hash: acceptedHash };
    return successResponse({ contract: contractMeta_(getEntityById(c.entity_id, auth.tenant_id)), assignment_confirmed: true });
  });

  // Mail fuori dal lock
  if (res.success && notify) {
    try {
      var event = getEntityById(notify.d.event_id, auth.tenant_id);
      var shift = getEntityById(notify.d.shift_id, auth.tenant_id);
      var td = loaded.profile.data;
      var ctxMail = contractMailContext_(notify.c, auth.tenant_id);
      var to = talentContractEmail_(td);
      if (to) sendContractSignedEmail(to, td.nome || '', event ? event.data : {}, shift ? shift.data : {}, ctxMail);
      var admin = contractAdminEmail_();
      if (admin) sendAdminContractSignedEmail(admin, td.nome || '', td.cognome || '', event ? event.data : {}, shift ? shift.data : {},
        notify.d.version, notify.hash.substring(0, 16), ctxMail);
    } catch (mailErr) {
      logError_({ severity: 'ERROR', module: 'CONTRACT_FLOW', action: 'contract.accept.mail', entity_type: 'CONTRATTO', entity_id: payload.entity_id,
        actor: auth.user_id, tenant_id: auth.tenant_id, message: 'Mail conferma firma: ' + mailErr.message, stack: mailErr.stack });
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// contract.decline (USER)
// ---------------------------------------------------------------------------

function handleContractDecline(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;
  var motivo = String(payload.motivo == null ? '' : payload.motivo).trim();
  if (motivo.length > CONTRACT_FLOW.REASON_MAX_LEN) {
    return errorResponse('VAL_002', 'Motivo troppo lungo (max ' + CONTRACT_FLOW.REASON_MAX_LEN + ' caratteri)', 'motivo');
  }

  var loaded = contractLoadForUser_(payload.entity_id, auth, [ENTITY_STATUS.CONTRATTO.SENT]);
  if (loaded.error) return loaded.error;

  var info = null;
  var res = withContractLock_(function() {
    var c = getEntityById(payload.entity_id, auth.tenant_id);
    if (!c || c.status !== ENTITY_STATUS.CONTRATTO.SENT) return errorResponse('WF_002', 'Il contratto non è in attesa di firma');
    var d = c.data || {};

    updateEntityData(c.entity_id, { declined_at: new Date().toISOString(), declined_by: auth.user_id, decline_reason: motivo },
      auth.tenant_id, auth.user_id);
    var r = transitionEntityStatus('CONTRATTO', c, ENTITY_STATUS.CONTRATTO.DECLINED, auth);
    if (!r.success) return r;

    // Rifiuto esplicito: l'incarico viene annullato anche se era già CONFIRMED (flusso anteriore), candidatura ritirata.
    contractReleaseSeat_(d.application_id, auth, true);

    logActivity({ level: 'INFO', module: 'CONTRACT_FLOW', action: 'contract.decline', entity_type: 'CONTRATTO', entity_id: c.entity_id,
      user_id: auth.user_id, tenant_id: auth.tenant_id, note: 'versione=' + (d.version || '') });
    info = { c: c, d: d };
    return successResponse({ entity_id: c.entity_id, stato: ENTITY_STATUS.CONTRATTO.DECLINED });
  });

  if (res.success && info) {
    try {
      var admin = contractAdminEmail_();
      if (admin) {
        var event = getEntityById(info.d.event_id, auth.tenant_id);
        var td = loaded.profile.data;
        sendAdminContractDeclinedEmail(admin, td.nome || '', td.cognome || '', event ? event.data : {}, motivo, contractMailContext_(info.c, auth.tenant_id));
      }
    } catch (mailErr) {
      logError_({ severity: 'ERROR', module: 'CONTRACT_FLOW', action: 'contract.decline.mail', entity_type: 'CONTRATTO', entity_id: payload.entity_id,
        actor: auth.user_id, tenant_id: auth.tenant_id, message: 'Mail rifiuto contratto: ' + mailErr.message, stack: mailErr.stack });
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// contract.void (ADMIN)
// ---------------------------------------------------------------------------

function handleContractVoid(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;
  var motivo = String(payload.motivo == null ? '' : payload.motivo).trim();
  if (motivo.length > CONTRACT_FLOW.REASON_MAX_LEN) {
    return errorResponse('VAL_002', 'Motivo troppo lungo (max ' + CONTRACT_FLOW.REASON_MAX_LEN + ' caratteri)', 'motivo');
  }

  return withContractLock_(function() {
    var c = getEntityById(payload.entity_id, auth.tenant_id);
    if (!c || c.type !== 'CONTRATTO') return errorResponse('SYS_002', 'Contratto non trovato');
    if (c.status !== ENTITY_STATUS.CONTRATTO.GENERATED && c.status !== ENTITY_STATUS.CONTRATTO.SENT) {
      return errorResponse('WF_002', 'Si possono annullare solo contratti GENERATED o SENT. Stato attuale: ' + c.status);
    }
    var d = c.data || {};
    var assignment = d.application_id ? findAssignmentByApplicationId_(d.application_id, auth.tenant_id) : null;

    updateEntityData(c.entity_id, { voided_at: new Date().toISOString(), voided_by: auth.user_id, void_reason: motivo || 'annullato dall\'admin' },
      auth.tenant_id, auth.user_id);
    var r = transitionEntityStatus('CONTRATTO', c, ENTITY_STATUS.CONTRATTO.VOID, auth);
    if (!r.success) return r;

    // Libera il posto solo se l'incarico era in attesa di firma (gli incarichi già confermati restano).
    var released = false;
    if (assignment && assignment.status === ENTITY_STATUS.ASSIGNMENT.AWAITING_SIGNATURE) {
      released = contractReleaseSeat_(d.application_id, auth, false);
    }
    return successResponse({ entity_id: c.entity_id, stato: ENTITY_STATUS.CONTRATTO.VOID, posto_liberato: released });
  });
}

// ---------------------------------------------------------------------------
// SCADENZA (usata da Jobs.js: jobContractReminders)
// ---------------------------------------------------------------------------

/**
 * SENT oltre expires_at → EXPIRED. Se l'incarico era in attesa di firma: annullato e
 * candidatura → PENDING (posto liberato). Gli incarichi già CONFIRMED non si toccano.
 * @returns {{talent:string, evento:string, to:string, eventData:object}|null}
 */
function contractExpireOne_(c, authSystem) {
  var d = c.data || {};
  var assignment = d.application_id ? findAssignmentByApplicationId_(d.application_id, authSystem.tenant_id) : null;

  updateEntityData(c.entity_id, { expired_at: new Date().toISOString() }, authSystem.tenant_id, 'system');
  var r = transitionEntityStatus('CONTRATTO', c, ENTITY_STATUS.CONTRATTO.EXPIRED, authSystem);
  if (!r.success) return null;

  if (assignment && assignment.status === ENTITY_STATUS.ASSIGNMENT.AWAITING_SIGNATURE) {
    contractReleaseSeat_(d.application_id, authSystem, false);
  }

  var profile = d.talent_id ? getEntityById(d.talent_id, authSystem.tenant_id) : null;
  var event = d.event_id ? getEntityById(d.event_id, authSystem.tenant_id) : null;
  var td = profile ? profile.data : {};
  return {
    talent:    contractTalentName_(td),
    evento:    event ? (event.data.titolo || '') : '',
    to:        talentContractEmail_(td),
    nome:      td.nome || '',
    eventData: event ? event.data : {}
  };
}
