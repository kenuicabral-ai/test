function mtGetSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function mtGetOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function mtEnsureSheets(ss) {
  var allSheets = MT_VISIBLE_SHEETS.concat(MT_HIDDEN_SHEETS);
  allSheets.forEach(function(name) {
    mtGetOrCreateSheet(ss, name);
  });

  MT_VISIBLE_SHEETS.forEach(function(name) {
    mtGetOrCreateSheet(ss, name).showSheet();
  });

  MT_HIDDEN_SHEETS.forEach(function(name) {
    var sheet = mtGetOrCreateSheet(ss, name);
    try {
      sheet.hideSheet();
    } catch (err) {
      mtLog('WARN', 'Utils.mtEnsureSheets', 'Não foi possível ocultar ' + name + ': ' + err.message);
    }
  });
}

function mtHeaderIndex(headers) {
  var index = {};
  headers.forEach(function(header, i) {
    index[header] = i;
  });
  return index;
}

function mtBaseHeaderIndex() {
  return mtHeaderIndex(MT_BASE_HEADERS);
}

function mtNow() {
  return new Date();
}

function mtTimeZone() {
  return Session.getScriptTimeZone() || 'America/Sao_Paulo';
}

function mtDateStamp(date) {
  return Utilities.formatDate(date || mtNow(), mtTimeZone(), 'dd/MM/yyyy');
}

function mtTimeStamp(date) {
  return Utilities.formatDate(date || mtNow(), mtTimeZone(), 'HH:mm');
}

function mtDateTimeStamp(date) {
  return Utilities.formatDate(date || mtNow(), mtTimeZone(), 'dd/MM/yyyy HH:mm');
}

function mtUserEmail() {
  try {
    return Session.getActiveUser().getEmail() || 'Usuário não identificado';
  } catch (err) {
    return 'Usuário não identificado';
  }
}

function mtNormalizeText(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function mtNormalizeLower(value) {
  return mtNormalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mtToBoolean(value) {
  if (value === true) return true;
  var normalized = mtNormalizeLower(value);
  return normalized === 'true' || normalized === 'sim' || normalized === 'x' || normalized === 'ok';
}

function mtDisplayBoolean(value) {
  return mtToBoolean(value) ? 'Sim' : 'Não';
}

function mtParseNumber(value, fallback) {
  var parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
}

function mtAsDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }
  if (!value) return null;
  var date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function mtDaysBetween(start, end) {
  var startDate = mtAsDate(start);
  var endDate = mtAsDate(end);
  if (!startDate || !endDate) return null;
  var startOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  var endOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.floor((endOnly.getTime() - startOnly.getTime()) / 86400000);
}

function mtFormatBaptismDate(value) {
  var date = mtAsDate(value);
  if (!date) return mtNormalizeText(value) || 'Sem data';
  return Utilities.formatDate(date, mtTimeZone(), 'dd MMMM');
}

function mtFormatLastUpdate(record) {
  if (!record || !record['Última Atualização Em']) return 'Sem atualização';
  var date = mtAsDate(record['Última Atualização Em']);
  if (!date) return mtNormalizeText(record['Última Atualização Em']);
  var today = mtDateStamp(mtNow());
  var updateDay = mtDateStamp(date);
  var prefix = today === updateDay ? 'Hoje' : updateDay;
  return prefix + ' ' + mtTimeStamp(date);
}

function mtSetCheckbox(sheet, row, column, checked) {
  var range = sheet.getRange(row, column);
  var validation = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  range.setDataValidation(validation).setValue(checked === true);
  return range;
}

function mtSetDropdown(sheet, rangeA1, options, value) {
  var validation = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(rangeA1).setDataValidation(validation).setValue(value || options[0]);
}

function mtClearValidations(sheet, a1Notation) {
  sheet.getRange(a1Notation).clearDataValidations();
}

function mtRangeMatches(range, point) {
  return range.getRow() === point.row && range.getColumn() === point.column;
}

function mtSameCell_(range, row, column) {
  return range.getRow() === row && range.getColumn() === column;
}

function mtIsInRange_(range, startRow, endRow, startColumn, endColumn) {
  var row = range.getRow();
  var column = range.getColumn();
  return row >= startRow && row <= endRow && column >= startColumn && column <= endColumn;
}

function mtSafeSetValues(range, values) {
  if (!values || values.length === 0) return;
  range.setValues(values);
}

function mtProtectSheet(sheet, description, warningOnly) {
  try {
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    var existing = protections.filter(function(protection) {
      return protection.getDescription() === description;
    })[0];
    var protection = existing || sheet.protect();
    protection.setDescription(description);
    protection.setWarningOnly(warningOnly === true);
    return protection;
  } catch (err) {
    mtLog('WARN', 'Utils.mtProtectSheet', 'Proteção ignorada em ' + sheet.getName() + ': ' + err.message);
    return null;
  }
}

function mtUncheck(range) {
  try {
    range.setValue(false);
  } catch (err) {
    mtLog('WARN', 'Utils.mtUncheck', err.message);
  }
}

function mtUnique(values) {
  var seen = {};
  return values.filter(function(value) {
    var key = mtNormalizeText(value);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function mtSortRecordsByPriority(records) {
  var priority = {};
  priority[MT_STATUS.NO_UPDATE] = 1;
  priority[MT_STATUS.CRITICAL] = 2;
  priority[MT_STATUS.PENDING] = 3;
  priority[MT_STATUS.OK] = 4;
  priority[MT_STATUS.BAPTIZED] = 5;
  priority[MT_STATUS.DATE_DROPPED] = 6;

  return records.slice().sort(function(a, b) {
    var statusA = priority[a.Status] || 99;
    var statusB = priority[b.Status] || 99;
    if (statusA !== statusB) return statusA - statusB;
    var dateA = mtAsDate(a['Data Batismal']);
    var dateB = mtAsDate(b['Data Batismal']);
    if (dateA && dateB) return dateA.getTime() - dateB.getTime();
    return mtNormalizeText(a.Nome).localeCompare(mtNormalizeText(b.Nome));
  });
}
