// === GMAIL.JS — MADE EVENT Platform v1.0 ===
// Template email MVP per le automazioni sincrone (PRD BLOCK:INTEGRAZIONI).
//
// Template attivi MVP:
//   - credenziali nuovo utente (talent approvato)
//   - conferma approvazione talent
//   - dettagli assignment confermato (candidatura approvata)
//
// Limiti Gmail: 100/giorno (free) | 1.500/giorno (Workspace).
// Ogni invio è loggato. Errori non bloccano il flusso principale.

// ---------------------------------------------------------------------------
// CONFIGURAZIONE
// ---------------------------------------------------------------------------

var EMAIL_CONFIG = {
  FROM_NAME:    'MADE EVENTS',
  REPLY_TO:     'madeeventssrls@gmail.com',   // Override con config tenant se disponibile
  SUBJECT_PREFIX: '[MADE EVENTS] '
};

// Paragrafo di scuse per i talent del vecchio DB la cui registrazione non è
// arrivata a destinazione (import legacy 2026-09) — usato sia dall'invito
// iniziale (lead.importLegacy) sia dal reset solleciti (lead.resetSolleciti).
// {nome} viene sostituito col nome del talent prima dell'invio.
var LEGACY_APOLOGY_TEXT =
  'Ciao {nome}, nelle scorse settimane ti sei candidata/o come talent Made Events, ' +
  'ma per un problema tecnico la tua registrazione non è stata completata correttamente. ' +
  'Ci scusiamo per il disagio. I tuoi dati sono al sicuro: per completare il profilo e ' +
  'iniziare a ricevere proposte per i nostri eventi ti basta un clic.';

// ---------------------------------------------------------------------------
// SEND HELPER (unico punto di invio)
// ---------------------------------------------------------------------------

// Riserva di quota giornaliera: le mail NON prioritarie (newsletter, solleciti,
// import legacy, reminder) non possono consumare le ultime MAIL_QUOTA_RESERVE
// mail del giorno, che restano per credenziali / reset / approvazioni.
var MAIL_QUOTA_RESERVE = 30;
var _quotaWarnLogged = false;

// Contesto di invio impostato da withMailCtx_: permette ai punti di chiamata che
// usano i template sendXxxEmail() di attribuire l'eventuale errore a un'entità.
var _mailCtx = null;
function withMailCtx_(ctx, fn) {
  var prev = _mailCtx;
  _mailCtx = ctx;
  try { return fn(); } finally { _mailCtx = prev; }
}

/**
 * Invia un'email. Non lancia mai e NON ingoia gli errori: ogni fallimento
 * finisce in ErrorLog (destinatario mascherato) e l'esito è restituito.
 *
 * @param {object} [opts]
 *   mailType    etichetta per i log (es. 'WELCOME_CREDENTIALS')
 *   priority    true = transazionale: ignora la riserva quota
 *   entity_type, entity_id, actor, tenant_id — contesto per ErrorLog
 *   rawSubject  true = niente prefisso [MADE EVENTS] (alert interni)
 *   suppressAlert true = un fallimento è loggato solo WARN (mai ERROR): evita alert-di-alert
 * @returns {{ok:boolean, error:string, quotaLeft:(number|null)}}
 */
function sendEmail_(to, subject, bodyHtml, bodyText, opts) {
  opts = Object.assign({}, _mailCtx || {}, opts || {});
  var mailType = opts.mailType || 'GENERIC';
  var priority = opts.priority === true;
  var quotaLeft = null;

  function fail_(error, severity, stack) {
    logError_({
      severity:    opts.suppressAlert ? 'WARN' : severity,
      module:      opts.module || 'GMAIL',
      action:      'mail.send.' + mailType,
      entity_type: opts.entity_type,
      entity_id:   opts.entity_id,
      actor:       opts.actor,
      tenant_id:   opts.tenant_id,
      message:     'Invio ' + mailType + ' a ' + maskEmail_(to) + ' fallito: ' + error,
      stack:       stack || '',
      input:       { kind: mailType, subject: subject, recipient: maskEmail_(to), priority: priority, quotaLeft: quotaLeft }
    });
    return { ok: false, error: error, quotaLeft: quotaLeft };
  }

  if (!to || !isValidEmail(to)) {
    return fail_('INVALID_EMAIL', priority ? 'ERROR' : 'WARN');
  }

  try {
    quotaLeft = MailApp.getRemainingDailyQuota();
  } catch (qe) {
    quotaLeft = null; // controllo quota non disponibile: si prova comunque l'invio
  }

  if (!priority && quotaLeft !== null && quotaLeft <= MAIL_QUOTA_RESERVE) {
    // Una sola riga WARN per esecuzione, altrimenti un lotto riempie ErrorLog.
    if (_quotaWarnLogged) return { ok: false, error: 'QUOTA_RESERVE', quotaLeft: quotaLeft };
    _quotaWarnLogged = true;
    return fail_('QUOTA_RESERVE: residuo ' + quotaLeft + ' <= riserva ' + MAIL_QUOTA_RESERVE, 'WARN');
  }

  try {
    GmailApp.sendEmail(to, (opts.rawSubject ? '' : EMAIL_CONFIG.SUBJECT_PREFIX) + subject, bodyText || stripHtml_(bodyHtml), {
      htmlBody: bodyHtml,
      name:     EMAIL_CONFIG.FROM_NAME,
      replyTo:  EMAIL_CONFIG.REPLY_TO
    });
  } catch (e) {
    return fail_(String(e && e.message || e), 'ERROR', e && e.stack);
  }

  var left = quotaLeft !== null ? quotaLeft - 1 : null;
  try {
    PropertiesService.getScriptProperties().setProperty('mail_quota_last',
      JSON.stringify({ left: left, at: new Date().toISOString(), kind: mailType }));
  } catch (pe) {}
  if (priority) {
    logActivity({
      level: 'INFO', module: 'GMAIL', action: 'mail.sent.' + mailType,
      entity_type: opts.entity_type || '', entity_id: opts.entity_id || '',
      tenant_id: opts.tenant_id || '',
      note: 'to=' + maskEmail_(to) + ' quota_residua=' + left
    });
  }
  Logger.log('[GMAIL] ' + mailType + ' inviata a ' + maskEmail_(to) + ' | quota residua: ' + left);
  return { ok: true, error: '', quotaLeft: left };
}

/**
 * Fallback testo plain: rimuove tag HTML.
 */
function stripHtml_(html) {
  return String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// TEMPLATE SHELL CONDIVISO — usato da TUTTE le email di Gmail.js e Newsletter.js.
// Header bordeaux #630E33 + wordmark MADE EVENTS, corpo Arial neutro, footer
// grigio piccolo, max-width 600px centrato. opts è opzionale:
//   opts.headerColor — override colore header (usato solo da sendNoShowAlertEmail,
//                      alert admin intenzionalmente rosso, non un'eccezione al brand)
//   opts.footerExtra — HTML extra dopo la riga di footer standard (usato solo dalla
//                      newsletter per link disiscrizione + bottoni social, contenuto
//                      funzionalmente necessario che il footer minimale non può portare)
// ---------------------------------------------------------------------------

function buildEmailTemplate(title, subtitle, bodyHtml, opts) {
  opts = opts || {};
  var headerColor = opts.headerColor || '#630E33';
  var footerExtra = opts.footerExtra || '';

  return [
    '<!DOCTYPE html>',
    '<html lang="it"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#F6F6F6;font-family:Arial,sans-serif;">',

    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F6;padding:40px 16px;">',
    '<tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;">',

    // Header
    '<tr><td style="background:' + headerColor + ';padding:36px 48px;text-align:center;">',
    '<p style="margin:0 0 12px;font-family:\'Montserrat\',Arial,sans-serif;font-size:12px;letter-spacing:5px;text-transform:uppercase;color:#FFFFFF;font-weight:600;">MADE EVENTS</p>',
    title ? '<h1 style="margin:0;font-family:\'Montserrat\',Arial,sans-serif;font-size:22px;font-weight:400;letter-spacing:0.3px;color:#FFFFFF;line-height:1.3;">' + title + '</h1>' : '',
    '</td></tr>',

    // Subtitle (greeting, es. "Ciao Nome,")
    subtitle ? (
      '<tr><td style="padding:32px 48px 0;">' +
      '<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;font-weight:bold;">' + subtitle + '</p>' +
      '</td></tr>'
    ) : '',

    // Body
    '<tr><td style="padding:' + (subtitle ? '16px 48px 44px' : '44px 48px') + ';font-family:Arial,sans-serif;font-size:14px;color:#2E2E2E;line-height:1.7;">',
    bodyHtml,
    '</td></tr>',

    // Footer
    '<tr><td style="background:#FAFAFA;border-top:1px solid #EAEAEA;padding:20px 48px;">',
    '<p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#AAAAAA;letter-spacing:0.5px;">MADE EVENTS &mdash; Sistema automatico</p>',
    footerExtra,
    '</td></tr>',

    '</table>',
    '</td></tr></table>',
    '</body></html>'
  ].join('\n');
}

/**
 * CTA button coerente — sempre bordeaux #630E33, usato da ogni email col bottone.
 */
function buildEmailButton_(label, url) {
  return [
    '<table cellpadding="0" cellspacing="0" style="margin:24px 0;">',
    '<tr><td style="background:#630E33;border-radius:4px;">',
    '<a href="' + escapeHtml_(url) + '" style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">' + escapeHtml_(label) + '</a>',
    '</td></tr></table>'
  ].join('');
}

// ---------------------------------------------------------------------------
// TEMPLATE 1 — Credenziali nuovo utente (talent approvato)
// ---------------------------------------------------------------------------

/**
 * Invia email con credenziali di accesso al talent appena approvato.
 * @param {string} to          email del talent
 * @param {string} nome        nome del talent
 * @param {string} tempPassword password temporanea generata
 * @param {string} loginUrl    URL della piattaforma (opzionale)
 * @param {object} ctx         contesto log opzionale { entity_type, entity_id, actor, tenant_id }
 * @returns {{ok:boolean, error:string, quotaLeft:(number|null)}}
 */
function sendWelcomeEmail(to, nome, tempPassword, loginUrl, ctx) {
  var url = loginUrl || (getFrontendUrl() + '/login');

  var body = [
    '<p style="margin:0 0 20px;">Il tuo profilo è stato <strong>approvato</strong>. ',
    'Puoi ora accedere alla piattaforma e candidarti agli eventi.</p>',
    '<div style="background:#F5F5F5;border-radius:8px;padding:20px;margin:0 0 20px;">',
    '<p style="margin:0 0 8px;"><strong>Le tue credenziali di accesso:</strong></p>',
    '<p style="margin:4px 0;">Email: <code>' + escapeHtml_(to) + '</code></p>',
    '<p style="margin:4px 0;">Password temporanea: <code style="background:#EAEAEA;padding:2px 6px;border-radius:4px;">' + escapeHtml_(tempPassword) + '</code></p>',
    '</div>',
    '<p style="color:#C62828;font-size:13px;margin:0 0 8px;">⚠ Cambia la password al primo accesso.</p>',
    buildEmailButton_('Accedi alla piattaforma', url),
  ].join('');

  var html = buildEmailTemplate('Benvenuto/a!', 'Ciao ' + escapeHtml_(nome) + ',', body);

  var text = [
    'Benvenuto/a, ' + nome + '!',
    '',
    'Il tuo profilo MADE EVENTS è stato approvato.',
    'Puoi ora accedere alla piattaforma.',
    '',
    'Le tue credenziali:',
    'Email: ' + to,
    'Password temporanea: ' + tempPassword,
    '',
    'IMPORTANTE: cambia la password al primo accesso.',
    '',
    'Accedi qui: ' + url,
    '',
    '— MADE EVENTS'
  ].join('\n');

  return sendEmail_(to, 'Benvenuto! Le tue credenziali di accesso', html, text,
    Object.assign({ mailType: 'WELCOME_CREDENTIALS', priority: true }, ctx || {}));
}

// ---------------------------------------------------------------------------
// TEMPLATE 2 — Conferma approvazione profilo (senza credenziali, se USER già esiste)
// ---------------------------------------------------------------------------

function sendProfileApprovedEmail(to, nome, ctx) {
  var body = [
    '<p style="margin:0 0 16px;">Il tuo profilo talent è stato <strong>approvato</strong> dal team MADE EVENTS.</p>',
    '<p style="margin:0 0 8px;">Ora puoi:</p>',
    '<ul style="margin:0 0 8px;padding-left:20px;">',
    '<li>Visualizzare gli shift disponibili</li>',
    '<li>Candidarti agli eventi</li>',
    '<li>Gestire il tuo profilo e i tuoi documenti</li>',
    '</ul>',
  ].join('');

  var html = buildEmailTemplate('Profilo approvato ✓', 'Ciao ' + escapeHtml_(nome) + ',', body);

  return sendEmail_(to, 'Profilo approvato — Benvenuto nel team!', html, undefined,
    Object.assign({ mailType: 'PROFILE_APPROVED', priority: true }, ctx || {}));
}

// ---------------------------------------------------------------------------
// TEMPLATE 2a — Avviso modifica IBAN (talent) e notifica admin
// Transazionali di sicurezza: priority=true, ignorano la riserva quota.
// Mai l'IBAN nel testo.
// ---------------------------------------------------------------------------

function sendIbanChangedEmail(to, nome, ctx) {
  var body = [
    '<p style="margin:0 0 16px;">Il tuo <strong>IBAN</strong> nel profilo MADE EVENTS è stato modificato.</p>',
    '<p style="margin:0 0 16px;">Se sei stato tu, non devi fare nulla.</p>',
    '<p style="margin:0;">Se <strong>non riconosci</strong> questa modifica, rispondi subito a questa email: il team verificherà prima di qualsiasi pagamento.</p>'
  ].join('');
  var html = buildEmailTemplate('IBAN modificato', 'Ciao ' + escapeHtml_(nome) + ',', body);
  var text = 'Ciao ' + nome + ',\n\nIl tuo IBAN nel profilo MADE EVENTS è stato modificato.\nSe sei stato tu non devi fare nulla. Se non riconosci la modifica, rispondi subito a questa email.\n\n— MADE EVENTS';
  return sendEmail_(to, 'Il tuo IBAN è stato modificato', html, text,
    Object.assign({ mailType: 'IBAN_CHANGED', priority: true }, ctx || {})).ok;
}

function sendAdminFiscalAlertEmail(to, nome, cognome, motivi, ctx) {
  var items = (motivi || []).map(function(m) { return '<li>' + escapeHtml_(m) + '</li>'; }).join('');
  var body = [
    '<p style="margin:0 0 12px;">Dati fiscali aggiornati dal talent <strong>' + escapeHtml_(nome + ' ' + cognome) + '</strong>:</p>',
    '<ul style="margin:0 0 16px;padding-left:20px;">' + items + '</ul>',
    '<p style="margin:0 0 16px;">Verificare prima del prossimo pagamento.</p>',
    buildEmailButton_('Apri i talent', getFrontendUrl() + '/admin/talent')
  ].join('');
  var html = buildEmailTemplate('Attenzione: dati fiscali modificati', '', body);
  var text = 'Dati fiscali aggiornati dal talent ' + nome + ' ' + cognome + ': ' + (motivi || []).join('; ') + '. Verificare prima del prossimo pagamento.';
  return sendEmail_(to, 'Dati fiscali modificati — ' + nome + ' ' + cognome, html, text,
    Object.assign({ mailType: 'ADMIN_FISCAL_ALERT', priority: true }, ctx || {})).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 2c — Flusso contratto (invio, codice di firma, conferme, reminder, scadenza)
// Nessuna mail contiene allegati o token di accesso: il contratto si legge solo
// nel portale dopo il login. Il codice di firma è nel corpo, mai nell'oggetto.
// ---------------------------------------------------------------------------

/** Riquadro evento/turno comune alle mail del flusso contratto. */
function contractMailSummary_(eventData, shiftData) {
  eventData = eventData || {}; shiftData = shiftData || {};
  var dataFormatted   = formatDate_(shiftData.data);
  var orarioFormatted = (shiftData.orario_inizio || '') + (shiftData.orario_fine ? ' – ' + shiftData.orario_fine : '');
  return '<div style="background:#FDF2F5;border-left:4px solid #630E33;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;">' +
    '<p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#2E2E2E;">' + escapeHtml_(eventData.titolo || '') + '</p>' +
    (dataFormatted   ? '<p style="margin:4px 0;font-size:13px;color:#6B6B6B;">📅 ' + escapeHtml_(dataFormatted)   + '</p>' : '') +
    (orarioFormatted ? '<p style="margin:4px 0;font-size:13px;color:#6B6B6B;">🕒 ' + escapeHtml_(orarioFormatted) + '</p>' : '') +
    '</div>';
}

function sendContractToSignEmail(to, nome, eventData, shiftData, expiresAtIso, ctx) {
  var scad = formatDate_(expiresAtIso);
  var body = [
    '<p style="margin:0 0 16px;">Il contratto per il seguente incarico è pronto per la tua firma:</p>',
    contractMailSummary_(eventData, shiftData),
    '<p style="margin:0 0 16px;">Accedi al portale con le tue credenziali per leggerlo e firmarlo' + (scad ? ' <strong>entro ' + escapeHtml_(scad) + '</strong>' : '') + '. Per firmare riceverai un codice via email.</p>',
    '<p style="margin:0 0 20px;font-size:13px;color:#6B6B6B;">Per sicurezza questa email non contiene il contratto né un link di accesso diretto.</p>',
    buildEmailButton_('VAI AL PORTALE', getFrontendUrl() + '/portale')
  ].join('');
  var html = buildEmailTemplate('Contratto da firmare', 'Ciao ' + escapeHtml_(nome) + ',', body);
  var text = 'Ciao ' + nome + ',\n\nIl contratto per ' + ((eventData && eventData.titolo) || 'il tuo incarico') + ' è pronto per la tua firma' + (scad ? ' (entro ' + scad + ')' : '') + '.\nAccedi al portale con le tue credenziali: ' + getFrontendUrl() + '/portale\nPer firmare riceverai un codice via email.\n\n— MADE EVENTS';
  return sendEmail_(to, 'Contratto da firmare — ' + ((eventData && eventData.titolo) || 'MADE EVENTS'), html, text,
    Object.assign({ mailType: 'CONTRACT_TO_SIGN', priority: true }, ctx || {})).ok;
}

function sendContractCodeEmail(to, nome, code, ctx) {
  var body = [
    '<p style="margin:0 0 16px;">Il tuo codice per firmare il contratto è:</p>',
    '<p style="margin:0 0 16px;font-size:28px;letter-spacing:6px;font-weight:bold;color:#630E33;">' + escapeHtml_(code) + '</p>',
    '<p style="margin:0 0 8px;">Vale <strong>10 minuti</strong>, con un massimo di 3 tentativi.</p>',
    '<p style="margin:0;font-size:13px;color:#6B6B6B;">Non condividerlo con nessuno. Se non hai chiesto tu di firmare, ignora questa email e avvisa il team.</p>'
  ].join('');
  var html = buildEmailTemplate('Codice di firma', 'Ciao ' + escapeHtml_(nome) + ',', body);
  var text = 'Ciao ' + nome + ',\n\nIl tuo codice per firmare il contratto: ' + code + '\nVale 10 minuti, massimo 3 tentativi. Non condividerlo.\nSe non hai chiesto tu di firmare, ignora questa email e avvisa il team.\n\n— MADE EVENTS';
  return sendEmail_(to, 'Codice per firmare il contratto', html, text,
    Object.assign({ mailType: 'CONTRACT_CODE', priority: true }, ctx || {})).ok;
}

function sendContractSignedEmail(to, nome, eventData, shiftData, ctx) {
  var body = [
    '<p style="margin:0 0 16px;">Hai firmato il contratto: il tuo incarico è <strong>confermato</strong>.</p>',
    contractMailSummary_(eventData, shiftData),
    '<p style="margin:0;font-size:13px;color:#6B6B6B;">Il giorno dell\'evento effettua il check-in dalla piattaforma al momento dell\'arrivo (disponibile 30 minuti prima dell\'inizio turno). Puoi rileggere il contratto firmato nel portale.</p>'
  ].join('');
  var html = buildEmailTemplate('Contratto firmato ✓', 'Ciao ' + escapeHtml_(nome) + ',', body);
  var text = 'Ciao ' + nome + ',\n\nHai firmato il contratto per ' + ((eventData && eventData.titolo) || 'il tuo incarico') + ': incarico confermato.\nPuoi rileggerlo nel portale.\n\n— MADE EVENTS';
  return sendEmail_(to, 'Contratto firmato — ' + ((eventData && eventData.titolo) || 'MADE EVENTS'), html, text,
    Object.assign({ mailType: 'CONTRACT_SIGNED', priority: true }, ctx || {})).ok;
}

function sendAdminContractSignedEmail(to, nome, cognome, eventData, shiftData, version, shaPrefix, ctx) {
  var body = [
    '<p style="margin:0 0 12px;">Il talent <strong>' + escapeHtml_(nome + ' ' + cognome) + '</strong> ha firmato il contratto (versione ' + escapeHtml_(String(version || '')) + ').</p>',
    contractMailSummary_(eventData, shiftData),
    '<p style="margin:0;font-size:12px;color:#6B6B6B;">Impronta del PDF (SHA-256, prime cifre): <code>' + escapeHtml_(shaPrefix || '') + '</code></p>'
  ].join('');
  var html = buildEmailTemplate('Contratto firmato', '', body);
  var text = 'Il talent ' + nome + ' ' + cognome + ' ha firmato il contratto (v' + version + ') per ' + ((eventData && eventData.titolo) || '') + '. Impronta PDF: ' + (shaPrefix || '');
  return sendEmail_(to, 'Contratto firmato — ' + nome + ' ' + cognome, html, text,
    Object.assign({ mailType: 'ADMIN_CONTRACT_SIGNED', priority: true }, ctx || {})).ok;
}

function sendAdminContractDeclinedEmail(to, nome, cognome, eventData, motivo, ctx) {
  var body = [
    '<p style="margin:0 0 12px;">Il talent <strong>' + escapeHtml_(nome + ' ' + cognome) + '</strong> ha <strong>rifiutato</strong> il contratto.</p>',
    contractMailSummary_(eventData, {}),
    motivo ? '<p style="margin:0 0 12px;"><strong>Motivo:</strong> ' + escapeHtml_(motivo) + '</p>' : '',
    '<p style="margin:0;font-size:13px;color:#6B6B6B;">La candidatura è stata ritirata e il posto è libero.</p>'
  ].join('');
  var html = buildEmailTemplate('Contratto rifiutato', '', body);
  var text = 'Il talent ' + nome + ' ' + cognome + ' ha rifiutato il contratto per ' + ((eventData && eventData.titolo) || '') + '.' + (motivo ? ' Motivo: ' + motivo : '') + ' Candidatura ritirata, posto libero.';
  return sendEmail_(to, 'Contratto rifiutato — ' + nome + ' ' + cognome, html, text,
    Object.assign({ mailType: 'ADMIN_CONTRACT_DECLINED', priority: true }, ctx || {})).ok;
}

/** Reminder (NON prioritario: rispetta la riserva quota). */
function sendContractReminderEmail(to, nome, eventData, expiresAtIso, ctx) {
  var scad = formatDate_(expiresAtIso);
  var body = [
    '<p style="margin:0 0 16px;">Hai ancora un contratto da firmare per questo incarico:</p>',
    contractMailSummary_(eventData, {}),
    '<p style="margin:0 0 20px;">' + (scad ? 'Scade il <strong>' + escapeHtml_(scad) + '</strong>: dopo quella data la candidatura torna in attesa e il posto può essere assegnato ad altri.' : 'Accedi al portale per firmarlo.') + '</p>',
    buildEmailButton_('VAI AL PORTALE', getFrontendUrl() + '/portale')
  ].join('');
  var html = buildEmailTemplate('Promemoria: contratto da firmare', 'Ciao ' + escapeHtml_(nome) + ',', body);
  var text = 'Ciao ' + nome + ',\n\nHai ancora un contratto da firmare per ' + ((eventData && eventData.titolo) || 'il tuo incarico') + (scad ? ' (scade il ' + scad + ')' : '') + '.\nPortale: ' + getFrontendUrl() + '/portale\n\n— MADE EVENTS';
  return sendEmail_(to, 'Promemoria: contratto da firmare — ' + ((eventData && eventData.titolo) || 'MADE EVENTS'), html, text,
    Object.assign({ mailType: 'CONTRACT_REMINDER', priority: false }, ctx || {})).ok;
}

function sendContractExpiredEmail(to, nome, eventData, ctx) {
  var body = [
    '<p style="margin:0 0 16px;">Il contratto per questo incarico è <strong>scaduto</strong> senza essere firmato:</p>',
    contractMailSummary_(eventData, {}),
    '<p style="margin:0;">La tua candidatura è tornata in attesa. Se sei ancora disponibile, contatta il team.</p>'
  ].join('');
  var html = buildEmailTemplate('Contratto scaduto', 'Ciao ' + escapeHtml_(nome) + ',', body);
  var text = 'Ciao ' + nome + ',\n\nIl contratto per ' + ((eventData && eventData.titolo) || 'il tuo incarico') + ' è scaduto senza firma. La candidatura è tornata in attesa: se sei ancora disponibile, contatta il team.\n\n— MADE EVENTS';
  return sendEmail_(to, 'Contratto scaduto — ' + ((eventData && eventData.titolo) || 'MADE EVENTS'), html, text,
    Object.assign({ mailType: 'CONTRACT_EXPIRED', priority: true }, ctx || {})).ok;
}

/** Un'unica mail riepilogativa all'admin per tutti i contratti scaduti nella stessa esecuzione del job. */
function sendAdminContractExpiredDigestEmail(to, items, ctx) {
  var li = (items || []).map(function(i) {
    return '<li>' + escapeHtml_(i.talent + ' — ' + i.evento) + '</li>';
  }).join('');
  var body = [
    '<p style="margin:0 0 12px;"><strong>' + (items || []).length + '</strong> contratti sono scaduti senza firma. Candidature tornate in attesa, posti liberati:</p>',
    '<ul style="margin:0 0 16px;padding-left:20px;">' + li + '</ul>'
  ].join('');
  var html = buildEmailTemplate('Contratti scaduti', '', body);
  var text = (items || []).length + ' contratti scaduti senza firma:\n' + (items || []).map(function(i) { return '- ' + i.talent + ' — ' + i.evento; }).join('\n');
  return sendEmail_(to, 'Contratti scaduti (' + (items || []).length + ')', html, text,
    Object.assign({ mailType: 'ADMIN_CONTRACT_EXPIRED', priority: true }, ctx || {})).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 2b — Richiesta recensione Google
// Policy Google: la richiesta deve essere neutra. NIENTE sconti, premi, compensi
// né condizionamento del voto ("solo se sei soddisfatto"). Non aggiungere nulla del genere.
// ---------------------------------------------------------------------------

/**
 * Builder UNICO di oggetto/HTML/testo: usato sia dall'anteprima admin sia dall'invio.
 * @returns {{subject:string, html:string, text:string}}  subject è quello finale (con prefisso)
 */
function buildReviewRequestEmail_(nome) {
  var n = String(nome || '').trim();
  var greeting = n ? 'Ciao ' + escapeHtml_(n) + ',' : 'Ciao,';
  var body = [
    '<p style="margin:0 0 16px;">grazie per aver lavorato con MADE EVENTS.</p>',
    '<p style="margin:0 0 16px;">Se ti va, dedicaci un minuto per lasciare una recensione sincera su Google: ',
    'racconta com\'è stata la tua esperienza con noi.</p>',
    buildEmailButton_('Lascia una recensione', GOOGLE_REVIEW_URL),
    '<p style="margin:24px 0 0;font-size:12px;color:#8A8A8A;">Non vuoi ricevere altre richieste di questo tipo? Rispondi a questa email e non ti scriveremo più.</p>'
  ].join('');
  var html = buildEmailTemplate('La tua opinione conta', greeting, body);
  var text = [
    n ? 'Ciao ' + n + ',' : 'Ciao,',
    '',
    'grazie per aver lavorato con MADE EVENTS.',
    '',
    'Se ti va, dedicaci un minuto per lasciare una recensione sincera su Google: racconta com\'è stata la tua esperienza con noi.',
    '',
    'Lascia una recensione: ' + GOOGLE_REVIEW_URL,
    '',
    'Non vuoi ricevere altre richieste di questo tipo? Rispondi a questa email e non ti scriveremo più.',
    '',
    '— MADE EVENTS'
  ].join('\n');
  return {
    subject: EMAIL_CONFIG.SUBJECT_PREFIX + 'Com\'è andata con MADE EVENTS? Raccontacelo in 1 minuto',
    html: html,
    text: text
  };
}

/**
 * Invia la richiesta di recensione. NON prioritaria: rispetta la riserva quota.
 * Reply-To e mittente sono quelli standard di sendEmail_.
 * @returns {{ok:boolean, error:string, quotaLeft:(number|null)}}
 */
function sendReviewRequestEmail(to, nome, ctx) {
  var m = buildReviewRequestEmail_(nome);
  return sendEmail_(to, m.subject, m.html, m.text,
    Object.assign({ mailType: 'REVIEW_REQUEST', priority: false, rawSubject: true }, ctx || {}));
}

// ---------------------------------------------------------------------------
// TEMPLATE 3 — Assignment confermato (candidatura approvata)
// ---------------------------------------------------------------------------

/**
 * Notifica il talent che la sua candidatura è stata approvata
 * e l'assignment è confermato.
 * @param {string} to               email del talent
 * @param {string} nome             nome del talent
 * @param {object} shiftData        dati dello shift (data, orario, location, ruolo...)
 * @param {string} assignmentId     UUID dell'assignment
 */
function sendAssignmentConfirmedEmail(to, nome, shiftData, assignmentId, eventData) {
  eventData = eventData || {};
  var dataFormatted    = formatDate_(shiftData.data);
  var orarioFormatted  = (shiftData.orario_inizio || '') + (shiftData.orario_fine ? ' – ' + shiftData.orario_fine : '');
  var luogoFormatted   = [eventData.luogo, eventData.citta].filter(Boolean).join(' — ');

  var body = [
    '<p style="margin:0 0 16px;">La tua candidatura è stata <strong>approvata</strong>. Sei ufficialmente assegnato/a al seguente turno:</p>',
    // Sezione evento
    eventData.titolo ? (
      '<div style="background:#FDF2F5;border-left:4px solid #630E33;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;">' +
      '<p style="margin:0 0 6px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#630E33;font-weight:bold;">Evento</p>' +
      '<p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#2E2E2E;">' + escapeHtml_(eventData.titolo) + '</p>' +
      (luogoFormatted ? '<p style="margin:4px 0;font-size:13px;color:#6B6B6B;">📍 ' + escapeHtml_(luogoFormatted) + '</p>' : '') +
      (eventData.compenso ? '<p style="margin:4px 0;font-size:13px;color:#6B6B6B;">💶 Compenso: <strong>' + escapeHtml_(String(eventData.compenso)) + '</strong></p>' : '') +
      '</div>'
    ) : '',
    // Sezione turno
    '<div style="background:#F5F5F5;border-radius:8px;padding:20px;margin:0 0 16px;">',
    '<p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6B6B6B;font-weight:bold;">Dettagli turno</p>',
    shiftData.ruolo    ? '<p style="margin:4px 0;"><strong>Ruolo:</strong> '         + escapeHtml_(shiftData.ruolo)         + '</p>' : '',
    '<p style="margin:4px 0;"><strong>Data:</strong> '                               + escapeHtml_(dataFormatted)           + '</p>',
    orarioFormatted    ? '<p style="margin:4px 0;"><strong>Orario:</strong> '        + escapeHtml_(orarioFormatted)         + '</p>' : '',
    shiftData.meeting_point ? '<p style="margin:4px 0;"><strong>Punto di ritrovo:</strong> ' + escapeHtml_(shiftData.meeting_point) + '</p>' : '',
    shiftData.dress_code    ? '<p style="margin:4px 0;"><strong>Dress code:</strong> '       + escapeHtml_(shiftData.dress_code)    + '</p>' : '',
    shiftData.note_operational ? '<p style="margin:8px 0 0;font-size:13px;color:#6B6B6B;"><em>' + escapeHtml_(shiftData.note_operational) + '</em></p>' : '',
    '</div>',
    '<div style="background:#FFF3CD;border-left:4px solid #FFC107;padding:12px 16px;border-radius:4px;margin:0 0 16px;">',
    '<p style="margin:0;font-size:13px;"><strong>Ricorda:</strong> effettua il check-in dalla piattaforma ',
    'al momento dell\'arrivo (disponibile 30 minuti prima dell\'inizio turno).</p>',
    '</div>',
    '<p style="font-size:13px;color:#AAAAAA;margin:0;">Rif. Assignment: <code>' + assignmentId + '</code></p>',
  ].join('');

  var html = buildEmailTemplate('Turno confermato ✓', 'Ciao ' + escapeHtml_(nome) + ',', body);

  return sendEmail_(to, 'Turno confermato — ' + (eventData.titolo ? escapeHtml_(eventData.titolo) + ' · ' : '') + dataFormatted, html, undefined, { mailType: 'ASSIGNMENT_CONFIRMED', priority: true }).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 4 — Reminder 24h pre-shift
// ---------------------------------------------------------------------------

function sendReminder24hEmail(to, nome, shiftData) {
  var dataFormatted   = formatDate_(shiftData.data);
  var orario          = (shiftData.orario_inizio || '') + (shiftData.orario_fine ? ' – ' + shiftData.orario_fine : '');

  var body = [
    '<p style="margin:0 0 16px;">Ti ricordiamo che domani hai un turno confermato:</p>',
    '<div style="background:#F5F5F5;border-radius:8px;padding:20px;margin:0 0 16px;">',
    '<p style="margin:4px 0;"><strong>Data:</strong> '   + escapeHtml_(dataFormatted) + '</p>',
    orario ? '<p style="margin:4px 0;"><strong>Orario:</strong> ' + escapeHtml_(orario) + '</p>' : '',
    shiftData.meeting_point ? '<p style="margin:4px 0;"><strong>Punto di ritrovo:</strong> ' + escapeHtml_(shiftData.meeting_point) + '</p>' : '',
    shiftData.dress_code    ? '<p style="margin:4px 0;"><strong>Dress code:</strong> '       + escapeHtml_(shiftData.dress_code)    + '</p>' : '',
    '</div>',
    '<p style="margin:0;">Non dimenticare di fare il <strong>check-in</strong> dalla piattaforma al tuo arrivo.</p>',
  ].join('');

  var html = buildEmailTemplate('⏰ Il tuo turno è domani', 'Ciao ' + escapeHtml_(nome) + ',', body);

  return sendEmail_(to, 'Reminder turno domani — ' + dataFormatted, html).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 5 — Reminder 2h pre-shift (check-in imminente)
// ---------------------------------------------------------------------------

function sendReminder2hEmail(to, nome, shiftData) {
  var orario = shiftData.orario_inizio || '';

  var body = [
    '<p style="margin:0 0 12px;">Il tuo turno inizia alle <strong>' + escapeHtml_(orario) + '</strong>.</p>',
    shiftData.meeting_point ? '<p style="margin:0 0 12px;"><strong>Punto di ritrovo:</strong> ' + escapeHtml_(shiftData.meeting_point) + '</p>' : '',
    '<p style="margin:0;">Ricorda: puoi fare il <strong>check-in</strong> dalla piattaforma a partire da <strong>30 minuti prima</strong> dell\'inizio.</p>',
  ].join('');

  var html = buildEmailTemplate('🔔 Il tuo turno inizia tra 2 ore!', 'Ciao ' + escapeHtml_(nome) + ',', body);

  return sendEmail_(to, 'Il tuo turno inizia tra 2 ore!', html).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 6 — Alert No-Show (per admin)
// ---------------------------------------------------------------------------

function sendNoShowAlertEmail(adminEmail, talentNome, talentEmail, shiftData, assignmentId) {
  var dataFormatted = formatDate_(shiftData.data);

  var body = [
    '<p style="margin:0 0 16px;">Un talent <strong>non ha effettuato il check-in</strong> entro i 30 minuti dall\'inizio del turno.</p>',
    '<div style="background:#FDECEA;border-radius:8px;padding:20px;margin:0 0 16px;">',
    '<p style="margin:4px 0;"><strong>Talent:</strong> ' + escapeHtml_(talentNome)  + ' (' + escapeHtml_(talentEmail) + ')</p>',
    '<p style="margin:4px 0;"><strong>Data turno:</strong> ' + escapeHtml_(dataFormatted) + '</p>',
    '<p style="margin:4px 0;"><strong>Orario inizio:</strong> ' + escapeHtml_(shiftData.orario_inizio || 'N/D') + '</p>',
    '<p style="margin:4px 0;font-size:13px;color:#AAAAAA;">Assignment ID: ' + assignmentId + '</p>',
    '</div>',
    '<p style="margin:0;">L\'assignment è stato marcato come <strong>NO_SHOW</strong>. Intervieni per coprire il turno se necessario.</p>',
  ].join('');

  var html = buildEmailTemplate('⚠ Alert No-Show', null, body, { headerColor: '#d32f2f' });

  return sendEmail_(adminEmail, 'ALERT: No-Show rilevato — ' + dataFormatted, html).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 7 — Alert documenti in scadenza (per talent)
// ---------------------------------------------------------------------------

function sendDocumentExpiryEmail(to, nome, tipoDocumento, giorniMancanti) {
  var urgency = giorniMancanti <= 7 ? 'URGENTE: ' : '';
  var color   = giorniMancanti <= 7 ? '#d32f2f' : '#f57c00';

  var body = [
    '<p style="margin:0 0 12px;">Il tuo documento <strong style="color:' + color + ';">' + escapeHtml_(tipoDocumento) + '</strong> ',
    'scadrà tra <strong>' + giorniMancanti + ' giorni</strong>.</p>',
    '<p style="margin:0;">Aggiorna il documento accedendo alla piattaforma per evitare interruzioni nelle future assegnazioni.</p>',
  ].join('');

  var html = buildEmailTemplate('📄 ' + urgency + 'Documento in scadenza', 'Ciao ' + escapeHtml_(nome) + ',', body);

  return sendEmail_(to, urgency + 'Documento in scadenza: ' + tipoDocumento, html).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 8 — Onboarding Step 1: completa la tua iscrizione (email-driven)
// ---------------------------------------------------------------------------

/**
 * Inviata automaticamente dopo lo Step 1 della registrazione talent.
 * Contiene un unico link con lead_token per riprendere la compilazione.
 * @param {string} to             email del talent
 * @param {string} nome           nome del talent
 * @param {string} completionUrl  URL completo con lead_token es. https://…/registrazione/completa?token=UUID
 */
function sendOnboardingStep1Email(to, nome, completionUrl) {
  var body = [
    '<p style="margin:0 0 24px;">',
    'Per ricevere proposte di lavoro in linea con il tuo profilo, completa la tua scheda — ',
    'ti chiederemo disponibilità, esperienza e un po\' di te.<br><br>',
    'Bastano pochi minuti.',
    '</p>',

    '<div style="height:2px;background:#630E33;margin:0 0 28px;width:48px;"></div>',

    '<p style="margin:0 0 10px;font-size:13px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;color:#2E2E2E;">Come funziona</p>',
    '<p style="margin:0 0 8px;color:#6B6B6B;">',
    'Una volta approvato il tuo profilo, riceverai comunicazioni su eventi, date e location ',
    'selezionati in base alle tue caratteristiche e disponibilità.',
    '</p>',

    buildEmailButton_('Completa la tua iscrizione', completionUrl),

    '<p style="margin:0;font-size:12px;color:#AAAAAA;line-height:1.6;">',
    'Il link è personale e valido per la tua registrazione.<br>',
    'Se non hai richiesto tu questa iscrizione, ignora questa email.',
    '</p>',
  ].join('');

  var html = buildEmailTemplate('Hai fatto<br>il primo passo.', 'Ciao ' + escapeHtml_(nome) + ',', body);

  var text = [
    'Ciao ' + nome + ',',
    '',
    'Hai fatto il primo passo.',
    '',
    'Per ricevere proposte di lavoro in linea con il tuo profilo, completa la tua scheda.',
    'Ti chiederemo disponibilità, esperienza e un po\' di te.',
    '',
    'Completa la tua iscrizione qui:',
    completionUrl,
    '',
    'Come funziona:',
    'Una volta approvato il tuo profilo, riceverai comunicazioni su eventi,',
    'date e location selezionati in base alle tue caratteristiche.',
    '',
    '---',
    'MADE EVENTS — Non rispondere a questa email.'
  ].join('\n');

  return sendEmail_(to, 'Completa la tua iscrizione — MADE EVENTS', html, text).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 9 — Profilo ricevuto (alla candidata dopo step 3)
// ---------------------------------------------------------------------------

function sendProfiloRicevutoEmail(to, nome) {
  var body = [
    '<p style="margin:0 0 24px;">',
    'Il tuo profilo è stato ricevuto ed è ora in attesa di revisione da parte del team MADE EVENTS.',
    '</p>',
    '<div style="height:2px;background:#630E33;margin:0 0 24px;width:48px;"></div>',
    '<p style="margin:0 0 10px;font-size:13px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;color:#2E2E2E;">Cosa succede ora</p>',
    '<p style="margin:0 0 4px;color:#6B6B6B;">1. Il team esamina il tuo profilo (solitamente 2–5 giorni lavorativi)</p>',
    '<p style="margin:0 0 4px;color:#6B6B6B;">2. Ricevi una email con l\'esito della valutazione</p>',
    '<p style="margin:0 0 16px;color:#6B6B6B;">3. Se approvata, accedi alla piattaforma e candidati agli eventi</p>',
  ].join('');

  var html = buildEmailTemplate('Profilo ricevuto ✓', 'Ciao ' + escapeHtml_(nome) + ',', body);

  var text = 'Ciao ' + nome + ',\n\nIl tuo profilo è stato ricevuto ed è in attesa di revisione.\nTi contatteremo via email con l\'esito entro pochi giorni.\n\n— MADE EVENTS';
  return sendEmail_(to, 'Profilo ricevuto — in attesa di approvazione', html, text).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 10 — Nuovo profilo da approvare (all'admin)
// ---------------------------------------------------------------------------

function sendAdminNuovoProfilo(to, nome, cognome, score, leadId) {
  var rankingLabel = score >= 80 ? 'A — Eccellente' : score >= 60 ? 'B — Buono' : score >= 40 ? 'C — Medio' : 'D — Base';

  var body = [
    '<div style="background:#FAFAFA;border-left:4px solid #630E33;padding:20px 24px;margin:0 0 20px;border-radius:0 4px 4px 0;">',
    '<p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#2E2E2E;">' + escapeHtml_(nome) + ' ' + escapeHtml_(cognome) + '</p>',
    '<p style="margin:0 0 4px;font-size:13px;color:#6B6B6B;">Score interno: <strong>' + score + '/100</strong></p>',
    '<p style="margin:0 0 4px;font-size:13px;color:#6B6B6B;">Ranking: <strong>' + rankingLabel + '</strong></p>',
    '<p style="margin:4px 0 0;font-size:11px;color:#AAAAAA;">Lead ID: ' + leadId + '</p>',
    '</div>',
    '<p style="margin:0;">Accedi alla piattaforma per esaminare il profilo completo e procedere con approvazione o rifiuto.</p>',
  ].join('');

  var html = buildEmailTemplate('Nuovo profilo da approvare', null, body);

  var text = 'NUOVO PROFILO DA APPROVARE\n\nNome: ' + nome + ' ' + cognome + '\nScore: ' + score + '/100\nLead ID: ' + leadId + '\n\nAccedi alla piattaforma per approvare o rifiutare.\n\n— MADE EVENTS';
  return sendEmail_(to, 'Nuovo profilo da approvare — ' + nome + ' ' + cognome + ' [' + score + '/100]', html, text).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 11 — Sollecito completamento registrazione
// ---------------------------------------------------------------------------

function sendSollecitoEmail(to, nome, completionUrl, completati, mancanti, apologyText) {
  var completatiHtml = completati.map(function(s) {
    return '<li style="margin:4px 0;font-size:13px;color:#2E7D32;">✓ ' + escapeHtml_(s) + '</li>';
  }).join('');

  var mancantiHtml = mancanti.map(function(s) {
    return '<li style="margin:4px 0;font-size:13px;color:#C62828;">— ' + escapeHtml_(s) + '</li>';
  }).join('');

  var apologyHtml = apologyText
    ? '<p style="margin:0 0 20px;padding:12px 16px;background:#FFF8E1;border-radius:6px;font-size:13px;color:#6B5B00;">' + escapeHtml_(apologyText) + '</p>'
    : '';

  var body = [
    apologyHtml,
    '<p style="margin:0 0 20px;">',
    'Stai completando la tua iscrizione a MADE EVENTS. Riprendi da dove ti eri fermata!',
    '</p>',
    completati.length ? '<p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;">Hai già compilato:</p><ul style="margin:0 0 20px;padding-left:20px;">' + completatiHtml + '</ul>' : '',
    mancanti.length   ? '<p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;">Manca ancora:</p><ul style="margin:0 0 20px;padding-left:20px;">' + mancantiHtml + '</ul>' : '',
    buildEmailButton_('Riprendi la registrazione', completionUrl),
    '<p style="margin:0;font-size:12px;color:#AAAAAA;">Il link è personale e valido per la tua registrazione.</p>',
  ].join('');

  var html = buildEmailTemplate('Hai lasciato la registrazione a metà', 'Ciao ' + escapeHtml_(nome) + ',', body);

  var text = (apologyText ? apologyText + '\n\n' : '') + 'Ciao ' + nome + ',\n\nHai lasciato la registrazione incompleta.\nRiprendi qui: ' + completionUrl + '\n\nManca ancora: ' + mancanti.join(', ') + '\n\n— MADE EVENTS';
  return sendEmail_(to, 'Completa la tua iscrizione — ' + (mancanti.length ? mancanti.length + ' sezioni mancanti' : 'quasi pronta!'), html, text).ok;
}

// ---------------------------------------------------------------------------
// QUOTA HELPER — usato da lead.importLegacy / lead.resetSolleciti per non
// sforare il limite giornaliero GmailApp inviando un lotto troppo grande.
// Non scende mai sotto un margine di 20 mail.
// ---------------------------------------------------------------------------

function checkEmailQuota_(desiredCount) {
  var remaining = MailApp.getRemainingDailyQuota();
  var sendable = Math.max(0, remaining - 20);
  return {
    remaining: remaining,
    limit:     Math.min(desiredCount, sendable),
    capped:    sendable < desiredCount
  };
}

// ---------------------------------------------------------------------------
// TEMPLATE 12 — Email personalizzata admin → talent
// ---------------------------------------------------------------------------

function sendCustomAdminEmail(to, nome, contenutoTesto, emailAdmin) {
  var body = [
    '<div style="font-size:15px;color:#2E2E2E;line-height:1.8;white-space:pre-wrap;">',
    escapeHtml_(contenutoTesto),
    '</div>',
    '<div style="margin-top:32px;padding-top:20px;border-top:1px solid #EAEAEA;">',
    '<p style="margin:0;font-size:12px;color:#AAAAAA;">',
    'Il team MADE EVENTS',
    emailAdmin ? ' &middot; ' + escapeHtml_(emailAdmin) : '',
    '</p>',
    '</div>',
  ].join('');

  var html = buildEmailTemplate('Comunicazione dal team', 'Ciao ' + escapeHtml_(nome) + ',', body);

  var text = 'Ciao ' + nome + ',\n\n' + contenutoTesto + '\n\n— Il team MADE EVENTS';
  return sendEmail_(to, 'Comunicazione dal team MADE EVENTS', html, text, { mailType: 'ADMIN_CUSTOM', priority: true }).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 13 — Invito social (admin → talent)
// ---------------------------------------------------------------------------

function sendSocialInviteEmail(to, nome, contenutoTesto) {
  var body = [
    '<div style="font-size:15px;color:#2E2E2E;line-height:1.8;white-space:pre-wrap;">',
    escapeHtml_(contenutoTesto),
    '</div>',
    '<div style="margin-top:28px;">',
    '<a href="https://www.instagram.com/madeevents" style="display:inline-block;background:#630E33;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;margin-right:8px;">Instagram</a>',
    '<a href="https://www.facebook.com/Made-Events" style="display:inline-block;background:#1877F2;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Facebook</a>',
    '</div>',
  ].join('');

  var html = buildEmailTemplate('Seguici sui social 📱', 'Ciao ' + escapeHtml_(nome) + ',', body);

  var text = contenutoTesto + '\n\nInstagram: @madeevents\nFacebook: Made Events\n\n— Il team MADE EVENTS';
  return sendEmail_(to, 'Seguici sui social — MADE EVENTS', html, text).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 14 — Convocazione evento (admin → talent)
// ---------------------------------------------------------------------------

function sendConvocazioneEmail(to, nome, titoloEvento, dataEvento, luogoEvento, contenutoTesto) {
  var eventoBlock = titoloEvento
    ? '<div style="background:#FAFAFA;border-left:4px solid #630E33;padding:16px 20px;margin:0 0 24px;border-radius:0 4px 4px 0;">' +
      '<p style="margin:0 0 6px;font-size:15px;font-weight:bold;color:#2E2E2E;">' + escapeHtml_(titoloEvento) + '</p>' +
      (dataEvento   ? '<p style="margin:0 0 4px;font-size:13px;color:#6B6B6B;">&#128197; ' + escapeHtml_(dataEvento)   + '</p>' : '') +
      (luogoEvento  ? '<p style="margin:0;font-size:13px;color:#6B6B6B;">&#128205; '       + escapeHtml_(luogoEvento)  + '</p>' : '') +
      '</div>'
    : '';

  var body = [
    eventoBlock,
    '<div style="font-size:15px;color:#2E2E2E;line-height:1.8;white-space:pre-wrap;">',
    escapeHtml_(contenutoTesto),
    '</div>',
    '<div style="margin-top:32px;padding-top:20px;border-top:1px solid #EAEAEA;">',
    '<p style="margin:0;font-size:12px;color:#AAAAAA;">Il team MADE EVENTS</p>',
    '</div>',
  ].join('');

  var html = buildEmailTemplate('Sei stata selezionata ✨', 'Ciao ' + escapeHtml_(nome) + ',', body);

  var textHeader = titoloEvento
    ? titoloEvento + (dataEvento ? ' · ' + dataEvento : '') + (luogoEvento ? ' · ' + luogoEvento : '') + '\n\n'
    : '';
  var text = 'Ciao ' + nome + ',\n\n' + textHeader + contenutoTesto + '\n\n— Il team MADE EVENTS';
  return sendEmail_(to, 'Sei stata selezionata — ' + (titoloEvento || 'MADE EVENTS'), html, text).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 15 — Candidatura approvata per evento specifico (con auto-login)
// ---------------------------------------------------------------------------

/**
 * Notifica il talent che la sua candidatura per uno specifico evento è stata
 * approvata (APPLICATION:APPROVED → ASSIGNMENT:CONFIRMED). Include un link di
 * accesso automatico all'area riservata (token pre-autenticato nell'URL).
 * @param {string} to         email del talent
 * @param {string} nome       nome completo del talent
 * @param {object} eventData  dati evento (titolo, luogo, citta, compenso...)
 * @param {object} shiftData  dati turno (data, orario_inizio, orario_fine, ruolo, meeting_point...)
 * @param {string} eventLink  URL diretto alla scheda evento (con token di accesso automatico se disponibile)
 */
function sendApplicationApprovedEmail(to, nome, eventData, shiftData, eventLink) {
  eventData = eventData || {};
  shiftData = shiftData || {};
  var dataFormatted   = formatDate_(shiftData.data);
  var orarioFormatted = (shiftData.orario_inizio || '') + (shiftData.orario_fine ? ' – ' + shiftData.orario_fine : '');
  var luogoFormatted  = [eventData.luogo, eventData.citta].filter(Boolean).join(' — ');

  var body = [
    '<p style="margin:0 0 20px;">La tua candidatura è stata <strong>approvata</strong>! Sei stato selezionato per il seguente evento:</p>',

    '<div style="background:#FDF2F5;border-left:4px solid #630E33;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;">',
    '<p style="margin:0 0 6px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#630E33;font-weight:bold;">Evento</p>',
    '<p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#2E2E2E;">' + escapeHtml_(eventData.titolo || '') + '</p>',
    dataFormatted  ? '<p style="margin:4px 0;font-size:13px;color:#6B6B6B;">📅 ' + escapeHtml_(dataFormatted)  + '</p>' : '',
    luogoFormatted ? '<p style="margin:4px 0;font-size:13px;color:#6B6B6B;">📍 ' + escapeHtml_(luogoFormatted) + '</p>' : '',
    '</div>',

    '<p style="margin:0 0 16px;"><strong>Candidatura approvata:</strong> riceverai il contratto da firmare nel portale. La partecipazione sarà confermata dopo la firma.</p>',

    (shiftData.ruolo || orarioFormatted || shiftData.meeting_point) ? (
      '<div style="background:#F5F5F5;border-radius:8px;padding:20px;margin:0 0 20px;">' +
      '<p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6B6B6B;font-weight:bold;">Dettagli turno</p>' +
      (shiftData.ruolo        ? '<p style="margin:4px 0;"><strong>Ruolo:</strong> '            + escapeHtml_(shiftData.ruolo)        + '</p>' : '') +
      (orarioFormatted        ? '<p style="margin:4px 0;"><strong>Orario:</strong> '           + escapeHtml_(orarioFormatted)        + '</p>' : '') +
      (shiftData.meeting_point ? '<p style="margin:4px 0;"><strong>Punto di ritrovo:</strong> ' + escapeHtml_(shiftData.meeting_point) + '</p>' : '') +
      '</div>'
    ) : '',

    buildEmailButton_('VAI AL PORTALE', eventLink),
  ].join('');

  var html = buildEmailTemplate('Candidatura approvata', 'Ciao ' + escapeHtml_(nome) + ',', body);

  var text = [
    'Ciao ' + nome + ',',
    '',
    'La tua candidatura è stata approvata! Sei stato selezionato per: ' + (eventData.titolo || ''),
    dataFormatted  ? 'Data: '   + dataFormatted  : '',
    luogoFormatted ? 'Luogo: '  + luogoFormatted : '',
    orarioFormatted ? 'Orario: ' + orarioFormatted : '',
    '',
    'Candidatura approvata: riceverai il contratto da firmare nel portale. La partecipazione sarà confermata dopo la firma.',
    'Accedi al portale: ' + eventLink,
    '',
    '— MADE EVENTS'
  ].filter(Boolean).join('\n');

  return sendEmail_(to, 'Candidatura approvata — ' + (eventData.titolo || 'un evento'), html, text, { mailType: 'APPLICATION_APPROVED', priority: true }).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 16 — Registrazione duplicata: lead già esistente (non ancora talent)
// ---------------------------------------------------------------------------

function sendRegistrazioneEsistenteEmail(to, nome, completionUrl) {
  var body = [
    '<p style="margin:0 0 20px;">',
    'Ci risulti già registrato/a nel nostro sistema. Non è possibile procedere a una nuova registrazione, ',
    'ma abbiamo appena inviato un nuovo link per riprendere e completare il tuo profilo esattamente da dove ti eri fermato/a.',
    '</p>',
    buildEmailButton_('Riprendi la registrazione', completionUrl),
  ].join('');

  var html = buildEmailTemplate('Registrazione già in corso', 'Ciao ' + escapeHtml_(nome) + ',', body);
  var text = 'Ciao ' + nome + ',\n\nCi risulti già registrato/a. Riprendi da qui: ' + completionUrl + '\n\n— MADE EVENTS';
  return sendEmail_(to, 'Riprendi la tua registrazione — MADE EVENTS', html, text).ok;
}

// ---------------------------------------------------------------------------
// TEMPLATE 17 — Registrazione duplicata: account talent già attivo
// ---------------------------------------------------------------------------

function sendAccountEsistenteEmail(to, nome, loginUrl) {
  var body = [
    '<p style="margin:0 0 20px;">',
    'Hai già un account attivo su MADE EVENTS. ',
    'Ecco il link per accedere alla tua area riservata — se non ricordi la password potrai reimpostarla dall\'interno.',
    '</p>',
    buildEmailButton_('Accedi alla tua area riservata', loginUrl),
  ].join('');

  var html = buildEmailTemplate('Hai già un account', 'Ciao ' + escapeHtml_(nome) + ',', body);
  var text = 'Ciao ' + nome + ',\n\nHai già un account attivo. Accedi qui: ' + loginUrl + '\n\n— MADE EVENTS';
  return sendEmail_(to, 'Il tuo account MADE EVENTS', html, text).ok;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function escapeHtml_(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

function formatDate_(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    var days   = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
    var months = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                  'luglio','agosto','settembre','ottobre','novembre','dicembre'];
    return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  } catch (e) {
    return String(dateStr);
  }
}
