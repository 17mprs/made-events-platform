// === matchScore.js — MADE EVENT Platform ===
// Single source of truth for EVENT-TALENT match scoring (HARD/SOFT requirements).
// Pushed to GAS (global scope, no import/export) AND imported directly by the
// React frontend (Vite/esbuild's static analysis of `module.exports` below
// exposes named imports from a plain script file) — do not duplicate this
// logic anywhere else. Edit only here.

function calculateEventMatch(evento, talent) {
  var ed = evento.data || {};
  var td = talent.data || {};
  var score = 0;
  var maxScore = 0;

  // ── HARD REQUIREMENTS (mismatch = 0%) ────────────────────────────────────

  // 1. Sesso (15)
  if (ed.sesso_richiesto && ed.sesso_richiesto !== 'Indifferente') {
    maxScore += 15;
    var tSesso = td.genere || td.sesso || '';
    if (tSesso === ed.sesso_richiesto) score += 15;
    else return 0;
  }

  // 2. Altezza minima (10)
  if (ed.altezza_minima) {
    maxScore += 10;
    if (parseInt(td.altezza) >= parseInt(ed.altezza_minima)) score += 10;
    else return 0;
  }

  // 3. Taglia richiesta (10)
  if (ed.taglia_richiesta && ed.taglia_richiesta !== 'Indifferente' && ed.taglia_richiesta !== '') {
    maxScore += 10;
    var tTaglia = td.taglia_pantalone || td.taglia || '';
    if (tTaglia === ed.taglia_richiesta) score += 10;
    else return 0;
  }

  // 4. Lingue richieste (15)
  var lingueRichieste = Array.isArray(ed.lingue_richieste) ? ed.lingue_richieste : [];
  if (lingueRichieste.length > 0) {
    maxScore += 15;
    // Raccoglie tutte le lingue del talent
    var tLingue = [];
    var stdFields = ['lingua_inglese','lingua_francese','lingua_spagnolo','lingua_tedesco'];
    for (var i = 0; i < stdFields.length; i++) {
      if (td[stdFields[i]] && td[stdFields[i]] !== 'Non conosco') tLingue.push(stdFields[i].replace('lingua_',''));
    }
    var altreLingue = Array.isArray(td.altre_lingue) ? td.altre_lingue : [];
    for (var j = 0; j < altreLingue.length; j++) {
      if (altreLingue[j].nome) tLingue.push(altreLingue[j].nome.toLowerCase());
    }
    var lingueArr = Array.isArray(td.lingue) ? td.lingue : [];
    for (var k = 0; k < lingueArr.length; k++) {
      var l = typeof lingueArr[k] === 'string' ? lingueArr[k] : (lingueArr[k].nome || '');
      if (l) tLingue.push(l.toLowerCase());
    }
    var hasAll = lingueRichieste.every(function(req) {
      return tLingue.some(function(tl) { return tl.indexOf(req.toLowerCase()) > -1; });
    });
    if (hasAll) score += 15;
    else return 0;
  }

  // ── SOFT REQUIREMENTS (penalità parziale) ────────────────────────────────

  // 5. Anni esperienza minimi (12/5)
  if (parseInt(ed.anni_esperienza_minimi) > 0) {
    maxScore += 12;
    var expMap = { 'Oltre 5':6, '3–5':4, '1–3':2, '0–1':0.5 };
    var tExp = expMap[td.anni_esperienza_settore] || parseFloat(td.esperienza_anni) || 0;
    if (tExp >= parseInt(ed.anni_esperienza_minimi)) score += 12;
    else score += 5;
  }

  // 6. Provincia (10/3)
  if (ed.provincia) {
    maxScore += 10;
    var prov = Array.isArray(td.province_lavoro) ? td.province_lavoro : (Array.isArray(td.province_operativita) ? td.province_operativita : []);
    if (prov.indexOf(ed.provincia) > -1) score += 10;
    else score += 3;
  }

  // 7. Automunita (8/2)
  if (ed.automunita === 'Sì') {
    maxScore += 8;
    if (td.automunita === 'Sì') score += 8; else score += 2;
  }

  // 8. Trasferte (8/2)
  if (ed.richiede_trasferte) {
    maxScore += 8;
    if (td.disponibilita_trasferte === 'Sì') score += 8; else score += 2;
  }

  // 9. Weekend (6)
  if (ed.richiede_weekend) {
    maxScore += 6;
    if (td.disponibilita_weekend === 'Sì' || td.disponibile_weekend === 'Sì') score += 6;
  }

  // 10. Ruoli/tipologie (10/3)
  var ruoliRichiesti = Array.isArray(ed.ruoli_richiesti) ? ed.ruoli_richiesti : [];
  if (ruoliRichiesti.length > 0) {
    maxScore += 10;
    var tTip = Array.isArray(td.tipologie_esperienza) ? td.tipologie_esperienza : [];
    var hasRole = ruoliRichiesti.some(function(r) { return tTip.indexOf(r) > -1; });
    if (hasRole) score += 10; else score += 3;
  }

  // 11. Bonus: ha lavorato con noi (10)
  if (ed.priorita_lavorato_con_noi) {
    var eventiMade = parseInt(td.eventi_crm_completati || 0) + parseInt(td.eventi_precrm || 0);
    if (eventiMade > 0) { maxScore += 10; score += 10; }
  }

  if (maxScore === 0) return 50;
  return Math.round((score / maxScore) * 100);
}

// Variante diagnostica di calculateEventMatch: valuta TUTTI i campi (niente
// early-return sui HARD) e riporta il dettaglio per campo. Usata solo dal
// debug tool — calculateEventMatch resta la sola sorgente di verità per lo
// scoring live, questa funzione non va richiamata da nessun flusso di prodotto.
function calculateEventMatchBreakdown(evento, talent) {
  var ed = evento.data || {};
  var td = talent.data || {};
  var score = 0;
  var maxScore = 0;
  var hardFailed = null;
  var fields = [];

  function addField(key, label, tipo, eventValue, talentValue, result, points, maxPoints) {
    fields.push({
      key: key, label: label, tipo: tipo,
      event_value: eventValue, talent_value: talentValue,
      result: result, points: points, max_points: maxPoints
    });
  }

  // 1. Sesso (15, HARD)
  if (ed.sesso_richiesto && ed.sesso_richiesto !== 'Indifferente') {
    maxScore += 15;
    var tSesso = td.genere || td.sesso || '';
    var passSesso = tSesso === ed.sesso_richiesto;
    if (passSesso) { score += 15; } else if (!hardFailed) { hardFailed = 'sesso_richiesto'; }
    addField('sesso_richiesto', 'Sesso', 'HARD', ed.sesso_richiesto, tSesso, passSesso ? 'pass' : 'fail', passSesso ? 15 : 0, 15);
  } else {
    addField('sesso_richiesto', 'Sesso', 'HARD', ed.sesso_richiesto || '(non richiesto)', td.genere || td.sesso || '', 'skip', 0, 0);
  }

  // 2. Altezza minima (10, HARD)
  if (ed.altezza_minima) {
    maxScore += 10;
    var passAltezza = parseInt(td.altezza) >= parseInt(ed.altezza_minima);
    if (passAltezza) { score += 10; } else if (!hardFailed) { hardFailed = 'altezza_minima'; }
    addField('altezza_minima', 'Altezza minima', 'HARD', ed.altezza_minima, td.altezza, passAltezza ? 'pass' : 'fail', passAltezza ? 10 : 0, 10);
  } else {
    addField('altezza_minima', 'Altezza minima', 'HARD', '(non richiesta)', td.altezza || '', 'skip', 0, 0);
  }

  // 3. Taglia richiesta (10, HARD)
  if (ed.taglia_richiesta && ed.taglia_richiesta !== 'Indifferente' && ed.taglia_richiesta !== '') {
    maxScore += 10;
    var tTaglia = td.taglia_pantalone || td.taglia || '';
    var passTaglia = tTaglia === ed.taglia_richiesta;
    if (passTaglia) { score += 10; } else if (!hardFailed) { hardFailed = 'taglia_richiesta'; }
    addField('taglia_richiesta', 'Taglia', 'HARD', ed.taglia_richiesta, tTaglia, passTaglia ? 'pass' : 'fail', passTaglia ? 10 : 0, 10);
  } else {
    addField('taglia_richiesta', 'Taglia', 'HARD', ed.taglia_richiesta || '(non richiesta)', td.taglia_pantalone || td.taglia || '', 'skip', 0, 0);
  }

  // 4. Lingue richieste (15, HARD)
  var lingueRichieste = Array.isArray(ed.lingue_richieste) ? ed.lingue_richieste : [];
  if (lingueRichieste.length > 0) {
    maxScore += 15;
    var tLingue = [];
    var stdFields = ['lingua_inglese','lingua_francese','lingua_spagnolo','lingua_tedesco'];
    for (var i = 0; i < stdFields.length; i++) {
      if (td[stdFields[i]] && td[stdFields[i]] !== 'Non conosco') tLingue.push(stdFields[i].replace('lingua_',''));
    }
    var altreLingue = Array.isArray(td.altre_lingue) ? td.altre_lingue : [];
    for (var j = 0; j < altreLingue.length; j++) {
      if (altreLingue[j].nome) tLingue.push(altreLingue[j].nome.toLowerCase());
    }
    var lingueArr = Array.isArray(td.lingue) ? td.lingue : [];
    for (var k = 0; k < lingueArr.length; k++) {
      var l = typeof lingueArr[k] === 'string' ? lingueArr[k] : (lingueArr[k].nome || '');
      if (l) tLingue.push(l.toLowerCase());
    }
    var hasAll = lingueRichieste.every(function(req) {
      return tLingue.some(function(tl) { return tl.indexOf(req.toLowerCase()) > -1; });
    });
    if (hasAll) { score += 15; } else if (!hardFailed) { hardFailed = 'lingue_richieste'; }
    addField('lingue_richieste', 'Lingue', 'HARD', lingueRichieste.join(', '), tLingue.join(', '), hasAll ? 'pass' : 'fail', hasAll ? 15 : 0, 15);
  } else {
    addField('lingue_richieste', 'Lingue', 'HARD', '(non richieste)', '', 'skip', 0, 0);
  }

  // 5. Anni esperienza minimi (12/5, SOFT)
  if (parseInt(ed.anni_esperienza_minimi) > 0) {
    maxScore += 12;
    var expMap = { 'Oltre 5':6, '3–5':4, '1–3':2, '0–1':0.5 };
    var tExp = expMap[td.anni_esperienza_settore] || parseFloat(td.esperienza_anni) || 0;
    var passExp = tExp >= parseInt(ed.anni_esperienza_minimi);
    score += passExp ? 12 : 5;
    addField('anni_esperienza_minimi', 'Anni esperienza', 'SOFT', ed.anni_esperienza_minimi, td.anni_esperienza_settore || td.esperienza_anni || '', passExp ? 'pass' : 'partial', passExp ? 12 : 5, 12);
  } else {
    addField('anni_esperienza_minimi', 'Anni esperienza', 'SOFT', '(non richiesti)', td.anni_esperienza_settore || td.esperienza_anni || '', 'skip', 0, 0);
  }

  // 6. Provincia (10/3, SOFT)
  if (ed.provincia) {
    maxScore += 10;
    var prov = Array.isArray(td.province_lavoro) ? td.province_lavoro : (Array.isArray(td.province_operativita) ? td.province_operativita : []);
    var passProv = prov.indexOf(ed.provincia) > -1;
    score += passProv ? 10 : 3;
    addField('provincia', 'Provincia', 'SOFT', ed.provincia, prov.join(', '), passProv ? 'pass' : 'partial', passProv ? 10 : 3, 10);
  } else {
    addField('provincia', 'Provincia', 'SOFT', '(non richiesta)', '', 'skip', 0, 0);
  }

  // 7. Automunita (8/2, SOFT)
  if (ed.automunita === 'Sì') {
    maxScore += 8;
    var passAuto = td.automunita === 'Sì';
    score += passAuto ? 8 : 2;
    addField('automunita', 'Automunita', 'SOFT', ed.automunita, td.automunita || '', passAuto ? 'pass' : 'partial', passAuto ? 8 : 2, 8);
  } else {
    addField('automunita', 'Automunita', 'SOFT', '(non richiesta)', td.automunita || '', 'skip', 0, 0);
  }

  // 8. Trasferte (8/2, SOFT)
  if (ed.richiede_trasferte) {
    maxScore += 8;
    var passTrasf = td.disponibilita_trasferte === 'Sì';
    score += passTrasf ? 8 : 2;
    addField('richiede_trasferte', 'Trasferte', 'SOFT', ed.richiede_trasferte, td.disponibilita_trasferte || '', passTrasf ? 'pass' : 'partial', passTrasf ? 8 : 2, 8);
  } else {
    addField('richiede_trasferte', 'Trasferte', 'SOFT', '(non richieste)', td.disponibilita_trasferte || '', 'skip', 0, 0);
  }

  // 9. Weekend (6, SOFT — nessuna penalità se manca)
  if (ed.richiede_weekend) {
    maxScore += 6;
    var passWeekend = td.disponibilita_weekend === 'Sì' || td.disponibile_weekend === 'Sì';
    if (passWeekend) score += 6;
    addField('richiede_weekend', 'Weekend', 'SOFT', ed.richiede_weekend, td.disponibilita_weekend || td.disponibile_weekend || '', passWeekend ? 'pass' : 'partial', passWeekend ? 6 : 0, 6);
  } else {
    addField('richiede_weekend', 'Weekend', 'SOFT', '(non richiesto)', td.disponibilita_weekend || td.disponibile_weekend || '', 'skip', 0, 0);
  }

  // 10. Ruoli/tipologie (10/3, SOFT)
  var ruoliRichiesti = Array.isArray(ed.ruoli_richiesti) ? ed.ruoli_richiesti : [];
  if (ruoliRichiesti.length > 0) {
    maxScore += 10;
    var tTip = Array.isArray(td.tipologie_esperienza) ? td.tipologie_esperienza : [];
    var hasRole = ruoliRichiesti.some(function(r) { return tTip.indexOf(r) > -1; });
    score += hasRole ? 10 : 3;
    addField('ruoli_richiesti', 'Ruoli', 'SOFT', ruoliRichiesti.join(', '), tTip.join(', '), hasRole ? 'pass' : 'partial', hasRole ? 10 : 3, 10);
  } else {
    addField('ruoli_richiesti', 'Ruoli', 'SOFT', '(non richiesti)', '', 'skip', 0, 0);
  }

  // 11. Bonus: ha lavorato con noi (10, SOFT)
  if (ed.priorita_lavorato_con_noi) {
    var eventiMade = parseInt(td.eventi_crm_completati || 0) + parseInt(td.eventi_precrm || 0);
    var hasBonus = eventiMade > 0;
    if (hasBonus) { maxScore += 10; score += 10; }
    addField('priorita_lavorato_con_noi', 'Ha lavorato con noi', 'SOFT', 'Sì', eventiMade, hasBonus ? 'pass' : 'partial', hasBonus ? 10 : 0, hasBonus ? 10 : 0);
  } else {
    addField('priorita_lavorato_con_noi', 'Ha lavorato con noi', 'SOFT', '(non richiesto)', '', 'skip', 0, 0);
  }

  var noRequirements = maxScore === 0;
  var percentage = noRequirements ? 50 : (hardFailed ? 0 : Math.round((score / maxScore) * 100));

  return {
    percentage: percentage,
    score: score,
    max_score: maxScore,
    hard_failed: hardFailed,
    no_requirements: noRequirements,
    fields: fields
  };
}

// === GAS_ONLY_BELOW ===
// GAS loads this file as a global-scope script (no ESM support there) —
// calculateEventMatch is simply available as a global function, exactly as
// when it lived in utils.js. The frontend never sees this: a Vite plugin
// (see vite.config.js) reads this file's source directly, cuts everything
// from the marker above, and appends a real `export` for its build instead
// — GAS can't parse ES module syntax, so it can't live in this file itself.

