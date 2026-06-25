var MT_CONFIG_DEFAULTS = {
  district: 'Distrito 3',
  zone: 'Zona 1',
  staleHours: 48,
  criticalDays: 3,
  zoneEmail: '',
  emailMode: 'DESATIVADO'
};

function Config_setup_() {
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.config);
  var currentConfig = Config_get_();
  Utils_clearSheet_(sheet);
  Colors_applyCanvas_(sheet);
  Utils_setColumnWidths_(sheet, { 1: 26, 2: 180, 3: 26, 4: 180, 5: 26, 6: 120 });

  sheet.getRange('B2:F2').merge().setValue('⚙ Configuração');
  Colors_applyTitle_(sheet.getRange('B2:F2'));

  var labels = [
    ['Distrito ativo', currentConfig.district],
    ['Zona ativa', currentConfig.zone],
    ['Horas sem atualização', currentConfig.staleHours],
    ['Dias críticos antes da data', currentConfig.criticalDays],
    ['Email do LZ', currentConfig.zoneEmail],
    ['Modo de emails', currentConfig.emailMode]
  ];
  sheet.getRange('B4:C9').setValues(labels);
  sheet.getRange('B4:B9').setFontWeight('bold').setFontColor(MT_COLORS.mutedText);
  Colors_applyInput_(sheet.getRange('C4:C9'));
  Utils_setDropdown_(sheet.getRange('C9'), ['DESATIVADO', 'RASCUNHO', 'ENVIAR']);

  sheet.getRange('B12:F12').merge().setValue('Manutenção do aplicativo');
  Colors_applySectionTitle_(sheet.getRange('B12:F12'));
  sheet.getRange('B13:C13').merge().setValue('Reconstruir telas');
  sheet.getRange('D13').setValue(false).insertCheckboxes();
  Colors_applyAction_(sheet.getRange('B13:F13'), MT_COLORS.darkBlue);
  sheet.getRange('B16:F20').merge().setValue(
    'A Base é a única fonte de dados. As abas visíveis são telas do aplicativo; as abas ocultas armazenam dados, histórico e cache.'
  ).setWrap(true).setFontColor(MT_COLORS.mutedText);

  sheet.setFrozenRows(0);
}

function Config_get_() {
  var sheet = Utils_getSheet_(MT_SHEETS.config);
  if (!sheet) {
    return MT_CONFIG_DEFAULTS;
  }
  var values = sheet.getRange('C4:C9').getValues().map(function (row) {
    return row[0];
  });
  return {
    district: Utils_normalizeText_(values[0]) || MT_CONFIG_DEFAULTS.district,
    zone: Utils_normalizeText_(values[1]) || MT_CONFIG_DEFAULTS.zone,
    staleHours: Number(values[2]) || MT_CONFIG_DEFAULTS.staleHours,
    criticalDays: Number(values[3]) || MT_CONFIG_DEFAULTS.criticalDays,
    zoneEmail: Utils_normalizeText_(values[4]),
    emailMode: Utils_normalizeText_(values[5]) || MT_CONFIG_DEFAULTS.emailMode
  };
}

function Config_isConfigCell_(range) {
  var sheet = range.getSheet();
  if (sheet.getName() !== MT_SHEETS.config) {
    return false;
  }
  var row = range.getRow();
  var column = range.getColumn();
  return column === 3 && row >= 4 && row <= 9;
}

function Config_isRebuildAction_(range) {
  return range.getSheet().getName() === MT_SHEETS.config &&
    range.getA1Notation() === 'D13' &&
    Utils_isChecked_(range.getValue());
}
