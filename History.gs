var MT = MT || {};

MT.History = (function () {
  function makeRow(record, field, oldValue, newValue, user) {
    var now = MT.Utils.nowParts();
    return [
      now.date,
      now.time,
      record ? record['ID'] : '',
      record ? record['Nome'] : '',
      field,
      serializeValue(oldValue),
      serializeValue(newValue),
      user || MT.Utils.currentUser()
    ];
  }

  function serializeValue(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, MT.APP.TIMEZONE, 'dd/MM/yyyy');
    }
    return value === null || value === undefined ? '' : String(value);
  }

  function appendRows(rows) {
    if (!rows || !rows.length) return;
    var sheetObject = MT.Utils.ensureSheet(MT.SHEETS.HISTORY);
    if (sheetObject.getLastRow() === 0 || MT.Utils.isBlank(sheetObject.getRange(1, 1).getValue())) {
      MT.Utils.setHeaders(sheetObject, MT.HISTORY_HEADERS);
    }
    MT.Utils.ensureRows(sheetObject, sheetObject.getLastRow() + rows.length);
    sheetObject.getRange(sheetObject.getLastRow() + 1, 1, rows.length, MT.HISTORY_HEADERS.length).setValues(rows);
    protect();
  }

  function protect() {
    var sheetObject = MT.Utils.ensureSheet(MT.SHEETS.HISTORY);
    try {
      MT.Utils.protectSheet(sheetObject, 'Mission Tracker - histórico somente leitura');
    } catch (error) {
      MT.Utils.log('WARN', 'History.protect', 'Não foi possível proteger o histórico', error.message);
    }
  }

  return {
    makeRow: makeRow,
    appendRows: appendRows,
    protect: protect
  };
})();
