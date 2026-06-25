function History_setup_() {
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.history);
  Utils_ensureHeaders_(sheet, MT_HISTORY_HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, MT_HISTORY_HEADERS.length)
    .setBackground(MT_COLORS.darkGray)
    .setFontColor(MT_COLORS.actionText)
    .setFontWeight('bold');
  Utils_protectSheet_(sheet, 'Histórico protegido do Mission Tracker', false);
  sheet.hideSheet();
}

function History_append_(changes) {
  if (!changes || !changes.length) {
    return;
  }
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.history);
  Utils_ensureHeaders_(sheet, MT_HISTORY_HEADERS);
  var now = Utils_now_();
  var rows = changes.map(function (change) {
    return [
      Utils_formatDate_(now),
      Utils_formatTime_(now),
      change.id || '',
      change.name || '',
      change.field || '',
      History_formatValue_(change.oldValue),
      History_formatValue_(change.newValue),
      change.user || Utils_getActiveUserEmail_()
    ];
  });
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, MT_HISTORY_HEADERS.length).setValues(rows);
}

function History_formatValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utils_formatDate_(value, 'dd/MM/yyyy HH:mm');
  }
  return value === undefined || value === null ? '' : String(value);
}

function History_captureBaseEdit_(event) {
  var range = event.range;
  var sheet = range.getSheet();
  if (sheet.getName() !== MT_SHEETS.base || range.getRow() === 1) {
    return;
  }

  var header = sheet.getRange(1, range.getColumn()).getValue();
  if (MT_EDITABLE_BASE_FIELDS.indexOf(header) < 0) {
    return;
  }

  var row = sheet.getRange(range.getRow(), 1, 1, MT_BASE_HEADERS.length).getValues()[0];
  var record = Database_rowToRecord_(row, range.getRow());
  History_append_([{
    id: record.ID,
    name: record.Nome,
    field: header,
    oldValue: event.oldValue,
    newValue: event.value,
    user: Utils_getActiveUserEmail_()
  }]);
}
