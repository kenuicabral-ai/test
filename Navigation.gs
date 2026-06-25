function mtStartRegistration() {
  var ss = mtGetSpreadsheet();
  var records = mtVisibleRegistrationRecords(ss);
  if (records.length > 0) {
    PropertiesService.getUserProperties().setProperty(MT_USER_PROPERTIES.CURRENT_RECORD_ID, records[0].ID);
  }
  mtRenderRegisterCard(ss);
  ss.setActiveSheet(mtGetOrCreateSheet(ss, MT_SHEETS.REGISTER));
}

function mtMoveRegistration(direction) {
  var ss = mtGetSpreadsheet();
  mtSaveCurrentRegistration({ refreshDashboards: true, renderRegister: false });
  var records = mtVisibleRegistrationRecords(ss);
  if (records.length === 0) {
    PropertiesService.getUserProperties().deleteProperty(MT_USER_PROPERTIES.CURRENT_RECORD_ID);
    mtRenderRegisterCard(ss);
    return;
  }

  var props = PropertiesService.getUserProperties();
  var currentId = props.getProperty(MT_USER_PROPERTIES.CURRENT_RECORD_ID);
  var currentIndex = 0;
  records.forEach(function(record, index) {
    if (mtNormalizeText(record.ID) === mtNormalizeText(currentId)) {
      currentIndex = index;
    }
  });

  var nextIndex = (currentIndex + direction + records.length) % records.length;
  props.setProperty(MT_USER_PROPERTIES.CURRENT_RECORD_ID, records[nextIndex].ID);
  mtRenderRegisterCard(ss);
}

function mtRenderRegisterCard(ss) {
  var spreadsheet = ss || mtGetSpreadsheet();
  var sheet = mtGetOrCreateSheet(spreadsheet, MT_SHEETS.REGISTER);
  mtPrepareAppSheet(sheet);

  var records = mtVisibleRegistrationRecords(spreadsheet);
  var props = PropertiesService.getUserProperties();
  var currentId = props.getProperty(MT_USER_PROPERTIES.CURRENT_RECORD_ID);
  var record = mtFindRecordById(records, currentId) || records[0];

  if (!record) {
    mtMergeAndStyle(sheet.getRange('A1:F2'), '📱 Registro', {
      background: MT_COLORS.DARK,
      fontColor: MT_COLORS.WHITE,
      fontSize: 18,
      fontWeight: 'bold',
      horizontalAlignment: 'center',
      borderColor: MT_COLORS.DARK
    });
    mtEmptyState_(sheet, 7, 'Nenhum pesquisador ativo para registrar.');
    return;
  }

  props.setProperty(MT_USER_PROPERTIES.CURRENT_RECORD_ID, record.ID);
  sheet.getRange(MT_REGISTER_CELLS.RECORD_ID.row, MT_REGISTER_CELLS.RECORD_ID.column).setValue(record.ID);

  var palette = mtStatusColor(record.Status);
  mtMergeAndStyle(sheet.getRange('A1:F2'), '📱 Registro', {
    background: MT_COLORS.DARK,
    fontColor: MT_COLORS.WHITE,
    fontSize: 18,
    fontWeight: 'bold',
    horizontalAlignment: 'center',
    borderColor: MT_COLORS.DARK
  });
  mtMergeAndStyle(sheet.getRange('A3:F5'), record.Nome || 'Sem nome', {
    background: MT_COLORS.CARD_BG,
    fontColor: MT_COLORS.TEXT,
    fontSize: 20,
    fontWeight: 'bold',
    horizontalAlignment: 'center'
  });
  mtStylePill(sheet.getRange('A6:C6'), 'Semana ' + (record.Semana || '-'), record.Status);
  mtStylePill(sheet.getRange('D6:F6'), palette.icon + ' ' + record.Status, record.Status);

  mtCardLabelValue_(sheet, 8, 'Área', record['Área'] || '-');
  mtCardLabelValue_(sheet, 10, 'Data Batismal', mtFormatBaptismDate(record['Data Batismal']));

  mtStyleSectionTitle(sheet.getRange('A13:F13'), 'STATUS');
  mtRenderWeekFields_(sheet, record);

  mtStyleSectionTitle(sheet.getRange('A20:F20'), 'PRÓXIMO PASSO');
  mtMergeAndStyle(sheet.getRange('B22:E23'), record['Próximo Passo'] || '', {
    background: MT_COLORS.CARD_BG,
    fontColor: MT_COLORS.TEXT,
    borderColor: MT_COLORS.BLUE
  });

  mtStyleSectionTitle(sheet.getRange('A25:F25'), 'OBSERVAÇÃO');
  mtMergeAndStyle(sheet.getRange('B26:E28'), record['Observação'] || '', {
    background: MT_COLORS.CARD_BG,
    fontColor: MT_COLORS.TEXT,
    borderColor: MT_COLORS.BLUE
  });

  mtStyleSectionTitle(sheet.getRange('A29:F29'), 'RESULTADO');
  mtMergeAndStyle(sheet.getRange('B30:E30'), record.Resultado || MT_RESULT_OPTIONS[0], {
    background: MT_COLORS.CARD_BG,
    fontColor: MT_COLORS.TEXT,
    horizontalAlignment: 'center',
    borderColor: MT_COLORS.BLUE
  });
  mtSetDropdown(sheet, 'B30:E30', MT_RESULT_OPTIONS, record.Resultado || MT_RESULT_OPTIONS[0]);

  mtMergeAndStyle(sheet.getRange('A32:F32'), 'Última atualização: ' + mtFormatLastUpdate(record), {
    background: MT_COLORS.APP_BG,
    fontColor: MT_COLORS.MUTED_TEXT,
    horizontalAlignment: 'center',
    border: false
  });

  mtSetCheckbox(sheet, MT_REGISTER_ACTIONS.PREVIOUS.row, MT_REGISTER_ACTIONS.PREVIOUS.column, false);
  mtSetCheckbox(sheet, MT_REGISTER_ACTIONS.SAVE.row, MT_REGISTER_ACTIONS.SAVE.column, false);
  mtSetCheckbox(sheet, MT_REGISTER_ACTIONS.NEXT.row, MT_REGISTER_ACTIONS.NEXT.column, false);
  mtStyleButton(sheet.getRange('A35:B36'), '⬅ Anterior', MT_COLORS.GRAY);
  mtStyleButton(sheet.getRange('C35:D36'), 'Salvar', MT_COLORS.BLUE);
  mtStyleButton(sheet.getRange('E35:F36'), 'Próximo ➡', MT_COLORS.GREEN);
}

function mtCardLabelValue_(sheet, row, label, value) {
  sheet.getRange(row, 1, 1, 2)
    .merge()
    .setValue(label)
    .setBackground(MT_COLORS.CARD_BG)
    .setFontColor(MT_COLORS.MUTED_TEXT)
    .setFontWeight('bold');
  sheet.getRange(row, 3, 1, 4)
    .merge()
    .setValue(value)
    .setBackground(MT_COLORS.CARD_BG)
    .setFontColor(MT_COLORS.TEXT)
    .setFontWeight('bold');
  sheet.getRange(row, 1, 1, 6).setBorder(true, true, true, true, false, false, MT_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
}

function mtRenderWeekFields_(sheet, record) {
  var week = Math.max(1, Math.min(3, mtParseNumber(record.Semana, 1)));
  var fields = MT_WEEK_FIELDS[String(week)] || MT_WEEK_FIELDS['1'];
  var startRow = MT_REGISTER_CELLS.FIELD_START_ROW;

  sheet.getRange(startRow, MT_REGISTER_CELLS.FIELD_NAME_COLUMN, 5, 1).clearContent();
  fields.forEach(function(field, index) {
    var row = startRow + index;
    sheet.getRange(row, 1, 1, 4)
      .merge()
      .setValue(field)
      .setBackground(MT_COLORS.CARD_BG)
      .setFontColor(MT_COLORS.TEXT)
      .setFontWeight('bold')
      .setBorder(true, true, true, false, false, false, MT_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    mtSetCheckbox(sheet, row, MT_REGISTER_CELLS.FIELD_VALUE_COLUMN, mtToBoolean(record[field]))
      .setBackground(MT_COLORS.CARD_BG)
      .setBorder(true, false, true, true, false, false, MT_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(row, MT_REGISTER_CELLS.FIELD_NAME_COLUMN).setValue(field);
  });
}

function mtCollectRegistrationValues(sheet) {
  var values = {};
  var recordId = sheet.getRange(MT_REGISTER_CELLS.RECORD_ID.row, MT_REGISTER_CELLS.RECORD_ID.column).getValue();
  for (var row = MT_REGISTER_CELLS.FIELD_START_ROW; row < MT_REGISTER_CELLS.FIELD_START_ROW + 5; row++) {
    var field = sheet.getRange(row, MT_REGISTER_CELLS.FIELD_NAME_COLUMN).getValue();
    if (field) {
      values[field] = sheet.getRange(row, MT_REGISTER_CELLS.FIELD_VALUE_COLUMN).getValue();
    }
  }
  values['Próximo Passo'] = sheet.getRange(MT_REGISTER_CELLS.NEXT_STEP.row, MT_REGISTER_CELLS.NEXT_STEP.column).getValue();
  values['Observação'] = sheet.getRange(MT_REGISTER_CELLS.NOTE.row, MT_REGISTER_CELLS.NOTE.column).getValue();
  values.Resultado = sheet.getRange(MT_REGISTER_CELLS.RESULT.row, MT_REGISTER_CELLS.RESULT.column).getValue();
  return {
    recordId: recordId,
    values: values
  };
}

function mtSaveCurrentRegistration(options) {
  var settings = options || {};
  var ss = mtGetSpreadsheet();
  var sheet = mtGetOrCreateSheet(ss, MT_SHEETS.REGISTER);
  var collected = mtCollectRegistrationValues(sheet);
  if (!collected.recordId) return { saved: false, changes: 0 };

  var result = mtSaveRegistrationFromValues(collected.recordId, collected.values);
  if (result.saved && result.changes > 0) {
    sheet.getRange('A32:F32').setValue('Última atualização: ' + mtFormatLastUpdate({ 'Última Atualização Em': mtNow() }));
    if (settings.refreshDashboards !== false) {
      mtRefreshAllDashboards(ss);
    }
  }
  if (settings.renderRegister === true) {
    mtRenderRegisterCard(ss);
  }
  return result;
}

function mtIsRegisterEditable(range) {
  if (range.getSheet().getName() !== MT_SHEETS.REGISTER) return false;
  if (range.getColumn() === MT_REGISTER_CELLS.FIELD_VALUE_COLUMN &&
      range.getRow() >= MT_REGISTER_CELLS.FIELD_START_ROW &&
      range.getRow() < MT_REGISTER_CELLS.FIELD_START_ROW + 5) {
    return true;
  }
  return mtSameCell_(range, MT_REGISTER_CELLS.NEXT_STEP.row, MT_REGISTER_CELLS.NEXT_STEP.column) ||
    mtSameCell_(range, MT_REGISTER_CELLS.NOTE.row, MT_REGISTER_CELLS.NOTE.column) ||
    mtSameCell_(range, MT_REGISTER_CELLS.RESULT.row, MT_REGISTER_CELLS.RESULT.column);
}

function mtRegisterActionFromRange(range) {
  if (range.getSheet().getName() !== MT_SHEETS.REGISTER) return '';
  if (mtRangeMatches(range, MT_REGISTER_ACTIONS.PREVIOUS)) return 'previous';
  if (mtRangeMatches(range, MT_REGISTER_ACTIONS.SAVE)) return 'save';
  if (mtRangeMatches(range, MT_REGISTER_ACTIONS.NEXT)) return 'next';
  return '';
}
