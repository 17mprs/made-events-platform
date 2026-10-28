// === CONFIG.JS — MADE EVENT Platform v1.0 ===
// Configurazione centralizzata: Spreadsheet ID, nomi fogli, parametri di sistema.

// ---------------------------------------------------------------------------
// DATABASE
// ---------------------------------------------------------------------------

var _SPREADSHEET_ID_FALLBACK = '1DFYW8ybbMiXuQOyHBV7CDw0anFIGIZ7LbM3oRu84pLI';

function getSpreadsheetId_() {
  try {
    return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || _SPREADSHEET_ID_FALLBACK;
  } catch (e) {
    return _SPREADSHEET_ID_FALLBACK;
  }
}

var SHEET_NAMES = {
  Tenants:      'Tenants',
  Users:        'Users',
  Entities:     'Entities',
  ActivityLog:  'ActivityLog',
  AccessLog:    'AccessLog',
  SystemConfig: 'SystemConfig',
  ErrorLog:     'ErrorLog',
  DeployLog:    'DeployLog'
};

// ---------------------------------------------------------------------------
// RUOLI (PRD BLOCK:RUOLI)
// ---------------------------------------------------------------------------

var ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN:       'ADMIN',
  USER:        'USER',
  CLIENTE:     'CLIENTE'
};

// ---------------------------------------------------------------------------
// STATI ENTITA' (PRD BLOCK:STATI)
// ---------------------------------------------------------------------------

var ENTITY_STATUS = {
  LEAD_TALENT: {
    PARTIAL:                     'PARTIAL',
    COMPLETED_PENDING_APPROVAL:  'COMPLETED_PENDING_APPROVAL',
    APPROVED:                    'APPROVED',
    REJECTED:                    'REJECTED'
  },
  TALENT_PROFILE: {
    PENDING_REVIEW: 'PENDING_REVIEW',
    APPROVED:       'APPROVED',
    ACTIVE:         'ACTIVE',
    INACTIVE:       'INACTIVE',
    REJECTED:       'REJECTED'
  },
  EVENT: {
    DRAFT:     'DRAFT',
    PLANNING:  'PLANNING',
    LIVE:      'LIVE',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  },
  SHIFT: {
    OPEN:      'OPEN',
    FULL:      'FULL',
    CLOSED:    'CLOSED',
    CANCELLED: 'CANCELLED'
  },
  APPLICATION: {
    INVITED:         'INVITED',
    PENDING:         'PENDING',
    DOCS_REQUESTED:  'DOCS_REQUESTED',
    DOCS_RECEIVED:   'DOCS_RECEIVED',
    APPROVED:        'APPROVED',
    REJECTED:        'REJECTED',
    WITHDRAWN:       'WITHDRAWN'
  },
  ASSIGNMENT: {
    // Approvato, posto occupato, in attesa del contratto firmato (non ancora confermato)
    AWAITING_SIGNATURE: 'AWAITING_SIGNATURE',
    CONFIRMED:   'CONFIRMED',
    CHECKED_IN:  'CHECKED_IN',
    CHECKED_OUT: 'CHECKED_OUT',
    VALIDATED:   'VALIDATED',
    PAID:        'PAID',
    CANCELLED:   'CANCELLED',
    NO_SHOW:     'NO_SHOW'
  },
  // Contratto talent: una riga per ogni generazione (versione). Vedi STATE_TRANSITIONS.CONTRATTO.
  CONTRATTO: {
    GENERATED: 'GENERATED',
    SENT:      'SENT',
    SIGNED:    'SIGNED',
    DECLINED:  'DECLINED',
    EXPIRED:   'EXPIRED',
    VOID:      'VOID'
  }
};

// Flusso contratto: invio → firma → conferma incarico
var CONTRACT_FLOW = {
  EXPIRY_DAYS:             7,                 // scadenza dalla data di invio
  REMINDER_AFTER_DAYS:     3,                 // primo (e unico) reminder al talent
  CODE_TTL_MS:             10 * 60 * 1000,    // validità del codice di firma
  CODE_MAX_ATTEMPTS:       3,                 // tentativi per codice
  CODE_RESEND_COOLDOWN_MS: 60 * 1000,         // attesa minima tra due richieste di codice
  CODE_MAX_REQUESTS:       5,                 // richieste di codice per contratto
  USER_AGENT_MAX_LEN:      300,
  REASON_MAX_LEN:          500,
  REMINDERS_PER_RUN:       40                 // tetto reminder per esecuzione del job
};

// ---------------------------------------------------------------------------
// SYSTEM CONFIG
// ---------------------------------------------------------------------------

var SYSTEM_CONFIG = {
  TOKEN_EXPIRY_MS:    8 * 60 * 60 * 1000,  // 8 ore
  RATE_LIMIT_PER_MIN: 60,
  PAGINATION_DEFAULT: 50,
  PAGINATION_MAX:     200,
  VERSION:            '1.0.0'
};

// ---------------------------------------------------------------------------
// RICHIESTA RECENSIONE GOOGLE
// ---------------------------------------------------------------------------

var GOOGLE_REVIEW_URL = 'https://g.page/r/CUuSrJDXdeCuEAE/review';
var REVIEW_REQUEST_COOLDOWN_DAYS = 30;

// ---------------------------------------------------------------------------
// GOOGLE DRIVE — struttura cartelle
// ---------------------------------------------------------------------------

var DRIVE_CONFIG = {
  ROOT_FOLDER_NAME: 'MADE_EVENT_ROOT'
};

// ---------------------------------------------------------------------------
// HELPERS SHEETS
// ---------------------------------------------------------------------------

function getSpreadsheet() {
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

function getSheet(sheetName) {
  var name = SHEET_NAMES[sheetName] || sheetName;
  var sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Foglio "' + name + '" non trovato');
  return sheet;
}
