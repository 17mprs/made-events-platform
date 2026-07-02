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
  SUBJECT_PREFIX: '[Made Event] '
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

  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">',
    '<div style="background:#1a1a2e;padding:24px;text-align:center;">',
    '<h1 style="color:#ffffff;margin:0;font-size:22px;">MADE EVENTS</h1>',
    '</div>',
    '<div style="padding:32px;">',
    '<h2 style="color:#1a1a2e;">Benvenuto/a, ' + escapeHtml_(nome) + '!</h2>',
    '<p>Il tuo profilo è stato <strong>approvato</strong>. ',
    'Puoi ora accedere alla piattaforma e candidarti agli eventi.</p>',
    '<div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:24px 0;">',
    '<p style="margin:0 0 8px;"><strong>Le tue credenziali di accesso:</strong></p>',
    '<p style="margin:4px 0;">Email: <code>' + escapeHtml_(to) + '</code></p>',
    '<p style="margin:4px 0;">Password temporanea: <code style="background:#e0e0e0;padding:2px 6px;border-radius:4px;">' + escapeHtml_(tempPassword) + '</code></p>',
    '</div>',
    '<p style="color:#d32f2f;font-size:13px;">⚠ Cambia la password al primo accesso.</p>',
    '<a href="' + url + '" style="display:inline-block;background:#1a1a2e;color:#fff;',
    'padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0;">',
    'Accedi alla piattaforma</a>',
    '<hr style="border:none;border-top:1px solid #e0e0e0;margin:32px 0;">',
    '<p style="font-size:12px;color:#888;">MADE EVENTS — gestione staffing eventi.<br>',
    'Non rispondere a questa email.</p>',
    '</div>',
    '</div>'
  ].join('');

  var text = [
    'Benvenuto/a, ' + nome + '!',
    '',
    'Il tuo profilo Made Event è stato approvato.',
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
  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">',
    '<div style="background:#1a1a2e;padding:24px;text-align:center;">',
    '<h1 style="color:#ffffff;margin:0;font-size:22px;">MADE EVENTS</h1>',
    '</div>',
    '<div style="padding:32px;">',
    '<h2 style="color:#1a1a2e;">Profilo approvato ✓</h2>',
    '<p>Ciao ' + escapeHtml_(nome) + ',</p>',
    '<p>Il tuo profilo talent è stato <strong>approvato</strong> dal team Made Event.</p>',
    '<p>Ora puoi:</p>',
    '<ul>',
    '<li>Visualizzare gli shift disponibili</li>',
    '<li>Candidarti agli eventi</li>',
    '<li>Gestire il tuo profilo e i tuoi documenti</li>',
    '</ul>',
    '<hr style="border:none;border-top:1px solid #e0e0e0;margin:32px 0;">',
    '<p style="font-size:12px;color:#888;">MADE EVENTS — Non rispondere a questa email.</p>',
    '</div>',
    '</div>'
  ].join('');

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
function sendAssignmentConfirmedEmail(to, nome, shiftData, assignmentId) {
  var dataFormatted    = formatDate_(shiftData.data);
  var orarioFormatted  = (shiftData.orario_inizio || '') + (shiftData.orario_fine ? ' – ' + shiftData.orario_fine : '');

  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">',
    '<div style="background:#1a1a2e;padding:24px;text-align:center;">',
    '<h1 style="color:#ffffff;margin:0;font-size:22px;">MADE EVENTS</h1>',
    '</div>',
    '<div style="padding:32px;">',
    '<h2 style="color:#1a1a2e;">Turno confermato ✓</h2>',
    '<p>Ciao ' + escapeHtml_(nome) + ',</p>',
    '<p>La tua candidatura è stata <strong>approvata</strong>. Sei ufficialmente assegnato/a al seguente turno:</p>',
    '<div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:24px 0;">',
    shiftData.ruolo    ? '<p style="margin:4px 0;"><strong>Ruolo:</strong> '         + escapeHtml_(shiftData.ruolo)         + '</p>' : '',
    '<p style="margin:4px 0;"><strong>Data:</strong> '                               + escapeHtml_(dataFormatted)           + '</p>',
    orarioFormatted    ? '<p style="margin:4px 0;"><strong>Orario:</strong> '        + escapeHtml_(orarioFormatted)         + '</p>' : '',
    shiftData.meeting_point ? '<p style="margin:4px 0;"><strong>Punto di ritrovo:</strong> ' + escapeHtml_(shiftData.meeting_point) + '</p>' : '',
    shiftData.dress_code    ? '<p style="margin:4px 0;"><strong>Dress code:</strong> '       + escapeHtml_(shiftData.dress_code)    + '</p>' : '',
    shiftData.note_operational ? '<p style="margin:8px 0 0;font-size:13px;color:#555;"><em>' + escapeHtml_(shiftData.note_operational) + '</em></p>' : '',
    '</div>',
    '<div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;border-radius:4px;margin:16px 0;">',
    '<p style="margin:0;font-size:13px;"><strong>Ricorda:</strong> effettua il check-in dalla piattaforma ',
    'al momento dell\'arrivo (disponibile 30 minuti prima dell\'inizio turno).</p>',
    '</div>',
    '<p style="font-size:13px;color:#888;">Rif. Assignment: <code>' + assignmentId + '</code></p>',
    '<hr style="border:none;border-top:1px solid #e0e0e0;margin:32px 0;">',
    '<p style="font-size:12px;color:#888;">MADE EVENTS — Non rispondere a questa email.</p>',
    '</div>',
    '</div>'
  ].join('');

  return sendEmail_(to, 'Turno confermato — ' + dataFormatted, html);
}

// ---------------------------------------------------------------------------
// TEMPLATE 4 — Reminder 24h pre-shift
// ---------------------------------------------------------------------------

function sendReminder24hEmail(to, nome, shiftData) {
  var dataFormatted   = formatDate_(shiftData.data);
  var orario          = (shiftData.orario_inizio || '') + (shiftData.orario_fine ? ' – ' + shiftData.orario_fine : '');

  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">',
    '<div style="background:#1a1a2e;padding:24px;text-align:center;">',
    '<h1 style="color:#ffffff;margin:0;font-size:22px;">MADE EVENTS</h1>',
    '</div>',
    '<div style="padding:32px;">',
    '<h2 style="color:#1a1a2e;">⏰ Reminder — Il tuo turno è domani</h2>',
    '<p>Ciao ' + escapeHtml_(nome) + ', ti ricordiamo che domani hai un turno confermato:</p>',
    '<div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:24px 0;">',
    '<p style="margin:4px 0;"><strong>Data:</strong> '   + escapeHtml_(dataFormatted) + '</p>',
    orario ? '<p style="margin:4px 0;"><strong>Orario:</strong> ' + escapeHtml_(orario) + '</p>' : '',
    shiftData.meeting_point ? '<p style="margin:4px 0;"><strong>Punto di ritrovo:</strong> ' + escapeHtml_(shiftData.meeting_point) + '</p>' : '',
    shiftData.dress_code    ? '<p style="margin:4px 0;"><strong>Dress code:</strong> '       + escapeHtml_(shiftData.dress_code)    + '</p>' : '',
    '</div>',
    '<p>Non dimenticare di fare il <strong>check-in</strong> dalla piattaforma al tuo arrivo.</p>',
    '<hr style="border:none;border-top:1px solid #e0e0e0;margin:32px 0;">',
    '<p style="font-size:12px;color:#888;">MADE EVENTS — Non rispondere a questa email.</p>',
    '</div>',
    '</div>'
  ].join('');

  return sendEmail_(to, 'Reminder turno domani — ' + dataFormatted, html);
}

// ---------------------------------------------------------------------------
// TEMPLATE 5 — Reminder 2h pre-shift (check-in imminente)
// ---------------------------------------------------------------------------

function sendReminder2hEmail(to, nome, shiftData) {
  var orario = shiftData.orario_inizio || '';

  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">',
    '<div style="background:#1a1a2e;padding:24px;text-align:center;">',
    '<h1 style="color:#ffffff;margin:0;font-size:22px;">MADE EVENTS</h1>',
    '</div>',
    '<div style="padding:32px;">',
    '<h2 style="color:#d32f2f;">🔔 Il tuo turno inizia tra 2 ore!</h2>',
    '<p>Ciao ' + escapeHtml_(nome) + ',</p>',
    '<p>Il tuo turno inizia alle <strong>' + escapeHtml_(orario) + '</strong>.</p>',
    shiftData.meeting_point ? '<p><strong>Punto di ritrovo:</strong> ' + escapeHtml_(shiftData.meeting_point) + '</p>' : '',
    '<p>Ricorda: puoi fare il <strong>check-in</strong> dalla piattaforma a partire da <strong>30 minuti prima</strong> dell\'inizio.</p>',
    '<hr style="border:none;border-top:1px solid #e0e0e0;margin:32px 0;">',
    '<p style="font-size:12px;color:#888;">MADE EVENTS — Non rispondere a questa email.</p>',
    '</div>',
    '</div>'
  ].join('');

  return sendEmail_(to, 'Il tuo turno inizia tra 2 ore!', html);
}

// ---------------------------------------------------------------------------
// TEMPLATE 6 — Alert No-Show (per admin)
// ---------------------------------------------------------------------------

function sendNoShowAlertEmail(adminEmail, talentNome, talentEmail, shiftData, assignmentId) {
  var dataFormatted = formatDate_(shiftData.data);

  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">',
    '<div style="background:#d32f2f;padding:24px;text-align:center;">',
    '<h1 style="color:#ffffff;margin:0;font-size:22px;">⚠ Alert No-Show</h1>',
    '</div>',
    '<div style="padding:32px;">',
    '<p>Un talent <strong>non ha effettuato il check-in</strong> entro i 30 minuti dall\'inizio del turno.</p>',
    '<div style="background:#fdecea;border-radius:8px;padding:20px;margin:24px 0;">',
    '<p style="margin:4px 0;"><strong>Talent:</strong> ' + escapeHtml_(talentNome)  + ' (' + escapeHtml_(talentEmail) + ')</p>',
    '<p style="margin:4px 0;"><strong>Data turno:</strong> ' + escapeHtml_(dataFormatted) + '</p>',
    '<p style="margin:4px 0;"><strong>Orario inizio:</strong> ' + escapeHtml_(shiftData.orario_inizio || 'N/D') + '</p>',
    '<p style="margin:4px 0;font-size:13px;color:#888;">Assignment ID: ' + assignmentId + '</p>',
    '</div>',
    '<p>L\'assignment è stato marcato come <strong>NO_SHOW</strong>. Intervieni per coprire il turno se necessario.</p>',
    '<hr style="border:none;border-top:1px solid #e0e0e0;margin:32px 0;">',
    '<p style="font-size:12px;color:#888;">MADE EVENTS — Sistema automatico.</p>',
    '</div>',
    '</div>'
  ].join('');

  return sendEmail_(adminEmail, 'ALERT: No-Show rilevato — ' + dataFormatted, html);
}

// ---------------------------------------------------------------------------
// TEMPLATE 7 — Alert documenti in scadenza (per talent)
// ---------------------------------------------------------------------------

function sendDocumentExpiryEmail(to, nome, tipoDocumento, giorniMancanti) {
  var urgency = giorniMancanti <= 7 ? 'URGENTE: ' : '';
  var color   = giorniMancanti <= 7 ? '#d32f2f' : '#f57c00';

  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">',
    '<div style="background:#1a1a2e;padding:24px;text-align:center;">',
    '<h1 style="color:#ffffff;margin:0;font-size:22px;">MADE EVENTS</h1>',
    '</div>',
    '<div style="padding:32px;">',
    '<h2 style="color:' + color + ';">📄 ' + urgency + 'Documento in scadenza</h2>',
    '<p>Ciao ' + escapeHtml_(nome) + ',</p>',
    '<p>Il tuo documento <strong>' + escapeHtml_(tipoDocumento) + '</strong> ',
    'scadrà tra <strong>' + giorniMancanti + ' giorni</strong>.</p>',
    '<p>Aggiorna il documento accedendo alla piattaforma per evitare interruzioni nelle future assegnazioni.</p>',
    '<hr style="border:none;border-top:1px solid #e0e0e0;margin:32px 0;">',
    '<p style="font-size:12px;color:#888;">MADE EVENTS — Non rispondere a questa email.</p>',
    '</div>',
    '</div>'
  ].join('');

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
  var ACCENT = '#630E33';

  var html = [
    '<!DOCTYPE html>',
    '<html lang="it"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Completa la tua iscrizione — Made Event</title></head>',
    '<body style="margin:0;padding:0;background:#F6F6F6;font-family:\'Helvetica Neue\',Arial,sans-serif;">',

    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F6;padding:40px 16px;">',
    '<tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;">',

    // Header bordeaux
    '<tr><td style="background:' + ACCENT + ';padding:40px 48px 36px;">',
    '<p style="margin:0 0 20px;font-size:11px;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.6);">MADE EVENTS</p>',
    '<h1 style="margin:0;font-size:26px;font-weight:300;letter-spacing:1.5px;color:#FFFFFF;line-height:1.3;">',
    'Hai fatto<br>il primo passo.',
    '</h1>',
    '</td></tr>',

    // Body
    '<tr><td style="padding:48px;">',

    '<p style="margin:0 0 8px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;font-weight:500;">',
    'Ciao ' + escapeHtml_(nome) + ',',
    '</p>',

    '<p style="margin:0 0 28px;font-size:15px;font-weight:300;color:#2E2E2E;line-height:1.8;letter-spacing:0.3px;">',
    'Per ricevere proposte di lavoro in linea con il tuo profilo, completa la tua scheda — ',
    'ti chiederemo disponibilità, esperienza e un po\' di te.<br><br>',
    'Bastano pochi minuti.',
    '</p>',

    // Divider accent
    '<div style="height:2px;background:' + ACCENT + ';margin:0 0 32px;width:48px;"></div>',

    '<p style="margin:0 0 12px;font-size:13px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;color:#2E2E2E;">Come funziona</p>',
    '<p style="margin:0 0 32px;font-size:14px;font-weight:300;color:#6B6B6B;line-height:1.8;">',
    'Una volta approvato il tuo profilo, riceverai comunicazioni su eventi, date e location ',
    'selezionati in base alle tue caratteristiche e disponibilità.',
    '</p>',

    // CTA button
    '<table cellpadding="0" cellspacing="0" style="margin:0 0 40px;">',
    '<tr><td style="background:' + ACCENT + ';border-radius:4px;">',
    '<a href="' + escapeHtml_(completionUrl) + '" ',
    'style="display:inline-block;padding:16px 36px;font-size:12px;font-weight:500;',
    'letter-spacing:2px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">',
    'Completa la tua iscrizione',
    '</a>',
    '</td></tr></table>',

    '<p style="margin:0;font-size:12px;color:#AAAAAA;line-height:1.6;">',
    'Il link è personale e valido per la tua registrazione.<br>',
    'Se non hai richiesto tu questa iscrizione, ignora questa email.',
    '</p>',

    '</td></tr>',

    // Footer
    '<tr><td style="background:#FAFAFA;border-top:1px solid #EAEAEA;padding:24px 48px;">',
    '<p style="margin:0;font-size:11px;color:#AAAAAA;letter-spacing:0.5px;line-height:1.6;">',
    'MADE EVENTS &mdash; Gestione staffing eventi<br>',
    'Non rispondere a questa email &middot; noreply@madeevent.it',
    '</p>',
    '</td></tr>',

    '</table>',
    '</td></tr></table>',
    '</body></html>'
  ].join('\n');

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

  return sendEmail_(to, 'Completa la tua iscrizione — Made Event', html, text);
}

// ---------------------------------------------------------------------------
// TEMPLATE 9 — Profilo ricevuto (alla candidata dopo step 3)
// ---------------------------------------------------------------------------

function sendProfiloRicevutoEmail(to, nome) {
  var ACCENT = '#630E33';

  var html = [
    '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>',
    '<body style="margin:0;padding:0;background:#F6F6F6;font-family:\'Helvetica Neue\',Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F6;padding:40px 16px;">',
    '<tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;">',
    '<tr><td style="background:' + ACCENT + ';padding:40px 48px 36px;">',
    '<p style="margin:0 0 16px;font-size:11px;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.6);">MADE EVENTS</p>',
    '<h1 style="margin:0;font-size:24px;font-weight:300;letter-spacing:1.5px;color:#FFFFFF;line-height:1.3;">Profilo ricevuto ✓</h1>',
    '</td></tr>',
    '<tr><td style="padding:48px;">',
    '<p style="margin:0 0 8px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;font-weight:500;">Ciao ' + escapeHtml_(nome) + ',</p>',
    '<p style="margin:0 0 24px;font-size:15px;font-weight:300;color:#2E2E2E;line-height:1.8;">',
    'Il tuo profilo è stato ricevuto ed è ora in attesa di revisione da parte del team Made Event.',
    '</p>',
    '<div style="height:2px;background:' + ACCENT + ';margin:0 0 28px;width:48px;"></div>',
    '<p style="margin:0 0 8px;font-size:13px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;color:#2E2E2E;">Cosa succede ora</p>',
    '<p style="margin:0 0 6px;font-size:14px;font-weight:300;color:#6B6B6B;line-height:1.8;">1. Il team esamina il tuo profilo (solitamente 2–5 giorni lavorativi)</p>',
    '<p style="margin:0 0 6px;font-size:14px;font-weight:300;color:#6B6B6B;line-height:1.8;">2. Ricevi una email con l\'esito della valutazione</p>',
    '<p style="margin:0 0 32px;font-size:14px;font-weight:300;color:#6B6B6B;line-height:1.8;">3. Se approvata, accedi alla piattaforma e candidati agli eventi</p>',
    '<p style="margin:0;font-size:12px;color:#AAAAAA;">Non rispondere a questa email &middot; noreply@madeevent.it</p>',
    '</td></tr>',
    '<tr><td style="background:#FAFAFA;border-top:1px solid #EAEAEA;padding:20px 48px;">',
    '<p style="margin:0;font-size:11px;color:#AAAAAA;letter-spacing:0.5px;">MADE EVENTS &mdash; Gestione staffing eventi</p>',
    '</td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('\n');

  var text = 'Ciao ' + nome + ',\n\nIl tuo profilo è stato ricevuto ed è in attesa di revisione.\nTi contatteremo via email con l\'esito entro pochi giorni.\n\n— MADE EVENTS';
  return sendEmail_(to, 'Profilo ricevuto — in attesa di approvazione', html, text);
}

// ---------------------------------------------------------------------------
// TEMPLATE 10 — Nuovo profilo da approvare (all'admin)
// ---------------------------------------------------------------------------

function sendAdminNuovoProfilo(to, nome, cognome, score, leadId) {
  var ACCENT = '#630E33';
  var rankingLabel = score >= 80 ? 'A — Eccellente' : score >= 60 ? 'B — Buono' : score >= 40 ? 'C — Medio' : 'D — Base';

  var html = [
    '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>',
    '<body style="margin:0;padding:0;background:#F6F6F6;font-family:\'Helvetica Neue\',Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F6;padding:40px 16px;">',
    '<tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;">',
    '<tr><td style="background:#2E2E2E;padding:28px 48px;">',
    '<p style="margin:0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.5);">Made Event — Admin</p>',
    '<h1 style="margin:8px 0 0;font-size:20px;font-weight:400;color:#FFFFFF;">Nuovo profilo da approvare</h1>',
    '</td></tr>',
    '<tr><td style="padding:40px 48px;">',
    '<div style="background:#FAFAFA;border-left:4px solid ' + ACCENT + ';padding:20px 24px;margin-bottom:28px;border-radius:0 4px 4px 0;">',
    '<p style="margin:0 0 8px;font-size:14px;font-weight:500;color:#2E2E2E;">' + escapeHtml_(nome) + ' ' + escapeHtml_(cognome) + '</p>',
    '<p style="margin:0 0 4px;font-size:13px;color:#6B6B6B;">Score interno: <strong>' + score + '/100</strong></p>',
    '<p style="margin:0 0 4px;font-size:13px;color:#6B6B6B;">Ranking: <strong>' + rankingLabel + '</strong></p>',
    '<p style="margin:4px 0 0;font-size:11px;color:#AAAAAA;">Lead ID: ' + leadId + '</p>',
    '</div>',
    '<p style="font-size:14px;font-weight:300;color:#2E2E2E;line-height:1.7;">Accedi alla piattaforma per esaminare il profilo completo e procedere con approvazione o rifiuto.</p>',
    '</td></tr>',
    '<tr><td style="background:#FAFAFA;border-top:1px solid #EAEAEA;padding:20px 48px;">',
    '<p style="margin:0;font-size:11px;color:#AAAAAA;">MADE EVENTS — Sistema automatico</p>',
    '</td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('\n');

  var text = 'NUOVO PROFILO DA APPROVARE\n\nNome: ' + nome + ' ' + cognome + '\nScore: ' + score + '/100\nLead ID: ' + leadId + '\n\nAccedi alla piattaforma per approvare o rifiutare.\n\n— MADE EVENTS';
  return sendEmail_(to, 'Nuovo profilo da approvare — ' + nome + ' ' + cognome + ' [' + score + '/100]', html, text);
}

// ---------------------------------------------------------------------------
// TEMPLATE 11 — Sollecito completamento registrazione
// ---------------------------------------------------------------------------

function sendSollecitoEmail(to, nome, completionUrl, completati, mancanti) {
  var ACCENT = '#630E33';

  var completatiHtml = completati.map(function(s) {
    return '<li style="margin:4px 0;font-size:13px;color:#2E7D32;">✓ ' + escapeHtml_(s) + '</li>';
  }).join('');

  var mancantiHtml = mancanti.map(function(s) {
    return '<li style="margin:4px 0;font-size:13px;color:#C62828;">— ' + escapeHtml_(s) + '</li>';
  }).join('');

  var html = [
    '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>',
    '<body style="margin:0;padding:0;background:#F6F6F6;font-family:\'Helvetica Neue\',Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F6;padding:40px 16px;">',
    '<tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;">',
    '<tr><td style="background:' + ACCENT + ';padding:40px 48px 36px;">',
    '<p style="margin:0 0 16px;font-size:11px;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.6);">MADE EVENTS</p>',
    '<h1 style="margin:0;font-size:22px;font-weight:300;letter-spacing:1px;color:#FFFFFF;line-height:1.3;">Hai lasciato la registrazione a metà</h1>',
    '</td></tr>',
    '<tr><td style="padding:48px;">',
    '<p style="margin:0 0 8px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;font-weight:500;">Ciao ' + escapeHtml_(nome) + ',</p>',
    '<p style="margin:0 0 28px;font-size:15px;font-weight:300;color:#2E2E2E;line-height:1.8;">',
    'Stai completando la tua iscrizione a Made Event. Riprendi da dove ti eri fermata!',
    '</p>',
    completati.length ? '<p style="margin:0 0 8px;font-size:12px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;">Hai già compilato:</p><ul style="margin:0 0 24px;padding-left:20px;">' + completatiHtml + '</ul>' : '',
    mancanti.length   ? '<p style="margin:0 0 8px;font-size:12px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;">Manca ancora:</p><ul style="margin:0 0 32px;padding-left:20px;">' + mancantiHtml + '</ul>' : '',
    '<table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">',
    '<tr><td style="background:' + ACCENT + ';border-radius:4px;">',
    '<a href="' + escapeHtml_(completionUrl) + '" style="display:inline-block;padding:16px 36px;font-size:12px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">Riprendi la registrazione</a>',
    '</td></tr></table>',
    '<p style="margin:0;font-size:12px;color:#AAAAAA;">Il link è personale e valido per la tua registrazione.</p>',
    '</td></tr>',
    '<tr><td style="background:#FAFAFA;border-top:1px solid #EAEAEA;padding:20px 48px;">',
    '<p style="margin:0;font-size:11px;color:#AAAAAA;">MADE EVENTS &mdash; Non rispondere a questa email</p>',
    '</td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('\n');

  var text = 'Ciao ' + nome + ',\n\nHai lasciato la registrazione incompleta.\nRiprendi qui: ' + completionUrl + '\n\nManca ancora: ' + mancanti.join(', ') + '\n\n— MADE EVENTS';
  return sendEmail_(to, 'Completa la tua iscrizione — ' + (mancanti.length ? mancanti.length + ' sezioni mancanti' : 'quasi pronta!'), html, text);
}

// ---------------------------------------------------------------------------
// TEMPLATE 12 — Email personalizzata admin → talent
// ---------------------------------------------------------------------------

function sendCustomAdminEmail(to, nome, contenutoTesto, emailAdmin) {
  var ACCENT = '#630E33';

  var html = [
    '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>',
    '<body style="margin:0;padding:0;background:#F6F6F6;font-family:\'Helvetica Neue\',Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F6;padding:40px 16px;">',
    '<tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;">',
    '<tr><td style="background:' + ACCENT + ';padding:40px 48px 36px;">',
    '<p style="margin:0 0 16px;font-size:11px;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.6);">MADE EVENTS</p>',
    '<h1 style="margin:0;font-size:22px;font-weight:300;letter-spacing:1px;color:#FFFFFF;line-height:1.3;">Comunicazione dal team</h1>',
    '</td></tr>',
    '<tr><td style="padding:48px;">',
    '<p style="margin:0 0 8px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;font-weight:500;">Ciao ' + escapeHtml_(nome) + ',</p>',
    '<div style="height:2px;background:' + ACCENT + ';margin:16px 0 28px;width:48px;"></div>',
    '<div style="font-size:15px;font-weight:300;color:#2E2E2E;line-height:1.8;white-space:pre-wrap;">',
    escapeHtml_(contenutoTesto),
    '</div>',
    '<div style="margin-top:40px;padding-top:24px;border-top:1px solid #EAEAEA;">',
    '<p style="margin:0;font-size:12px;color:#AAAAAA;">',
    'Il team MADE EVENTS',
    emailAdmin ? ' &middot; ' + escapeHtml_(emailAdmin) : '',
    '</p>',
    '</div>',
    '</td></tr>',
    '<tr><td style="background:#FAFAFA;border-top:1px solid #EAEAEA;padding:20px 48px;">',
    '<p style="margin:0;font-size:11px;color:#AAAAAA;letter-spacing:0.5px;">MADE EVENTS &mdash; Gestione staffing eventi</p>',
    '</td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('\n');

  var text = 'Ciao ' + nome + ',\n\n' + contenutoTesto + '\n\n— Il team MADE EVENTS';
  return sendEmail_(to, 'Comunicazione dal team MADE EVENTS', html, text);
}

// ---------------------------------------------------------------------------
// TEMPLATE 13 — Invito social (admin → talent)
// ---------------------------------------------------------------------------

function sendSocialInviteEmail(to, nome, contenutoTesto) {
  var ACCENT = '#630E33';

  var html = [
    '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>',
    '<body style="margin:0;padding:0;background:#F6F6F6;font-family:\'Helvetica Neue\',Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F6;padding:40px 16px;">',
    '<tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;">',
    '<tr><td style="background:' + ACCENT + ';padding:40px 48px 36px;">',
    '<p style="margin:0 0 16px;font-size:11px;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.6);">MADE EVENTS</p>',
    '<h1 style="margin:0;font-size:22px;font-weight:300;letter-spacing:1px;color:#FFFFFF;line-height:1.3;">Seguici sui social 📱</h1>',
    '</td></tr>',
    '<tr><td style="padding:48px;">',
    '<p style="margin:0 0 8px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;font-weight:500;">Ciao ' + escapeHtml_(nome) + ',</p>',
    '<div style="height:2px;background:' + ACCENT + ';margin:16px 0 28px;width:48px;"></div>',
    '<div style="font-size:15px;font-weight:300;color:#2E2E2E;line-height:1.8;white-space:pre-wrap;">',
    escapeHtml_(contenutoTesto),
    '</div>',
    '<div style="margin-top:36px;display:flex;gap:12px;">',
    '<a href="https://www.instagram.com/madeevents" style="display:inline-block;background:' + ACCENT + ';color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:500;letter-spacing:1px;text-transform:uppercase;margin-right:8px;">Instagram</a>',
    '<a href="https://www.facebook.com/Made-Events" style="display:inline-block;background:#1877F2;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:500;letter-spacing:1px;text-transform:uppercase;">Facebook</a>',
    '</div>',
    '</td></tr>',
    '<tr><td style="background:#FAFAFA;border-top:1px solid #EAEAEA;padding:20px 48px;">',
    '<p style="margin:0;font-size:11px;color:#AAAAAA;letter-spacing:0.5px;">MADE EVENTS &mdash; Gestione staffing eventi</p>',
    '</td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('\n');

  var text = contenutoTesto + '\n\nInstagram: @madeevents\nFacebook: Made Events\n\n— Il team MADE EVENTS';
  return sendEmail_(to, 'Seguici sui social — MADE EVENTS', html, text);
}

// ---------------------------------------------------------------------------
// TEMPLATE 14 — Convocazione evento (admin → talent)
// ---------------------------------------------------------------------------

function sendConvocazioneEmail(to, nome, titoloEvento, dataEvento, luogoEvento, contenutoTesto) {
  var ACCENT = '#630E33';

  var eventoBlock = titoloEvento
    ? '<div style="background:#FAFAFA;border-left:4px solid ' + ACCENT + ';padding:16px 20px;margin-bottom:28px;border-radius:0 4px 4px 0;">' +
      '<p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#2E2E2E;">' + escapeHtml_(titoloEvento) + '</p>' +
      (dataEvento   ? '<p style="margin:0 0 4px;font-size:13px;color:#6B6B6B;">&#128197; ' + escapeHtml_(dataEvento)   + '</p>' : '') +
      (luogoEvento  ? '<p style="margin:0;font-size:13px;color:#6B6B6B;">&#128205; '       + escapeHtml_(luogoEvento)  + '</p>' : '') +
      '</div>'
    : '';

  var html = [
    '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>',
    '<body style="margin:0;padding:0;background:#F6F6F6;font-family:\'Helvetica Neue\',Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F6;padding:40px 16px;">',
    '<tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;">',
    '<tr><td style="background:' + ACCENT + ';padding:40px 48px 36px;">',
    '<p style="margin:0 0 16px;font-size:11px;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.6);">MADE EVENTS</p>',
    '<h1 style="margin:0;font-size:22px;font-weight:300;letter-spacing:1px;color:#FFFFFF;line-height:1.3;">Sei stata selezionata ✨</h1>',
    '</td></tr>',
    '<tr><td style="padding:48px;">',
    '<p style="margin:0 0 8px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6B6B6B;font-weight:500;">Ciao ' + escapeHtml_(nome) + ',</p>',
    '<div style="height:2px;background:' + ACCENT + ';margin:16px 0 28px;width:48px;"></div>',
    eventoBlock,
    '<div style="font-size:15px;font-weight:300;color:#2E2E2E;line-height:1.8;white-space:pre-wrap;">',
    escapeHtml_(contenutoTesto),
    '</div>',
    '<div style="margin-top:40px;padding-top:24px;border-top:1px solid #EAEAEA;">',
    '<p style="margin:0;font-size:12px;color:#AAAAAA;">Il team MADE EVENTS</p>',
    '</div>',
    '</td></tr>',
    '<tr><td style="background:#FAFAFA;border-top:1px solid #EAEAEA;padding:20px 48px;">',
    '<p style="margin:0;font-size:11px;color:#AAAAAA;letter-spacing:0.5px;">MADE EVENTS &mdash; Gestione staffing eventi</p>',
    '</td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('\n');

  var textHeader = titoloEvento
    ? titoloEvento + (dataEvento ? ' · ' + dataEvento : '') + (luogoEvento ? ' · ' + luogoEvento : '') + '\n\n'
    : '';
  var text = 'Ciao ' + nome + ',\n\n' + textHeader + contenutoTesto + '\n\n— Il team MADE EVENTS';
  return sendEmail_(to, 'Sei stata selezionata — ' + (titoloEvento || 'MADE EVENTS'), html, text);
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
