// === SETUP.JS — MADE EVENT Platform v1.0 ===
// Bootstrap database: crea fogli con schema MADE EVENT, tenant default, primo SUPER_ADMIN.
// Eseguire UNA SOLA VOLTA da Editor GAS → Esegui → setupDatabase().

// ---------------------------------------------------------------------------
// SCRIPT PROPERTIES — chiavi scalabili per ID e URL di configurazione
// Eseguire una volta: Editor GAS → seleziona initScriptProperties → ▶ Esegui
// ---------------------------------------------------------------------------

function initScriptProperties() {
  var props = PropertiesService.getScriptProperties();
  var current = props.getProperties();

  var defaults = {
    SPREADSHEET_ID:       '12ITb5K_ZcskSFgLmpdWXvqqP2oh5cJ51KKhPq2PhlHQ',
    CONTRACT_TEMPLATE_ID: '1WyVn17-7Iaq3H5uF0DZPDN_DVC-KQPmFnU4bWbFNYgM',
    FRONTEND_URL:         'https://made-events-platform.vercel.app',
    NEWSLETTER_TIER1_FREQUENCY_DAYS: '7',
    NEWSLETTER_TIER1_LAST_SENT:      '',
    NEWSLETTER_TIER2_FREQUENCY_DAYS: '14',
    NEWSLETTER_TIER2_LAST_SENT:      '',
  };

  for (var key in defaults) {
    if (!current[key]) {
      props.setProperty(key, defaults[key]);
      Logger.log('Impostata: ' + key + ' = ' + defaults[key]);
    } else {
      Logger.log('Già presente: ' + key + ' = ' + current[key]);
    }
  }
  Logger.log('=== Script Properties inizializzate ===');
}

// ---------------------------------------------------------------------------
// SCHEMA FOGLI
// ---------------------------------------------------------------------------

var SHEET_HEADERS = {
  Tenants: [
    'tenant_id', 'name', 'product', 'slug', 'status',
    'created_at', 'updated_at',
    'deleted', 'deleted_at', 'deleted_by'
  ],
  Users: [
    'user_id', 'tenant_id', 'email', 'password_hash', 'role',
    'status', 'pwd_version',
    'created_at', 'last_login', 'updated_at',
    'deleted', 'deleted_at', 'deleted_by'
  ],
  Entities: [
    'entity_id', 'tenant_id', 'type', 'status', 'data',
    'created_by', 'created_at', 'updated_at',
    'deleted', 'deleted_at', 'deleted_by'
  ],
  ActivityLog: [
    'log_id', 'timestamp', 'level', 'module', 'action',
    'entity_type', 'entity_id', 'user_id', 'tenant_id',
    'old_status', 'new_status', 'old_value', 'new_value', 'note'
  ],
  AccessLog: [
    'log_id', 'timestamp', 'event_type', 'user_id', 'email',
    'tenant_id', 'detail'
  ],
  SystemConfig: [
    'config_id', 'scope', 'tenant_id', 'key', 'value', 'type'
  ],
  ErrorLog: [
    'error_id', 'timestamp', 'level', 'module', 'message',
    'stack', 'user_id', 'tenant_id', 'action'
  ],
  DeployLog: [
    'deploy_id', 'timestamp', 'version', 'note', 'deployed_by'
  ]
};

// ---------------------------------------------------------------------------
// ENTRY POINT
// ---------------------------------------------------------------------------

function setupDatabase() {
  var ss = getSpreadsheet();
  var created = [];
  var existing = [];

  // 1. Crea fogli mancanti con intestazioni
  for (var key in SHEET_NAMES) {
    var sheetName = SHEET_NAMES[key];
    var sheet = ss.getSheetByName(sheetName);

    if (sheet) {
      existing.push(sheetName);
      continue;
    }

    sheet = ss.insertSheet(sheetName);
    var headers = SHEET_HEADERS[key] || ['id', 'created_at'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a1a2e')
      .setFontColor('#ffffff');
    created.push(sheetName);
  }

  // 2. Rimuovi foglio default se esiste
  var defaultSheet = ss.getSheetByName('Foglio1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // 3. Crea tenant "Made Event"
  var tenantId = setupTenant_(ss);

  // 4. Crea primo utente SUPER_ADMIN
  setupAdmin_(ss, tenantId);

  // 5. Seed SystemConfig
  seedSystemConfig_(ss, tenantId);

  // 6. Scrivi prima riga DeployLog
  setupDeployLog_(ss);

  Logger.log('=== SETUP MADE EVENT PLATFORM COMPLETATO ===');
  Logger.log('Fogli creati:    ' + (created.length   > 0 ? created.join(', ')   : 'nessuno'));
  Logger.log('Fogli esistenti: ' + (existing.length  > 0 ? existing.join(', ')  : 'nessuno'));
  Logger.log('Tenant ID:       ' + tenantId);
}

// ---------------------------------------------------------------------------
// HELPERS PRIVATI
// ---------------------------------------------------------------------------

function setupTenant_(ss) {
  var tenantsSheet = ss.getSheetByName(SHEET_NAMES.Tenants);
  var data = tenantsSheet.getDataRange().getValues();
  var now = new Date();

  if (data.length > 1) {
    var tidIdx = data[0].indexOf('tenant_id');
    var existingId = String(data[1][tidIdx]);
    Logger.log('Tenant gia\' esistente, ID: ' + existingId);
    return existingId;
  }

  var tenantId = Utilities.getUuid();
  var headers = SHEET_HEADERS.Tenants;
  var row = {
    tenant_id:  tenantId,
    name:       'Made Event',
    product:    'MADE_EVENT_PLATFORM',
    slug:       'made-event',
    status:     'active',
    created_at: now,
    updated_at: now,
    deleted:    false,
    deleted_at: '',
    deleted_by: ''
  };
  tenantsSheet.appendRow(headers.map(function(h) {
    return row[h] !== undefined ? row[h] : '';
  }));
  Logger.log('Tenant creato: Made Event — ID: ' + tenantId);
  return tenantId;
}

function setupAdmin_(ss, tenantId) {
  var usersSheet = ss.getSheetByName(SHEET_NAMES.Users);
  var data = usersSheet.getDataRange().getValues();
  var adminEmail = 'admin@madeevent.it';
  var adminPwd   = 'Admin2024!';
  var now = new Date();

  if (data.length > 1) {
    var emailIdx = data[0].indexOf('email');
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][emailIdx]).toLowerCase() === adminEmail) {
        Logger.log('SUPER_ADMIN gia\' esistente: ' + adminEmail);
        return;
      }
    }
  }

  var headers = SHEET_HEADERS.Users;
  var row = {
    user_id:       Utilities.getUuid(),
    tenant_id:     tenantId,
    email:         adminEmail,
    password_hash: hashPassword(adminPwd),
    role:          ROLES.SUPER_ADMIN,
    status:        'active',
    pwd_version:   0,
    created_at:    now,
    last_login:    '',
    updated_at:    now,
    deleted:       false,
    deleted_at:    '',
    deleted_by:    ''
  };
  usersSheet.appendRow(headers.map(function(h) {
    return row[h] !== undefined ? row[h] : '';
  }));
  Logger.log('SUPER_ADMIN creato: ' + adminEmail + ' / ' + adminPwd);
}

function seedSystemConfig_(ss, tenantId) {
  var configSheet = ss.getSheetByName(SHEET_NAMES.SystemConfig);
  var data = configSheet.getDataRange().getValues();
  if (data.length > 1) {
    Logger.log('SystemConfig gia\' seeded, skip.');
    return;
  }

  // [scope, tenant_id, key, value, type]
  var defaults = [
    ['SYSTEM', '',        'auth.token_expiry_hours',      '8',            'number'],
    ['SYSTEM', '',        'auth.max_login_attempts',      '5',            'number'],
    ['SYSTEM', '',        'rate_limit.req_per_minute',    '60',           'number'],
    ['SYSTEM', '',        'reminder.enabled',             'false',        'boolean'],
    ['SYSTEM', '',        'gdpr.retention_months_talent', '36',           'number'],
    ['SYSTEM', '',        'gdpr.retention_months_events', '60',           'number'],
    ['SYSTEM', '',        'system.version',               SYSTEM_CONFIG.VERSION, 'string'],
    ['TENANT', tenantId,  'tenant.timezone',              'Europe/Rome',  'string'],
    ['TENANT', tenantId,  'tenant.overlap_check',         'warn',         'string'],
    ['TENANT', tenantId,  'tenant.shift_full_auto',       'true',         'boolean'],
    ['TENANT', tenantId,  'talent.min_score_apply',       '0',            'number'],
    ['TENANT', tenantId,  'talent.require_cv',            'true',         'boolean'],
    ['TENANT', tenantId,  'checkin.geolocation_required', 'false',        'boolean'],
    ['TENANT', tenantId,  'checkin.radius_meters',        '500',          'number'],
    ['FEATURE','',        'feature.messaging',            'false',        'boolean'],
    ['FEATURE','',        'feature.client_portal',        'false',        'boolean'],
    ['FEATURE','',        'feature.ai_matching',          'false',        'boolean'],
    ['FEATURE','',        'feature.geolocation',          'false',        'boolean'],
    ['FEATURE','',        'feature.advanced_analytics',   'false',        'boolean'],
    ['FEATURE','',        'feature.gdpr_export',          'false',        'boolean']
  ];

  var rows = defaults.map(function(d) {
    return [Utilities.getUuid(), d[0], d[1], d[2], d[3], d[4]];
  });
  configSheet.getRange(2, 1, rows.length, 6).setValues(rows);
  Logger.log('SystemConfig: ' + rows.length + ' configurazioni seeded.');
}

function setupDeployLog_(ss) {
  var deploySheet = ss.getSheetByName(SHEET_NAMES.DeployLog);
  var data = deploySheet.getDataRange().getValues();
  if (data.length > 1) return;

  var headers = SHEET_HEADERS.DeployLog;
  var row = {
    deploy_id:   Utilities.getUuid(),
    timestamp:   new Date(),
    version:     SYSTEM_CONFIG.VERSION,
    note:        'Setup iniziale database MADE EVENT Platform',
    deployed_by: 'system'
  };
  deploySheet.appendRow(headers.map(function(h) {
    return row[h] !== undefined ? row[h] : '';
  }));
}

// ---------------------------------------------------------------------------
// CLEAN USERS SHEET — rimuove righe corrotte e duplicati
// ---------------------------------------------------------------------------

/**
 * Pulisce il foglio Users rimuovendo:
 *   - righe con user_id === "UUID" (letterale, segnaposto non sostituito)
 *   - righe con tenant_id vuoto o === "0"
 *   - duplicati per email: mantiene solo il record con tenant_id corretto
 *     e created_at più recente; se più record hanno lo stesso tenant_id
 *     corretto, conserva il più recente.
 *
 * Eseguire: Editor GAS → seleziona "cleanUsersSheet" → ▶ Esegui → vedi log.
 */
function cleanUsersSheet() {
  var CORRECT_TENANT_ID = 'c29a68d0-2f1d-418d-84f6-c01f389af78d';

  var ss         = getSpreadsheet();
  var sheet      = ss.getSheetByName(SHEET_NAMES.Users);
  if (!sheet) { Logger.log('ERRORE: foglio Users non trovato'); return; }

  // Legge TUTTI i dati incluse le righe fisicamente presenti (anche deleted=true)
  var data    = sheet.getDataRange().getValues();
  if (data.length < 2) { Logger.log('Foglio Users vuoto — niente da fare'); return; }

  var headers     = data[0].map(function(h) { return String(h).trim(); });
  var userIdIdx   = headers.indexOf('user_id');
  var tenantIdx   = headers.indexOf('tenant_id');
  var emailIdx    = headers.indexOf('email');
  var createdIdx  = headers.indexOf('created_at');

  if (userIdIdx === -1 || tenantIdx === -1 || emailIdx === -1) {
    Logger.log('ERRORE: colonne obbligatorie mancanti (user_id / tenant_id / email)');
    return;
  }

  Logger.log('=== CLEAN USERS SHEET ===');
  Logger.log('Righe totali (header escluso): ' + (data.length - 1));

  // --- PASS 1: individua righe corrotte (user_id="UUID" o tenant_id vuoto/"0") ---
  var rowsToDelete = {};   // rowIndex (1-based, header=1) → motivo

  for (var i = 1; i < data.length; i++) {
    var uid    = String(data[i][userIdIdx]).trim();
    var tid    = String(data[i][tenantIdx]).trim();
    var email  = String(data[i][emailIdx]).trim().toLowerCase();

    if (uid === 'UUID' || uid === 'uuid') {
      rowsToDelete[i] = 'user_id letterale "UUID" — email: ' + email;
      continue;
    }
    if (tid === '' || tid === '0') {
      rowsToDelete[i] = 'tenant_id vuoto o "0" — email: ' + email;
      continue;
    }
  }

  // --- PASS 2: duplicati per email ---
  // Raggruppa righe valide (non già marcate) per email
  var emailMap = {};  // email → array di { rowIdx, tenantId, createdAt }

  for (var j = 1; j < data.length; j++) {
    if (rowsToDelete[j]) continue;
    var em  = String(data[j][emailIdx]).trim().toLowerCase();
    var tid2 = String(data[j][tenantIdx]).trim();
    var ca  = createdIdx !== -1 ? data[j][createdIdx] : '';
    if (!emailMap[em]) emailMap[em] = [];
    emailMap[em].push({ rowIdx: j, tenantId: tid2, createdAt: ca });
  }

  for (var em in emailMap) {
    var group = emailMap[em];
    if (group.length <= 1) continue;

    Logger.log('Email duplicata: ' + em + ' (' + group.length + ' record)');

    // Ordina: prima i record con tenant_id corretto, poi per created_at DESC
    group.sort(function(a, b) {
      var aCorrect = (a.tenantId === CORRECT_TENANT_ID) ? 1 : 0;
      var bCorrect = (b.tenantId === CORRECT_TENANT_ID) ? 1 : 0;
      if (bCorrect !== aCorrect) return bCorrect - aCorrect;
      // Stessa priorità: più recente prima
      var aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      var bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (isNaN(aDate)) aDate = 0;
      if (isNaN(bDate)) bDate = 0;
      return bDate - aDate;
    });

    // Conserva il primo (miglior candidato), elimina gli altri
    for (var k = 1; k < group.length; k++) {
      rowsToDelete[group[k].rowIdx] =
        'duplicato email ' + em + ' (tenant: ' + group[k].tenantId + ', conservato row ' + group[0].rowIdx + ')';
    }
  }

  // --- PASS 3: elimina le righe marcate (dal basso verso l'alto per non sfasare indici) ---
  var sortedRows = Object.keys(rowsToDelete).map(Number).sort(function(a, b) { return b - a; });

  if (sortedRows.length === 0) {
    Logger.log('Nessuna riga da eliminare — foglio già pulito.');
    Logger.log('=== FINE CLEAN ===');
    return;
  }

  Logger.log('Righe da eliminare: ' + sortedRows.length);
  for (var r = 0; r < sortedRows.length; r++) {
    var idx = sortedRows[r];
    Logger.log('  ELIMINA riga ' + (idx + 1) + ': ' + rowsToDelete[idx]);
    sheet.deleteRow(idx + 1);  // GAS è 1-based; idx è 0-based rispetto a data
  }

  Logger.log('Righe eliminate: ' + sortedRows.length);
  Logger.log('Righe rimanenti (header escluso): ' + (data.length - 1 - sortedRows.length));
  Logger.log('=== FINE CLEAN USERS SHEET ===');
}

// ---------------------------------------------------------------------------
// DEBUG — eseguire dall'Editor GAS per diagnosticare problemi di login
// ---------------------------------------------------------------------------

/**
 * Stampa nel log GAS lo stato dell'utente admin senza esporre l'hash completo.
 * Eseguire: Editor → seleziona "debugAdminLogin" → ▶ Esegui → vedi log.
 */
function debugAdminLogin() {
  var adminEmail = 'admin@madeevent.it';
  var adminPwd   = 'Admin2024!';

  Logger.log('=== DEBUG LOGIN ADMIN ===');

  // 1. Controlla foglio Users
  var ss = getSpreadsheet();
  var usersSheet = ss.getSheetByName(SHEET_NAMES.Users);
  if (!usersSheet) { Logger.log('ERRORE: foglio Users non trovato'); return; }
  var data = usersSheet.getDataRange().getValues();
  Logger.log('Righe nel foglio Users (header incluso): ' + data.length);
  if (data.length < 2) { Logger.log('PROBLEMA: foglio Users vuoto — esegui resetAdminPassword()'); return; }

  // 2. Cerca utente per email
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var emailIdx  = headers.indexOf('email');
  var hashIdx   = headers.indexOf('password_hash');
  var statusIdx = headers.indexOf('status');
  var deletedIdx = headers.indexOf('deleted');
  Logger.log('Indici colonne — email:' + emailIdx + ' password_hash:' + hashIdx + ' status:' + statusIdx);

  var found = null;
  for (var i = 1; i < data.length; i++) {
    if (deletedIdx !== -1 && String(data[i][deletedIdx]).toLowerCase() === 'true') continue;
    if (String(data[i][emailIdx]).toLowerCase().trim() === adminEmail) {
      found = data[i];
      break;
    }
  }

  if (!found) {
    Logger.log('PROBLEMA: utente admin@madeevent.it NON trovato nel foglio Users');
    Logger.log('Soluzione: esegui resetAdminPassword()');
    return;
  }

  Logger.log('Utente trovato!');
  Logger.log('Status: ' + String(found[statusIdx]));

  // 3. Verifica hash
  var storedHash = String(found[hashIdx]);
  Logger.log('Hash presente: ' + (storedHash.length > 0 ? 'SI (' + storedHash.length + ' chars)' : 'NO (vuoto)'));

  var computedHash = hashPassword(adminPwd);
  Logger.log('Hash calcolato ora: ' + computedHash.substring(0,8) + '...' + computedHash.substring(56));
  Logger.log('Hash nello sheet:   ' + (storedHash.length >= 8 ? storedHash.substring(0,8) + '...' + storedHash.substring(storedHash.length - 8) : storedHash));
  Logger.log('Corrispondenza: ' + (computedHash === storedHash ? 'SI ✓' : 'NO ✗'));

  if (computedHash !== storedHash) {
    Logger.log('PROBLEMA: hash non corrisponde — esegui resetAdminPassword()');
  } else {
    Logger.log('Hash OK — se il login fallisce, verifica la Web App deployment');
  }
  Logger.log('=== FINE DEBUG ===');
}

/**
 * Riscrive (o crea) l'utente SUPER_ADMIN con hash corretto.
 * Sicuro da eseguire più volte — se l'utente esiste, aggiorna solo l'hash e lo status.
 * Eseguire: Editor → seleziona "resetAdminPassword" → ▶ Esegui.
 */
function resetAdminPassword() {
  var adminEmail = 'admin@madeevent.it';
  var adminPwd   = 'Admin2024!';
  var newHash    = hashPassword(adminPwd);

  Logger.log('Hash calcolato per Admin2024!: ' + newHash);

  var ss = getSpreadsheet();
  var usersSheet = ss.getSheetByName(SHEET_NAMES.Users);
  if (!usersSheet) { Logger.log('ERRORE: foglio Users non trovato. Esegui prima setupDatabase()'); return; }

  var data    = usersSheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var emailIdx   = headers.indexOf('email');
  var hashIdx    = headers.indexOf('password_hash');
  var statusIdx  = headers.indexOf('status');
  var roleIdx    = headers.indexOf('role');
  var pwdVerIdx  = headers.indexOf('pwd_version');
  var deletedIdx = headers.indexOf('deleted');

  // Cerca utente esistente
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).toLowerCase().trim() === adminEmail) {
      // Aggiorna hash, status, role, pwd_version in place
      usersSheet.getRange(i + 1, hashIdx  + 1).setValue(newHash);
      usersSheet.getRange(i + 1, statusIdx + 1).setValue('active');
      usersSheet.getRange(i + 1, roleIdx   + 1).setValue(ROLES.SUPER_ADMIN);
      if (pwdVerIdx !== -1) usersSheet.getRange(i + 1, pwdVerIdx + 1).setValue(0);
      if (deletedIdx !== -1) usersSheet.getRange(i + 1, deletedIdx + 1).setValue(false);
      Logger.log('✓ Password aggiornata per ' + adminEmail);
      Logger.log('Prova ora il login con Admin2024!');
      return;
    }
  }

  // Utente non trovato — lo crea
  Logger.log('Utente non trovato — creazione in corso...');
  var tenantData = ss.getSheetByName(SHEET_NAMES.Tenants).getDataRange().getValues();
  var tenantId = tenantData.length > 1 ? String(tenantData[1][0]) : 'default';
  var now = new Date();
  var newRow = headers.map(function(h) {
    var map = {
      user_id:       Utilities.getUuid(),
      tenant_id:     tenantId,
      email:         adminEmail,
      password_hash: newHash,
      role:          ROLES.SUPER_ADMIN,
      status:        'active',
      pwd_version:   0,
      created_at:    now,
      last_login:    '',
      updated_at:    now,
      deleted:       false,
      deleted_at:    '',
      deleted_by:    ''
    };
    return map[h] !== undefined ? map[h] : '';
  });
  usersSheet.appendRow(newRow);
  Logger.log('✓ Utente SUPER_ADMIN creato: ' + adminEmail);
  Logger.log('Prova ora il login con Admin2024!');
}
