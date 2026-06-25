/**
 * Main.gs
 * ----------------------------------------------------------------------------
 * Ponto de entrada do app.
 *
 *  - setup()        : cria/configura TODAS as abas, proteções e gatilhos.
 *                     Rode UMA vez (e novamente se quiser reconstruir).
 *  - onEdit(e)      : roteador de TODA a interação (mobile, sem menus/diálogos).
 *  - onOpen()       : atualiza a Home ao abrir.
 *  - seedExemplo()  : popula dados de demonstração.
 *
 * O onEdit é um GATILHO SIMPLES — funciona no app do Sheets no celular. Ele
 * nunca faz trabalho pesado de e-mail (isso é enfileirado e enviado por um
 * gatilho de tempo). Ver Email.gs.
 * ----------------------------------------------------------------------------
 */

/* ============================ SETUP ============================ */

/** Cria e configura todo o sistema. Idempotente. */
function setup() {
  buildAllSheets_();
  buildBaseSheet_();
  buildHiddenSheets_();
  buildConfigSheet_();
  invalidateConfigCache();
  applyMobileWidths_();
  recomputeAllStatuses();
  rebuildAll();
  applyProtections_();
  installTriggers_();
  setState(STATE.LAST_SETUP, now());
  toast('Setup concluído ✓', APP.NAME, 5);
}

/** Reconstrói apenas as telas (Home, Registro, Dashboards). */
function rebuildAll() {
  renderHome();
  renderRegistro();
  refreshDashboards();
}

/** Cria todas as abas e organiza visíveis/ocultas. */
function buildAllSheets_() {
  VISIBLE_SHEETS.forEach(function (n) { ensureSheet(n).showSheet(); });
  HIDDEN_SHEETS.forEach(function (n) { ensureSheet(n); });

  // Ordena as visíveis e oculta as de infraestrutura.
  VISIBLE_SHEETS.forEach(function (n, i) {
    var sh = getSheet(n);
    ss().setActiveSheet(sh);
    ss().moveActiveSheet(i + 1);
  });
  HIDDEN_SHEETS.forEach(function (n) { getSheet(n).hideSheet(); });

  // Remove abas padrão vazias deixadas pelo Google.
  ['Sheet1', 'Página1', 'Pagina1', 'Folha1'].forEach(function (n) {
    var sh = ss().getSheetByName(n);
    if (sh && ss().getSheets().length > 1) {
      try { ss().deleteSheet(sh); } catch (_) {}
    }
  });

  ss().setActiveSheet(getSheet(SHEETS.HOME));
}

/** Cabeçalhos, checkboxes, validações e formatos da Base (fonte única). */
function buildBaseSheet_() {
  var sh = getSheet(SHEETS.BASE, true);
  sh.getRange(1, 1, 1, BASE_COLS).setValues([BASE_HEADERS])
    .setFontWeight('bold').setBackground(UI.HEADER_BG).setFontColor(UI.HEADER_TX);
  sh.setFrozenRows(1);

  var rows = 500; // janela de validações/formatos
  // Checkboxes para marcos e reserva — via VALIDAÇÃO (não escreve valor, então
  // não infla getLastRow com 500 linhas "ocupadas").
  var checkRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  [COL.TOUCHDOWN, COL.PLANO_IGREJA, COL.MATCH, COL.ENTREVISTA, COL.RESERVA].forEach(function (col) {
    sh.getRange(2, col, rows, 1).setDataValidation(checkRule);
  });
  // Dropdown de Resultado.
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(RESULTADO_OPCOES.slice(1), true).setAllowInvalid(true).build();
  sh.getRange(2, COL.RESULTADO, rows, 1).setDataValidation(rule);
  // Formatos de data.
  sh.getRange(2, COL.DATA_BATISMAL, rows, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(2, COL.ULTIMA_ATUALIZACAO, rows, 1).setNumberFormat('dd/mm/yyyy HH:mm');
}

/** Cabeçalhos das abas ocultas de infraestrutura. */
function buildHiddenSheets_() {
  headerRow_(getSheet(SHEETS.HISTORICO), HISTORICO_HEADERS);
  headerRow_(getSheet(SHEETS.EMAILS), EMAILS_HEADERS);
  headerRow_(getSheet(SHEETS.LOGS), LOGS_HEADERS);

  var sis = getSheet(SHEETS.SISTEMA);
  if (sis.getLastRow() < 1) sis.getRange(1, 1, 1, 2).setValues([['Chave', 'Valor']]);
  setState(STATE.CURRENT_INDEX, getCurrentIndex());

  var cache = getSheet(SHEETS.CACHE);
  if (cache.getLastRow() < 1) cache.getRange(1, 1, 1, 2).setValues([['Chave', 'Valor']]);
}

/** Helper: escreve linha de cabeçalho estilizada se ainda não existir. */
function headerRow_(sh, headers) {
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground(UI.HEADER_BG).setFontColor(UI.HEADER_TX);
    sh.setFrozenRows(1);
  }
}

/** Monta a aba de Configuração (chave/valor) + botão de reconstrução. */
function buildConfigSheet_() {
  var sh = getSheet(SHEETS.CONFIG, true);
  resetScreen(sh, 1, 30);

  mergeBlock(sh, 1, '⚙ Configuração', { bg: UI.HEADER_BG, color: UI.HEADER_TX, size: 18, bold: true, hAlign: 'center' });

  var existing = getConfig();
  var defaults = defaultConfig();
  var startRow = 3;
  defaults.forEach(function (kv, i) {
    var r = startRow + i;
    sh.getRange(r, 1).setValue(kv[0]).setFontWeight('bold').setFontColor(UI.MUTED);
    var val = existing[kv[0]] !== undefined ? existing[kv[0]] : kv[1];
    var cell = sh.getRange(r, 2);
    if (typeof kv[1] === 'boolean') {
      cell.insertCheckboxes();
      cell.setValue(toBool(val));
    } else {
      cell.setValue(val);
    }
    cell.setBackground(UI.FIELD_BG);
  });

  // Botão de ação: reconstruir telas.
  var actionRow = startRow + defaults.length + 1;
  sh.getRange(actionRow, 1).setValue('🔄 Reconstruir telas').setFontWeight('bold').setFontColor(UI.ACCENT);
  sh.getRange(actionRow, 2).insertCheckboxes().setValue(false).setBackground(UI.BUTTON_BG);

  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 180);
}

/** Larguras pensadas para celular nas abas visíveis (coluna A = respiro). */
function applyMobileWidths_() {
  VISIBLE_SHEETS.forEach(function (n) {
    var sh = getSheet(n);
    if (n === SHEETS.CONFIG) return;
    sh.setColumnWidth(1, 24);
    sh.setColumnWidth(2, 150);
    sh.setColumnWidth(3, 95);
    sh.setColumnWidth(4, 95);
    try { sh.setHiddenGridlines(true); } catch (_) {}
  });
}

/* ============================ PROTEÇÕES ============================ */

/** Aplica proteções: ocultas/dashboards são read-only; Registro só campos do card. */
function applyProtections_() {
  // Histórico imutável.
  protectHistory();

  // Dashboards e Home: somente leitura, exceto os controles (checkboxes).
  protectReadOnly_(getSheet(SHEETS.HOME), ['B12']); // botão COMEÇAR
  protectReadOnly_(getSheet(SHEETS.DASH_DISTRITO), []);
  // Dashboard Zona: liberar coluna B (checkboxes de filtro).
  protectReadOnly_(getSheet(SHEETS.DASH_ZONA), ['B5:B60']);

  // Registro: liberar apenas os campos editáveis do card.
  var editaveis = [
    'B' + CARD.ROW_MARCO_1 + ':B' + CARD.ROW_MARCO_3,   // marcos (checkbox)
    'B' + CARD.ROW_PROX_VALUE,                           // próximo passo
    'B' + CARD.ROW_OBS_VALUE,                            // observação
    'B' + CARD.ROW_RESULT_VALUE,                         // resultado
    'B' + CARD.ROW_NAV + ':D' + CARD.ROW_NAV             // navegação
  ];
  protectReadOnly_(getSheet(SHEETS.REGISTRO), editaveis);
}

/**
 * Marca uma aba como "somente controles" usando proteção do tipo AVISO.
 *
 * Por que warning-only? O app é movido por GATILHO SIMPLES (onEdit), executado
 * com a identidade do usuário. Proteção "hard" bloquearia as próprias escritas
 * de renderização do script para usuários que não são donos do arquivo —
 * quebrando o app no celular. O aviso comunica a intenção (não editar textos do
 * layout) sem impedir o funcionamento. As faixas editáveis ficam registradas
 * como exceções para documentar o contrato da tela.
 */
function protectReadOnly_(sh, unprotectedA1) {
  if (!sh) return;
  removeProtections(sh);
  try {
    var p = sh.protect().setDescription(APP.NAME + ' — somente controles').setWarningOnly(true);
    if (unprotectedA1 && unprotectedA1.length) {
      p.setUnprotectedRanges(unprotectedA1.map(function (a1) { return sh.getRange(a1); }));
    }
  } catch (_) {}
}

/* ============================ GATILHOS ============================ */

/** Instala gatilho de tempo para envio de e-mails (sem duplicar). */
function installTriggers_() {
  deleteTriggers_('processEmailQueue');
  ScriptApp.newTrigger('processEmailQueue').timeBased().everyMinutes(5).create();
}

/** Remove gatilhos de uma função pelo nome. */
function deleteTriggers_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(t);
  });
}

/* ============================ ROTEADOR onEdit ============================ */

/**
 * Gatilho simples: roteia toda interação do usuário. Funciona no app mobile.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var name = e.range.getSheet().getName();
    if (name === SHEETS.HOME) return routeHome_(e);
    if (name === SHEETS.REGISTRO) return routeRegistro_(e);
    if (name === SHEETS.DASH_ZONA) return routeZona_(e);
    if (name === SHEETS.CONFIG) return routeConfig_(e);
  } catch (err) {
    logEvent('ERROR', 'onEdit', err && err.stack ? err.stack : err);
  }
}

/** Home: botão COMEÇAR REGISTROS. */
function routeHome_(e) {
  if (e.range.getRow() === 12 && e.range.getColumn() === CARD.COL && e.range.getValue() === true) {
    e.range.setValue(false);
    navComecar();
  }
}

/** Registro: navegação e edição de campos do card. */
function routeRegistro_(e) {
  var row = e.range.getRow();
  var col = e.range.getColumn();

  // Navegação (linha de checkboxes).
  if (row === CARD.ROW_NAV && col >= CARD.COL && col <= CARD.COL + 2) {
    if (e.range.getValue() !== true) return;
    e.range.setValue(false);
    if (col === CARD.COL) navPrev();
    else if (col === CARD.COL + 1) navSave();
    else navNext();
    return;
  }

  var p = getByIndex(getCurrentIndex());
  if (!p) return;
  var statusAntes = p.status;
  var changes = {};

  // Marcos (checkbox em B nas linhas de marco).
  if (col === CARD.COL && row >= CARD.ROW_MARCO_1 && row <= CARD.ROW_MARCO_3) {
    var marcoCol = marcoColForRow(p.semana, row);
    if (marcoCol) changes[marcoCol] = e.range.getValue() === true;
  } else if (row === CARD.ROW_PROX_VALUE && col === CARD.COL) {
    changes[COL.PROXIMO_PASSO] = e.range.getValue();
  } else if (row === CARD.ROW_OBS_VALUE && col === CARD.COL) {
    changes[COL.OBSERVACAO] = e.range.getValue();
  } else if (row === CARD.ROW_RESULT_VALUE && col === CARD.COL) {
    changes[COL.RESULTADO] = e.range.getValue();
  } else {
    return; // edição fora dos campos do card: ignora
  }

  var updated = updateResearcher(p.row, changes);
  maybeNotifyCritical(updated, statusAntes);
  renderRegistro();
  refreshDashboards();
}

/** Dashboard Zona: toques nos checkboxes de filtro. */
function routeZona_(e) {
  handleZonaFilterEdit(e);
}

/** Configuração: valores e botão reconstruir. */
function routeConfig_(e) {
  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (col !== 2) return;
  var label = String(e.range.getSheet().getRange(row, 1).getValue() || '');
  if (label.indexOf('Reconstruir') >= 0) {
    e.range.setValue(false);
    recomputeAllStatuses();
    rebuildAll();
    toast('Telas reconstruídas ✓', APP.NAME, 4);
    return;
  }
  // Mudança de configuração: re-aplica regras e telas.
  recomputeAllStatuses();
  renderHome();
  refreshDashboards();
}

/* ============================ onOpen ============================ */

/** Atualiza a Home ao abrir (gatilho simples). */
function onOpen() {
  try { renderHome(); } catch (err) { logEvent('ERROR', 'onOpen', err); }
}

/* ============================ DADOS DE EXEMPLO ============================ */

/** Popula pesquisadores de demonstração e re-renderiza tudo. */
function seedExemplo() {
  var base = getSheet(SHEETS.BASE, true);
  // Limpa dados (mantém cabeçalho).
  if (base.getLastRow() > 1) {
    base.getRange(2, 1, base.getLastRow() - 1, BASE_COLS).clearContent();
  }

  var hoje = startOfDay(now());
  function emDias(n) { return new Date(hoje.getTime() + n * 86400000); }

  var exemplos = [
    { nome: 'Emily', area: 'Junção 1', semana: 2, dataBatismal: emDias(4), match: false },
    { nome: 'Lucas', area: 'Centro', semana: 1, dataBatismal: emDias(20), touchdown: true, planoIgreja: true },
    { nome: 'Sofia', area: 'Bela Vista', semana: 3, dataBatismal: emDias(2), entrevista: false },
    { nome: 'Mateus', area: 'Parque Sul', semana: 1, dataBatismal: emDias(25), touchdown: false },
    { nome: 'Helena', area: 'Junção 2', semana: 2, dataBatismal: emDias(10), match: true, touchdown: true },
    { nome: 'Davi', area: 'Industrial', semana: 3, dataBatismal: emDias(1), entrevista: true, match: true, touchdown: true, resultado: 'Batizado' }
  ];

  exemplos.forEach(function (x) {
    var p = insertResearcher(x);
    var changes = {};
    if (x.touchdown) changes[COL.TOUCHDOWN] = true;
    if (x.planoIgreja) changes[COL.PLANO_IGREJA] = true;
    if (x.match) changes[COL.MATCH] = true;
    if (x.entrevista) changes[COL.ENTREVISTA] = true;
    if (x.resultado) changes[COL.RESULTADO] = x.resultado;
    if (Object.keys(changes).length) updateResearcher(p.row, changes);
  });

  recomputeAllStatuses();
  setCurrentIndex(0);
  rebuildAll();
  toast('Dados de exemplo criados ✓', APP.NAME, 4);
}
