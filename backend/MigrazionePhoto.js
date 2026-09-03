// === MIGRAZIONE FOTO: registrazioni/ -> talent/[profileId]/foto/ ===
// Script standalone, da eseguire manualmente UNA VOLTA dal GAS Editor.
// NON fa parte della pipeline deployata — nessun endpoint la chiama.
//
// Cosa fa:
//   1. Mappa leadId -> profileId leggendo lo Sheet Entities (TALENT_PROFILE.data.lead_id)
//   2. Per ogni sottocartella [leadId] dentro REGISTRAZIONI_FOLDER_ID:
//      - risolve il profileId corrispondente
//      - cerca ricorsivamente (fino a 4 livelli) tutti i file .jpg/.jpeg/.png
//      - li sposta in talent/[profileId]/foto/ dentro TALENT_FOLDER_ID
//        (creando la struttura se non esiste, stesso pattern di ensureTalentFolders)
//   3. Stampa un report con Logger.log
//
// DRY_RUN = true di default: logga solo cosa farebbe, non sposta nulla.
// Imposta DRY_RUN = false SOLO dopo aver controllato il report in dry-run.

var DRY_RUN = false;

var REGISTRAZIONI_FOLDER_ID = '1iRnNCUWdDehJzvakDVSXmGeoZNh1mMiv';
var TALENT_FOLDER_ID        = '14jBNkv2O97p61SnK5qa_2dJZpTMyxsIs';

var IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png'];

function migrateFotoRegistrazioniATalent() {
  Logger.log('=== MIGRAZIONE FOTO — DRY_RUN=' + DRY_RUN + ' ===');

  var leadToProfileMap = buildLeadToProfileMap_();
  Logger.log('Mappa leadId -> profileId costruita: ' + Object.keys(leadToProfileMap).length + ' TALENT_PROFILE trovati.');

  var registrazioniFolder = DriveApp.getFolderById(REGISTRAZIONI_FOLDER_ID);
  var talentFolder        = DriveApp.getFolderById(TALENT_FOLDER_ID);

  var leadFolders = registrazioniFolder.getFolders();

  var report = {
    leadFoldersScanned: 0,
    leadSenzaProfilo:   [],
    filesToMove:        [],   // { leadId, profileId, filename, sourcePath, destPath }
    filesMoved:         0,
    errors:             []
  };

  while (leadFolders.hasNext()) {
    var leadFolder = leadFolders.next();
    var leadId     = leadFolder.getName();
    report.leadFoldersScanned++;

    var profileId = leadToProfileMap[leadId];
    if (!profileId) {
      report.leadSenzaProfilo.push(leadId);
      Logger.log('SALTATO — nessun TALENT_PROFILE trovato per leadId=' + leadId + ' (talent non ancora approvato o mai completato)');
      continue;
    }

    var imageFiles = [];
    collectImageFilesRecursive_(leadFolder, leadFolder.getName(), 4, imageFiles);

    if (imageFiles.length === 0) continue;

    var destFotoFolder = null;
    if (!DRY_RUN) {
      var profileFolder = getOrCreateSubFolder_(talentFolder, profileId);
      destFotoFolder     = getOrCreateSubFolder_(profileFolder, 'foto');
    }

    for (var i = 0; i < imageFiles.length; i++) {
      var entry = imageFiles[i];
      var destPathLabel = 'talent/' + profileId + '/foto/' + entry.file.getName();

      report.filesToMove.push({
        leadId:     leadId,
        profileId:  profileId,
        filename:   entry.file.getName(),
        sourcePath: entry.path,
        destPath:   destPathLabel
      });

      Logger.log((DRY_RUN ? '[DRY_RUN] SPOSTEREBBE: ' : 'SPOSTO: ') +
        entry.path + ' -> ' + destPathLabel);

      if (!DRY_RUN) {
        try {
          moveFileToFolder_(entry.file, destFotoFolder);
          report.filesMoved++;
        } catch (e) {
          var errMsg = 'ERRORE spostando ' + entry.file.getName() + ' (leadId=' + leadId + '): ' + e.message;
          Logger.log(errMsg);
          report.errors.push(errMsg);
        }
      }
    }
  }

  Logger.log('=== REPORT FINALE ===');
  Logger.log('Cartelle lead scansionate: ' + report.leadFoldersScanned);
  Logger.log('Lead senza TALENT_PROFILE (saltati): ' + report.leadSenzaProfilo.length +
    (report.leadSenzaProfilo.length ? ' -> ' + report.leadSenzaProfilo.join(', ') : ''));
  Logger.log('File immagine trovati/' + (DRY_RUN ? 'da spostare' : 'spostati') + ': ' + report.filesToMove.length);
  if (!DRY_RUN) {
    Logger.log('File effettivamente spostati con successo: ' + report.filesMoved);
    Logger.log('Errori: ' + report.errors.length + (report.errors.length ? ' -> ' + report.errors.join(' | ') : ''));
  }

  return report;
}

// --- Helpers ---

function buildLeadToProfileMap_() {
  var map = {};
  var rows = getAllRows('Entities');
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row.type !== 'TALENT_PROFILE') continue;
    var data = parseJSON(row.data);
    if (data && data.lead_id) {
      map[data.lead_id] = row.entity_id;
    }
  }
  return map;
}

function collectImageFilesRecursive_(folder, pathLabel, depth, out) {
  if (depth <= 0) return;

  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (isImageFile_(file.getName())) {
      out.push({ file: file, path: pathLabel + '/' + file.getName() });
    }
  }

  var subFolders = folder.getFolders();
  while (subFolders.hasNext()) {
    var sub = subFolders.next();
    collectImageFilesRecursive_(sub, pathLabel + '/' + sub.getName(), depth - 1, out);
  }
}

function isImageFile_(filename) {
  var ext = filename.split('.').pop().toLowerCase();
  return IMAGE_EXTENSIONS.indexOf(ext) !== -1;
}

function moveFileToFolder_(file, destFolder) {
  destFolder.addFile(file);
  var parents = file.getParents();
  while (parents.hasNext()) {
    var parent = parents.next();
    if (parent.getId() !== destFolder.getId()) {
      parent.removeFile(file);
    }
  }
}
