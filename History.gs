/**
 * Mission Tracker - Histórico imutável.
 */
var MTHistory = (function () {
  function logChanges(before, after, changes) {
    if (!changes || !changes.length) {
      return;
    }
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MT.SHEETS.HISTORICO);
    if (!sheet) {
      return;
    }
    var now = MTUtils.now();
    var dateStr = MTUtils.formatDate(now);
    var timeStr = MTUtils.formatTime(now);
    var user = MTUtils.getCurrentUserEmail();
    var rows = changes.map(function (change) {
      return [
        dateStr,
        timeStr,
        after.id,
        after.nome,
        change.field,
        serialize_(change.oldValue),
        serialize_(change.newValue),
        user
      ];
    });
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
  }

  function serialize_(value) {
    if (value === null || value === undefined) {
      return '';
    }
    if (Object.prototype.toString.call(value) === '[object Date]') {
      return MTUtils.formatDateTime(value);
    }
    return String(value);
  }

  return {
    logChanges: logChanges
  };
})();
