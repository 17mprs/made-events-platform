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
  var paras    = body.getParagraphs();
  var fotoPara = null;
  for (var i = 0; i < paras.length; i++) {
    if (paras[i].getText().indexOf('{{FOTO_PROFILO}}') !== -1) {
      fotoPara = paras[i];
      break;
    }
  }

  if (fotoPara) {
    var photoBlob = null;
    if (d.foto_busto_url) {
      photoBlob = fetchImageBlob_(d.foto_busto_url);
    }
    if (photoBlob) {
      try {
        var paraIdx = body.getChildIndex(fotoPara);
        body.insertImage(paraIdx, photoBlob);
        body.removeChild(fotoPara);
      } catch (imgErr) {
        body.replaceText('\\{\\{FOTO_PROFILO\\}\\}', '');
      }
    } else {
      body.removeChild(fotoPara);
    }
  }

  doc.saveAndClose();

  // --- Converti in PDF ---
  var pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
  pdfBlob.setName(filename + '.pdf');
  var pdfFile = targetFolder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // --- Elimina copia doc temporanea ---
  DriveApp.getFileById(docId).setTrashed(true);

  return {
    pdf_url: pdfFile.getUrl(),
    pdf_id:  pdfFile.getId(),
  };
}

// ---------------------------------------------------------------------------
// HELPER — scarica immagine da URL o Drive
// ---------------------------------------------------------------------------

function fetchImageBlob_(url) {
  if (!url) return null;

  // Drive URL → usa DriveApp direttamente
  var driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    try {
      return DriveApp.getFileById(driveMatch[1]).getBlob();
    } catch (e) {
      return null;
    }
  }

  // URL esterno → UrlFetchApp
  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) return response.getBlob();
    return null;
  } catch (e) {
    return null;
  }
}
