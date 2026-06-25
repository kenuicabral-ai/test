var MT = MT || {};

MT.appendHistoryRows = function (changes) {
  if (!changes || !changes.length) {
    return;
  }

  var sheet = MT.ensureHistorySheet();
  var now = new Date();
  var date = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var time = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');

  var rows = changes.map(function (change) {
    return [
      date,
      time,
      change.id,
      change.name,
      change.field,
      MT.toDisplayValue(change.oldValue),
      MT.toDisplayValue(change.newValue),
      change.user || 'usuário não identificado'
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, MT.HISTORY_HEADERS.length).setValues(rows);
};

MT.log = function (level, origin, message, details) {
  try {
    var sheet = MT.ensureLogSheet();
    var now = new Date();
    sheet.appendRow([
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss'),
      level,
      origin,
      message,
      details || ''
    ]);
  } catch (error) {
    console.error(origin + ': ' + message + ' - ' + error.message);
  }
};
