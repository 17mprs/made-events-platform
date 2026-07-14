// === DRIVE_MANAGER.JS — MADE EVENT Platform v1.0 ===
// Gestione Google Drive: struttura cartelle, upload documenti talent,
// metadati in TALENT_PROFILE, access control per ruolo.
//
// STRUTTURA DRIVE (PRD BLOCK:STORAGE_DOCUMENTI):
//   /MADE_EVENT_ROOT/
//     /[tenant_id]/
//       /talent/
//         /[talent_profile_id]/
//           /cv/          cv_[id]_v[N].[ext]
//           /foto/        foto_[id]_[timestamp].[ext]
//           /documenti/   [tipo]_[id].[ext]
//       /eventi/
//         /[event_id]/    [brief, contratti]
//       /system/
//         /log/           [export mensili]
//
// ACCESS CONTROL (PRD):
//   Upload:  ADMIN (qualsiasi) | USER (solo propri)
//   Lettura: ADMIN | USER (solo propri) | CLIENTE: nessun accesso

// ---------------------------------------------------------------------------
// STRUTTURA CARTELLE — Bootstrap
// ---------------------------------------------------------------------------

/**
 * Ottiene o crea la cartella radice MADE_EVENT_ROOT.
 */
function getRootFolder_() {
  var rootName = DRIVE_CONFIG.ROOT_FOLDER_NAME;
  var folders  = DriveApp.getFoldersByName(rootName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(rootName);
}

/**
 * Ottiene o crea una sottocartella per nome dentro un folder padre.
 */
function getOrCreateSubFolder_(parent, name) {
  var subs = parent.getFoldersByName(name);
  if (subs.hasNext()) return subs.next();
  return parent.createFolder(name);
}

/**
 * Assicura che esista la struttura completa per un tenant.
 * Crea: /ROOT/[tenant_id]/talent/ | /ROOT/[tenant_id]/eventi/ | /ROOT/[tenant_id]/system/log/
 * Ritorna le cartelle: { tenantFolder, talentFolder, eventiFolder, systemFolder }
 */
function ensureTenantFolders(tenantId) {
  var root         = getRootFolder_();
  var tenantFolder = getOrCreateSubFolder_(root, tenantId);
  var talentFolder = getOrCreateSubFolder_(tenantFolder, 'talent');
  var eventiFolder = getOrCreateSubFolder_(tenantFolder, 'eventi');
  var systemFolder = getOrCreateSubFolder_(tenantFolder, 'system');
  getOrCreateSubFolder_(systemFolder, 'log');

  return {
    root:          root,
    tenantFolder:  tenantFolder,
    talentFolder:  talentFolder,
    eventiFolder:  eventiFolder,
    systemFolder:  systemFolder
  };
}

/**
 * Assicura che esista la struttura cartelle per un talent specifico.
 * Crea: /ROOT/[tenant_id]/talent/[talent_profile_id]/cv/ | /foto/ | /documenti/
 * Ritorna { cvFolder, fotoFolder, documentiFolder }
 */
function ensureTalentFolders(tenantId, talentProfileId) {
  var folders       = ensureTenantFolders(tenantId);
  var profileFolder = getOrCreateSubFolder_(folders.talentFolder, talentProfileId);
  return {
    profileFolder:    profileFolder,
    cvFolder:         getOrCreateSubFolder_(profileFolder, 'cv'),
    fotoFolder:       getOrCreateSubFolder_(profileFolder, 'foto'),
    documentiFolder:  getOrCreateSubFolder_(profileFolder, 'documenti')
  };
}

/**
 * Assicura che esista la cartella per un evento.
 * Crea: /ROOT/[tenant_id]/eventi/[event_id]/
 */
function ensureEventFolder(tenantId, eventId) {
  var folders     = ensureTenantFolders(tenantId);
  return getOrCreateSubFolder_(folders.eventiFolder, eventId);
}

// ---------------------------------------------------------------------------
// UPLOAD DOCUMENTO TALENT
// ---------------------------------------------------------------------------

/**
 * Handler principale per upload documento talent.
 * Payload: { talent_profile_id, tipo_documento, file_base64, filename, mime_type }
 *
 * tipo_documento: 'cv' | 'foto' | 'carta_identita'
 *
 * Ritorna URL + metadati per aggiornare TALENT_PROFILE.data.documenti.
 *
 * Access control:
 *   - ADMIN/SUPER_ADMIN: può caricare documenti per qualsiasi talent
 *   - USER: può caricare solo per il proprio profilo
 *   - CLIENTE: nessun accesso
 */
function handleDocumentUpload(payload, auth) {
  // CLIENTE non può mai caricare documenti
  if (auth.role === ROLES.CLIENTE) {
    return errorResponse('AUTH_005', 'I clienti non possono caricare documenti');
  }

  var valid = requireFields(payload, ['talent_profile_id', 'tipo_documento', 'file_base64', 'filename']);
  if (valid) return valid;

  var validTipi = [
    'cv', 'foto', 'carta_identita',
    // Stessi tipo_documento del questionario (Section7) — area riservata talent
    'foto_busto', 'foto_intera', 'foto_extra',
    'doc_identita', 'doc_cf', 'attestato_haccp', 'attestato_sicurezza'
  ];
  if (validTipi.indexOf(payload.tipo_documento) === -1) {
    return errorResponse('VAL_002', 'tipo_documento deve essere uno di: ' + validTipi.join(', '), 'tipo_documento');
  }

  // Recupera profilo talent
  var profile = getEntityById(payload.talent_profile_id, auth.tenant_id);
  if (!profile || profile.type !== 'TALENT_PROFILE') {
    return errorResponse('SYS_002', 'Talent profile non trovato');
  }

  // USER può caricare solo per il proprio profilo
  if (auth.role === ROLES.USER) {
    var myProfile = findTalentProfileByUserId_(auth.user_id, auth.tenant_id);
    if (!myProfile || myProfile.entity_id !== profile.entity_id) {
      return errorResponse('AUTH_005', 'Puoi caricare documenti solo per il tuo profilo');
    }
  }

  // Determina versione corrente (per naming convention cv_[id]_v[N].[ext])
  var currentDocs = profile.data.documenti || {};
  var currentDoc  = currentDocs[payload.tipo_documento] || {};
  var version     = parseInt(currentDoc.version || 0) + 1;

  // Prepara filename con naming convention
  var ext          = getFileExtension_(payload.filename);
  var safeId       = payload.talent_profile_id.substring(0, 8);
  var ts           = Date.now();
  var storedName;

  if (payload.tipo_documento === 'cv') {
    storedName = 'cv_' + safeId + '_v' + version + (ext ? '.' + ext : '');
  } else if (payload.tipo_documento === 'foto') {
    storedName = 'foto_' + safeId + '_' + ts + (ext ? '.' + ext : '');
  } else {
    storedName = payload.tipo_documento + '_' + safeId + (ext ? '.' + ext : '');
  }

  // Upload su Drive
  try {
    var folders    = ensureTalentFolders(auth.tenant_id, payload.talent_profile_id);
    var targetFolder = getTipoFolder_(folders, payload.tipo_documento);

    var mimeType   = payload.mime_type || 'application/octet-stream';
    var fileBytes  = Utilities.base64Decode(payload.file_base64);
    var blob       = Utilities.newBlob(fileBytes, mimeType, storedName);
    var driveFile  = targetFolder.createFile(blob);

    // Rendi il file accessibile (view only) tramite link
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId  = driveFile.getId();
    var fileUrl = 'https://drive.google.com/file/d/' + fileId + '/view';

    var now = new Date().toISOString();

    // Aggiorna metadati in TALENT_PROFILE.data.documenti
    var docsMeta = profile.data.documenti || {};
    docsMeta[payload.tipo_documento] = {
      file_id:     fileId,
      url:         fileUrl,
      filename:    storedName,
      version:     version,
      uploaded_at: now,
      status:      'valid',
      mime_type:   mimeType
    };

    updateEntityData(
      payload.talent_profile_id,
      { documenti: docsMeta },
      auth.tenant_id,
      auth.user_id
    );

    // Aggiorna anche il campo shortcut nel TALENT_PROFILE (stesso nome campo del questionario)
    var shortcutField = payload.tipo_documento === 'cv'             ? 'cv_url'
                       : payload.tipo_documento === 'foto'          ? 'foto_url'
                       : payload.tipo_documento === 'carta_identita' ? null
                       : payload.tipo_documento + '_url';
    if (shortcutField) {
      updateEntityData(payload.talent_profile_id, { [shortcutField]: fileUrl }, auth.tenant_id, auth.user_id);
    }

    return successResponse({
      file_id:        fileId,
      url:            fileUrl,
      filename:       storedName,
      tipo_documento: payload.tipo_documento,
      version:        version,
      uploaded_at:    now
    });

  } catch (e) {
    logError_('DRIVE_MANAGER', 'document.upload', e.message, e.stack || '', auth.user_id, auth.tenant_id);
    return errorResponse('SYS_001', 'Errore durante l\'upload: ' + e.message);
  }
}

// ---------------------------------------------------------------------------
// GET DOCUMENTO (URL firmato o redirect)
// ---------------------------------------------------------------------------

/**
 * Recupera i metadati di un documento talent.
 * CLIENTE non ha accesso.
 */
function handleDocumentGet(payload, auth) {
  if (auth.role === ROLES.CLIENTE) {
    return errorResponse('AUTH_005', 'I clienti non hanno accesso ai documenti');
  }

  var valid = requireFields(payload, ['talent_profile_id', 'tipo_documento']);
  if (valid) return valid;

  var profile = getEntityById(payload.talent_profile_id, auth.tenant_id);
  if (!profile || profile.type !== 'TALENT_PROFILE') {
    return errorResponse('SYS_002', 'Talent profile non trovato');
  }

  // USER può vedere solo i propri documenti
  if (auth.role === ROLES.USER) {
    var myProfile = findTalentProfileByUserId_(auth.user_id, auth.tenant_id);
    if (!myProfile || myProfile.entity_id !== profile.entity_id) {
      return errorResponse('AUTH_005', 'Puoi accedere solo ai tuoi documenti');
    }
  }

  var docs = profile.data.documenti || {};
  var doc  = docs[payload.tipo_documento];

  if (!doc || !doc.file_id) {
    return errorResponse('SYS_002', 'Documento non trovato: ' + payload.tipo_documento);
  }

  // carta_identita: solo ADMIN/SUPER_ADMIN (dati Classe A per PRD BLOCK:SICUREZZA)
  if (payload.tipo_documento === 'carta_identita' && auth.role === ROLES.USER) {
    return errorResponse('AUTH_005', 'Accesso non consentito a questo tipo di documento');
  }

  return successResponse({ documento: doc });
}

// ---------------------------------------------------------------------------
// DELETE DOCUMENTO (soft — rimuove metadati, NON elimina da Drive)
// ---------------------------------------------------------------------------

function handleDocumentDelete(payload, auth) {
  // Solo ADMIN può eliminare documenti
  if (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SUPER_ADMIN) {
    return errorResponse('AUTH_005', 'Solo gli admin possono eliminare documenti');
  }

  var valid = requireFields(payload, ['talent_profile_id', 'tipo_documento']);
  if (valid) return valid;

  var profile = getEntityById(payload.talent_profile_id, auth.tenant_id);
  if (!profile || profile.type !== 'TALENT_PROFILE') {
    return errorResponse('SYS_002', 'Talent profile non trovato');
  }

  var docs = profile.data.documenti || {};
  if (!docs[payload.tipo_documento]) {
    return errorResponse('SYS_002', 'Documento non trovato: ' + payload.tipo_documento);
  }

  // Soft: marca come cancellato nei metadati (non tocca Drive)
  docs[payload.tipo_documento].status      = 'deleted';
  docs[payload.tipo_documento].deleted_at  = new Date().toISOString();
  docs[payload.tipo_documento].deleted_by  = auth.user_id;

  updateEntityData(payload.talent_profile_id, { documenti: docs }, auth.tenant_id, auth.user_id);

  return successResponse({ message: 'Documento rimosso dai metadati', tipo_documento: payload.tipo_documento });
}

// ---------------------------------------------------------------------------
// BOOTSTRAP STRUTTURA DRIVE PER TENANT (chiamato da admin)
// ---------------------------------------------------------------------------

/**
 * Crea/verifica la struttura Drive per il tenant corrente.
 * Ritorna gli ID delle cartelle create.
 */
function handleDriveSetup(payload, auth) {
  if (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SUPER_ADMIN) {
    return errorResponse('AUTH_005', 'Solo gli admin possono configurare Google Drive');
  }

  try {
    var tenantId = resolvedTenantId_(payload, auth);
    var folders  = ensureTenantFolders(tenantId);

    return successResponse({
      tenant_id:           tenantId,
      root_folder_id:      folders.root.getId(),
      tenant_folder_id:    folders.tenantFolder.getId(),
      talent_folder_id:    folders.talentFolder.getId(),
      eventi_folder_id:    folders.eventiFolder.getId(),
      system_folder_id:    folders.systemFolder.getId(),
      message:             'Struttura Drive verificata/creata con successo'
    });
  } catch (e) {
    logError_('DRIVE_MANAGER', 'drive.setup', e.message, e.stack || '', auth.user_id, auth.tenant_id);
    return errorResponse('SYS_001', 'Errore configurazione Drive: ' + e.message);
  }
}

// ---------------------------------------------------------------------------
// HELPERS PRIVATI
// ---------------------------------------------------------------------------

function getTipoFolder_(talentFolders, tipo) {
  switch (tipo) {
    case 'cv':             return talentFolders.cvFolder;
    case 'foto':
    case 'foto_busto':
    case 'foto_intera':
    case 'foto_extra':     return talentFolders.fotoFolder;
    case 'carta_identita': return talentFolders.documentiFolder;
    default:               return talentFolders.documentiFolder;
  }
}

function getFileExtension_(filename) {
  var parts = String(filename || '').split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}
