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
  HISTORY: '_Histórico',
  PENDING_EMAILS: 'Emails Pendentes',
  ERRORS: 'Erros'
};

var ACTIVE_HEADERS = [
  'Nome',
  'Semana',
  'TouchDown',
  'Match',
  'Entrevista',
  'Status',
  'Observação',
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
  'Observação',
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

var PENDING_EMAIL_HEADERS = [
  'Data/Hora',
  'Message ID',
  'Assunto',
  'Motivo',
  'Trecho'
];

var ERROR_HEADERS = [
  'Data/Hora',
  'Função',
  'Descrição',
  'Usuário'
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
var RESERVE_DAYS_SETTING_NAME = 'Dias para Reservado';
var STALE_HOURS_SETTING_NAME = 'Horas sem Atualização';
var ALERT_HOUR_SETTING_NAME = 'Hora do Email';
var DEFAULT_RESERVE_DAYS = 3;
var DEFAULT_STALE_HOURS = 24;
var DEFAULT_ALERT_HOUR = 20;
var EMAIL_LOOKBACK_DAYS = 21;

// Busca os avisos oficiais de batismo marcado enviados pelo sistema da Igreja.
var EMAIL_SEARCH_QUERY = 'newer_than:' + EMAIL_LOOKBACK_DAYS + 'd from:noreply-missionary-info@mail.churchofjesuschrist.org subject:"Batismo marcado" -label:' + PROCESSED_LABEL_NAME;
var EMAIL_BASE_SEARCH_QUERY = 'newer_than:' + EMAIL_LOOKBACK_DAYS + 'd from:noreply-missionary-info@mail.churchofjesuschrist.org subject:"Batismo marcado"';

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui
    .createMenu('Mission Progress')
    .addItem('Rodar Sistema', 'RODAR_TUDO')
    .addItem('Atualizar Agora', 'CONTINUAR')
    .addSubMenu(ui.createMenu('Configurações')
      .addItem('Começar do zero', 'COMECE_AQUI')
      .addItem('Criar distrito', 'criarDistrito')
      .addItem('Renomear distrito', 'renomearDistrito')
      .addItem('Excluir distrito', 'excluirDistrito')
      .addSeparator()
      .addItem('Adicionar área', 'adicionarArea')
      .addItem('Vincular área a distrito', 'VINCULAR_AREA_A_DISTRITO')
      .addItem('Editar área', 'editarArea')
      .addItem('Excluir área', 'excluirArea')
      .addSeparator()
      .addItem('Aplicar janela de 3 semanas', 'APLICAR_JANELA_3_SEMANAS')
      .addItem('Definir janela de visualização', 'definirJanelaVisualizacao'))
    .addItem('Reprocessar Emails', 'RESETAR_E_REPROCESSAR_TUDO')
    .addItem('Diagnóstico', 'diagnosticarEmailsBatismo')
    .addItem('Ajuda', 'AJUDA')
    .addToUi();
}

function COMECE_AQUI() {
  runSafely_('COMECE_AQUI', function() {
    LIMPAR_TUDO_E_RECOMECAR_MANUAL();
  });
}

function CONTINUAR() {
  runSafely_('CONTINUAR', function() {
    RODAR_TUDO();
  });
}

function RODAR_TUDO() {
  runSafely_('RODAR_TUDO', function() {
    executarRotinaCompleta_({
      resetarEmails: false,
      instalarGatilhos: true,
      mostrarAlerta: true
    });
  });
}

function RESETAR_E_REPROCESSAR_TUDO() {
  runSafely_('RESETAR_E_REPROCESSAR_TUDO', function() {
    executarRotinaCompleta_({
      resetarEmails: true,
      instalarGatilhos: true,
      mostrarAlerta: true
    });
  });
}

function AJUDA() {
  notify_([
    'Mission Progress Manager',
    '',
    'Use apenas estas opções no dia a dia:',
    '',
    '1. Rodar Sistema',
    '   Lê emails, atualiza base, regras, dashboards e gatilhos.',
    '',
    '2. Atualizar Agora',
    '   Mesma rotina normal, sem limpar dados.',
    '',
    '3. Configurações',
    '   Crie distritos, vincule áreas e ajuste a janela visível.',
    '',
    '4. Reprocessar Emails',
    '   Use quando limpou registros e quer puxar os emails das últimas 3 semanas novamente.',
    '',
    'Se algo der erro, veja a aba "Erros". Emails não interpretados vão para "Emails Pendentes".'
  ].join('\n'));
}

function LIMPAR_TUDO_E_RECOMECAR_MANUAL() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    'Limpar tudo e recomeçar manual',
    'Isso apaga registros das abas Datas Ativas, Datas Caídas, Reservados e Histórico, remove áreas/distritos da Config e reseta marcadores de email. Depois você criará distritos e áreas manualmente. Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) {
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  configurarSistemaBase_(ss);
  clearGeneratedLdSheets_();
  clearSheetData_(SHEETS.ACTIVE);
  clearSheetData_(SHEETS.DROPPED);
  clearSheetData_(SHEETS.RESERVED);
  clearSheetData_(SHEETS.HISTORY);
  clearConfigMappings_();
  setConfigSetting_(VIEW_WINDOW_SETTING_NAME, DEFAULT_VIEW_WINDOW_DAYS);
  var resetCount = resetarEmailsProcessados_(false);
  aplicarValidacoes();
  atualizarDashboard();

  notify_([
    'Tudo limpo para recomeçar manualmente.',
    '',
    'Agora use:',
    'Batismos > Configurações > Criar distrito',
    'Batismos > Configurações > Vincular área a distrito',
    '',
    'Janela de visualização: ' + DEFAULT_VIEW_WINDOW_DAYS + ' dias.',
    'Marcadores de email resetados: ' + resetCount,
    '',
    'Depois rode RODAR_TUDO para puxar só os emails das últimas 3 semanas.'
  ].join('\n'));
}

function APLICAR_JANELA_3_SEMANAS() {
  setConfigSetting_(VIEW_WINDOW_SETTING_NAME, DEFAULT_VIEW_WINDOW_DAYS);
  limparRegistrosAntigos_();
  atualizarDashboard();
  notify_('Janela de visualização definida para ' + DEFAULT_VIEW_WINDOW_DAYS + ' dias. Datas antigas foram removidas das telas principais.');
}

function setupSistemaBatismos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  configurarSistemaBase_(ss);
  atualizarDashboard();
  instalarGatilhos();

  notify_('Sistema configurado. As abas, validações, dashboard e gatilhos foram criados.');
}

function executarRotinaCompleta_(options) {
  options = options || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var resetCount = 0;

    configurarSistemaBase_(ss);

    if (options.resetarEmails) {
      resetCount = resetarEmailsProcessados_(false);
    }

    var createdCount = processarEmailsBatismoComBusca_(EMAIL_SEARCH_QUERY, false, true);

    aplicarValidacoes();
    atualizarSemanasEStatusVisual_();
    moverReservadosAutomaticamente_();
    limparRegistrosAntigos_();
    atualizarDashboard();

    if (options.instalarGatilhos) {
      instalarGatilhos();
    }

    if (options.mostrarAlerta) {
      notify_([
        'Rotina completa finalizada.',
        '',
        'Emails criados na planilha: ' + createdCount,
        options.resetarEmails ? 'Marcadores de email resetados: ' + resetCount : '',
        '',
        'Dashboard, abas dos LDs, validações e gatilhos foram atualizados.'
      ].filter(Boolean).join('\n'));
    }
  } finally {
    lock.releaseLock();
  }
}

function configurarSistemaBase_(ss) {
  configurarAbaAtivas_(ss);
  configurarAbaCaidas_(ss);
  configurarAbaConfig_(ss);
  configurarAbaReservados_(ss);
  configurarAbaHistorico_(ss);
  configurarAbaEmailsPendentes_(ss);
  configurarAbaErros_(ss);
  configurarAbaDashboard_(ss);

  aplicarValidacoes();
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
  sheet.setColumnWidth(col_(ACTIVE_HEADERS, 'Observação'), 240);
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
  sheet.setFrozenColumns(1);
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
  sheet.setColumnWidth(col_(RESERVED_HEADERS, 'Observação'), 240);
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

function configurarAbaEmailsPendentes_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.PENDING_EMAILS);
  setupHeader_(sheet, PENDING_EMAIL_HEADERS, '#b45f06', '#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, PENDING_EMAIL_HEADERS.length, 180);
  sheet.setColumnWidth(col_(PENDING_EMAIL_HEADERS, 'Trecho'), 420);
  sheet.getRange(2, col_(PENDING_EMAIL_HEADERS, 'Data/Hora'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
}

function configurarAbaErros_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.ERRORS);
  setupHeader_(sheet, ERROR_HEADERS, '#990000', '#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, ERROR_HEADERS.length, 220);
  sheet.setColumnWidth(col_(ERROR_HEADERS, 'Descrição'), 520);
  sheet.getRange(2, col_(ERROR_HEADERS, 'Data/Hora'), Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
}

function configurarAbaDashboard_(ss) {
  var sheet = getOrCreateSheet_(ss, SHEETS.DASHBOARD);
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);
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
  processarEmailsBatismoComBusca_(EMAIL_SEARCH_QUERY, true, false);
}

function reprocessarEmailsBatismo() {
  var resetCount = resetarEmailsProcessados_(false);
  processarEmailsBatismoComBusca_(EMAIL_SEARCH_QUERY, true, false);
  Logger.log('Marcadores removidos antes do reprocessamento: ' + resetCount);
}

function resetarEmailsProcessados() {
  resetarEmailsProcessados_(true);
}

function resetarEmailsProcessados_(showAlert) {
  var label = GmailApp.getUserLabelByName(PROCESSED_LABEL_NAME);
  if (!label) {
    if (showAlert) {
      notify_('Nenhum marcador "' + PROCESSED_LABEL_NAME + '" encontrado. Nada para resetar.');
    }
    return 0;
  }

  var total = 0;
  var threads;
  do {
    threads = label.getThreads(0, 100);
    if (threads.length > 0) {
      label.removeFromThreads(threads);
      total += threads.length;
    }
  } while (threads.length === 100);

  if (showAlert) {
    notify_(total + ' conversa(s) tiveram o marcador "' + PROCESSED_LABEL_NAME + '" removido. Agora rode "Ler emails agora".');
  }
  return total;
}

function diagnosticarEmailsBatismo() {
  var allThreads = GmailApp.search(EMAIL_BASE_SEARCH_QUERY, 0, 10);
  var pendingThreads = GmailApp.search(EMAIL_SEARCH_QUERY, 0, 10);
  var label = GmailApp.getUserLabelByName(PROCESSED_LABEL_NAME);
  var processedCount = label ? label.getThreads(0, 500).length : 0;
  var message = [
    'Diagnóstico de emails:',
    '',
    'Busca usada:',
    EMAIL_BASE_SEARCH_QUERY,
    '',
    'Encontrados na busca geral (amostra até 10): ' + allThreads.length,
    'Pendentes sem marcador processado (amostra até 10): ' + pendingThreads.length,
    'Conversas com marcador "' + PROCESSED_LABEL_NAME + '" (até 500): ' + processedCount,
    '',
    pendingThreads.length === 0 && processedCount > 0
      ? 'Provável causa: os emails já estão marcados como processados. Use "Reprocessar Emails" no menu Mission Progress.'
      : 'Se não aparecerem emails, confira se o remetente/assunto batem com a busca acima.'
  ].join('\n');
  notify_(message);
}

function processarEmailsBatismoComBusca_(searchQuery, showAlert, skipRefresh) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSystemExists_(ss);

  var active = ss.getSheetByName(SHEETS.ACTIVE);
  var dropped = ss.getSheetByName(SHEETS.DROPPED);
  var reserved = ss.getSheetByName(SHEETS.RESERVED);
  var processedIds = getExistingEmailIdsFromSheets_(active, dropped, reserved);
  var label = getOrCreateGmailLabel_(PROCESSED_LABEL_NAME);
  var areaMap = getAreaMap_();
  var threads = GmailApp.search(searchQuery, 0, 50);
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
        registrarEmailPendente_(message, 'Não foi possível extrair nome ou data batismal.');
        return;
      }
      if (!shouldImportBaptismDate_(parsed.date)) {
        processedIds[emailId] = true;
        createdInThread = true;
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

  if (!skipRefresh) {
    aplicarValidacoes();
    atualizarSemanasEStatusVisual_();
    moverReservadosAutomaticamente_();
    limparRegistrosAntigos_();
    atualizarDashboard();
  }

  if (showAlert) {
    notify_(createdCount + ' registro(s) criado(s) a partir do Gmail.');
  }
  return createdCount;
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
    col_(ACTIVE_HEADERS, 'Observação'),
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
  var observation = row[col_(ACTIVE_HEADERS, 'Observação') - 1] || '';
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
    observation || nextAction,
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

  dashboard.setFrozenRows(0);
  dashboard.setFrozenColumns(0);
  dashboard.getRange(1, 1, dashboard.getMaxRows(), dashboard.getMaxColumns()).breakApart();
  dashboard.clear();
  dashboard.setFrozenRows(2);
  dashboard.setFrozenColumns(1);
  dashboard.setColumnWidths(1, 11, 130);
  dashboard.setColumnWidth(1, 170);
  dashboard.setColumnWidth(7, 240);
  dashboard.setColumnWidth(8, 240);
  dashboard.setColumnWidth(11, 280);

  var row = 1;
  setSectionTitle_(dashboard, row, 11, 'Dashboard LZ - Próximo Passo das Datas Batismais', '#1f4e79', '#ffffff', 16);

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
    setSectionTitle_(dashboard, row, 11, district, '#d9ead3', null, 14);
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

function setSectionTitle_(sheet, row, colCount, title, background, fontColor, fontSize) {
  var range = sheet.getRange(row, 1, 1, colCount);
  range.clearContent();
  range
    .setBackground(background || '#eeeeee')
    .setFontWeight('bold');

  if (fontColor) {
    range.setFontColor(fontColor);
  }
  if (fontSize) {
    range.setFontSize(fontSize);
  }

  sheet.getRange(row, 1).setValue(title);
}

function appendDashboardSection_(sheet, startRow, title, headers, rows) {
  var row = startRow;
  setSectionTitle_(sheet, row, Math.max(1, headers.length), title, '#f4cccc');
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
  var weekOrder = ['Semana 1', 'Semana 2', 'Semana 3'];
  var hasAnyRecord = false;

  weekOrder.forEach(function(week) {
    var weekRecords = records.filter(function(record) {
      return getFollowUpState_(record, new Date()).week === week;
    });

    if (weekRecords.length === 0) {
      return;
    }

    hasAnyRecord = true;
    setSectionTitle_(sheet, row, 11, week, '#cfe2f3');
    row++;

    var areas = getAreasForDistrict_(district);
    var recordsByArea = {};
    weekRecords.forEach(function(record) {
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
      setSectionTitle_(sheet, row, 11, area, '#d9eaf7');
      row++;

      var headers = ['Nome', 'Semana', 'TD', 'Match', 'Entrev.', 'Status', 'Observação', 'Próxima Ação', 'Data Batismal', 'Último Próx. Passo', 'Situação'];
      sheet.getRange(row, 1, 1, headers.length)
        .setValues([headers])
        .setFontWeight('bold')
        .setBackground('#eeeeee');
      row++;

      var values = areaRecords.map(function(record) {
        var state = getFollowUpState_(record, new Date());
        return [
          record['Nome'],
          state.week,
          record['TouchDown'],
          record['Match'],
          record['Entrevista'],
          record['Status'],
          record['Observação'],
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
  });

  return hasAnyRecord ? row + 1 : row;
}

function appendUnassignedSection_(sheet, startRow, activeRecords) {
  var records = activeRecords.filter(isUnassignedRecord_);
  if (records.length === 0) {
    return startRow;
  }

  var row = startRow;
  setSectionTitle_(sheet, row, 11, '⚪ Sem Distrito / Área não identificada', '#d9d2e9', null, 14);
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
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  sheet.setFrozenRows(3);
  sheet.setFrozenColumns(1);
  sheet.setColumnWidths(1, 11, 120);
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(7, 240);
  sheet.setColumnWidth(8, 240);
  sheet.setColumnWidth(11, 280);

  setSectionTitle_(sheet, 1, 11, title + ' - acompanhamento do LD', '#1f4e79', '#ffffff', 15);

  sheet.getRange(2, 1, 1, 11).clearContent();
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

  setSectionTitle_(sheet, row, 11, '🟠 Lista de acompanhamento atrasado - último próximo passo há mais de 24h', '#fce5cd');
  row++;

  var headers = ['Nome', 'Semana', 'Status', 'Observação', 'Próxima Ação', 'Distrito', 'Área', 'Último Próx. Passo', 'Situação'];
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
      record['Nome'],
      state.week,
      record['Status'],
      record['Observação'],
      record['Próxima Ação'],
      record['Distrito'],
      record['Área'],
      record['Último Próximo Passo'],
      state.message
    ];
  });
  sheet.getRange(row, 1, values.length, headers.length).setValues(values).setBackground('#fce5cd');
  sheet.getRange(row, 8, values.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  return row + values.length + 2;
}

function appendReservedSummary_(sheet, startRow, reservedRecords) {
  var row = startRow;
  setSectionTitle_(sheet, row, 11, '🟤 Reservados - só voltam quando Reserva for alterado para Não', '#ead1dc');
  row++;

  var headers = ['Nome', 'Semana', 'Status', 'Observação', 'Próxima Ação', 'Distrito', 'Área', 'Data da Reserva'];
  sheet.getRange(row, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#eeeeee');
  row++;

  if (reservedRecords.length === 0) {
    sheet.getRange(row, 1).setValue('Nenhuma pessoa em reservados.');
    return row + 2;
  }

  var values = reservedRecords.map(function(record) {
    return [
      record['Nome'],
      record['Semana'],
      record['Status'],
      record['Observação'],
      record['Próxima Ação'],
      record['Distrito'],
      record['Área'],
      record['Data da Reserva']
    ];
  });
  sheet.getRange(row, 1, values.length, headers.length).setValues(values);
  sheet.getRange(row, 8, values.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
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

  setSectionTitle_(sheet, row, 2, '📈 Taxa de Progresso', '#cfe2f3');
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

  setSectionTitle_(sheet, row, 3, '📉 Datas Caídas', '#ead1dc');
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
        ' | Observação: ', record['Observação'] || 'Sem observação',
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = ss.getSheetByName(SHEETS.CONFIG);
  var seen = {};
  var districts = [];

  if (config && config.getLastRow() >= 2) {
    var districtCol = col_(CONFIG_HEADERS, 'Distrito');
    var values = config.getRange(2, districtCol, config.getLastRow() - 1, 1).getValues();
    values.forEach(function(row) {
      var district = normalizeSpaces_(row[0]);
      if (district && !seen[district]) {
        seen[district] = true;
        districts.push(district);
      }
    });
    return districts;
  }

  if (districts.length === 0) {
    getAreaMap_().forEach(function(item) {
      if (!seen[item.district]) {
        seen[item.district] = true;
        districts.push(item.district);
      }
    });
  }

  return districts.length ? districts : ['Distrito 1', 'Distrito 2'];
}

function criarDistrito() {
  var ui = SpreadsheetApp.getUi();
  var district = promptText_(ui, 'Criar distrito', 'Nome do novo distrito:');
  if (!district) {
    return;
  }
  var email = promptText_(ui, 'Criar distrito', 'Email do LZ para este distrito (opcional):', true) || '';
  var config = getConfigSheet_();
  config.appendRow(configRow_('', district, '', email));
  atualizarDepoisDeConfig_('Distrito criado: ' + district);
}

function renomearDistrito() {
  var ui = SpreadsheetApp.getUi();
  var oldDistrict = promptText_(ui, 'Renomear distrito', 'Nome atual do distrito:');
  if (!oldDistrict) {
    return;
  }
  var newDistrict = promptText_(ui, 'Renomear distrito', 'Novo nome do distrito:');
  if (!newDistrict) {
    return;
  }

  var changedConfig = updateConfigDistrict_(oldDistrict, newDistrict);
  var changedRecords = updateValueInSheets_(
    [SHEETS.ACTIVE, SHEETS.RESERVED, SHEETS.DROPPED],
    ['Distrito'],
    oldDistrict,
    newDistrict
  );
  deleteGeneratedSheet_(oldDistrict);
  atualizarDepoisDeConfig_('Distrito renomeado. Config: ' + changedConfig + ' linha(s). Registros: ' + changedRecords + ' linha(s).');
}

function excluirDistrito() {
  var ui = SpreadsheetApp.getUi();
  var district = promptText_(ui, 'Excluir distrito', 'Nome do distrito que deseja excluir:');
  if (!district) {
    return;
  }
  var response = ui.alert(
    'Excluir distrito',
    'Isso remove o distrito da Config e move registros desse distrito para "Configurar", sem apagar pessoas. Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) {
    return;
  }

  var removed = deleteConfigRows_(function(record) {
    return normalizeSpaces_(record['Distrito']) === district;
  });
  var changedRecords = updateValueInSheets_(
    [SHEETS.ACTIVE, SHEETS.RESERVED, SHEETS.DROPPED],
    ['Distrito'],
    district,
    'Configurar'
  );
  deleteGeneratedSheet_(district);
  atualizarDepoisDeConfig_('Distrito excluído. Config: ' + removed + ' linha(s). Registros movidos para Configurar: ' + changedRecords + '.');
}

function adicionarArea() {
  var ui = SpreadsheetApp.getUi();
  var area = promptText_(ui, 'Adicionar área', 'Nome da área:');
  if (!area) {
    return;
  }
  var district = promptText_(ui, 'Adicionar área', 'Distrito desta área:');
  if (!district) {
    return;
  }
  var aliases = promptText_(ui, 'Adicionar área', 'Aliases da área separados por vírgula (opcional):', true) || '';
  var email = getEmailForDistrict_(district);
  getConfigSheet_().appendRow(configRow_(area, district, aliases, email));
  atualizarDepoisDeConfig_('Área adicionada: ' + area + ' em ' + district);
}

function VINCULAR_AREA_A_DISTRITO() {
  var ui = SpreadsheetApp.getUi();
  var area = promptText_(ui, 'Vincular área a distrito', 'Nome exato da área:');
  if (!area) {
    return;
  }
  var district = promptText_(ui, 'Vincular área a distrito', 'Nome do distrito dessa área:');
  if (!district) {
    return;
  }
  var aliases = promptText_(ui, 'Vincular área a distrito', 'Aliases separados por vírgula (opcional):', true) || area;

  var existing = getAreaConfigRecord_(area);
  var changedConfig;
  if (existing) {
    changedConfig = updateAreaConfig_(area, area, district, aliases);
  } else {
    getConfigSheet_().appendRow(configRow_(area, district, aliases, getEmailForDistrict_(district)));
    changedConfig = 1;
  }

  var changedRecords = updateDistrictForArea_(area, district);
  atualizarDepoisDeConfig_(
    'Área vinculada.\nÁrea: ' + area +
    '\nDistrito: ' + district +
    '\nConfig atualizada: ' + changedConfig +
    '\nRegistros corrigidos: ' + changedRecords
  );
}

function editarArea() {
  var ui = SpreadsheetApp.getUi();
  var oldArea = promptText_(ui, 'Editar área', 'Nome atual da área:');
  if (!oldArea) {
    return;
  }
  var existing = getAreaConfigRecord_(oldArea);
  var newArea = promptText_(ui, 'Editar área', 'Novo nome da área:', true) || oldArea;
  var newDistrict = promptText_(ui, 'Editar área', 'Distrito da área:', true) || (existing ? existing.district : '');
  if (!newDistrict) {
    notify_('Edição cancelada: distrito vazio.');
    return;
  }
  var newAliases = promptText_(ui, 'Editar área', 'Aliases separados por vírgula:', true);
  if (newAliases === null && existing) {
    newAliases = existing.aliases;
  }

  var changedConfig = updateAreaConfig_(oldArea, newArea, newDistrict, newAliases || '');
  var changedAreaRecords = updateValueInSheets_(
    [SHEETS.ACTIVE, SHEETS.RESERVED, SHEETS.DROPPED],
    ['Área'],
    oldArea,
    newArea
  );
  var changedDistrictRecords = updateDistrictForArea_(newArea, newDistrict);
  atualizarDepoisDeConfig_('Área editada. Config: ' + changedConfig + '. Área em registros: ' + changedAreaRecords + '. Distrito em registros: ' + changedDistrictRecords + '.');
}

function excluirArea() {
  var ui = SpreadsheetApp.getUi();
  var area = promptText_(ui, 'Excluir área', 'Nome da área que deseja excluir:');
  if (!area) {
    return;
  }
  var response = ui.alert(
    'Excluir área',
    'Isso remove a área da Config e move registros dessa área para "Não identificada / Configurar", sem apagar pessoas. Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) {
    return;
  }

  var removed = deleteConfigRows_(function(record) {
    return normalizeSpaces_(record['Área']) === area;
  });
  var changedArea = updateValueInSheets_(
    [SHEETS.ACTIVE, SHEETS.RESERVED, SHEETS.DROPPED],
    ['Área'],
    area,
    'Não identificada'
  );
  var changedDistrict = updateDistrictForArea_('Não identificada', 'Configurar');
  atualizarDepoisDeConfig_('Área excluída. Config: ' + removed + '. Registros atualizados: ' + (changedArea + changedDistrict) + '.');
}

function definirJanelaVisualizacao() {
  var ui = SpreadsheetApp.getUi();
  var daysText = promptText_(ui, 'Janela de visualização', 'Quantos dias deseja mostrar nas telas principais?', true);
  if (!daysText) {
    return;
  }
  var days = Number(daysText);
  if (!days || days <= 0) {
    notify_('Informe um número maior que zero.');
    return;
  }
  setConfigSetting_(VIEW_WINDOW_SETTING_NAME, days);
  atualizarDepoisDeConfig_('Janela de visualização definida para ' + days + ' dias.');
}

function atualizarDepoisDeConfig_(message) {
  aplicarValidacoes();
  atualizarDashboard();
  notify_(message);
}

function getConfigSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = ss.getSheetByName(SHEETS.CONFIG);
  if (!config) {
    configurarAbaConfig_(ss);
    config = ss.getSheetByName(SHEETS.CONFIG);
  }
  ensureConfigSettings_(config);
  return config;
}

function configRow_(area, district, aliases, email) {
  return CONFIG_HEADERS.map(function(header) {
    if (header === 'Área') return area || '';
    if (header === 'Distrito') return district || '';
    if (header === 'Aliases da Área') return aliases || '';
    if (header === 'Email LZ') return email || '';
    return '';
  });
}

function promptText_(ui, title, message, allowEmpty) {
  var response = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) {
    return null;
  }
  var value = normalizeSpaces_(response.getResponseText());
  if (!allowEmpty && !value) {
    notify_('Valor vazio. Ação cancelada.');
    return null;
  }
  return value;
}

function getAreaConfigRecord_(area) {
  var config = getConfigSheet_();
  if (config.getLastRow() < 2) {
    return null;
  }
  var rows = config.getRange(2, 1, config.getLastRow() - 1, CONFIG_HEADERS.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    var record = rowToRecord_(rows[i], CONFIG_HEADERS);
    if (normalizeSpaces_(record['Área']) === area) {
      return {
        row: i + 2,
        area: record['Área'],
        district: record['Distrito'],
        aliases: record['Aliases da Área'],
        email: record['Email LZ']
      };
    }
  }
  return null;
}

function getEmailForDistrict_(district) {
  var emails = getLzEmailsByDistrict_();
  return emails[district] || '';
}

function updateConfigDistrict_(oldDistrict, newDistrict) {
  var config = getConfigSheet_();
  if (config.getLastRow() < 2) {
    return 0;
  }
  var districtCol = col_(CONFIG_HEADERS, 'Distrito');
  var values = config.getRange(2, districtCol, config.getLastRow() - 1, 1).getValues();
  var changed = 0;
  values.forEach(function(row, index) {
    if (normalizeSpaces_(row[0]) === oldDistrict) {
      values[index][0] = newDistrict;
      changed++;
    }
  });
  if (changed) {
    config.getRange(2, districtCol, values.length, 1).setValues(values);
  }
  return changed;
}

function updateAreaConfig_(oldArea, newArea, newDistrict, aliases) {
  var config = getConfigSheet_();
  if (config.getLastRow() < 2) {
    return 0;
  }
  var rows = config.getRange(2, 1, config.getLastRow() - 1, CONFIG_HEADERS.length).getValues();
  var changed = 0;
  rows.forEach(function(row, index) {
    var record = rowToRecord_(row, CONFIG_HEADERS);
    if (normalizeSpaces_(record['Área']) === oldArea) {
      rows[index][col_(CONFIG_HEADERS, 'Área') - 1] = newArea;
      rows[index][col_(CONFIG_HEADERS, 'Distrito') - 1] = newDistrict;
      rows[index][col_(CONFIG_HEADERS, 'Aliases da Área') - 1] = aliases;
      changed++;
    }
  });
  if (changed) {
    config.getRange(2, 1, rows.length, CONFIG_HEADERS.length).setValues(rows);
  }
  return changed;
}

function deleteConfigRows_(predicate) {
  var config = getConfigSheet_();
  var removed = 0;
  for (var row = config.getLastRow(); row >= 2; row--) {
    var values = config.getRange(row, 1, 1, CONFIG_HEADERS.length).getValues()[0];
    var record = rowToRecord_(values, CONFIG_HEADERS);
    if (predicate(record)) {
      config.deleteRow(row);
      removed++;
    }
  }
  ensureConfigSettings_(config);
  return removed;
}

function updateValueInSheets_(sheetNames, headersToTry, oldValue, newValue) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var changed = 0;
  sheetNames.forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) {
      return;
    }
    var headers = getHeadersForSheetName_(sheetName);
    headersToTry.forEach(function(header) {
      if (headers.indexOf(header) === -1) {
        return;
      }
      var targetCol = col_(headers, header);
      var values = sheet.getRange(2, targetCol, sheet.getLastRow() - 1, 1).getValues();
      var localChanged = false;
      values.forEach(function(row, index) {
        if (normalizeSpaces_(row[0]) === oldValue) {
          values[index][0] = newValue;
          changed++;
          localChanged = true;
        }
      });
      if (localChanged) {
        sheet.getRange(2, targetCol, values.length, 1).setValues(values);
      }
    });
  });
  return changed;
}

function updateDistrictForArea_(area, district) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var changed = 0;
  [SHEETS.ACTIVE, SHEETS.RESERVED, SHEETS.DROPPED].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) {
      return;
    }
    var headers = getHeadersForSheetName_(sheetName);
    if (headers.indexOf('Área') === -1 || headers.indexOf('Distrito') === -1) {
      return;
    }
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
    var localChanged = false;
    rows.forEach(function(row, index) {
      if (normalizeSpaces_(row[col_(headers, 'Área') - 1]) === area) {
        rows[index][col_(headers, 'Distrito') - 1] = district;
        changed++;
        localChanged = true;
      }
    });
    if (localChanged) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
  });
  return changed;
}

function deleteGeneratedSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sanitizeSheetName_(name));
  if (sheet && [SHEETS.ACTIVE, SHEETS.DASHBOARD, SHEETS.CONFIG, SHEETS.DROPPED, SHEETS.RESERVED, SHEETS.HISTORY].indexOf(sheet.getName()) === -1) {
    ss.deleteSheet(sheet);
  }
}

function getHeadersForSheetName_(sheetName) {
  if (sheetName === SHEETS.ACTIVE) return ACTIVE_HEADERS;
  if (sheetName === SHEETS.DROPPED) return DROPPED_HEADERS;
  if (sheetName === SHEETS.RESERVED) return RESERVED_HEADERS;
  if (sheetName === SHEETS.CONFIG) return CONFIG_HEADERS;
  return ACTIVE_HEADERS;
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

function shouldImportBaptismDate_(date) {
  var baptismDate = asDate_(date);
  if (!baptismDate) {
    return false;
  }
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - getViewingWindowDays_());
  cutoff = getStartOfDay_(cutoff);
  return baptismDate >= cutoff;
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
  return getConfigNumber_(VIEW_WINDOW_SETTING_NAME, DEFAULT_VIEW_WINDOW_DAYS);
}

function getReserveDays_() {
  return getConfigNumber_(RESERVE_DAYS_SETTING_NAME, DEFAULT_RESERVE_DAYS);
}

function getStaleHours_() {
  return getConfigNumber_(STALE_HOURS_SETTING_NAME, DEFAULT_STALE_HOURS);
}

function getAlertHour_() {
  return getConfigNumber_(ALERT_HOUR_SETTING_NAME, DEFAULT_ALERT_HOUR);
}

function getConfigNumber_(settingName, defaultValue) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = ss.getSheetByName(SHEETS.CONFIG);
  if (!config || config.getLastRow() < 2) {
    return defaultValue;
  }

  var settingCol = col_(CONFIG_HEADERS, 'Configuração');
  var valueCol = col_(CONFIG_HEADERS, 'Valor');
  var values = config.getRange(2, 1, config.getLastRow() - 1, CONFIG_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][settingCol - 1] === settingName) {
      var value = Number(values[i][valueCol - 1]);
      return value > 0 ? value : defaultValue;
    }
  }
  return defaultValue;
}

function ensureConfigSettings_(sheet) {
  ensureConfigSetting_(sheet, VIEW_WINDOW_SETTING_NAME, DEFAULT_VIEW_WINDOW_DAYS);
  ensureConfigSetting_(sheet, RESERVE_DAYS_SETTING_NAME, DEFAULT_RESERVE_DAYS);
  ensureConfigSetting_(sheet, STALE_HOURS_SETTING_NAME, DEFAULT_STALE_HOURS);
  ensureConfigSetting_(sheet, ALERT_HOUR_SETTING_NAME, DEFAULT_ALERT_HOUR);
}

function ensureConfigSetting_(sheet, settingName, defaultValue) {
  var settingCol = col_(CONFIG_HEADERS, 'Configuração');
  var valueCol = col_(CONFIG_HEADERS, 'Valor');
  var lastRow = Math.max(2, sheet.getLastRow());
  var values = sheet.getRange(2, settingCol, Math.max(1, lastRow - 1), 1).getValues();
  var found = values.some(function(row) {
    return row[0] === settingName;
  });

  if (!found) {
    var targetRow = sheet.getLastRow() + 1;
    sheet.getRange(targetRow, settingCol).setValue(settingName);
    sheet.getRange(targetRow, valueCol).setValue(defaultValue);
  }
}

function setConfigSetting_(settingName, value) {
  var config = getConfigSheet_();
  var settingCol = col_(CONFIG_HEADERS, 'Configuração');
  var valueCol = col_(CONFIG_HEADERS, 'Valor');
  var lastRow = Math.max(2, config.getLastRow());
  var values = config.getRange(2, settingCol, Math.max(1, lastRow - 1), 1).getValues();

  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === settingName) {
      config.getRange(i + 2, valueCol).setValue(value);
      return;
    }
  }

  var targetRow = config.getLastRow() + 1;
  config.getRange(targetRow, settingCol).setValue(settingName);
  config.getRange(targetRow, valueCol).setValue(value);
}

function clearSheetData_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return;
  }
  sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent().clearFormat();
}

function clearConfigMappings_() {
  var config = getConfigSheet_();
  var lastRow = config.getLastRow();
  if (lastRow < 2) {
    return;
  }

  // Limpa apenas Área, Distrito, Aliases e Email LZ. As listas de dropdown continuam.
  config.getRange(2, col_(CONFIG_HEADERS, 'Área'), lastRow - 1, 1).clearContent();
  config.getRange(2, col_(CONFIG_HEADERS, 'Distrito'), lastRow - 1, 1).clearContent();
  config.getRange(2, col_(CONFIG_HEADERS, 'Aliases da Área'), lastRow - 1, 1).clearContent();
  config.getRange(2, col_(CONFIG_HEADERS, 'Email LZ'), lastRow - 1, 1).clearContent();
}

function clearGeneratedLdSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var protectedNames = {};
  [SHEETS.DASHBOARD, SHEETS.ACTIVE, SHEETS.DROPPED, SHEETS.CONFIG, SHEETS.RESERVED, SHEETS.UNASSIGNED, SHEETS.HISTORY].forEach(function(name) {
    protectedNames[name] = true;
  });

  getDistricts_().forEach(function(district) {
    var sheet = ss.getSheetByName(sanitizeSheetName_(district));
    if (sheet && !protectedNames[sheet.getName()]) {
      ss.deleteSheet(sheet);
    }
  });

  var unassigned = ss.getSheetByName(SHEETS.UNASSIGNED);
  if (unassigned) {
    unassigned.clear();
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
    record['Observação'],
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
    record['Observação'],
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
  cutoff.setHours(cutoff.getHours() - getStaleHours_());
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
  cutoff.setDate(cutoff.getDate() - getReserveDays_());
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

function registrarEmailPendente_(message, reason) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEETS.PENDING_EMAILS)) {
    configurarAbaEmailsPendentes_(ss);
  }
  var sheet = ss.getSheetByName(SHEETS.PENDING_EMAILS);
  var body = normalizeSpaces_(message.getPlainBody()).substring(0, 500);
  sheet.appendRow([
    new Date(),
    message.getId(),
    message.getSubject(),
    reason,
    body
  ]);
}

function runSafely_(functionName, callback) {
  try {
    return callback();
  } catch (error) {
    logError_(functionName, error);
    notify_('Erro em ' + functionName + ':\n' + error.message + '\n\nVeja a aba "Erros" para detalhes.');
    throw error;
  }
}

function logError_(functionName, error) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss.getSheetByName(SHEETS.ERRORS)) {
      configurarAbaErros_(ss);
    }
    var sheet = ss.getSheetByName(SHEETS.ERRORS);
    var userEmail = '';
    try {
      userEmail = Session.getActiveUser().getEmail();
    } catch (ignored) {
      userEmail = '';
    }
    sheet.appendRow([
      new Date(),
      functionName,
      error && error.stack ? error.stack : String(error),
      userEmail
    ]);
  } catch (loggingError) {
    Logger.log('Falha ao registrar erro: ' + loggingError);
  }
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
  if (!ss.getSheetByName(SHEETS.PENDING_EMAILS)) {
    configurarAbaEmailsPendentes_(ss);
  }
  if (!ss.getSheetByName(SHEETS.ERRORS)) {
    configurarAbaErros_(ss);
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
    .atHour(getAlertHour_())
    .create();
}
