/**
 * Mission Tracker - Utilitários.
 */
var MTUtils = (function () {
  var MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

  function now() {
    return new Date();
  }

  function getTimezone() {
    return Session.getScriptTimeZone() || 'America/Sao_Paulo';
  }

  function formatDate(date) {
    if (!date) {
      return '';
    }
    return Utilities.formatDate(new Date(date), getTimezone(), 'dd/MM/yyyy');
  }

  function formatTime(date) {
    if (!date) {
      return '';
    }
    return Utilities.formatDate(new Date(date), getTimezone(), 'HH:mm');
  }

  function formatDateTime(date) {
    if (!date) {
      return '';
    }
    return Utilities.formatDate(new Date(date), getTimezone(), 'dd/MM/yyyy HH:mm');
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function toBoolean(value) {
    if (value === true || value === false) {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return false;
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return value;
    }
    var date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function dateOnly(date) {
    var parsed = parseDate(date);
    if (!parsed) {
      return null;
    }
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  function diffDays(fromDate, toDate) {
    var fromDay = dateOnly(fromDate);
    var toDay = dateOnly(toDate);
    if (!fromDay || !toDay) {
      return null;
    }
    return Math.floor((toDay.getTime() - fromDay.getTime()) / MILLIS_PER_DAY);
  }

  function getWeekFromBaptismDate(baptismDate, referenceDate) {
    var parsed = parseDate(baptismDate);
    if (!parsed) {
      return 1;
    }
    var today = referenceDate || now();
    var daysToBaptism = diffDays(today, parsed);
    if (daysToBaptism == null) {
      return 1;
    }
    if (daysToBaptism > 14) {
      return 1;
    }
    if (daysToBaptism > 7) {
      return 2;
    }
    return 3;
  }

  function getCurrentUserEmail() {
    return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'usuário-desconhecido';
  }

  function chunks(list, size) {
    var out = [];
    for (var i = 0; i < list.length; i += size) {
      out.push(list.slice(i, i + size));
    }
    return out;
  }

  function writeLog(level, message, metadata) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var logsSheet = ss.getSheetByName(MT.SHEETS.LOGS);
      if (!logsSheet) {
        return;
      }
      var stamp = now();
      var row = [
        formatDate(stamp),
        formatTime(stamp),
        level,
        message,
        metadata ? JSON.stringify(metadata) : '',
        getCurrentUserEmail()
      ];
      logsSheet.appendRow(row);
    } catch (err) {
      // Não interromper o fluxo principal por falha de log.
    }
  }

  function uniqueValues(list) {
    var map = {};
    var out = [];
    list.forEach(function (item) {
      var key = normalizeText(item);
      if (!key || map[key]) {
        return;
      }
      map[key] = true;
      out.push(key);
    });
    return out;
  }

  return {
    now: now,
    getTimezone: getTimezone,
    formatDate: formatDate,
    formatTime: formatTime,
    formatDateTime: formatDateTime,
    normalizeText: normalizeText,
    toBoolean: toBoolean,
    parseDate: parseDate,
    dateOnly: dateOnly,
    diffDays: diffDays,
    getWeekFromBaptismDate: getWeekFromBaptismDate,
    getCurrentUserEmail: getCurrentUserEmail,
    chunks: chunks,
    writeLog: writeLog,
    uniqueValues: uniqueValues
  };
})();
