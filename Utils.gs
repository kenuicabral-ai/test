var MT = MT || {};

MT.Utils = (function () {
  function ss() {
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  function sheet(name) {
    return ss().getSheetByName(name);
  }

  function ensureSheet(name) {
    var spreadsheet = ss();
    return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  }

  function resetSheet(name) {
    var target = ensureSheet(name);
    target.clear();
    target.clearConditionalFormatRules();
    target.showRows(1, target.getMaxRows());
    target.showColumns(1, target.getMaxColumns());
    return target;
  }

  function ensureRows(sheetObject, rows) {
    var missing = rows - sheetObject.getMaxRows();
    if (missing > 0) {
      sheetObject.insertRowsAfter(sheetObject.getMaxRows(), missing);
    }
  }

  function ensureColumns(sheetObject, columns) {
    var missing = columns - sheetObject.getMaxColumns();
    if (missing > 0) {
      sheetObject.insertColumnsAfter(sheetObject.getMaxColumns(), missing);
    }
  }

  function hideSheet(name) {
    var target = ensureSheet(name);
    target.hideSheet();
    return target;
  }

  function showSheet(name) {
    var target = ensureSheet(name);
    target.showSheet();
    return target;
  }

  function setHeaders(sheetObject, headers) {
    ensureColumns(sheetObject, headers.length);
    sheetObject.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheetObject.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground(MT.COLORS.GRAY_LIGHT)
      .setFontColor(MT.COLORS.DARK);
  }

  function getHeaders(sheetObject) {
    var lastColumn = Math.max(sheetObject.getLastColumn(), 1);
    return sheetObject.getRange(1, 1, 1, lastColumn).getValues()[0];
  }

  function headerMap(headers) {
    var map = {};
    headers.forEach(function (header, index) {
      map[header] = index;
    });
    return map;
  }

  function rowToRecord(headers, row, rowNumber) {
    var record = {};
    headers.forEach(function (header, index) {
      record[header] = row[index];
    });
    record._rowNumber = rowNumber;
    return record;
  }

  function recordToRow(headers, record) {
    return headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
    });
  }

  function isBlank(value) {
    return value === null || value === undefined || String(value).trim() === '';
  }

  function isRowBlank(row) {
    return row.every(isBlank);
  }

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function toBoolean(value) {
    if (value === true) return true;
    if (value === false) return false;
    var text = normalize(value);
    return text === 'sim' || text === 'true' || text === '1' || text === 'x' || text === 'feito';
  }

  function toDate(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return value;
    }
    if (isBlank(value)) return null;
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function startOfDay(date) {
    var target = toDate(date) || new Date();
    return new Date(target.getFullYear(), target.getMonth(), target.getDate());
  }

  function daysBetween(dateA, dateB) {
    var oneDay = 24 * 60 * 60 * 1000;
    return Math.floor((startOfDay(dateA).getTime() - startOfDay(dateB).getTime()) / oneDay);
  }

  function nowParts() {
    var now = new Date();
    return {
      date: Utilities.formatDate(now, MT.APP.TIMEZONE, 'dd/MM/yyyy'),
      time: Utilities.formatDate(now, MT.APP.TIMEZONE, 'HH:mm'),
      timestamp: Utilities.formatDate(now, MT.APP.TIMEZONE, 'dd/MM/yyyy HH:mm'),
      iso: Utilities.formatDate(now, MT.APP.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss")
    };
  }

  function formatDate(value, fallback) {
    var date = toDate(value);
    if (!date) return fallback || '';
    return Utilities.formatDate(date, MT.APP.TIMEZONE, 'dd MMMM');
  }

  function formatDateTime(value, fallback) {
    var date = toDate(value);
    if (!date) return fallback || '';
    return Utilities.formatDate(date, MT.APP.TIMEZONE, 'dd/MM HH:mm');
  }

  function currentUser() {
    try {
      return Session.getActiveUser().getEmail() || 'Usuário não identificado';
    } catch (error) {
      return 'Usuário não identificado';
    }
  }

  function generateId(prefix) {
    var now = Utilities.formatDate(new Date(), MT.APP.TIMEZONE, 'yyyyMMddHHmmss');
    var random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return (prefix || 'MT') + '-' + now + '-' + random;
  }

  function sameValue(a, b) {
    if (Object.prototype.toString.call(a) === '[object Date]' || Object.prototype.toString.call(b) === '[object Date]') {
      var dateA = toDate(a);
      var dateB = toDate(b);
      if (!dateA && !dateB) return true;
      if (!dateA || !dateB) return false;
      return dateA.getTime() === dateB.getTime();
    }
    return String(a || '') === String(b || '');
  }

  function activeWeek(record) {
    var raw = record['Semana'];
    var match = String(raw || '').match(/(\d+)/);
    if (match) return Number(match[1]);
    var baptismDate = toDate(record['Data Batismal']);
    if (!baptismDate) return 1;
    var daysUntil = daysBetween(baptismDate, new Date());
    if (daysUntil <= 7) return 3;
    if (daysUntil <= 14) return 2;
    return 1;
  }

  function weekLabel(record) {
    return 'Semana ' + activeWeek(record);
  }

  function statusReason(record, updateLimitDays) {
    var result = normalize(record['Resultado']);
    if (result === 'batizado') return MT.STATUS.BAPTIZED;
    if (toBoolean(record['Reservado']) || result === 'reservado') return MT.STATUS.BAPTIZED;
    if (toBoolean(record['Data Caiu']) || result === 'data caiu') return MT.STATUS.FELL;

    var baptismDate = toDate(record['Data Batismal']);
    if (baptismDate && startOfDay(baptismDate).getTime() < startOfDay(new Date()).getTime()) {
      return MT.STATUS.FELL;
    }

    var lastUpdate = toDate(record['Última Atualização']);
    var limit = Number(updateLimitDays || MT.CONFIG.DEFAULT_UPDATE_LIMIT_DAYS);
    if (!lastUpdate || daysBetween(new Date(), lastUpdate) > limit) {
      return MT.STATUS.STALE;
    }

    var week = activeWeek(record);
    var hasTouchDown = toBoolean(record['TouchDown']);
    var hasChurchPlan = toBoolean(record['Plano Igreja']);
    var hasMatch = toBoolean(record['Match']);
    var hasInterview = toBoolean(record['Entrevista']);

    if (week >= 3 && !hasInterview) return MT.STATUS.CRITICAL;
    if (week >= 2 && !hasMatch) return MT.STATUS.CRITICAL;
    if (week >= 1 && (!hasTouchDown || !hasChurchPlan)) return MT.STATUS.PENDING;
    if (isBlank(record['Próximo Passo'])) return MT.STATUS.PENDING;
    return MT.STATUS.OK;
  }

  function sortRecordsByStatus(records) {
    var priority = {};
    MT.STATUS_ORDER.forEach(function (status, index) {
      priority[status] = index;
    });
    return records.slice().sort(function (a, b) {
      var statusA = priority[a['Status Cor']] || 0;
      var statusB = priority[b['Status Cor']] || 0;
      if (statusA !== statusB) return statusA - statusB;
      return String(a['Data Batismal'] || '').localeCompare(String(b['Data Batismal'] || ''));
    });
  }

  function setValidationList(range, values) {
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(false)
      .build();
    range.setDataValidation(rule);
  }

  function setCheckbox(range) {
    range.insertCheckboxes();
    range.setValue(false);
  }

  function protectSheet(sheetObject, description) {
    var protections = sheetObject.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    protections.forEach(function (protection) {
      if (protection.getDescription() === description) protection.remove();
    });
    var protection = sheetObject.protect().setDescription(description);
    protection.setWarningOnly(false);
    try {
      protection.removeEditors(protection.getEditors());
    } catch (error) {
      log('WARN', 'Utils.protectSheet', 'Não foi possível remover editores da proteção', error.message);
    }
    return protection;
  }

  function toast(message) {
    try {
      ss().toast(message, MT.APP.NAME, 4);
    } catch (error) {
      log('WARN', 'Utils.toast', 'Toast indisponível', error.message);
    }
  }

  function log(level, origin, message, details) {
    try {
      var sheetObject = ensureSheet(MT.SHEETS.LOGS);
      if (sheetObject.getLastRow() === 0) setHeaders(sheetObject, MT.LOG_HEADERS);
      var now = nowParts();
      sheetObject.getRange(sheetObject.getLastRow() + 1, 1, 1, MT.LOG_HEADERS.length).setValues([[
        now.date,
        now.time,
        level,
        origin,
        message,
        details || '',
        currentUser()
      ]]);
    } catch (ignored) {
      // Logging cannot interrupt user actions.
    }
  }

  return {
    ss: ss,
    sheet: sheet,
    ensureSheet: ensureSheet,
    resetSheet: resetSheet,
    ensureRows: ensureRows,
    ensureColumns: ensureColumns,
    hideSheet: hideSheet,
    showSheet: showSheet,
    setHeaders: setHeaders,
    getHeaders: getHeaders,
    headerMap: headerMap,
    rowToRecord: rowToRecord,
    recordToRow: recordToRow,
    isBlank: isBlank,
    isRowBlank: isRowBlank,
    normalize: normalize,
    toBoolean: toBoolean,
    toDate: toDate,
    startOfDay: startOfDay,
    daysBetween: daysBetween,
    nowParts: nowParts,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    currentUser: currentUser,
    generateId: generateId,
    sameValue: sameValue,
    activeWeek: activeWeek,
    weekLabel: weekLabel,
    statusReason: statusReason,
    sortRecordsByStatus: sortRecordsByStatus,
    setValidationList: setValidationList,
    setCheckbox: setCheckbox,
    protectSheet: protectSheet,
    toast: toast,
    log: log
  };
})();
