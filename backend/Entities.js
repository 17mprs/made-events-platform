// === ENTITIES.JS — MADE EVENT Platform v1.0 ===
// Layer entità: CRUD generico sul foglio Entities + handler per
// CLIENT_COMPANY, EVENT, SHIFT, APPLICATION, ASSIGNMENT, TALENT.

// ---------------------------------------------------------------------------
// CORE ENTITY CRUD
// ---------------------------------------------------------------------------

/**
 * Crea una nuova entità.
 * @param {string} type   - es. 'EVENT', 'SHIFT', 'APPLICATION'
 * @param {string} status - stato iniziale
 * @param {object} data   - dati business (verrà serializzato come JSON)
 * @param {string} tenantId
 * @param {string} createdBy - user_id
 * @returns {object} l'entità creata con entity_id
 */
function createEntity(type, status, data, tenantId, createdBy) {
  var now = new Date();
  var entityId = Utilities.getUuid();
  appendRow_('Entities', {
    entity_id:  entityId,
    tenant_id:  tenantId,
    type:       type,
    status:     status,
    data:       serializeJSON(data),
    created_by: createdBy || '',
    created_at: now,
    updated_at: now,
    deleted:    false,
    deleted_at: '',
    deleted_by: ''
  });
  return {
    entity_id:  entityId,
    tenant_id:  tenantId,
    type:       type,
    status:     status,
    data:       data,
    created_by: createdBy || '',
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

/**
 * Recupera un'entità per ID con controllo tenant.
 * Ritorna l'entità con data già parsato come oggetto.
 */
function getEntityById(entityId, tenantId) {
  var entity = getRowById('Entities', entityId);
  if (!entity) return null;
  if (tenantId && String(entity.tenant_id) !== String(tenantId)) return null;
  entity.data = parseJSON(entity.data);
  return entity;
}

/**
 * Lista entità per tipo + tenant con filtri opzionali.
 * @param {string} type
 * @param {string} tenantId
 * @param {object} filters - filtri aggiuntivi su entity.data (key:value)
 * @param {number} page
 * @param {number} limit
 */
function listEntities(type, tenantId, filters, page, limit) {
  var all = getAllRows('Entities');
  var results = [];

  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (String(e.type) !== String(type)) continue;
    if (tenantId && String(e.tenant_id) !== String(tenantId)) continue;

    e.data = parseJSON(e.data);

    // Filtri su data
    if (filters) {
      var match = true;
      for (var key in filters) {
        if (filters[key] !== undefined && String(e.data[key]) !== String(filters[key])) {
          match = false;
          break;
        }
      }
      if (!match) continue;
    }

    results.push(e);
  }

  // Ordinamento: più recenti prima
  results.sort(function(a, b) {
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return paginateResults(results, page, limit);
}

/**
 * Aggiorna i dati (data JSON) di un'entità (merge, non sostituzione).
 */
function updateEntityData(entityId, dataUpdates, tenantId, userId) {
  var entity = getEntityById(entityId, tenantId);
  if (!entity) return null;

  var merged = entity.data || {};
  for (var k in dataUpdates) {
    merged[k] = dataUpdates[k];
  }
  updateRow('Entities', entityId, { data: serializeJSON(merged) });
  entity.data = merged;
  return entity;
}

/**
 * Aggiorna lo status di un'entità.
 */
function updateEntityStatus(entityId, newStatus, tenantId) {
  var entity = getEntityById(entityId, tenantId);
  if (!entity) return null;
  updateRow('Entities', entityId, { status: newStatus });
  entity.status = newStatus;
  return entity;
}

/**
 * Soft delete di un'entità.
 */
function softDeleteEntity(entityId, tenantId, userId) {
  var entity = getEntityById(entityId, tenantId);
  if (!entity) return false;
  return softDelete('Entities', entityId, userId);
}

// ---------------------------------------------------------------------------
// CLIENT_COMPANY handlers
// ---------------------------------------------------------------------------

function handleClientCreate(payload, auth) {
  var valid = requireFields(payload, ['ragione_sociale']);
  if (valid) return valid;

  if (!payload.ragione_sociale || !payload.ragione_sociale.trim()) {
    return errorResponse('VAL_001', 'Ragione sociale obbligatoria', 'ragione_sociale');
  }

  var entity = createEntity('CLIENT', 'ACTIVE', {
    ragione_sociale:   payload.ragione_sociale.trim(),
    partita_iva:       payload.partita_iva       || '',
    email:             payload.email             || '',
    telefono:          payload.telefono          || '',
    referente_nome:    payload.referente_nome    || '',
    referente_cognome: payload.referente_cognome || '',
    indirizzo:         payload.indirizzo         || '',
    citta:             payload.citta             || ''
  }, auth.tenant_id, auth.user_id);

  return successResponse({ client: entityToPublic(entity) });
}

function handleClientList(payload, auth) {
  var tenantId = resolvedTenantId_(payload, auth);
  var result = listEntities('CLIENT', tenantId, null, payload.page, payload.limit);
  result.items = result.items.map(entityToPublic);
  return successResponse(result);
}

function handleClientGet(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'CLIENT') {
    return errorResponse('SYS_002', 'Cliente non trovato');
  }

  // CLIENTE: può vedere solo la propria company
  if (auth.role === ROLES.CLIENTE) {
    var clienteEntity = findClienteCompany_(auth.user_id, auth.tenant_id);
    if (!clienteEntity || clienteEntity.entity_id !== entity.entity_id) {
      return errorResponse('AUTH_005', 'Accesso non consentito');
    }
  }

  return successResponse({ client: entityToPublic(entity) });
}

function handleClientUpdate(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'CLIENT') {
    return errorResponse('SYS_002', 'Cliente non trovato');
  }

  var allowedFields = ['ragione_sociale', 'partita_iva', 'email', 'telefono', 'referente_nome', 'referente_cognome', 'indirizzo', 'citta'];
  var updates = {};
  for (var i = 0; i < allowedFields.length; i++) {
    var f = allowedFields[i];
    if (payload[f] !== undefined) updates[f] = payload[f];
  }

  var updated = updateEntityData(payload.entity_id, updates, auth.tenant_id, auth.user_id);
  return successResponse({ client: entityToPublic(updated) });
}

function handleClientSoftDelete(payload, auth) {
  if (!auth || (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SUPER_ADMIN)) {
    return errorResponse('AUTH_003', 'Permesso negato: solo gli admin possono eliminare entity');
  }

  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'CLIENT') {
    return errorResponse('SYS_002', 'Cliente non trovato');
  }

  var ok = softDeleteEntity(payload.entity_id, auth.tenant_id, auth.user_id);
  if (!ok) return errorResponse('SYS_001', 'Impossibile eliminare il cliente');

  return successResponse({ entity_id: payload.entity_id });
}

// ---------------------------------------------------------------------------
// EVENT handlers
// ---------------------------------------------------------------------------

function handleEventCreate(payload, auth) {
  var valid = requireFields(payload, ['titolo', 'client_id']);
  if (valid) return valid;

  // Verifica che il client esista nello stesso tenant
  var client = getEntityById(payload.client_id, auth.tenant_id);
  if (!client || client.type !== 'CLIENT') {
    return errorResponse('SYS_002', 'Cliente non trovato', 'client_id');
  }

  var entity = createEntity('EVENT', ENTITY_STATUS.EVENT.DRAFT, {
    titolo:                    payload.titolo,
    client_id:                 payload.client_id,
    descrizione:               payload.descrizione               || '',
    data_inizio:               payload.data_inizio               || '',
    data_fine:                 payload.data_fine                 || '',
    luogo:                     payload.luogo                     || '',
    citta:                     payload.citta                     || '',
    provincia:                 payload.provincia                 || '',
    foto_url:                  payload.foto_url                  || '',
    foto_copertina_url:        payload.foto_copertina_url        || payload.foto_url || '',
    hostess_richieste:         payload.hostess_richieste         || 0,
    steward_richiesti:         payload.steward_richiesti         || 0,
    anni_esperienza_minimi:    payload.anni_esperienza_minimi    || 0,
    richiede_trasferte:        !!payload.richiede_trasferte,
    richiede_weekend:          !!payload.richiede_weekend,
    sesso_richiesto:           payload.sesso_richiesto           || '',
    altezza_minima:            payload.altezza_minima            || 0,
    taglia_richiesta:          payload.taglia_richiesta          || '',
    lingue_richieste:          payload.lingue_richieste          || [],
    ruoli_richiesti:           payload.ruoli_richiesti           || [],
    automunita:                payload.automunita                || '',
    priorita_lavorato_con_noi: !!payload.priorita_lavorato_con_noi,
    compenso:                  payload.compenso                  || '',
    note_admin:                payload.note_admin                || ''
  }, auth.tenant_id, auth.user_id);

  return successResponse({ event: entityToPublic(entity) });
}

function handleEventSoftDelete(payload, auth) {
  if (!auth || (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SUPER_ADMIN)) {
    return errorResponse('AUTH_003', 'Permesso negato: solo gli admin possono eliminare entity');
  }

  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'EVENT') {
    return errorResponse('SYS_002', 'Evento non trovato');
  }

  var ok = softDeleteEntity(payload.entity_id, auth.tenant_id, auth.user_id);
  if (!ok) return errorResponse('SYS_001', 'Impossibile eliminare l\'evento');

  return successResponse({ entity_id: payload.entity_id });
}

function handleEventList(payload, auth) {
  var tenantId = resolvedTenantId_(payload, auth);
  var filters  = null;

  // CLIENTE vede solo gli eventi legati alla propria company
  if (auth.role === ROLES.CLIENTE) {
    var company = findClienteCompany_(auth.user_id, tenantId);
    if (!company) return successResponse({ items: [], total: 0, page: 1, limit: 50, pages: 0 });
    filters = { client_id: company.entity_id };
  }

  if (payload.status) {
    filters = filters || {};
    filters.status_filter = payload.status;
  }

  var result = listEntities('EVENT', tenantId, filters, payload.page, payload.limit);

  // Filtro status sull'entità (non su data)
  if (payload.status) {
    result.items = result.items.filter(function(e) { return e.status === payload.status; });
    result.total = result.items.length;
  }

  // USER vede solo eventi LIVE o PLANNING con selezioni aperte
  if (auth.role === ROLES.USER) {
    var openStatuses = [ENTITY_STATUS.EVENT.LIVE, ENTITY_STATUS.EVENT.PLANNING];
    result.items = result.items.filter(function(e) {
      return openStatuses.indexOf(e.status) !== -1 && !e.data.selezioni_chiuse;
    });
    result.total = result.items.length;
  }

  result.items = result.items.map(entityToPublic);
  return successResponse(result);
}

function handleEventGet(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'EVENT') return errorResponse('SYS_002', 'Evento non trovato');

  if (auth.role === ROLES.CLIENTE) {
    var company = findClienteCompany_(auth.user_id, auth.tenant_id);
    if (!company || entity.data.client_id !== company.entity_id) {
      return errorResponse('AUTH_005', 'Accesso non consentito');
    }
  }

  return successResponse({ event: entityToPublic(entity) });
}

function handleEventUpdateStatus(payload, auth) {
  var valid = requireFields(payload, ['entity_id', 'new_status']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'EVENT') return errorResponse('SYS_002', 'Evento non trovato');

  return transitionEntityStatus('EVENT', entity, payload.new_status, auth);
}

function handleEventCancel(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'EVENT') return errorResponse('SYS_002', 'Evento non trovato');

  return transitionEntityStatus('EVENT', entity, ENTITY_STATUS.EVENT.CANCELLED, auth);
}

function handleEventUpdate(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'EVENT') {
    return errorResponse('SYS_002', 'Evento non trovato');
  }

  var allowedFields = [
    'titolo', 'descrizione', 'luogo', 'citta', 'provincia', 'client_id', 'foto_url', 'foto_copertina_url',
    'data_inizio', 'data_fine', 'hostess_richieste', 'steward_richiesti', 'selezioni_chiuse', 'note_admin',
    'anni_esperienza_minimi', 'richiede_trasferte', 'richiede_weekend',
    'sesso_richiesto', 'altezza_minima', 'taglia_richiesta',
    'lingue_richieste', 'ruoli_richiesti', 'automunita', 'priorita_lavorato_con_noi',
    'compenso'
  ];
  var updates = {};
  for (var i = 0; i < allowedFields.length; i++) {
    var f = allowedFields[i];
    if (payload[f] !== undefined) updates[f] = payload[f];
  }

  var updated = updateEntityData(payload.entity_id, updates, auth.tenant_id, auth.user_id);
  return successResponse({ event: entityToPublic(updated) });
}

// ---------------------------------------------------------------------------
// SHIFT handlers
// ---------------------------------------------------------------------------

function handleShiftCreate(payload, auth) {
  var valid = requireFields(payload, ['event_id', 'data', 'orario_inizio', 'orario_fine', 'posti_disponibili']);
  if (valid) return valid;

  var event = getEntityById(payload.event_id, auth.tenant_id);
  if (!event || event.type !== 'EVENT') {
    return errorResponse('SYS_002', 'Evento non trovato', 'event_id');
  }

  var posti = parseInt(payload.posti_disponibili);
  if (isNaN(posti) || posti < 1) {
    return errorResponse('VAL_002', 'posti_disponibili deve essere >= 1', 'posti_disponibili');
  }

  var entity = createEntity('SHIFT', ENTITY_STATUS.SHIFT.OPEN, {
    event_id:           payload.event_id,
    data:               payload.data,
    orario_inizio:      payload.orario_inizio,
    orario_fine:        payload.orario_fine,
    posti_disponibili:  posti,
    posti_confermati:   0,
    ruolo:              payload.ruolo             || '',
    dress_code:         payload.dress_code        || '',
    meeting_point:      payload.meeting_point     || '',
    note_operational:   payload.note_operational  || ''
  }, auth.tenant_id, auth.user_id);

  return successResponse({ shift: entityToPublic(entity) });
}

function handleShiftList(payload, auth) {
  var tenantId = resolvedTenantId_(payload, auth);
  var filters  = {};

  if (payload.event_id) filters.event_id = payload.event_id;

  // USER vede solo shift OPEN
  if (auth.role === ROLES.USER) {
    var result = listEntities('SHIFT', tenantId, filters, payload.page, payload.limit);
    result.items = result.items.filter(function(e) { return e.status === ENTITY_STATUS.SHIFT.OPEN; });
    result.total = result.items.length;
    result.items = result.items.map(entityToPublic);
    return successResponse(result);
  }

  // CLIENTE vede shift degli eventi della propria company
  if (auth.role === ROLES.CLIENTE) {
    var company = findClienteCompany_(auth.user_id, tenantId);
    if (!company) return successResponse({ items: [], total: 0, page: 1, limit: 50, pages: 0 });
    // Trova eventi del cliente
    var events = getAllRows('Entities').filter(function(e) {
      return e.type === 'EVENT' &&
             String(e.tenant_id) === String(tenantId) &&
             String(e.deleted) !== 'true' &&
             parseJSON(e.data).client_id === company.entity_id;
    }).map(function(e) { return e.entity_id; });

    var result = listEntities('SHIFT', tenantId, filters, payload.page, payload.limit);
    result.items = result.items.filter(function(e) { return events.indexOf(e.data.event_id) !== -1; });
    result.total = result.items.length;
    result.items = result.items.map(entityToPublic);
    return successResponse(result);
  }

  var result = listEntities('SHIFT', tenantId, filters, payload.page, payload.limit);
  if (payload.status) {
    result.items = result.items.filter(function(e) { return e.status === payload.status; });
    result.total = result.items.length;
  }
  result.items = result.items.map(entityToPublic);
  return successResponse(result);
}

function handleShiftGet(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'SHIFT') return errorResponse('SYS_002', 'Shift non trovato');

  return successResponse({ shift: entityToPublic(entity) });
}

function handleShiftUpdateStatus(payload, auth) {
  var valid = requireFields(payload, ['entity_id', 'new_status']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'SHIFT') return errorResponse('SYS_002', 'Shift non trovato');

  return transitionEntityStatus('SHIFT', entity, payload.new_status, auth);
}

// ---------------------------------------------------------------------------
// APPLICATION handlers
// ---------------------------------------------------------------------------

function handleApplicationList(payload, auth) {
  var tenantId = resolvedTenantId_(payload, auth);
  var filters  = {};

  if (payload.shift_id) filters.shift_id = payload.shift_id;

  // USER vede solo le proprie candidature
  if (auth.role === ROLES.USER) {
    var profile = findTalentProfileByUserId_(auth.user_id, tenantId);
    if (!profile) return successResponse({ items: [], total: 0, page: 1, limit: 50, pages: 0 });
    filters.talent_profile_id = profile.entity_id;
  }

  var result = listEntities('APPLICATION', tenantId, filters, payload.page, payload.limit);
  result.items = result.items.map(entityToPublic);
  return successResponse(result);
}

function handleApplicationListAll(payload, auth) {
  if (!auth || (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SUPER_ADMIN)) {
    return errorResponse('AUTH_003', 'Permesso negato');
  }

  var tenantId = String(auth.tenant_id);
  var all = getAllRows('Entities');

  // Build event snapshot map (INCLUDING soft-deleted events)
  var evMap = {};
  var tpMap = {};
  all.forEach(function(row) {
    if (String(row.tenant_id) !== tenantId) return;
    var d = parseJSON(row.data);
    if (row.type === 'EVENT') {
      evMap[row.entity_id] = {
        titolo:      d.titolo      || '',
        data_inizio: d.data_inizio || '',
        data_fine:   d.data_fine   || '',
        luogo:       d.luogo       || '',
        citta:       d.citta       || '',
        status:      row.status    || '',
        deleted:     String(row.deleted).toLowerCase() === 'true',
        deleted_at:  row.deleted_at || '',
      };
    }
    if (row.type === 'TALENT_PROFILE') {
      tpMap[row.entity_id] = {
        nome:           d.nome           || '',
        cognome:        d.cognome        || '',
        foto_busto_url: d.foto_busto_url || '',
        score:          d.score != null  ? Number(d.score) : null,
        ranking:        d.ranking        || '',
        citta:          d.citta          || '',
      };
    }
  });

  // All non-deleted applications for this tenant
  var appRows = all.filter(function(row) {
    if (row.type !== 'APPLICATION') return false;
    if (String(row.tenant_id) !== tenantId) return false;
    if (String(row.deleted).toLowerCase() === 'true') return false;
    return true;
  });

  var items = appRows.map(function(row) {
    var pub = entityToPublic(row);
    var d   = pub.data || {};
    pub.event_snapshot   = evMap[d.event_id] || {
      titolo: d.event_titolo || '(evento sconosciuto)',
      data_inizio: '', data_fine: '', luogo: '', citta: '',
      status: '', deleted: false, deleted_at: '',
    };
    pub.talent_snapshot  = tpMap[d.talent_profile_id] || {
      nome: d.talent_name || '', cognome: '', foto_busto_url: '',
      score: null, ranking: '', citta: '',
    };
    return pub;
  });

  items.sort(function(a, b) {
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  return successResponse({ items: items, total: items.length });
}

function handleApplicationInvite(payload, auth) {
  var valid = requireFields(payload, ['talent_profile_id', 'event_id']);
  if (valid) return valid;

  var talent = getEntityById(payload.talent_profile_id, auth.tenant_id);
  if (!talent || talent.type !== 'TALENT_PROFILE') {
    return errorResponse('SYS_002', 'Talent profile non trovato');
  }
  var approvedStatuses = [ENTITY_STATUS.TALENT_PROFILE.APPROVED, ENTITY_STATUS.TALENT_PROFILE.ACTIVE];
  if (approvedStatuses.indexOf(talent.status) === -1) {
    return errorResponse('BIZ_002', 'Il talent non è approvato');
  }

  // Trova il primo shift OPEN per l'evento
  var allEntities = getAllRows('Entities');
  var shift = null;
  for (var i = 0; i < allEntities.length; i++) {
    var e = allEntities[i];
    if (e.type !== 'SHIFT') continue;
    if (String(e.tenant_id) !== String(auth.tenant_id)) continue;
    if (String(e.deleted).toLowerCase() === 'true') continue;
    if (e.status !== ENTITY_STATUS.SHIFT.OPEN) continue;
    var sd = parseJSON(e.data);
    if (String(sd.event_id) === String(payload.event_id)) {
      e.data = sd;
      shift = e;
      break;
    }
  }

  if (!shift) {
    return errorResponse('WF_003', 'Nessun turno OPEN trovato per questo evento');
  }

  // Controlla candidatura duplicata per questo talent+shift
  for (var j = 0; j < allEntities.length; j++) {
    var ae = allEntities[j];
    if (ae.type !== 'APPLICATION') continue;
    if (String(ae.tenant_id) !== String(auth.tenant_id)) continue;
    if (String(ae.deleted).toLowerCase() === 'true') continue;
    var ad = parseJSON(ae.data);
    if (String(ad.shift_id) === String(shift.entity_id) &&
        String(ad.talent_profile_id) === String(payload.talent_profile_id)) {
      return errorResponse('BIZ_001', 'Esiste già una candidatura per questo talent e turno');
    }
  }

  var application = createEntity('APPLICATION', ENTITY_STATUS.APPLICATION.INVITED, {
    shift_id:          shift.entity_id,
    event_id:          payload.event_id,
    talent_profile_id: payload.talent_profile_id,
    invited_by:        auth.user_id,
    messaggio:         payload.messaggio || ''
  }, auth.tenant_id, auth.user_id);

  return successResponse({
    application_id: application.entity_id,
    status:         ENTITY_STATUS.APPLICATION.INVITED,
    shift_id:       shift.entity_id,
    message:        'Invito inviato con successo.'
  });
}

function handleAssignmentList(payload, auth) {
  var tenantId = resolvedTenantId_(payload, auth);
  var filters  = {};

  if (payload.shift_id) filters.shift_id = payload.shift_id;

  // USER vede solo i propri assignment
  if (auth.role === ROLES.USER) {
    var profile = findTalentProfileByUserId_(auth.user_id, tenantId);
    if (!profile) return successResponse({ items: [], total: 0, page: 1, limit: 50, pages: 0 });
    filters.talent_profile_id = profile.entity_id;
  }

  // CLIENTE vede assignment degli eventi propri
  if (auth.role === ROLES.CLIENTE) {
    var company = findClienteCompany_(auth.user_id, tenantId);
    if (!company) return successResponse({ items: [], total: 0, page: 1, limit: 50, pages: 0 });

    var clientEvents = getAllRows('Entities').filter(function(e) {
      return e.type === 'EVENT' &&
             String(e.tenant_id) === String(tenantId) &&
             String(e.deleted) !== 'true' &&
             parseJSON(e.data).client_id === company.entity_id;
    }).map(function(e) { return e.entity_id; });

    var clientShifts = getAllRows('Entities').filter(function(e) {
      return e.type === 'SHIFT' &&
             String(e.tenant_id) === String(tenantId) &&
             String(e.deleted) !== 'true' &&
             clientEvents.indexOf(parseJSON(e.data).event_id) !== -1;
    }).map(function(e) { return e.entity_id; });

    var result = listEntities('ASSIGNMENT', tenantId, filters, payload.page, payload.limit);
    result.items = result.items.filter(function(e) { return clientShifts.indexOf(e.data.shift_id) !== -1; });
    result.total = result.items.length;
    result.items = result.items.map(entityToPublic);
    return successResponse(result);
  }

  var result = listEntities('ASSIGNMENT', tenantId, filters, payload.page, payload.limit);
  result.items = result.items.map(entityToPublic);
  return successResponse(result);
}

function handleAssignmentValidate(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'ASSIGNMENT') return errorResponse('SYS_002', 'Assignment non trovato');

  // CLIENTE può validare solo assignment degli eventi propri
  if (auth.role === ROLES.CLIENTE) {
    var company = findClienteCompany_(auth.user_id, auth.tenant_id);
    if (!company) return errorResponse('AUTH_005', 'Accesso non consentito');

    var shift = getEntityById(entity.data.shift_id, auth.tenant_id);
    if (!shift) return errorResponse('SYS_002', 'Shift non trovato');
    var event = getEntityById(shift.data.event_id, auth.tenant_id);
    if (!event || event.data.client_id !== company.entity_id) {
      return errorResponse('AUTH_005', 'Puoi validare solo assignment dei tuoi eventi');
    }
  }

  return transitionEntityStatus('ASSIGNMENT', entity, ENTITY_STATUS.ASSIGNMENT.VALIDATED, auth);
}

function handleAssignmentUpdatePayment(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'ASSIGNMENT') return errorResponse('SYS_002', 'Assignment non trovato');

  return transitionEntityStatus('ASSIGNMENT', entity, ENTITY_STATUS.ASSIGNMENT.PAID, auth);
}

// ---------------------------------------------------------------------------
// TALENT profile handlers (list, get, updateProfile)
// ---------------------------------------------------------------------------

function handleTalentList(payload, auth) {
  var tenantId = resolvedTenantId_(payload, auth);

  // USER vede solo il proprio profilo talent
  if (auth.role === ROLES.USER) {
    var myProfile = findTalentProfileByUserId_(auth.user_id, tenantId);
    if (!myProfile) return successResponse({ items: [], total: 0, page: 1, limit: 50, pages: 0 });
    return successResponse({ items: [talentToPublic(myProfile, auth.role)], total: 1, page: 1, limit: 50, pages: 1 });
  }

  var filters  = {};
  if (payload.ranking)  filters.ranking = payload.ranking;
  if (payload.citta)    filters.citta   = payload.citta;

  var result = listEntities('TALENT_PROFILE', tenantId, filters, payload.page, payload.limit);

  // Filtro status sull'entità
  if (payload.status) {
    result.items = result.items.filter(function(e) { return e.status === payload.status; });
    result.total = result.items.length;
  }

  result.items = result.items.map(function(e) { return talentToPublic(e, auth.role); });
  return successResponse(result);
}

function handleTalentGet(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var perm = checkPermission(auth.role, 'talent.get');
  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'TALENT_PROFILE') return errorResponse('SYS_002', 'Talent profile non trovato');

  // USER può vedere solo il proprio profilo
  if (perm.ownOnly) {
    var myProfile = findTalentProfileByUserId_(auth.user_id, auth.tenant_id);
    if (!myProfile || myProfile.entity_id !== entity.entity_id) {
      return errorResponse('AUTH_005', 'Puoi accedere solo al tuo profilo');
    }
  }

  return successResponse({ talent: talentToPublic(entity, auth.role) });
}

function handleTalentUpdateProfile(payload, auth) {
  var valid = requireFields(payload, ['entity_id']);
  if (valid) return valid;

  var perm = checkPermission(auth.role, 'talent.updateProfile');
  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity || entity.type !== 'TALENT_PROFILE') return errorResponse('SYS_002', 'Talent profile non trovato');

  if (perm.ownOnly) {
    var myProfile = findTalentProfileByUserId_(auth.user_id, auth.tenant_id);
    if (!myProfile || myProfile.entity_id !== entity.entity_id) {
      return errorResponse('AUTH_005', 'Puoi modificare solo il tuo profilo');
    }
  }

  var allowedFields = [
    // S1 — Dati Personali
    'telefono', 'data_nascita', 'citta_nascita', 'nazionalita',
    'indirizzo_residenza', 'numero_documento', 'stato_emissione_documento',
    // S2 — Profilo Fisico
    'altezza', 'taglia', 'capelli', 'occhi', 'corporatura',
    // S3 — Logistica
    'citta', 'province_operativita', 'automunita',
    'disponibile_trasferte', 'disponibile_weekend',
    // S4 — Lingue
    'lingue',
    // S5 — Esperienza
    'esperienza_anni', 'skills', 'esperienze_precedenti',
    // S6 — Attrezzatura
    'attrezzatura',
    // S7 — Fiscale
    'codice_fiscale', 'iban', 'intestatario_conto', 'partita_iva',
    // Altro
    'disponibilita', 'note'
  ];
  var updates = {};
  for (var i = 0; i < allowedFields.length; i++) {
    var f = allowedFields[i];
    if (payload[f] !== undefined) updates[f] = payload[f];
  }

  // USER → salva come pending_data e passa a PENDING_REVIEW
  if (auth.role === ROLES.USER) {
    var pendingUpdates = {};
    for (var k in updates) { pendingUpdates[k] = updates[k]; }
    updates.pending_data = pendingUpdates;
    updates.pending_submitted_at = new Date().toISOString();
    updateEntityData(payload.entity_id, updates, auth.tenant_id, auth.user_id);
    updateRow('Entities', payload.entity_id, { status: ENTITY_STATUS.TALENT_PROFILE.PENDING_REVIEW });
    entity.status = ENTITY_STATUS.TALENT_PROFILE.PENDING_REVIEW;
    entity.data = Object.assign({}, entity.data, updates);
    return successResponse({ talent: talentToPublic(entity, auth.role), pending: true });
  }

  // ADMIN → aggiornamento diretto
  var updated = updateEntityData(payload.entity_id, updates, auth.tenant_id, auth.user_id);
  return successResponse({ talent: talentToPublic(updated, auth.role) });
}

function handleUpdateScoreAdmin(payload, auth) {
  if (!auth || (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SUPER_ADMIN)) {
    return errorResponse('AUTH_003', 'Permesso negato');
  }

  var valid = requireFields(payload, ['entity_id', 'score_admin']);
  if (valid) return valid;

  var scoreAdmin = parseInt(payload.score_admin);
  if (isNaN(scoreAdmin) || scoreAdmin < 1 || scoreAdmin > 10) {
    return errorResponse('VAL_002', 'Score admin deve essere tra 1 e 10');
  }

  var entity = getEntityById(payload.entity_id, auth.tenant_id);
  if (!entity) return errorResponse('SYS_002', 'Talent non trovato');

  var scoreQuestionario = entity.data.score_questionario || 0;
  var scoreFinal = calculateFinalScore(scoreQuestionario, scoreAdmin);

  updateEntityData(payload.entity_id, {
    score_admin: scoreAdmin,
    score:       scoreFinal
  }, auth.tenant_id, auth.user_id);

  return successResponse({
    score_admin:       scoreAdmin,
    score_questionario: scoreQuestionario,
    score:             scoreFinal
  });
}

function handleUpdateEventiPreCRM(payload, auth) {
  if (!auth || (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SUPER_ADMIN)) {
    return errorResponse('AUTH_003', 'Permesso negato');
  }

  var valid = requireFields(payload, ['entity_id', 'eventi_precrm']);
  if (valid) return valid;

  var eventiPreCRM = parseInt(payload.eventi_precrm);
  if (isNaN(eventiPreCRM) || eventiPreCRM < 0) {
    return errorResponse('VAL_002', 'eventi_precrm deve essere un numero >= 0');
  }

  var talent = getEntityById(payload.entity_id, auth.tenant_id);
  if (!talent || talent.type !== 'TALENT_PROFILE') {
    return errorResponse('SYS_002', 'Talent non trovato');
  }

  var td       = talent.data || {};
  var eventiCRM = parseInt(td.eventi_crm_completati) || 0;

  var scoreQuestionario = calculateQuestionarioScore(td);
  var scoreAdmin        = td.score_admin || 5;
  var scoreFinal        = calculateFinalScore(scoreQuestionario, scoreAdmin);

  updateEntityData(payload.entity_id, {
    eventi_precrm:      eventiPreCRM,
    eventi_made_totali: eventiCRM + eventiPreCRM,
    score_questionario: scoreQuestionario,
    score:              scoreFinal
  }, auth.tenant_id, auth.user_id);

  return successResponse({
    eventi_precrm:      eventiPreCRM,
    eventi_made_totali: eventiCRM + eventiPreCRM,
    score:              scoreFinal
  });
}

function handleGetMatchingTalents(payload, auth) {
  if (!auth || (auth.role !== ROLES.ADMIN && auth.role !== ROLES.SUPER_ADMIN)) {
    return errorResponse('AUTH_003', 'Permesso negato');
  }

  var valid = requireFields(payload, ['event_id']);
  if (valid) return valid;

  var evento = getEntityById(payload.event_id, auth.tenant_id);
  if (!evento || evento.type !== 'EVENT') {
    return errorResponse('SYS_002', 'Evento non trovato');
  }

  var result = listEntities('TALENT_PROFILE', auth.tenant_id, null, 1, 1000);
  var talents = (result.items || []).filter(function(t) {
    return t.status === ENTITY_STATUS.TALENT_PROFILE.APPROVED ||
           t.status === ENTITY_STATUS.TALENT_PROFILE.ACTIVE;
  });

  var talentsWithMatch = talents.map(function(talent) {
    var matchPct = calculateEventMatch(evento, talent);
    return {
      entity_id:        talent.entity_id,
      match_percentage: matchPct,
      score:            talent.data.score || 0,
      nome:             talent.data.nome  || '',
      cognome:          talent.data.cognome || '',
      data:             talent.data
    };
  });

  talentsWithMatch.sort(function(a, b) { return b.match_percentage - a.match_percentage; });

  return successResponse({ talents: talentsWithMatch, count: talentsWithMatch.length });
}

// ---------------------------------------------------------------------------
// SERIALIZZAZIONE PUBBLICA
// ---------------------------------------------------------------------------

function entityToPublic(entity) {
  if (!entity) return null;
  return {
    entity_id:  entity.entity_id,
    tenant_id:  entity.tenant_id,
    type:       entity.type,
    status:     entity.status,
    data:       entity.data,
    created_by: entity.created_by,
    created_at: entity.created_at,
    updated_at: entity.updated_at
  };
}

function talentToPublic(entity, role) {
  if (!entity) return null;
  var pub = entityToPublic(entity);
  // ADMIN/SUPER_ADMIN vedono tutto; USER vede solo il proprio (già filtrato prima)
  // Documenti identità: solo ADMIN (dati Classe A per PRD)
  if (role === ROLES.USER || role === ROLES.CLIENTE) {
    if (pub.data && pub.data.documenti) {
      delete pub.data.documenti.carta_identita;
    }
  }
  return pub;
}

// ---------------------------------------------------------------------------
// HELPERS INTERNI
// ---------------------------------------------------------------------------

function resolvedTenantId_(payload, auth) {
  if (auth.role === ROLES.SUPER_ADMIN && payload.tenant_id) return payload.tenant_id;
  return auth.tenant_id;
}

/**
 * Trova il TALENT_PROFILE associato a un user_id.
 */
function findTalentProfileByUserId_(userId, tenantId) {
  var all = getAllRows('Entities');
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.type !== 'TALENT_PROFILE') continue;
    if (tenantId && String(e.tenant_id) !== String(tenantId)) continue;
    var d = parseJSON(e.data);
    if (String(d.user_id) === String(userId)) {
      e.data = d;
      return e;
    }
  }
  return null;
}

/**
 * Trova la CLIENT_COMPANY di un utente CLIENTE tramite user_id.
 * Convenzione: il user.email corrisponde a un referente nella company.
 * In alternativa, si può usare un campo 'cliente_user_id' nella company.
 */
function findClienteCompany_(userId, tenantId) {
  var all = getAllRows('Entities');
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.type !== 'CLIENT') continue;
    if (tenantId && String(e.tenant_id) !== String(tenantId)) continue;
    var d = parseJSON(e.data);
    if (String(d.cliente_user_id) === String(userId)) {
      e.data = d;
      return e;
    }
  }
  return null;
}
