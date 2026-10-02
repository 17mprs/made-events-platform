// === ERRORALERTS.JS — MADE EVENT Platform ===
// Classificazione errori, ErrorRegistry (upsert per fingerprint) e alert.
//
//   ErrorLog (ogni riga) ──► classifyError_/priorityFor_ ──► ErrorRegistry
//   jobErrorAlerts   (ogni 5 min)   ERROR P1 non ancora notificati → 1 mail per fingerprint, dedup 60 min
//   jobErrorDigest   (ogni giorno 08:00) ERROR P2 non notificati → digest unico
//   jobErrorLogRetention (settimanale)  cancella da ErrorLog solo le righe INFO > 30 gg
//
// Solo severity ERROR genera alert. Un errore dell'alert stesso viene loggato WARN
// (mai ERROR) e non può ricorsivamente generare altri alert.

var ALERT_EMAIL_DEFAULT   = 'dev-alerts@oper-ia.it';
var ALERT_DEDUP_MS        = 60 * 60 * 1000;
var ALERT_SCAN_ROWS       = 500;    // righe finali di ErrorLog lette ad ogni run
var DIGEST_SCAN_ROWS      = 2000;
var ALERT_MAX_AGE_MS      = 7 * 24 * 60 * 60 * 1000;
var RETENTION_INFO_DAYS   = 30;

var ERROR_CLASSES = ['EMAIL_SEND', 'EMAIL_QUOTA', 'AUTH', 'DATA_INTEGRITY', 'DRIVE', 'PDF_CARD',
                     'JOB_TRIGGER', 'VALIDATION', 'EXTERNAL_API', 'UNKNOWN'];

var ERROR_REGISTRY_COLUMNS = ['fingerprint', 'error_class', 'priority', 'action', 'message_tipo',
  'first_seen', 'last_seen', 'occurrences', 'last_error_id', 'status', 'root_cause', 'fix_ref', 'note'];

// ---------------------------------------------------------------------------
// F3.1 CLASSIFICAZIONE
// ---------------------------------------------------------------------------

function classifyError_(module, action, message) {
  var m = String(module || '').toUpperCase();
  var a = String(action || '').toLowerCase();
  var t = String(message || '').toLowerCase();

  if (/credentials\.flag|credentials\.watchdog\.nouser/.test(a)) return 'DATA_INTEGRITY';
  if (/credentials\.watchdog\.exhausted/.test(a)) return 'EMAIL_SEND';
  if (/too many times|quota|daily limit|limite giornaliero/.test(t) &&
      (m === 'GMAIL' || /^mail\.|credential/.test(a))) return 'EMAIL_QUOTA';
  if (m === 'GMAIL' || a.indexOf('mail.') === 0 || /credentials/.test(a) || /gmailapp|mailapp/.test(t)) return 'EMAIL_SEND';
  if (m === 'AUTH' || /^auth\.|password|login/.test(a)) return 'AUTH';
  if (m === 'DRIVE_MANAGER' || /drive/.test(a) || /driveapp|drive\./.test(t)) return 'DRIVE';
  if (m === 'TALENT_CARD' || m === 'CONTRACT_MANAGER' || /card|contract|pdf/.test(a)) return 'PDF_CARD';
  if (m === 'JOBS' && (/^job|^daily\.|trigger|watchdog/.test(a) || /trigger/.test(t))) return 'JOB_TRIGGER';
  if (/urlfetch|webhook|http \d{3}/.test(t)) return 'EXTERNAL_API';
  if (/obbligator|non valid|invalid|validation|mancant|parse/.test(t + ' ' + a)) return 'VALIDATION';
  if (/non trovat|not found|duplic|integrit|collegat/.test(t)) return 'DATA_INTEGRITY';
  return 'UNKNOWN';
}

/**
 * P1 = credenziali, approvazione, reset password, registrazione, quota esaurita,
 * fallimento watchdog. Tutto il resto con severity ERROR = P2.
 */
function priorityFor_(errorClass, module, action) {
  if (errorClass === 'EMAIL_QUOTA') return 'P1';
  if (/credential|approv|password|reset|regist|watchdog/i.test(String(action || ''))) return 'P1';
  return 'P2';
}

// ---------------------------------------------------------------------------
// F3.2 ERRORREGISTRY
// ---------------------------------------------------------------------------

var _errorRegistryOk = false;

function getErrorRegistrySheet_() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('ErrorRegistry');
  if (!sheet) {
    sheet = ss.insertSheet('ErrorRegistry');
    sheet.getRange(1, 1, 1, ERROR_REGISTRY_COLUMNS.length).setValues([ERROR_REGISTRY_COLUMNS]);
    sheet.setFrozenRows(1);
  }
  _errorRegistryOk = true;
  return sheet;
}

/**
 * Upsert per fingerprint. Se la riga era FIXED → status REGRESSION.
 * @returns {{regression:boolean, occurrences:number, status:string}|null} null se fallisce (non lancia mai)
 */
function upsertErrorRegistry_(fingerprint, errorClass, priority, action, message, errorId, module) {
  try {
    var sheet = getErrorRegistrySheet_();
    var now = new Date();
    var last = sheet.getLastRow();
    var row = -1;
    if (last >= 2) {
      var fps = sheet.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < fps.length; i++) {
        if (String(fps[i][0]) === fingerprint) { row = i + 2; break; }
      }
    }
    if (row === -1) {
      var tipo = String(message || '').replace(/\d+/g, '#').substring(0, 200);
      // Errori di prova (module=TEST) non sono mai NEW: nascono già ACK.
      var initial = String(module || '').toUpperCase() === 'TEST' ? 'ACK' : 'NEW';
      sheet.appendRow([fingerprint, errorClass, priority, action, tipo, now, now, 1, errorId, initial, '', '', '']);
      return { regression: false, occurrences: 1, status: initial };
    }
    var cur = sheet.getRange(row, 1, 1, ERROR_REGISTRY_COLUMNS.length).getValues()[0];
    var status = String(cur[9] || 'NEW');
    var occ = (parseInt(cur[7], 10) || 0) + 1;
    var regression = status === 'FIXED';
    if (regression) {
      status = 'REGRESSION';
      sheet.getRange(row, 3).setValue('P1');
    }
    sheet.getRange(row, 7, 1, 4).setValues([[now, occ, errorId, status]]);
    return { regression: regression, occurrences: occ, status: status };
  } catch (e) {
    Logger.log('ErrorRegistry upsert failed: ' + e.message);
    return null;
  }
}

function getRegistryEntry_(fingerprint) {
  try {
    var sheet = getErrorRegistrySheet_();
    var last = sheet.getLastRow();
    if (last < 2) return null;
    var vals = sheet.getRange(2, 1, last - 1, ERROR_REGISTRY_COLUMNS.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) === fingerprint) {
        var o = { row: i + 2 };
        ERROR_REGISTRY_COLUMNS.forEach(function(c, j) { o[c] = vals[i][j]; });
        return o;
      }
    }
  } catch (e) {}
  return null;
}

// ---------------------------------------------------------------------------
// LETTURA ERRORLOG (con numero di riga)
// ---------------------------------------------------------------------------

function readErrorLogTail_(maxRows) {
  ensureErrorLogColumns_();
  var sheet = getSheet('ErrorLog');
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });
  var rows = [];
  if (lastRow >= 2) {
    var start = Math.max(2, lastRow - maxRows + 1);
    var vals = sheet.getRange(start, 1, lastRow - start + 1, lastCol).getValues();
    vals.forEach(function(v, i) {
      var d = {};
      headers.forEach(function(h, j) { if (h) d[h] = v[j]; });
      rows.push({ row: start + i, d: d });
    });
  }
  return { sheet: sheet, headers: headers, rows: rows };
}

function isPendingAlert_(d) {
  var sev = String(d.severity || d.level || '').toUpperCase();
  if (sev !== 'ERROR' || !d.fingerprint) return false;   // righe storiche (senza fingerprint) mai notificate
  if (!(d.alert_sent === false || String(d.alert_sent).toUpperCase() === 'FALSE')) return false;
  var ts = d.timestamp instanceof Date ? d.timestamp.getTime() : new Date(d.timestamp).getTime();
  return !isNaN(ts) && Date.now() - ts < ALERT_MAX_AGE_MS;
}

function markAlerted_(tail, rows) {
  var cSent = tail.headers.indexOf('alert_sent') + 1;
  var cAt   = tail.headers.indexOf('alert_sent_at') + 1;
  var now = new Date();
  rows.forEach(function(r) {
    tail.sheet.getRange(r.row, cSent).setValue(true);
    tail.sheet.getRange(r.row, cAt).setValue(now);
  });
}

function groupByFingerprint_(rows) {
  var groups = {};
  var order = [];
  rows.forEach(function(r) {
    var fp = r.d.fingerprint;
    if (!groups[fp]) { groups[fp] = []; order.push(fp); }
    groups[fp].push(r);
  });
  return order.map(function(fp) { return { fingerprint: fp, rows: groups[fp] }; });
}

// ---------------------------------------------------------------------------
// F3.3 ALERT
// ---------------------------------------------------------------------------

function getAlertEmail_() {
  return PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL') || ALERT_EMAIL_DEFAULT;
}

function loadAlertDedup_() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty('alert_dedup') || '{}');
  } catch (e) { return {}; }
}

function saveAlertDedup_(map) {
  var cutoff = Date.now() - 24 * 60 * 60 * 1000;
  Object.keys(map).forEach(function(k) { if (map[k] < cutoff) delete map[k]; });
  PropertiesService.getScriptProperties().setProperty('alert_dedup', JSON.stringify(map));
}

function oneLine_(s, max) {
  return String(s || '').replace(/\s+/g, ' ').trim().substring(0, max);
}

function sheetLink_(sheet, row) {
  try {
    return 'https://docs.google.com/spreadsheets/d/' + getSpreadsheet().getId() + '/edit#gid=' + sheet.getSheetId() + '&range=A' + row;
  } catch (e) { return ''; }
}

var MAIL_DAILY_LIMIT_DEFAULT = 100;   // Gmail consumer; override con Script Property MAIL_DAILY_LIMIT (es. 1500 Workspace)

/** Quota mail in forma leggibile: "73/100 · ultimo invio: 08:14 (rimasti 74)". */
function currentMailQuotaInfo_() {
  var live = null;
  try { live = MailApp.getRemainingDailyQuota(); } catch (e) {}
  var props = PropertiesService.getScriptProperties();
  var limit = parseInt(props.getProperty('MAIL_DAILY_LIMIT') || '', 10) || MAIL_DAILY_LIMIT_DEFAULT;
  var text = live === null ? 'non disponibile (scope send_mail non autorizzato?)' : live + '/' + limit;
  try {
    var last = JSON.parse(props.getProperty('mail_quota_last') || 'null');
    if (last && last.at) {
      var hhmm = Utilities.formatDate(new Date(last.at), 'Europe/Rome', 'HH:mm');
      text += ' · ultimo invio: ' + hhmm + (last.left !== null && last.left !== undefined ? ' (rimasti ' + last.left + ')' : '');
    }
  } catch (e) {}
  return { live: live, limit: limit, text: text };
}

/** Riga "azione consigliata" in base a classe/action. */
function recommendedAction_(f) {
  var a = String(f.action || '');
  if (/^mail\.send\.WELCOME_CREDENTIALS|^talent\.credentials|credentials\.watchdog/.test(a) && f.error_class !== 'EMAIL_QUOTA') {
    return 'Apri il profilo talent in admin → Reinvia accesso. Controlla l\'email del talent.';
  }
  if (f.error_class === 'EMAIL_QUOTA') {
    return 'Quota esaurita: i solleciti si fermano, le mail transazionali hanno la riserva. Verifica i consumi di oggi.';
  }
  if (a === 'doPost.parse') {
    return 'Richiesta malformata, probabile bot/scan. Ignorare se isolata.';
  }
  if (/^mail\.send\.PASSWORD_RESET/.test(a)) {
    return 'Il reset password non è partito: verifica l\'email dell\'utente e riprova dal login.';
  }
  return 'Apri la riga ErrorLog (link sotto).';
}

/**
 * Contesto umano per TALENT_PROFILE / LEAD_TALENT: nome cognome + email mascherata.
 * Mai password, token o altri campi. Non lancia.
 */
function entityContext_(f) {
  try {
    if (!f.entity_id || (f.entity_type !== 'TALENT_PROFILE' && f.entity_type !== 'LEAD_TALENT')) return '';
    var e = getEntityById(f.entity_id, null);
    if (!e || !e.data) return '';
    var nome = ((e.data.nome || '') + ' ' + (e.data.cognome || '')).trim();
    var email = maskEmail_(e.data.email || e.data.email_contatto || '');
    return [nome, email].filter(Boolean).join(' · ');
  } catch (err) { return ''; }
}

/** APP_VERSION/APP_BUILD sono in Version.js (scritto da scripts/deploy-backend.sh). */
function appVersionText_() {
  var v = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '?';
  var b = (typeof APP_BUILD !== 'undefined' && APP_BUILD) ? ' (' + APP_BUILD + ')' : '';
  return v + b;
}

/** Webhook secondario (GHL). Script Property GHL_ALERT_WEBHOOK; vuota = salta senza errore. */
function sendAlertWebhook_(payload) {
  var url = PropertiesService.getScriptProperties().getProperty('GHL_ALERT_WEBHOOK');
  if (!url) return { ok: false, skipped: true };
  try {
    var resp = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    return { ok: code >= 200 && code < 300, code: code };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Canale primario email (priorità alta, ignora la riserva quota), secondario webhook.
 * Non genera mai un ERROR: i fallimenti sono WARN throttlati a 1/ora.
 */
function sendAlertChannel_(subject, html, text, webhookPayload) {
  var quota = null;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (e) {}
  var mail = { ok: false, error: 'QUOTA_ZERO' };
  if (quota === null || quota > 0) {
    mail = sendEmail_(getAlertEmail_(), subject, html, text,
      { mailType: 'ERROR_ALERT', priority: true, rawSubject: true, suppressAlert: true });
  }
  if (mail.ok) return { ok: true, channel: 'email' };

  var wh = sendAlertWebhook_(webhookPayload);
  if (wh.ok) return { ok: true, channel: 'webhook' };

  var props = PropertiesService.getScriptProperties();
  var lastWarn = parseInt(props.getProperty('alert_fail_warn_at') || '0', 10);
  if (Date.now() - lastWarn > ALERT_DEDUP_MS) {
    props.setProperty('alert_fail_warn_at', String(Date.now()));
    logError_({ severity: 'WARN', module: 'ALERTS', action: 'alert.send',
      message: 'Alert non consegnato (email: ' + mail.error + '; webhook: ' + (wh.skipped ? 'non configurato' : (wh.error || wh.code)) + ')' });
  }
  return { ok: false, channel: 'none' };
}

function alertFieldsOf_(d) {
  return {
    error_id: d.error_id, timestamp: d.timestamp instanceof Date ? d.timestamp.toISOString() : String(d.timestamp),
    error_class: d.error_class || 'UNKNOWN', priority: d.priority || 'P2', severity: d.severity || d.level,
    module: d.module, action: d.action, entity_type: d.entity_type, entity_id: d.entity_id,
    actor: d.actor || d.user_id, tenant_id: (String(d.tenant_id).toUpperCase() === 'UUID' ? '' : d.tenant_id), message: d.message, stack: d.stack,
    input: d.input, deployment_id: d.deployment_id, fingerprint: d.fingerprint
  };
}

function htmlRow_(k, v) {
  return '<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;white-space:nowrap;">' + escapeHtml_(k) +
    '</td><td style="padding:4px 0;"><code style="white-space:pre-wrap;word-break:break-word;">' + escapeHtml_(String(v === undefined || v === null ? '' : v)) + '</code></td></tr>';
}

function sendP1Alert_(group, tail, opts) {
  opts = opts || {};
  var latest = group.rows[group.rows.length - 1];
  var f = alertFieldsOf_(latest.d);
  var reg = getRegistryEntry_(group.fingerprint);
  var quota = currentMailQuotaInfo_();
  var batchCount = group.rows.length;
  var total = reg ? reg.occurrences : batchCount;
  var isTest = String(f.module).toUpperCase() === 'TEST';
  var human = entityContext_(f);

  var msg = (opts.note ? opts.note + ' — ' : '') + oneLine_(f.message, 80);
  var subject = (isTest ? '[TEST]' : '') + '[MADE EVENTS][P1][' + f.error_class + '] ' + f.action + ' — ' + msg;
  var linkLog = sheetLink_(tail.sheet, latest.row);
  var linkReg = reg ? sheetLink_(getErrorRegistrySheet_(), reg.row) : '';

  var lines = [
    ['azione consigliata', opts.note ? opts.note + '. ' + recommendedAction_(f) : recommendedAction_(f)],
    ['error_id', f.error_id], ['timestamp', f.timestamp], ['classe', f.error_class], ['priorità', 'P1' + (opts.note ? ' (escalation)' : '')],
    ['severity', f.severity], ['module', f.module], ['action', f.action],
    ['entity', (f.entity_type || '') + ' ' + (f.entity_id || '')]
  ];
  if (human) lines.push(['persona', human]);
  lines = lines.concat([
    ['actor', f.actor], ['tenant_id', f.tenant_id],
    ['messaggio', f.message], ['stack', f.stack], ['input (sanificato)', f.input],
    ['versione / deployment', appVersionText_() + ' · ' + f.deployment_id], ['fingerprint', f.fingerprint],
    ['quota mail residua', quota.text],
    ['occorrenze (in questo avviso / totali)', batchCount + ' / ' + total],
    ['stato registry', reg ? reg.status : ''],
    ['riga ErrorLog', linkLog], ['riga ErrorRegistry', linkReg]
  ]);
  var html = '<table style="font-family:Arial,sans-serif;font-size:13px;border-collapse:collapse;">' +
    lines.map(function(l) { return htmlRow_(l[0], l[1]); }).join('') + '</table>';
  var text = lines.map(function(l) { return l[0] + ': ' + l[1]; }).join('\n');

  var payload = alertFieldsOf_(latest.d);
  payload.source = 'MADE EVENTS'; payload.subject = subject; payload.occurrences = batchCount; payload.occurrences_total = total;
  payload.recommended_action = lines[0][1]; payload.person = human; payload.app_version = appVersionText_();
  payload.quota = quota.text; payload.link_errorlog = linkLog; payload.link_registry = linkReg;
  return sendAlertChannel_(subject, html, text, payload);
}

// Errori P2 che diventano P1 solo oltre una soglia di frequenza (anti-rumore: scan/bot).
var ALERT_ESCALATIONS = {
  'doPost.parse': { threshold: 20, windowMs: 60 * 60 * 1000, note: 'Possibile scan/attacco' }
};

function jobErrorAlerts() {
  try {
    var tail = readErrorLogTail_(ALERT_SCAN_ROWS);
    var dedup = loadAlertDedup_();
    var now = Date.now();

    var pending = tail.rows.filter(function(r) { return isPendingAlert_(r.d) && String(r.d.priority) === 'P1'; });
    groupByFingerprint_(pending).forEach(function(g) {
      var lastAt = dedup[g.fingerprint];
      if (lastAt && now - lastAt < ALERT_DEDUP_MS) return;   // le righe restano non notificate: finiscono nel prossimo avviso, col conteggio
      var res = sendP1Alert_(g, tail);
      if (res.ok) {
        markAlerted_(tail, g.rows);
        dedup[g.fingerprint] = now;
      }
    });

    // Escalation P2 → P1 per frequenza (es. doPost.parse >= 20 nell'ultima ora): una sola mail all'ora.
    var byFp = {};
    tail.rows.forEach(function(r) {
      var cfg = ALERT_ESCALATIONS[String(r.d.action)];
      var sev = String(r.d.severity || r.d.level).toUpperCase();
      if (!cfg || sev !== 'ERROR' || !r.d.fingerprint) return;
      var ts = r.d.timestamp instanceof Date ? r.d.timestamp.getTime() : new Date(r.d.timestamp).getTime();
      if (isNaN(ts) || now - ts > cfg.windowMs) return;
      (byFp[r.d.fingerprint] = byFp[r.d.fingerprint] || { cfg: cfg, rows: [] }).rows.push(r);
    });
    Object.keys(byFp).forEach(function(fp) {
      var g = byFp[fp];
      var key = 'esc_' + fp;
      if (g.rows.length < g.cfg.threshold) return;
      if (dedup[key] && now - dedup[key] < ALERT_DEDUP_MS) return;
      var res = sendP1Alert_({ fingerprint: fp, rows: g.rows }, tail,
        { note: g.cfg.note + ' (' + g.rows.length + ' in 1h)' });
      if (res.ok) {
        markAlerted_(tail, g.rows.filter(function(r) { return isPendingAlert_(r.d); }));
        dedup[key] = now;
      }
    });

    saveAlertDedup_(dedup);
  } catch (e) {
    Logger.log('[ALERTS] jobErrorAlerts: ' + e.message);
    logError_({ severity: 'WARN', module: 'ALERTS', action: 'jobErrorAlerts', message: e.message, stack: e.stack });
  }
}

/** Trigger giornaliero 08:00 (Europe/Rome): digest unico degli ERROR P2 non notificati. */
function jobErrorDigest() {
  runErrorDigest_({});
}

/** Come jobErrorDigest ma include anche gli errori module=TEST (per provare il digest a mano). */
function testErrorDigest() {
  runErrorDigest_({ includeTest: true });
}

function runErrorDigest_(opts) {
  try {
    var tail = readErrorLogTail_(DIGEST_SCAN_ROWS);
    var pending = tail.rows.filter(function(r) { return isPendingAlert_(r.d) && String(r.d.priority) !== 'P1'; });
    if (!opts.includeTest) {
      // Gli errori di prova non entrano nel digest: vengono solo chiusi, senza mail.
      var testRows = pending.filter(function(r) { return String(r.d.module).toUpperCase() === 'TEST'; });
      if (testRows.length) markAlerted_(tail, testRows);
      pending = pending.filter(function(r) { return String(r.d.module).toUpperCase() !== 'TEST'; });
    }
    if (!pending.length) return;

    var groups = groupByFingerprint_(pending);
    var items = groups.map(function(g) {
      var latest = g.rows[g.rows.length - 1];
      var f = alertFieldsOf_(latest.d);
      var reg = getRegistryEntry_(g.fingerprint);
      return { f: f, count: g.rows.length, total: reg ? reg.occurrences : g.rows.length,
               status: reg ? reg.status : '', link: sheetLink_(tail.sheet, latest.row) };
    });
    items.sort(function(a, b) { return b.count - a.count; });

    var subject = '[MADE EVENTS][P2][DIGEST] ' + pending.length + ' errori (' + items.length + ' tipi) nelle ultime 24h';
    var html = '<p style="font-family:Arial,sans-serif;font-size:13px;">Digest errori P2 — ' + escapeHtml_(new Date().toISOString()) + '</p>' +
      items.map(function(it) {
        return '<table style="font-family:Arial,sans-serif;font-size:13px;border-collapse:collapse;margin:0 0 16px;border-top:1px solid #ddd;">' +
          [['azione consigliata', recommendedAction_(it.f)], ['classe', it.f.error_class], ['action', it.f.action], ['messaggio', it.f.message],
           ['entity', (it.f.entity_type || '') + ' ' + (it.f.entity_id || '')], ['persona', entityContext_(it.f)], ['actor', it.f.actor],
           ['occorrenze (digest / totali)', it.count + ' / ' + it.total], ['stato registry', it.status],
           ['ultimo error_id', it.f.error_id], ['timestamp ultimo', it.f.timestamp], ['stack', it.f.stack],
           ['input (sanificato)', it.f.input], ['versione / deployment', appVersionText_() + ' · ' + it.f.deployment_id], ['fingerprint', it.f.fingerprint],
           ['riga ErrorLog', it.link]
          ].map(function(l) { return htmlRow_(l[0], l[1]); }).join('') + '</table>';
      }).join('');
    var text = items.map(function(it) {
      return [it.f.error_class + ' ' + it.f.action, it.f.message, 'occorrenze: ' + it.count + '/' + it.total,
              'entity: ' + it.f.entity_type + ' ' + it.f.entity_id, 'error_id: ' + it.f.error_id, it.link].join('\n');
    }).join('\n\n');

    var res = sendAlertChannel_(subject, html, text, {
      source: 'MADE EVENTS', priority: 'P2', digest: true, subject: subject,
      items: items.map(function(it) { return { f: it.f, occurrences: it.count, occurrences_total: it.total, link: it.link }; })
    });
    if (res.ok) markAlerted_(tail, pending);
  } catch (e) {
    Logger.log('[ALERTS] runErrorDigest_: ' + e.message);
    logError_({ severity: 'WARN', module: 'ALERTS', action: 'jobErrorDigest', message: e.message, stack: e.stack });
  }
}

// ---------------------------------------------------------------------------
// RETENTION — solo righe INFO > 30 giorni; ERROR e WARN non si cancellano mai
// ---------------------------------------------------------------------------

function jobErrorLogRetention() {
  try {
    var sheet = getSheet('ErrorLog');
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); });
    var cTs = headers.indexOf('timestamp');
    var cLevel = headers.indexOf('level');
    var cSev = headers.indexOf('severity');
    if (cTs === -1) return;

    var vals = sheet.getDataRange().getValues();
    var cutoff = Date.now() - RETENTION_INFO_DAYS * 24 * 60 * 60 * 1000;
    var doomed = [];
    for (var i = 1; i < vals.length; i++) {
      var sev = String((cSev !== -1 && vals[i][cSev]) || (cLevel !== -1 && vals[i][cLevel]) || '').toUpperCase();
      if (sev !== 'INFO') continue;
      var ts = vals[i][cTs] instanceof Date ? vals[i][cTs].getTime() : new Date(vals[i][cTs]).getTime();
      if (!isNaN(ts) && ts < cutoff) doomed.push(i + 1);
    }
    // cancella dal fondo, accorpando le righe contigue
    var removed = 0;
    var t0 = Date.now();
    var end = doomed.length - 1;
    while (end >= 0 && Date.now() - t0 < 4 * 60 * 1000) {
      var start = end;
      while (start > 0 && doomed[start - 1] === doomed[start] - 1) start--;
      sheet.deleteRows(doomed[start], end - start + 1);
      removed += end - start + 1;
      end = start - 1;
    }
    logActivity({ level: 'INFO', module: 'ALERTS', action: 'errorlog.retention', note: 'righe INFO rimosse: ' + removed });
  } catch (e) {
    Logger.log('[ALERTS] jobErrorLogRetention: ' + e.message);
    logError_({ severity: 'WARN', module: 'ALERTS', action: 'jobErrorLogRetention', message: e.message, stack: e.stack });
  }
}

// ---------------------------------------------------------------------------
// TRIGGER
// ---------------------------------------------------------------------------

/** Installa (idempotente) alert ogni 5 min, digest 08:00 e retention settimanale. */
function setupAlertTriggers() {
  var handlers = ['jobErrorAlerts', 'jobErrorDigest', 'jobErrorLogRetention'];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (handlers.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('jobErrorAlerts').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('jobErrorDigest').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('jobErrorLogRetention').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(4).create();
  Logger.log('[ALERTS] Trigger alert (5 min), digest (08:00) e retention (domenica 04:00) installati.');
}

// ---------------------------------------------------------------------------
// TEST MANUALE — forza un ERROR P1 e uno P2, poi esegue subito l'alert P1.
// Il digest P2 parte col trigger delle 08:00 (o lancia jobErrorDigest a mano).
// ---------------------------------------------------------------------------

function testForcedErrors() {
  logError_({ severity: 'ERROR', module: 'TEST', action: 'test.forcedP1', error_class: 'EMAIL_SEND', priority: 'P1',
    message: 'Errore di prova P1 (test.forcedP1)', input: { note: 'test', password: 'non-deve-comparire', recipient: 'mario.rossi@gmail.com' } });
  logError_({ severity: 'ERROR', module: 'TEST', action: 'test.forcedP2',
    message: 'Errore di prova P2 (test.forcedP2)' });
  jobErrorAlerts();
  Logger.log('P1 notificato (se la mail non è in dedup 60 min). Controlla ErrorLog, ErrorRegistry (status ACK, module=TEST) e dev-alerts. ' +
    'Gli errori TEST non entrano nel digest delle 08:00: per provare il digest lancia testErrorDigest().');
}

/**
 * Da eseguire UNA volta dall'editor GAS dopo il deploy: fa comparire la schermata di
 * consenso OAuth per lo scope script.send_mail (serve a MailApp.getRemainingDailyQuota,
 * usato dal quota guard e dagli alert). Senza consenso il guard resta disattivo.
 */
function authorizeMailScope() {
  Logger.log('Quota mail residua: ' + MailApp.getRemainingDailyQuota());
}
