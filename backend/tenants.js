// === TENANTS.JS — MADE EVENT Platform v1.0 ===
// Gestione tenant: create, get, list, update.

function createTenant(name, product) {
  var now = new Date();
  var tenantId = Utilities.getUuid();
  appendRow_('Tenants', {
    tenant_id:  tenantId,
    name:       name || 'Nuovo Tenant',
    product:    product || 'MADE_EVENT_PLATFORM',
    slug:       (name || 'nuovo-tenant').toLowerCase().replace(/\s+/g, '-'),
    status:     'active',
    created_at: now,
    updated_at: now,
    deleted:    false,
    deleted_at: '',
    deleted_by: ''
  });
  return tenantId;
}

function getTenant(tenantId) {
  return getRowById('Tenants', tenantId);
}

function listTenants() {
  return getAllRows('Tenants');
}

function updateTenant(tenantId, updates) {
  return updateRow('Tenants', tenantId, updates);
}

// Handler esposto via router (solo SUPER_ADMIN)
function handleTenantList(payload, authPayload) {
  if (authPayload.role !== ROLES.SUPER_ADMIN) {
    return { success: false, error: { code: 'AUTH_005', message: 'Solo SUPER_ADMIN può elencare i tenant' } };
  }
  var tenants = listTenants();
  return { success: true, data: paginateResults(tenants, payload.page, payload.limit) };
}

function handleTenantGet(payload, authPayload) {
  var tenantId = authPayload.role === ROLES.SUPER_ADMIN
    ? (payload.tenant_id || authPayload.tenant_id)
    : authPayload.tenant_id;

  var tenant = getTenant(tenantId);
  if (!tenant) return { success: false, error: { code: 'SYS_002', message: 'Tenant non trovato' } };
  return { success: true, data: { tenant: tenant } };
}
