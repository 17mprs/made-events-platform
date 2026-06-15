// === REGISTRATION_FLOW.JS — MADE EVENT Platform v1.1 ===
// Onboarding talent step-by-step: Step 1 (dati base), Step 2 (profilazione 8 sezioni),
// Step 3 (finalizzazione: Drive folder + scoring + stato COMPLETED_PENDING_APPROVAL).
//
// Step 1/2/3 e uploadRegistrationDoc sono PUBLIC (no token).
// Identità verificata tramite lead_id + email (Step 2/3) o lead_token (getLead/upload).

// ---------------------------------------------------------------------------
// STEP 1 — Dati base + GDPR
// ---------------------------------------------------------------------------

function handleRegisterStep1(payload) {
  var valid = requireFields(payload, ['nome', 'cognome', 'email', 'telefono', 'gdpr_consent']);
  if (valid) return valid;

  if (!isValidEmail(payload.email)) {
    return errorResponse('VAL_002', 'Formato email non valido', 'email');
  }
  if (!payload.gdpr_consent) {
    return errorResponse('VAL_001', 'Il consenso GDPR è obbligatorio', 'gdpr_consent');
  }

  var emailLower = payload.email.toLowerCase().trim();

  var existing = findLeadByEmail_(emailLower);
  if (existing && existing.status !== ENTITY_STATUS.LEAD_TALENT.REJECTED) {
    return successResponse({
      lead_id:        existing.entity_id,
      step_completed: parseInt(existing.data.step_completed) || 1,
      message:        'Registrazione già avviata. Continua con il passo successivo.'
    });
  }

  var users = getAllRows('Users');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === emailLower) {
      return errorResponse('VAL_004', 'Email già registrata nel sistema');
    }
  }

  var tenantId = getDefaultTenantId_();
  if (!tenantId) return errorResponse('SYS_001', 'Configurazione sistema non completata.');

  var now = new Date();
  var leadToken = Utilities.getUuid();

  var entity = createEntity('LEAD_TALENT', ENTITY_STATUS.LEAD_TALENT.PARTIAL, {
    nome:              payload.nome.trim(),
    cognome:           payload.cognome.trim(),
    email:             emailLower,
    telefono:          payload.telefono.trim(),
    citta:             payload.citta || '',
    step_completed:    1,
    sezione_completata: 0,
    lead_token:        leadToken,
    gdpr_consent:      true,
    gdpr_timestamp:    now.toISOString(),
    stato_profilo:     'da_compilare',
    score:             0,
    ranking:           'D',
    registration_started_at: now.toISOString(),
    registration_completed_at: ''
  }, tenantId, null);

  try {
    var frontendUrl = getFrontendUrl();
    var completionUrl = frontendUrl + '/registrazione/completa?token=' + leadToken;
    sendOnboardingStep1Email(emailLower, payload.nome.trim(), completionUrl);
  } catch (emailErr) {
    Logger.log('[REGISTRATION] Email onboarding non inviata: ' + emailErr.message);
  }

  return successResponse({
    lead_id:        entity.entity_id,
    lead_token:     leadToken,
    step_completed: 1,
    message:        'Step 1 completato. Ti abbiamo inviato un\'email per completare la registrazione.'
  });
}

// ---------------------------------------------------------------------------
// STEP 2 — Salvataggio progressivo delle sezioni 1-7
// Chiamato dopo ogni sezione "Salva e continua". Idempotente.
// ---------------------------------------------------------------------------

function handleRegisterStep2(payload) {
  var valid = requireFields(payload, ['lead_id', 'email']);
  if (valid) return valid;

  var lead = verifyLead_(payload.lead_id, payload.email);
  if (!lead.ok) return lead.error;
  var entity = lead.entity;

  if (entity.status === ENTITY_STATUS.LEAD_TALENT.APPROVED) {
    return errorResponse('WF_001', 'Questo profilo è già stato approvato');
  }

  var now = new Date().toISOString();
  var sezione = parseInt(payload.sezione_completata) || parseInt(entity.data.sezione_completata) || 0;

  // Merge di tutti i campi accettati dalle sezioni 1-7
  var updates = {
    sezione_completata: sezione,
    ultimo_accesso:     now,
    // Sezione 1 — Dati Personali
    genere:             payload.genere             || entity.data.genere             || '',
    nascita_nazione:    payload.nascita_nazione    || entity.data.nascita_nazione    || 'Italia',
    nascita_regione:    payload.nascita_regione    || entity.data.nascita_regione    || '',
    nascita_provincia:  payload.nascita_provincia  || entity.data.nascita_provincia  || '',
    nascita_citta:      payload.nascita_citta      || entity.data.nascita_citta      || '',
    nascita_paese:      payload.nascita_paese      || entity.data.nascita_paese      || '',
    residenza_nazione:  payload.residenza_nazione  || entity.data.residenza_nazione  || 'Italia',
    residenza_regione:  payload.residenza_regione  || entity.data.residenza_regione  || '',
    residenza_provincia:payload.residenza_provincia|| entity.data.residenza_provincia|| '',
    residenza_citta:    payload.residenza_citta    || entity.data.residenza_citta    || '',
    residenza_paese:    payload.residenza_paese    || entity.data.residenza_paese    || '',
    domicilio_coincide: payload.domicilio_coincide !== undefined ? payload.domicilio_coincide : (entity.data.domicilio_coincide || false),
    domicilio_provincia:payload.domicilio_provincia|| entity.data.domicilio_provincia|| '',
    instagram:          payload.instagram          || entity.data.instagram          || '',
    facebook:           payload.facebook           || entity.data.facebook           || '',
    // Sezione 2 — Profilo Fisico
    altezza:            payload.altezza            || entity.data.altezza            || '',
    taglia_tshirt:      payload.taglia_tshirt      || entity.data.taglia_tshirt      || '',
    taglia_pantalone:   payload.taglia_pantalone   || entity.data.taglia_pantalone   || '',
    taglia_gonna:       payload.taglia_gonna       || entity.data.taglia_gonna       || '',
    numero_scarpe:      payload.numero_scarpe      || entity.data.numero_scarpe      || '',
    piercing_visibili:  payload.piercing_visibili  || entity.data.piercing_visibili  || '',
    tatuaggi_visibili:  payload.tatuaggi_visibili  || entity.data.tatuaggi_visibili  || '',
    tatuaggi_dove:      payload.tatuaggi_dove      || entity.data.tatuaggi_dove      || '',
    // Sezione 3 — Disponibilità Logistica
    patente_tipologie:  payload.patente_tipologie  || entity.data.patente_tipologie  || [],
    automunita:         payload.automunita         || entity.data.automunita         || '',
    province_lavoro:    payload.province_lavoro    || entity.data.province_lavoro    || [],
    disponibilita_trasferte: payload.disponibilita_trasferte || entity.data.disponibilita_trasferte || '',
    disponibilita_weekend:   payload.disponibilita_weekend   || entity.data.disponibilita_weekend   || '',
    disponibilita_serali:    payload.disponibilita_serali    || entity.data.disponibilita_serali    || '',
    // Sezione 4 — Lingue
    lingua_inglese:      payload.lingua_inglese      || entity.data.lingua_inglese      || '',
    inglese_certificato: payload.inglese_certificato !== undefined ? !!payload.inglese_certificato : (entity.data.inglese_certificato || false),
    lingua_francese:     payload.lingua_francese     || entity.data.lingua_francese     || '',
    lingua_spagnolo:     payload.lingua_spagnolo     || entity.data.lingua_spagnolo     || '',
    lingua_tedesco:      payload.lingua_tedesco      || entity.data.lingua_tedesco      || '',
    altre_lingue:        payload.altre_lingue        || entity.data.altre_lingue        || [],
    // Sezione 5 — Profilo Professionale
    titolo_studio:      payload.titolo_studio      || entity.data.titolo_studio      || '',
    titolo_studio_indirizzo: payload.titolo_studio_indirizzo || entity.data.titolo_studio_indirizzo || '',
    professione_attuale:     payload.professione_attuale     || entity.data.professione_attuale     || [],
    tipologie_esperienza:    payload.tipologie_esperienza    || entity.data.tipologie_esperienza    || [],
    anni_esperienza_settore: payload.anni_esperienza_settore || entity.data.anni_esperienza_settore || '',
    // Sezione 6 — Dotazione
    dotazione_personale:     payload.dotazione_personale     || entity.data.dotazione_personale     || [],
    // Sezione 7 — Dati Fiscali
    codice_fiscale:     payload.codice_fiscale     || entity.data.codice_fiscale     || '',
    partita_iva:        payload.partita_iva        || entity.data.partita_iva        || '',
    iban:               payload.iban               || entity.data.iban               || '',
    disponibile_chiamata: payload.disponibile_chiamata || entity.data.disponibile_chiamata || '',
    disponibile_ritenuta: payload.disponibile_ritenuta || entity.data.disponibile_ritenuta || '',
  };

  // Mantieni le URL dei documenti già caricati (non sovrascrivere con stringa vuota)
  var docFields = ['doc_identita_url','doc_cf_url','foto_busto_url','foto_intera_url','foto_extra_url','cv_url','attestato_haccp_url','attestato_sicurezza_url'];
  docFields.forEach(function(f) {
    updates[f] = payload[f] || entity.data[f] || '';
  });

  updateEntityData(entity.entity_id, updates, entity.tenant_id, null);

  return successResponse({
    lead_id:            entity.entity_id,
    sezione_completata: sezione,
    message:            'Sezione ' + sezione + ' salvata.'
  });
}

// ---------------------------------------------------------------------------
// UPLOAD DOCUMENTO DURANTE REGISTRAZIONE (endpoint PUBLIC)
// Accetta file base64, crea cartella temp, salva file, aggiorna lead data.
// ---------------------------------------------------------------------------

function handleUploadRegistrationDoc(payload) {
  var valid = requireFields(payload, ['lead_id', 'email', 'tipo_doc', 'file_base64', 'filename', 'mime_type']);
  if (valid) return valid;

  var lead = verifyLead_(payload.lead_id, payload.email);
  if (!lead.ok) return lead.error;
  var entity = lead.entity;

  if (entity.status === ENTITY_STATUS.LEAD_TALENT.APPROVED) {
    return errorResponse('WF_001', 'Profilo già approvato');
  }

  var TIPI_AMMESSI = ['doc_identita','doc_cf','foto_busto','foto_intera','foto_extra','cv','attestato_haccp','attestato_sicurezza'];
  if (TIPI_AMMESSI.indexOf(payload.tipo_doc) === -1) {
    return errorResponse('VAL_002', 'tipo_doc non riconosciuto: ' + payload.tipo_doc);
  }

  // Validazione dimensione (max 10MB)
  var maxBytes = (payload.tipo_doc === 'cv' || payload.tipo_doc.indexOf('attestato') !== -1) ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  var decoded;
  try {
    decoded = Utilities.base64Decode(payload.file_base64);
  } catch (decErr) {
    return errorResponse('VAL_002', 'File base64 non valido: ' + decErr.message);
  }
  if (decoded.length > maxBytes) {
    return errorResponse('VAL_002', 'File troppo grande (max ' + (maxBytes / 1024 / 1024) + 'MB)');
  }

  try {
    var root = getRootFolder_();
    // Usa il tenant dell'entità lead
    var tenantFolder = getOrCreateSubFolder_(root, entity.tenant_id);
    var regFolder    = getOrCreateSubFolder_(tenantFolder, 'registrazioni');
    var leadFolder   = getOrCreateSubFolder_(regFolder, entity.entity_id);
    var tipoFolder   = getOrCreateSubFolder_(leadFolder, payload.tipo_doc);

    var ext      = getFileExtension_(payload.filename);
    var safeName = payload.tipo_doc + '_' + entity.entity_id.substring(0, 8) + '_' + Date.now() + (ext ? '.' + ext : '');
    var blob     = Utilities.newBlob(decoded, payload.mime_type, safeName);
    var file     = tipoFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId  = file.getId();
    var fileUrl = 'https://drive.google.com/file/d/' + fileId + '/view';

    // Aggiorna URL nel lead data
    var urlField = payload.tipo_doc + '_url';
    var update   = {};
    update[urlField] = fileUrl;
    update['ultimo_accesso'] = new Date().toISOString();
    updateEntityData(entity.entity_id, update, entity.tenant_id, null);

    return successResponse({ url: fileUrl, tipo_doc: payload.tipo_doc, file_id: fileId });

  } catch (e) {
    logError_('REGISTRATION_FLOW', 'talent.uploadRegistrationDoc', e.message, e.stack || '', null, entity.tenant_id);
    return errorResponse('SYS_001', 'Errore durante l\'upload: ' + e.message);
  }
}

// ---------------------------------------------------------------------------
// STEP 3 — Finalizzazione: validazione, scoring, Drive folder, email, stato
// ---------------------------------------------------------------------------

function handleRegisterStep3(payload) {
  var valid = requireFields(payload, ['lead_id', 'email']);
  if (valid) return valid;

  var lead = verifyLead_(payload.lead_id, payload.email);
  if (!lead.ok) return lead.error;
  var entity = lead.entity;

  if (entity.status === ENTITY_STATUS.LEAD_TALENT.APPROVED) {
    return errorResponse('WF_001', 'Questo profilo è già stato approvato');
  }
  if (entity.status === ENTITY_STATUS.LEAD_TALENT.COMPLETED_PENDING_APPROVAL) {
    return errorResponse('WF_001', 'Questo profilo è già stato inviato ed è in attesa di approvazione');
  }

  // Merge dei dati finali (sezione 8: URL documenti)
  var current = entity.data;
  var docFields = ['doc_identita_url','doc_cf_url','foto_busto_url','foto_intera_url','foto_extra_url','cv_url','attestato_haccp_url','attestato_sicurezza_url'];
  var updates = { sezione_completata: 7, stato_profilo: 'in_attesa', registration_completed_at: new Date().toISOString() };
  docFields.forEach(function(f) {
    updates[f] = payload[f] || current[f] || '';
  });

  // Calcola score con tutti i dati
  var allData = {};
  for (var k in current) allData[k] = current[k];
  for (var k in updates) allData[k] = updates[k];
  var scoreResult = calculateScore_(allData);
  updates.ranking            = scoreResult.ranking;
  updates.score_questionario = calculateQuestionarioScore(allData);
  updates.score              = calculateFinalScore(updates.score_questionario, allData.score_admin || 5);

  // Crea cartella Drive personale
  var driveFolder = null;
  try {
    driveFolder = creaCartellaRegistrazione_(entity.entity_id, current.nome, current.cognome, entity.tenant_id);
  } catch (driveErr) {
    Logger.log('[REGISTRATION_FLOW] Cartella Drive non creata: ' + driveErr.message);
  }
  if (driveFolder) updates.drive_folder_id = driveFolder.getId();

  // Salva e transiziona stato
  updateEntityData(entity.entity_id, updates, entity.tenant_id, null);
  updateRow('Entities', entity.entity_id, { status: ENTITY_STATUS.LEAD_TALENT.COMPLETED_PENDING_APPROVAL });

  // Email alla candidata
  try {
    sendProfiloRicevutoEmail(current.email, current.nome);
  } catch (e) { Logger.log('[REGISTRATION_FLOW] Email candidata non inviata: ' + e.message); }

  // Email all'admin
  try {
    var adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (adminEmail) {
      sendAdminNuovoProfilo(adminEmail, current.nome, current.cognome, scoreResult.score, entity.entity_id);
    }
  } catch (e) { Logger.log('[REGISTRATION_FLOW] Email admin non inviata: ' + e.message); }

  return successResponse({
    lead_id:        entity.entity_id,
    stato_profilo:  'in_attesa',
    score:          scoreResult.score,
    ranking:        scoreResult.ranking,
    message:        'Profilo inviato! In attesa di approvazione del team Made Event.'
  });
}

// ---------------------------------------------------------------------------
// SCORING ALGORITHM (PRD aggiornato v1.1 — score 0-100)
// ---------------------------------------------------------------------------

function calculateScore_(data) {
  var score = 0;

  // Foto caricate (tutte 3 obbligatorie): +20
  var tuttiURLFoto = (data.foto_busto_url || data.foto_url) &&
                    (data.foto_intera_url) &&
                    (data.foto_extra_url  || data.cv_url);
  // Semplificato: foto_busto + foto_intera = +20
  if (data.foto_busto_url  && data.foto_busto_url.trim()  !== '') score += 10;
  if (data.foto_intera_url && data.foto_intera_url.trim() !== '') score += 10;

  // CV caricato: +15
  if (data.cv_url && data.cv_url.trim() !== '') score += 15;

  // Inglese Fluente o Madrelingua: +10
  var inglese = data.lingua_inglese || data.lingue_inglese || '';
  if (inglese === 'Fluente' || inglese === 'Madrelingua') score += 10;

  // Seconda lingua (non vuota e non "Non conosco"): +5
  var haSecondaLingua = false;
  var altre = ['lingua_francese','lingua_spagnolo','lingua_tedesco'];
  for (var i = 0; i < altre.length; i++) {
    var l = data[altre[i]] || '';
    if (l && l !== 'Non conosco') { haSecondaLingua = true; break; }
  }
  if (!haSecondaLingua && Array.isArray(data.altre_lingue) && data.altre_lingue.length > 0) {
    haSecondaLingua = data.altre_lingue.some(function(l) { return l.nome && l.livello && l.livello !== 'Non conosco'; });
  }
  if (haSecondaLingua) score += 5;

  // Anni esperienza settore: Oltre 5: +15, 3-5: +10, 1-3: +5
  var anni = data.anni_esperienza_settore || data.esperienza_anni || '';
  if (String(anni).indexOf('Oltre') !== -1 || parseInt(anni) >= 5) score += 15;
  else if (String(anni).indexOf('3') !== -1) score += 10;
  else if (String(anni).indexOf('1') !== -1) score += 5;

  // Tipologie esperienza >5 categorie: +10
  var tipologie = data.tipologie_esperienza || [];
  if (!Array.isArray(tipologie)) tipologie = [];
  if (tipologie.length > 5) score += 10;

  // Disponibilità trasferte Sì: +8
  if (data.disponibilita_trasferte === 'Sì') score += 8;

  // Disponibilità weekend Sì: +5
  if (data.disponibilita_weekend === 'Sì') score += 5;

  // Patente automobilistica: +5
  var patenti = data.patente_tipologie || [];
  if (!Array.isArray(patenti)) patenti = [];
  if (patenti.indexOf('Automobilistica') !== -1) score += 5;

  // IBAN + CF + P.IVA tutti compilati: +7
  if ((data.iban || '').trim() && (data.codice_fiscale || '').trim() && (data.partita_iva || '').trim()) {
    score += 7;
  }

  score = Math.min(100, Math.max(0, score));

  var ranking;
  if (score >= 80) ranking = 'A';
  else if (score >= 60) ranking = 'B';
  else if (score >= 40) ranking = 'C';
  else ranking = 'D';

  return { score: score, ranking: ranking };
}

// ---------------------------------------------------------------------------
// DRIVE — Crea cartella personale per la registrazione
// ---------------------------------------------------------------------------

function creaCartellaRegistrazione_(leadId, nome, cognome, tenantId) {
  var root         = getRootFolder_();
  var tenantFolder = getOrCreateSubFolder_(root, tenantId);
  var regFolder    = getOrCreateSubFolder_(tenantFolder, 'registrazioni');

  var nomeSafe    = String(cognome || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  var cognomeSafe = String(nome    || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  var folderName  = 'MADE_' + nomeSafe + '_' + cognomeSafe + '_' + leadId.substring(0, 8);

  // Idempotenza: se esiste già, ritorna quella
  var existing = regFolder.getFoldersByName(folderName);
  if (existing.hasNext()) return existing.next();

  return regFolder.createFolder(folderName);
}

// ---------------------------------------------------------------------------
// GET LEAD BY TOKEN — endpoint PUBLIC
// Aggiornato: restituisce saved_data per pre-popolare il form
// ---------------------------------------------------------------------------

function handleGetLead(payload) {
  if (!payload.lead_token) {
    return errorResponse('VAL_001', 'lead_token obbligatorio');
  }

  var token = String(payload.lead_token).trim();
  var all   = getAllRows('Entities');

  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.type !== 'LEAD_TALENT') continue;
    var d = parseJSON(e.data);
    if (String(d.lead_token) === token) {
      // Aggiorna ultimo_accesso
      try {
        updateEntityData(e.entity_id, { ultimo_accesso: new Date().toISOString() }, null, null);
      } catch (err) {}

      // Restituisce i campi del form salvati (no dati sensibili come lead_token, password, ecc.)
      var savedData = {};
      var CAMPI_PUBBLICI = [
        'genere',
        'nascita_nazione','nascita_regione','nascita_provincia','nascita_citta','nascita_paese',
        'residenza_nazione','residenza_regione','residenza_provincia','residenza_citta','residenza_paese',
        'domicilio_coincide','domicilio_provincia','instagram','facebook',
        'altezza','taglia_tshirt','taglia_pantalone','taglia_gonna','numero_scarpe',
        'piercing_visibili','tatuaggi_visibili','tatuaggi_dove',
        'patente_tipologie','automunita','province_lavoro',
        'disponibilita_trasferte','disponibilita_weekend','disponibilita_serali',
        'lingua_inglese','inglese_certificato','lingua_francese','lingua_spagnolo','lingua_tedesco','altre_lingue',
        'titolo_studio','titolo_studio_indirizzo','professione_attuale','tipologie_esperienza','anni_esperienza_settore',
        'dotazione_personale',
        'codice_fiscale','partita_iva','iban','disponibile_chiamata','disponibile_ritenuta',
        'doc_identita_url','doc_cf_url','foto_busto_url','foto_intera_url','foto_extra_url',
        'cv_url','attestato_haccp_url','attestato_sicurezza_url',
      ];
      for (var j = 0; j < CAMPI_PUBBLICI.length; j++) {
        var campo = CAMPI_PUBBLICI[j];
        if (d[campo] !== undefined) savedData[campo] = d[campo];
      }

      return successResponse({
        lead_id:            e.entity_id,
        nome:               d.nome    || '',
        email:              d.email   || '',
        step_completed:     parseInt(d.step_completed)     || 1,
        sezione_completata: parseInt(d.sezione_completata) || 0,
        saved_data:         savedData
      });
    }
  }

  return errorResponse('SYS_002', 'Link non valido o scaduto');
}

// ---------------------------------------------------------------------------
// LEAD LIST per admin
// ---------------------------------------------------------------------------

function handleLeadList(payload, auth) {
  var tenantId = resolvedTenantId_(payload, auth);
  var result   = listEntities('LEAD_TALENT', tenantId, null, payload.page, payload.limit);

  if (payload.status) {
    result.items = result.items.filter(function(e) { return e.status === payload.status; });
    result.total = result.items.length;
  }

  result.items = result.items.map(entityToPublic);
  return successResponse(result);
}

// ---------------------------------------------------------------------------
// LEAD UPDATE — aggiorna campi data di un LEAD_TALENT (admin only)
// ---------------------------------------------------------------------------

function handleLeadUpdate(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'LEAD_TALENT') return errorResponse('SYS_002', 'Lead non trovato');

  var allowedFields = ['sollecito_1_inviato', 'sollecito_2_inviato', 'sollecito_finale_inviato', 'ultimo_sollecito'];
  var updates = {};
  for (var i = 0; i < allowedFields.length; i++) {
    var f = allowedFields[i];
    if (payload[f] !== undefined) updates[f] = payload[f];
  }

  var updated = updateEntityData(payload.entity_id, updates, auth.tenant_id, auth.user_id);
  return successResponse({ lead: entityToPublic(updated) });
}

// ---------------------------------------------------------------------------
// LEAD SOLICIT — invia manualmente sollecito e aggiorna contatore
// ---------------------------------------------------------------------------

function handleLeadSolicit(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'LEAD_TALENT') return errorResponse('SYS_002', 'Lead non trovato');

  var d = entity.data;
  var now = new Date().toISOString();
  var levelUpdates = { ultimo_sollecito: now };

  if (!d.sollecito_1_inviato) {
    levelUpdates.sollecito_1_inviato = now;
  } else if (!d.sollecito_2_inviato) {
    levelUpdates.sollecito_2_inviato = now;
  } else if (!d.sollecito_finale_inviato) {
    levelUpdates.sollecito_finale_inviato = now;
  }

  // Invia email (aggiorna anche ultimo_sollecito internamente)
  var emailSent = inviaEmailSollecito(payload.entity_id);

  // Aggiorna i campi livello (merge — non sovrascrive altri campi)
  var updated = updateEntityData(payload.entity_id, levelUpdates, auth.tenant_id, auth.user_id);
  return successResponse({ lead: entityToPublic(updated), sollecito_inviato: emailSent });
}

// ---------------------------------------------------------------------------
// INVIO EMAIL SOLLECITO — chiamato da Jobs.js
// ---------------------------------------------------------------------------

function inviaEmailSollecito(leadId) {
  var entity = getEntityById(leadId, null);
  if (!entity || entity.type !== 'LEAD_TALENT') return false;

  var d = entity.data;
  if (!d.email) return false;

  // Calcola sezioni completate vs mancanti
  var completati = [];
  var mancanti   = [];

  var checkSezione = function(n, label, check) {
    if (check(d)) completati.push(label);
    else          mancanti.push(label);
  };

  checkSezione(1, 'Dati Personali',       function(d) { return !!(d.nascita_citta && d.residenza_citta); });
  checkSezione(2, 'Profilo Fisico',       function(d) { return !!(d.altezza && d.taglia_tshirt && d.numero_scarpe); });
  checkSezione(3, 'Disponibilità',        function(d) { return !!(d.patente_tipologie && d.patente_tipologie.length && d.province_lavoro && d.province_lavoro.length); });
  checkSezione(4, 'Lingue',               function(d) { return !!d.lingua_inglese; });
  checkSezione(5, 'Profilo Professionale',function(d) { return !!(d.titolo_studio && d.anni_esperienza_settore); });
  checkSezione(6, 'Dotazione',            function(d) { return true; }); // opzionale — sempre OK
  checkSezione(7, 'Dati Fiscali',         function(d) { return !!(d.codice_fiscale && d.iban); });
  checkSezione(8, 'Documenti e Foto',     function(d) { return !!(d.doc_identita_url && d.foto_busto_url && d.cv_url); });

  try {
    var frontendUrl = getFrontendUrl();
    var completionUrl = frontendUrl + '/registrazione/completa?token=' + (d.lead_token || '');
    sendSollecitoEmail(d.email, d.nome, completionUrl, completati, mancanti);
    updateEntityData(leadId, { ultimo_sollecito: new Date().toISOString() }, entity.tenant_id, null);
    return true;
  } catch (e) {
    Logger.log('[REGISTRATION_FLOW] Sollecito non inviato: ' + e.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// HELPERS PRIVATI
// ---------------------------------------------------------------------------

function findLeadByEmail_(emailLower) {
  var all = getAllRows('Entities');
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.type !== 'LEAD_TALENT') continue;
    var d = parseJSON(e.data);
    if (String(d.email).toLowerCase() === emailLower) {
      e.data = d;
      return e;
    }
  }
  return null;
}

function verifyLead_(leadId, email) {
  var entity = getEntityById(leadId, null);
  if (!entity || entity.type !== 'LEAD_TALENT') {
    return { ok: false, error: errorResponse('SYS_002', 'Registrazione non trovata') };
  }
  if (String(entity.data.email).toLowerCase() !== String(email).toLowerCase().trim()) {
    return { ok: false, error: errorResponse('AUTH_003', 'Dati non corrispondenti') };
  }
  return { ok: true, entity: entity };
}

function getDefaultTenantId_() {
  var tenants = getAllRows('Tenants');
  for (var i = 0; i < tenants.length; i++) {
    if (tenants[i].status === 'active') return tenants[i].tenant_id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// LEAD GET BY EMAIL — endpoint pubblico (no token)
// Restituisce solo { entity_id, nome, step_completed } — nessun dato sensibile
// ---------------------------------------------------------------------------

function handleLeadGetByEmail(payload) {
  if (!payload.email) return errorResponse('VAL_001', 'email obbligatoria');
  var email = String(payload.email).toLowerCase().trim();
  var lead = findLeadByEmail_(email);
  if (!lead) return errorResponse('SYS_002', 'Lead non trovato per questa email');
  return successResponse({
    entity_id:      lead.entity_id,
    nome:           lead.data.nome || '',
    step_completed: parseInt(lead.data.step_completed) || 1,
  });
}

// ---------------------------------------------------------------------------
// EMAIL SEND CUSTOM — admin invia email personalizzata a un talent
// ---------------------------------------------------------------------------

function handleEmailSendCustom(payload, auth) {
  var valid = requireFields(payload, ['to', 'body']);
  if (valid) return valid;

  if (!isValidEmail(payload.to)) {
    return errorResponse('VAL_002', 'Indirizzo email non valido: ' + payload.to);
  }

  var nome      = payload.nome  || '';
  var tipo      = payload.tipo  || 'custom'; // 'custom' | 'social'
  var adminEmail = auth.email   || '';
  var sent;

  if (tipo === 'social') {
    sent = sendSocialInviteEmail(payload.to, nome, payload.body);
  } else {
    sent = sendCustomAdminEmail(payload.to, nome, payload.body, adminEmail);
  }

  if (!sent) {
    return errorResponse('SYS_001', 'Invio email fallito. Controlla i log GAS per dettagli.');
  }

  Logger.log('[EMAIL] sendCustom tipo=' + tipo + ' to=' + payload.to + ' by=' + adminEmail);
  return successResponse({ sent: true, to: payload.to, tipo: tipo });
}

// ---------------------------------------------------------------------------
// EMAIL SEND CONVOCAZIONE — admin convoca un talent per un evento specifico
// ---------------------------------------------------------------------------

function handleEmailSendConvocazione(payload, auth) {
  var valid = requireFields(payload, ['to', 'body']);
  if (valid) return valid;

  if (!isValidEmail(payload.to)) {
    return errorResponse('VAL_002', 'Indirizzo email non valido: ' + payload.to);
  }

  var nome         = payload.nome          || '';
  var titoloEvento = payload.titolo_evento || '';
  var dataEvento   = payload.data_evento   || '';
  var luogoEvento  = payload.luogo_evento  || '';

  var sent = sendConvocazioneEmail(payload.to, nome, titoloEvento, dataEvento, luogoEvento, payload.body);
  if (!sent) {
    return errorResponse('SYS_001', 'Invio email convocazione fallito.');
  }

  Logger.log('[EMAIL] sendConvocazione to=' + payload.to + ' evento=' + titoloEvento + ' by=' + (auth.email || ''));
  return successResponse({ sent: true, to: payload.to, titolo_evento: titoloEvento });
}
