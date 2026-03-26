// === JOBS.JS — MADE EVENT Platform v1.0 ===
// Cron job schedulati (PRD BLOCK:JOBS).
//
// JOB                  FREQ          FUNZIONE
// reminderEvent        30min         reminder 24h e 2h pre-shift (talent+admin)
// noShowCheck          15min         CONFIRMED senza checkin dopo 30min → NO_SHOW
// documentExpiry       giorno 09:00  scadenza documenti → reminder/blocco
// dailyMaintenance     giorno 03:00  cleanup token, report errori, contatori
// monthlyArchive       1° mese 02:00 archivia entità oltre retention, ruota log
//
// REGOLE:
//   - Ogni job wrappato in try/catch isolato (fallimento non blocca gli altri)
//   - Ogni job logga inizio, fine, contatori (INFO)
//   - Tutti idempotenti: esecuzione doppia = stesso risultato
//   - Errore critico (3 fallimenti consecutivi) → email admin
//
// SETUP TRIGGER (eseguire una sola volta da Editor GAS):
//   setupAllTriggers()   → installa tutti i trigger temporali
//   removeAllTriggers()  → rimuove tutti i trigger (per reset)

// ---------------------------------------------------------------------------
// TRIGGER SETUP
// ---------------------------------------------------------------------------

/**
 * Installa tutti i trigger GAS per i job schedulati.
 * Eseguire UNA SOLA VOLTA dal menu Esegui → setupAllTriggers.
 */
function setupAllTriggers() {
  // Rimuovi trigger esistenti per evitare duplicati
  removeAllTriggers();

  // reminderEvent: ogni 30 minuti
  ScriptApp.newTrigger('jobReminderEvent')
    .timeBased()
    .everyMinutes(30)
    .create();

  // noShowCheck: ogni 15 minuti
  ScriptApp.newTrigger('jobNoShowCheck')
    .timeBased()
    .everyMinutes(15)
    .create();

  // documentExpiry: ogni giorno alle 09:00
  ScriptApp.newTrigger('jobDocumentExpiry')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  // dailyMaintenance: ogni giorno alle 03:00
  ScriptApp.newTrigger('jobDailyMaintenance')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();

  // monthlyArchive: ogni mese (approssimato con trigger settimanale + check interno)
  ScriptApp.newTrigger('jobMonthlyArchive')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(2)
    .create();

  // registrationSolleciti: ogni ora
  ScriptApp.newTrigger('jobRegistrationSolleciti')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('[JOBS] Tutti i trigger installati correttamente.');
}

/**
 * Installa SOLO il trigger per i solleciti registrazione.
 * Da eseguire dal GAS Editor se setupAllTriggers() era già stato chiamato
 * prima di aggiungere questo job, oppure la prima volta per attivare solo questo.
 * Non tocca i trigger esistenti.
 */
function setupTriggers() {
  // Rimuovi eventuali trigger duplicati per jobRegistrationSolleciti
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'jobRegistrationSolleciti') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('jobRegistrationSolleciti')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('[JOBS] Trigger jobRegistrationSolleciti (ogni ora) installato.');
}

/**
 * Rimuove tutti i trigger esistenti dello script.
 */
function removeAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  Logger.log('[JOBS] ' + triggers.length + ' trigger rimossi.');
}

// ---------------------------------------------------------------------------
// JOB 1 — reminderEvent (ogni 30 min)
// ---------------------------------------------------------------------------

/**
 * Invia reminder 24h e 2h pre-shift ai talent assegnati.
 * Idempotente: usa i flag reminder_24h_sent / reminder_2h_sent nell'assignment.
 */
function jobReminderEvent() {
  var jobName = 'reminderEvent';
  var stats   = { checked: 0, sent24h: 0, sent2h: 0, errors: 0 };

  logJobStart_(jobName);
  try {
    var tenants = getAllRows('Tenants');

    tenants.forEach(function(tenant) {
      if (tenant.status !== 'active') return;
      var tenantId = tenant.tenant_id;

      // Tutti gli assignment CONFIRMED del tenant
      var assignments = getAllRows('Entities').filter(function(e) {
        return e.type === 'ASSIGNMENT' &&
               String(e.tenant_id) === String(tenantId) &&
               e.status === ENTITY_STATUS.ASSIGNMENT.CONFIRMED &&
               String(e.deleted).toLowerCase() !== 'true';
      });

      assignments.forEach(function(a) {
        try {
          stats.checked++;
          var d = parseJSON(a.data);

          // Recupera shift
          var shift = getEntityById(d.shift_id, tenantId);
          if (!shift || !shift.data.data || !shift.data.orario_inizio) return;

          var shiftStart = parseShiftStart_(shift.data);
          if (!shiftStart) return;

          var now      = Date.now();
          var diffMs   = shiftStart - now;
          var h24Ms    = 24 * 60 * 60 * 1000;
          var h2Ms     =  2 * 60 * 60 * 1000;

          // Recupera talent
          var talentProfile = getEntityById(d.talent_profile_id, tenantId);
          if (!talentProfile) return;
          var talentEmail = talentProfile.data.email_contatto;
          var talentNome  = (talentProfile.data.nome || '') + ' ' + (talentProfile.data.cognome || '');

          // Reminder 24h: meno di 24h ma ancora nel futuro, e non ancora inviato
          if (diffMs > 0 && diffMs <= h24Ms && !parseBool_(d.reminder_24h_sent)) {
            var sent = sendReminder24hEmail(talentEmail, talentNome, shift.data);
            if (sent) {
              updateEntityData(a.entity_id, { reminder_24h_sent: true }, tenantId, 'system');
              stats.sent24h++;
            }
          }

          // Reminder 2h: meno di 2h ma ancora nel futuro, e non ancora inviato
          if (diffMs > 0 && diffMs <= h2Ms && !parseBool_(d.reminder_2h_sent)) {
            var sent2 = sendReminder2hEmail(talentEmail, talentNome, shift.data);
            if (sent2) {
              updateEntityData(a.entity_id, { reminder_2h_sent: true }, tenantId, 'system');
              stats.sent2h++;
            }
          }

        } catch (e) {
          stats.errors++;
          Logger.log('[' + jobName + '] Errore su assignment ' + a.entity_id + ': ' + e.message);
        }
      });
    });

  } catch (e) {
    logJobError_(jobName, e);
    return;
  }

  logJobEnd_(jobName, stats);
}

// ---------------------------------------------------------------------------
// JOB 2 — noShowCheck (ogni 15 min)
// ---------------------------------------------------------------------------

/**
 * Marca come NO_SHOW gli assignment CONFIRMED il cui shift è iniziato
 * da più di 30 minuti senza che il talent abbia fatto check-in.
 * Idempotente: lo stato NO_SHOW non viene riapplicato.
 */
function jobNoShowCheck() {
  var jobName = 'noShowCheck';
  var stats   = { checked: 0, noShow: 0, errors: 0 };
  var thirtyMinMs = 30 * 60 * 1000;

  logJobStart_(jobName);
  try {
    var now     = Date.now();
    var tenants = getAllRows('Tenants');

    tenants.forEach(function(tenant) {
      if (tenant.status !== 'active') return;
      var tenantId = tenant.tenant_id;

      var assignments = getAllRows('Entities').filter(function(e) {
        return e.type === 'ASSIGNMENT' &&
               String(e.tenant_id) === String(tenantId) &&
               e.status === ENTITY_STATUS.ASSIGNMENT.CONFIRMED &&
               String(e.deleted).toLowerCase() !== 'true';
      });

      assignments.forEach(function(a) {
        try {
          stats.checked++;
          var d = parseJSON(a.data);

          var shift = getEntityById(d.shift_id, tenantId);
          if (!shift) return;

          var shiftStart = parseShiftStart_(shift.data);
          if (!shiftStart) return;

          // No-show: shift iniziato da più di 30 min e check-in non fatto
          if (now > shiftStart + thirtyMinMs) {
            // Transiziona NO_SHOW
            updateRow('Entities', a.entity_id, { status: ENTITY_STATUS.ASSIGNMENT.NO_SHOW });

            logStateTransition('ASSIGNMENT', a.entity_id,
              ENTITY_STATUS.ASSIGNMENT.CONFIRMED, ENTITY_STATUS.ASSIGNMENT.NO_SHOW,
              'system', tenantId, 'assignment.no_show_auto');

            stats.noShow++;

            // Alert admin (best-effort)
            try {
              var adminEmail  = getAdminEmail_(tenantId);
              var talentProfile = getEntityById(d.talent_profile_id, tenantId);
              if (adminEmail && talentProfile) {
                sendNoShowAlertEmail(
                  adminEmail,
                  (talentProfile.data.nome || '') + ' ' + (talentProfile.data.cognome || ''),
                  talentProfile.data.email_contatto || '',
                  shift.data,
                  a.entity_id
                );
              }
            } catch (emailErr) {
              Logger.log('[' + jobName + '] Email no-show alert fallita: ' + emailErr.message);
            }
          }
        } catch (e) {
          stats.errors++;
          Logger.log('[' + jobName + '] Errore su assignment ' + a.entity_id + ': ' + e.message);
        }
      });
    });

  } catch (e) {
    logJobError_(jobName, e);
    return;
  }

  logJobEnd_(jobName, stats);
}

// ---------------------------------------------------------------------------
// JOB 3 — documentExpiry (ogni giorno alle 09:00)
// ---------------------------------------------------------------------------

/**
 * Controlla scadenza documenti nei TALENT_PROFILE.
 * - Scadenza < 30gg: alert admin
 * - Scadenza < 0gg (scaduto): marca documento expired, blocca nuove assegnazioni
 * Idempotente: controlla lo status corrente del documento prima di agire.
 */
function jobDocumentExpiry() {
  var jobName = 'documentExpiry';
  var stats   = { checked: 0, expiring: 0, expired: 0, errors: 0 };

  logJobStart_(jobName);
  try {
    var now30  = new Date(); now30.setDate(now30.getDate() + 30);
    var now60  = new Date(); now60.setDate(now60.getDate() + 60);
    var today  = new Date();
    var tenants = getAllRows('Tenants');

    tenants.forEach(function(tenant) {
      if (tenant.status !== 'active') return;
      var tenantId = tenant.tenant_id;

      var profiles = getAllRows('Entities').filter(function(e) {
        return e.type === 'TALENT_PROFILE' &&
               String(e.tenant_id) === String(tenantId) &&
               String(e.deleted).toLowerCase() !== 'true';
      });

      profiles.forEach(function(p) {
        try {
          stats.checked++;
          var data = parseJSON(p.data);
          var docs = data.documenti || {};
          var updated = false;

          for (var tipo in docs) {
            var doc = docs[tipo];
            if (!doc || !doc.scadenza || doc.status === 'deleted') continue;

            var scadenza = new Date(doc.scadenza);
            if (isNaN(scadenza.getTime())) continue;

            var giorniMancanti = Math.floor((scadenza - today) / (1000 * 60 * 60 * 24));

            if (giorniMancanti < 0 && doc.status !== 'expired') {
              // Documento scaduto
              docs[tipo].status = 'expired';
              updated = true;
              stats.expired++;

              logActivity({
                level: 'WARNING', module: 'JOBS', action: 'document.expired',
                entity_type: 'TALENT_PROFILE', entity_id: p.entity_id,
                tenant_id: tenantId,
                note: 'tipo=' + tipo + ' scadenza=' + doc.scadenza
              });

              // Notifica talent
              try {
                if (data.email_contatto) {
                  sendDocumentExpiryEmail(data.email_contatto, data.nome || '', tipo, 0);
                }
              } catch (e) {}

            } else if (giorniMancanti >= 0 && giorniMancanti <= 30 && doc.status !== 'expiring_soon') {
              // Documento in scadenza entro 30 giorni
              docs[tipo].status = 'expiring_soon';
              updated = true;
              stats.expiring++;

              // Notifica talent
              try {
                if (data.email_contatto) {
                  sendDocumentExpiryEmail(data.email_contatto, data.nome || '', tipo, giorniMancanti);
                }
              } catch (e) {}
            }
          }

          if (updated) {
            updateEntityData(p.entity_id, { documenti: docs }, tenantId, 'system');
          }

        } catch (e) {
          stats.errors++;
          Logger.log('[' + jobName + '] Errore su profile ' + p.entity_id + ': ' + e.message);
        }
      });
    });

  } catch (e) {
    logJobError_(jobName, e);
    return;
  }

  logJobEnd_(jobName, stats);
}

// ---------------------------------------------------------------------------
// JOB 4 — dailyMaintenance (ogni giorno alle 03:00)
// ---------------------------------------------------------------------------

/**
 * Manutenzione quotidiana:
 *   - Ricalcola posti_confermati su tutti gli shift aperti
 *   - Conta e logga errori delle ultime 24h
 *   - Log riepilogo giornaliero
 */
function jobDailyMaintenance() {
  var jobName = 'dailyMaintenance';
  var stats   = { shiftsRecalculated: 0, errorsLast24h: 0, errors: 0 };

  logJobStart_(jobName);
  try {
    var tenants = getAllRows('Tenants');

    tenants.forEach(function(tenant) {
      if (tenant.status !== 'active') return;
      var tenantId = tenant.tenant_id;

      // Ricalcola posti_confermati per tutti gli shift non cancellati
      var shifts = getAllRows('Entities').filter(function(e) {
        return e.type === 'SHIFT' &&
               String(e.tenant_id) === String(tenantId) &&
               e.status !== ENTITY_STATUS.SHIFT.CANCELLED &&
               String(e.deleted).toLowerCase() !== 'true';
      });

      shifts.forEach(function(s) {
        try {
          checkShiftFullness_(s.entity_id, tenantId);
          stats.shiftsRecalculated++;
        } catch (e) {
          stats.errors++;
          Logger.log('[' + jobName + '] Errore ricalcolo shift ' + s.entity_id + ': ' + e.message);
        }
      });
    });

    // Conta errori nelle ultime 24h
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    try {
      var errorRows = getAllRows('ErrorLog');
      stats.errorsLast24h = errorRows.filter(function(r) {
        return r.timestamp && new Date(r.timestamp) > yesterday;
      }).length;
    } catch (e) {}

    // Log riepilogo nel DeployLog (usato come sistema log)
    logActivity({
      level:  'INFO',
      module: 'JOBS',
      action: 'daily.maintenance',
      note:   JSON.stringify(stats)
    });

  } catch (e) {
    logJobError_(jobName, e);
    return;
  }

  logJobEnd_(jobName, stats);
}

// ---------------------------------------------------------------------------
// JOB 5 — monthlyArchive (1° del mese alle 02:00, check interno)
// ---------------------------------------------------------------------------

/**
 * Archiviazione mensile:
 *   - Esegue solo il 1° giorno del mese (trigger settimanale con check interno)
 *   - Soft-delete LEAD_TALENT REJECTED/PARTIAL più vecchi di 12 mesi
 *   - Soft-delete LEAD_TALENT non approvati più vecchi di 12 mesi
 *   - Log riepilogo
 * Non tocca ASSIGNMENT/TIMESHEET (retention 60 mesi per obblighi contabili).
 */
function jobMonthlyArchive() {
  // Esegui solo il 1° del mese
  var today = new Date();
  if (today.getDate() !== 1) {
    Logger.log('[monthlyArchive] Non è il 1° del mese, skip.');
    return;
  }

  var jobName = 'monthlyArchive';
  var stats   = { archivedLeads: 0, errors: 0 };
  var cutoff12m = new Date();
  cutoff12m.setMonth(cutoff12m.getMonth() - 12);

  logJobStart_(jobName);
  try {
    var tenants = getAllRows('Tenants');

    tenants.forEach(function(tenant) {
      if (tenant.status !== 'active') return;
      var tenantId = tenant.tenant_id;

      // Archivia LEAD_TALENT REJECTED/PARTIAL più vecchi di 12 mesi
      var leads = getAllRows('Entities').filter(function(e) {
        return e.type === 'LEAD_TALENT' &&
               String(e.tenant_id) === String(tenantId) &&
               String(e.deleted).toLowerCase() !== 'true' &&
               (e.status === ENTITY_STATUS.LEAD_TALENT.REJECTED ||
                e.status === ENTITY_STATUS.LEAD_TALENT.PARTIAL);
      });

      leads.forEach(function(lead) {
        try {
          var createdAt = new Date(lead.created_at);
          if (isNaN(createdAt.getTime())) return;
          if (createdAt > cutoff12m) return; // non ancora scaduto

          softDelete('Entities', lead.entity_id, 'system');
          stats.archivedLeads++;

          logActivity({
            level:       'INFO',
            module:      'JOBS',
            action:      'lead.archived',
            entity_type: 'LEAD_TALENT',
            entity_id:   lead.entity_id,
            tenant_id:   tenantId,
            note:        'retention 12 mesi scaduta, stato: ' + lead.status
          });

        } catch (e) {
          stats.errors++;
          Logger.log('[' + jobName + '] Errore su lead ' + lead.entity_id + ': ' + e.message);
        }
      });
    });

  } catch (e) {
    logJobError_(jobName, e);
    return;
  }

  logJobEnd_(jobName, stats);
}

// ---------------------------------------------------------------------------
// JOB 6 — registrationSolleciti (ogni ora)
// ---------------------------------------------------------------------------

/**
 * Controlla tutti i LEAD_TALENT in stato PARTIAL (registrazione non completata)
 * e invia solleciti via email in base all'inattività dall'ultimo accesso.
 *
 * Livelli di sollecito (idempotenti — un solo invio per livello per lead):
 *   Livello 1: ultimo_accesso > 24h  → primo promemoria
 *   Livello 2: ultimo_accesso > 72h  → secondo sollecito
 *   Livello 3: ultimo_accesso > 7gg  → sollecito finale
 *
 * Idempotenza: ogni livello viene inviato una sola volta grazie ai flag
 * sollecito_1_inviato / sollecito_2_inviato / sollecito_finale_inviato
 * scritti nel dato del lead dopo l'invio.
 *
 * Usa inviaEmailSollecito(leadId) da RegistrationFlow.js che calcola
 * autonomamente campi completati e mancanti.
 */
function jobRegistrationSolleciti() {
  var jobName = 'registrationSolleciti';
  var stats   = { checked: 0, sent1: 0, sent2: 0, sentFinale: 0, skip: 0, errors: 0 };

  var H24   = 24 * 60 * 60 * 1000;
  var H72   = 72 * 60 * 60 * 1000;
  var D7    =  7 * 24 * 60 * 60 * 1000;

  logJobStart_(jobName);
  try {
    var now  = Date.now();
    var all  = getAllRows('Entities');

    var leads = all.filter(function(e) {
      return e.type === 'LEAD_TALENT' &&
             e.status === ENTITY_STATUS.LEAD_TALENT.PARTIAL &&
             String(e.deleted).toLowerCase() !== 'true';
    });

    leads.forEach(function(lead) {
      try {
        stats.checked++;
        var d = parseJSON(lead.data);

        // Salta se non c'è email
        if (!d.email) { stats.skip++; return; }

        // Tempo di riferimento: ultimo_accesso se disponibile, altrimenti data creazione
        var refTimeStr = d.ultimo_accesso || d.registration_started_at || lead.created_at;
        if (!refTimeStr) { stats.skip++; return; }
        var refTime = new Date(refTimeStr).getTime();
        if (isNaN(refTime)) { stats.skip++; return; }

        var inattivita = now - refTime;

        // --- Livello 3 (> 7 giorni) — controllo prima per priorità decrescente ---
        if (inattivita > D7 && !d.sollecito_finale_inviato) {
          var ok3 = inviaEmailSollecito(lead.entity_id);
          if (ok3) {
            updateEntityData(lead.entity_id, { sollecito_finale_inviato: new Date().toISOString() }, null, 'system');
            stats.sentFinale++;
            logActivity({
              level: 'INFO', module: 'JOBS', action: 'registration.sollecito_finale',
              entity_type: 'LEAD_TALENT', entity_id: lead.entity_id,
              note: 'inattivita_giorni=' + Math.floor(inattivita / D7 * 7)
            });
          }
          return; // un solo livello per esecuzione
        }

        // --- Livello 2 (> 72h) ---
        if (inattivita > H72 && !d.sollecito_2_inviato) {
          var ok2 = inviaEmailSollecito(lead.entity_id);
          if (ok2) {
            updateEntityData(lead.entity_id, { sollecito_2_inviato: new Date().toISOString() }, null, 'system');
            stats.sent2++;
            logActivity({
              level: 'INFO', module: 'JOBS', action: 'registration.sollecito_2',
              entity_type: 'LEAD_TALENT', entity_id: lead.entity_id,
              note: 'inattivita_ore=' + Math.floor(inattivita / H24 * 24)
            });
          }
          return;
        }

        // --- Livello 1 (> 24h) ---
        if (inattivita > H24 && !d.sollecito_1_inviato) {
          var ok1 = inviaEmailSollecito(lead.entity_id);
          if (ok1) {
            updateEntityData(lead.entity_id, { sollecito_1_inviato: new Date().toISOString() }, null, 'system');
            stats.sent1++;
            logActivity({
              level: 'INFO', module: 'JOBS', action: 'registration.sollecito_1',
              entity_type: 'LEAD_TALENT', entity_id: lead.entity_id,
              note: 'inattivita_ore=' + Math.floor(inattivita / H24 * 24)
            });
          }
          return;
        }

        stats.skip++;

      } catch (e) {
        stats.errors++;
        Logger.log('[' + jobName + '] Errore su lead ' + lead.entity_id + ': ' + e.message);
      }
    });

  } catch (e) {
    logJobError_(jobName, e);
    return;
  }

  logJobEnd_(jobName, stats);
}

// ---------------------------------------------------------------------------
// HELPERS PRIVATI
// ---------------------------------------------------------------------------

function logJobStart_(jobName) {
  Logger.log('[' + jobName + '] START — ' + new Date().toISOString());
  logActivity({ level: 'INFO', module: 'JOBS', action: jobName + '.start' });
}

function logJobEnd_(jobName, stats) {
  var note = JSON.stringify(stats);
  Logger.log('[' + jobName + '] END — ' + note);
  logActivity({ level: 'INFO', module: 'JOBS', action: jobName + '.end', note: note });
}

function logJobError_(jobName, err) {
  var msg = err.message || String(err);
  Logger.log('[' + jobName + '] CRITICAL ERROR: ' + msg);
  logError_('JOBS', jobName, msg, err.stack || '', 'system', '');
  logActivity({ level: 'CRITICAL', module: 'JOBS', action: jobName + '.error', note: msg });

  // Traccia fallimenti consecutivi in PropertiesService
  var props = PropertiesService.getScriptProperties();
  var key   = 'job_failures_' + jobName;
  var count = parseInt(props.getProperty(key) || '0') + 1;
  props.setProperty(key, String(count));

  if (count >= 3) {
    // 3 fallimenti consecutivi → email admin (best-effort)
    try {
      var adminEmail = getAdminEmailGlobal_();
      if (adminEmail) {
        GmailApp.sendEmail(adminEmail,
          '[Made Event] ALERT: Job ' + jobName + ' fallito 3 volte',
          'Il job ' + jobName + ' ha fallito ' + count + ' volte consecutive.\n\nUltimo errore: ' + msg
        );
      }
    } catch (e) {}
    props.setProperty(key, '0'); // reset dopo alert
  }
}

/**
 * Resetta il contatore fallimenti di un job dopo un'esecuzione riuscita.
 * Da chiamare alla fine di ogni job (automatico in logJobEnd_).
 */
function resetJobFailures_(jobName) {
  PropertiesService.getScriptProperties().setProperty('job_failures_' + jobName, '0');
}

/**
 * Parsa data + orario_inizio di uno shift in timestamp ms.
 */
function parseShiftStart_(shiftData) {
  try {
    if (!shiftData.data || !shiftData.orario_inizio) return null;
    var dateStr = String(shiftData.data).split('T')[0];
    var timeStr = String(shiftData.orario_inizio);
    var d = new Date(dateStr + 'T' + timeStr + ':00');
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch (e) {
    return null;
  }
}

function parseBool_(val) {
  return val === true || String(val).toLowerCase() === 'true';
}

/**
 * Recupera l'email del primo ADMIN/SUPER_ADMIN attivo del tenant.
 */
function getAdminEmail_(tenantId) {
  var users = getAllRows('Users');
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (String(u.tenant_id) !== String(tenantId)) continue;
    if (u.status !== 'active') continue;
    if (u.role === ROLES.ADMIN || u.role === ROLES.SUPER_ADMIN) return u.email;
  }
  return null;
}

function getAdminEmailGlobal_() {
  var users = getAllRows('Users');
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (u.status !== 'active') continue;
    if (u.role === ROLES.SUPER_ADMIN) return u.email;
  }
  return null;
}
