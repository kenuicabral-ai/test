var MT = MT || {};

MT.getSpreadsheet = function () {
  return SpreadsheetApp.getActiveSpreadsheet();
};

MT.getSheet = function (name) {
  return MT.getSpreadsheet().getSheetByName(name);
};

MT.ensureSheet = function (name, rows, columns) {
  var ss = MT.getSpreadsheet();
  var sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  var targetRows = rows || MT.DEFAULT_ROW_COUNT;
  var targetColumns = columns || MT.DEFAULT_COLUMN_COUNT;

  if (sheet.getMaxRows() < targetRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), targetRows - sheet.getMaxRows());
  }

  if (sheet.getMaxColumns() < targetColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), targetColumns - sheet.getMaxColumns());
  }

  return sheet;
};

MT.withDocumentLock = function (callback) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Não foi possível obter o bloqueio do documento.');
  }

  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
};

MT.getHeaderMap = function (headers) {
  var map = {};
  headers.forEach(function (header, index) {
    map[header] = index;
  });
  return map;
};

MT.firstNonEmpty = function (values) {
  for (var i = 0; i < values.length; i++) {
    if (!MT.isBlank(values[i])) {
      return values[i];
    }
  }
  return '';
};

MT.isBlank = function (value) {
  return value === null || value === undefined || String(value).trim() === '';
};

MT.normalizeBoolean = function (value) {
  if (value === true) {
    return true;
  }

  var text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === 'sim' || text === 'yes' || text === '1';
};

MT.sameValue = function (left, right) {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }

  return String(left || '') === String(right || '');
};

MT.toDisplayValue = function (value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  }

  if (value === true) {
    return 'Sim';
  }

  if (value === false) {
    return 'Não';
  }

  return value === null || value === undefined ? '' : String(value);
};

MT.toDisplayDate = function (value) {
  if (!value) {
    return '';
  }

  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    return String(value);
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd MMMM');
};

MT.toDisplayDateTime = function (value) {
  if (!value) {
    return 'Ainda sem atualização';
  }

  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    return String(value);
  }

  var today = MT.startOfDay(new Date());
  var target = MT.startOfDay(date);
  var prefix = today.getTime() === target.getTime() ? 'Hoje' : Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM');
  return prefix + ' ' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm');
};

MT.startOfDay = function (date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

MT.currentUser = function (event) {
  if (event && event.user && event.user.getEmail) {
    return event.user.getEmail();
  }

  var user = Session.getActiveUser();
  var email = user && user.getEmail ? user.getEmail() : '';
  return email || 'usuário não identificado';
};

MT.safeNumber = function (value, fallback) {
  var number = Number(value);
  return isNaN(number) ? fallback : number;
};

MT.makeId = function () {
  return Utilities.getUuid();
};

MT.clearSheet = function (sheet, rows, columns) {
  var rowCount = rows || Math.max(sheet.getMaxRows(), MT.DEFAULT_ROW_COUNT);
  var columnCount = columns || Math.max(sheet.getMaxColumns(), MT.DEFAULT_COLUMN_COUNT);
  sheet.getRange(1, 1, rowCount, columnCount).breakApart().clear();
  sheet.setHiddenGridlines(true);
};

MT.writeBlock = function (sheet, startRow, startColumn, values) {
  if (!values.length || !values[0].length) {
    return;
  }

  sheet.getRange(startRow, startColumn, values.length, values[0].length).setValues(values);
};

MT.setSystemValue = function (key, value) {
  var sheet = MT.ensureSystemSheet();
  var rows = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 2).getValues();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }

  sheet.appendRow([key, value]);
};

MT.getSystemValue = function (key, fallback) {
  var sheet = MT.ensureSystemSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return fallback;
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) {
      return MT.isBlank(rows[i][1]) ? fallback : rows[i][1];
    }
  }

  return fallback;
};

MT.applyDataValidationList = function (range, values, allowInvalid) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(Boolean(allowInvalid))
    .build();

  range.setDataValidation(rule);
};

MT.resetCheckbox = function (sheet, cell) {
  sheet.getRange(cell).setValue(false);
};
