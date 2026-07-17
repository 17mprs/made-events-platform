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
  REPLY_TO:     'noreply@madeevent.it',   // Override con config tenant se disponibile
  SUBJECT_PREFIX: '[MADE EVENTS] '
};

// ---------------------------------------------------------------------------
// SEND HELPER (unico punto di invio)
// ---------------------------------------------------------------------------

/**
 * Invia un'email. Wrappato in try/catch: un fallimento email non
 * blocca mai il flusso principale.
 * @returns {boolean} true se inviata, false se fallita
 */
function sendEmail_(to, subject, bodyHtml, bodyText) {
  try {
    if (!to || !isValidEmail(to)) {
      Logger.log('[GMAIL] Email non valida, skip invio: ' + to);
      return false;
    }

    GmailApp.sendEmail(to, EMAIL_CONFIG.SUBJECT_PREFIX + subject, bodyText || stripHtml_(bodyHtml), {
      htmlBody: bodyHtml,
      name:     EMAIL_CONFIG.FROM_NAME,
      replyTo:  EMAIL_CONFIG.REPLY_TO
    });

    Logger.log('[GMAIL] Email inviata a: ' + to + ' | subject: ' + subject);
    return true;
  } catch (e) {
    Logger.log('[GMAIL] Errore invio a ' + to + ': ' + e.message);
    return false;
  }
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
 */
function sendWelcomeEmail(to, nome, tempPassword, loginUrl) {
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

  return sendEmail_(to, 'Benvenuto! Le tue credenziali di accesso', html, text);
}

// ---------------------------------------------------------------------------
// TEMPLATE 2 — Conferma approvazione profilo (senza credenziali, se USER già esiste)
// ---------------------------------------------------------------------------

function sendProfileApprovedEmail(to, nome) {
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

  return sendEmail_(to, 'Profilo approvato — Benvenuto nel team!', html);
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

  return sendEmail_(to, 'Turno confermato — ' + (eventData.titolo ? escapeHtml_(eventData.titolo) + ' · ' : '') + dataFormatted, html);
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

  return sendEmail_(to, 'Reminder turno domani — ' + dataFormatted, html);
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

  return sendEmail_(to, 'Il tuo turno inizia tra 2 ore!', html);
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

  return sendEmail_(adminEmail, 'ALERT: No-Show rilevato — ' + dataFormatted, html);
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

  return sendEmail_(to, urgency + 'Documento in scadenza: ' + tipoDocumento, html);
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

  return sendEmail_(to, 'Completa la tua iscrizione — MADE EVENTS', html, text);
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
  return sendEmail_(to, 'Profilo ricevuto — in attesa di approvazione', html, text);
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
  return sendEmail_(to, 'Nuovo profilo da approvare — ' + nome + ' ' + cognome + ' [' + score + '/100]', html, text);
}

// ---------------------------------------------------------------------------
// TEMPLATE 11 — Sollecito completamento registrazione
// ---------------------------------------------------------------------------

function sendSollecitoEmail(to, nome, completionUrl, completati, mancanti) {
  var completatiHtml = completati.map(function(s) {
    return '<li style="margin:4px 0;font-size:13px;color:#2E7D32;">✓ ' + escapeHtml_(s) + '</li>';
  }).join('');

  var mancantiHtml = mancanti.map(function(s) {
    return '<li style="margin:4px 0;font-size:13px;color:#C62828;">— ' + escapeHtml_(s) + '</li>';
  }).join('');

  var body = [
    '<p style="margin:0 0 20px;">',
    'Stai completando la tua iscrizione a MADE EVENTS. Riprendi da dove ti eri fermata!',
    '</p>',
    completati.length ? '<p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;">Hai già compilato:</p><ul style="margin:0 0 20px;padding-left:20px;">' + completatiHtml + '</ul>' : '',
    mancanti.length   ? '<p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;">Manca ancora:</p><ul style="margin:0 0 20px;padding-left:20px;">' + mancantiHtml + '</ul>' : '',
    buildEmailButton_('Riprendi la registrazione', completionUrl),
    '<p style="margin:0;font-size:12px;color:#AAAAAA;">Il link è personale e valido per la tua registrazione.</p>',
  ].join('');

  var html = buildEmailTemplate('Hai lasciato la registrazione a metà', 'Ciao ' + escapeHtml_(nome) + ',', body);

  var text = 'Ciao ' + nome + ',\n\nHai lasciato la registrazione incompleta.\nRiprendi qui: ' + completionUrl + '\n\nManca ancora: ' + mancanti.join(', ') + '\n\n— MADE EVENTS';
  return sendEmail_(to, 'Completa la tua iscrizione — ' + (mancanti.length ? mancanti.length + ' sezioni mancanti' : 'quasi pronta!'), html, text);
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
  return sendEmail_(to, 'Comunicazione dal team MADE EVENTS', html, text);
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
  return sendEmail_(to, 'Seguici sui social — MADE EVENTS', html, text);
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
  return sendEmail_(to, 'Sei stata selezionata — ' + (titoloEvento || 'MADE EVENTS'), html, text);
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
 * @param {string} portaleUrl URL completo dell'area riservata con token di accesso automatico
 */
function sendApplicationApprovedEmail(to, nome, eventData, shiftData, portaleUrl) {
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

    (shiftData.ruolo || orarioFormatted || shiftData.meeting_point) ? (
      '<div style="background:#F5F5F5;border-radius:8px;padding:20px;margin:0 0 20px;">' +
      '<p style="margin:0 0 10px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6B6B6B;font-weight:bold;">Dettagli turno</p>' +
      (shiftData.ruolo        ? '<p style="margin:4px 0;"><strong>Ruolo:</strong> '            + escapeHtml_(shiftData.ruolo)        + '</p>' : '') +
      (orarioFormatted        ? '<p style="margin:4px 0;"><strong>Orario:</strong> '           + escapeHtml_(orarioFormatted)        + '</p>' : '') +
      (shiftData.meeting_point ? '<p style="margin:4px 0;"><strong>Punto di ritrovo:</strong> ' + escapeHtml_(shiftData.meeting_point) + '</p>' : '') +
      '</div>'
    ) : '',

    buildEmailButton_('Accedi alla tua area riservata', portaleUrl),
  ].join('');

  var html = buildEmailTemplate('Sei stato selezionato! 🎉', 'Ciao ' + escapeHtml_(nome) + ',', body);

  var text = [
    'Ciao ' + nome + ',',
    '',
    'La tua candidatura è stata approvata! Sei stato selezionato per: ' + (eventData.titolo || ''),
    dataFormatted  ? 'Data: '   + dataFormatted  : '',
    luogoFormatted ? 'Luogo: '  + luogoFormatted : '',
    orarioFormatted ? 'Orario: ' + orarioFormatted : '',
    '',
    'Accedi alla tua area riservata: ' + portaleUrl,
    '',
    '— MADE EVENTS'
  ].filter(Boolean).join('\n');

  return sendEmail_(to, 'Sei stato selezionato per ' + (eventData.titolo || 'un evento'), html, text);
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
  return sendEmail_(to, 'Riprendi la tua registrazione — MADE EVENTS', html, text);
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
  return sendEmail_(to, 'Il tuo account MADE EVENTS', html, text);
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
