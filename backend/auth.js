// === AUTH.JS — MADE EVENT Platform v1.0 ===
// Autenticazione: login, token HMAC-SHA256, logout, changePassword.
// Gestione utenti: create, list, get, update, deactivate.

// ---------------------------------------------------------------------------
// TOKEN — generazione e verifica HMAC-SHA256
// ---------------------------------------------------------------------------

function getTokenSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('TOKEN_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + '-' + Utilities.getUuid();
    props.setProperty('TOKEN_SECRET', secret);
  }
  return secret;
}

function hashPassword(password) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return digest.map(function(b) {
    var hex = (b < 0 ? b + 256 : b).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function verifyPassword(password, storedHash) {
  if (hashPassword(password) === storedHash) return true;
  // Fallback legacy base64
  var legacyHash = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password)
  );
  return legacyHash === storedHash;
}

function generateToken_(user) {
  var now = Date.now();
  var payload = {
    user_id:     user.user_id,
    tenant_id:   user.tenant_id,
    role:        user.role,
    email:       user.email,
    pwd_version: user.pwd_version || 0,
    iat:         now,
    exp:         now + SYSTEM_CONFIG.TOKEN_EXPIRY_MS
  };
  var payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var signature  = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSignature(
      Utilities.MacAlgorithm.HMAC_SHA_256,
      payloadB64,
      getTokenSecret_()
    )
  );
  return payloadB64 + '.' + signature;
}

/**
 * Verifica firma + scadenza del token.
 * Ritorna { valid, payload, error }.
 * NON fa lookups su Sheets (step 3/4/5 spettano al router).
 */
function verifyToken(token) {
  if (!token) return { valid: false, payload: null, error: 'AUTH_001' };

  var parts = token.split('.');
  if (parts.length !== 2) return { valid: false, payload: null, error: 'AUTH_001' };

  var payloadB64 = parts[0];
  var signature  = parts[1];
  var expectedSig = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSignature(
      Utilities.MacAlgorithm.HMAC_SHA_256,
      payloadB64,
      getTokenSecret_()
    )
  );
  if (signature !== expectedSig) return { valid: false, payload: null, error: 'AUTH_001' };

  var payload;
  try {
    payload = JSON.parse(
      Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString()
    );
  } catch (e) {
    return { valid: false, payload: null, error: 'AUTH_001' };
  }

  if (payload.exp && Date.now() > payload.exp) {
    return { valid: false, payload: payload, error: 'AUTH_002' };
  }

  return { valid: true, payload: payload, error: null };
}

/**
 * Verifica token + stato utente + pwd_version (per invalidazione sessione).
 * Usato da handlers che necessitano di verifica completa.
 */
function verifyTokenFull(token) {
  var check = verifyToken(token);
  if (!check.valid) return check;

  var p = check.payload;
  var user = getRowById('Users', p.user_id);
  if (!user || user.status !== 'active') {
    return { valid: false, payload: p, error: 'AUTH_004' };
  }
  // Verifica pwd_version: se l'utente ha cambiato password, i vecchi token sono invalidi
  if (String(p.pwd_version) !== String(user.pwd_version || 0)) {
    return { valid: false, payload: p, error: 'AUTH_002' };
  }
  return { valid: true, payload: p, user: user, error: null };
}

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------

function login(email, password) {
  email    = (email    || '').toLowerCase().trim();
  password = (password || '').trim();

  if (!email || !password) {
    return { success: false, error: { code: 'VAL_001', message: 'Email e password obbligatorie' } };
  }

  var users = getAllRows('Users');
  var user  = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase().trim() === email) {
      user = users[i];
      break;
    }
  }

  if (!user || !verifyPassword(password, user.password_hash)) {
    logLoginFailed(email, 'Credenziali non valide');
    return { success: false, error: { code: 'AUTH_003', message: 'Credenziali non valide' } };
  }
  if (user.status !== 'active') {
    logLoginFailed(email, 'Utente non attivo');
    return { success: false, error: { code: 'AUTH_004', message: 'Utente non attivo' } };
  }

  // Aggiorna last_login
  updateRow('Users', user.user_id, { last_login: new Date() });
  logLogin(user.user_id, email, user.tenant_id);

  var token = generateToken_(user);
  return {
    success: true,
    data: {
      token: token,
      user: {
        user_id:   user.user_id,
        email:     user.email,
        role:      user.role,
        tenant_id: user.tenant_id
      }
    }
  };
}

// ---------------------------------------------------------------------------
// GET ME
// ---------------------------------------------------------------------------

function getCurrentUser(token) {
  var check = verifyToken(token);
  if (!check.valid) {
    var msg = check.error === 'AUTH_002' ? 'Token scaduto' : 'Token non valido';
    return { success: false, error: { code: check.error, message: msg } };
  }
  var user = getRowById('Users', check.payload.user_id);
  if (!user) return { success: false, error: { code: 'AUTH_003', message: 'Credenziali non valide' } };
  if (user.status !== 'active') return { success: false, error: { code: 'AUTH_004', message: 'Utente non attivo' } };

  var safe = {
    user_id:   user.user_id,
    tenant_id: user.tenant_id,
    email:     user.email,
    role:      user.role,
    status:    user.status,
    last_login: user.last_login,
    created_at: user.created_at
  };
  return { success: true, data: { user: safe } };
}

// ---------------------------------------------------------------------------
// LOGOUT (MVP: stateless — il token scade naturalmente in 8h)
// ---------------------------------------------------------------------------

function handleLogout(token, authPayload) {
  // Per invalidazione vera: il client deve eliminare il token dal proprio storage.
  // La pwd_version del token viene confrontata ad ogni verifyTokenFull —
  // changePassword invalida le sessioni precedenti.
  logLogout(authPayload.user_id, authPayload.email, authPayload.tenant_id);
  return { success: true, data: { message: 'Logout effettuato' } };
}

// ---------------------------------------------------------------------------
// CHANGE PASSWORD
// ---------------------------------------------------------------------------

function handleChangePassword(payload, authPayload) {
  var valid = requireFields(payload, ['old_password', 'new_password']);
  if (valid) return valid;

  if (String(payload.new_password).length < 8) {
    return { success: false, error: { code: 'VAL_002', message: 'La nuova password deve essere di almeno 8 caratteri', field: 'new_password' } };
  }

  var user = getRowById('Users', authPayload.user_id);
  if (!user) return { success: false, error: { code: 'AUTH_003', message: 'Utente non trovato' } };

  if (!verifyPassword(payload.old_password, user.password_hash)) {
    return { success: false, error: { code: 'AUTH_003', message: 'Password corrente non valida' } };
  }

  var newVersion = parseInt(user.pwd_version || 0) + 1;
  updateRow('Users', user.user_id, {
    password_hash: hashPassword(payload.new_password),
    pwd_version:   newVersion
  });

  logPasswordChanged(authPayload.user_id, authPayload.tenant_id);
  return { success: true, data: { message: 'Password aggiornata. Effettua nuovamente il login.' } };
}

// ---------------------------------------------------------------------------
// USER CRUD
// ---------------------------------------------------------------------------

function handleUserCreate(payload, authPayload) {
  var valid = requireFields(payload, ['email', 'role']);
  if (valid) return valid;

  if (!isValidEmail(payload.email)) {
    return { success: false, error: { code: 'VAL_002', message: 'Formato email non valido', field: 'email' } };
  }

  var allowedRoles = [ROLES.ADMIN, ROLES.USER, ROLES.CLIENTE];
  if (allowedRoles.indexOf(payload.role) === -1) {
    return { success: false, error: { code: 'VAL_002', message: 'Ruolo non valido. Consentiti: ' + allowedRoles.join(', '), field: 'role' } };
  }

  // ADMIN non può creare SUPER_ADMIN
  if (authPayload.role === ROLES.ADMIN && payload.role === ROLES.SUPER_ADMIN) {
    return { success: false, error: { code: 'AUTH_005', message: 'Permesso insufficiente per creare SUPER_ADMIN' } };
  }

  var emailLower = payload.email.toLowerCase().trim();
  var existing   = getAllRows('Users');
  for (var i = 0; i < existing.length; i++) {
    if (String(existing[i].email).toLowerCase().trim() === emailLower) {
      return { success: false, error: { code: 'VAL_004', message: 'Email già esistente' } };
    }
  }

  var tempPwd = payload.password || generateTempPassword();
  var now = new Date();
  var newUser = appendRow_('Users', {
    user_id:       Utilities.getUuid(),
    tenant_id:     authPayload.tenant_id,
    email:         emailLower,
    password_hash: hashPassword(tempPwd),
    role:          payload.role,
    status:        'active',
    pwd_version:   0,
    created_at:    now,
    last_login:    '',
    updated_at:    now,
    deleted:       false,
    deleted_at:    '',
    deleted_by:    ''
  });

  return {
    success: true,
    data: {
      user: {
        user_id:    newUser.user_id,
        email:      emailLower,
        role:       payload.role,
        tenant_id:  authPayload.tenant_id,
        temp_password: tempPwd  // da comunicare al nuovo utente
      }
    }
  };
}

function handleUserList(payload, authPayload) {
  var tenantId = authPayload.role === ROLES.SUPER_ADMIN && payload.tenant_id
    ? payload.tenant_id
    : authPayload.tenant_id;

  var users = getRowsByTenantId('Users', tenantId);

  // Filtro opzionale per ruolo
  if (payload.role) {
    users = users.filter(function(u) { return u.role === payload.role; });
  }
  // Filtro opzionale per status
  if (payload.status) {
    users = users.filter(function(u) { return u.status === payload.status; });
  }

  // Rimuovi password_hash da ogni utente
  users = users.map(function(u) {
    return {
      user_id:    u.user_id,
      tenant_id:  u.tenant_id,
      email:      u.email,
      role:       u.role,
      status:     u.status,
      last_login: u.last_login,
      created_at: u.created_at
    };
  });

  var page = payload.page || 1;
  var limit = payload.limit || SYSTEM_CONFIG.PAGINATION_DEFAULT;
  return { success: true, data: paginateResults(users, page, limit) };
}

function handleUserGet(payload, authPayload) {
  var valid = requireFields(payload, ['user_id']);
  if (valid) return valid;

  var perm = checkPermission(authPayload.role, 'user.get');
  if (perm.ownOnly && payload.user_id !== authPayload.user_id) {
    return { success: false, error: { code: 'AUTH_005', message: 'Puoi accedere solo al tuo profilo utente' } };
  }

  var user = getRowById('Users', payload.user_id);
  if (!user) return { success: false, error: { code: 'SYS_002', message: 'Utente non trovato' } };

  // Tenant isolation
  if (authPayload.role !== ROLES.SUPER_ADMIN && String(user.tenant_id) !== String(authPayload.tenant_id)) {
    return { success: false, error: { code: 'AUTH_006', message: 'Accesso cross-tenant negato' } };
  }

  return {
    success: true,
    data: {
      user: {
        user_id:    user.user_id,
        tenant_id:  user.tenant_id,
        email:      user.email,
        role:       user.role,
        status:     user.status,
        last_login: user.last_login,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    }
  };
}

function handleUserUpdate(payload, authPayload) {
  var valid = requireFields(payload, ['user_id']);
  if (valid) return valid;

  var perm = checkPermission(authPayload.role, 'user.update');
  if (perm.ownOnly && payload.user_id !== authPayload.user_id) {
    return { success: false, error: { code: 'AUTH_005', message: 'Puoi modificare solo il tuo profilo' } };
  }

  var user = getRowById('Users', payload.user_id);
  if (!user) return { success: false, error: { code: 'SYS_002', message: 'Utente non trovato' } };

  if (authPayload.role !== ROLES.SUPER_ADMIN && String(user.tenant_id) !== String(authPayload.tenant_id)) {
    return { success: false, error: { code: 'AUTH_006', message: 'Accesso cross-tenant negato' } };
  }

  var updates = {};
  // Campi aggiornabili (non password — usare changePassword)
  if (payload.email) {
    if (!isValidEmail(payload.email)) {
      return { success: false, error: { code: 'VAL_002', message: 'Formato email non valido', field: 'email' } };
    }
    updates.email = payload.email.toLowerCase().trim();
  }
  // Solo ADMIN/SUPER_ADMIN possono cambiare ruolo
  if (payload.role && (authPayload.role === ROLES.ADMIN || authPayload.role === ROLES.SUPER_ADMIN)) {
    updates.role = payload.role;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: { code: 'VAL_001', message: 'Nessun campo da aggiornare' } };
  }

  var updated = updateRow('Users', payload.user_id, updates);
  return { success: true, data: { user_id: payload.user_id, updated: updates } };
}

function handleUserDeactivate(payload, authPayload) {
  var valid = requireFields(payload, ['user_id']);
  if (valid) return valid;

  // Non puoi disattivare te stesso
  if (payload.user_id === authPayload.user_id) {
    return { success: false, error: { code: 'AUTH_005', message: 'Non puoi disattivare il tuo stesso account' } };
  }

  var user = getRowById('Users', payload.user_id);
  if (!user) return { success: false, error: { code: 'SYS_002', message: 'Utente non trovato' } };

  if (authPayload.role !== ROLES.SUPER_ADMIN && String(user.tenant_id) !== String(authPayload.tenant_id)) {
    return { success: false, error: { code: 'AUTH_006', message: 'Accesso cross-tenant negato' } };
  }

  // Incrementa pwd_version per invalidare tutti i token attivi
  var newVersion = parseInt(user.pwd_version || 0) + 1;
  updateRow('Users', payload.user_id, { status: 'inactive', pwd_version: newVersion });

  logUserDeactivated(payload.user_id, authPayload.user_id, authPayload.tenant_id);
  return { success: true, data: { message: 'Utente disattivato', user_id: payload.user_id } };
}

// ---------------------------------------------------------------------------
// PASSWORD RESET — Request / Validate / Confirm
// ---------------------------------------------------------------------------

function handleRequestPasswordReset(payload) {
  var email = ((payload && payload.email) || '').toLowerCase().trim();
  if (!email || !isValidEmail(email)) {
    return errorResponse('VAL_002', 'Email non valida', 'email');
  }

  // Rate limit: max 3 richieste in 24h (stesso risultato se email non esiste)
  if (countRecentResets(email) >= 3) {
    return errorResponse('AUTH_005', 'Troppi tentativi di recupero. Riprova domani.');
  }

  // Cerca utente (ma non rivela se esiste: risponde sempre success)
  var users = getAllRows('Users');
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase().trim() === email) {
      user = users[i];
      break;
    }
  }

  if (user && user.status === 'active') {
    var token = createPasswordResetToken(email, (payload && payload.ip) || '');
    sendPasswordResetEmail_(email, token);
  }

  return successResponse({ message: 'Se l\'email è registrata, riceverai le istruzioni a breve.' });
}

function handleValidateResetToken(payload) {
  var valid = requireFields(payload, ['token']);
  if (valid) return valid;

  var row = getResetToken(payload.token);
  if (!row) return successResponse({ valid: false });
  return successResponse({ valid: true, email: row.email });
}

function handleConfirmPasswordReset(payload) {
  var valid = requireFields(payload, ['token', 'new_password']);
  if (valid) return valid;

  var row = getResetToken(payload.token);
  if (!row) return errorResponse('AUTH_001', 'Link non valido o scaduto');

  var pwd = String(payload.new_password);
  if (pwd.length < 8) {
    return errorResponse('VAL_002', 'La password deve essere di almeno 8 caratteri', 'new_password');
  }
  if (!/[A-Z]/.test(pwd)) {
    return errorResponse('VAL_002', 'La password deve contenere almeno una lettera maiuscola', 'new_password');
  }
  if (!/[0-9]/.test(pwd)) {
    return errorResponse('VAL_002', 'La password deve contenere almeno un numero', 'new_password');
  }

  var users = getAllRows('Users');
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase().trim() === String(row.email).toLowerCase().trim()) {
      user = users[i];
      break;
    }
  }

  if (!user || user.status !== 'active') {
    return errorResponse('AUTH_004', 'Account non trovato o non attivo');
  }

  var newVersion = parseInt(user.pwd_version || 0) + 1;
  updateRow('Users', user.user_id, {
    password_hash: hashPassword(pwd),
    pwd_version:   newVersion
  });

  markTokenAsUsed(payload.token);

  return successResponse({ message: 'Password aggiornata. Effettua il login con la nuova password.' });
}

function sendPasswordResetEmail_(email, token) {
  var resetUrl = getFrontendUrl() + '/reset-password/confirm?token=' + token;
  var html =
    '<div style="font-family:Montserrat,Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;">' +
    '<div style="background:#7A1E2C;padding:28px 40px;">' +
    '<h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;letter-spacing:2px;">MADE EVENTS</h1>' +
    '</div>' +
    '<div style="padding:40px;">' +
    '<h2 style="color:#1A1A24;font-size:18px;margin:0 0 16px;font-weight:700;">Recupera la tua password</h2>' +
    '<p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 28px;">Hai richiesto il recupero della password per il tuo account.<br>' +
    'Clicca il pulsante qui sotto per impostarne una nuova. Il link è valido per <strong>1 ora</strong>.</p>' +
    '<a href="' + resetUrl + '" style="display:inline-block;background:#7A1E2C;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px;">Reimposta password</a>' +
    '<p style="color:#999;font-size:12px;margin:32px 0 0;line-height:1.6;">Non hai richiesto il recupero password? Ignora questa email — il tuo account è al sicuro.</p>' +
    '<p style="color:#ccc;font-size:11px;margin:6px 0 0;word-break:break-all;">Link: ' + resetUrl + '</p>' +
    '</div>' +
    '<div style="background:#F8F8F8;padding:16px 40px;border-top:1px solid #eee;">' +
    '<p style="color:#aaa;font-size:11px;margin:0;">MADE EVENTS Platform · noreply@madeevent.it</p>' +
    '</div>' +
    '</div>';
  var text =
    'Recupera la tua password MADE EVENTS\n\n' +
    'Clicca il link per impostare una nuova password (valido 1 ora):\n\n' +
    resetUrl + '\n\n' +
    'Se non hai richiesto il recupero password, ignora questa email.';
  sendEmail_(email, 'Recupera la tua password - MADE EVENTS', html, text);
}
