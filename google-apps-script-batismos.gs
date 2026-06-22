/**
 * Sistema de Acompanhamento de Datas Batismais e TouchDowns
 *
 * Como usar:
 * 1. Crie uma planilha no Google Sheets.
 * 2. Abra Extensoes > Apps Script.
 * 3. Cole este arquivo inteiro em Code.gs.
 * 4. Salve e execute a funcao setupSistemaBatismos uma vez.
 * 5. Autorize as permissoes solicitadas.
 *
 * Depois disso, use o menu "Batismos" dentro da planilha.
 */

var SHEETS = {
  DASHBOARD: 'Dashboard LZ',
  ACTIVE: 'Datas Ativas',
  DROPPED: 'Datas Caídas',
  CONFIG: 'Config',
  RESERVED: 'Reservados',
  UNASSIGNED: 'Sem Distrito',
  HISTORY: '_Histórico'
};

var ACTIVE_HEADERS = [
  'Nome',
  'Semana',
  'TouchDown',
  'Match',
  'Entrevista',
  'Status',
  'Próxima Ação',
  'Plano Igreja',
  'Data Batismal',
  'Área',
  'Distrito',
  'Bloqueio Principal',
  'Último Próximo Passo',
  'Última Atualização',
  'Resultado da Data',
  'Reserva',
  'Email ID'
];

var DROPPED_HEADERS = [
  'Nome',
  'Semana',
  'Área',
  'Distrito',
  'Data Batismal Original',
  'Motivo',
  'Observação',
  'Data da Queda',
  'Motivo da Queda',
  'Último Próximo Passo',
  'Email ID'
];

var RESERVED_HEADERS = [
  'Nome',
  'Semana',
  'TouchDown',
  'Match',
  'Entrevista',
  'Status',
  'Próxima Ação',
  'Plano Igreja',
  'Data Batismal',
  'Área',
  'Distrito',
  'Bloqueio Principal',
  'Último Próximo Passo',
  'Data da Reserva',
  'Reserva',
  'Email ID'
];

var HISTORY_HEADERS = [
  'Data/Hora',
  'Nome',
  'Área',
  'Distrito',
  'Campo',
  'Valor Anterior',
  'Valor Novo',
  'Observação'
];

var CONFIG_HEADERS = [
  'Área',
  'Distrito',
  'Aliases da Área',
  'Email LZ',
  'Status',
  'Match',
  'TouchDown',
  'Entrevista',
  'Bloqueio Principal',
  'Resultado da Data',
  'Motivo da Queda',
  'Configuração',
  'Valor'
];

var DEFAULT_AREAS = [
  ['Junção 1', 'Distrito 1', 'Juncao 1, Junção Um, Juncao Um'],
  ['Junção 2', 'Distrito 1', 'Juncao 2, Junção Dois, Juncao Dois'],
  ['Castelo 1', 'Distrito 1', 'Castelo 1, Castelo Um'],
  ['Castelo 2', 'Distrito 1', 'Castelo 2, Castelo Dois'],
  ['Porto Velho', 'Distrito 2', 'Porto velho'],
  ['São José do Norte', 'Distrito 2', 'Sao Jose do Norte, São jose do norte'],
  ['Jardim do Sol', 'Distrito 2', 'Jardim do sol'],
  ['Cidade Nova', 'Distrito 2', 'Cidade nova']
];

var OPTIONS = {
  STATUS: [
    '🟢 Firme para Igreja',
    '🟡 Mais ou Menos',
    '🔴 Risco',
    '⛪ Foi à Igreja',
    '⚠️ Não foi',
    '📅 Data firme',
    '⛪ Batizado',
    'Reservado'
  ],
  YES_NO: ['Sim', 'Não'],
  INTERVIEW: ['Sim', 'Não', 'Não Aplicável'],
  RESERVE: ['Não', 'Sim'],
  BLOCKS: [
    'Sem Match',
    'Não foi à Igreja',
    'Trabalho',
    'Transporte',
    'Família',
    'Palavra de Sabedoria',
    'Lei da Castidade',
    'Compromisso',
    'Sem contato',
    'Outro'
  ],
  RESULT: ['Ativa', 'Batizado', 'Data Caiu'],
  DROP_REASONS: [
    'Não foi à igreja',
    'Sem Match',
    'Problema familiar',
    'Problema de trabalho',
    'Mudou-se',
    'Não conseguimos contato',
    'Palavra de Sabedoria',
    'Lei da Castidade',
    'Medo ou indecisão',
    'Outro'
  ]
};

var PROCESSED_LABEL_NAME = 'batismos-processado';
var DEFAULT_VIEW_WINDOW_DAYS = 21;
var VIEW_WINDOW_SETTING_NAME = 'Janela de visualização (dias)';

// Busca os avisos oficiais de batismo marcado enviados pelo sistema da Igreja.
var EMAIL_SEARCH_QUERY = 'newer_than:90d from:noreply-missionary-info@mail.churchofjesuschrist.org subject:"Batismo marcado" -label:' + PROCESSED_LABEL_NAME;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Batismos')
    .addItem('Configurar sistema completo', 'setupSistemaBatismos')
    .addSeparator()
    .addItem('Ler emails agora', 'processarEmailsBatismo')
    .addItem('Atualizar Dashboard', 'atualizarDashboard')
    .addItem('Atualizar abas por distrito', 'atualizarAbasLDs')
    .addItem('Enviar alerta aos LZs agora', 'enviarAlertasLZs')
    .addItem('Reaplicar validações', 'aplicarValidacoes')
    .addSeparator()
    .addItem('Instalar gatilhos automáticos', 'instalarGatilhos')
    .addToUi();
}

function setupSistemaBatismos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  configurarAbaAtivas_(ss);
  configurarAbaCaidas_(ss);
  configurarAbaConfig_(ss);
  configurarAbaReservados_(ss);
  configurarAbaHistorico_(ss);
  configurarAbaDashboard_(ss);

  aplicarValidacoes();
  atualizarDashboard();
  instalarGatilhos();

  notify_('Sistema configurado. As abas, validações, dashboard e gatilhos foram criados.');
}

function configurarAbaAtivas_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.ACTIVE);
  migrarCabecalhos_(sheet, ACTIVE_HEADERS, defaultActiveValue_);
  setupHeader_(sheet, ACTIVE_HEADERS, '#1f4e79', '#ffffff');
  normalizarStatusSheet_(sheet, ACTIVE_HEADERS);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  sheet.setColumnWidths(1, ACTIVE_HEADERS.length, 110);
  sheet.setColumnWidth(col_(ACTIVE_HEADERS, 'Nome'), 160);
  sheet.setColumnWidth(col_(ACTIVE_HEADERS, 'Semana'), 80);
  sheet.setColumnWidth(col_(ACTIVE_HEADERS, 'Status'), 155);
  sheet.setColumnWidth(col_(ACTIVE_HEADERS, 'Próxima Ação'), 240);
  sheet.setColumnWidth(col_(ACTIVE_HEADERS, 'Plano Igreja'), 220);
  sheet.setColumnWidth(col_(ACTIVE_HEADERS, 'Último Próximo Passo'), 145);
  sheet.setColumnWidth(col_(ACTIVE_HEADERS, 'Email ID'), 180);
  sheet.hideColumns(col_(ACTIVE_HEADERS, 'Email ID'));
  sheet.getRange(2, col_(ACTIVE_HEADERS, 'Data Batismal'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(2, col_(ACTIVE_HEADERS, 'Último Próximo Passo'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
  sheet.getRange(2, col_(ACTIVE_HEADERS, 'Última Atualização'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
}

function configurarAbaCaidas_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.DROPPED);
  migrarCabecalhos_(sheet, DROPPED_HEADERS, defaultDroppedValue_);
  setupHeader_(sheet, DROPPED_HEADERS, '#7f1d1d', '#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, DROPPED_HEADERS.length, 155);
  sheet.setColumnWidth(col_(DROPPED_HEADERS, 'Observação'), 280);
  sheet.setColumnWidth(col_(DROPPED_HEADERS, 'Email ID'), 180);
  sheet.hideColumns(col_(DROPPED_HEADERS, 'Email ID'));
  sheet.getRange(2, col_(DROPPED_HEADERS, 'Data Batismal Original'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(2, col_(DROPPED_HEADERS, 'Data da Queda'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
  sheet.getRange(2, col_(DROPPED_HEADERS, 'Último Próximo Passo'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
}

function configurarAbaReservados_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.RESERVED);
  migrarCabecalhos_(sheet, RESERVED_HEADERS, defaultReservedValue_);
  setupHeader_(sheet, RESERVED_HEADERS, '#b45f06', '#ffffff');
  normalizarStatusSheet_(sheet, RESERVED_HEADERS);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  sheet.setColumnWidths(1, RESERVED_HEADERS.length, 110);
  sheet.setColumnWidth(col_(RESERVED_HEADERS, 'Nome'), 160);
  sheet.setColumnWidth(col_(RESERVED_HEADERS, 'Próxima Ação'), 240);
  sheet.setColumnWidth(col_(RESERVED_HEADERS, 'Plano Igreja'), 220);
  sheet.setColumnWidth(col_(RESERVED_HEADERS, 'Email ID'), 180);
  sheet.hideColumns(col_(RESERVED_HEADERS, 'Email ID'));
  sheet.getRange(2, col_(RESERVED_HEADERS, 'Data Batismal'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(2, col_(RESERVED_HEADERS, 'Último Próximo Passo'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
  sheet.getRange(2, col_(RESERVED_HEADERS, 'Data da Reserva'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
}

function configurarAbaConfig_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.CONFIG);
  var hasExistingConfig = sheet.getLastRow() > 1;
  var existingHeaders = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : [];
  if (hasExistingConfig && existingHeaders.indexOf('Email LZ') === -1 && existingHeaders.indexOf('Status') !== -1) {
    sheet.insertColumnBefore(existingHeaders.indexOf('Status') + 1);
  }
  setupHeader_(sheet, CONFIG_HEADERS, '#38761d', '#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, CONFIG_HEADERS.length, 180);

  if (hasExistingConfig) {
    ensureConfigSettings_(sheet);
    return;
  }

  var maxRows = Math.max(
    DEFAULT_AREAS.length,
    OPTIONS.STATUS.length,
    OPTIONS.YES_NO.length,
    OPTIONS.INTERVIEW.length,
    OPTIONS.BLOCKS.length,
    OPTIONS.RESULT.length,
    OPTIONS.DROP_REASONS.length
  );

  var values = [];
  for (var i = 0; i < maxRows; i++) {
    values.push([
      DEFAULT_AREAS[i] ? DEFAULT_AREAS[i][0] : '',
      DEFAULT_AREAS[i] ? DEFAULT_AREAS[i][1] : '',
      DEFAULT_AREAS[i] ? DEFAULT_AREAS[i][2] : '',
      '',
      OPTIONS.STATUS[i] || '',
      OPTIONS.YES_NO[i] || '',
      OPTIONS.YES_NO[i] || '',
      OPTIONS.INTERVIEW[i] || '',
      OPTIONS.BLOCKS[i] || '',
      OPTIONS.RESULT[i] || '',
      OPTIONS.DROP_REASONS[i] || '',
      i === 0 ? VIEW_WINDOW_SETTING_NAME : '',
      i === 0 ? DEFAULT_VIEW_WINDOW_DAYS : ''
    ]);
  }
  sheet.getRange(2, 1, values.length, CONFIG_HEADERS.length).setValues(values);
  ensureConfigSettings_(sheet);
}

function configurarAbaHistorico_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.HISTORY);
  setupHeader_(sheet, HISTORY_HEADERS, '#666666', '#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, HISTORY_HEADERS.length, 160);
  sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
  sheet.hideSheet();
}

function configurarAbaDashboard_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.DASHBOARD);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  sheet.setColumnWidths(1, 8, 170);
  sheet.setFrozenRows(2);
}

function aplicarValidacoes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var active = ss.getSheetByName(SHEETS.ACTIVE);
  var dropped = ss.getSheetByName(SHEETS.DROPPED);
  var reserved = ss.getSheetByName(SHEETS.RESERVED);
  var config = ss.getSheetByName(SHEETS.CONFIG);

  if (!active || !dropped || !reserved || !config) {
    setupSistemaBatismos();
    return;
  }

  var rowCount = Math.max(1, active.getMaxRows() - 1);
  setValidationFromConfig_(active, col_(ACTIVE_HEADERS, 'Status'), rowCount, 'Status');
  setValidationFromConfig_(active, col_(ACTIVE_HEADERS, 'Match'), rowCount, 'Match');
  setValidationFromConfig_(active, col_(ACTIVE_HEADERS, 'TouchDown'), rowCount, 'TouchDown');
  setValidationFromConfig_(active, col_(ACTIVE_HEADERS, 'Entrevista'), rowCount, 'Entrevista');
  setValidationFromConfig_(active, col_(ACTIVE_HEADERS, 'Bloqueio Principal'), rowCount, 'Bloqueio Principal');
  setValidationFromConfig_(active, col_(ACTIVE_HEADERS, 'Resultado da Data'), rowCount, 'Resultado da Data');
  setValidationFromList_(active, col_(ACTIVE_HEADERS, 'Reserva'), rowCount, OPTIONS.RESERVE);

  var droppedRowCount = Math.max(1, dropped.getMaxRows() - 1);
  setValidationFromConfig_(dropped, col_(DROPPED_HEADERS, 'Motivo da Queda'), droppedRowCount, 'Motivo da Queda');

  var reservedRowCount = Math.max(1, reserved.getMaxRows() - 1);
  setValidationFromConfig_(reserved, col_(RESERVED_HEADERS, 'Status'), reservedRowCount, 'Status');
  setValidationFromConfig_(reserved, col_(RESERVED_HEADERS, 'Match'), reservedRowCount, 'Match');
  setValidationFromConfig_(reserved, col_(RESERVED_HEADERS, 'TouchDown'), reservedRowCount, 'TouchDown');
  setValidationFromConfig_(reserved, col_(RESERVED_HEADERS, 'Entrevista'), reservedRowCount, 'Entrevista');
  setValidationFromConfig_(reserved, col_(RESERVED_HEADERS, 'Bloqueio Principal'), reservedRowCount, 'Bloqueio Principal');
  setValidationFromList_(reserved, col_(RESERVED_HEADERS, 'Reserva'), reservedRowCount, OPTIONS.RESERVE);
}

function setValidationFromConfig_(targetSheet, targetCol, rowCount, configHeader) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = ss.getSheetByName(SHEETS.CONFIG);
  var configCol = col_(CONFIG_HEADERS, configHeader);
  var maxRows = Math.max(1, config.getMaxRows() - 1);
  var range = config.getRange(2, configCol, maxRows, 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(range, true)
    .setAllowInvalid(false)
    .build();
  targetSheet.getRange(2, targetCol, rowCount, 1).setDataValidation(rule);
}

function setValidationFromList_(targetSheet, targetCol, rowCount, values) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  targetSheet.getRange(2, targetCol, rowCount, 1).setDataValidation(rule);
}

function processarEmailsBatismo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSystemExists_(ss);

  var active = ss.getSheetByName(SHEETS.ACTIVE);
  var dropped = ss.getSheetByName(SHEETS.DROPPED);
  var reserved = ss.getSheetByName(SHEETS.RESERVED);
  var processedIds = getExistingEmailIdsFromSheets_(active, dropped, reserved);
  var label = getOrCreateGmailLabel_(PROCESSED_LABEL_NAME);
  var areaMap = getAreaMap_();
  var threads = GmailApp.search(EMAIL_SEARCH_QUERY, 0, 50);
  var createdCount = 0;

  threads.forEach(function(thread) {
    var createdInThread = false;
    thread.getMessages().forEach(function(message) {
      var emailId = message.getId();
      if (processedIds[emailId]) {
        return;
      }

      var text = message.getSubject() + '\n' + message.getPlainBody();
      var parsed = parseBaptismEmail_(text, areaMap);
      if (!parsed || !parsed.name || !parsed.date) {
        return;
      }

      var now = new Date();
      active.appendRow([
        parsed.name,
        getWeekLabel_(parsed.date),
        'Não',
        'Não',
        'Não',
        '🟡 Mais ou Menos',
        '',
        '',
        parsed.date,
        parsed.area || 'Não identificada',
        parsed.district || 'Configurar',
        '',
        now,
        now,
        'Ativa',
        'Não',
        emailId
      ]);

      processedIds[emailId] = true;
      createdInThread = true;
      createdCount++;
    });

    if (createdInThread) {
      thread.addLabel(label);
    }
  });

  aplicarValidacoes();
  atualizarSemanasEStatusVisual_();
  moverReservadosAutomaticamente_();
  limparRegistrosAntigos_();
  atualizarDashboard();

  notify_(createdCount + ' registro(s) criado(s) a partir do Gmail.');
}

function onEdit(e) {
  if (!e || !e.range) {
    return;
  }

  var sheet = e.range.getSheet();
  if (e.range.getRow() === 1) {
    return;
  }

  if (sheet.getName() === SHEETS.RESERVED) {
    handleReservedEdit_(e);
    return;
  }

  if (sheet.getName() !== SHEETS.ACTIVE) {
    return;
  }

  var editedCol = e.range.getColumn();
  var editedRow = e.range.getRow();
  var watchedCols = [
    col_(ACTIVE_HEADERS, 'Status'),
    col_(ACTIVE_HEADERS, 'Match'),
    col_(ACTIVE_HEADERS, 'TouchDown'),
    col_(ACTIVE_HEADERS, 'Entrevista'),
    col_(ACTIVE_HEADERS, 'Bloqueio Principal'),
    col_(ACTIVE_HEADERS, 'Próxima Ação'),
    col_(ACTIVE_HEADERS, 'Plano Igreja'),
    col_(ACTIVE_HEADERS, 'Reserva'),
    col_(ACTIVE_HEADERS, 'Resultado da Data')
  ];

  if (watchedCols.indexOf(editedCol) === -1) {
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSystemExists_(ss);

  var fieldName = ACTIVE_HEADERS[editedCol - 1];
  var rowValues = sheet.getRange(editedRow, 1, 1, ACTIVE_HEADERS.length).getValues()[0];
  var oldValue = e.oldValue || '';
  var newValue = e.value || rowValues[editedCol - 1] || '';

  sheet.getRange(editedRow, col_(ACTIVE_HEADERS, 'Última Atualização')).setValue(new Date());
  if (fieldName === 'Próxima Ação') {
    sheet.getRange(editedRow, col_(ACTIVE_HEADERS, 'Último Próximo Passo')).setValue(new Date());
  }
  registrarHistorico_(rowValues, fieldName, oldValue, newValue, 'Alteração manual');

  if (fieldName === 'Resultado da Data' && newValue === 'Data Caiu') {
    moverParaDatasCaidas_(sheet, editedRow);
  } else if (fieldName === 'Resultado da Data' && newValue === 'Batizado') {
    sheet.getRange(editedRow, col_(ACTIVE_HEADERS, 'Status')).setValue('⛪ Batizado');
  } else if (fieldName === 'Reserva' && newValue === 'Sim') {
    moverParaReservados_(sheet, editedRow, 'Reserva manual');
  }

  atualizarSemanasEStatusVisual_();
  moverReservadosAutomaticamente_();
  limparRegistrosAntigos_();
  atualizarDashboard();
}

function handleReservedEdit_(e) {
  var sheet = e.range.getSheet();
  var editedCol = e.range.getColumn();
  if (editedCol === col_(RESERVED_HEADERS, 'Próxima Ação')) {
    sheet.getRange(e.range.getRow(), col_(RESERVED_HEADERS, 'Último Próximo Passo')).setValue(new Date());
    return;
  }

  if (editedCol !== col_(RESERVED_HEADERS, 'Reserva')) {
    return;
  }

  var newValue = e.value || '';
  if (newValue === 'Não') {
    moverReservadoParaAtivas_(sheet, e.range.getRow());
    atualizarSemanasEStatusVisual_();
    atualizarDashboard();
  }
}

function moverParaDatasCaidas_(activeSheet, rowNumber) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dropped = ss.getSheetByName(SHEETS.DROPPED);
  var row = activeSheet.getRange(rowNumber, 1, 1, ACTIVE_HEADERS.length).getValues()[0];

  var name = row[col_(ACTIVE_HEADERS, 'Nome') - 1];
  var week = row[col_(ACTIVE_HEADERS, 'Semana') - 1];
  var area = row[col_(ACTIVE_HEADERS, 'Área') - 1];
  var district = row[col_(ACTIVE_HEADERS, 'Distrito') - 1];
  var baptismDate = row[col_(ACTIVE_HEADERS, 'Data Batismal') - 1];
  var block = row[col_(ACTIVE_HEADERS, 'Bloqueio Principal') - 1] || 'Outro';
  var nextAction = row[col_(ACTIVE_HEADERS, 'Próxima Ação') - 1] || '';
  var lastNextAction = row[col_(ACTIVE_HEADERS, 'Último Próximo Passo') - 1] || '';
  var emailId = row[col_(ACTIVE_HEADERS, 'Email ID') - 1] || '';

  dropped.appendRow([
    name,
    week,
    area,
    district,
    baptismDate,
    block,
    nextAction,
    new Date(),
    mapBlockToDropReason_(block),
    lastNextAction,
    emailId
  ]);

  registrarHistorico_(row, 'Resultado da Data', 'Ativa', 'Data Caiu', 'Movido para Datas Caídas');
  activeSheet.deleteRow(rowNumber);
  aplicarValidacoes();
}

function atualizarDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSystemExists_(ss);

  atualizarSemanasEStatusVisual_();
  moverReservadosAutomaticamente_();
  limparRegistrosAntigos_();
  atualizarSemanasEStatusVisual_();

  var dashboard = ss.getSheetByName(SHEETS.DASHBOARD);
  var active = ss.getSheetByName(SHEETS.ACTIVE);
  var dropped = ss.getSheetByName(SHEETS.DROPPED);
  var reserved = ss.getSheetByName(SHEETS.RESERVED);

  dashboard.getRange(1, 1, dashboard.getMaxRows(), dashboard.getMaxColumns()).breakApart();
  dashboard.clear();
  dashboard.setColumnWidths(1, 11, 130);
  dashboard.setColumnWidth(1, 150);
  dashboard.setColumnWidth(2, 170);
  dashboard.setColumnWidth(8, 240);
  dashboard.setColumnWidth(11, 280);

  var row = 1;
  dashboard.getRange(row, 1, 1, 11).merge();
  dashboard.getRange(row, 1)
    .setValue('Dashboard LZ - Próximo Passo das Datas Batismais')
    .setFontSize(16)
    .setFontWeight('bold')
    .setBackground('#1f4e79')
    .setFontColor('#ffffff');

  row++;
  dashboard.getRange(row, 1)
    .setValue('Atualizado em: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'))
    .setFontStyle('italic');
  row += 2;

  var activeRecords = getVisibleActiveRecords_(getSheetRecords_(active, ACTIVE_HEADERS));
  var droppedRecords = getSheetRecords_(dropped, DROPPED_HEADERS);
  var reservedRecords = getSheetRecords_(reserved, RESERVED_HEADERS);
  var districts = getDistricts_();

  districts.forEach(function(district) {
    dashboard.getRange(row, 1, 1, 11).merge();
    dashboard.getRange(row, 1)
      .setValue(district)
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#d9ead3');
    row += 2;

    var districtRecords = activeRecords.filter(function(record) {
      return isAssignedToDistrict_(record, district) &&
        record['Resultado da Data'] !== 'Batizado' &&
        record['Reserva'] !== 'Sim';
    });

    row = appendDistrictTables_(dashboard, row, district, districtRecords);
  });

  row = appendUnassignedSection_(dashboard, row, activeRecords);
  row = appendLzActionSummary_(dashboard, row, activeRecords);
  row = appendReservedSummary_(dashboard, row, reservedRecords);
  row = appendDroppedSummary_(dashboard, row, droppedRecords);
  atualizarAbasLDs_();

  dashboard.autoResizeColumns(1, 11);
}

function appendDashboardSection_(sheet, startRow, title, headers, rows) {
  var row = startRow;
  sheet.getRange(row, 1, 1, Math.max(1, headers.length)).merge();
  sheet.getRange(row, 1)
    .setValue(title)
    .setFontWeight('bold')
    .setBackground('#f4cccc');
  row++;

  sheet.getRange(row, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#eeeeee');
  row++;

  if (rows.length === 0) {
    sheet.getRange(row, 1).setValue('Nenhum registro.');
    row += 2;
    return row;
  }

  sheet.getRange(row, 1, rows.length, headers.length).setValues(rows);
  formatDateColumns_(sheet, row, rows.length, headers);
  row += rows.length + 2;
  return row;
}

function appendDistrictTables_(sheet, startRow, district, records) {
  var row = startRow;
  var areas = getAreasForDistrict_(district);
  var recordsByArea = {};
  records.forEach(function(record) {
    var area = record['Área'] || 'Área não identificada';
    if (!recordsByArea[area]) {
      recordsByArea[area] = [];
    }
    recordsByArea[area].push(record);
  });

  Object.keys(recordsByArea).forEach(function(area) {
    if (areas.indexOf(area) === -1) {
      areas.push(area);
    }
  });

  areas.forEach(function(area) {
    var areaRecords = recordsByArea[area] || [];
    if (areaRecords.length === 0) {
      return;
    }

    areaRecords.sort(sortRecordsForFollowUp_);
    sheet.getRange(row, 1, 1, 11).merge();
    sheet.getRange(row, 1)
      .setValue(area)
      .setFontWeight('bold')
      .setBackground('#d9eaf7');
    row++;

    var headers = ['Área', 'Nome', 'Semana', 'TD', 'Match', 'Entrev.', 'Status', 'Próxima Ação', 'Data Batismal', 'Último Próx. Passo', 'Situação'];
    sheet.getRange(row, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#eeeeee');
    row++;

    var values = areaRecords.map(function(record) {
      var state = getFollowUpState_(record, new Date());
      return [
        record['Área'],
        record['Nome'],
        state.week,
        record['TouchDown'],
        record['Match'],
        record['Entrevista'],
        record['Status'],
        record['Próxima Ação'],
        record['Data Batismal'],
        record['Último Próximo Passo'],
        state.message
      ];
    });

    sheet.getRange(row, 1, values.length, headers.length).setValues(values);
    values.forEach(function(_, index) {
      var state = getFollowUpState_(areaRecords[index], new Date());
      sheet.getRange(row + index, 1, 1, headers.length).setBackground(state.color);
    });
    sheet.getRange(row, 9, values.length, 1).setNumberFormat('dd/MM/yyyy');
    sheet.getRange(row, 10, values.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
    row += values.length + 2;
  });

  return row + 1;
}

function appendUnassignedSection_(sheet, startRow, activeRecords) {
  var records = activeRecords.filter(isUnassignedRecord_);
  if (records.length === 0) {
    return startRow;
  }

  var row = startRow;
  sheet.getRange(row, 1, 1, 11).merge();
  sheet.getRange(row, 1)
    .setValue('⚪ Sem Distrito / Área não identificada')
    .setFontSize(14)
    .setFontWeight('bold')
    .setBackground('#d9d2e9');
  row += 2;

  row = appendDistrictTables_(sheet, row, 'Sem Distrito', records);
  return row;
}

function atualizarAbasLDs() {
  ensureSystemExists_(SpreadsheetApp.getActiveSpreadsheet());
  atualizarAbasLDs_();
  notify_('Abas por distrito atualizadas.');
}

function atualizarAbasLDs_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var active = ss.getSheetByName(SHEETS.ACTIVE);
  if (!active) {
    return;
  }

  var activeRecords = getVisibleActiveRecords_(getSheetRecords_(active, ACTIVE_HEADERS)).filter(function(record) {
    return record['Resultado da Data'] !== 'Batizado' && record['Reserva'] !== 'Sim';
  });
  var districts = getDistricts_();

  districts.forEach(function(district) {
    var sheet = getOrCreateSheet_(ss, sanitizeSheetName_(district));
    var records = activeRecords.filter(function(record) {
      return isAssignedToDistrict_(record, district);
    });
    renderLdDistrictSheet_(sheet, district, records);
  });

  renderLdDistrictSheet_(
    getOrCreateSheet_(ss, sanitizeSheetName_(SHEETS.UNASSIGNED)),
    'Sem Distrito / Área não identificada',
    activeRecords.filter(isUnassignedRecord_)
  );
}

function renderLdDistrictSheet_(sheet, title, records) {
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  sheet.setFrozenRows(3);
  sheet.setColumnWidths(1, 11, 120);
  sheet.setColumnWidth(2, 170);
  sheet.setColumnWidth(8, 240);
  sheet.setColumnWidth(11, 280);

  sheet.getRange(1, 1, 1, 11).merge();
  sheet.getRange(1, 1)
    .setValue(title + ' - acompanhamento do LD')
    .setFontSize(15)
    .setFontWeight('bold')
    .setBackground('#1f4e79')
    .setFontColor('#ffffff');

  sheet.getRange(2, 1, 1, 11).merge();
  sheet.getRange(2, 1)
    .setValue('Mostrando registros dentro da janela de ' + getViewingWindowDays_() + ' dias. Edite a base em "Datas Ativas".')
    .setFontStyle('italic');

  if (records.length === 0) {
    sheet.getRange(4, 1).setValue('Nenhuma pessoa para acompanhar nesta janela.');
    return;
  }

  appendDistrictTables_(sheet, 4, title, records);
}

function appendLzActionSummary_(sheet, startRow, activeRecords) {
  var row = startRow;
  var now = new Date();
  var stale = activeRecords.filter(function(record) {
    return record['Resultado da Data'] !== 'Batizado' &&
      record['Reserva'] !== 'Sim' &&
      isNotAccompanied_(record, now);
  });

  sheet.getRange(row, 1, 1, 11).merge();
  sheet.getRange(row, 1)
    .setValue('🟠 Lista de acompanhamento atrasado - último próximo passo há mais de 24h')
    .setFontWeight('bold')
    .setBackground('#fce5cd');
  row++;

  var headers = ['Distrito', 'Área', 'Nome', 'Semana', 'Próxima Ação', 'Último Próx. Passo', 'Situação'];
  sheet.getRange(row, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#eeeeee');
  row++;

  if (stale.length === 0) {
    sheet.getRange(row, 1).setValue('Nenhuma pessoa atrasada no acompanhamento.');
    return row + 2;
  }

  stale.sort(sortRecordsForFollowUp_);
  var values = stale.map(function(record) {
    var state = getFollowUpState_(record, now);
    return [
      record['Distrito'],
      record['Área'],
      record['Nome'],
      state.week,
      record['Próxima Ação'],
      record['Último Próximo Passo'],
      state.message
    ];
  });
  sheet.getRange(row, 1, values.length, headers.length).setValues(values).setBackground('#fce5cd');
  sheet.getRange(row, 6, values.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  return row + values.length + 2;
}

function appendReservedSummary_(sheet, startRow, reservedRecords) {
  var row = startRow;
  sheet.getRange(row, 1, 1, 11).merge();
  sheet.getRange(row, 1)
    .setValue('🟤 Reservados - só voltam quando Reserva for alterado para Não')
    .setFontWeight('bold')
    .setBackground('#ead1dc');
  row++;

  var headers = ['Distrito', 'Área', 'Nome', 'Semana', 'Próxima Ação', 'Data da Reserva'];
  sheet.getRange(row, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#eeeeee');
  row++;

  if (reservedRecords.length === 0) {
    sheet.getRange(row, 1).setValue('Nenhuma pessoa em reservados.');
    return row + 2;
  }

  var values = reservedRecords.map(function(record) {
    return [
      record['Distrito'],
      record['Área'],
      record['Nome'],
      record['Semana'],
      record['Próxima Ação'],
      record['Data da Reserva']
    ];
  });
  sheet.getRange(row, 1, values.length, headers.length).setValues(values);
  sheet.getRange(row, 6, values.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  return row + values.length + 2;
}

function appendProgressSummary_(sheet, startRow) {
  var row = startRow;
  var summary = getWeeklyProgressSummary_();
  var values = [
    ['Amarelo → Verde', summary.yellowToGreen],
    ['Verde → Coroa', summary.greenToCrown],
    ['Coroa → Batizado', summary.crownToBaptized],
    ['Total de avanços da semana', summary.total]
  ];

  sheet.getRange(row, 1, 1, 2).merge();
  sheet.getRange(row, 1)
    .setValue('📈 Taxa de Progresso')
    .setFontWeight('bold')
    .setBackground('#cfe2f3');
  row++;
  sheet.getRange(row, 1, values.length, 2).setValues(values);
  row += values.length + 2;
  return row;
}

function appendDroppedSummary_(sheet, startRow, droppedRecords) {
  var row = startRow;
  var now = new Date();
  var month = now.getMonth();
  var year = now.getFullYear();
  var monthly = droppedRecords.filter(function(record) {
    var dropDate = asDate_(record['Data da Queda']);
    return dropDate && dropDate.getMonth() === month && dropDate.getFullYear() === year;
  });
  var reasons = {};
  monthly.forEach(function(record) {
    var reason = record['Motivo da Queda'] || record['Motivo'] || 'Outro';
    reasons[reason] = (reasons[reason] || 0) + 1;
  });

  sheet.getRange(row, 1, 1, 3).merge();
  sheet.getRange(row, 1)
    .setValue('📉 Datas Caídas')
    .setFontWeight('bold')
    .setBackground('#ead1dc');
  row++;
  sheet.getRange(row, 1, 1, 2).setValues([['Total de datas caídas no mês', monthly.length]]);
  row += 2;

  sheet.getRange(row, 1, 1, 2).setValues([['Motivo', 'Quantidade']]).setFontWeight('bold').setBackground('#eeeeee');
  row++;

  var rows = Object.keys(reasons)
    .sort(function(a, b) { return reasons[b] - reasons[a]; })
    .map(function(reason) { return [reason, reasons[reason]]; });

  if (rows.length === 0) {
    sheet.getRange(row, 1).setValue('Nenhuma data caída neste mês.');
    return row + 2;
  }

  sheet.getRange(row, 1, rows.length, 2).setValues(rows);
  return row + rows.length + 2;
}

function enviarAlertasLZs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSystemExists_(ss);
  atualizarSemanasEStatusVisual_();

  var active = ss.getSheetByName(SHEETS.ACTIVE);
  var activeRecords = getSheetRecords_(active, ACTIVE_HEADERS).filter(function(record) {
    return record['Resultado da Data'] !== 'Batizado' &&
      record['Reserva'] !== 'Sim' &&
      isNotAccompanied_(record, new Date());
  });
  var emailsByDistrict = getLzEmailsByDistrict_();
  var sentCount = 0;

  getDistricts_().forEach(function(district) {
    var email = emailsByDistrict[district];
    if (!email) {
      return;
    }

    var districtRecords = activeRecords.filter(function(record) {
      return record['Distrito'] === district;
    });
    if (districtRecords.length === 0) {
      return;
    }

    districtRecords.sort(sortRecordsForFollowUp_);
    var lines = districtRecords.map(function(record) {
      var state = getFollowUpState_(record, new Date());
      return [
        '- ',
        record['Nome'],
        ' | Área: ', record['Área'],
        ' | ', state.week,
        ' | Situação: ', state.message,
        ' | Próxima ação: ', record['Próxima Ação'] || 'Sem próxima ação'
      ].join('');
    });

    MailApp.sendEmail({
      to: email,
      subject: 'Acompanhamento atrasado - ' + district,
      body: [
        'Estas datas precisam de um novo próximo passo ou acompanhamento:',
        '',
        lines.join('\n'),
        '',
        'Atualize a coluna "Próxima Ação" na planilha para tirar a pessoa da lista laranja.'
      ].join('\n')
    });
    sentCount++;
  });

  notify_(sentCount + ' alerta(s) enviado(s) aos LZs configurados.');
}

function getWeeklyProgressSummary_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var history = ss.getSheetByName(SHEETS.HISTORY);
  var rows = getSheetRecords_(history, HISTORY_HEADERS);
  var weekStart = getStartOfWeek_(new Date());
  var result = {
    yellowToGreen: 0,
    greenToCrown: 0,
    crownToBaptized: 0,
    total: 0
  };

  rows.forEach(function(record) {
    var when = asDate_(record['Data/Hora']);
    if (!when || when < weekStart) {
      return;
    }

    var field = record['Campo'];
    var oldValue = record['Valor Anterior'];
    var newValue = record['Valor Novo'];

    if (field === 'Status' && oldValue === '🟡 Amarelo' && newValue === '🟢 Verde') {
      result.yellowToGreen++;
    }
    if (field === 'Status' && oldValue === '🟢 Verde' && newValue === '👑 Coroa') {
      result.greenToCrown++;
    }
    if ((field === 'Status' && oldValue === '👑 Coroa' && newValue === '⛪ Batizado') ||
        (field === 'Resultado da Data' && newValue === 'Batizado')) {
      result.crownToBaptized++;
    }
  });

  result.total = result.yellowToGreen + result.greenToCrown + result.crownToBaptized;
  return result;
}

function parseBaptismEmail_(text, areaMap) {
  var clean = normalizeSpaces_(text);
  var dateText = extractDateText_(clean);
  var date = dateText ? parseDateText_(dateText) : null;
  var name = extractInvestigatorName_(clean);
  var areaInfo = identifyArea_(clean, areaMap);

  if (!name || !date) {
    return null;
  }

  return {
    name: titleCase_(name),
    area: areaInfo.area,
    district: areaInfo.district,
    date: date
  };
}

function extractDateText_(text) {
  var patterns = [
    /(?:para\s+(?:o\s+)?dia|no dia|em)\s+([A-Za-zÀ-ÿ]{3,20}\s+\d{1,2},?\s+\d{4})/i,
    /(?:para\s+(?:o\s+)?dia|no dia|em)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match) {
      return match[1];
    }
  }
  return '';
}

function extractInvestigatorName_(text) {
  var patterns = [
    /(?:batismo|data batismal)\s+(?:de|para)\s+(.+?)\s+(?:para\s+(?:o\s+)?dia|no dia|em)\s+/i,
    /(?:agendou|marcou).+?(?:para|de)\s+(.+?)\s+(?:para\s+(?:o\s+)?dia|no dia|em)\s+/i
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match) {
      return cleanupName_(match[1]);
    }
  }
  return '';
}

function identifyArea_(text, areaMap) {
  var normalizedText = normalizeKey_(text);
  var best = null;

  areaMap.forEach(function(item) {
    item.keys.forEach(function(key) {
      if (!key) {
        return;
      }
      var idx = normalizedText.indexOf(key);
      if (idx >= 0 && (!best || key.length > best.key.length)) {
        best = {
          key: key,
          area: item.area,
          district: item.district
        };
      }
    });
  });

  if (best) {
    return {
      area: best.area,
      district: best.district
    };
  }

  var areaGuess = '';
  var match = text.match(/^(.+?)\s+(?:acabou de agendar|agendou|marcou)/i);
  if (match) {
    areaGuess = cleanupName_(match[1]);
  }

  return {
    area: areaGuess || 'Não identificada',
    district: 'Configurar'
  };
}

function parseDateText_(value) {
  if (!value) {
    return null;
  }

  var text = normalizeSpaces_(String(value).replace(',', ''));
  var numeric = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (numeric) {
    var day = Number(numeric[1]);
    var month = Number(numeric[2]) - 1;
    var year = Number(numeric[3]);
    if (year < 100) {
      year += 2000;
    }
    return new Date(year, month, day);
  }

  var parts = text.split(' ');
  if (parts.length >= 3) {
    var monthName = normalizeKey_(parts[0]);
    var monthIndex = monthIndex_(monthName);
    var parsedDay = Number(parts[1]);
    var parsedYear = Number(parts[2]);
    if (monthIndex >= 0 && parsedDay && parsedYear) {
      return new Date(parsedYear, monthIndex, parsedDay);
    }
  }

  return null;
}

function monthIndex_(monthName) {
  var months = {
    jan: 0,
    janeiro: 0,
    january: 0,
    feb: 1,
    fevereiro: 1,
    february: 1,
    mar: 2,
    marco: 2,
    março: 2,
    march: 2,
    apr: 3,
    abril: 3,
    april: 3,
    may: 4,
    maio: 4,
    jun: 5,
    junho: 5,
    june: 5,
    jul: 6,
    julho: 6,
    july: 6,
    aug: 7,
    agosto: 7,
    august: 7,
    sep: 8,
    set: 8,
    setembro: 8,
    september: 8,
    oct: 9,
    out: 9,
    outubro: 9,
    october: 9,
    nov: 10,
    novembro: 10,
    november: 10,
    dec: 11,
    dez: 11,
    dezembro: 11,
    december: 11
  };
  return months[monthName] !== undefined ? months[monthName] : -1;
}

function getAreaMap_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = ss.getSheetByName(SHEETS.CONFIG);
  if (!config) {
    configurarAbaConfig_(ss);
    config = ss.getSheetByName(SHEETS.CONFIG);
  }

  var values = config.getRange(2, 1, Math.max(1, config.getLastRow() - 1), 3).getValues();
  return values
    .filter(function(row) { return row[0] && row[1]; })
    .map(function(row) {
      var aliases = String(row[2] || '').split(',').map(function(alias) {
        return normalizeKey_(alias);
      });
      aliases.push(normalizeKey_(row[0]));
      return {
        area: row[0],
        district: row[1],
        keys: aliases.filter(Boolean)
      };
    });
}

function getDistricts_() {
  var areaMap = getAreaMap_();
  var seen = {};
  var districts = [];
  areaMap.forEach(function(item) {
    if (!seen[item.district]) {
      seen[item.district] = true;
      districts.push(item.district);
    }
  });
  return districts.length ? districts : ['Distrito 1', 'Distrito 2'];
}

function getAreasForDistrict_(district) {
  var areaMap = getAreaMap_();
  return areaMap
    .filter(function(item) { return item.district === district; })
    .map(function(item) { return item.area; });
}

function getVisibleActiveRecords_(records) {
  var windowDays = getViewingWindowDays_();
  var now = new Date();
  var cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - windowDays);

  return records.filter(function(record) {
    var baptismDate = asDate_(record['Data Batismal']);
    var lastNextAction = asDate_(record['Último Próximo Passo']) || asDate_(record['Última Atualização']);

    if (baptismDate && baptismDate >= cutoff) {
      return true;
    }
    if (lastNextAction && lastNextAction >= cutoff) {
      return true;
    }
    return false;
  });
}

function isAssignedToDistrict_(record, district) {
  return !isUnassignedRecord_(record) && record['Distrito'] === district;
}

function isUnassignedRecord_(record) {
  var district = normalizeSpaces_(record['Distrito']);
  var area = normalizeSpaces_(record['Área']);
  if (!district || district === 'Configurar' || district === 'Não identificada') {
    return true;
  }
  if (!area || area === 'Não identificada') {
    return true;
  }
  return getDistricts_().indexOf(district) === -1;
}

function getViewingWindowDays_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = ss.getSheetByName(SHEETS.CONFIG);
  if (!config || config.getLastRow() < 2) {
    return DEFAULT_VIEW_WINDOW_DAYS;
  }

  var settingCol = col_(CONFIG_HEADERS, 'Configuração');
  var valueCol = col_(CONFIG_HEADERS, 'Valor');
  var values = config.getRange(2, 1, config.getLastRow() - 1, CONFIG_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][settingCol - 1] === VIEW_WINDOW_SETTING_NAME) {
      var days = Number(values[i][valueCol - 1]);
      return days > 0 ? days : DEFAULT_VIEW_WINDOW_DAYS;
    }
  }
  return DEFAULT_VIEW_WINDOW_DAYS;
}

function ensureConfigSettings_(sheet) {
  var settingCol = col_(CONFIG_HEADERS, 'Configuração');
  var valueCol = col_(CONFIG_HEADERS, 'Valor');
  var lastRow = Math.max(2, sheet.getLastRow());
  var values = sheet.getRange(2, settingCol, Math.max(1, lastRow - 1), 1).getValues();
  var found = values.some(function(row) {
    return row[0] === VIEW_WINDOW_SETTING_NAME;
  });

  if (!found) {
    var targetRow = sheet.getLastRow() + 1;
    sheet.getRange(targetRow, settingCol).setValue(VIEW_WINDOW_SETTING_NAME);
    sheet.getRange(targetRow, valueCol).setValue(DEFAULT_VIEW_WINDOW_DAYS);
  }
}

function getLzEmailsByDistrict_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = ss.getSheetByName(SHEETS.CONFIG);
  var result = {};
  if (!config || config.getLastRow() < 2) {
    return result;
  }

  var districtCol = col_(CONFIG_HEADERS, 'Distrito');
  var emailCol = col_(CONFIG_HEADERS, 'Email LZ');
  var values = config.getRange(2, 1, config.getLastRow() - 1, CONFIG_HEADERS.length).getValues();
  values.forEach(function(row) {
    var district = row[districtCol - 1];
    var email = row[emailCol - 1];
    if (district && email && !result[district]) {
      result[district] = email;
    }
  });
  return result;
}

function getExistingEmailIds_(sheet) {
  var result = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return result;
  }

  var emailCol = col_(ACTIVE_HEADERS, 'Email ID');
  var values = sheet.getRange(2, emailCol, lastRow - 1, 1).getValues();
  values.forEach(function(row) {
    if (row[0]) {
      result[row[0]] = true;
    }
  });
  return result;
}

function getExistingEmailIdsFromSheets_(activeSheet, droppedSheet, reservedSheet) {
  var result = getExistingEmailIds_(activeSheet);
  addEmailIdsFromSheet_(result, droppedSheet, DROPPED_HEADERS);
  addEmailIdsFromSheet_(result, reservedSheet, RESERVED_HEADERS);
  return result;
}

function addEmailIdsFromSheet_(target, sheet, headers) {
  if (!sheet || sheet.getLastRow() < 2) {
    return;
  }

  var emailCol = col_(headers, 'Email ID');
  var values = sheet.getRange(2, emailCol, sheet.getLastRow() - 1, 1).getValues();
  values.forEach(function(row) {
    if (row[0]) {
      target[row[0]] = true;
    }
  });
}

function registrarHistorico_(activeRowValues, fieldName, oldValue, newValue, note) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var history = ss.getSheetByName(SHEETS.HISTORY);
  if (!history) {
    configurarAbaHistorico_(ss);
    history = ss.getSheetByName(SHEETS.HISTORY);
  }

  history.appendRow([
    new Date(),
    activeRowValues[col_(ACTIVE_HEADERS, 'Nome') - 1],
    activeRowValues[col_(ACTIVE_HEADERS, 'Área') - 1],
    activeRowValues[col_(ACTIVE_HEADERS, 'Distrito') - 1],
    fieldName,
    oldValue,
    newValue,
    note || ''
  ]);
}

function atualizarSemanasEStatusVisual_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var active = ss.getSheetByName(SHEETS.ACTIVE);
  if (!active || active.getLastRow() < 2) {
    return;
  }

  var now = new Date();
  var lastRow = active.getLastRow();
  var values = active.getRange(2, 1, lastRow - 1, ACTIVE_HEADERS.length).getValues();

  values.forEach(function(row, index) {
    var rowNumber = index + 2;
    var record = rowToRecord_(row, ACTIVE_HEADERS);
    var state = getFollowUpState_(record, now);
    active.getRange(rowNumber, col_(ACTIVE_HEADERS, 'Semana')).setValue(state.week);
    active.getRange(rowNumber, 1, 1, ACTIVE_HEADERS.length).setBackground(state.color);
  });
}

function moverReservadosAutomaticamente_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var active = ss.getSheetByName(SHEETS.ACTIVE);
  if (!active || active.getLastRow() < 2) {
    return;
  }

  for (var row = active.getLastRow(); row >= 2; row--) {
    var values = active.getRange(row, 1, 1, ACTIVE_HEADERS.length).getValues()[0];
    var record = rowToRecord_(values, ACTIVE_HEADERS);
    if (record['Resultado da Data'] === 'Batizado' || record['Reserva'] === 'Sim') {
      continue;
    }
    if (isReservedCandidate_(record, new Date())) {
      moverParaReservados_(active, row, 'Sem novo próximo passo há 3 dias');
    }
  }
}

function moverParaReservados_(activeSheet, rowNumber, reason) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reserved = ss.getSheetByName(SHEETS.RESERVED);
  var row = activeSheet.getRange(rowNumber, 1, 1, ACTIVE_HEADERS.length).getValues()[0];
  var record = rowToRecord_(row, ACTIVE_HEADERS);

  reserved.appendRow([
    record['Nome'],
    record['Semana'],
    record['TouchDown'],
    record['Match'],
    record['Entrevista'],
    record['Status'] === 'Reservado' ? record['Status'] : 'Reservado',
    record['Próxima Ação'],
    record['Plano Igreja'],
    record['Data Batismal'],
    record['Área'],
    record['Distrito'],
    record['Bloqueio Principal'],
    record['Último Próximo Passo'],
    new Date(),
    'Sim',
    record['Email ID']
  ]);

  registrarHistorico_(row, 'Reserva', record['Reserva'] || 'Não', 'Sim', reason || 'Movido para Reservados');
  activeSheet.deleteRow(rowNumber);
  aplicarValidacoes();
}

function moverReservadoParaAtivas_(reservedSheet, rowNumber) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var active = ss.getSheetByName(SHEETS.ACTIVE);
  var row = reservedSheet.getRange(rowNumber, 1, 1, RESERVED_HEADERS.length).getValues()[0];
  var record = rowToRecord_(row, RESERVED_HEADERS);
  var now = new Date();

  active.appendRow([
    record['Nome'],
    getWeekLabel_(record['Data Batismal']),
    record['TouchDown'],
    record['Match'],
    record['Entrevista'],
    record['Status'] === 'Reservado' ? '🟡 Mais ou Menos' : record['Status'],
    record['Próxima Ação'],
    record['Plano Igreja'],
    record['Data Batismal'],
    record['Área'],
    record['Distrito'],
    record['Bloqueio Principal'],
    now,
    now,
    'Ativa',
    'Não',
    record['Email ID']
  ]);

  registrarHistorico_(recordToActiveRow_(record), 'Reserva', 'Sim', 'Não', 'Retirado manualmente dos Reservados');
  reservedSheet.deleteRow(rowNumber);
  aplicarValidacoes();
}

function limparRegistrosAntigos_() {
  limparRegistrosAntigosDaAba_(SHEETS.ACTIVE, ACTIVE_HEADERS, 'Data Batismal', 'Último Próximo Passo', true);
  limparRegistrosAntigosDaAba_(SHEETS.DROPPED, DROPPED_HEADERS, 'Data da Queda', 'Último Próximo Passo', false);
}

function limparRegistrosAntigosDaAba_(sheetName, headers, ageDateHeader, lastNextActionHeader, keepFutureDate) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return;
  }

  for (var row = sheet.getLastRow(); row >= 2; row--) {
    var values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
    var record = rowToRecord_(values, headers);
    if (shouldKeepVisibleRecord_(record, ageDateHeader, lastNextActionHeader, new Date(), keepFutureDate)) {
      continue;
    }
    registrarHistorico_(recordToActiveRow_(record), 'Reset', '', sheetName, 'Removido da tabela visível por estar fora da janela configurada sem data futura ou próximo passo recente');
    sheet.deleteRow(row);
  }
}

function shouldKeepVisibleRecord_(record, ageDateHeader, lastNextActionHeader, now, keepFutureDate) {
  var ageDate = asDate_(record[ageDateHeader]);
  var lastNextAction = asDate_(record[lastNextActionHeader]);
  var windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - getViewingWindowDays_());
  var oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  if (keepFutureDate && ageDate && ageDate >= getStartOfDay_(now)) {
    return true;
  }
  if (lastNextAction && lastNextAction >= oneWeekAgo) {
    return true;
  }

  return !ageDate || ageDate >= windowStart;
}

function getFollowUpState_(record, now) {
  var week = getWeekLabel_(record['Data Batismal'], now);
  var missing = getMissingPriorities_(record, week, now);
  var color = '#ffffff';
  var message = 'Normal';

  if (week === 'Semana 3' && record['Entrevista'] !== 'Sim') {
    return {
      week: week,
      color: '#f4cccc',
      severity: 3,
      message: 'Semana do batismo sem entrevista batismal'
    };
  }

  if (isNotAccompanied_(record, now)) {
    return {
      week: week,
      color: '#fce5cd',
      severity: 2,
      message: 'Sem novo próximo passo há mais de 24h'
    };
  }

  if (missing.length >= 2) {
    color = '#f4cccc';
    message = 'Faltam prioridades: ' + missing.join(', ');
  } else if (missing.length === 1) {
    color = '#fff2cc';
    message = 'Falta: ' + missing[0];
  } else if (isThursdayOrLater_(now)) {
    color = '#d9ead3';
    message = 'Tudo em dia para esta semana';
  }

  return {
    week: week,
    color: color,
    severity: missing.length >= 2 ? 3 : missing.length,
    message: message
  };
}

function getMissingPriorities_(record, week) {
  if (week === 'Semana 1') {
    return [
      hasText_(record['Plano Igreja']) ? '' : 'Plano para igreja',
      asDate_(record['Data Batismal']) ? '' : 'Data batismal'
    ].filter(Boolean);
  }

  if (week === 'Semana 2') {
    return [
      record['Match'] === 'Sim' ? '' : 'Match',
      hasText_(record['Próxima Ação']) ? '' : 'Próxima ação'
    ].filter(Boolean);
  }

  return [
    record['Entrevista'] === 'Sim' ? '' : 'Entrevista batismal',
    asDate_(record['Data Batismal']) ? '' : 'Data batismal'
  ].filter(Boolean);
}

function isNotAccompanied_(record, now) {
  var lastNextAction = asDate_(record['Último Próximo Passo']);
  if (!hasText_(record['Próxima Ação']) || !lastNextAction) {
    return true;
  }
  var cutoff = new Date(now);
  cutoff.setHours(cutoff.getHours() - 24);
  return lastNextAction < cutoff;
}

function isReservedCandidate_(record, now) {
  var lastNextAction = asDate_(record['Último Próximo Passo']) ||
    asDate_(record['Última Atualização']) ||
    asDate_(record['Data Batismal']);
  if (!lastNextAction) {
    return false;
  }
  var cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 3);
  return lastNextAction < cutoff;
}

function sortRecordsForFollowUp_(a, b) {
  var stateA = getFollowUpState_(a, new Date());
  var stateB = getFollowUpState_(b, new Date());
  if (stateB.severity !== stateA.severity) {
    return stateB.severity - stateA.severity;
  }
  return String(a['Nome'] || '').localeCompare(String(b['Nome'] || ''));
}

function isThisWeekWithoutTouchdown_(record) {
  var date = asDate_(record['Data Batismal']);
  if (!date) {
    return false;
  }
  var start = getStartOfWeek_(new Date());
  var end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end && record['TouchDown'] !== 'Sim';
}

function isStale_(record) {
  var updated = asDate_(record['Última Atualização']);
  if (!updated) {
    return true;
  }
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return updated < cutoff;
}

function getStartOfWeek_(date) {
  var result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var day = result.getDay();
  var diff = (day + 6) % 7;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getWeekLabel_(date, referenceDate) {
  var baptismDate = asDate_(date);
  if (!baptismDate) {
    return 'Semana 1';
  }

  var startToday = getStartOfWeek_(referenceDate || new Date());
  var startBaptism = getStartOfWeek_(baptismDate);
  var diffDays = Math.round((startBaptism.getTime() - startToday.getTime()) / 86400000);
  var weeksUntilBaptism = Math.floor(diffDays / 7);

  if (weeksUntilBaptism <= 0) {
    return 'Semana 3';
  }
  if (weeksUntilBaptism === 1) {
    return 'Semana 2';
  }
  return 'Semana 1';
}

function getStartOfDay_(date) {
  var result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setHours(0, 0, 0, 0);
  return result;
}

function isThursdayOrLater_(date) {
  var day = date.getDay();
  return day === 0 || day >= 4;
}

function hasText_(value) {
  return normalizeSpaces_(value).length > 0;
}

function rowToRecord_(row, headers) {
  var record = {};
  headers.forEach(function(header, index) {
    record[header] = row[index];
  });
  return record;
}

function recordToActiveRow_(record) {
  return ACTIVE_HEADERS.map(function(header) {
    return record[header] || '';
  });
}

function getSheetRecords_(sheet, headers) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values
    .filter(function(row) {
      return row.some(function(cell) { return cell !== '' && cell !== null; });
    })
    .map(function(row) {
      var record = {};
      headers.forEach(function(header, index) {
        record[header] = row[index];
      });
      return record;
    });
}

function formatDateColumns_(sheet, startRow, numRows, headers) {
  headers.forEach(function(header, index) {
    if (header.indexOf('Data') >= 0 || header.indexOf('Atualização') >= 0) {
      sheet.getRange(startRow, index + 1, numRows, 1).setNumberFormat(header === 'Última Atualização' ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy');
    }
  });
}

function mapBlockToDropReason_(block) {
  var map = {
    'Não foi à Igreja': 'Não foi à igreja',
    'Sem Match': 'Sem Match',
    'Trabalho': 'Problema de trabalho',
    'Família': 'Problema familiar',
    'Palavra de Sabedoria': 'Palavra de Sabedoria',
    'Lei da Castidade': 'Lei da Castidade',
    'Sem contato': 'Não conseguimos contato'
  };
  return map[block] || 'Outro';
}

function getOrCreateGmailLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function ensureSystemExists_(ss) {
  if (!ss.getSheetByName(SHEETS.ACTIVE)) {
    configurarAbaAtivas_(ss);
  }
  if (!ss.getSheetByName(SHEETS.DROPPED)) {
    configurarAbaCaidas_(ss);
  }
  if (!ss.getSheetByName(SHEETS.CONFIG)) {
    configurarAbaConfig_(ss);
  }
  if (!ss.getSheetByName(SHEETS.RESERVED)) {
    configurarAbaReservados_(ss);
  }
  if (!ss.getSheetByName(SHEETS.HISTORY)) {
    configurarAbaHistorico_(ss);
  }
  if (!ss.getSheetByName(SHEETS.DASHBOARD)) {
    configurarAbaDashboard_(ss);
  }
}

function migrarCabecalhos_(sheet, targetHeaders, defaultValueFn) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) {
    return;
  }

  var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var sameHeaders = targetHeaders.every(function(header, index) {
    return existingHeaders[index] === header;
  });
  if (sameHeaders && existingHeaders.length === targetHeaders.length) {
    return;
  }

  var oldIndex = {};
  existingHeaders.forEach(function(header, index) {
    if (header) {
      oldIndex[header] = index;
    }
  });
  var hasKnownHeader = Object.keys(oldIndex).some(function(header) {
    return targetHeaders.indexOf(header) !== -1;
  });
  if (!hasKnownHeader || sheet.getLastRow() < 2) {
    return;
  }

  var oldValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var migrated = oldValues.map(function(row) {
    var existingRecord = {};
    Object.keys(oldIndex).forEach(function(header) {
      existingRecord[header] = row[oldIndex[header]];
    });
    return targetHeaders.map(function(header) {
      if (oldIndex[header] !== undefined) {
        return existingRecord[header];
      }
      return defaultValueFn ? defaultValueFn(header, existingRecord) : '';
    });
  });

  sheet.clear();
  if (migrated.length > 0) {
    sheet.getRange(2, 1, migrated.length, targetHeaders.length).setValues(migrated);
  }
}

function defaultActiveValue_(header, record) {
  var now = new Date();
  if (header === 'Semana') {
    return getWeekLabel_(record['Data Batismal'], now);
  }
  if (header === 'Status') {
    return mapOldStatus_(record['Status']);
  }
  if (header === 'Plano Igreja') {
    return '';
  }
  if (header === 'Último Próximo Passo') {
    return record['Última Atualização'] || now;
  }
  if (header === 'Reserva') {
    return 'Não';
  }
  return '';
}

function defaultDroppedValue_(header, record) {
  if (header === 'Semana') {
    return getWeekLabel_(record['Data Batismal Original'], new Date());
  }
  if (header === 'Último Próximo Passo') {
    return record['Data da Queda'] || '';
  }
  return '';
}

function defaultReservedValue_(header, record) {
  if (header === 'Reserva') {
    return 'Sim';
  }
  if (header === 'Data da Reserva') {
    return new Date();
  }
  return defaultActiveValue_(header, record);
}

function mapOldStatus_(status) {
  var map = {
    '🟡 Amarelo': '🟡 Mais ou Menos',
    '🟢 Verde': '📅 Data firme',
    '👑 Coroa': '📅 Data firme',
    '📅 Data Batismal': '📅 Data firme',
    '⚠️ Sem Progresso': '🔴 Risco'
  };
  return map[status] || status || '🟡 Mais ou Menos';
}

function normalizarStatusSheet_(sheet, headers) {
  if (sheet.getLastRow() < 2 || headers.indexOf('Status') === -1) {
    return;
  }

  var statusCol = col_(headers, 'Status');
  var values = sheet.getRange(2, statusCol, sheet.getLastRow() - 1, 1).getValues();
  var changed = false;
  var normalized = values.map(function(row) {
    var mapped = mapOldStatus_(row[0]);
    if (mapped !== row[0]) {
      changed = true;
    }
    return [mapped];
  });

  if (changed) {
    sheet.getRange(2, statusCol, normalized.length, 1).setValues(normalized);
  }
}

function setupHeader_(sheet, headers, background, fontColor) {
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground(background)
    .setFontColor(fontColor);
}

function notify_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    Logger.log(message);
  }
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function sanitizeSheetName_(name) {
  var clean = normalizeSpaces_(name).replace(/[\[\]\:\*\?\/\\]/g, '-');
  return clean.substring(0, 99) || 'Aba';
}

function col_(headers, header) {
  var index = headers.indexOf(header);
  if (index === -1) {
    throw new Error('Coluna não encontrada: ' + header);
  }
  return index + 1;
}

function asDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }
  if (!value) {
    return null;
  }
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSpaces_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeKey_(value) {
  return normalizeSpaces_(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function cleanupName_(value) {
  return normalizeSpaces_(value)
    .replace(/^o\s+/i, '')
    .replace(/^a\s+/i, '')
    .replace(/[.,;:]+$/g, '');
}

function titleCase_(value) {
  var lowerWords = {
    da: true,
    de: true,
    do: true,
    das: true,
    dos: true,
    e: true
  };
  return cleanupName_(value).split(' ').map(function(part, index) {
    var key = normalizeKey_(part);
    if (index > 0 && lowerWords[key]) {
      return key;
    }
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join(' ');
}

function instalarGatilhos() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === 'processarEmailsBatismo' || handler === 'atualizarDashboard' || handler === 'enviarAlertasLZs') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('processarEmailsBatismo')
    .timeBased()
    .everyHours(1)
    .create();

  ScriptApp.newTrigger('atualizarDashboard')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  ScriptApp.newTrigger('enviarAlertasLZs')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
}
