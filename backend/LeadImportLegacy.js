// === LEADIMPORTLEGACY.JS — MADE EVENT Platform ===
// Recupero one-off dei talent rimasti nel vecchio DB (step 1 completato, mai
// arrivati in db_platform) + reset solleciti per lead bloccati creati dopo il
// 17/07/2026 che non hanno mai ottenuto un TALENT_PROFILE.
//
// Pattern dry-run identico ai backfill di Workflows.js: passa
// { dryRun: false } esplicito per scrivere davvero / inviare mail.
//
// lead.importLegacy   (SUPER_ADMIN) — payload { rows: [...max 50], dryRun }
// lead.resetSolleciti (ADMIN+)      — payload { limit: max 50, dryRun }

var LEGACY_IMPORT_SOURCE_        = 'legacy_import_2026-09';
var LEGACY_RESET_MIN_CREATED_AT_ = '2026-07-17T00:00:00.000Z';
var LEGACY_TIME_BUDGET_MS_       = 270000; // 4.5 min — margine sotto il limite di 6 min di GAS

// ---------------------------------------------------------------------------
// Da eseguire UNA VOLTA dall'editor Apps Script (non da HTTP) dopo aver
// aggiunto lo scope script.send_mail in appsscript.json: fa scattare la
// schermata di consenso OAuth per MailApp.getRemainingDailyQuota() prima che
// lead.importLegacy/lead.resetSolleciti lo chiamino in produzione.
// ---------------------------------------------------------------------------

function authorizeScopes() {
  Logger.log('Quota residua: ' + MailApp.getRemainingDailyQuota());
}

// ---------------------------------------------------------------------------
// lead.importLegacy
// ---------------------------------------------------------------------------

function handleLeadImportLegacy(payload, auth) {
  if (!auth || auth.role !== ROLES.SUPER_ADMIN) {
    return errorResponse('AUTH_003', 'Permesso negato: solo SUPER_ADMIN può importare i lead legacy');
  }

  var rows = Array.isArray(payload.rows) ? payload.rows : null;
  if (!rows || !rows.length) return errorResponse('VAL_001', 'Campo "rows" obbligatorio (array non vuoto)');
  if (rows.length > 50) return errorResponse('VAL_001', 'Massimo 50 righe per chiamata');

  var dryRun   = payload.dryRun !== false; // default true — serve dryRun:false esplicito per scrivere
  var tenantId = getDefaultTenantId_();
  if (!tenantId) return errorResponse('SYS_001', 'Configurazione sistema non completata.');

  // Indice dedup su db_platform: email/telefono di ogni LEAD_TALENT e
  // TALENT_PROFILE esistente (getAllRows esclude già le righe deleted).
  var allEntities    = getAllRows('Entities');
  var existingEmails = {};
  var existingPhones = {};
  allEntities.forEach(function(e) {
    if (e.type !== 'LEAD_TALENT' && e.type !== 'TALENT_PROFILE') return;
    var d = parseJSON(e.data);
    var email = String(d.email || d.email_contatto || '').toLowerCase().trim();
    var phone = normalizePhone_(d.telefono);
    if (email) existingEmails[email] = true;
    if (phone) existingPhones[phone] = true;
  });

  var quota         = checkEmailQuota_(rows.length);
  var effectiveRows = rows.slice(0, quota.limit);

  var skipped    = [];
  var toImport   = [];
  var seenEmails = {};
  var seenPhones = {};

  effectiveRows.forEach(function(row) {
    var nome      = String(row.nome || '').trim();
    var cognome   = String(row.cognome || '').trim();
    var emailLower = String(row.email || '').toLowerCase().trim();
    var telefono  = String(row.telefono || '').trim();
    var phoneNorm = normalizePhone_(telefono);

    if (!nome || !cognome || !emailLower || !telefono) {
      skipped.push({ email: emailLower || row.email || '', motivo: 'CAMPI_MANCANTI' });
      return;
    }
    if (!isValidEmail(emailLower)) {
      skipped.push({ email: emailLower, motivo: 'EMAIL_NON_VALIDA' });
      return;
    }
    if (seenEmails[emailLower]) {
      skipped.push({ email: emailLower, motivo: 'DUPLICATO_LOTTO_EMAIL' });
      return;
    }
    if (phoneNorm && seenPhones[phoneNorm]) {
      skipped.push({ email: emailLower, motivo: 'DUPLICATO_LOTTO_TELEFONO' });
      return;
    }
    if (existingEmails[emailLower]) {
      skipped.push({ email: emailLower, motivo: 'GIA_PRESENTE_EMAIL' });
      return;
    }
    if (phoneNorm && existingPhones[phoneNorm]) {
      skipped.push({ email: emailLower, motivo: 'GIA_PRESENTE_TELEFONO' });
      return;
    }

    seenEmails[emailLower] = true;
    if (phoneNorm) seenPhones[phoneNorm] = true;
    toImport.push({ row: row, nome: nome, cognome: cognome, email: emailLower, telefono: telefono });
  });

  var response = {
    dry_run:   dryRun,
    to_import: toImport.length,
    skipped:   skipped,
    quota: {
      remaining:       quota.remaining,
      batch_richiesto: rows.length,
      batch_effettivo: effectiveRows.length,
      capped:          quota.capped
    }
  };

  if (dryRun) {
    return successResponse(response);
  }

  var created     = 0;
  var emailsSent  = 0;
  var now         = new Date();
  var start       = Date.now();
  var stoppedForTime = false;
  var processed   = 0;

  for (var i = 0; i < toImport.length; i++) {
    if (Date.now() - start > LEGACY_TIME_BUDGET_MS_) {
      stoppedForTime = true;
      break;
    }

    var item        = toImport[i];
    var row         = item.row;
    var gdprConsent = row.gdpr_consent === true || String(row.gdpr_consent).toLowerCase() === 'true';

    var leadData = buildLeadTalentBaseData_(item.nome, item.cognome, item.email, item.telefono, row.citta || '', {
      gdprConsent:   gdprConsent,
      gdprTimestamp: row.gdpr_timestamp || now.toISOString()
    });
    leadData.source           = LEGACY_IMPORT_SOURCE_;
    leadData.legacy_entity_id = row.old_entity_id || '';
    // Jobs.js:jobRegistrationSolleciti legge solleciti_ripartono_da con priorità
    // su ultimo_accesso. Ancorandolo a "adesso" il job riparte con i tempi normali
    // (24h/72h/7gg) sul lead appena importato, senza toccare ultimo_accesso — che
    // resta riservato a interazioni reali del talent (Step2, upload, apertura link).
    leadData.solleciti_ripartono_da = now.toISOString();

    var entity = createEntity('LEAD_TALENT', ENTITY_STATUS.LEAD_TALENT.PARTIAL, leadData, tenantId, auth.user_id);
    created++;
    processed++;

    var apology = LEGACY_APOLOGY_TEXT.replace('{nome}', item.nome);
    if (inviaEmailSollecito(entity.entity_id, apology)) emailsSent++;
  }

  logActivity({
    level: 'INFO', module: 'LEGACY_IMPORT', action: 'legacy.import',
    note: 'created=' + created + ' skipped=' + skipped.length + ' emails_sent=' + emailsSent +
          ' batch=' + rows.length + ' stopped_for_time=' + stoppedForTime
  });

  response.created          = created;
  response.emails_sent      = emailsSent;
  response.processed        = processed;
  response.remaining        = toImport.length - processed;
  response.stopped_for_time = stoppedForTime;
  return successResponse(response);
}

// ---------------------------------------------------------------------------
// lead.resetSolleciti
// ---------------------------------------------------------------------------

function handleLeadResetSolleciti(payload, auth) {
  if (!auth || (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SUPER_ADMIN)) {
    return errorResponse('AUTH_003', 'Permesso negato: solo gli admin possono resettare i solleciti');
  }

  var dryRun = payload.dryRun !== false; // default true — serve dryRun:false esplicito per scrivere
  var limit  = Math.min(50, Math.max(1, parseInt(payload.limit, 10) || 50));

  var tenantId      = auth.tenant_id;
  var minCreatedAtMs = new Date(LEGACY_RESET_MIN_CREATED_AT_).getTime();

  var allEntities = getAllRows('Entities');

  // Indice email/telefono di ogni TALENT_PROFILE esistente: chi ha già un
  // profilo non va più sollecitato a completare la registrazione.
  var profileEmails = {};
  var profilePhones = {};
  allEntities.forEach(function(e) {
    if (e.type !== 'TALENT_PROFILE') return;
    var d = parseJSON(e.data);
    var email = String(d.email || d.email_contatto || '').toLowerCase().trim();
    var phone = normalizePhone_(d.telefono);
    if (email) profileEmails[email] = true;
    if (phone) profilePhones[phone] = true;
  });

  var candidates = [];
  allEntities.forEach(function(e) {
    if (e.type !== 'LEAD_TALENT') return;
    if (tenantId && String(e.tenant_id) !== String(tenantId)) return;
    var d = parseJSON(e.data);
    if (d._demo) return;
    var statoOk = d.stato_profilo === 'da_compilare' || !d.stato_profilo;
    var stepOk  = (parseInt(d.step_completed, 10) || 0) < 2;
    if (!statoOk || !stepOk) return;
    e.data = d;
    candidates.push(e);
  });

  var target  = [];
  var esclusi = [];

  candidates.forEach(function(e) {
    var d          = e.data;
    var email      = String(d.email || '').toLowerCase().trim();
    var phone      = normalizePhone_(d.telefono);
    var createdAtMs = new Date(e.created_at).getTime();

    if (d.source === LEGACY_IMPORT_SOURCE_) {
      esclusi.push({ email: email, motivo: 'SOURCE_LEGACY_IMPORT' });
      return;
    }
    if (d.solleciti_reset_at) {
      esclusi.push({ email: email, motivo: 'GIA_RESETTATO' });
      return;
    }
    if (isNaN(createdAtMs) || createdAtMs < minCreatedAtMs) {
      esclusi.push({ email: email, motivo: 'FUORI_FINESTRA_DATE' });
      return;
    }
    if (profileEmails[email] || (phone && profilePhones[phone])) {
      esclusi.push({ email: email, motivo: 'HA_GIA_TALENT_PROFILE' });
      return;
    }

    target.push(e);
  });

  target.sort(function(a, b) { return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); });

  var quota         = checkEmailQuota_(limit);
  var effectiveLimit = quota.limit;
  var batch          = target.slice(0, effectiveLimit);

  var response = {
    dry_run:       dryRun,
    target_totali: target.length,
    nel_lotto:     batch.map(function(e) { return e.data.email; }),
    esclusi:       esclusi,
    quota: {
      remaining:       quota.remaining,
      limit_richiesto: limit,
      limit_effettivo: effectiveLimit,
      capped:          quota.capped
    }
  };

  if (dryRun) {
    return successResponse(response);
  }

  var resetCount = 0;
  var emailsSent = 0;
  var now        = new Date();
  var start      = Date.now();
  var stoppedForTime = false;
  var processed  = 0;

  for (var i = 0; i < batch.length; i++) {
    if (Date.now() - start > LEGACY_TIME_BUDGET_MS_) {
      stoppedForTime = true;
      break;
    }

    var e = batch[i];
    updateEntityData(e.entity_id, {
      sollecito_1_inviato:      '',
      sollecito_2_inviato:      '',
      sollecito_finale_inviato: '',
      solleciti_reset_at:       now.toISOString(),
      // Stesso motivo di lead.importLegacy: fa ripartire il countdown del job
      // (jobRegistrationSolleciti legge solleciti_ripartono_da con priorità su
      // ultimo_accesso) da "adesso" coi tempi normali, senza toccare ultimo_accesso.
      solleciti_ripartono_da: now.toISOString()
    }, e.tenant_id, auth.user_id);

    resetCount++;
    processed++;

    var apology = LEGACY_APOLOGY_TEXT.replace('{nome}', e.data.nome || '');
    if (inviaEmailSollecito(e.entity_id, apology)) emailsSent++;
  }

  logActivity({
    level: 'INFO', module: 'LEAD_RESET_SOLLECITI', action: 'legacy.resetSolleciti',
    note: 'reset=' + resetCount + ' emails_sent=' + emailsSent + ' target_totali=' + target.length +
          ' stopped_for_time=' + stoppedForTime
  });

  response.reset             = resetCount;
  response.emails_sent       = emailsSent;
  response.processed         = processed;
  response.remaining         = batch.length - processed;
  response.stopped_for_time  = stoppedForTime;
  return successResponse(response);
}
