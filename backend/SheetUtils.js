// === SHEETUTILS.JS — MACELLERIA 6.0 ===
// CRUD generico su Google Sheets: ogni foglio = tabella, prima riga = header

function generateId() {
  return Utilities.getUuid();
}

function getAllRows(sheetName) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var deletedIdx = headers.indexOf('deleted');
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    if (deletedIdx !== -1 && String(data[i][deletedIdx]).toLowerCase() === 'true') {
      continue;
    }
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      if (headers[j]) obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

function getRowById(sheetName, id) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idCol = headers.indexOf('id');
  if (idCol === -1) {
    for (var k = 0; k < headers.length; k++) {
      if (headers[k].endsWith('_id') || headers[k] === 'id') {
        idCol = k;
        break;
      }
    }
  }
  if (idCol === -1) idCol = 0;

  var deletedIdx = headers.indexOf('deleted');

  for (var i = 1; i < data.length; i++) {
    if (deletedIdx !== -1 && String(data[i][deletedIdx]).toLowerCase() === 'true') {
      continue;
    }
    if (String(data[i][idCol]) === String(id)) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        if (headers[j]) obj[headers[j]] = data[i][j];
      }
      return obj;
    }
  }
  return null;
}

function getRowsByTenantId(sheetName, tenantId) {
  return queryRows(sheetName, { tenant_id: tenantId });
}

function appendRow_(sheetName, obj) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h).trim(); });

  var idField = 'id';
  for (var k = 0; k < headers.length; k++) {
    if (headers[k] === 'id' || headers[k].endsWith('_id')) {
      idField = headers[k];
      break;
    }
  }

  if (!obj[idField]) {
    obj[idField] = generateId();
  }

  var now = new Date();
  if (headers.indexOf('created_at') !== -1 && !obj.created_at) {
    obj.created_at = now;
  }
  if (headers.indexOf('updated_at') !== -1) {
    obj.updated_at = now;
  }

  var row = headers.map(function(h) {
    return obj[h] !== undefined ? obj[h] : '';
  });

  sheet.appendRow(row);
  return obj;
}

function updateRow(sheetName, id, updates) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idCol = headers.indexOf('id');
  if (idCol === -1) {
    for (var k = 0; k < headers.length; k++) {
      if (headers[k].endsWith('_id') || headers[k] === 'id') {
        idCol = k;
        break;
      }
    }
  }
  if (idCol === -1) idCol = 0;

  var deletedIdx = headers.indexOf('deleted');

  for (var i = 1; i < data.length; i++) {
    if (deletedIdx !== -1 && String(data[i][deletedIdx]).toLowerCase() === 'true') {
      continue;
    }
    if (String(data[i][idCol]) === String(id)) {
      if (headers.indexOf('updated_at') !== -1) {
        updates.updated_at = new Date();
      }
      for (var field in updates) {
        var colIdx = headers.indexOf(field);
        if (colIdx !== -1) {
          sheet.getRange(i + 1, colIdx + 1).setValue(updates[field]);
          data[i][colIdx] = updates[field];
        }
      }
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        if (headers[j]) obj[headers[j]] = data[i][j];
      }
      return obj;
    }
  }
  return null;
}

function softDelete(sheetName, id, userId) {
  var result = updateRow(sheetName, id, {
    deleted: true,
    deleted_at: new Date(),
    deleted_by: userId
  });
  return result !== null;
}

function queryRows(sheetName, filters) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var deletedIdx = headers.indexOf('deleted');
  var results = [];

  for (var i = 1; i < data.length; i++) {
    if (deletedIdx !== -1 && String(data[i][deletedIdx]).toLowerCase() === 'true') {
      continue;
    }
    var match = true;
    for (var field in filters) {
      var colIdx = headers.indexOf(field);
      if (colIdx === -1) { match = false; break; }
      if (String(data[i][colIdx]) !== String(filters[field])) {
        match = false;
        break;
      }
    }
    if (match) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        if (headers[j]) obj[headers[j]] = data[i][j];
      }
      results.push(obj);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// PASSWORD RESET TOKEN HELPERS
// Sheet: PasswordResetTokens (token è col 0, usato come PK da updateRow)
// Schema: token | email | created_at | expires_at | used | used_at | ip_address
// ---------------------------------------------------------------------------

function createPasswordResetToken(email, ipAddress) {
  var token = Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
  var now = new Date();
  var expiresAt = new Date(now.getTime() + 3600000); // 1h
  appendRow_('PasswordResetTokens', {
    token:      token,
    email:      (email || '').toLowerCase().trim(),
    created_at: now,
    expires_at: expiresAt,
    used:       false,
    used_at:    '',
    ip_address: ipAddress || ''
  });
  return token;
}

function getResetToken(token) {
  if (!token) return null;
  var rows = queryRows('PasswordResetTokens', { token: String(token) });
  if (!rows || rows.length === 0) return null;
  var row = rows[0];
  if (String(row.used) === 'true' || row.used === true) return null;
  var expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
  if (isNaN(expiresAt.getTime()) || Date.now() > expiresAt.getTime()) return null;
  return row;
}

function markTokenAsUsed(token) {
  return updateRow('PasswordResetTokens', token, {
    used:    true,
    used_at: new Date()
  });
}

function countRecentResets(email) {
  var emailLower = (email || '').toLowerCase().trim();
  var rows = queryRows('PasswordResetTokens', { email: emailLower });
  if (!rows || rows.length === 0) return 0;
  var cutoff = Date.now() - 86400000; // ultime 24h
  var count = 0;
  for (var i = 0; i < rows.length; i++) {
    var createdAt = rows[i].created_at instanceof Date ? rows[i].created_at : new Date(rows[i].created_at);
    if (!isNaN(createdAt.getTime()) && createdAt.getTime() > cutoff) count++;
  }
  return count;
}
