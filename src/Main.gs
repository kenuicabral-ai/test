/**
 * Main.gs
 * Ponto de entrada: setup(), roteador do gatilho onEdit instalável,
 * proteções, organização das abas e dados de exemplo.
 *
 * COMO USAR (uma vez): abra Extensões → Apps Script, execute `setup`
 * e autorize. O gatilho instalável é necessário porque o onEdit simples
 * não pode enviar e-mail nem executar operações autenticadas.
 */

/* ----------------------------------------------------------------------- */
/* SETUP                                                                   */
/* ----------------------------------------------------------------------- */

function setup() {
  initSchemas();
  seedSampleDataIfEmpty();
  ensureTrigger();
  arrangeSheets();
  applyProtections();
  renderAll();
  sysSet(SYS.SETUP_DONE, 'true');
  goTo(SHEETS.HOME);
  toast('Mission Tracker instalado! ✓', 'Mission Tracker');
}

/** Reconstrói a estrutura/telas SEM apagar os dados. */
function rebuildSystem() {
  initSchemas();
  ensureTrigger();
  arrangeSheets();
  applyProtections();
  renderAll();
  goTo(SHEETS.HOME);
  toast('Sistema reconstruído ✓', 'Mission Tracker');
}

/** Cria/garante todas as abas e seus esquemas. */
function initSchemas() {
  buildBaseSchema();
  buildHistoricoSchema();
  buildEmailsSchema();
  ensureKvSheet(SHEETS.SISTEMA, ['Chave', 'Valor']);
  ensureKvSheet(SHEETS.CACHE, ['Chave', 'Valor']);
  ensureKvSheet(SHEETS.LOGS, ['Data', 'Escopo', 'Mensagem']);
  VISIBLE_SHEETS.forEach(function (name) { getOrCreateSheet(name); });
  removeDefaultSheets();
}

function ensureKvSheet(name, headers) {
  var sh = getOrCreateSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#37474F').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
}

/** Remove abas padrão vazias ("Sheet1"/"Página1"). */
function removeDefaultSheets() {
  var known = {};
  VISIBLE_SHEETS.concat(HIDDEN_SHEETS).forEach(function (n) { known[n] = true; });
  ss().getSheets().forEach(function (sh) {
    var n = sh.getName();
    if (!known[n] && sh.getLastRow() === 0 && ss().getSheets().length > 1) {
      try { ss().deleteSheet(sh); } catch (e) { /* ignora */ }
    }
  });
}

/** Define ordem das abas, oculta as de banco e exibe as de UI. */
function arrangeSheets() {
  var order = VISIBLE_SHEETS.concat(HIDDEN_SHEETS);
  order.forEach(function (name, i) {
    var sh = getSheetOrNull(name);
    if (sh) {
      ss().setActiveSheet(sh);
      ss().moveActiveSheet(i + 1);
    }
  });
  HIDDEN_SHEETS.forEach(function (name) {
    var sh = getSheetOrNull(name);
    if (sh) { try { sh.hideSheet(); } catch (e) { /* ignora */ } }
  });
  VISIBLE_SHEETS.forEach(function (name) {
    var sh = getSheetOrNull(name);
    if (sh) { try { sh.showSheet(); } catch (e) { /* ignora */ } }
  });
}

/** Cria (sem duplicar) o gatilho onEdit instalável. */
function ensureTrigger() {
  removeTriggers('onEditInstallable');
  ScriptApp.newTrigger('onEditInstallable')
    .forSpreadsheet(ss())
    .onEdit()
    .create();
}

/* ----------------------------------------------------------------------- */
/* ROTEADOR onEdit (instalável)                                            */
/* ----------------------------------------------------------------------- */

function onEditInstallable(e) {
  if (!e || !e.range) return;
  var lock = LockService.getDocumentLock();
  var hasLock = false;
  try { hasLock = lock.tryLock(15000); } catch (err) { hasLock = false; }
  try {
    var name = e.range.getSheet().getName();
    if (name === SHEETS.REGISTRO) handleRegistroEdit(e);
    else if (name === SHEETS.HOME) handleHomeEdit(e);
    else if (name === SHEETS.DASH_DISTRITO) handleDistritoEdit(e);
    else if (name === SHEETS.DASH_ZONA) handleZonaEdit(e);
    else if (name === SHEETS.CONFIG) handleConfigEdit(e);
  } catch (err) {
    logError('onEditInstallable', err);
    toast('Ocorreu um erro. Veja a aba Logs.', 'Mission Tracker');
  } finally {
    if (hasLock) { try { lock.releaseLock(); } catch (e2) { /* ignora */ } }
  }
}

/** onOpen simples: atualiza a Home (best-effort). */
function onOpen(e) {
  try {
    if (String(sysGet(SYS.SETUP_DONE, '')) === 'true') {
      renderHome();
    }
  } catch (err) {
    logError('onOpen', err);
  }
}

/* ----------------------------------------------------------------------- */
/* PROTEÇÕES                                                               */
/* ----------------------------------------------------------------------- */

function applyProtections() {
  HIDDEN_SHEETS.forEach(function (name) {
    var sh = getSheetOrNull(name);
    if (!sh) return;
    try {
      var existing = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      existing.forEach(function (p) { p.remove(); });
      var p = sh.protect().setDescription(name + ' (banco protegido)');
      p.getEditors().forEach(function (u) { try { p.removeEditor(u); } catch (e) {} });
      if (p.canDomainEdit()) { try { p.setDomainEdit(false); } catch (e) {} }
      p.setWarningOnly(false);
    } catch (err) { logError('protect:' + name, err); }
  });

  protectVisible(SHEETS.HOME, [HOME.BTN_START, HOME.BTN_REFRESH]);
  protectVisible(SHEETS.REGISTRO, ['A7:A9', 'A12:F12', 'A14:F14',
    'D15:F15', REG.NAV_ANTERIOR, REG.NAV_SALVAR, REG.NAV_PROXIMO]);
  protectVisible(SHEETS.DASH_DISTRITO, [DIST.BTN_REFRESH]);
  protectVisible(SHEETS.DASH_ZONA, [ZONA.BTN_REFRESH, ZONA.BTN_EMAIL,
    'A' + ZONA.IND_START + ':A' + (ZONA.IND_START + ZONA_INDICADORES.length - 1)]);
  protectVisible(SHEETS.CONFIG, ['D3:F6', 'D9:F12',
    CFG.BTN_ADD, CFG.BTN_RECALC, CFG.BTN_EMAIL, CFG.BTN_REBUILD, CFG.BTN_REFRESH]);
}

function protectVisible(name, unprotectedA1List) {
  var sh = getSheetOrNull(name);
  if (!sh) return;
  try {
    var existing = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    existing.forEach(function (p) { p.remove(); });
    var p = sh.protect().setDescription(name + ' (somente campos liberados)');
    var ranges = unprotectedA1List.map(function (a1) { return sh.getRange(a1); });
    p.setUnprotectedRanges(ranges);
    p.setWarningOnly(false);
  } catch (err) { logError('protectVisible:' + name, err); }
}

/* ----------------------------------------------------------------------- */
/* DADOS DE EXEMPLO                                                        */
/* ----------------------------------------------------------------------- */

function seedSampleDataIfEmpty() {
  if (countResearchers() > 0) return;
  var distrito = getConfig().distrito;
  var sh = getOrCreateSheet(SHEETS.BASE);

  var samples = [
    mkSample('Emily', distrito, 2, 'Junção 1', daysFromNow(4), { touchDown: true, planoIgreja: true }, '', '', RESULTADO.NENHUM, hoursAgo(2)),
    mkSample('Lucas', distrito, 1, 'Centro', daysFromNow(25), {}, 'Marcar primeira visita', '', RESULTADO.NENHUM, hoursAgo(1)),
    mkSample('Marina', distrito, 3, 'Norte', daysFromNow(2), { touchDown: true, match: true }, 'Confirmar entrevista', 'Família apoia', RESULTADO.RESERVADO, daysAgo(1)),
    mkSample('Pedro', distrito, 3, 'Sul', daysFromNow(9), { touchDown: true, match: true, entrevista: true }, 'Confirmar transporte', '', RESULTADO.RESERVADO, hoursAgo(5)),
    mkSample('Ana', distrito, 2, 'Junção 2', daysFromNow(14), { touchDown: true }, '', '', RESULTADO.NENHUM, daysAgo(5)),
    mkSample('Rafael', distrito, 1, 'Leste', daysFromNow(30), { touchDown: true, planoIgreja: true }, 'Ensinar Plano de Salvação', 'Muito receptivo', RESULTADO.NENHUM, hoursAgo(3)),
    mkSample('Beatriz', distrito, 3, 'Oeste', daysFromNow(-1), { touchDown: true, match: true }, '', 'Reagendar', RESULTADO.DATA_CAIDA, daysAgo(3)),
    mkSample('Gabriel', distrito, 1, 'Centro', daysFromNow(28), {}, '', '', RESULTADO.NENHUM, daysAgo(4)),
    mkSample('Sofia', distrito, 3, 'Norte', daysFromNow(7), { touchDown: true, match: true, entrevista: true }, 'Preparar serviço batismal', 'Tudo certo', RESULTADO.RESERVADO, hoursAgo(6)),
    mkSample('Thiago', distrito, 2, 'Sul', daysFromNow(12), { touchDown: true, match: true }, 'Ensinar mandamentos', '', RESULTADO.NENHUM, hoursAgo(8))
  ];

  sh.getRange(2, 1, samples.length, BASE_NUM_COLS).setValues(samples);
  applyBaseValidations(sh);
  recomputeAll();
}

function mkSample(nome, distrito, semana, area, data, flags, prox, obs, resultado, updatedAt) {
  flags = flags || {};
  var r = {
    id: generateId(),
    nome: nome, distrito: distrito, semana: semana, area: area, dataBatismal: data,
    touchDown: !!flags.touchDown, planoIgreja: !!flags.planoIgreja,
    match: !!flags.match, entrevista: !!flags.entrevista,
    proximoPasso: prox || '', observacao: obs || '', resultado: resultado || '',
    cor: '', ultimaAtualizacao: updatedAt || now(), usuario: 'exemplo@missiontracker'
  };
  return rowFromRecord(r);
}

function daysFromNow(n) {
  var d = now();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function daysAgo(n) { return new Date(now().getTime() - n * 86400000); }
function hoursAgo(n) { return new Date(now().getTime() - n * 3600000); }
