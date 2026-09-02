// === TALENT_CARD.JS — MADE EVENT Platform ===
// Generazione scheda talent PDF da template Google Docs.

var _TALENT_CARD_TEMPLATE_ID = '13R2wcZa3ZchPRfQQFUeHYK4pI3zwOT1tJF2ndBif20E';

// ---------------------------------------------------------------------------
// HANDLER — talent.generateCard
// ---------------------------------------------------------------------------

function handleGenerateTalentCard(payload, auth) {
  var valid = requireFields(payload, ['talent_id']);
  if (valid) return valid;

  var talent = getEntityById(payload.talent_id, auth.tenant_id);
  if (!talent || talent.type !== 'TALENT_PROFILE') {
    return errorResponse('SYS_002', 'Talent profile non trovato');
  }

  try {
    var result = generateTalentCard_(talent, auth);
    return successResponse(result);
  } catch (e) {
    logError_('TALENT_CARD', 'talent.generateCard', e.message, e.stack || '', auth.user_id, auth.tenant_id);
    return errorResponse('SYS_001', 'Errore generazione scheda: ' + e.message);
  }
}

// ---------------------------------------------------------------------------
// CORE
// ---------------------------------------------------------------------------

// Calcola l'età da data_nascita (DD/MM/YYYY, stesso formato usato in
// admin/TalentPage.jsx formatEtaData e RegistrationFlow.js). Ritorna
// stringa età (es. "22") o '—' se assente/non valida.
function calcolaEta_(dataNascita) {
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataNascita || '');
  if (!m) return '—';
  var nascita = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (isNaN(nascita.getTime())) return '—';
  var oggi = new Date();
  var eta = oggi.getFullYear() - nascita.getFullYear();
  var meseNonRaggiunto = oggi.getMonth() < nascita.getMonth() ||
    (oggi.getMonth() === nascita.getMonth() && oggi.getDate() < nascita.getDate());
  if (meseNonRaggiunto) eta--;
  return String(eta);
}

function generateTalentCard_(talent, auth) {
  var d = talent.data || {};

  // --- Lingue ---
  var lingueList = [];
  if (d.lingua_inglese  && d.lingua_inglese  !== 'Base' && d.lingua_inglese  !== '') lingueList.push('Inglese ('  + d.lingua_inglese  + ')');
  if (d.lingua_francese && d.lingua_francese !== 'Base' && d.lingua_francese !== '') lingueList.push('Francese (' + d.lingua_francese + ')');
  if (d.lingua_spagnolo && d.lingua_spagnolo !== 'Base' && d.lingua_spagnolo !== '') lingueList.push('Spagnolo (' + d.lingua_spagnolo + ')');
  if (d.lingua_tedesco  && d.lingua_tedesco  !== 'Base' && d.lingua_tedesco  !== '') lingueList.push('Tedesco ('  + d.lingua_tedesco  + ')');
  var lingue = lingueList.length ? lingueList.join(', ') : 'Italiano';

  // --- Disponibilità ---
  var dispList = [];
  if (d.disponibilita_trasferte) dispList.push('Trasferte');
  if (d.disponibilita_weekend)   dispList.push('Weekend');
  if (d.disponibilita_serali)    dispList.push('Serali');
  var disponibilita = dispList.length ? dispList.join(', ') : '—';

  var tipologie = Array.isArray(d.tipologie_esperienza) ? d.tipologie_esperienza.join(', ') : (d.tipologie_esperienza || '');
  var dotazione  = Array.isArray(d.dotazione_personale)  ? d.dotazione_personale.join('\n')  : (d.dotazione_personale  || '');
  var province   = Array.isArray(d.province_lavoro)       ? d.province_lavoro.join(', ')       : (d.province_lavoro       || '');
  var dataGen    = Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy');

  var BLANK = '—';
  var v = function(val) { return String(val == null ? '' : val).trim() || BLANK; };

  var nomeCognome = [d.nome, d.cognome].filter(Boolean).join(' ');

  var replacements = {
    '{{NOME_COGNOME}}':          v(nomeCognome),
    '{{CITTA}}':                 v(d.residenza_citta || d.citta),
    '{{TELEFONO}}':              v(d.telefono),
    '{{EMAIL}}':                 v(d.email),
    '{{ALTEZZA}}':               v(d.altezza),
    '{{TAGLIA_TSHIRT}}':         v(d.taglia_tshirt),
    '{{TAGLIA_PANTALONE}}':      v(d.taglia_pantalone),
    '{{NUMERO_SCARPE}}':         v(d.numero_scarpe),
    '{{TATUAGGI_VISIBILI}}':     v(d.tatuaggi_visibili),
    '{{PIERCING_VISIBILI}}':     v(d.piercing_visibili),
    '{{LINGUE}}':                lingue,
    '{{TIPOLOGIE_ESPERIENZA}}':  v(tipologie),
    '{{ANNI_ESPERIENZA}}':       v(d.anni_esperienza_settore),
    '{{AUTOMUNITA}}':            v(d.automunita),
    '{{DISPONIBILITA}}':         disponibilita,
    '{{DOTAZIONE}}':             v(dotazione),
    '{{SCORE}}':                 v(d.score),
    '{{RANKING}}':               v(d.ranking),
    '{{PROVINCE_LAVORO}}':       v(province),
    '{{DATA_GENERAZIONE}}':      dataGen,
    '{{DATA_NASCITA}}':          v(d.data_nascita),
    '{{ETA}}':                   calcolaEta_(d.data_nascita),
  };

  // --- Filename ---
  var nomePart = nomeCognome.replace(/\s+/g, '_') || 'Talent';
  var filename  = 'Scheda_' + nomePart + '_' + dataGen.replace(/\//g, '');

  // --- Cartella di destinazione ---
  var targetFolder;
  try {
    targetFolder = ensureTalentFolders(auth.tenant_id, talent.entity_id).profileFolder;
  } catch (e) {
    try {
      targetFolder = ensureTenantFolders(auth.tenant_id).tenantFolder;
    } catch (e2) {
      targetFolder = DriveApp.getRootFolder();
    }
  }

  // --- Copia template ---
  var copyFile = DriveApp.getFileById(_TALENT_CARD_TEMPLATE_ID).makeCopy(filename, targetFolder);
  var docId    = copyFile.getId();

  // --- Apri e sostituisci testo ---
  var doc  = DocumentApp.openById(docId);
  var body = doc.getBody();

  for (var ph in replacements) {
    body.replaceText(ph, replacements[ph]);
  }

  // Header / footer
  var header = doc.getHeader();
  if (header) { for (var ph2 in replacements) header.replaceText(ph2, replacements[ph2]); }
  var footer = doc.getFooter();
  if (footer) { for (var ph3 in replacements) footer.replaceText(ph3, replacements[ph3]); }

  // --- Gestione foto ---
  // {{FOTO_BUSTO}}/{{FOTO_INTERA}} sono i placeholder del template corrente;
  // {{FOTO_PROFILO}} resta come fallback per compatibilità coi vecchi template
  // (stessa foto di {{FOTO_BUSTO}}). Ogni placeholder è cercato/gestito
  // indipendentemente: un template può averne uno, due o tutti e tre.
  insertPhotoAtPlaceholder_(body, '{{FOTO_BUSTO}}',   d.foto_busto_url,  auth.tenant_id);
  insertPhotoAtPlaceholder_(body, '{{FOTO_INTERA}}',  d.foto_intera_url, auth.tenant_id);
  insertPhotoAtPlaceholder_(body, '{{FOTO_PROFILO}}', d.foto_busto_url,  auth.tenant_id);

  doc.saveAndClose();

  // --- Converti in PDF ---
  var pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
  pdfBlob.setName(filename + '.pdf');
  var pdfFile = targetFolder.createFile(pdfBlob);

  // Share only with the requesting admin, not publicly.
  if (auth.email) {
    try { pdfFile.addViewer(auth.email); } catch (e) { /* non bloccare se email non valida */ }
  }

  // --- Elimina copia doc temporanea ---
  DriveApp.getFileById(docId).setTrashed(true);

  return {
    pdf_url: pdfFile.getUrl(),
    pdf_id:  pdfFile.getId(),
  };
}

// Cerca il paragrafo che contiene placeholderText, inserisce l'immagine
// (con la stessa validazione di sicurezza di fetchTenantImageBlob_) nella sua
// posizione e rimuove il paragrafo placeholder. Se il placeholder non è nel
// doc (template diverso) non fa nulla; se manca l'URL o il download fallisce,
// rimuove comunque il paragrafo per non lasciare {{...}} visibile nel PDF.
function insertPhotoAtPlaceholder_(body, placeholderText, url, tenantId) {
  var paras  = body.getParagraphs();
  var target = null;
  for (var i = 0; i < paras.length; i++) {
    if (paras[i].getText().indexOf(placeholderText) !== -1) {
      target = paras[i];
      break;
    }
  }
  if (!target) return;

  var photoBlob = url ? fetchTenantImageBlob_(url, tenantId) : null;
  if (photoBlob) {
    try {
      var paraIdx = body.getChildIndex(target);
      body.insertImage(paraIdx, photoBlob);
      body.removeChild(target);
    } catch (imgErr) {
      body.replaceText(placeholderText.replace(/[{}]/g, '\\$&'), '');
    }
  } else {
    body.removeChild(target);
  }
}

// ---------------------------------------------------------------------------
// HELPER — scarica immagine con validazione sicurezza
//
// Drive URL: verifica che il file appartenga alla cartella tenant (max 4 livelli)
//            per evitare che un talent-supplied URL legga file arbitrari Drive.
// URL esterna: solo https, solo Content-Type image/*.
// ---------------------------------------------------------------------------

function fetchTenantImageBlob_(url, tenantId) {
  if (!url) return null;

  var driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    var fileId = driveMatch[1];
    if (!isDriveFileInTenantFolder_(fileId, tenantId)) return null;
    try {
      return DriveApp.getFileById(fileId).getBlob();
    } catch (e) {
      return null;
    }
  }

  // Solo https — rifiuta http, file://, data: e URL interne
  if (!/^https:\/\//i.test(url)) return null;

  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;
    var ct = (response.getHeaders()['Content-Type'] || '').toLowerCase();
    if (ct.indexOf('image/') !== 0) return null; // rifiuta tutto ciò che non è image/*
    return response.getBlob();
  } catch (e) {
    return null;
  }
}

/**
 * Verifica che un Drive file ID si trovi nella cartella tenant (fino a 4 livelli).
 * La struttura è: ROOT/[tenantId]/talent/[profileId]/foto/[file]  (4 livelli sopra il file).
 */
function isDriveFileInTenantFolder_(fileId, tenantId) {
  try {
    var tenantFolderId = ensureTenantFolders(tenantId).tenantFolder.getId();
    var file = DriveApp.getFileById(fileId);
    // Cammina i parent fino a 4 livelli cercando la cartella tenant
    return searchParents_(file.getParents(), tenantFolderId, 4);
  } catch (e) {
    return false;
  }
}

function searchParents_(iter, targetId, depth) {
  if (depth <= 0) return false;
  while (iter.hasNext()) {
    var folder = iter.next();
    if (folder.getId() === targetId) return true;
    if (searchParents_(folder.getParents(), targetId, depth - 1)) return true;
  }
  return false;
}
