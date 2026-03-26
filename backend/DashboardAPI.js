// === DASHBOARDAPI.JS — MADE EVENT Platform ===
// dashboard.bootstrap: recupera leads, events, applications e stats in una sola chiamata.
// Riduce il cold start penalty da N chiamate GAS parallele a 1 sola esecuzione.

// ---------------------------------------------------------------------------
// DASHBOARD.BOOTSTRAP
// ---------------------------------------------------------------------------

/**
 * Restituisce tutti i dati necessari alla dashboard admin in una sola chiamata.
 * @returns {{ leads, events, applications, stats }}
 *   - leads:        array LEAD_TALENT entities del tenant
 *   - events:       array EVENT entities del tenant
 *   - applications: array APPLICATION entities del tenant
 *   - stats:        { totalLeads, pendingTalent, activeEvents, pendingApps }
 */
function handleDashboardBootstrap(payload, auth) {
  var tenantId = (auth.role === ROLES.SUPER_ADMIN && payload.tenant_id)
    ? payload.tenant_id
    : auth.tenant_id;

  // Singola lettura del foglio Entities — poi filtriamo in memoria
  var allRows = getAllRows('Entities');

  var leads        = [];
  var events       = [];
  var applications = [];
  var pendingTalent = 0;

  var activeEventStatuses = [
    ENTITY_STATUS.EVENT.DRAFT,
    ENTITY_STATUS.EVENT.PLANNING,
    ENTITY_STATUS.EVENT.LIVE
  ];
  var pendingAppStatuses = [
    ENTITY_STATUS.APPLICATION.PENDING,
    ENTITY_STATUS.APPLICATION.INVITED
  ];

  for (var i = 0; i < allRows.length; i++) {
    var e = allRows[i];

    // Tenant isolation
    if (String(e.tenant_id) !== String(tenantId)) continue;
    // Salta soft-deleted
    if (String(e.deleted).toLowerCase() === 'true') continue;

    e.data = parseJSON(e.data);

    switch (e.type) {
      case 'LEAD_TALENT':
        leads.push(entityToPublic(e));
        break;

      case 'EVENT': {
        var pub = entityToPublic(e);
        if (pub.data) {
          // Garantisce foto_copertina_url — retrocompatibilità con eventi senza il campo
          pub.data.foto_copertina_url = pub.data.foto_copertina_url || pub.data.foto_url || null;
        }
        events.push(pub);
        break;
      }

      case 'APPLICATION':
        applications.push(entityToPublic(e));
        break;

      case 'TALENT_PROFILE':
        if (e.status === ENTITY_STATUS.TALENT_PROFILE.PENDING_REVIEW) {
          pendingTalent++;
        }
        break;
    }
  }

  var activeEvents = 0;
  for (var ei = 0; ei < events.length; ei++) {
    if (activeEventStatuses.indexOf(events[ei].status) !== -1) activeEvents++;
  }

  var pendingApps = 0;
  for (var ai = 0; ai < applications.length; ai++) {
    if (pendingAppStatuses.indexOf(applications[ai].status) !== -1) pendingApps++;
  }

  return successResponse({
    leads:        leads,
    events:       events,
    applications: applications,
    stats: {
      totalLeads:   leads.length,
      pendingTalent: pendingTalent,
      activeEvents:  activeEvents,
      pendingApps:   pendingApps
    }
  });
}
