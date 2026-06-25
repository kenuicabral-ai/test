function mtSetupConfigSheet(ss) {
  var sheet = mtGetOrCreateSheet(ss, MT_SHEETS.CONFIG);
  mtPrepareAppSheet(sheet);

  mtMergeAndStyle(sheet.getRange('A1:F2'), '⚙ Configuração', {
    background: MT_COLORS.DARK,
    fontColor: MT_COLORS.WHITE,
    fontSize: 18,
    fontWeight: 'bold',
    horizontalAlignment: 'center',
    borderColor: MT_COLORS.DARK
  });

  mtMergeAndStyle(sheet.getRange('A4:F5'), 'Ajustes usados pelos dashboards e pelo card de registro.', {
    background: MT_COLORS.CARD_BG,
    fontColor: MT_COLORS.MUTED_TEXT,
    horizontalAlignment: 'center'
  });

  var rows = [
    [MT_CONFIG_KEYS.DISTRICT, MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.DISTRICT]],
    [MT_CONFIG_KEYS.ZONE, MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.ZONE]],
    [MT_CONFIG_KEYS.NO_UPDATE_DAYS, MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.NO_UPDATE_DAYS]],
    [MT_CONFIG_KEYS.CRITICAL_WINDOW_DAYS, MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.CRITICAL_WINDOW_DAYS]],
    [MT_CONFIG_KEYS.LAST_REFRESH, mtDateTimeStamp(mtNow())]
  ];

  var existing = mtReadConfigValues_(sheet);
  rows = rows.map(function(row) {
    return [row[0], existing[row[0]] === undefined || existing[row[0]] === '' ? row[1] : existing[row[0]]];
  });

  sheet.getRange(8, 1, rows.length, 2).setValues(rows);
  sheet.getRange('A8:A12')
    .setBackground(MT_COLORS.BLUE_SOFT)
    .setFontColor(MT_COLORS.BLUE)
    .setFontWeight('bold');
  sheet.getRange('B8:B12')
    .setBackground(MT_COLORS.CARD_BG)
    .setFontColor(MT_COLORS.TEXT)
    .setBorder(true, true, true, true, true, true, MT_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange('A8:B12').setFontSize(12).setWrap(true);

  mtMergeAndStyle(sheet.getRange('A15:F18'), 'Como usar: toque em 🏠 Home para iniciar os registros. A aba Base fica oculta e serve apenas como banco único de dados.', {
    background: MT_COLORS.YELLOW_SOFT,
    fontColor: MT_COLORS.TEXT,
    horizontalAlignment: 'center',
    borderColor: MT_COLORS.YELLOW
  });

  sheet.getRange('B10:B11').setNumberFormat('0');
  sheet.autoResizeColumn(1);
}

function mtReadConfigValues_(sheet) {
  var values = {};
  if (sheet.getLastRow() < 8) return values;
  var rows = sheet.getRange(8, 1, Math.max(0, sheet.getLastRow() - 7), 2).getValues();
  rows.forEach(function(row) {
    if (row[0]) values[row[0]] = row[1];
  });
  return values;
}

function mtGetConfig(ss) {
  var sheet = mtGetOrCreateSheet(ss || mtGetSpreadsheet(), MT_SHEETS.CONFIG);
  var values = mtReadConfigValues_(sheet);
  var config = {};
  Object.keys(MT_DEFAULT_CONFIG).forEach(function(key) {
    config[key] = values[key] === undefined || values[key] === '' ? MT_DEFAULT_CONFIG[key] : values[key];
  });
  config.noUpdateDays = mtParseNumber(config[MT_CONFIG_KEYS.NO_UPDATE_DAYS], MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.NO_UPDATE_DAYS]);
  config.criticalWindowDays = mtParseNumber(config[MT_CONFIG_KEYS.CRITICAL_WINDOW_DAYS], MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.CRITICAL_WINDOW_DAYS]);
  return config;
}

function mtUpdateLastRefresh(ss) {
  var sheet = mtGetOrCreateSheet(ss || mtGetSpreadsheet(), MT_SHEETS.CONFIG);
  var rows = sheet.getRange(8, 1, Math.max(1, sheet.getLastRow() - 7), 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === MT_CONFIG_KEYS.LAST_REFRESH) {
      sheet.getRange(i + 8, 2).setValue(mtDateTimeStamp(mtNow()));
      return;
    }
  }
}

function mtIsConfigEdit(range) {
  return range.getSheet().getName() === MT_SHEETS.CONFIG &&
    range.getColumn() === 2 &&
    range.getRow() >= 8 &&
    range.getRow() <= 11;
}
