// === FISCAL_DATA.JS — MADE EVENT Platform ===
// Dati fiscali, bancari e documentali del talent: validatori e action
// talent.updateFiscal (USER, solo proprio profilo, scrittura DIRETTA senza PENDING_REVIEW).

// Campi scrivibili dal talent con talent.updateFiscal.
var FISCAL_WHITELIST_ = [
  'codice_fiscale', 'iban', 'intestatario_conto', 'partita_iva', 'regime_fiscale',
  'disponibile_chiamata', 'disponibile_ritenuta',
  'residenza_indirizzo', 'numero_documento', 'tipo_documento', 'scadenza_documento', 'stato_emissione_documento',
  'data_nascita', 'nascita_citta'
];

// Campi che il ramo USER di talent.updateProfile NON scrive più (passano solo da updateFiscal).
// Non include nascita_citta: resta nel salvataggio di S1.
var FISCAL_UPDATEPROFILE_USER_BLOCKED_ = [
  'codice_fiscale', 'partita_iva', 'iban', 'disponibile_chiamata', 'disponibile_ritenuta'
];

// Dati documento verificati dall'admin: sola lettura per il talent quando dati_documento_verificati è attivo.
var FISCAL_DOC_LOCKED_ = ['residenza_indirizzo', 'numero_documento', 'tipo_documento', 'scadenza_documento'];

var FISCAL_REGIMI_ = ['forfettario', 'ordinario', 'occasionale'];
var FISCAL_MAX_LEN_ = 200;
var FISCAL_ALERT_COOLDOWN_MS_ = 60 * 60 * 1000;

// Lunghezze IBAN per i paesi SEPA; gli altri paesi: 15-34 caratteri.
var IBAN_SEPA_LENGTHS_ = {
  AD:24, AT:20, BE:16, BG:22, CH:21, CY:28, CZ:24, DE:22, DK:18, EE:20, ES:24, FI:18, FR:27,
  GB:22, GI:23, GR:27, HR:21, HU:28, IE:22, IS:26, IT:27, LI:21, LT:20, LU:20, LV:21, MC:27,
  MT:31, NL:18, NO:15, PL:28, PT:25, RO:24, SE:24, SI:19, SK:24, SM:27, VA:22
};

// ---------------------------------------------------------------------------
// VALIDATORI (puri, senza accesso a Sheet)
// ---------------------------------------------------------------------------

function normalizeIban_(s) {
  return String(s == null ? '' : s).replace(/\s+/g, '').toUpperCase();
}

/** IBAN: formato, lunghezza per paese (SEPA) o 15-34, checksum mod 97. */
function isValidIban_(raw) {
  var iban = normalizeIban_(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;
  var expected = IBAN_SEPA_LENGTHS_[iban.substring(0, 2)];
  if (expected) {
    if (iban.length !== expected) return false;
  } else if (iban.length < 15 || iban.length > 34) {
    return false;
  }
  var rearranged = iban.substring(4) + iban.substring(0, 4);
  var rem = 0;
  for (var i = 0; i < rearranged.length; i++) {
    var ch = rearranged.charAt(i);
    var digits = (ch >= 'A' && ch <= 'Z') ? String(ch.charCodeAt(0) - 55) : ch;
    for (var j = 0; j < digits.length; j++) {
      rem = (rem * 10 + Number(digits.charAt(j))) % 97;
    }
  }
  return rem === 1;
}

var CF_ODD_DIGITS_  = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21];
var CF_ODD_LETTERS_ = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];

/** Codice fiscale: struttura (omocodia inclusa) e carattere di controllo. */
function isValidCodiceFiscale_(raw) {
  var cf = String(raw == null ? '' : raw).replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return false;
  var sum = 0;
  for (var i = 0; i < 15; i++) {
    var c = cf.charAt(i);
    var isDigit = c >= '0' && c <= '9';
    var idx = isDigit ? Number(c) : c.charCodeAt(0) - 65;
    if (i % 2 === 0) sum += isDigit ? CF_ODD_DIGITS_[idx] : CF_ODD_LETTERS_[idx];
    else sum += idx;
  }
  return String.fromCharCode(65 + (sum % 26)) === cf.charAt(15);
}

/** Partita IVA italiana: 11 cifre e checksum. */
function isValidPartitaIva_(raw) {
  var p = String(raw == null ? '' : raw).replace(/\s+/g, '');
  if (!/^\d{11}$/.test(p)) return false;
  var sum = 0;
  for (var i = 0; i < 10; i++) {
    var d = Number(p.charAt(i));
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(p.charAt(10));
}

/** 'GG/MM/AAAA' → {y,m,d} se è una data reale, altrimenti null. */
function parseItalianDate_(s) {
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s == null ? '' : s).trim());
  if (!m) return null;
  var y = Number(m[3]), mo = Number(m[2]), d = Number(m[1]);
  var dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y: y, m: mo, d: d, iso: m[3] + '-' + m[2] + '-' + m[1] };
}

/** Data odierna (fuso Europe/Rome) come 'AAAA-MM-GG'. */
function todayRomeIso_() {
  return Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd');
}

/** Nome normalizzato per il confronto intestatario/talent: senza accenti, ordine parole indifferente. */
function normalizeNameTokens_(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z\s]/g, ' ')
    .split(/\s+/).filter(Boolean).sort().join(' ');
}

// ---------------------------------------------------------------------------
// NORMALIZZAZIONE + VALIDAZIONE DI UN CAMPO
// ---------------------------------------------------------------------------

function fiscalCanonical_(field, raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (field === 'iban') return normalizeIban_(s);
  if (field === 'codice_fiscale') return s.replace(/\s+/g, '').toUpperCase();
  if (field === 'partita_iva') return s.replace(/\s+/g, '');
  if (field === 'regime_fiscale') return s.toLowerCase();
  if (field === 'tipo_documento') return s.toLowerCase();
  return s.replace(/\s+/g, ' ');
}

function fiscalErr_(field, msg) {
  return { error: errorResponse('VAL_002', msg, field) };
}

/**
 * Valida un valore già canonico (non vuoto) per il campo.
 * @returns {null|{error: object}}
 */
function validateFiscalValue_(field, value) {
  if (value.length > FISCAL_MAX_LEN_) return fiscalErr_(field, field + ' troppo lungo (max ' + FISCAL_MAX_LEN_ + ' caratteri)');
  switch (field) {
    case 'codice_fiscale':
      return isValidCodiceFiscale_(value) ? null : fiscalErr_(field, 'Codice fiscale non valido');
    case 'iban':
      return isValidIban_(value) ? null : fiscalErr_(field, 'IBAN non valido');
    case 'partita_iva':
      return isValidPartitaIva_(value) ? null : fiscalErr_(field, 'Partita IVA non valida');
    case 'regime_fiscale':
      return FISCAL_REGIMI_.indexOf(value) !== -1 ? null : fiscalErr_(field, 'regime_fiscale deve essere uno di: ' + FISCAL_REGIMI_.join(', '));
    case 'tipo_documento':
      return TIPI_DOCUMENTO_.indexOf(value) !== -1 ? null : fiscalErr_(field, 'tipo_documento deve essere uno di: ' + TIPI_DOCUMENTO_.join(', '));
    case 'disponibile_chiamata':
    case 'disponibile_ritenuta':
      return (value === 'Sì' || value === 'No') ? null : fiscalErr_(field, field + " deve essere 'Sì' o 'No'");
    case 'scadenza_documento':
      if (!isIsoDate_(value)) return fiscalErr_(field, 'scadenza_documento deve essere una data valida (AAAA-MM-GG)');
      return value < todayRomeIso_() ? fiscalErr_(field, 'Documento scaduto') : null;
    case 'data_nascita':
      var dn = parseItalianDate_(value);
      if (!dn) return fiscalErr_(field, 'data_nascita deve essere una data valida (GG/MM/AAAA)');
      if (dn.y < 1900) return fiscalErr_(field, 'data_nascita non valida (anno precedente al 1900)');
      return dn.iso > todayRomeIso_() ? fiscalErr_(field, 'data_nascita non può essere futura') : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// HANDLER — talent.updateFiscal
// ---------------------------------------------------------------------------

function handleTalentUpdateFiscal(payload, auth) {
  var perm = checkPermission(auth.role, 'talent.updateFiscal');
  if (!perm.allowed) return errorResponse('AUTH_005', 'Permesso insufficiente per: talent.updateFiscal');

  // Il profilo si risale SEMPRE dall'utente autenticato: entity_id del payload è ignorato.
  var profile = findTalentProfileByUserId_(auth.user_id, auth.tenant_id);
  if (!profile || String(profile.deleted).toLowerCase() === 'true') {
    return errorResponse('SYS_002', 'Profilo talent non trovato');
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
  } catch (lockErr) {
    return errorResponse('SYS_001', 'Server occupato, riprova tra qualche secondo');
  }

  var result;
  try {
    result = applyFiscalUpdate_(profile.entity_id, payload || {}, auth);
  } finally {
    lock.releaseLock();
  }

  // Mail fuori dal lock: più lente e non devono tenere bloccate le altre scritture.
  if (result.alert) sendFiscalAlerts_(result.alert, auth);
  return result.response;
}

/** Corpo della scrittura (da chiamare con il lock acquisito). @returns {{response:object, alert:(object|null)}} */
function applyFiscalUpdate_(entityId, payload, auth) {
  var fail = function(resp) { return { response: resp, alert: null }; };

  var entity = getEntityById(entityId, auth.tenant_id);
  if (!entity || entity.type !== 'TALENT_PROFILE') return fail(errorResponse('SYS_002', 'Profilo talent non trovato'));
  var st = ENTITY_STATUS.TALENT_PROFILE;
  if (entity.status !== st.APPROVED && entity.status !== st.ACTIVE && entity.status !== st.PENDING_REVIEW) {
    return fail(errorResponse('WF_002', 'Profilo non modificabile in stato ' + entity.status));
  }

  var cur = entity.data || {};
  var changes = {};

  for (var i = 0; i < FISCAL_WHITELIST_.length; i++) {
    var f = FISCAL_WHITELIST_[i];
    if (payload[f] === undefined) continue;

    var value = fiscalCanonical_(f, payload[f]);
    if (value === '') {
      // Vuoto = "non modificare", tranne partita_iva che si può svuotare (regime occasionale).
      if (f === 'partita_iva' && fiscalCanonical_(f, cur[f]) !== '') changes[f] = '';
      continue;
    }
    if (value === fiscalCanonical_(f, cur[f])) continue;   // invariato: niente validazione (dati legacy intatti)

    var bad = validateFiscalValue_(f, value);
    if (bad) return fail(bad.error);

    if (FISCAL_DOC_LOCKED_.indexOf(f) !== -1 && cur.dati_documento_verificati === true && !isBlank_(cur[f])) {
      return fail(errorResponse('WF_002', 'Dato verificato dal team: contatta il team per modificarlo', f));
    }
    changes[f] = value;
  }

  var merged = Object.assign({}, cur, changes);

  if (isBlank_(merged.codice_fiscale)) {
    return fail(errorResponse('VAL_002', 'Codice fiscale obbligatorio', 'codice_fiscale'));
  }
  if ((changes.regime_fiscale !== undefined || changes.partita_iva !== undefined) &&
      (merged.regime_fiscale === 'forfettario' || merged.regime_fiscale === 'ordinario') &&
      isBlank_(merged.partita_iva)) {
    return fail(errorResponse('VAL_002', 'Partita IVA obbligatoria per il regime scelto', 'partita_iva'));
  }

  // Intestatario diverso dal nome del talent → segnalazione all'admin.
  var intestatarioDiversoNuovo = false;
  if (changes.intestatario_conto !== undefined) {
    var diverso = normalizeNameTokens_(changes.intestatario_conto) !== normalizeNameTokens_([cur.nome, cur.cognome].join(' '));
    changes.intestatario_diverso = diverso;
    intestatarioDiversoNuovo = diverso && cur.intestatario_diverso !== true;
  }
  // Cambio IBAN: solo dal secondo valore in poi (mai alla prima impostazione).
  var ibanCambiato = changes.iban !== undefined && fiscalCanonical_('iban', cur.iban) !== '';

  // Pulizia di pending_data: un valore vecchio in attesa non deve sovrascrivere quello appena scritto all'approvazione.
  var pending = cur.pending_data;
  var pendingPulito = false;
  if (pending && typeof pending === 'object') {
    pending = Object.assign({}, pending);
    var daPulire = Object.keys(changes).concat(FISCAL_UPDATEPROFILE_USER_BLOCKED_);
    for (var p = 0; p < daPulire.length; p++) {
      if (Object.prototype.hasOwnProperty.call(pending, daPulire[p])) { delete pending[daPulire[p]]; pendingPulito = true; }
    }
  }

  if (Object.keys(changes).length === 0 && !pendingPulito) {
    return { response: successResponse({ talent: talentToPublic(entity, auth.role), changed: [] }), alert: null };
  }

  var data = Object.assign({}, merged, changes);
  var nuovoStato = entity.status;
  if (pendingPulito) {
    if (Object.keys(pending).length === 0) {
      delete data.pending_data;
      delete data.pending_submitted_at;
      if (entity.status === st.PENDING_REVIEW) nuovoStato = st.APPROVED;
    } else {
      data.pending_data = pending;
    }
  }

  // Avviso (talent + admin): al massimo una coppia di mail l'ora per profilo.
  var alert = null;
  if (ibanCambiato || intestatarioDiversoNuovo) {
    var last = cur.fiscal_alert_sent_at ? new Date(cur.fiscal_alert_sent_at).getTime() : 0;
    if (last && !isNaN(last) && (Date.now() - last) < FISCAL_ALERT_COOLDOWN_MS_) {
      logActivity({ level: 'WARN', module: 'FISCAL', action: 'talent.updateFiscal.alertSuppressed',
        entity_type: 'TALENT_PROFILE', entity_id: entity.entity_id, user_id: auth.user_id, tenant_id: auth.tenant_id,
        note: 'avviso soppresso (cooldown 1h)' });
    } else {
      data.fiscal_alert_sent_at = new Date().toISOString();
      alert = {
        entity_id:  entity.entity_id,
        tenant_id:  auth.tenant_id,
        nome:       cur.nome || '',
        cognome:    cur.cognome || '',
        to:         cur.email_contatto || cur.email || auth.email || '',
        ibanCambiato: ibanCambiato,
        intestatarioDiverso: intestatarioDiversoNuovo
      };
    }
  }

  var update = { data: serializeJSON(data) };
  if (nuovoStato !== entity.status) update.status = nuovoStato;
  updateRow('Entities', entity.entity_id, update);

  var campi = Object.keys(changes).filter(function(k) { return k !== 'intestatario_diverso'; });
  logActivity({
    level: ibanCambiato ? 'WARN' : 'INFO', module: 'FISCAL', action: 'talent.updateFiscal',
    entity_type: 'TALENT_PROFILE', entity_id: entity.entity_id, user_id: auth.user_id, tenant_id: auth.tenant_id,
    note: 'campi=' + campi.join(',') + (ibanCambiato ? ' IBAN_CAMBIATO' : '') + (intestatarioDiversoNuovo ? ' INTESTATARIO_DIVERSO' : '') +
          (nuovoStato !== entity.status ? ' stato=' + nuovoStato : '')
  });

  entity.data = data;
  entity.status = nuovoStato;
  return { response: successResponse({ talent: talentToPublic(entity, auth.role), changed: campi }), alert: alert };
}

/** Invia le mail di avviso (priorità alta: segnali antifrode, ignorano la riserva quota). Non lancia. */
function sendFiscalAlerts_(alert, auth) {
  var ctx = { entity_type: 'TALENT_PROFILE', entity_id: alert.entity_id, tenant_id: alert.tenant_id, actor: auth.user_id };
  try {
    if (alert.ibanCambiato && alert.to) sendIbanChangedEmail(alert.to, alert.nome, ctx);
  } catch (e) {
    logError_({ severity: 'ERROR', module: 'FISCAL', action: 'talent.updateFiscal.mailTalent', entity_type: 'TALENT_PROFILE',
      entity_id: alert.entity_id, tenant_id: alert.tenant_id, message: 'Mail avviso IBAN al talent: ' + e.message, stack: e.stack });
  }
  try {
    var adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (!adminEmail) {
      logError_({ severity: 'WARN', module: 'FISCAL', action: 'talent.updateFiscal.mailAdmin', entity_type: 'TALENT_PROFILE',
        entity_id: alert.entity_id, tenant_id: alert.tenant_id, message: 'ADMIN_EMAIL non impostato: avviso admin non inviato' });
      return;
    }
    var motivi = [];
    if (alert.ibanCambiato) motivi.push('IBAN modificato');
    if (alert.intestatarioDiverso) motivi.push('Intestatario del conto diverso dal nome del talent');
    sendAdminFiscalAlertEmail(adminEmail, alert.nome, alert.cognome, motivi, ctx);
  } catch (e2) {
    logError_({ severity: 'ERROR', module: 'FISCAL', action: 'talent.updateFiscal.mailAdmin', entity_type: 'TALENT_PROFILE',
      entity_id: alert.entity_id, tenant_id: alert.tenant_id, message: 'Mail avviso admin: ' + e2.message, stack: e2.stack });
  }
}
