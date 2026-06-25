var MT = MT || {};

MT.ensureHeaders = function (sheet, headers) {
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  var currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  var hasAnyHeader = currentHeaders.some(function (header) {
    return !MT.isBlank(header);
  });

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return headers.slice();
  }

  var existing = {};
  currentHeaders.forEach(function (header) {
    if (!MT.isBlank(header)) {
      existing[String(header)] = true;
    }
  });

  var nextColumn = currentHeaders.length + 1;
  headers.forEach(function (header) {
    if (!existing[header]) {
      sheet.getRange(1, nextColumn).setValue(header);
      currentHeaders.push(header);
      nextColumn++;
    }
  });

  sheet.setFrozenRows(1);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
};

MT.ensureBaseSheet = function () {
  var sheet = MT.ensureSheet(MT.SHEETS.BASE, 200, MT.BASE_HEADERS.length);
  MT.ensureHeaders(sheet, MT.BASE_HEADERS);
  MT.applyAppChrome(sheet);

  sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .setBackground(MT.COLORS.DARK_BLUE)
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  MT.applyBooleanValidations(sheet);
  MT.applyResultValidation(sheet);
  sheet.hideSheet();
  return sheet;
};

MT.applyBooleanValidations = function (sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerMap = MT.getHeaderMap(headers);
  MT.BOOLEAN_FIELDS.forEach(function (field) {
    if (headerMap[field] !== undefined && sheet.getMaxRows() > 1) {
      sheet.getRange(2, headerMap[field] + 1, sheet.getMaxRows() - 1, 1).insertCheckboxes();
    }
  });
};

MT.applyResultValidation = function (sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerMap = MT.getHeaderMap(headers);
  if (headerMap.Resultado === undefined || sheet.getMaxRows() < 2) {
    return;
  }

  MT.applyDataValidationList(sheet.getRange(2, headerMap.Resultado + 1, sheet.getMaxRows() - 1, 1), MT.RESULT_OPTIONS, false);
};

MT.ensureHistorySheet = function () {
  var sheet = MT.ensureSheet(MT.SHEETS.HISTORY, 200, MT.HISTORY_HEADERS.length);
  MT.ensureHeaders(sheet, MT.HISTORY_HEADERS);
  MT.applyAppChrome(sheet);
  sheet.hideSheet();
  MT.protectReadOnlySheet(sheet, 'Histórico automático do Mission Tracker');
  return sheet;
};

MT.ensureEmailSheet = function () {
  var sheet = MT.ensureSheet(MT.SHEETS.EMAILS, 100, MT.EMAIL_HEADERS.length);
  MT.ensureHeaders(sheet, MT.EMAIL_HEADERS);
  MT.applyAppChrome(sheet);
  sheet.hideSheet();
  return sheet;
};

MT.ensureLogSheet = function () {
  var sheet = MT.ensureSheet(MT.SHEETS.LOGS, 100, MT.LOG_HEADERS.length);
  MT.ensureHeaders(sheet, MT.LOG_HEADERS);
  MT.applyAppChrome(sheet);
  sheet.hideSheet();
  MT.protectReadOnlySheet(sheet, 'Logs automáticos do Mission Tracker');
  return sheet;
};

MT.ensureSystemSheet = function () {
  var sheet = MT.ensureSheet(MT.SHEETS.SYSTEM, 50, MT.SYSTEM_HEADERS.length);
  MT.ensureHeaders(sheet, MT.SYSTEM_HEADERS);
  MT.applyAppChrome(sheet);
  sheet.hideSheet();
  return sheet;
};

MT.ensureCacheSheet = function () {
  var sheet = MT.ensureSheet(MT.SHEETS.CACHE, 50, 10);
  MT.applyAppChrome(sheet);
  sheet.hideSheet();
  return sheet;
};

MT.protectReadOnlySheet = function (sheet, description) {
  try {
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (protections.length) {
      protections[0].setDescription(description);
      return;
    }

    var protection = sheet.protect().setDescription(description);
    protection.setWarningOnly(false);
  } catch (error) {
    MT.log('WARN', 'protectReadOnlySheet', 'Proteção não aplicada', error.message);
  }
};

MT.getBaseTable = function () {
  var sheet = MT.ensureBaseSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      sheet: sheet,
      headers: headers,
      headerMap: MT.getHeaderMap(headers),
      rows: []
    };
  }

  return {
    sheet: sheet,
    headers: headers,
    headerMap: MT.getHeaderMap(headers),
    rows: sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
  };
};

MT.getBaseRecords = function () {
  if (MT._recordCache) {
    return MT._recordCache;
  }

  MT.normalizeBaseRows();

  var table = MT.getBaseTable();
  var records = [];

  table.rows.forEach(function (row, index) {
    var name = row[table.headerMap.Nome];
    if (MT.isBlank(name)) {
      return;
    }

    records.push({
      rowNumber: index + 2,
      values: row,
      data: MT.rowToObject(row, table.headerMap),
      headerMap: table.headerMap
    });
  });

  MT._recordCache = records;
  return records;
};

MT.invalidateRecordCache = function () {
  MT._recordCache = null;
};

MT.rowToObject = function (row, headerMap) {
  var object = {};
  Object.keys(headerMap).forEach(function (field) {
    object[field] = row[headerMap[field]];
  });
  return object;
};

MT.normalizeBaseRows = function () {
  var table = MT.getBaseTable();
  if (!table.rows.length) {
    return;
  }

  var changed = false;
  var now = new Date();

  table.rows.forEach(function (row) {
    if (MT.isBlank(row[table.headerMap.Nome])) {
      return;
    }

    if (MT.isBlank(row[table.headerMap.ID])) {
      row[table.headerMap.ID] = MT.makeId();
      changed = true;
    }

    if (MT.isBlank(row[table.headerMap['Criado Em']])) {
      row[table.headerMap['Criado Em']] = now;
      changed = true;
    }

    var computed = MT.calculateRecordStatus(row, table.headerMap);
    if (!MT.sameValue(row[table.headerMap.Status], computed.status)) {
      row[table.headerMap.Status] = computed.status;
      changed = true;
    }

    if (!MT.sameValue(row[table.headerMap.Prioridade], computed.priority)) {
      row[table.headerMap.Prioridade] = computed.priority;
      changed = true;
    }
  });

  if (changed) {
    table.sheet.getRange(2, 1, table.rows.length, table.headers.length).setValues(table.rows);
    MT.invalidateRecordCache();
  }
};

MT.getTrackableRecords = function () {
  var config = MT.getConfig();
  return MT.getBaseRecords().filter(function (record) {
    if (MT.isBlank(config.district)) {
      return true;
    }

    return String(record.data.Distrito || '').trim() === String(config.district).trim();
  });
};

MT.getCurrentRecord = function () {
  var records = MT.getTrackableRecords();
  if (!records.length) {
    return null;
  }

  var index = MT.safeNumber(MT.getSystemValue(MT.SYSTEM_KEYS.CURRENT_INDEX, 1), 1);
  index = Math.max(1, Math.min(index, records.length));
  MT.setSystemValue(MT.SYSTEM_KEYS.CURRENT_INDEX, index);

  return {
    index: index,
    count: records.length,
    record: records[index - 1]
  };
};

MT.moveCurrentRecord = function (direction) {
  var records = MT.getTrackableRecords();
  if (!records.length) {
    MT.setSystemValue(MT.SYSTEM_KEYS.CURRENT_INDEX, 1);
    return null;
  }

  var index = MT.safeNumber(MT.getSystemValue(MT.SYSTEM_KEYS.CURRENT_INDEX, 1), 1);
  index += direction;

  if (index < 1) {
    index = records.length;
  }

  if (index > records.length) {
    index = 1;
  }

  MT.setSystemValue(MT.SYSTEM_KEYS.CURRENT_INDEX, index);
  return records[index - 1];
};

MT.updateRecordFields = function (recordId, changes, user) {
  var table = MT.getBaseTable();
  var targetIndex = -1;

  for (var i = 0; i < table.rows.length; i++) {
    if (String(table.rows[i][table.headerMap.ID]) === String(recordId)) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    throw new Error('Pesquisador não encontrado na Base.');
  }

  var row = table.rows[targetIndex];
  var history = [];
  var now = new Date();

  Object.keys(changes).forEach(function (field) {
    if (table.headerMap[field] === undefined) {
      throw new Error('Campo não existe na Base: ' + field);
    }

    var oldValue = row[table.headerMap[field]];
    var newValue = changes[field];

    if (MT.BOOLEAN_FIELDS.indexOf(field) !== -1) {
      newValue = MT.normalizeBoolean(newValue);
    }

    if (field === 'Resultado' && MT.RESULT_OPTIONS.indexOf(newValue) === -1) {
      newValue = '';
    }

    if (!MT.sameValue(oldValue, newValue)) {
      row[table.headerMap[field]] = newValue;
      history.push({
        id: row[table.headerMap.ID],
        name: row[table.headerMap.Nome],
        field: field,
        oldValue: oldValue,
        newValue: newValue,
        user: user
      });
    }
  });

  if (!history.length) {
    return MT.rowToObject(row, table.headerMap);
  }

  var computed = MT.calculateRecordStatus(row, table.headerMap);
  row[table.headerMap.Status] = computed.status;
  row[table.headerMap.Prioridade] = computed.priority;
  row[table.headerMap['Última Atualização']] = now;
  row[table.headerMap['Data Última Atualização']] = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  row[table.headerMap['Hora Última Atualização']] = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm');
  row[table.headerMap['Usuário']] = user;
  row[table.headerMap['Atualizado Em']] = now;

  table.sheet.getRange(targetIndex + 2, 1, 1, table.headers.length).setValues([row]);
  MT.appendHistoryRows(history);
  MT.invalidateRecordCache();

  return MT.rowToObject(row, table.headerMap);
};

MT.calculateRecordStatus = function (row, headerMap) {
  var result = String(row[headerMap.Resultado] || '').trim();
  var baptismDate = row[headerMap['Data Batismal']];

  if (result === 'Batizado') {
    return {
      status: MT.STATUS.BAPTIZED,
      priority: MT.STATUS_ORDER[MT.STATUS.BAPTIZED]
    };
  }

  if (result === 'Data caiu' || MT.hasFallenDate(baptismDate)) {
    return {
      status: MT.STATUS.FALLEN_DATE,
      priority: MT.STATUS_ORDER[MT.STATUS.FALLEN_DATE]
    };
  }

  if (MT.isRecordStale(row[headerMap['Última Atualização']])) {
    return {
      status: MT.STATUS.STALE,
      priority: MT.STATUS_ORDER[MT.STATUS.STALE]
    };
  }

  var week = MT.safeNumber(row[headerMap.Semana], 1);
  var touchdown = MT.normalizeBoolean(row[headerMap.TouchDown]);
  var churchPlan = MT.normalizeBoolean(row[headerMap['Plano Igreja']]);
  var match = MT.normalizeBoolean(row[headerMap.Match]);
  var interview = MT.normalizeBoolean(row[headerMap.Entrevista]);

  if ((week >= 3 && !interview) || (week >= 2 && !match)) {
    return {
      status: MT.STATUS.CRITICAL,
      priority: MT.STATUS_ORDER[MT.STATUS.CRITICAL]
    };
  }

  if (week >= 1 && (!touchdown || !churchPlan)) {
    return {
      status: MT.STATUS.PENDING,
      priority: MT.STATUS_ORDER[MT.STATUS.PENDING]
    };
  }

  return {
    status: MT.STATUS.OK,
    priority: MT.STATUS_ORDER[MT.STATUS.OK]
  };
};

MT.hasFallenDate = function (value) {
  if (!value) {
    return false;
  }

  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    return false;
  }

  return MT.startOfDay(date).getTime() < MT.startOfDay(new Date()).getTime();
};

MT.isRecordStale = function (lastUpdate) {
  if (!lastUpdate) {
    return true;
  }

  var date = lastUpdate instanceof Date ? lastUpdate : new Date(lastUpdate);
  if (isNaN(date.getTime())) {
    return true;
  }

  var config = MT.getConfig();
  var staleHours = MT.safeNumber(config.staleHours, 24);
  return new Date().getTime() - date.getTime() > staleHours * 60 * 60 * 1000;
};

MT.sortRecordsByPriority = function (records) {
  return records.slice().sort(function (left, right) {
    var leftPriority = MT.safeNumber(left.data.Prioridade, MT.STATUS_ORDER[left.data.Status] || 99);
    var rightPriority = MT.safeNumber(right.data.Prioridade, MT.STATUS_ORDER[right.data.Status] || 99);

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return String(left.data['Data Batismal'] || '').localeCompare(String(right.data['Data Batismal'] || ''));
  });
};
