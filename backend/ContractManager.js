// === CONTRACT_MANAGER.JS — MADE EVENT Platform ===
// Generazione contratti da template Google Doc.
// Copia il template, sostituisce i placeholder, restituisce il link.

var _CONTRACT_TEMPLATE_ID_FALLBACK = '1WyVn17-7Iaq3H5uF0DZPDN_DVC-KQPmFnU4bWbFNYgM';

function getContractTemplateId_() {
  try {
    return PropertiesService.getScriptProperties().getProperty('CONTRACT_TEMPLATE_ID') || _CONTRACT_TEMPLATE_ID_FALLBACK;
  } catch (e) {
    return _CONTRACT_TEMPLATE_ID_FALLBACK;
  }
}

// ---------------------------------------------------------------------------
// GENERATE CONTRACT — core
// ---------------------------------------------------------------------------

/**
 * Copia il template Doc, sostituisce i placeholder con i dati reali.
 * @param {object} talentData  - entity.data del TALENT_PROFILE
 * @param {object} eventData   - entity.data dell'EVENT (con event_id aggiunto)
 * @param {object} auth        - auth context (tenant_id, user_id)
 * @returns {{ file_id, url, filename }}
 */
function generateContract(talentData, eventData, auth) {
  var td = talentData || {};
  var ed = eventData  || {};

  var MISSING = '[DA COMPILARE]';
  var v = function(val, fallback) {
    var s = String(val || fallback || '').trim();
    return s || MISSING;
  };

  // Nome file
  var nomeCompleto = [td.nome, td.cognome].filter(Boolean).join(' ') || '';
  var nomePart     = nomeCompleto.replace(/\s+/g, '_') || 'Talent';
  var dataPart     = ed.data_inizio
    ? new Date(ed.data_inizio).toISOString().slice(0, 10).replace(/-/g, '')
    : 'ND';
  var filename = 'Contratto_' + nomePart + '_' + dataPart;

  // Formatta data evento (dd/MM/yyyy)
  var dataEventoStr = MISSING;
  if (ed.data_inizio) {
    try {
      dataEventoStr = Utilities.formatDate(new Date(ed.data_inizio), 'Europe/Rome', 'dd/MM/yyyy');
    } catch (e) {
      dataEventoStr = String(ed.data_inizio);
    }
  }

  // Data firma odierna
  var dataFirma = Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy');

  // Placeholder map
  var replacements = {
    '{{NOME_COGNOME}}':        v(nomeCompleto),
    '{{CODICE_FISCALE}}':      v(td.codice_fiscale),
    '{{DATA_NASCITA}}':        v(td.data_nascita, td.nascita_citta),
    '{{CITTA_NASCITA}}':       v(td.nascita_citta, td.citta_nascita),
    '{{NAZIONALITA}}':         v(td.nazionalita, 'Italiana'),
    '{{INDIRIZZO}}':           v(td.indirizzo_residenza, td.residenza_citta),
    '{{NUMERO_DOCUMENTO}}':    v(td.numero_documento, td.doc_identita_url),
    '{{STATO_EMISSIONE_DOC}}': v(td.stato_emissione_documento, 'Italia'),
    '{{DATA_EVENTO}}':         dataEventoStr,
    '{{LUOGO_EVENTO}}':        v(ed.luogo),
    '{{ORARIO_EVENTO}}':       v(ed.orario, 'Da definire'),
    '{{TIPOLOGIA_EVENTO}}':    v(ed.tipologia, ed.titolo),
    '{{ABBIGLIAMENTO}}':       v(ed.abbigliamento_richiesto, 'Vedere briefing'),
    '{{COMPENSO}}':            v(ed.compenso, 'Da definire'),
    '{{DATA_FIRMA}}':          dataFirma,
  };

  // Destinazione: cartella evento se possibile, altrimenti root
  var targetFolder;
  try {
    if (auth && auth.tenant_id && ed.event_id) {
      targetFolder = ensureEventFolder(auth.tenant_id, ed.event_id);
    } else {
      targetFolder = DriveApp.getRootFolder();
    }
  } catch (e) {
    targetFolder = DriveApp.getRootFolder();
  }

  // Copia template
  var templateFile = DriveApp.getFileById(getContractTemplateId_());
  var copy = templateFile.makeCopy(filename, targetFolder);
  copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);

  // Apri e sostituisci placeholder nel corpo del documento
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

  doc.saveAndClose();

  return {
    file_id:  copy.getId(),
    url:      'https://docs.google.com/document/d/' + copy.getId() + '/edit',
    filename: filename,
  };
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

    var result = generateContract(td, ed, auth);
    return successResponse(result);
  } catch (e) {
    logError_('CONTRACT_MANAGER', 'contract.generate', e.message, e.stack || '', auth.user_id, auth.tenant_id);
    return errorResponse('SYS_001', 'Errore generazione contratto: ' + e.message);
  }
}
