/**
 * Config.gs
 * Configurações editáveis pelo usuário (lidas da aba ⚙️ Configuração)
 * com valores padrão seguros. Também desenha a aba e trata seus botões.
 */

/** Valores padrão usados quando a célula está em branco. */
var CONFIG_DEFAULTS = {
  DISTRITO: 'Distrito 3',
  EMAIL_LZ: '',
  DIAS_SEM_ATUALIZACAO: 3,
  DIAS_CRITICO: 2
};

/** Células de entrada na aba Configuração (notação A1). */
var CFG = {
  DISTRITO: 'D3',
  EMAIL_LZ: 'D4',
  DIAS_SEM: 'D5',
  DIAS_CRIT: 'D6',
  ADD_NOME: 'D9',
  ADD_AREA: 'D10',
  ADD_SEMANA: 'D11',
  ADD_DATA: 'D12',
  BTN_ADD: 'A13',
  BTN_RECALC: 'A15',
  BTN_EMAIL: 'A16',
  BTN_REBUILD: 'A17',
  BTN_REFRESH: 'A19',
  COLS: 6
};

/** Células liberadas para edição na aba Configuração. */
var CFG_INPUT_CELLS = [
  CFG.DISTRITO, CFG.EMAIL_LZ, CFG.DIAS_SEM, CFG.DIAS_CRIT,
  CFG.ADD_NOME, CFG.ADD_AREA, CFG.ADD_SEMANA, CFG.ADD_DATA,
  CFG.BTN_ADD, CFG.BTN_RECALC, CFG.BTN_EMAIL, CFG.BTN_REBUILD, CFG.BTN_REFRESH
];

/**
 * Lê a configuração atual (com defaults).
 * @return {{distrito:string,emailLz:string,diasSemAtualizacao:number,diasCritico:number}}
 */
function getConfig() {
  var sh = getSheetOrNull(SHEETS.CONFIG);
  if (!sh) {
    return {
      distrito: CONFIG_DEFAULTS.DISTRITO,
      emailLz: CONFIG_DEFAULTS.EMAIL_LZ,
      diasSemAtualizacao: CONFIG_DEFAULTS.DIAS_SEM_ATUALIZACAO,
      diasCritico: CONFIG_DEFAULTS.DIAS_CRITICO
    };
  }
  var distrito = String(sh.getRange(CFG.DISTRITO).getValue() || '').trim();
  var emailLz = String(sh.getRange(CFG.EMAIL_LZ).getValue() || '').trim();
  var diasSem = Number(sh.getRange(CFG.DIAS_SEM).getValue());
  var diasCrit = Number(sh.getRange(CFG.DIAS_CRIT).getValue());

  return {
    distrito: distrito || CONFIG_DEFAULTS.DISTRITO,
    emailLz: emailLz,
    diasSemAtualizacao: diasSem > 0 ? diasSem : CONFIG_DEFAULTS.DIAS_SEM_ATUALIZACAO,
    diasCritico: diasCrit > 0 ? diasCrit : CONFIG_DEFAULTS.DIAS_CRITICO
  };
}

/**
 * Desenha a aba ⚙️ Configuração com aparência de app.
 * Preserva os valores já digitados pelo usuário.
 */
function renderConfig() {
  var sh = getOrCreateSheet(SHEETS.CONFIG);
  var cfg = getConfig();

  prepareCanvas(sh, CFG.COLS, 20, 130);

  drawHeader(sh, CFG.COLS, '⚙️ CONFIGURAÇÃO', cfg.distrito);

  drawFieldRow(sh, 3, '🏢 Distrito', cfg.distrito);
  drawFieldRow(sh, 4, '📧 E-mail do LZ', cfg.emailLz);
  drawFieldRow(sh, 5, '🟠 Dias p/ "sem atualização"', cfg.diasSemAtualizacao);
  drawFieldRow(sh, 6, '🔴 Dias críticos antes do batismo', cfg.diasCritico);

  drawSeparator(sh, 7, CFG.COLS);
  drawSectionTitle(sh, 8, CFG.COLS, '➕ ADICIONAR PESQUISADOR');
  drawFieldRow(sh, 9, 'Nome', sh.getRange(CFG.ADD_NOME).getValue());
  drawFieldRow(sh, 10, 'Área', sh.getRange(CFG.ADD_AREA).getValue());
  drawFieldRow(sh, 11, 'Semana', sh.getRange(CFG.ADD_SEMANA).getValue());
  drawFieldRow(sh, 12, 'Data Batismal (aaaa-mm-dd)', sh.getRange(CFG.ADD_DATA).getValue());
  drawButtonRow(sh, 13, CFG.COLS, '✅ Adicionar pesquisador');

  drawSeparator(sh, 14, CFG.COLS);
  drawButtonRow(sh, 15, CFG.COLS, '🔄 Recalcular tudo');
  drawButtonRow(sh, 16, CFG.COLS, '📧 Enviar resumo ao LZ');
  drawButtonRow(sh, 17, CFG.COLS, '🛠 Reconstruir sistema');

  drawSeparator(sh, 18, CFG.COLS);
  drawButtonRow(sh, 19, CFG.COLS, '🔄 Atualizar tela');

  // Garante checkboxes desmarcados nos botões de ação.
  [CFG.BTN_ADD, CFG.BTN_RECALC, CFG.BTN_EMAIL, CFG.BTN_REBUILD, CFG.BTN_REFRESH].forEach(function (a1) {
    sh.getRange(a1).insertCheckboxes().setValue(false);
  });

  SpreadsheetApp.flush();
}

/**
 * Trata edições na aba Configuração (botões de ação).
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function handleConfigEdit(e) {
  var a1 = e.range.getA1Notation();
  var sh = e.range.getSheet();

  if (a1 === CFG.BTN_ADD && e.range.isChecked()) {
    sh.getRange(CFG.BTN_ADD).setValue(false);
    addResearcherFromForm(sh);
    return;
  }
  if (a1 === CFG.BTN_RECALC && e.range.isChecked()) {
    sh.getRange(CFG.BTN_RECALC).setValue(false);
    recomputeAll();
    renderAll();
    toast('Tudo recalculado e telas atualizadas.', 'Mission Tracker');
    return;
  }
  if (a1 === CFG.BTN_EMAIL && e.range.isChecked()) {
    sh.getRange(CFG.BTN_EMAIL).setValue(false);
    sendResumoLZ();
    return;
  }
  if (a1 === CFG.BTN_REBUILD && e.range.isChecked()) {
    sh.getRange(CFG.BTN_REBUILD).setValue(false);
    rebuildSystem();
    return;
  }
  if (a1 === CFG.BTN_REFRESH && e.range.isChecked()) {
    sh.getRange(CFG.BTN_REFRESH).setValue(false);
    renderConfig();
    return;
  }

  // Mudança de limites/distrito: recalcula cores (sem reconstruir tudo).
  if (a1 === CFG.DIAS_SEM || a1 === CFG.DIAS_CRIT || a1 === CFG.DISTRITO) {
    recomputeAll();
    toast('Configuração aplicada.', 'Mission Tracker');
  }
}

/** Lê o formulário de adição e cria um novo pesquisador na Base. */
function addResearcherFromForm(sh) {
  var nome = String(sh.getRange(CFG.ADD_NOME).getValue() || '').trim();
  if (!nome) {
    toast('Informe ao menos o Nome para adicionar.', 'Mission Tracker');
    return;
  }
  var cfg = getConfig();
  var area = String(sh.getRange(CFG.ADD_AREA).getValue() || '').trim();
  var semana = Number(sh.getRange(CFG.ADD_SEMANA).getValue()) || 1;
  var dataRaw = sh.getRange(CFG.ADD_DATA).getValue();
  var data = parseDateLoose(dataRaw);

  addResearcher({
    nome: nome,
    distrito: cfg.distrito,
    semana: semana,
    area: area,
    dataBatismal: data
  });

  // Limpa o formulário.
  [CFG.ADD_NOME, CFG.ADD_AREA, CFG.ADD_SEMANA, CFG.ADD_DATA].forEach(function (a1) {
    sh.getRange(a1).clearContent();
  });

  recomputeAll();
  renderConfig();
  renderHome();
  toast('Pesquisador "' + nome + '" adicionado.', 'Mission Tracker');
}
