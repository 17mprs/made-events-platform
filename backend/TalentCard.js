// === TALENT_CARD.JS — MADE EVENT Platform ===
// Generazione scheda talent PDF da template Google Docs.

// Fallback storico — ha priorità la Script Property TALENT_CARD_TEMPLATE_ID
// se impostata (stesso pattern di getContractTemplateId_ in ContractManager.js).
var _TALENT_CARD_TEMPLATE_ID_FALLBACK = '13R2wcZa3ZchPRfQQFUeHYK4pI3zwOT1tJF2ndBif20E';

function getTalentCardTemplateId_() {
  try {
    return PropertiesService.getScriptProperties().getProperty('TALENT_CARD_TEMPLATE_ID') || _TALENT_CARD_TEMPLATE_ID_FALLBACK;
  } catch (e) {
    return _TALENT_CARD_TEMPLATE_ID_FALLBACK;
  }
}

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
  if (d.lingua_inglese  && d.lingua_inglese  !== 'Base' && d.lingua_inglese  !== '' && d.lingua_inglese  !== 'Non conosco') lingueList.push('Inglese ('  + d.lingua_inglese  + ')');
  if (d.lingua_francese && d.lingua_francese !== 'Base' && d.lingua_francese !== '' && d.lingua_francese !== 'Non conosco') lingueList.push('Francese (' + d.lingua_francese + ')');
  if (d.lingua_spagnolo && d.lingua_spagnolo !== 'Base' && d.lingua_spagnolo !== '' && d.lingua_spagnolo !== 'Non conosco') lingueList.push('Spagnolo (' + d.lingua_spagnolo + ')');
  if (d.lingua_tedesco  && d.lingua_tedesco  !== 'Base' && d.lingua_tedesco  !== '' && d.lingua_tedesco  !== 'Non conosco') lingueList.push('Tedesco ('  + d.lingua_tedesco  + ')');
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

  var nome = d.nome ? d.nome.trim().charAt(0).toUpperCase() + d.nome.trim().slice(1).toLowerCase() : '';
  var cognomeIniziale = d.cognome ? d.cognome.trim().charAt(0).toUpperCase() + '.' : '';
  var nomeCognome = [nome, cognomeIniziale].filter(Boolean).join(' ');

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
  var copyFile = DriveApp.getFileById(getTalentCardTemplateId_()).makeCopy(filename, targetFolder);
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
// svuota comunque il paragrafo per non lasciare {{...}} visibile nel PDF.
//
// Usa Paragraph.insertInlineImage() invece di Body.insertImage()/removeChild():
// questi ultimi richiedono che l'elemento sia figlio diretto di body e falliscono
// silenziosamente (o lanciano) quando il placeholder è dentro una cella di
// tabella — caso comune nei template a griglia. insertInlineImage() opera sul
// paragrafo stesso, funziona indipendentemente dalla profondità di nesting.
function insertPhotoAtPlaceholder_(body, placeholderText, url, tenantId) {
  var target = null;

  // 1. Cerca nei paragrafi del body principale
  var paras = body.getParagraphs();
  for (var i = 0; i < paras.length; i++) {
    if (paras[i].getText().indexOf(placeholderText) !== -1) {
      target = paras[i];
      break;
    }
  }
  Logger.log('body paras count=' + paras.length);

  // 2. Se non trovato, cerca nelle celle di tutte le tabelle
  if (!target) {
    var tables = body.getTables();
    outer: for (var t = 0; t < tables.length; t++) {
      var table = tables[t];
      for (var r = 0; r < table.getNumRows(); r++) {
        var row = table.getRow(r);
        for (var c = 0; c < row.getNumCells(); c++) {
          var cell = row.getCell(c);
          var cellText = cell.getText();
          Logger.log('cell[' + r + '][' + c + '] text=' + cellText.substring(0, 80));
          if (cellText.indexOf(placeholderText) !== -1) {
            // Trovato — itera i figli della cella per trovare il paragrafo esatto
            for (var p = 0; p < cell.getNumChildren(); p++) {
              var child = cell.getChild(p);
              if (child.getType() === DocumentApp.ElementType.PARAGRAPH &&
                  child.getText().indexOf(placeholderText) !== -1) {
                target = child.asParagraph();
                break outer;
              }
            }
          }
        }
      }
    }
  }

  if (!target) return;

  var photoBlob = url ? fetchTenantImageBlob_(url, tenantId) : null;
  if (photoBlob) {
    try {
      var isBusto = placeholderText.indexOf('BUSTO') !== -1;
      var img = target.insertInlineImage(0, photoBlob);
      var naturalW = img.getWidth();
      var naturalH = img.getHeight();
      var maxW = isBusto ? 310 : 258;
      var maxH = 620;
      var scaleByW = maxW / naturalW;
      var scaleByH = maxH / naturalH;
      var scale = Math.min(scaleByW, scaleByH);
      img.setWidth(Math.round(naturalW * scale));
      img.setHeight(Math.round(naturalH * scale));
      target.replaceText(placeholderText.replace(/[{}]/g, '\\$&'), '');
    } catch (imgErr) {
      // errore inserimento immagine — placeholder resta com'è
    }
  } else {
    try { target.setText(''); } catch (e) { /* paragrafo già vuoto, nessuna azione */ }
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

    // --- Log diagnostico: dove vive davvero il file vs. dove ci aspettiamo la root tenant ---
    var chain = collectParentChain_(file, 5);
    var diagMsg = 'isDriveFileInTenantFolder_ fileId=' + fileId +
      ' tenantId=' + tenantId +
      ' tenantFolderId(atteso)=' + tenantFolderId +
      ' parentChain=[' + chain.join(' -> ') + ']';
    Logger.log(diagMsg);
    logError_('TALENT_CARD_DIAG', 'isDriveFileInTenantFolder_', diagMsg, '', null, tenantId);

    // Cammina i parent fino a 4 livelli cercando la cartella tenant
    return searchParents_(file.getParents(), tenantFolderId, 4);
  } catch (e) {
    return false;
  }
}

// Raccoglie fino a maxDepth livelli di parent del file (solo il primo parent
// per livello, per una diagnostica leggibile — un file può avere più parent
// se condiviso in più cartelle, ma per i file caricati dalla piattaforma è
// sempre uno solo). Ogni voce è "nomeCartella (id)".
function collectParentChain_(file, maxDepth) {
  var chain = [];
  var current = file;
  for (var i = 0; i < maxDepth; i++) {
    var parents = current.getParents();
    if (!parents.hasNext()) break;
    var parent = parents.next();
    chain.push(parent.getName() + ' (' + parent.getId() + ')');
    current = parent;
  }
  return chain;
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
