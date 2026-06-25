/**
 * Registro.gs
 * Card de Registro: UM pesquisador por vez (nunca uma tabela).
 * O card é inteligente: muda os campos conforme a semana.
 * Toda edição salva automaticamente (Base + Histórico + Cor + data/hora/usuário).
 */

/** Mapa campo->propriedade do record. */
var FIELD_TO_PROP = {
  TouchDown: 'touchDown',
  PlanoIgreja: 'planoIgreja',
  Match: 'match',
  Entrevista: 'entrevista',
  ProximoPasso: 'proximoPasso',
  Observacao: 'observacao',
  Resultado: 'resultado'
};

/** Constrói a ordem de exibição (mais urgente primeiro) e guarda em Sistema. */
function buildRegistroOrder() {
  var cfg = getConfig();
  var ref = now();
  var all = readAll();
  all.sort(function (a, b) {
    var pa = STATUS_ORDER.indexOf(computeStatus(a, ref, cfg));
    var pb = STATUS_ORDER.indexOf(computeStatus(b, ref, cfg));
    if (pa !== pb) return pa - pb;
    return a.nome.localeCompare(b.nome);
  });
  var ids = all.map(function (r) { return r.id; });
  sysSet(SYS.REGISTRO_ORDER, ids);
  return ids;
}

/** Renderiza o card do pesquisador atual. */
function renderRegistro() {
  var sh = getOrCreateSheet(SHEETS.REGISTRO);
  var cfg = getConfig();

  var all = readAll();
  var byId = {};
  all.forEach(function (r) { byId[r.id] = r; });

  var order = sysGetJson(SYS.REGISTRO_ORDER, []);
  var valid = order.length > 0 && order.every(function (id) { return byId[id]; });
  if (!valid) {
    order = buildRegistroOrder();
  }

  var index = sysGetInt(SYS.REGISTRO_INDEX, 0);
  if (index < 0) index = 0;
  if (order.length && index > order.length - 1) index = order.length - 1;
  sysSet(SYS.REGISTRO_INDEX, index);

  prepareCanvas(sh, REG.COLS, REG.LAST_ROW, 72);

  if (!order.length) {
    drawHeader(sh, REG.COLS, '📱 REGISTRO', cfg.distrito);
    mergeRow(sh, 3, 1, REG.COLS)
      .setValue('Nenhum pesquisador cadastrado.\nAdicione na aba ⚙️ Configuração.')
      .setWrap(true)
      .setHorizontalAlignment('center')
      .setFontColor(UI.LABEL_FG);
    return;
  }

  var record = byId[order[index]];
  var status = computeStatus(record, now(), cfg);
  var semana = Number(record.semana) || 1;

  drawHeader(sh, REG.COLS, '📱 REGISTRO',
    cfg.distrito + '  ·  ' + (index + 1) + '/' + order.length);

  // Nome com faixa colorida do status.
  sh.setRowHeight(2, 46);
  mergeRow(sh, 2, 1, REG.COLS)
    .setValue(statusIcon(status) + '  ' + record.nome)
    .setBackground(statusSoft(status))
    .setFontColor(statusBg(status))
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('left');

  // Semana + Área
  sh.getRange(3, 1, 1, 3).merge()
    .setValue('📅 Semana ' + semana)
    .setBackground(UI.CARD_BG).setFontColor(UI.VALUE_FG).setFontSize(12)
    .setHorizontalAlignment('left');
  sh.getRange(3, 4, 1, 3).merge()
    .setValue('📍 ' + (record.area || '—'))
    .setBackground(UI.CARD_BG).setFontColor(UI.VALUE_FG).setFontSize(12)
    .setHorizontalAlignment('left');

  // Data batismal + motivo do status
  mergeRow(sh, 4, 1, REG.COLS)
    .setValue('🗓 Data Batismal: ' + formatDateShort(record.dataBatismal) +
      '   ·   ' + statusLabel(status) + ': ' + statusReason(record, status, now(), cfg))
    .setBackground(UI.CARD_BG).setFontColor(UI.VALUE_FG).setFontSize(11)
    .setHorizontalAlignment('left');

  drawSeparator(sh, 5, REG.COLS);
  drawSectionTitle(sh, 6, REG.COLS, '📋 STATUS — Semana ' + semana);

  // Card inteligente: itens conforme a semana.
  var items = statusItemsForWeek(semana);
  var statusMap = {};
  REG.STATUS_ROWS.forEach(function (row, i) {
    if (i < items.length) {
      var it = items[i];
      sh.getRange(row, REG.STATUS_CHECK_COL).insertCheckboxes()
        .setValue(!!record[FIELD_TO_PROP[it.field]])
        .setBackground(UI.CARD_BG).setHorizontalAlignment('center');
      sh.getRange(row, 2, 1, REG.COLS - 1).merge()
        .setValue(it.label)
        .setBackground(UI.CARD_BG).setFontColor(UI.VALUE_FG)
        .setFontSize(13).setHorizontalAlignment('left');
      statusMap[String(row)] = it.field;
    } else {
      sh.getRange(row, 1, 1, REG.COLS).breakApart();
      sh.getRange(row, 1, 1, REG.COLS).clearContent().clearDataValidations()
        .setBackground(UI.PANEL_BG);
      sh.setRowHeight(row, 6);
    }
  });
  sysSet(SYS.REGISTRO_STATUS_MAP, statusMap);

  drawSeparator(sh, 10, REG.COLS);

  drawSectionTitle(sh, 11, REG.COLS, '➡️ PRÓXIMO PASSO');
  drawInputCell(sh, REG.PROX_INPUT, record.proximoPasso);

  drawSectionTitle(sh, 13, REG.COLS, '📝 OBSERVAÇÃO');
  drawInputCell(sh, REG.OBS_INPUT, record.observacao);

  sh.getRange(15, 1, 1, 3).merge()
    .setValue('🏁 Resultado')
    .setBackground(UI.PANEL_BG).setFontColor(UI.LABEL_FG)
    .setFontSize(11).setFontWeight('bold').setHorizontalAlignment('left');
  var resCell = sh.getRange(REG.RESULTADO_INPUT).offset(0, 0, 1, 3).merge();
  resCell.setValue(record.resultado || '')
    .setBackground(UI.CARD_BG).setFontColor(UI.VALUE_FG).setFontSize(12)
    .setHorizontalAlignment('left')
    .setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(RESULTADO_OPCOES, true).build()
    );

  drawSeparator(sh, 16, REG.COLS);

  mergeRow(sh, 17, 1, REG.COLS)
    .setValue('🕓 Última atualização: ' + formatUpdate(record.ultimaAtualizacao) +
      (record.usuario ? '  ·  ' + record.usuario : ''))
    .setBackground(UI.PANEL_BG).setFontColor(UI.LABEL_FG)
    .setFontSize(10).setHorizontalAlignment('left');

  sh.setRowHeight(18, 8);
  mergeRow(sh, 18, 1, REG.COLS).setBackground(UI.PANEL_BG);

  // Barra de navegação (rótulos em 19, checkboxes em 20).
  drawNavLabel(sh, 19, 1, '⬅ Anterior');
  drawNavLabel(sh, 19, 3, '💾 Salvar');
  drawNavLabel(sh, 19, 5, 'Próximo ➡');
  sh.setRowHeight(20, 34);
  [['A20'], ['C20'], ['E20']].forEach(function (a) {
    sh.getRange(a[0]).insertCheckboxes().setValue(false)
      .setBackground(UI.BTN_BG).setHorizontalAlignment('center');
  });
  ['B20', 'D20', 'F20'].forEach(function (a1) {
    sh.getRange(a1).setBackground(UI.PANEL_BG);
  });

  SpreadsheetApp.flush();
}

function drawInputCell(sh, a1, value) {
  var cell = sh.getRange(a1).offset(0, 0, 1, REG.COLS).merge();
  cell.setValue(value || '')
    .setBackground(UI.CARD_BG).setFontColor(UI.VALUE_FG)
    .setFontSize(12).setHorizontalAlignment('left').setWrap(true)
    .setBorder(true, true, true, true, false, false, '#DADCE0', SpreadsheetApp.BorderStyle.SOLID);
}

function drawNavLabel(sh, row, startCol, text) {
  sh.getRange(row, startCol, 1, 2).merge()
    .setValue(text)
    .setBackground(UI.PANEL_BG).setFontColor(UI.BTN_BG)
    .setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center');
}

/* ----------------------------------------------------------------------- */
/* Edição / commits                                                        */
/* ----------------------------------------------------------------------- */

/** Trata edições na aba Registro. */
function handleRegistroEdit(e) {
  var a1 = e.range.getA1Notation();
  var sh = e.range.getSheet();

  if (a1 === REG.NAV_ANTERIOR) { sh.getRange(REG.NAV_ANTERIOR).setValue(false); navRegistro(-1); return; }
  if (a1 === REG.NAV_PROXIMO) { sh.getRange(REG.NAV_PROXIMO).setValue(false); navRegistro(1); return; }
  if (a1 === REG.NAV_SALVAR) { sh.getRange(REG.NAV_SALVAR).setValue(false); saveRegistro(sh, false); return; }

  var order = sysGetJson(SYS.REGISTRO_ORDER, []);
  if (!order.length) return;
  var index = sysGetInt(SYS.REGISTRO_INDEX, 0);
  index = Math.max(0, Math.min(index, order.length - 1));
  var record = getById(order[index]);
  if (!record) return;
  var user = getUserEmail();

  var statusMap = sysGetJson(SYS.REGISTRO_STATUS_MAP, {});
  var rowMatch = a1.match(/^A(\d+)$/);
  if (rowMatch && statusMap[rowMatch[1]]) {
    commitField(record, statusMap[rowMatch[1]], e.range.isChecked() === true, user);
    renderRegistro();
    return;
  }
  if (a1 === REG.PROX_INPUT) { commitField(record, 'ProximoPasso', String(e.range.getValue() || ''), user); renderRegistro(); return; }
  if (a1 === REG.OBS_INPUT) { commitField(record, 'Observacao', String(e.range.getValue() || ''), user); renderRegistro(); return; }
  if (a1 === REG.RESULTADO_INPUT) { commitField(record, 'Resultado', String(e.range.getValue() || ''), user); renderRegistro(); return; }
}

/** Aplica uma mudança ao record em memória (sem I/O). */
function applyFieldToRecord(record, field, newVal) {
  var prop = FIELD_TO_PROP[field];
  if (!prop) return { changed: false };
  var oldVal = record[prop];
  if (typeof oldVal === 'boolean') {
    newVal = (newVal === true);
  } else {
    newVal = (newVal === null || newVal === undefined) ? '' : newVal;
  }
  var changed = String(oldVal) !== String(newVal);
  if (changed) record[prop] = newVal;
  return { changed: changed, oldVal: oldVal, newVal: newVal };
}

/** Commit de um único campo (caso comum: 1 checkbox / 1 texto). */
function commitField(record, field, newVal, user) {
  var res = applyFieldToRecord(record, field, newVal);
  if (!res.changed) return false;
  record.ultimaAtualizacao = now();
  record.usuario = user;
  record.cor = computeStatus(record, record.ultimaAtualizacao);
  writeRecord(record);
  logChange(record, field, res.oldVal, res.newVal, user);
  recomputeAll();
  return true;
}

/** Salva todos os campos do card de uma vez (lote). */
function saveRegistro(sh, silent, skipRender) {
  var order = sysGetJson(SYS.REGISTRO_ORDER, []);
  if (!order.length) { renderRegistro(); return; }
  var index = Math.max(0, Math.min(sysGetInt(SYS.REGISTRO_INDEX, 0), order.length - 1));
  var record = getById(order[index]);
  if (!record) return;
  var user = getUserEmail();

  var statusMap = sysGetJson(SYS.REGISTRO_STATUS_MAP, {});
  var fields = [];
  Object.keys(statusMap).forEach(function (rowStr) {
    fields.push({ field: statusMap[rowStr], val: sh.getRange('A' + rowStr).isChecked() === true });
  });
  fields.push({ field: 'ProximoPasso', val: String(sh.getRange(REG.PROX_INPUT).getValue() || '') });
  fields.push({ field: 'Observacao', val: String(sh.getRange(REG.OBS_INPUT).getValue() || '') });
  fields.push({ field: 'Resultado', val: String(sh.getRange(REG.RESULTADO_INPUT).getValue() || '') });

  var changes = [];
  fields.forEach(function (f) {
    var res = applyFieldToRecord(record, f.field, f.val);
    if (res.changed) changes.push({ field: f.field, oldVal: res.oldVal, newVal: res.newVal });
  });

  if (changes.length) {
    record.ultimaAtualizacao = now();
    record.usuario = user;
    record.cor = computeStatus(record, record.ultimaAtualizacao);
    writeRecord(record);
    changes.forEach(function (c) { logChange(record, c.field, c.oldVal, c.newVal, user); });
    recomputeAll();
  }

  if (!skipRender) renderRegistro();
  if (!silent) toast(changes.length ? 'Salvo ✓' : 'Nada para salvar.', 'Mission Tracker');
}

/** Navega para o próximo/anterior pesquisador (salva o atual antes). */
function navRegistro(delta) {
  var sh = getOrCreateSheet(SHEETS.REGISTRO);
  saveRegistro(sh, true, true);
  var order = sysGetJson(SYS.REGISTRO_ORDER, []);
  var index = sysGetInt(SYS.REGISTRO_INDEX, 0) + delta;
  if (order.length) {
    if (index < 0) index = 0;
    if (index > order.length - 1) index = order.length - 1;
  }
  sysSet(SYS.REGISTRO_INDEX, index);
  renderRegistro();
}
