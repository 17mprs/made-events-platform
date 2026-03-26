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
