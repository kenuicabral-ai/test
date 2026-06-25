function mtSetupHistoryAndLogs(ss) {
  var history = mtGetOrCreateSheet(ss, MT_SHEETS.HISTORY);
  if (history.getLastRow() === 0) {
    history.getRange(1, 1, 1, MT_HISTORY_HEADERS.length).setValues([MT_HISTORY_HEADERS]);
  }
  mtApplyBaseSheetStyle(history);
  mtProtectSheet(history, 'Mission Tracker - histórico auditável', false);

  var logs = mtGetOrCreateSheet(ss, MT_SHEETS.LOGS);
  if (logs.getLastRow() === 0) {
    logs.getRange(1, 1, 1, MT_LOG_HEADERS.length).setValues([MT_LOG_HEADERS]);
  }
  mtApplyBaseSheetStyle(logs);
  mtProtectSheet(logs, 'Mission Tracker - logs', true);
}

function mtAppendHistory(entries) {
  if (!entries || entries.length === 0) return;
  var ss = mtGetSpreadsheet();
  var sheet = mtGetOrCreateSheet(ss, MT_SHEETS.HISTORY);
  var now = mtNow();
  var rows = entries.map(function(entry) {
    return [
      mtDateStamp(now),
      mtTimeStamp(now),
      entry.recordId || '',
      entry.recordName || '',
      entry.field || '',
      entry.oldValue === undefined ? '' : entry.oldValue,
      entry.newValue === undefined ? '' : entry.newValue,
      entry.user || mtUserEmail()
    ];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, MT_HISTORY_HEADERS.length).setValues(rows);
}

function mtLog(level, origin, message) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    var sheet = ss.getSheetByName(MT_SHEETS.LOGS);
    if (!sheet) return;
    var now = mtNow();
    sheet.appendRow([
      mtDateStamp(now),
      mtTimeStamp(now),
      level || 'INFO',
      origin || '',
      message || ''
    ]);
  } catch (err) {
    // Logging must never block the user flow.
  }
}
