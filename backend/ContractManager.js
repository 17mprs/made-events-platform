// === CONTRACT_MANAGER.JS — MADE EVENT Platform ===
// Generazione contratti da template Google Doc.
// Copia il template, sostituisce i placeholder, esporta il PDF, salva Doc e PDF
// (privati) nella cartella evento e registra la generazione come entità CONTRATTO.

var CONTRACT_FILENAME_MAX_ = 100;

function getContractTemplateId_() {
  var id = PropertiesService.getScriptProperties().getProperty('CONTRACT_TEMPLATE_ID');
  if (!id || !String(id).trim()) {
    throw new Error('CONTRACT_TEMPLATE_ID non impostato nelle Script Properties');
  }
  return String(id).trim();
}

// ---------------------------------------------------------------------------
// HELPER — nomi file e date
// ---------------------------------------------------------------------------

/**
 * Rende una stringa sicura per un nome file: rimuove accenti e / \ : * ? " < > |,
 * spazi → _, nessun altro carattere speciale, troncata a maxLen.
 */
function sanitizeFilenamePart_(s, maxLen) {
  var out = String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_\-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (maxLen && out.length > maxLen) out = out.substring(0, maxLen).replace(/_+$/, '');
  return out;
}

/**
 * Normalizza la data di un turno (stringa 'YYYY-MM-DD…' o Date) in
 * { dmy: 'dd/MM/yyyy', ymd: 'yyyyMMdd' }, oppure null se non valida.
 * Le stringhe ISO sono lette per componenti: nessuno slittamento di fuso orario.
 */
function parseShiftDate_(raw) {
  if (!raw) return null;
  var m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { dmy: m[3] + '/' + m[2] + '/' + m[1], ymd: m[1] + m[2] + m[3] };
  var d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return {
    dmy: Utilities.formatDate(d, 'Europe/Rome', 'dd/MM/yyyy'),
    ymd: Utilities.formatDate(d, 'Europe/Rome', 'yyyyMMdd')
  };
}

/**
 * Candidatura APPROVED del talent su un evento con un turno valido
 * (SHIFT non cancellato, dello stesso evento). Se ce ne sono più d'una
 * (una per turno) restituisce la prima che ha un turno valido.
 * @returns {{application: object, shift: object}|null}
 */
function findApprovedApplicationWithShift_(talentProfileId, eventId, tenantId) {
  var all = getAllRows('Entities');
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.type !== 'APPLICATION') continue;
    if (e.status !== ENTITY_STATUS.APPLICATION.APPROVED) continue;
    if (String(e.tenant_id) !== String(tenantId)) continue;
    if (String(e.deleted).toLowerCase() === 'true') continue;
    var d = parseJSON(e.data);
    if (String(d.talent_profile_id) !== String(talentProfileId)) continue;
    if (String(d.event_id) !== String(eventId)) continue;
    if (!d.shift_id) continue;
    var shift = getEntityById(d.shift_id, tenantId);
    if (!shift || shift.type !== 'SHIFT') continue;
    if (shift.status === ENTITY_STATUS.SHIFT.CANCELLED) continue;
    if (String(shift.data.event_id) !== String(eventId)) continue;
    e.data = d;
    return { application: e, shift: shift };
  }
  return null;
}

// ---------------------------------------------------------------------------
// GENERATE CONTRACT — core
// ---------------------------------------------------------------------------

/**
 * Copia il template Doc, sostituisce i placeholder, esporta il PDF e salva
 * entrambi i file (privati) nella cartella evento.
 * @param {object} talentData  - entity.data del TALENT_PROFILE
 * @param {object} eventData   - entity.data dell'EVENT (con event_id aggiunto)
 * @param {object} shiftData   - entity.data dello SHIFT assegnato, o null
 * @param {object} auth        - auth context (tenant_id, user_id)
 * @returns {{ pdf_blob, pdf_file_id, doc_file_id, filename, doc_filename }}
 */
function generateContract(talentData, eventData, shiftData, auth) {
  var td = talentData || {};
  var ed = eventData  || {};
  var sd = shiftData  || null;

  var MISSING = '[DA COMPILARE]';
  var v = function(val, fallback) {
    var s = String(val || fallback || '').trim();
    return s || MISSING;
  };

  // Data e orario vengono SOLO dal turno assegnato al talent: mai dall'evento
  // né dal primo turno disponibile.
  var shiftDate = sd ? parseShiftDate_(sd.data) : null;
  var dataEventoStr = shiftDate ? shiftDate.dmy : MISSING;
  var orarioStr = (sd && String(sd.orario_inizio || '').trim() && String(sd.orario_fine || '').trim())
    ? String(sd.orario_inizio).trim() + '–' + String(sd.orario_fine).trim()
    : MISSING;

  // Indirizzo: via (inserita dall'admin) + città (prov). Senza via resta DA COMPILARE.
  var cittaRes = td.residenza_citta
    ? td.residenza_citta + (td.residenza_provincia ? ' (' + td.residenza_provincia + ')' : '')
    : '';
  var indirizzoStr = String(td.residenza_indirizzo || '').trim()
    ? String(td.residenza_indirizzo).trim() + (cittaRes ? ', ' + cittaRes : '')
    : '';

  var nomeCompleto = [td.nome, td.cognome].filter(Boolean).join(' ') || '';

  // Data firma odierna
  var dataFirma = Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy');

  // Placeholder map (field name reali di TALENT_PROFILE / EVENT / SHIFT)
  var replacements = {
    '{{NOME_COGNOME}}':        v(nomeCompleto),
    '{{CODICE_FISCALE}}':      v(td.codice_fiscale),
    '{{DATA_NASCITA}}':        v(td.data_nascita),
    '{{CITTA_NASCITA}}':       v(td.nascita_citta),
    '{{NAZIONALITA}}':         v(td.nascita_paese, 'Italiana'),
    '{{INDIRIZZO}}':           v(indirizzoStr),
    '{{NUMERO_DOCUMENTO}}':    v(td.numero_documento),         // inserito dall'admin (scheda talent)
    '{{STATO_EMISSIONE_DOC}}': v(td.stato_emissione_documento, 'Italia'),
    '{{DATA_EVENTO}}':         dataEventoStr,
    '{{LUOGO_EVENTO}}':        v(ed.luogo),
    '{{ORARIO_EVENTO}}':       orarioStr,
    '{{TIPOLOGIA_EVENTO}}':    v(ed.tipologia, ed.titolo),
    '{{ABBIGLIAMENTO}}':       v(sd && sd.dress_code, ed.abbigliamento_richiesto || 'Vedere briefing'),
    '{{COMPENSO}}':            v(ed.compenso, 'Da definire'),
    '{{DATA_FIRMA}}':          dataFirma,
  };

  // Nome file: Contratto_<Nome>_<Cognome>_<EVENTO>_<AAAAMMGG turno>[.pdf]
  // L'evento è la parte comprimibile: il totale resta entro CONTRACT_FILENAME_MAX_.
  var nomePart    = sanitizeFilenamePart_(td.nome)    || 'Talent';
  var cognomePart = sanitizeFilenamePart_(td.cognome);
  var dataPart    = shiftDate ? shiftDate.ymd : 'ND';
  var head = ['Contratto', nomePart, cognomePart].filter(Boolean).join('_');
  var tail = dataPart;
  var eventoMax = CONTRACT_FILENAME_MAX_ - '.pdf'.length - head.length - tail.length - 2;
  var eventoPart = sanitizeFilenamePart_(ed.titolo, Math.max(eventoMax, 0)) || (eventoMax > 0 ? 'Evento' : '');
  var docName = [head, eventoPart, tail].filter(Boolean).join('_');
  var pdfName = docName + '.pdf';

  // Cartella evento: obbligatoria. Nessun fallback sul root di Drive.
  if (!auth || !auth.tenant_id || !ed.event_id) {
    throw new Error('Cartella evento non determinabile: tenant_id o event_id mancante');
  }
  var targetFolder;
  try {
    targetFolder = ensureEventFolder(auth.tenant_id, ed.event_id);
  } catch (e) {
    throw new Error('Cartella evento non disponibile: ' + e.message);
  }

  // Copia template (privata: nessun setSharing, i permessi sono quelli della cartella)
  var templateFile = DriveApp.getFileById(getContractTemplateId_());
  var copy = templateFile.makeCopy(docName, targetFolder);

  var pdfFile = null;
  try {
    var doc  = DocumentApp.openById(copy.getId());
    var body = doc.getBody();

    for (var placeholder in replacements) {
      body.replaceText(placeholder, replacements[placeholder]);
    }

    // Header e footer (se presenti nel template)
    var header = doc.getHeader();
    if (header) {
      for (var ph in replacements) header.replaceText(ph, replacements[ph]);
    }
    var footer = doc.getFooter();
    if (footer) {
      for (var pf in replacements) footer.replaceText(pf, replacements[pf]);
    }

    // Il PDF va esportato DOPO il salvataggio, altrimenti esce il template vuoto.
    doc.saveAndClose();

    var pdfBlob = copy.getAs(MimeType.PDF).setName(pdfName);
    pdfFile = targetFolder.createFile(pdfBlob);

    return {
      pdf_blob:     pdfBlob,
      pdf_file_id:  pdfFile.getId(),
      doc_file_id:  copy.getId(),
      filename:     pdfName,
      doc_filename: docName
    };
  } catch (e) {
    // Niente file orfani se la generazione si interrompe a metà.
    try { copy.setTrashed(true); } catch (e1) {}
    try { if (pdfFile) pdfFile.setTrashed(true); } catch (e2) {}
    throw e;
  }
}

// ---------------------------------------------------------------------------
// HANDLER — contract.generate
// ---------------------------------------------------------------------------

function handleContractGenerate(payload, auth) {
  var valid = requireFields(payload, ['talent_profile_id', 'event_id']);
  if (valid) return valid;

  var talent = getEntityById(payload.talent_profile_id, auth.tenant_id);
  if (!talent || talent.type !== 'TALENT_PROFILE') {
    return errorResponse('SYS_002', 'Talent profile non trovato');
  }

  var event = getEntityById(payload.event_id, auth.tenant_id);
  if (!event || event.type !== 'EVENT') {
    return errorResponse('SYS_002', 'Evento non trovato');
  }

  try {
    var td = talent.data || {};
    var ed = event.data  || {};
    ed.event_id = event.entity_id; // usato per folder routing

    // Turno del talent: APPLICATION APPROVED → shift_id → SHIFT dello stesso evento.
    // Senza turno valido non si crea nessun file: errore PRIMA di toccare Drive.
    var assigned = findApprovedApplicationWithShift_(talent.entity_id, event.entity_id, auth.tenant_id);
    if (!assigned) {
      return errorResponse('WF_002', "Nessun turno assegnato a questo talent per l'evento");
    }
    var application = assigned.application;
    var shift = assigned.shift;

    var result = generateContract(td, ed, shift.data, auth);

    // Storico: una entità CONTRATTO per ogni generazione. Un errore qui non
    // deve far perdere il PDF già creato: si logga e si segnala nella risposta.
    var storicoOk = true;
    try {
      createEntity('CONTRATTO', ENTITY_STATUS.CONTRATTO.GENERATED, {
        application_id: application.entity_id,
        event_id:       event.entity_id,
        shift_id:       shift.entity_id,
        talent_id:      talent.entity_id,
        pdf_file_id:    result.pdf_file_id,
        doc_file_id:    result.doc_file_id,
        filename:       result.filename,
        generato_il:    new Date().toISOString(),
        generato_da:    auth.user_id
      }, auth.tenant_id, auth.user_id);
    } catch (histErr) {
      storicoOk = false;
      logError_({ severity: 'ERROR', module: 'CONTRACT_MANAGER', action: 'contract.generate.storico',
        entity_type: 'TALENT_PROFILE', entity_id: talent.entity_id, actor: auth.user_id, tenant_id: auth.tenant_id,
        message: 'Registrazione CONTRATTO fallita (pdf_file_id=' + result.pdf_file_id + '): ' + histErr.message,
        stack: histErr.stack });
    }

    return successResponse({
      pdf_base64:   Utilities.base64Encode(result.pdf_blob.getBytes()),
      pdf_file_id:  result.pdf_file_id,
      doc_file_id:  result.doc_file_id,
      filename:     result.filename,
      storico:      storicoOk
    });
  } catch (e) {
    logError_({ severity: 'ERROR', module: 'CONTRACT_MANAGER', action: 'contract.generate',
      entity_type: 'TALENT_PROFILE', entity_id: payload.talent_profile_id, actor: auth.user_id, tenant_id: auth.tenant_id,
      message: e.message, stack: e.stack || '' });
    return errorResponse('SYS_001', 'Errore generazione contratto: ' + e.message);
  }
}
