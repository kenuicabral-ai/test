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
  HISTORY: '_Histórico'
};

var ACTIVE_HEADERS = [
  'Nome',
  'Área',
  'Distrito',
  'Data Batismal',
  'Semana',
  'Status',
  'Match',
  'TouchDown',
  'Entrevista',
  'Bloqueio Principal',
  'Próxima Ação',
  'Última Atualização',
  'Resultado da Data',
  'Email ID'
];

var DROPPED_HEADERS = [
  'Nome',
  'Área',
  'Distrito',
  'Data Batismal Original',
  'Motivo',
  'Observação',
  'Data da Queda',
  'Motivo da Queda',
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
  'Status',
  'Match',
  'TouchDown',
  'Entrevista',
  'Bloqueio Principal',
  'Resultado da Data',
  'Motivo da Queda'
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
  STATUS: ['🟡 Amarelo', '🟢 Verde', '👑 Coroa', '📅 Data Batismal', '⛪ Batizado', '⚠️ Sem Progresso'],
  YES_NO: ['Sim', 'Não'],
  INTERVIEW: ['Sim', 'Não', 'Não Aplicável'],
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

// Busca os avisos oficiais de batismo marcado enviados pelo sistema da Igreja.
var EMAIL_SEARCH_QUERY = 'newer_than:90d from:noreply-missionary-info@mail.churchofjesuschrist.org subject:"Batismo marcado" -label:' + PROCESSED_LABEL_NAME;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Batismos')
    .addItem('Configurar sistema completo', 'setupSistemaBatismos')
    .addSeparator()
    .addItem('Ler emails agora', 'processarEmailsBatismo')
    .addItem('Atualizar Dashboard', 'atualizarDashboard')
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
  configurarAbaHistorico_(ss);
  configurarAbaDashboard_(ss);

  aplicarValidacoes();
  atualizarDashboard();
  instalarGatilhos();

  notify_('Sistema configurado. As abas, validações, dashboard e gatilhos foram criados.');
}

function configurarAbaAtivas_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.ACTIVE);
  setupHeader_(sheet, ACTIVE_HEADERS, '#1f4e79', '#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, ACTIVE_HEADERS.length, 145);
  sheet.setColumnWidth(col_(ACTIVE_HEADERS, 'Próxima Ação'), 240);
  sheet.setColumnWidth(col_(ACTIVE_HEADERS, 'Email ID'), 180);
  sheet.hideColumns(col_(ACTIVE_HEADERS, 'Email ID'));
  sheet.getRange(2, col_(ACTIVE_HEADERS, 'Data Batismal'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(2, col_(ACTIVE_HEADERS, 'Última Atualização'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
}

function configurarAbaCaidas_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.DROPPED);
  setupHeader_(sheet, DROPPED_HEADERS, '#7f1d1d', '#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, DROPPED_HEADERS.length, 155);
  sheet.setColumnWidth(col_(DROPPED_HEADERS, 'Observação'), 280);
  sheet.setColumnWidth(col_(DROPPED_HEADERS, 'Email ID'), 180);
  sheet.hideColumns(col_(DROPPED_HEADERS, 'Email ID'));
  sheet.getRange(2, col_(DROPPED_HEADERS, 'Data Batismal Original'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(2, col_(DROPPED_HEADERS, 'Data da Queda'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
}

function configurarAbaConfig_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.CONFIG);
  var hasExistingConfig = sheet.getLastRow() > 1;
  setupHeader_(sheet, CONFIG_HEADERS, '#38761d', '#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, CONFIG_HEADERS.length, 180);

  if (hasExistingConfig) {
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
      OPTIONS.STATUS[i] || '',
      OPTIONS.YES_NO[i] || '',
      OPTIONS.YES_NO[i] || '',
      OPTIONS.INTERVIEW[i] || '',
      OPTIONS.BLOCKS[i] || '',
      OPTIONS.RESULT[i] || '',
      OPTIONS.DROP_REASONS[i] || ''
    ]);
  }
  sheet.getRange(2, 1, values.length, CONFIG_HEADERS.length).setValues(values);
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
  var config = ss.getSheetByName(SHEETS.CONFIG);

  if (!active || !dropped || !config) {
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

  var droppedRowCount = Math.max(1, dropped.getMaxRows() - 1);
  setValidationFromConfig_(dropped, col_(DROPPED_HEADERS, 'Motivo da Queda'), droppedRowCount, 'Motivo da Queda');
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

function processarEmailsBatismo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSystemExists_(ss);

  var active = ss.getSheetByName(SHEETS.ACTIVE);
  var dropped = ss.getSheetByName(SHEETS.DROPPED);
  var processedIds = getExistingEmailIdsFromSheets_(active, dropped);
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
        parsed.area || 'Não identificada',
        parsed.district || 'Configurar',
        parsed.date,
        getWeekLabel_(parsed.date),
        '🟡 Amarelo',
        'Não',
        'Não',
        'Não',
        '',
        '',
        now,
        'Ativa',
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
  atualizarDashboard();

  notify_(createdCount + ' registro(s) criado(s) a partir do Gmail.');
}

function onEdit(e) {
  if (!e || !e.range) {
    return;
  }

  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEETS.ACTIVE || e.range.getRow() === 1) {
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
  registrarHistorico_(rowValues, fieldName, oldValue, newValue, 'Alteração manual');

  if (fieldName === 'Resultado da Data' && newValue === 'Data Caiu') {
    moverParaDatasCaidas_(sheet, editedRow);
  } else if (fieldName === 'Resultado da Data' && newValue === 'Batizado') {
    sheet.getRange(editedRow, col_(ACTIVE_HEADERS, 'Status')).setValue('⛪ Batizado');
  }

  atualizarDashboard();
}

function moverParaDatasCaidas_(activeSheet, rowNumber) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dropped = ss.getSheetByName(SHEETS.DROPPED);
  var row = activeSheet.getRange(rowNumber, 1, 1, ACTIVE_HEADERS.length).getValues()[0];

  var name = row[col_(ACTIVE_HEADERS, 'Nome') - 1];
  var area = row[col_(ACTIVE_HEADERS, 'Área') - 1];
  var district = row[col_(ACTIVE_HEADERS, 'Distrito') - 1];
  var baptismDate = row[col_(ACTIVE_HEADERS, 'Data Batismal') - 1];
  var block = row[col_(ACTIVE_HEADERS, 'Bloqueio Principal') - 1] || 'Outro';
  var nextAction = row[col_(ACTIVE_HEADERS, 'Próxima Ação') - 1] || '';
  var emailId = row[col_(ACTIVE_HEADERS, 'Email ID') - 1] || '';

  dropped.appendRow([
    name,
    area,
    district,
    baptismDate,
    block,
    nextAction,
    new Date(),
    mapBlockToDropReason_(block),
    emailId
  ]);

  registrarHistorico_(row, 'Resultado da Data', 'Ativa', 'Data Caiu', 'Movido para Datas Caídas');
  activeSheet.deleteRow(rowNumber);
  aplicarValidacoes();
}

function atualizarDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSystemExists_(ss);

  var dashboard = ss.getSheetByName(SHEETS.DASHBOARD);
  var active = ss.getSheetByName(SHEETS.ACTIVE);
  var dropped = ss.getSheetByName(SHEETS.DROPPED);

  dashboard.getRange(1, 1, dashboard.getMaxRows(), dashboard.getMaxColumns()).breakApart();
  dashboard.clear();
  dashboard.setColumnWidths(1, 8, 170);

  var row = 1;
  dashboard.getRange(row, 1, 1, 6).merge();
  dashboard.getRange(row, 1)
    .setValue('Dashboard LZ - Sistema de Datas Batismais')
    .setFontSize(16)
    .setFontWeight('bold')
    .setBackground('#1f4e79')
    .setFontColor('#ffffff');

  row++;
  dashboard.getRange(row, 1)
    .setValue('Atualizado em: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'))
    .setFontStyle('italic');
  row += 2;

  var activeRecords = getSheetRecords_(active, ACTIVE_HEADERS);
  var droppedRecords = getSheetRecords_(dropped, DROPPED_HEADERS);
  var districts = getDistricts_();

  districts.forEach(function(district) {
    dashboard.getRange(row, 1, 1, 6).merge();
    dashboard.getRange(row, 1)
      .setValue(district)
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#d9ead3');
    row += 2;

    var districtRecords = activeRecords.filter(function(record) {
      return record['Distrito'] === district && record['Resultado da Data'] !== 'Batizado';
    });

    row = appendDashboardSection_(
      dashboard,
      row,
      '🔴 Batismos esta semana sem TouchDown',
      ['Nome', 'Área', 'Distrito', 'Data Batismal'],
      districtRecords.filter(isThisWeekWithoutTouchdown_).map(function(record) {
        return [record['Nome'], record['Área'], record['Distrito'], record['Data Batismal']];
      })
    );

    row = appendDashboardSection_(
      dashboard,
      row,
      '🔴 Verdes sem Match',
      ['Nome', 'Área', 'Distrito'],
      districtRecords.filter(function(record) {
        return record['Status'] === '🟢 Verde' && record['Match'] !== 'Sim';
      }).map(function(record) {
        return [record['Nome'], record['Área'], record['Distrito']];
      })
    );

    row = appendDashboardSection_(
      dashboard,
      row,
      '🔴 Coroas sem Entrevista',
      ['Nome', 'Área', 'Distrito', 'Data Batismal'],
      districtRecords.filter(function(record) {
        return record['Status'] === '👑 Coroa' && record['Entrevista'] !== 'Sim';
      }).map(function(record) {
        return [record['Nome'], record['Área'], record['Distrito'], record['Data Batismal']];
      })
    );

    row = appendDashboardSection_(
      dashboard,
      row,
      '🔴 Sem atualização há mais de 7 dias',
      ['Nome', 'Área', 'Distrito', 'Última Atualização'],
      districtRecords.filter(isStale_).map(function(record) {
        return [record['Nome'], record['Área'], record['Distrito'], record['Última Atualização']];
      })
    );

    row += 1;
  });

  row = appendProgressSummary_(dashboard, row);
  row = appendDroppedSummary_(dashboard, row, droppedRecords);

  dashboard.autoResizeColumns(1, 6);
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

function getExistingEmailIdsFromSheets_(activeSheet, droppedSheet) {
  var result = getExistingEmailIds_(activeSheet);
  if (!droppedSheet || droppedSheet.getLastRow() < 2) {
    return result;
  }

  var emailCol = col_(DROPPED_HEADERS, 'Email ID');
  var values = droppedSheet.getRange(2, emailCol, droppedSheet.getLastRow() - 1, 1).getValues();
  values.forEach(function(row) {
    if (row[0]) {
      result[row[0]] = true;
    }
  });
  return result;
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

function getWeekLabel_(date) {
  var start = getStartOfWeek_(date);
  return 'Semana de ' + Utilities.formatDate(start, Session.getScriptTimeZone(), 'dd/MM/yyyy');
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
  if (!ss.getSheetByName(SHEETS.HISTORY)) {
    configurarAbaHistorico_(ss);
  }
  if (!ss.getSheetByName(SHEETS.DASHBOARD)) {
    configurarAbaDashboard_(ss);
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
    if (handler === 'processarEmailsBatismo' || handler === 'atualizarDashboard') {
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
}
