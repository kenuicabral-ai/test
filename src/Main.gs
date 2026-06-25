/**
 * Main.gs
 * ---------------------------------------------------------------------------
 * Pontos de entrada e orquestração:
 *   - setup()           : instalação inicial (rodar UMA vez no editor)
 *   - onOpen(e)         : atualiza os dashboards ao abrir
 *   - onEditTrigger(e)  : gatilho instalável que dá vida aos "botões" e edições
 *   - dailyRecompute()  : recálculo diário + resumo por email
 *
 * Toda interação acontece por edição de células (checkboxes/dropdowns) — sem
 * menus, diálogos, sidebars ou HTML Service. Compatível com o app no celular.
 * ---------------------------------------------------------------------------
 */

/* ------------------------------- SETUP ---------------------------------- */

/**
 * Instalação inicial. Rode esta função uma vez pelo editor do Apps Script.
 * Cria abas, estrutura, dados de exemplo, telas, proteções e gatilhos.
 */
function setup() {
  const lock = LockService.getDocumentLock();
  try { lock.waitLock(30000); } catch (e) { /* segue mesmo assim */ }
  try {
    ensureBaseStructure_();
    ensureHistoryStructure_();
    ensureEmailsStructure_();
    ensureInfraSheets_();

    if (baseDataCount_() === 0) seedSampleData_();

    const cfg = getConfig_();
    renderConfig_(cfg);
    refreshAllDashboards_();
    buildRegistroList_(cfg);
    renderRegistroAt_(getState_(STATE_KEYS.REG_INDEX, 0));

    organizeSheets_();
    protectScreens_();
    protectInfraSheets_();
    installTriggers_();

    logEvent_('INFO', 'setup', 'Mission Tracker v' + APP.VERSION + ' instalado.');
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/** Cria as abas de infraestrutura que faltam (Logs, Sistema, Cache). */
function ensureInfraSheets_() {
  const logs = getSheet_(HIDDEN_SHEETS.LOGS);
  if (logs.getRange(1, 1, 1, LOGS_HEADERS.length).getValues()[0].join('') !== LOGS_HEADERS.join('')) {
    logs.getRange(1, 1, 1, LOGS_HEADERS.length).setValues([LOGS_HEADERS]).setFontWeight('bold');
    logs.setFrozenRows(1);
  }
  const sistema = getSheet_(HIDDEN_SHEETS.SISTEMA);
  sistema.getRange(1, 1, 1, 2).setValues([['Chave', 'Valor']]).setFontWeight('bold');
  sistema.getRange(2, 1, 2, 2).setValues([
    ['app', APP.NAME],
    ['versao', APP.VERSION],
  ]);
  getSheet_(HIDDEN_SHEETS.CACHE).getRange(1, 1)
    .setValue('Reservado para cache interno do ' + APP.NAME + '.');
}

/** Ordena as abas visíveis e oculta as de infraestrutura. */
function organizeSheets_() {
  const order = [SHEETS.HOME, SHEETS.REGISTRO, SHEETS.DASH_LD, SHEETS.DASH_LZ, SHEETS.CONFIG];
  order.forEach(function (name, i) {
    const sh = findSheet_(name);
    if (sh) { sh.activate(); ss_().moveActiveSheet(i + 1); }
  });
  Object.keys(HIDDEN_SHEETS).forEach(function (k) {
    const sh = findSheet_(HIDDEN_SHEETS[k]);
    if (sh) sh.hideSheet();
  });
  const home = findSheet_(SHEETS.HOME);
  if (home) home.activate();
}

/**
 * Aplica as proteções das telas UMA vez (no setup). Como os layouts têm
 * posições fixas, as faixas editáveis continuam válidas após cada re-render,
 * então não é preciso reprotegê-las a cada edição (ganho de performance).
 */
function protectScreens_() {
  const reg = findSheet_(SHEETS.REGISTRO);
  if (reg) applyRegistroProtection_(reg);

  const home = findSheet_(SHEETS.HOME);
  if (home) applyReadonlyProtectionExcept_(home, 'Home', [home.getRange(HOME_ROWS.BTN, 2)]);

  const ld = findSheet_(SHEETS.DASH_LD);
  if (ld) applyReadonlyProtection_(ld, 'Distrito');

  const lz = findSheet_(SHEETS.DASH_LZ);
  if (lz) applyReadonlyProtectionExcept_(lz, 'Zona', [
    lz.getRange(LZ.ROWS.DRILL_DISTRICT, REG.COL_VALUE),
    lz.getRange(LZ.ROWS.DRILL_METRIC, REG.COL_VALUE),
  ]);

  const cfg = findSheet_(SHEETS.CONFIG);
  if (cfg) protectConfig_(cfg);
}

/** Protege abas de infraestrutura (evita edição acidental). */
function protectInfraSheets_() {
  Object.keys(HIDDEN_SHEETS).forEach(function (k) {
    const sh = findSheet_(HIDDEN_SHEETS[k]);
    if (!sh) return;
    try {
      sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
        if (p.canEdit()) p.remove();
      });
      const prot = sh.protect().setDescription('Mission Tracker • ' + sh.getName() + ' (não editar)');
      // Histórico e Base nunca devem ser editados por colaboradores.
      prot.setWarningOnly(false);
    } catch (e) {
      logEvent_('WARN', 'protect-infra', e.message);
    }
  });
}

/* ------------------------------ TRIGGERS -------------------------------- */

/** (Re)instala os gatilhos do projeto sem duplicar. */
function installTriggers_() {
  const wanted = { onEditTrigger: true, dailyRecompute: true };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (wanted[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
  const ss = ss_();
  ScriptApp.newTrigger('onEditTrigger').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('dailyRecompute').timeBased().everyDays(1).atHour(6).create();
}

/* --------------------------- EVENT HANDLERS ----------------------------- */

/** Gatilho simples ao abrir: mantém os dashboards atualizados. */
function onOpen(e) {
  try {
    if (!findSheet_(HIDDEN_SHEETS.BASE)) return; // ainda não instalado
    refreshAllDashboards_();
  } catch (err) {
    logEvent_('WARN', 'onOpen', err.message);
  }
}

/**
 * Gatilho instalável de edição: roteia o evento para a tela correta.
 * É o coração da interação (botões-checkbox e edições do LD).
 */
function onEditTrigger(e) {
  if (!e || !e.range) return;
  const lock = LockService.getDocumentLock();
  try {
    lock.waitLock(8000);
  } catch (err) {
    return; // outra edição em andamento; ignora para evitar concorrência
  }
  try {
    const name = e.range.getSheet().getName();
    if (name === SHEETS.REGISTRO) handleRegistroEdit_(e);
    else if (name === SHEETS.HOME) handleHomeEdit_(e);
    else if (name === SHEETS.DASH_LZ) handleDashLZEdit_(e);
    else if (name === SHEETS.CONFIG) handleConfigEdit_(e);
  } catch (err) {
    logEvent_('ERROR', 'onEdit', (err && err.stack) ? err.stack : String(err));
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/** Recálculo diário + resumo por email (gatilho de tempo). */
function dailyRecompute() {
  try {
    refreshAllDashboards_();
    buildRegistroList_(getConfig_());
    sendDailyDigest_();
    logEvent_('INFO', 'daily', 'Recálculo diário concluído.');
  } catch (err) {
    logEvent_('ERROR', 'daily', (err && err.stack) ? err.stack : String(err));
  }
}

/* ----------------------------- SEED (demo) ------------------------------ */

/** Insere pesquisadores de exemplo para o sistema "nascer funcionando". */
function seedSampleData_() {
  const now = new Date();
  const daysAgo = function (n) { return new Date(now.getTime() - n * 86400000); };
  const daysAhead = function (n) { return new Date(now.getTime() + n * 86400000); };

  const samples = [
    {
      'Nome': 'Emily', 'Distrito': 'Distrito 3', 'Área': 'Junção 1',
      'Data Início': daysAgo(10), 'Data Batismal': daysAhead(4),
      'TouchDown': true, 'Plano Igreja': true, 'Match': false, 'Entrevista': false,
      'Resultado': RESULTADO.ANDAMENTO, 'Próximo Passo': 'Marcar entrevista batismal',
      'Observação': 'Família muito receptiva.', 'Última Atualização': now,
    },
    {
      'Nome': 'Sofia', 'Distrito': 'Distrito 3', 'Área': 'Centro',
      'Data Início': daysAgo(3), 'Data Batismal': daysAhead(24),
      'TouchDown': true, 'Plano Igreja': false, 'Match': false, 'Entrevista': false,
      'Resultado': RESULTADO.ANDAMENTO, 'Próximo Passo': 'Convidar para a igreja domingo',
      'Observação': '', 'Última Atualização': now,
    },
    {
      'Nome': 'Lucas', 'Distrito': 'Distrito 3', 'Área': 'Jardim Sul',
      'Data Início': daysAgo(20), 'Data Batismal': daysAhead(8),
      'TouchDown': true, 'Plano Igreja': true, 'Match': true, 'Entrevista': true,
      'Resultado': RESULTADO.ANDAMENTO, 'Próximo Passo': 'Confirmar serviço batismal',
      'Observação': 'Tudo pronto!', 'Última Atualização': now,
    },
    {
      'Nome': 'Ana', 'Distrito': 'Distrito 3', 'Área': 'Vila Nova',
      'Data Início': daysAgo(11), 'Data Batismal': daysAhead(18),
      'TouchDown': true, 'Plano Igreja': true, 'Match': false, 'Entrevista': false,
      'Resultado': RESULTADO.ANDAMENTO, 'Próximo Passo': 'Visitar com membro',
      'Observação': '', 'Última Atualização': daysAgo(6),
    },
    {
      'Nome': 'Pedro', 'Distrito': 'Distrito 3', 'Área': 'Centro',
      'Data Início': daysAgo(28), 'Data Batismal': daysAgo(2),
      'TouchDown': true, 'Plano Igreja': true, 'Match': true, 'Entrevista': true,
      'Resultado': RESULTADO.BATIZADO, 'Próximo Passo': '', 'Observação': 'Batizado!',
      'Última Atualização': daysAgo(2),
    },
    {
      'Nome': 'Mariana', 'Distrito': 'Distrito 3', 'Área': 'Jardim Sul',
      'Data Início': daysAgo(15), 'Data Batismal': daysAgo(1),
      'TouchDown': true, 'Plano Igreja': false, 'Match': false, 'Entrevista': false,
      'Resultado': RESULTADO.CAIU, 'Próximo Passo': '', 'Observação': 'Mudou de cidade.',
      'Última Atualização': daysAgo(1),
    },
    {
      'Nome': 'João', 'Distrito': 'Distrito 4', 'Área': 'Norte',
      'Data Início': daysAgo(9), 'Data Batismal': daysAhead(12),
      'TouchDown': true, 'Plano Igreja': true, 'Match': false, 'Entrevista': false,
      'Resultado': RESULTADO.ANDAMENTO, 'Próximo Passo': 'Fazer match com membro',
      'Observação': '', 'Última Atualização': daysAgo(1),
    },
    {
      'Nome': 'Beatriz', 'Distrito': 'Distrito 4', 'Área': 'Sul',
      'Data Início': daysAgo(5), 'Data Batismal': daysAhead(21),
      'TouchDown': true, 'Plano Igreja': false, 'Match': false, 'Entrevista': false,
      'Resultado': RESULTADO.RESERVADO, 'Próximo Passo': 'Confirmar data com a família',
      'Observação': 'Data reservada.', 'Última Atualização': now,
    },
  ];

  // Inserção em lote: monta todas as linhas e escreve de uma vez.
  const sh = ensureBaseStructure_();
  const rows = samples.map(function (s, i) {
    s['ID'] = 'P' + ('00' + (i + 1)).slice(-3);
    s['Semana'] = '';
    s['Status'] = '';
    if (!s['Usuário']) s['Usuário'] = 'sistema';
    return recordToRow_(s);
  });
  sh.getRange(2, 1, rows.length, BASE_HEADERS.length).setValues(rows);
}
