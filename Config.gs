var MT = MT || {};

MT.ensureApplicationSheets = function () {
  MT.ensureConfigSheet();
  MT.ensureBaseSheet();
  MT.ensureHistorySheet();
  MT.ensureEmailSheet();
  MT.ensureLogSheet();
  MT.ensureSystemSheet();
  MT.ensureCacheSheet();

  MT.VISIBLE_SHEETS.forEach(function (name) {
    var sheet = MT.ensureSheet(name, MT.DEFAULT_ROW_COUNT, MT.DEFAULT_COLUMN_COUNT);
    sheet.showSheet();
    MT.applyAppChrome(sheet);
  });

  MT.enforceSheetVisibility();
};

MT.enforceSheetVisibility = function () {
  var allowedVisible = {};
  MT.VISIBLE_SHEETS.forEach(function (name) {
    allowedVisible[name] = true;
  });

  var managed = {};
  MT.VISIBLE_SHEETS.concat(MT.HIDDEN_SHEETS).forEach(function (name) {
    managed[name] = true;
  });

  MT.getSpreadsheet().getSheets().forEach(function (sheet) {
    var name = sheet.getName();
    if (allowedVisible[name]) {
      sheet.showSheet();
      return;
    }

    if (managed[name] || !allowedVisible[name]) {
      try {
        sheet.hideSheet();
      } catch (error) {
        MT.log('WARN', 'enforceSheetVisibility', 'Aba não ocultada', name + ': ' + error.message);
      }
    }
  });
};

MT.ensureConfigSheet = function () {
  var sheet = MT.ensureSheet(MT.SHEETS.CONFIG, 60, 6);
  sheet.showSheet();
  MT.applyAppChrome(sheet);

  if (sheet.getRange('A1').getValue() !== MT.APP_NAME) {
    MT.renderConfigSheet();
  }

  return sheet;
};

MT.renderConfigSheet = function () {
  var sheet = MT.ensureSheet(MT.SHEETS.CONFIG, 60, 6);
  var previous = {
    district: sheet.getRange(MT.CONFIG_CELLS.DISTRICT).getValue() || 'Distrito 3',
    zone: sheet.getRange(MT.CONFIG_CELLS.ZONE).getValue() || 'Zona 1',
    email: sheet.getRange(MT.CONFIG_CELLS.ZONE_LEADER_EMAIL).getValue() || '',
    staleHours: sheet.getRange(MT.CONFIG_CELLS.STALE_HOURS).getValue() || 24
  };

  MT.clearSheet(sheet, 60, 6);
  sheet.setColumnWidths(1, 1, 150);
  sheet.setColumnWidths(2, 5, 110);
  sheet.setRowHeights(1, 60, 28);
  sheet.setRowHeight(1, 48);

  sheet.getRange('A1:F1').merge().setValue(MT.APP_NAME);
  MT.styleTitle(sheet.getRange('A1:F1'));

  sheet.getRange('A2:F2').merge().setValue('⚙ Configuração do aplicativo');
  sheet.getRange('A2:F2')
    .setHorizontalAlignment('center')
    .setFontColor(MT.COLORS.MUTED_TEXT)
    .setFontSize(12);

  sheet.getRange('A4:F4').merge().setValue('Dados usados nos cards e dashboards');
  MT.styleSectionTitle(sheet.getRange('A4:F4'));

  sheet.getRange('A5:F8').setValues([
    ['Distrito padrão', previous.district, '', '', '', ''],
    ['Zona padrão', previous.zone, '', '', '', ''],
    ['Email do LZ', previous.email, '', '', '', ''],
    ['Horas até ficar laranja', previous.staleHours, '', '', '', '']
  ]);
  sheet.getRange('A5:A8').setFontWeight('bold').setFontColor(MT.COLORS.MUTED_TEXT);
  sheet.getRange('B5:F8').setBackground(MT.COLORS.CARD);
  MT.styleCard(sheet.getRange('A5:F8'), MT.COLORS.CARD);

  sheet.getRange('A11:F11').merge().setValue('Como usar');
  MT.styleSectionTitle(sheet.getRange('A11:F11'));

  sheet.getRange('A12:F18').merge().setValue(
    '1. Cadastre pesquisadores somente na aba oculta Base.\n' +
    '2. Use a aba 📱 Registro para atualizar um pesquisador por vez.\n' +
    '3. O sistema recalcula status, cores e dashboards automaticamente.\n' +
    '4. Histórico, logs e cache ficam protegidos e ocultos.'
  );
  MT.styleCard(sheet.getRange('A12:F18'), MT.COLORS.LIGHT_BLUE);

  var staleRule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(1)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(MT.CONFIG_CELLS.STALE_HOURS).setDataValidation(staleRule);

  try {
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    protections.forEach(function (protection) {
      protection.remove();
    });

    var protection = sheet.protect().setDescription('Configuração do Mission Tracker');
    protection.setUnprotectedRanges([
      sheet.getRange(MT.CONFIG_CELLS.DISTRICT),
      sheet.getRange(MT.CONFIG_CELLS.ZONE),
      sheet.getRange(MT.CONFIG_CELLS.ZONE_LEADER_EMAIL),
      sheet.getRange(MT.CONFIG_CELLS.STALE_HOURS)
    ]);
  } catch (error) {
    MT.log('WARN', 'renderConfigSheet', 'Proteção de configuração não aplicada', error.message);
  }
};

MT.getConfig = function () {
  var sheet = MT.ensureConfigSheet();
  return {
    district: sheet.getRange(MT.CONFIG_CELLS.DISTRICT).getValue(),
    zone: sheet.getRange(MT.CONFIG_CELLS.ZONE).getValue(),
    zoneLeaderEmail: sheet.getRange(MT.CONFIG_CELLS.ZONE_LEADER_EMAIL).getValue(),
    staleHours: sheet.getRange(MT.CONFIG_CELLS.STALE_HOURS).getValue() || 24
  };
};
