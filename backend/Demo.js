// === DEMO.JS — MADE EVENT Platform ===
// Funzioni di setup dati demo. Solo per sviluppo/testing.
// setupDemoData() va eseguita manualmente dal GAS Editor.
// handleDemoReset() è esposta come action 'demo.reset' (solo SUPER_ADMIN).

// ---------------------------------------------------------------------------
// DATI DEMO
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CLIENTI DEMO
// ---------------------------------------------------------------------------

var DEMO_CLIENTI = [
  {
    ragione_sociale: 'Luxuria Events S.r.l.',
    partita_iva: '02345678901',
    email: 'info@luxuriaevents.it',
    telefono: '0245678901',
    referente_nome: 'Marco', referente_cognome: 'Ferrini',
    indirizzo: 'Via della Moda 12', citta: 'Milano',
    _demo: true
  },
  {
    ragione_sociale: 'Bella Italia Catering S.p.A.',
    partita_iva: '03456789012',
    email: 'contatti@bellaitalia.it',
    telefono: '0612345678',
    referente_nome: 'Laura', referente_cognome: 'Santini',
    indirizzo: 'Via dei Fori 8', citta: 'Roma',
    _demo: true
  }
];

// ---------------------------------------------------------------------------
// LEAD BOZZA (solo 4 campi — NO score, NO questionario)
// ---------------------------------------------------------------------------

var DEMO_LEADS_BOZZA = [
  {
    nome: 'Anna', cognome: 'Colombo', email: 'anna.colombo@demo.it',
    telefono: '3471234010', citta: 'Milano',
  },
  {
    nome: 'Roberto', cognome: 'Esposito', email: 'roberto.esposito@demo.it',
    telefono: '3471234011', citta: 'Roma',
  }
];

// ---------------------------------------------------------------------------
// PROFILI IN ATTESA (questionario completo — hanno score)
// ---------------------------------------------------------------------------

var DEMO_LEADS_IN_ATTESA = [

  // ── 1. SOFIA FERRETTI — score 92, ranking A ───────────────────────────────
  {
    nome: 'Sofia', cognome: 'Ferretti', email: 'sofia.ferretti@demo.it',
    telefono: '3471234001', citta: 'Milano',
    score: 92, ranking: 'A',
    data: {
      // S1 — Dati personali
      nascita_nazione: 'Italia', nascita_regione: 'Lombardia',
      nascita_provincia: 'MI', nascita_citta: 'Milano',
      residenza_nazione: 'Italia', residenza_regione: 'Lombardia',
      residenza_provincia: 'MI', residenza_citta: 'Milano',
      domicilio_coincide: true,
      domicilio_provincia: '',
      instagram: 'https://instagram.com/sofia.ferretti.hostess',
      facebook:  'https://facebook.com/sofia.ferretti.eventi',

      // S2 — Profilo fisico
      altezza: '170', taglia_tshirt: 'S', taglia_pantalone: '38',
      taglia_gonna: '38', numero_scarpe: '37',
      piercing_visibili: 'No', tatuaggi_visibili: 'No', tatuaggi_dove: '',

      // S3 — Disponibilità logistica
      patente_tipologie: ['B'], automunita: 'Sì',
      province_lavoro: ['MI', 'CO', 'BG', 'VA', 'MB'],
      disponibilita_trasferte: 'Sì', disponibilita_weekend: 'Sì',
      disponibilita_serali: 'Sì',

      // S4 — Lingue
      lingua_inglese: 'Fluente', lingua_francese: 'Intermedio',
      lingua_spagnolo: 'Non conosco', lingua_tedesco: 'Non conosco',
      altre_lingue: [],

      // S5 — Professionale
      titolo_studio: 'Laurea Triennale',
      titolo_studio_indirizzo: 'Scienze della Comunicazione e Marketing',
      professione_attuale: ['Hostess / Steward'],
      tipologie_esperienza: [
        'Fiere / Congressi', 'Fashion Week', 'Lanci Prodotto',
        'Catering', 'Road Show', 'Accrediti'
      ],
      anni_esperienza_settore: 'Oltre 5',

      // S6 — Dotazione
      dotazione_personale: [
        'Giacca elegante', 'Abito cocktail', 'Scarpe tacco 7cm', 'Borsa professionale'
      ],

      // S7 — Fiscale
      codice_fiscale: 'FRTSFO95A41F205X',
      iban: 'IT60X0542811101000000112233',
      partita_iva: '11223344556',
      disponibile_chiamata: 'Sì', disponibile_ritenuta: 'Sì',

      // S8 — Documenti
      foto_busto_url:  'https://randomuser.me/api/portraits/women/44.jpg',
      foto_intera_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
      cv_url:          'https://drive.google.com/file/d/demo_cv_sofia_ferretti',
      doc_identita_url:'https://drive.google.com/file/d/demo_ci_sofia_ferretti',
      doc_cf_url:      'https://drive.google.com/file/d/demo_cf_sofia_ferretti',
      attestato_haccp_url: '',
      attestato_sicurezza_url: '',
      foto_extra_url:  '',

      sezione_completata: 8, step_completed: 3, stato_profilo: 'in_attesa'
    }
  },

  // ── 2. MARCO BIANCHI — score 78, ranking B ────────────────────────────────
  {
    nome: 'Marco', cognome: 'Bianchi', email: 'marco.bianchi@demo.it',
    telefono: '3471234002', citta: 'Roma',
    score: 78, ranking: 'B',
    data: {
      // S1
      nascita_nazione: 'Italia', nascita_regione: 'Campania',
      nascita_provincia: 'NA', nascita_citta: 'Napoli',
      residenza_nazione: 'Italia', residenza_regione: 'Lazio',
      residenza_provincia: 'RM', residenza_citta: 'Roma',
      domicilio_coincide: true,
      domicilio_provincia: '',
      instagram: 'https://instagram.com/marco.bianchi.event',
      facebook:  '',

      // S2
      altezza: '181', taglia_tshirt: 'M', taglia_pantalone: '44',
      taglia_gonna: '', numero_scarpe: '43',
      piercing_visibili: 'No',
      tatuaggi_visibili: 'Sì', tatuaggi_dove: 'Braccio sinistro, coperto dalla manica',

      // S3
      patente_tipologie: ['B', 'AM'], automunita: 'Sì',
      province_lavoro: ['RM', 'FR', 'LT', 'VT'],
      disponibilita_trasferte: 'Sì', disponibilita_weekend: 'Sì',
      disponibilita_serali: 'No',

      // S4
      lingua_inglese: 'Fluente', lingua_francese: 'Non conosco',
      lingua_spagnolo: 'Base', lingua_tedesco: 'Non conosco',
      altre_lingue: [],

      // S5
      titolo_studio: 'Diploma',
      titolo_studio_indirizzo: 'Istituto Tecnico Commerciale',
      professione_attuale: ['Promoter', 'Hostess / Steward'],
      tipologie_esperienza: [
        'Fiere / Congressi', 'Catering', 'Accrediti',
        'Sport Events', 'Road Show', 'Lanci Prodotto'
      ],
      anni_esperienza_settore: '3-5',

      // S6
      dotazione_personale: [
        'Abito scuro completo', 'Camicia bianca formale', 'Scarpe classiche nere'
      ],

      // S7
      codice_fiscale: 'BNCMRC90B01H501Z',
      iban: 'IT40Q0306909606100000015715',
      partita_iva: '',
      disponibile_chiamata: 'Sì', disponibile_ritenuta: 'No',

      // S8
      foto_busto_url:  'https://randomuser.me/api/portraits/men/32.jpg',
      foto_intera_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      cv_url:          'https://drive.google.com/file/d/demo_cv_marco_bianchi',
      doc_identita_url:'https://drive.google.com/file/d/demo_ci_marco_bianchi',
      doc_cf_url:      'https://drive.google.com/file/d/demo_cf_marco_bianchi',
      attestato_haccp_url: 'https://drive.google.com/file/d/demo_haccp_marco',
      attestato_sicurezza_url: '',
      foto_extra_url:  '',

      sezione_completata: 8, step_completed: 3, stato_profilo: 'in_attesa'
    }
  },

  // ── 3. GIULIA ROSSI — score 65, ranking B ────────────────────────────────
  {
    nome: 'Giulia', cognome: 'Rossi', email: 'giulia.rossi@demo.it',
    telefono: '3471234003', citta: 'Firenze',
    score: 65, ranking: 'B',
    data: {
      // S1
      nascita_nazione: 'Italia', nascita_regione: 'Toscana',
      nascita_provincia: 'PI', nascita_citta: 'Pisa',
      residenza_nazione: 'Italia', residenza_regione: 'Toscana',
      residenza_provincia: 'FI', residenza_citta: 'Firenze',
      domicilio_coincide: false,
      domicilio_provincia: 'PO',
      instagram: 'https://instagram.com/giulia.rossi.linguist',
      facebook:  'https://facebook.com/giulia.rossi.firenze',

      // S2
      altezza: '165', taglia_tshirt: 'XS', taglia_pantalone: '36',
      taglia_gonna: '36', numero_scarpe: '36',
      piercing_visibili: 'No', tatuaggi_visibili: 'No', tatuaggi_dove: '',

      // S3
      patente_tipologie: ['B'], automunita: 'No',
      province_lavoro: ['FI', 'PO', 'PT', 'LU'],
      disponibilita_trasferte: 'Sì', disponibilita_weekend: 'No',
      disponibilita_serali: 'Sì',

      // S4
      lingua_inglese: 'Madrelingua', lingua_francese: 'Intermedio',
      lingua_spagnolo: 'Non conosco', lingua_tedesco: 'Non conosco',
      altre_lingue: [{ nome: 'Cinese Mandarino', livello: 'Base' }],

      // S5
      titolo_studio: 'Laurea Magistrale',
      titolo_studio_indirizzo: 'Lingue e Comunicazione Internazionale',
      professione_attuale: ['Interprete / Traduttrice'],
      tipologie_esperienza: [
        'Fiere / Congressi', 'Fashion Week', 'Accrediti', 'Congressi Medici'
      ],
      anni_esperienza_settore: '1-3',

      // S6
      dotazione_personale: [
        'Abito elegante nero', 'Scarpe comode professionali', 'Foulard istituzionale'
      ],

      // S7
      codice_fiscale: 'RSSGLL98C41D612W',
      iban: 'IT60X0542811101000000345678',
      partita_iva: '',
      disponibile_chiamata: 'No', disponibile_ritenuta: 'Sì',

      // S8
      foto_busto_url:  'https://randomuser.me/api/portraits/women/68.jpg',
      foto_intera_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
      cv_url:          'https://drive.google.com/file/d/demo_cv_giulia_rossi',
      doc_identita_url:'https://drive.google.com/file/d/demo_ci_giulia_rossi',
      doc_cf_url:      'https://drive.google.com/file/d/demo_cf_giulia_rossi',
      attestato_haccp_url: '',
      attestato_sicurezza_url: '',
      foto_extra_url:  '',

      sezione_completata: 8, step_completed: 3, stato_profilo: 'in_attesa'
    }
  }
];

// ---------------------------------------------------------------------------
// PROFILI APPROVATI (questionario completo — hanno score — già approvati)
// ---------------------------------------------------------------------------

var DEMO_LEADS_APPROVATI = [

  // ── 4. LUCA MARINO — score 58, ranking C ─────────────────────────────────
  {
    nome: 'Luca', cognome: 'Marino', email: 'luca.marino@demo.it',
    telefono: '3471234004', citta: 'Napoli',
    score: 58, ranking: 'C',
    data: {
      // S1
      nascita_nazione: 'Italia', nascita_regione: 'Campania',
      nascita_provincia: 'CE', nascita_citta: 'Caserta',
      residenza_nazione: 'Italia', residenza_regione: 'Campania',
      residenza_provincia: 'NA', residenza_citta: 'Napoli',
      domicilio_coincide: true,
      domicilio_provincia: '',
      instagram: '', facebook: '',

      // S2
      altezza: '178', taglia_tshirt: 'L', taglia_pantalone: '46',
      taglia_gonna: '', numero_scarpe: '42',
      piercing_visibili: 'No',
      tatuaggi_visibili: 'Sì', tatuaggi_dove: 'Caviglia destra, normalmente coperta',

      // S3
      patente_tipologie: ['Nessuna'], automunita: 'No',
      province_lavoro: ['NA', 'SA', 'CE'],
      disponibilita_trasferte: 'No', disponibilita_weekend: 'Sì',
      disponibilita_serali: 'Sì',

      // S4
      lingua_inglese: 'Intermedio', lingua_francese: 'Non conosco',
      lingua_spagnolo: 'Non conosco', lingua_tedesco: 'Non conosco',
      altre_lingue: [],

      // S5
      titolo_studio: 'Diploma',
      titolo_studio_indirizzo: 'Liceo Classico',
      professione_attuale: ['Studente'],
      tipologie_esperienza: ['Catering', 'Accrediti', 'Sport Events'],
      anni_esperienza_settore: '0-1',

      // S6
      dotazione_personale: ['Camicia bianca', 'Pantaloni neri eleganti'],

      // S7
      codice_fiscale: 'MRNLCU01H01F839P',
      iban: '',
      partita_iva: '',
      disponibile_chiamata: 'Sì', disponibile_ritenuta: 'No',

      // S8
      foto_busto_url:  'https://randomuser.me/api/portraits/men/55.jpg',
      foto_intera_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
      cv_url:          '',
      doc_identita_url:'https://drive.google.com/file/d/demo_ci_luca_marino',
      doc_cf_url:      'https://drive.google.com/file/d/demo_cf_luca_marino',
      attestato_haccp_url: '',
      attestato_sicurezza_url: '',
      foto_extra_url:  '',

      sezione_completata: 8, step_completed: 3, stato_profilo: 'approvato'
    }
  },

  // ── 5. VALENTINA CONTI — score 45, ranking C ─────────────────────────────
  {
    nome: 'Valentina', cognome: 'Conti', email: 'valentina.conti@demo.it',
    telefono: '3471234005', citta: 'Torino',
    score: 45, ranking: 'C',
    data: {
      // S1
      nascita_nazione: 'Italia', nascita_regione: 'Piemonte',
      nascita_provincia: 'CN', nascita_citta: 'Cuneo',
      residenza_nazione: 'Italia', residenza_regione: 'Piemonte',
      residenza_provincia: 'TO', residenza_citta: 'Torino',
      domicilio_coincide: true,
      domicilio_provincia: '',
      instagram: 'https://instagram.com/vale.conti.torino',
      facebook:  '',

      // S2
      altezza: '168', taglia_tshirt: 'M', taglia_pantalone: '40',
      taglia_gonna: '40', numero_scarpe: '38',
      piercing_visibili: 'Sì', tatuaggi_visibili: 'No', tatuaggi_dove: '',

      // S3
      patente_tipologie: ['B'], automunita: 'Sì',
      province_lavoro: ['TO', 'CN'],
      disponibilita_trasferte: 'No', disponibilita_weekend: 'No',
      disponibilita_serali: 'Sì',

      // S4
      lingua_inglese: 'Base', lingua_francese: 'Base',
      lingua_spagnolo: 'Non conosco', lingua_tedesco: 'Non conosco',
      altre_lingue: [],

      // S5
      titolo_studio: 'Diploma',
      titolo_studio_indirizzo: 'Istituto d\'Arte',
      professione_attuale: ['Cassiera / Addetta Vendite'],
      tipologie_esperienza: ['Catering', 'Accrediti'],
      anni_esperienza_settore: '0-1',

      // S6
      dotazione_personale: ['Completo pantalone elegante', 'Scarpe basse formali'],

      // S7
      codice_fiscale: 'CNTVNT02M41L219X',
      iban: '',
      partita_iva: '',
      disponibile_chiamata: 'No', disponibile_ritenuta: 'No',

      // S8
      foto_busto_url:  'https://randomuser.me/api/portraits/women/21.jpg',
      foto_intera_url: '',
      cv_url:          '',
      doc_identita_url:'',
      doc_cf_url:      '',
      attestato_haccp_url: '',
      attestato_sicurezza_url: '',
      foto_extra_url:  '',

      sezione_completata: 8, step_completed: 3, stato_profilo: 'approvato'
    }
  }
];

// ---------------------------------------------------------------------------
// SETUP DEMO — eseguire dal GAS Editor
// ---------------------------------------------------------------------------

/**
 * Cancella e ricrea tutti i dati demo.
 * Lead Bozza (PARTIAL, 4 campi): Anna Colombo, Roberto Esposito
 * Lead Parziale (PARTIAL, sezione 3): Alessandro Gatti
 * Profili In Attesa (COMPLETED_PENDING_APPROVAL, score): Sofia, Marco, Giulia
 * Profili Approvati (APPROVED, score): Luca Marino, Valentina Conti
 * + 2 eventi demo, 2 candidature, 1 assignment
 */
function setupDemoData() {
  Logger.log('=== SETUP DEMO DATA — START ===');

  var tenantId = _getAdminTenantId_();
  if (!tenantId) {
    Logger.log('[ERRORE] Nessun utente admin trovato. Eseguire prima setupDatabase() o createDemoAdmin().');
    return;
  }
  Logger.log('Tenant ID (da admin): ' + tenantId);

  // 1. Cancella tutto il demo precedente
  _deleteDemoLeads_();
  _deleteDemoEntities_('TALENT_PROFILE');
  _deleteDemoEntities_('CLIENT');
  _deleteDemoEntities_('EVENT');
  _deleteDemoEntities_('SHIFT');
  _deleteDemoEntities_('APPLICATION');
  _deleteDemoEntities_('ASSIGNMENT');

  var now = new Date();

  // 2. LEAD BOZZA — solo 4 campi, NO score
  Logger.log('\n--- Creazione lead bozza (4 campi) ---');
  for (var b = 0; b < DEMO_LEADS_BOZZA.length; b++) {
    var bdef = DEMO_LEADS_BOZZA[b];
    var bDate = new Date(now.getTime() - (b + 1) * 2 * 24 * 60 * 60 * 1000);
    var bData = {
      _demo: true,
      nome: bdef.nome, cognome: bdef.cognome,
      email: bdef.email, telefono: bdef.telefono, citta: bdef.citta,
      lead_token: Utilities.getUuid(),
      gdpr_consent: true, gdpr_timestamp: bDate.toISOString(),
      step_completed: 1, sezione_completata: 0,
      stato_profilo: 'da_compilare', score: 0, ranking: 'D',
      registration_started_at: bDate.toISOString(),
      registration_completed_at: ''
    };
    var bEntity = createEntity('LEAD_TALENT', ENTITY_STATUS.LEAD_TALENT.PARTIAL, bData, tenantId, null);
    Logger.log('[OK] BOZZA ' + bdef.nome + ' ' + bdef.cognome + ' — campi: ' + Object.keys(bData).length + ' — ' + bEntity.entity_id);
  }

  // 3. LEAD PARZIALE — sezione 3/8, NO score finale
  Logger.log('\n--- Creazione lead parziale (sezione 3/8) ---');
  var tokenParziale = Utilities.getUuid();
  var parzDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  var parzEntity = createEntity('LEAD_TALENT', ENTITY_STATUS.LEAD_TALENT.PARTIAL, {
    _demo: true,
    nome: 'Alessandro', cognome: 'Gatti', email: 'alessandro.gatti@demo.it',
    telefono: '3471234006', citta: 'Bologna',
    lead_token: tokenParziale,
    gdpr_consent: true, gdpr_timestamp: parzDate.toISOString(),
    step_completed: 1, sezione_completata: 3,
    stato_profilo: 'da_compilare', score: 0, ranking: 'D',
    registration_started_at: parzDate.toISOString(),
    registration_completed_at: '', ultimo_accesso: parzDate.toISOString(),
    // S1
    nascita_nazione: 'Italia', nascita_regione: 'Emilia-Romagna',
    nascita_provincia: 'BO', nascita_citta: 'Bologna',
    residenza_nazione: 'Italia', residenza_regione: 'Emilia-Romagna',
    residenza_provincia: 'BO', residenza_citta: 'Bologna',
    domicilio_coincide: true, domicilio_provincia: '',
    instagram: 'https://instagram.com/ale.gatti.bo', facebook: '',
    // S2
    altezza: '175', taglia_tshirt: 'M', taglia_pantalone: '44',
    taglia_gonna: '', numero_scarpe: '43',
    piercing_visibili: 'No', tatuaggi_visibili: 'No', tatuaggi_dove: '',
    // S3
    patente_tipologie: ['B', 'BE'], automunita: 'Sì',
    province_lavoro: ['BO', 'MO', 'FE', 'RE'],
    disponibilita_trasferte: 'Sì', disponibilita_weekend: 'Sì', disponibilita_serali: 'Sì',
    // S4-S8 vuote
    lingua_inglese: '', lingua_francese: '', lingua_spagnolo: '', lingua_tedesco: '',
    altre_lingue: [], titolo_studio: '', titolo_studio_indirizzo: '',
    professione_attuale: [], tipologie_esperienza: [], anni_esperienza_settore: '',
    dotazione_personale: [], codice_fiscale: '', iban: '', partita_iva: '',
    disponibile_chiamata: '', disponibile_ritenuta: '',
    foto_busto_url: '', foto_intera_url: '', cv_url: '',
    doc_identita_url: '', doc_cf_url: '',
    attestato_haccp_url: '', attestato_sicurezza_url: '', foto_extra_url: ''
  }, tenantId, null);
  Logger.log('[OK] PARZIALE Alessandro Gatti — campi: ' + Object.keys(parzEntity.data).length + ' — token: ' + tokenParziale);

  // 4. PROFILI IN ATTESA — questionario completo, hanno score
  Logger.log('\n--- Creazione profili in attesa di approvazione ---');
  for (var i = 0; i < DEMO_LEADS_IN_ATTESA.length; i++) {
    var def = DEMO_LEADS_IN_ATTESA[i];
    var regDate = new Date(now.getTime() - (i + 4) * 24 * 60 * 60 * 1000);
    var data = Object.assign({}, def.data, {
      _demo: true,
      nome: def.nome, cognome: def.cognome, email: def.email,
      telefono: def.telefono, citta: def.citta,
      score: def.score, ranking: def.ranking,
      lead_token: Utilities.getUuid(),
      gdpr_consent: true, gdpr_timestamp: regDate.toISOString(),
      registration_started_at: regDate.toISOString(),
      registration_completed_at: regDate.toISOString(),
      ultimo_accesso: regDate.toISOString()
    });
    var entity = createEntity('LEAD_TALENT', ENTITY_STATUS.LEAD_TALENT.COMPLETED_PENDING_APPROVAL, data, tenantId, null);
    Logger.log('[OK] IN_ATTESA ' + def.nome + ' ' + def.cognome + ' — score ' + def.score +
      ' — campi: ' + Object.keys(data).length + ' — ' + entity.entity_id);
  }

  // 5. PROFILI APPROVATI — stessa struttura, status APPROVED
  Logger.log('\n--- Creazione profili approvati ---');
  var approvedEntities = [];
  for (var j = 0; j < DEMO_LEADS_APPROVATI.length; j++) {
    var adef = DEMO_LEADS_APPROVATI[j];
    var aDate = new Date(now.getTime() - (j + 10) * 24 * 60 * 60 * 1000);
    var adata = Object.assign({}, adef.data, {
      _demo: true,
      nome: adef.nome, cognome: adef.cognome, email: adef.email,
      telefono: adef.telefono, citta: adef.citta,
      score: adef.score, ranking: adef.ranking,
      lead_token: Utilities.getUuid(),
      gdpr_consent: true, gdpr_timestamp: aDate.toISOString(),
      registration_started_at: aDate.toISOString(),
      registration_completed_at: aDate.toISOString(),
      ultimo_accesso: aDate.toISOString()
    });
    var aentity = createEntity('LEAD_TALENT', ENTITY_STATUS.LEAD_TALENT.APPROVED, adata, tenantId, null);
    approvedEntities.push({ entity: aentity, def: adef });
    Logger.log('[OK] APPROVED ' + adef.nome + ' ' + adef.cognome + ' — score ' + adef.score +
      ' — campi: ' + Object.keys(adata).length + ' — ' + aentity.entity_id);
  }

  // 6. ACCOUNT UTENTE per i profili APPROVED (Luca Marino, Valentina Conti)
  Logger.log('\n--- Creazione account utente demo (USER) ---');
  var demoUserCredentials = [
    { email: 'luca.marino@demo.it',     password: 'Demo2024!', nome: 'Luca Marino' },
    { email: 'valentina.conti@demo.it', password: 'Demo2024!', nome: 'Valentina Conti' }
  ];
  var existingUsers = getAllRows('Users');
  for (var du = 0; du < demoUserCredentials.length; du++) {
    var cred = demoUserCredentials[du];
    // Evita duplicati: salta se esiste già un utente con questa email
    var alreadyExists = false;
    for (var eu = 0; eu < existingUsers.length; eu++) {
      if (String(existingUsers[eu].email).toLowerCase().trim() === cred.email) {
        alreadyExists = true;
        break;
      }
    }
    if (alreadyExists) {
      Logger.log('[SKIP] Utente già esistente: ' + cred.email);
      continue;
    }
    appendRow_('Users', {
      user_id:       Utilities.getUuid(),
      tenant_id:     tenantId,
      email:         cred.email,
      password_hash: hashPassword(cred.password),
      role:          'USER',
      status:        'active',
      pwd_version:   0,
      created_at:    now,
      last_login:    '',
      updated_at:    now,
      deleted:       false, deleted_at: '', deleted_by: ''
    });
    Logger.log('[OK] Account USER: ' + cred.email + ' / ' + cred.password);
  }

  // 7. CLIENTI DEMO
  Logger.log('\n--- Creazione clienti demo ---');
  var clientEntities = [];
  for (var ci = 0; ci < DEMO_CLIENTI.length; ci++) {
    var cdef = DEMO_CLIENTI[ci];
    var clientEntity = createEntity('CLIENT', 'ACTIVE', cdef, tenantId, null);
    clientEntities.push(clientEntity);
    Logger.log('[OK] Cliente: ' + cdef.ragione_sociale + ' — ' + clientEntity.entity_id);
  }
  var clientLuxuria = clientEntities[0] ? clientEntities[0].entity_id : '';
  var clientBella   = clientEntities[1] ? clientEntities[1].entity_id : '';

  // 7. EVENTI DEMO — 5 eventi variati con foto reali (1 LIVE + 4 PLANNING)
  Logger.log('\n--- Creazione eventi demo ---');

  // Evento 1: LIVE — Fiera Internazionale (foto Fiera)
  var evFieraDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  var evFieraEnd  = new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000);
  var evFiera = createEntity('EVENT', 'LIVE', {
    _demo: true,
    titolo:             'Fiera Internazionale del Design Milano 2025',
    descrizione:        'Fiera internazionale settore design e arredo — padiglione A, B e C. Accoglienza visitatori, registrazioni, assistenza espositori e hostess punto info.',
    data_inizio:        evFieraDate.toISOString(),
    data_fine:          evFieraEnd.toISOString(),
    luogo:              'Fiera Milano, Rho (MI)',
    citta:              'Milano',
    client_id:          clientLuxuria,
    hostess_richieste:  12,
    foto_url:           'https://assets.cdn.filesafe.space/x6pZr6aPfvpRi52dwPbq/media/69c40c375e43627078d50333.png',
    foto_copertina_url: 'https://assets.cdn.filesafe.space/x6pZr6aPfvpRi52dwPbq/media/69c40c375e43627078d50333.png'
  }, tenantId, null);
  Logger.log('[OK] Evento LIVE: ' + evFiera.data.titolo + ' — ' + evFiera.entity_id);

  // Evento 2: PLANNING — Concerto Milano
  var evConcDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  var evConcEnd  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000);
  var evConc = createEntity('EVENT', 'PLANNING', {
    _demo: true,
    titolo:             'Summer Concert — Arena di Verona',
    descrizione:        'Concerto estivo con artisti internazionali. Hostess accoglienza pubblico, gestione accrediti stampa e VIP lounge.',
    data_inizio:        evConcDate.toISOString(),
    data_fine:          evConcEnd.toISOString(),
    luogo:              'Arena di Verona, Verona',
    citta:              'Verona',
    client_id:          clientLuxuria,
    hostess_richieste:  8,
    foto_url:           'https://assets.cdn.filesafe.space/x6pZr6aPfvpRi52dwPbq/media/69c40c37421e24043b4d7508.png',
    foto_copertina_url: 'https://assets.cdn.filesafe.space/x6pZr6aPfvpRi52dwPbq/media/69c40c37421e24043b4d7508.png'
  }, tenantId, null);
  Logger.log('[OK] Evento PLANNING: ' + evConc.data.titolo + ' — ' + evConc.entity_id);

  // Evento 3: PLANNING — Gala Moda Milano
  var evGalaDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
  var evGalaEnd  = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000);
  var evGala = createEntity('EVENT', 'PLANNING', {
    _demo: true,
    titolo:             'Gala della Moda Milano 2025',
    descrizione:        'Serata di gala per il lancio della nuova collezione primavera/estate. Ospiti VIP, red carpet e cocktail di benvenuto.',
    data_inizio:        evGalaDate.toISOString(),
    data_fine:          evGalaEnd.toISOString(),
    luogo:              'Palazzo Reale, Milano',
    citta:              'Milano',
    client_id:          clientLuxuria,
    hostess_richieste:  6,
    foto_url:           'https://assets.cdn.filesafe.space/x6pZr6aPfvpRi52dwPbq/media/69c40c37e24981297aedef3b.png',
    foto_copertina_url: 'https://assets.cdn.filesafe.space/x6pZr6aPfvpRi52dwPbq/media/69c40c37e24981297aedef3b.png'
  }, tenantId, null);
  Logger.log('[OK] Evento PLANNING: ' + evGala.data.titolo + ' — ' + evGala.entity_id);

  // Evento 4: PLANNING — Congresso Roma
  var evCongrDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  var evCongrEnd  = new Date(now.getTime() + 62 * 24 * 60 * 60 * 1000);
  var evCongr = createEntity('EVENT', 'PLANNING', {
    _demo: true,
    titolo:             'Congresso Nazionale Gastronomia 2025',
    descrizione:        'Congresso annuale operatori ristorazione e catering. Hostess registration desk, assistenza relatori e coordinamento sala.',
    data_inizio:        evCongrDate.toISOString(),
    data_fine:          evCongrEnd.toISOString(),
    luogo:              'Roma Convention Center, Roma',
    citta:              'Roma',
    client_id:          clientBella,
    hostess_richieste:  10,
    foto_url:           'https://assets.cdn.filesafe.space/x6pZr6aPfvpRi52dwPbq/media/69c40c37d0b6d32ecba59d77.png',
    foto_copertina_url: 'https://assets.cdn.filesafe.space/x6pZr6aPfvpRi52dwPbq/media/69c40c37d0b6d32ecba59d77.png'
  }, tenantId, null);
  Logger.log('[OK] Evento PLANNING: ' + evCongr.data.titolo + ' — ' + evCongr.entity_id);

  // Evento 5: PLANNING — Luxury Dinner Roma
  var evLuxDate = new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000);
  var evLuxEnd  = new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000);
  var evLux = createEntity('EVENT', 'PLANNING', {
    _demo: true,
    titolo:             'Luxury Dinner — Villa Borghese',
    descrizione:        'Cena di gala esclusiva per 150 ospiti corporate. Servizio accoglienza, gestione tavoli, sommelier assistants e coordinamento cerimonia.',
    data_inizio:        evLuxDate.toISOString(),
    data_fine:          evLuxEnd.toISOString(),
    luogo:              'Villa Borghese, Roma',
    citta:              'Roma',
    client_id:          clientBella,
    hostess_richieste:  5,
    foto_url:           'https://assets.cdn.filesafe.space/x6pZr6aPfvpRi52dwPbq/media/69c40c378a999b42ebf2fb4f.png',
    foto_copertina_url: 'https://assets.cdn.filesafe.space/x6pZr6aPfvpRi52dwPbq/media/69c40c378a999b42ebf2fb4f.png'
  }, tenantId, null);
  Logger.log('[OK] Evento PLANNING: ' + evLux.data.titolo + ' — ' + evLux.entity_id);

  // 8. TURNI DEMO — 1 per evento LIVE (Fiera) + 1 per Gala
  Logger.log('\n--- Creazione turni demo ---');
  var shiftFiera = createEntity('SHIFT', 'OPEN', {
    _demo: true,
    event_id:          evFiera.entity_id,
    ruolo:             'Hostess Registrazione',
    data_inizio:       evFieraDate.toISOString(),
    data_fine:         new Date(evFieraDate.getTime() + 8 * 60 * 60 * 1000).toISOString(),
    posti_disponibili: 12,
    posti_confermati:  3,
    compenso_orario:   12,
    location:          'Padiglione A, Ingresso Nord'
  }, tenantId, null);
  Logger.log('[OK] Turno Fiera: ' + shiftFiera.entity_id);

  var shiftGalaT = createEntity('SHIFT', 'OPEN', {
    _demo: true,
    event_id:          evGala.entity_id,
    ruolo:             'Hostess Accoglienza VIP',
    data_inizio:       evGalaDate.toISOString(),
    data_fine:         evGalaEnd.toISOString(),
    posti_disponibili: 6,
    posti_confermati:  1,
    compenso_orario:   15,
    location:          'Ingresso principale, piano terra'
  }, tenantId, null);
  Logger.log('[OK] Turno Gala: ' + shiftGalaT.entity_id);

  // 9. CANDIDATURE DEMO — Luca → Fiera, Valentina → Gala
  Logger.log('\n--- Creazione candidature demo ---');
  var lucaEntity = approvedEntities[0] ? approvedEntities[0].entity : null;
  var valEntity  = approvedEntities[1] ? approvedEntities[1].entity : null;

  if (lucaEntity) {
    var appLuca = createEntity('APPLICATION', 'PENDING', {
      _demo: true,
      talent_profile_id: lucaEntity.entity_id,
      talent_name:       'Luca Marino',
      shift_id:          shiftFiera.entity_id,
      shift_ruolo:       'Hostess Registrazione',
      event_titolo:      'Fiera Internazionale del Design Milano 2025',
      messaggio:         'Ho esperienza in fiere internazionali, ottima gestione accrediti e registrazioni.'
    }, tenantId, null);
    Logger.log('[OK] Candidatura Luca → Fiera: ' + appLuca.entity_id);
  }

  if (valEntity) {
    var appVal = createEntity('APPLICATION', 'PENDING', {
      _demo: true,
      talent_profile_id: valEntity.entity_id,
      talent_name:       'Valentina Conti',
      shift_id:          shiftGalaT.entity_id,
      shift_ruolo:       'Hostess Accoglienza VIP',
      event_titolo:      'Gala della Moda Milano 2025',
      messaggio:         'Disponibile e molto motivata. Ho partecipato a eventi simili in precedenza.'
    }, tenantId, null);
    Logger.log('[OK] Candidatura Valentina → Gala: ' + appVal.entity_id);
  }

  // 10. ASSIGNMENT CONFERMATO — Luca Marino per la Fiera
  Logger.log('\n--- Creazione assignment demo ---');
  if (lucaEntity) {
    var assignLuca = createEntity('ASSIGNMENT', 'CONFIRMED', {
      _demo: true,
      talent_profile_id: lucaEntity.entity_id,
      talent_name:       'Luca Marino',
      shift_id:          shiftFiera.entity_id,
      shift_ruolo:       'Hostess Registrazione',
      event_titolo:      'Fiera Internazionale del Design Milano 2025',
      checkin_ts:        '',
      checkout_ts:       '',
      ore_lavorate:      0
    }, tenantId, null);
    Logger.log('[OK] Assignment Luca Marino: ' + assignLuca.entity_id);
  }

  // 11. Verifica admin
  Logger.log('\n--- Verifica utente admin ---');
  var users = getAllRows('Users');
  var adminExists = false;
  for (var u = 0; u < users.length; u++) {
    if ((users[u].role === 'ADMIN' || users[u].role === 'SUPER_ADMIN') &&
        String(users[u].tenant_id) === String(tenantId)) {
      adminExists = true;
      Logger.log('[OK] Admin esistente: ' + users[u].email);
      break;
    }
  }
  if (!adminExists) {
    appendRow_('Users', {
      user_id:       Utilities.getUuid(),
      tenant_id:     tenantId,
      email:         'admin@madeevent.it',
      password_hash: hashPassword('Made2024!'),
      role:          'SUPER_ADMIN',
      status:        'active',
      pwd_version:   0,
      created_at:    now,
      last_login:    '',
      updated_at:    now,
      deleted:       false, deleted_at: '', deleted_by: ''
    });
    Logger.log('[CREATO] Admin: admin@madeevent.it / Made2024!');
  }

  var frontendUrl = PropertiesService.getScriptProperties().getProperty('FRONTEND_URL') || 'http://localhost:3000';
  Logger.log('\n=== SETUP DEMO DATA — COMPLETATO ===');
  Logger.log('RIEPILOGO:');
  Logger.log('  Bozze:        2 (Anna Colombo, Roberto Esposito)');
  Logger.log('  Parziale:     1 (Alessandro Gatti, sezione 3/8)');
  Logger.log('  In attesa:    3 (Sofia 92, Marco 78, Giulia 65)');
  Logger.log('  Approvati:    2 (Luca 58, Valentina 45)');
  Logger.log('  Account USER: luca.marino@demo.it / valentina.conti@demo.it (pw: Demo2024!)');
  Logger.log('  Clienti:      2 (Luxuria Events, Bella Italia Catering)');
  Logger.log('  Eventi:       5 (Fiera LIVE, Concerto/Gala/Congresso/Luxury PLANNING)');
  Logger.log('  Candidature:  2 PENDING (Luca→Fiera, Valentina→Gala)');
  Logger.log('  Assignment:   1 CONFIRMED (Luca Marino, Fiera)');
  Logger.log('  Dashboard:    ' + frontendUrl + '/admin');
}

// ---------------------------------------------------------------------------
// SETUP PRODUZIONE DEMO — eseguire dal GAS Editor per demo completa
// ---------------------------------------------------------------------------

/**
 * Ricrea tutti i dati demo puliti e aggiunge TALENT_PROFILE reali
 * collegati agli account USER per luca.marino e valentina.conti.
 * Eseguire dal GAS Editor prima di una demo del portale talent.
 */
function setupProductionDemoData() {
  Logger.log('=== SETUP PRODUCTION DEMO DATA — START ===');

  // 1. Wipe + ricrea dati base (lead, eventi, turni, candidature, assignment, utenti)
  nukeAllDemoData();

  var tenantId = _getAdminTenantId_();
  if (!tenantId) {
    Logger.log('[ERRORE] Nessun tenant admin trovato dopo nukeAllDemoData.');
    return;
  }

  var now = new Date();

  // 2. Trova user_id per i due account demo
  var users = getAllRows('Users');
  var lucaUserId = null;
  var valUserId  = null;
  for (var i = 0; i < users.length; i++) {
    var email = String(users[i].email).toLowerCase().trim();
    if (email === 'luca.marino@demo.it')     lucaUserId = users[i].user_id;
    if (email === 'valentina.conti@demo.it') valUserId  = users[i].user_id;
  }
  if (!lucaUserId) { Logger.log('[ERRORE] User luca.marino@demo.it non trovato'); return; }
  if (!valUserId)  { Logger.log('[ERRORE] User valentina.conti@demo.it non trovato'); return; }
  Logger.log('[OK] lucaUserId=' + lucaUserId + '  valUserId=' + valUserId);

  // 3. Recupera entità eventi creati da nukeAllDemoData (per linkare le candidature)
  var allEntities = getAllRows('Entities');
  var evFieraId = null, evConcId = null;
  for (var j = 0; j < allEntities.length; j++) {
    var e = allEntities[j];
    if (e.type !== 'EVENT') continue;
    if (String(e.deleted) === 'true') continue;
    var d = parseJSON(e.data);
    if (d._demo !== true) continue;
    if (!evFieraId && (d.titolo || '').indexOf('Fiera') !== -1) evFieraId = e.entity_id;
    if (!evConcId  && (d.titolo || '').indexOf('Gala')  !== -1) evConcId  = e.entity_id;
  }
  Logger.log('[OK] evFieraId=' + evFieraId + '  evConcId=' + evConcId);

  // 4. Crea TALENT_PROFILE per Luca Marino
  var lucaProfile = createEntity('TALENT_PROFILE', 'APPROVED', {
    _demo:              true,
    user_id:            lucaUserId,
    lead_id:            '',
    nome:               'Luca',
    cognome:            'Marino',
    email_contatto:     'luca.marino@demo.it',
    telefono:           '3471234004',
    // S1 anagrafica
    data_nascita:               '15/03/1995',
    citta_nascita:              'Napoli',
    nazionalita:                'Italiana',
    indirizzo_residenza:        'Via Roma 45, Napoli',
    numero_documento:           'AX4521890',
    stato_emissione_documento:  'Italia',
    // S2 fisico
    altezza:            '178',
    taglia:             'L',
    capelli:            'Castani',
    occhi:              'Marroni',
    corporatura:        'Media',
    // S3 logistica
    citta:              'Napoli',
    province_operativita: ['NA', 'SA', 'CE'],
    automunita:         false,
    disponibile_trasferte: false,
    disponibile_weekend: true,
    // S4 lingue
    lingue:             ['Italiano', 'Inglese B1'],
    // S5 esperienza
    esperienza_anni:    1,
    skills:             ['Catering', 'Accrediti', 'Sport Events'],
    esperienze_precedenti: 'Promoter eventi sportivi, staff accrediti fiera 2023',
    // S7 fiscale
    codice_fiscale:     'MRNLCU95C15F839Z',
    iban:               'IT60X0542811101000000123456',
    intestatario_conto: 'Luca Marino',
    partita_iva:        '',
    // Foto
    foto_busto_url:     'https://randomuser.me/api/portraits/men/55.jpg',
    foto_intera_url:    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    foto_caricata_il:   new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    // Meta
    score:              58,
    ranking:            'C',
    rating:             0,
    stato_verifica:     'verified',
    disponibilita:      'Week-end',
    documenti: {
      cv:   {},
      foto: { url: 'https://randomuser.me/api/portraits/men/55.jpg', status: 'valid' },
      carta_identita: {}
    }
  }, tenantId, null);
  Logger.log('[OK] TALENT_PROFILE Luca: ' + lucaProfile.entity_id);

  // 5. Crea TALENT_PROFILE per Valentina Conti
  var valProfile = createEntity('TALENT_PROFILE', 'APPROVED', {
    _demo:              true,
    user_id:            valUserId,
    lead_id:            '',
    nome:               'Valentina',
    cognome:            'Conti',
    email_contatto:     'valentina.conti@demo.it',
    telefono:           '3471234005',
    // S1 anagrafica
    data_nascita:               '22/07/1998',
    citta_nascita:              'Roma',
    nazionalita:                'Italiana',
    indirizzo_residenza:        'Via Nazionale 12, Roma',
    numero_documento:           'BK7834521',
    stato_emissione_documento:  'Italia',
    // S2 fisico
    altezza:            '170',
    taglia:             'S',
    capelli:            'Castani chiari',
    occhi:              'Verdi',
    corporatura:        'Esile',
    // S3 logistica
    citta:              'Roma',
    province_operativita: ['RM', 'MI'],
    automunita:         true,
    disponibile_trasferte: true,
    disponibile_weekend: true,
    // S4 lingue
    lingue:             ['Italiano', 'Inglese C1', 'Francese B1'],
    // S5 esperienza
    esperienza_anni:    3,
    skills:             ['Catering', 'Accrediti', 'Fashion Week', 'Hostess fiera'],
    esperienze_precedenti: 'Hostess Pitti Uomo 2022, Fashion Week Milano 2023, Congresso medico Roma 2023',
    // S7 fiscale
    codice_fiscale:     'CNTVNT98L62H501K',
    iban:               'IT60X0542811101000000654321',
    intestatario_conto: 'Valentina Conti',
    partita_iva:        '',
    // Foto
    foto_busto_url:     'https://randomuser.me/api/portraits/women/21.jpg',
    foto_intera_url:    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    foto_caricata_il:   new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    // Meta
    score:              72,
    ranking:            'B',
    rating:             0,
    stato_verifica:     'verified',
    disponibilita:      'Week-end, Full-time',
    documenti: {
      cv:   {},
      foto: { url: 'https://randomuser.me/api/portraits/women/21.jpg', status: 'valid' },
      carta_identita: {}
    }
  }, tenantId, null);
  Logger.log('[OK] TALENT_PROFILE Valentina: ' + valProfile.entity_id);

  // 6. Candidatura APPROVED di Luca all'evento Fiera (o primo evento disponibile)
  var targetEventLuca = evFieraId || evConcId;
  if (targetEventLuca) {
    var allEvs = getAllRows('Entities');
    var evLucaData = {};
    for (var x = 0; x < allEvs.length; x++) {
      if (allEvs[x].entity_id === targetEventLuca) {
        evLucaData = parseJSON(allEvs[x].data);
        break;
      }
    }
    createEntity('APPLICATION', 'APPROVED', {
      _demo:            true,
      event_id:         targetEventLuca,
      shift_id:         '',
      event_titolo:     evLucaData.titolo || 'Evento demo',
      talent_profile_id: lucaProfile.entity_id,
      talent_name:      'Luca Marino',
      messaggio:        'Disponibile e motivato. Esperienza in accrediti e catering.',
      disponibilita_confermata: true
    }, tenantId, null);
    Logger.log('[OK] APPLICATION APPROVED Luca → ' + (evLucaData.titolo || targetEventLuca));
  }

  // 7. Candidatura APPROVED di Valentina all'evento Gala (o primo diverso da Fiera)
  var targetEventVal = evConcId || evFieraId;
  if (targetEventVal) {
    var allEvs2 = getAllRows('Entities');
    var evValData = {};
    for (var y = 0; y < allEvs2.length; y++) {
      if (allEvs2[y].entity_id === targetEventVal) {
        evValData = parseJSON(allEvs2[y].data);
        break;
      }
    }
    createEntity('APPLICATION', 'APPROVED', {
      _demo:            true,
      event_id:         targetEventVal,
      shift_id:         '',
      event_titolo:     evValData.titolo || 'Evento demo',
      talent_profile_id: valProfile.entity_id,
      talent_name:      'Valentina Conti',
      messaggio:        'Esperienza in fashion e accoglienza VIP. Disponibile da subito.',
      disponibilita_confermata: true
    }, tenantId, null);
    Logger.log('[OK] APPLICATION APPROVED Valentina → ' + (evValData.titolo || targetEventVal));
  }

  Logger.log('\n=== SETUP PRODUCTION DEMO DATA — COMPLETATO ===');
  Logger.log('TALENT PROFILES creati:');
  Logger.log('  Luca Marino    — luca.marino@demo.it / Demo2024! — TALENT_PROFILE: ' + lucaProfile.entity_id);
  Logger.log('  Valentina Conti — valentina.conti@demo.it / Demo2024! — TALENT_PROFILE: ' + valProfile.entity_id);
  Logger.log('Accedi al portale talent su /portale per testare la vista eventi e il profilo.');
}

// ---------------------------------------------------------------------------
// FIX PASSWORD ADMIN — eseguire dal GAS Editor
// ---------------------------------------------------------------------------

/**
 * Stampa nel log il TOKEN_SECRET attivo + genera un token di test per admin.
 * Utile per diagnosticare AUTH_001 da firma invalida.
 */
/**
 * Corregge il tenant_id di admin@madeevent.it nel foglio Users,
 * usando il primo tenant attivo dal foglio Tenants come fonte di verità.
 * Eseguire dal GAS Editor, poi fare logout + login nel browser.
 */
function fixAdminTenantId() {
  var adminEmail = 'admin@madeevent.it';

  // 1. Leggi il tenant reale dal foglio Tenants
  var tenants = getAllRows('Tenants');
  var realTenantId = null;
  for (var i = 0; i < tenants.length; i++) {
    if (tenants[i].status === 'active') {
      realTenantId = String(tenants[i].tenant_id);
      Logger.log('Tenant reale trovato: ' + realTenantId + ' (' + tenants[i].name + ')');
      break;
    }
  }
  if (!realTenantId) {
    Logger.log('[ERRORE] Nessun tenant attivo trovato nel foglio Tenants');
    return;
  }

  // 2. Trova admin@madeevent.it nel foglio Users
  var users = getAllRows('Users');
  var found = null;
  for (var j = 0; j < users.length; j++) {
    if (String(users[j].email).toLowerCase().trim() === adminEmail) {
      found = users[j];
      break;
    }
  }
  if (!found) {
    Logger.log('[ERRORE] ' + adminEmail + ' non trovato nel foglio Users');
    return;
  }

  Logger.log('tenant_id attuale: ' + found.tenant_id);

  if (String(found.tenant_id) === realTenantId) {
    Logger.log('[OK] tenant_id già corretto, nessuna modifica necessaria');
    return;
  }

  // 3. Aggiorna tenant_id
  updateRow('Users', found.user_id, {
    tenant_id:  realTenantId,
    updated_at: new Date()
  });
  Logger.log('[OK] tenant_id aggiornato: ' + found.tenant_id + ' → ' + realTenantId);
  Logger.log('Fai logout + login nel browser per ottenere un nuovo token con il tenant corretto.');
}

function debugTokenSecret() {
  var secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  Logger.log('TOKEN_SECRET presente: ' + !!secret);
  Logger.log('TOKEN_SECRET (primi 8 char): ' + (secret ? secret.substring(0, 8) + '...' : 'ASSENTE'));

  // Forza rinnovo del secret e ri-login necessario
  if (!secret) {
    Logger.log('[WARN] SECRET ASSENTE — la prima chiamata alla Web App lo genererà. Ri-fai il login.');
  }

  // Genera un token di test per admin@madeevent.it
  var users = getAllRows('Users');
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === 'admin@madeevent.it') {
      var u = users[i];
      var now = Date.now();
      var payload = { user_id: u.user_id, tenant_id: u.tenant_id, role: u.role,
                      email: u.email, pwd_version: u.pwd_version || 0,
                      iat: now, exp: now + 8 * 3600 * 1000 };
      var payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
      var sig = Utilities.base64EncodeWebSafe(
        Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, payloadB64, getTokenSecret_())
      );
      Logger.log('Token di test generato: ' + payloadB64 + '.' + sig);
      Logger.log('Copia questo token e incollalo in localStorage dalla console browser:');
      Logger.log('localStorage.setItem("made_event_token", "' + payloadB64 + '.' + sig + '")');
      return;
    }
  }
  Logger.log('[ERRORE] admin@madeevent.it non trovato');
}

function fixAdminPassword() {
  var adminEmail = 'admin@madeevent.it';
  var adminPwd   = 'Made2024!';

  var users = getAllRows('Users');
  var found = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase().trim() === adminEmail) {
      found = users[i];
      break;
    }
  }

  if (!found) {
    Logger.log('[ERRORE] Utente ' + adminEmail + ' non trovato nel foglio Users');
    return;
  }

  var newHash = hashPassword(adminPwd);
  Logger.log('user_id: ' + found.user_id);
  Logger.log('old hash: ' + found.password_hash);
  Logger.log('new hash: ' + newHash);
  Logger.log('verify:   ' + verifyPassword(adminPwd, newHash));

  updateRow('Users', found.user_id, {
    password_hash: newHash,
    status:        'active',
    updated_at:    new Date()
  });

  // Verifica che sia stato scritto correttamente
  var check = getAllRows('Users');
  for (var j = 0; j < check.length; j++) {
    if (check[j].user_id === found.user_id) {
      Logger.log('hash salvato: ' + check[j].password_hash);
      Logger.log('verify post-save: ' + verifyPassword(adminPwd, check[j].password_hash));
      break;
    }
  }

  Logger.log('DONE - hash aggiornato');
}

// ---------------------------------------------------------------------------
// CREA ADMIN DEMO — eseguire dal GAS Editor se l'admin non esiste
// ---------------------------------------------------------------------------

/**
 * Crea (o ricrea) l'utente admin@madeevent.it con password Made2024!
 * Se esiste già, aggiorna la password e lo riattiva.
 * Eseguire direttamente dal GAS Editor.
 */
function createDemoAdmin() {
  var tenantId = getDefaultTenantId_();
  if (!tenantId) {
    Logger.log('[ERRORE] Nessun tenant trovato. Eseguire prima setupDatabase().');
    return;
  }
  Logger.log('Tenant ID: ' + tenantId);

  var adminEmail = 'admin@madeevent.it';
  var adminPwd   = 'Made2024!';
  var users      = getAllRows('Users');
  var existing   = null;

  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase().trim() === adminEmail) {
      existing = users[i];
      break;
    }
  }

  if (existing) {
    // Aggiorna password e riattiva
    updateRow('Users', existing.user_id, {
      password_hash: hashPassword(adminPwd),
      status:        'active',
      role:          'SUPER_ADMIN',
      pwd_version:   (parseInt(existing.pwd_version) || 0) + 1,
      updated_at:    new Date()
    });
    Logger.log('[OK] Utente aggiornato: ' + adminEmail);
  } else {
    // Crea nuovo
    var now = new Date();
    appendRow_('Users', {
      user_id:       Utilities.getUuid(),
      tenant_id:     tenantId,
      email:         adminEmail,
      password_hash: hashPassword(adminPwd),
      role:          'SUPER_ADMIN',
      status:        'active',
      pwd_version:   0,
      created_at:    now,
      last_login:    '',
      updated_at:    now,
      deleted:       false,
      deleted_at:    '',
      deleted_by:    ''
    });
    Logger.log('[OK] Utente creato: ' + adminEmail);
  }

  Logger.log('Login: ' + adminEmail + ' / ' + adminPwd);
}

// ---------------------------------------------------------------------------
// HANDLER GAS — action 'demo.reset' (solo SUPER_ADMIN, solo in dev)
// ---------------------------------------------------------------------------

function handleDemoReset(payload, authPayload) {
  if (authPayload.role !== 'SUPER_ADMIN') {
    return errorResponse('AUTH_005', 'Solo SUPER_ADMIN può resettare i dati demo');
  }

  try {
    setupDemoData();

    // Recupera il token fresco per restituirlo al frontend
    var freshLead = _findDemoFreshLead_();
    var freshToken = freshLead ? (freshLead.data.lead_token || '') : '';

    return successResponse({
      message:    'Demo data ripristinati',
      fresh_token: freshToken,
      leads_count: DEMO_LEADS_BOZZA.length + 1 + DEMO_LEADS_IN_ATTESA.length + DEMO_LEADS_APPROVATI.length
    });
  } catch (err) {
    return errorResponse('SYS_001', 'Errore reset demo: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// HELPERS INTERNI
// ---------------------------------------------------------------------------

/**
 * Ritorna il tenant_id del primo utente SUPER_ADMIN o ADMIN attivo nel foglio Users.
 * Fonte di verità: stesso tenant dell'utente che farà login per la demo.
 */
/**
 * Elimina tutte le entità di un dato tipo che hanno _demo:true nel campo data.
 * Usato per pulire eventi, turni, candidature, assignment demo.
 */
function _deleteDemoEntities_(type) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Entities');
  if (!sheet) return;
  var rawData = sheet.getDataRange().getValues();
  var headers = rawData[0].map(function(h) { return String(h).trim(); });
  var typeIdx     = headers.indexOf('type');
  var dataIdx     = headers.indexOf('data');
  var entityIdIdx = headers.indexOf('entity_id');
  var deletedIdx  = headers.indexOf('deleted');
  var count = 0;
  for (var i = 1; i < rawData.length; i++) {
    var row = rawData[i];
    if (String(row[typeIdx]).toUpperCase() !== type.toUpperCase()) continue;
    if (deletedIdx !== -1 && String(row[deletedIdx]).toLowerCase() === 'true') continue;
    var d = parseJSON(row[dataIdx]);
    if (d && d._demo === true) {
      updateRow('Entities', String(row[entityIdIdx]), { deleted: true, deleted_at: new Date() });
      count++;
    }
  }
  Logger.log('[OK] _deleteDemoEntities_(' + type + '): eliminate ' + count);
}

function _getAdminTenantId_() {
  var users = getAllRows('Users');
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if ((u.role === 'SUPER_ADMIN' || u.role === 'ADMIN') && u.status === 'active') {
      Logger.log('[tenant] trovato da utente ' + u.email + ': ' + u.tenant_id);
      return String(u.tenant_id);
    }
  }
  // Fallback al default
  return getDefaultTenantId_();
}

/**
 * Hard-delete fisico di TUTTE le righe nel foglio Entities dove data._demo === true.
 * Scansione dal basso verso l'alto per evitare problemi di indice dopo deleteRow().
 * Al termine chiama setupDemoData() per ricreare i dati puliti.
 * Eseguire dal GAS Editor prima della demo.
 */
function nukeAllDemoData() {
  Logger.log('=== NUKE ALL DEMO DATA — START ===');

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Entities');
  if (!sheet) {
    Logger.log('[ERRORE] Foglio Entities non trovato');
    return;
  }

  var rawData = sheet.getDataRange().getValues();
  var headers = rawData[0].map(function(h) { return String(h).trim(); });
  var dataIdx = headers.indexOf('data');

  if (dataIdx === -1) {
    Logger.log('[ERRORE] Colonna data non trovata nel foglio Entities');
    return;
  }

  var nuked = 0;
  // Dal basso verso l'alto: deleteRow() sposta le righe successive, quindi
  // scansionando in ordine inverso gli indici rimangono validi.
  for (var i = rawData.length - 1; i >= 1; i--) {
    var d = parseJSON(rawData[i][dataIdx]);
    if (d && d._demo === true) {
      sheet.deleteRow(i + 1); // +1: getValues() è 0-based, il foglio è 1-based
      nuked++;
    }
  }

  Logger.log('[OK] nukeAllDemoData: eliminate fisicamente ' + nuked + ' righe con _demo:true');
  Logger.log('=== NUKE ALL DEMO DATA — COMPLETATO ===\n');

  // Ricrea i dati demo puliti
  setupDemoData();
}

function _deleteDemoLeads_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Entities');
  var rawData = sheet ? sheet.getDataRange().getValues() : [];
  var headers = rawData.length > 0 ? rawData[0].map(function(h) { return String(h).trim(); }) : [];
  var deletedIdx   = headers.indexOf('deleted');
  var typeIdx      = headers.indexOf('type');
  var dataIdx      = headers.indexOf('data');
  var entityIdIdx  = headers.indexOf('entity_id');

  var deleted = 0, skippedAlready = 0, total = 0;

  for (var i = 1; i < rawData.length; i++) {
    var row = rawData[i];
    if (String(row[typeIdx]).toUpperCase() !== 'LEAD_TALENT') continue;
    total++;

    // Salta righe già cancellate
    var isAlreadyDeleted = deletedIdx !== -1 && String(row[deletedIdx]).toLowerCase() === 'true';
    if (isAlreadyDeleted) { skippedAlready++; continue; }

    var rowData = parseJSON(row[dataIdx]);
    var email   = (rowData && rowData.email ? rowData.email : '').toLowerCase();
    var isDemo  = (email.indexOf('@demo.it') !== -1) || (rowData && rowData._demo === true);
    if (isDemo) {
      updateRow('Entities', String(row[entityIdIdx]), { deleted: true, deleted_at: new Date() });
      deleted++;
    }
  }

  Logger.log('[OK] _deleteDemoLeads_: scansionate ' + total + ' righe LEAD_TALENT, ' +
    'già eliminate: ' + skippedAlready + ', eliminate ora: ' + deleted);
}

function _findDemoFreshLead_() {
  var all = getAllRows('Entities');
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.type !== 'LEAD_TALENT') continue;
    if (String(e.deleted) === 'true') continue;
    if (e.status !== ENTITY_STATUS.LEAD_TALENT.PARTIAL) continue;
    var data = parseJSON(e.data);
    if ((data.email || '').toLowerCase() === 'chiara.deluca@demo.it') {
      e.data = data;
      return e;
    }
  }
  return null;
}
