// === NEWSLETTER.JS — MADE EVENT Platform v1.0 ===
// Sistema newsletter dual-tier:
//   TIER1 — LEAD_TALENT PARTIAL/COMPLETED_PENDING_APPROVAL
//           eventi offuscati (blur+grayscale), CTA "completa profilo"
//   TIER2 — LEAD_TALENT APPROVED
//           eventi completi, CTA "candidati ora"
//
// Frequenza gestita via Script Properties:
//   NEWSLETTER_TIER1_FREQUENCY_DAYS (default 7)
//   NEWSLETTER_TIER1_LAST_SENT      (ISO timestamp ultimo invio)
//   NEWSLETTER_TIER2_FREQUENCY_DAYS (default 14)
//   NEWSLETTER_TIER2_LAST_SENT      (ISO timestamp ultimo invio)

// ---------------------------------------------------------------------------
// HELPER — recupera eventi da includere nella newsletter
// ---------------------------------------------------------------------------

function getEventiPerNewsletter_() {
  var all    = getAllRows('Entities');
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  var eventi = all.filter(function(e) {
    if (String(e.deleted).toLowerCase() === 'true') return false;
    if (e.type !== 'EVENT') return false;
    var s = e.status;
    if (s === ENTITY_STATUS.EVENT.LIVE || s === ENTITY_STATUS.EVENT.PLANNING) return true;
    if (s === ENTITY_STATUS.EVENT.COMPLETED) {
      var d = parseJSON(e.data);
      return d.data_fine && new Date(d.data_fine) >= cutoff;
    }
    return false;
  }).map(function(e) {
    var d = parseJSON(e.data);
    return {
      entity_id:          e.entity_id,
      titolo:             d.titolo             || '',
      data_inizio:        d.data_inizio        || '',
      data_fine:          d.data_fine          || '',
      luogo:              d.luogo              || '',
      citta:              d.citta              || '',
      foto_url:           d.foto_url           || '',
      foto_copertina_url: d.foto_copertina_url || d.foto_url || '',
      descrizione:        d.descrizione        || '',
      tariffa:            d.tariffa            || '',
      client_id:          d.client_id          || '',
    };
  });

  eventi.sort(function(a, b) {
    var aT = a.data_inizio ? new Date(a.data_inizio).getTime() : 0;
    var bT = b.data_inizio ? new Date(b.data_inizio).getTime() : 0;
    return aT - bT;
  });

  return eventi;
}

// ---------------------------------------------------------------------------
// BUILDER — genera HTML newsletter
// ---------------------------------------------------------------------------

function buildNewsletterHtml(tier, eventi, destinatario) {
  var ACCENT   = '#630E33';
  var isTier1  = (tier === 'TIER1');
  var baseUrl  = getFrontendUrl();
  var nome     = escapeHtml_(destinatario.nome  || '');
  var email    = destinatario.email || '';

  var ctaUrl   = isTier1
    ? baseUrl + '/registrazione/completa?token=' + encodeURIComponent(destinatario.lead_token || '')
    : baseUrl + '/talent';
  var ctaLabel = isTier1 ? 'Completa la registrazione' : 'Vai alla piattaforma';

  var unsubUrl = baseUrl + '/unsubscribe?email=' + encodeURIComponent(email);

  // ── Event cards ──────────────────────────────────────────────────────────
  var cardsHtml = eventi.map(function(ev) {
    var imgUrl     = ev.foto_copertina_url || ev.foto_url || '';
    var dataFmt    = ev.data_inizio ? formatDate_(ev.data_inizio) : '';
    var localita   = (ev.luogo ? ev.luogo : '') + (ev.luogo && ev.citta ? ', ' : '') + (ev.citta || '');

    var cardCtaUrl, cardCtaLabel;
    if (isTier1) {
      cardCtaUrl   = baseUrl + '/registrazione/completa?token=' + encodeURIComponent(destinatario.lead_token || '');
      cardCtaLabel = 'Completa il tuo profilo &rarr;';
    } else {
      cardCtaUrl   = baseUrl + '/talent/eventi/' + ev.entity_id;
      cardCtaLabel = 'Candidati ora &rarr;';
    }

    var titleHtml = isTier1
      ? '<span style="color:#aaa;letter-spacing:2px;">Opportunità ••••••</span>'
      : escapeHtml_(ev.titolo);

    var imgBlock = imgUrl
      ? '<tr><td style="padding:0;line-height:0;">' +
        (isTier1
          ? '<div style="overflow:hidden;height:160px;"><img src="' + escapeHtml_(imgUrl) + '" alt="" width="552" style="width:100%;height:160px;object-fit:cover;-webkit-filter:blur(8px) grayscale(50%);filter:blur(8px) grayscale(50%);display:block;" /></div>'
          : '<img src="' + escapeHtml_(imgUrl) + '" alt="" width="552" style="width:100%;height:160px;object-fit:cover;display:block;" />'
        ) + '</td></tr>'
      : '';

    var detailBlock = isTier1
      ? ''
      : (ev.descrizione
          ? '<p style="margin:8px 0 0;font-size:13px;color:#6B6B6B;line-height:1.6;">' +
            escapeHtml_(ev.descrizione.substring(0, 160)) + (ev.descrizione.length > 160 ? '…' : '') +
            '</p>'
          : '') +
        (ev.tariffa
          ? '<p style="margin:8px 0 0;font-size:13px;font-weight:600;color:#2E2E2E;">Tariffa: ' + escapeHtml_(ev.tariffa) + '</p>'
          : '');

    return [
      '<table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;border-radius:4px;overflow:hidden;background:#FFFFFF;border:1px solid #EAEAEA;">',
      imgBlock,
      '<tr><td style="padding:20px 24px 12px;">',
      '<p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#2E2E2E;line-height:1.3;">' + titleHtml + '</p>',
      dataFmt   ? '<p style="margin:0 0 3px;font-size:12px;color:#6B6B6B;">&#128197; ' + escapeHtml_(dataFmt) + '</p>' : '',
      localita  ? '<p style="margin:0 0 3px;font-size:12px;color:#6B6B6B;">&#128205; ' + escapeHtml_(localita)  + '</p>' : '',
      detailBlock,
      '</td></tr>',
      '<tr><td style="padding:0 24px 20px;">',
      '<a href="' + escapeHtml_(cardCtaUrl) + '" style="display:inline-block;background:' + ACCENT + ';color:#FFFFFF;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">' + cardCtaLabel + '</a>',
      '</td></tr>',
      '</table>',
    ].join('\n');
  }).join('\n');

  var introText = isTier1
    ? 'Ci sono nuove opportunit&agrave; che potrebbero fare per te. <strong>Completa il tuo profilo</strong> per scoprire tutti i dettagli e candidarti.'
    : 'Nuove opportunit&agrave; di lavoro sono disponibili sulla piattaforma. Scopri i dettagli e candidati ora.';

  var sectionLabel = isTier1 ? 'ANTEPRIMA EVENTI' : 'EVENTI DISPONIBILI';

  return [
    '<!DOCTYPE html>',
    '<html lang="it"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Nuove opportunit&agrave; — Made Events</title></head>',
    '<body style="margin:0;padding:0;background:#F6F6F6;font-family:\'Montserrat\',Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F6;padding:40px 16px;">',
    '<tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;">',

    // Header bordeaux
    '<tr><td style="background:' + ACCENT + ';padding:40px 48px 36px;">',
    '<p style="margin:0 0 16px;font-size:11px;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.6);">MADE EVENTS</p>',
    '<h1 style="margin:0 0 8px;font-size:24px;font-weight:300;letter-spacing:1.5px;color:#FFFFFF;line-height:1.3;">Opportunit&agrave; di lavoro</h1>',
    nome ? '<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);font-weight:300;">Ciao ' + nome + ',</p>' : '',
    '</td></tr>',

    // Intro + CTA top
    '<tr><td style="padding:36px 48px 24px;">',
    '<p style="margin:0 0 24px;font-size:15px;font-weight:300;color:#2E2E2E;line-height:1.8;">' + introText + '</p>',
    '<table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">',
    '<tr><td style="background:' + ACCENT + ';border-radius:4px;">',
    '<a href="' + escapeHtml_(ctaUrl) + '" style="display:inline-block;padding:14px 32px;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">' + ctaLabel + '</a>',
    '</td></tr></table>',
    '</td></tr>',

    // Cards section
    '<tr><td style="padding:0 48px;">',
    '<div style="height:2px;background:' + ACCENT + ';width:48px;margin-bottom:20px;"></div>',
    '<p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#6B6B6B;">' + sectionLabel + '</p>',
    cardsHtml || '<p style="color:#6B6B6B;font-size:13px;">Nessun evento disponibile al momento.</p>',
    '</td></tr>',

    // CTA bottom
    '<tr><td style="padding:24px 48px 40px;">',
    '<table cellpadding="0" cellspacing="0">',
    '<tr><td style="background:' + ACCENT + ';border-radius:4px;">',
    '<a href="' + escapeHtml_(ctaUrl) + '" style="display:inline-block;padding:14px 32px;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">' + ctaLabel + '</a>',
    '</td></tr></table>',
    '</td></tr>',

    // Footer
    '<tr><td style="background:#FAFAFA;border-top:1px solid #EAEAEA;padding:24px 48px;">',
    '<p style="margin:0 0 10px;font-size:11px;color:#AAAAAA;line-height:1.6;">',
    'MADE EVENTS &mdash; Gestione staffing eventi<br>',
    'Non rispondere a questa email &middot; noreply@madeevent.it',
    '</p>',
    '<a href="https://www.instagram.com/madeevents" style="display:inline-block;background:' + ACCENT + ';color:#fff;padding:6px 14px;border-radius:4px;text-decoration:none;font-size:11px;font-weight:500;letter-spacing:1px;text-transform:uppercase;margin-right:6px;">Instagram</a>',
    '<a href="https://www.facebook.com/Made-Events" style="display:inline-block;background:#1877F2;color:#fff;padding:6px 14px;border-radius:4px;text-decoration:none;font-size:11px;font-weight:500;letter-spacing:1px;text-transform:uppercase;">Facebook</a>',
    '<p style="margin:14px 0 0;font-size:10px;"><a href="' + escapeHtml_(unsubUrl) + '" style="color:#CCCCCC;">Annulla iscrizione</a></p>',
    '</td></tr>',

    '</table>',
    '</td></tr></table>',
    '</body></html>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// JOB — Tier 1 (lead PARTIAL / COMPLETED_PENDING_APPROVAL)
// ---------------------------------------------------------------------------

function jobNewsletterTier1() {
  var jobName = 'newsletterTier1';
  var props   = PropertiesService.getScriptProperties();

  var freqDays = parseInt(props.getProperty('NEWSLETTER_TIER1_FREQUENCY_DAYS') || '7');
  var lastSent = props.getProperty('NEWSLETTER_TIER1_LAST_SENT') || '';
  if (lastSent) {
    var elapsed = (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60 * 24);
    if (elapsed < freqDays) {
      Logger.log('[' + jobName + '] Skip — ' + Math.round(elapsed) + ' giorni su ' + freqDays + ' richiesti.');
      return;
    }
  }

  logJobStart_(jobName);
  var stats = { found: 0, sent: 0, errors: 0 };

  try {
    var eventi = getEventiPerNewsletter_();
    var leads  = getAllRows('Entities').filter(function(e) {
      if (e.type !== 'LEAD_TALENT') return false;
      if (String(e.deleted).toLowerCase() === 'true') return false;
      return e.status === ENTITY_STATUS.LEAD_TALENT.PARTIAL ||
             e.status === ENTITY_STATUS.LEAD_TALENT.COMPLETED_PENDING_APPROVAL;
    });

    stats.found = leads.length;

    leads.forEach(function(lead) {
      try {
        var d = parseJSON(lead.data);
        if (!d.email) return;

        var html = buildNewsletterHtml('TIER1', eventi, {
          nome:       d.nome       || '',
          email:      d.email,
          lead_token: d.lead_token || '',
        });
        if (sendEmail_(d.email, 'Nuove opportunità di lavoro — Completa il tuo profilo', html)) {
          stats.sent++;
        }
      } catch (e) {
        stats.errors++;
        Logger.log('[' + jobName + '] Errore su lead ' + lead.entity_id + ': ' + e.message);
      }
    });

    props.setProperty('NEWSLETTER_TIER1_LAST_SENT', new Date().toISOString());
    logActivity({ level: 'INFO', module: 'JOBS', action: 'newsletter.tier1.sent', note: JSON.stringify(stats) });

  } catch (e) {
    logJobError_(jobName, e);
    return;
  }

  logJobEnd_(jobName, stats);
}

// ---------------------------------------------------------------------------
// JOB — Tier 2 (lead APPROVED → talent attivi)
// ---------------------------------------------------------------------------

function jobNewsletterTier2() {
  var jobName = 'newsletterTier2';
  var props   = PropertiesService.getScriptProperties();

  var freqDays = parseInt(props.getProperty('NEWSLETTER_TIER2_FREQUENCY_DAYS') || '14');
  var lastSent = props.getProperty('NEWSLETTER_TIER2_LAST_SENT') || '';
  if (lastSent) {
    var elapsed = (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60 * 24);
    if (elapsed < freqDays) {
      Logger.log('[' + jobName + '] Skip — ' + Math.round(elapsed) + ' giorni su ' + freqDays + ' richiesti.');
      return;
    }
  }

  logJobStart_(jobName);
  var stats = { found: 0, sent: 0, errors: 0 };

  try {
    var eventi = getEventiPerNewsletter_();
    var leads  = getAllRows('Entities').filter(function(e) {
      if (e.type !== 'LEAD_TALENT') return false;
      if (String(e.deleted).toLowerCase() === 'true') return false;
      return e.status === ENTITY_STATUS.LEAD_TALENT.APPROVED;
    });

    stats.found = leads.length;

    leads.forEach(function(lead) {
      try {
        var d = parseJSON(lead.data);
        if (!d.email) return;

        var html = buildNewsletterHtml('TIER2', eventi, {
          nome:      d.nome || '',
          email:     d.email,
          entity_id: lead.entity_id,
        });
        if (sendEmail_(d.email, 'Nuove opportunità di lavoro — Made Events', html)) {
          stats.sent++;
        }
      } catch (e) {
        stats.errors++;
        Logger.log('[' + jobName + '] Errore su lead ' + lead.entity_id + ': ' + e.message);
      }
    });

    props.setProperty('NEWSLETTER_TIER2_LAST_SENT', new Date().toISOString());
    logActivity({ level: 'INFO', module: 'JOBS', action: 'newsletter.tier2.sent', note: JSON.stringify(stats) });

  } catch (e) {
    logJobError_(jobName, e);
    return;
  }

  logJobEnd_(jobName, stats);
}

// ---------------------------------------------------------------------------
// PREVIEW — genera HTML per admin senza inviare email
// ---------------------------------------------------------------------------

function getNewsletterPreview(tier) {
  if (tier !== 'TIER1' && tier !== 'TIER2') {
    return errorResponse('VAL_002', 'tier deve essere TIER1 o TIER2');
  }

  var eventi = getEventiPerNewsletter_();
  var all    = getAllRows('Entities');
  var destinatario;

  if (tier === 'TIER1') {
    var sample = null;
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.type !== 'LEAD_TALENT' || String(e.deleted).toLowerCase() === 'true') continue;
      if (e.status !== ENTITY_STATUS.LEAD_TALENT.PARTIAL &&
          e.status !== ENTITY_STATUS.LEAD_TALENT.COMPLETED_PENDING_APPROVAL) continue;
      var d = parseJSON(e.data);
      if (d.email) { sample = d; break; }
    }
    destinatario = {
      nome:       sample ? (sample.nome || 'Giulia') : 'Giulia',
      email:      sample ? sample.email : 'preview@example.com',
      lead_token: sample ? (sample.lead_token || 'PREVIEW_TOKEN') : 'PREVIEW_TOKEN',
    };
  } else {
    var sample2 = null, sampleId = '';
    for (var j = 0; j < all.length; j++) {
      var e2 = all[j];
      if (e2.type !== 'LEAD_TALENT' || String(e2.deleted).toLowerCase() === 'true') continue;
      if (e2.status !== ENTITY_STATUS.LEAD_TALENT.APPROVED) continue;
      var d2 = parseJSON(e2.data);
      if (d2.email) { sample2 = d2; sampleId = e2.entity_id; break; }
    }
    destinatario = {
      nome:      sample2 ? (sample2.nome || 'Giulia') : 'Giulia',
      email:     sample2 ? sample2.email : 'preview@example.com',
      entity_id: sampleId || 'PREVIEW_ID',
    };
  }

  var html = buildNewsletterHtml(tier, eventi, destinatario);

  var countTier1 = all.filter(function(e) {
    if (e.type !== 'LEAD_TALENT' || String(e.deleted).toLowerCase() === 'true') return false;
    return (e.status === ENTITY_STATUS.LEAD_TALENT.PARTIAL ||
            e.status === ENTITY_STATUS.LEAD_TALENT.COMPLETED_PENDING_APPROVAL) &&
           parseJSON(e.data).email;
  }).length;

  var countTier2 = all.filter(function(e) {
    if (e.type !== 'LEAD_TALENT' || String(e.deleted).toLowerCase() === 'true') return false;
    return e.status === ENTITY_STATUS.LEAD_TALENT.APPROVED && parseJSON(e.data).email;
  }).length;

  return successResponse({
    html:  html,
    stats: {
      destinatari: tier === 'TIER1' ? countTier1 : countTier2,
      eventi:      eventi.length,
    },
  });
}

// ---------------------------------------------------------------------------
// HANDLER — imposta frequenza newsletter (admin)
// ---------------------------------------------------------------------------

function handleNewsletterSetFrequency(payload, auth) {
  if (!auth || (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SUPER_ADMIN)) {
    return errorResponse('AUTH_003', 'Permesso negato');
  }

  var props = PropertiesService.getScriptProperties();

  if (payload.tier1_days !== undefined) {
    var v1 = parseInt(payload.tier1_days);
    if (isNaN(v1) || v1 < 1) return errorResponse('VAL_002', 'tier1_days deve essere >= 1');
    props.setProperty('NEWSLETTER_TIER1_FREQUENCY_DAYS', String(v1));
  }
  if (payload.tier2_days !== undefined) {
    var v2 = parseInt(payload.tier2_days);
    if (isNaN(v2) || v2 < 1) return errorResponse('VAL_002', 'tier2_days deve essere >= 1');
    props.setProperty('NEWSLETTER_TIER2_FREQUENCY_DAYS', String(v2));
  }

  logActivity({
    level: 'INFO', module: 'NEWSLETTER', action: 'newsletter.setFrequency',
    user_id: auth.user_id, tenant_id: auth.tenant_id,
    note: JSON.stringify({ tier1_days: payload.tier1_days, tier2_days: payload.tier2_days }),
  });

  return successResponse({
    tier1_days: parseInt(props.getProperty('NEWSLETTER_TIER1_FREQUENCY_DAYS') || '7'),
    tier2_days: parseInt(props.getProperty('NEWSLETTER_TIER2_FREQUENCY_DAYS') || '14'),
  });
}
