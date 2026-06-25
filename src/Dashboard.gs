/**
 * Dashboard.gs
 * Renderização das telas de leitura: Home, Dashboard do Distrito (LD)
 * e Dashboard da Zona (LZ). Tudo em cards, nunca tabelas.
 */

/* Células de controle das dashboards. */
var HOME = { BTN_START: 'A10', BTN_REFRESH: 'A11', COLS: 6 };
var DIST = { BTN_REFRESH: 'A3', COLS: 6, LIST_START: 5 };
var ZONA = { BTN_REFRESH: 'A2', BTN_EMAIL: 'D2', COLS: 6, IND_START: 5, LIST_START: 13 };

/* ----------------------------------------------------------------------- */
/* HOME                                                                    */
/* ----------------------------------------------------------------------- */

function renderHome() {
  var sh = getOrCreateSheet(SHEETS.HOME);
  var cfg = getConfig();
  var counts = recomputeAll();

  prepareCanvas(sh, HOME.COLS, 13, 80);
  drawHeader(sh, HOME.COLS, '🏠 Mission Tracker', cfg.distrito);

  drawSeparator(sh, 2, HOME.COLS);
  drawSectionTitle(sh, 3, HOME.COLS, 'Hoje existem');

  drawCountCard(sh, 4, STATUS.VERMELHO, counts.VERMELHO, 'críticos');
  drawCountCard(sh, 5, STATUS.LARANJA, counts.LARANJA, 'sem atualização');
  drawCountCard(sh, 6, STATUS.AMARELO, counts.AMARELO, 'pendentes');
  drawCountCard(sh, 7, STATUS.VERDE, counts.VERDE, 'em dia');

  mergeRow(sh, 8, 1, HOME.COLS)
    .setValue('🔵 ' + counts.AZUL + ' batizados   ·   ⚪ ' + counts.CINZA + ' datas caídas   ·   ⭐ ' + counts.RESERVADOS + ' reservados')
    .setBackground(UI.PANEL_BG).setFontColor(UI.LABEL_FG)
    .setFontSize(11).setHorizontalAlignment('center');

  drawSeparator(sh, 9, HOME.COLS);

  // Botão grande COMEÇAR REGISTROS
  sh.setRowHeight(10, 48);
  sh.getRange(HOME.BTN_START).insertCheckboxes().setValue(false)
    .setBackground(UI.BTN_BG).setHorizontalAlignment('center');
  sh.getRange(10, 2, 1, HOME.COLS - 1).merge()
    .setValue('▶  COMEÇAR REGISTROS')
    .setBackground(UI.BTN_BG).setFontColor(UI.BTN_FG)
    .setFontSize(15).setFontWeight('bold').setHorizontalAlignment('center');

  drawButtonRow(sh, 11, HOME.COLS, '🔄 Atualizar');

  mergeRow(sh, 12, 1, HOME.COLS)
    .setValue('Atualizado: ' + formatUpdate(now()))
    .setBackground(UI.PANEL_BG).setFontColor(UI.LABEL_FG)
    .setFontSize(9).setHorizontalAlignment('center');

  SpreadsheetApp.flush();
}

function drawCountCard(sh, row, status, number, label) {
  sh.setRowHeight(row, 40);
  sh.getRange(row, 1, 1, 2).merge()
    .setValue(statusIcon(status) + ' ' + (number || 0))
    .setBackground(statusBg(status)).setFontColor(statusFg(status))
    .setFontSize(20).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(row, 3, 1, 4).merge()
    .setValue(label)
    .setBackground(statusSoft(status)).setFontColor(statusBg(status))
    .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('left');
}

function handleHomeEdit(e) {
  var a1 = e.range.getA1Notation();
  var sh = e.range.getSheet();
  if (a1 === HOME.BTN_START && e.range.isChecked()) {
    sh.getRange(HOME.BTN_START).setValue(false);
    goToRegistro();
    return;
  }
  if (a1 === HOME.BTN_REFRESH && e.range.isChecked()) {
    sh.getRange(HOME.BTN_REFRESH).setValue(false);
    renderHome();
    return;
  }
}

/* ----------------------------------------------------------------------- */
/* DASHBOARD DO DISTRITO (LD)                                              */
/* ----------------------------------------------------------------------- */

function renderDistrito() {
  var sh = getOrCreateSheet(SHEETS.DASH_DISTRITO);
  var cfg = getConfig();
  var ref = now();
  var counts = recomputeAll();

  var all = readAll();
  all.sort(function (a, b) {
    var pa = STATUS_ORDER.indexOf(computeStatus(a, ref, cfg));
    var pb = STATUS_ORDER.indexOf(computeStatus(b, ref, cfg));
    if (pa !== pb) return pa - pb;
    return a.nome.localeCompare(b.nome);
  });

  var totalRows = DIST.LIST_START + Math.max(all.length, 1) + 1;
  prepareCanvas(sh, DIST.COLS, totalRows, 80);
  drawHeader(sh, DIST.COLS, '🚨 Dashboard Distrito', cfg.distrito);

  mergeRow(sh, 2, 1, DIST.COLS)
    .setValue('🟠 ' + counts.LARANJA + '   🔴 ' + counts.VERMELHO +
      '   🟡 ' + counts.AMARELO + '   🟢 ' + counts.VERDE)
    .setBackground(UI.PANEL_BG).setFontColor(UI.VALUE_FG)
    .setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center');

  drawButtonRow(sh, 3, DIST.COLS, '🔄 Atualizar');
  drawSeparator(sh, 4, DIST.COLS);

  if (!all.length) {
    mergeRow(sh, DIST.LIST_START, 1, DIST.COLS)
      .setValue('Nenhum pesquisador cadastrado.')
      .setHorizontalAlignment('center').setFontColor(UI.LABEL_FG);
  } else {
    renderResearcherList(sh, DIST.LIST_START, all, ref, cfg);
  }

  SpreadsheetApp.flush();
}

function handleDistritoEdit(e) {
  var a1 = e.range.getA1Notation();
  if (a1 === DIST.BTN_REFRESH && e.range.isChecked()) {
    e.range.getSheet().getRange(DIST.BTN_REFRESH).setValue(false);
    renderDistrito();
  }
}

/* ----------------------------------------------------------------------- */
/* DASHBOARD DA ZONA (LZ)                                                  */
/* ----------------------------------------------------------------------- */

function renderZona() {
  var sh = getOrCreateSheet(SHEETS.DASH_ZONA);
  var cfg = getConfig();
  var ref = now();
  var counts = recomputeAll();
  var all = readAll();

  var filter = String(sysGet(SYS.ZONA_FILTER, 'TOTAL'));
  var filtered = filterResearchers(all, filter, ref, cfg);

  var totalRows = ZONA.LIST_START + Math.max(filtered.length, 1) + 1;
  prepareCanvas(sh, ZONA.COLS, totalRows, 80);
  drawHeader(sh, ZONA.COLS, '📊 Dashboard Zona', cfg.distrito);

  // Botões: atualizar + e-mail
  sh.getRange(ZONA.BTN_REFRESH).insertCheckboxes().setValue(false)
    .setBackground(UI.BTN_BG).setHorizontalAlignment('center');
  sh.getRange(2, 2, 1, 2).merge().setValue('🔄 Atualizar')
    .setBackground(UI.CARD_BG).setFontColor(UI.BTN_BG)
    .setFontSize(12).setFontWeight('bold').setHorizontalAlignment('left');
  sh.getRange(ZONA.BTN_EMAIL).insertCheckboxes().setValue(false)
    .setBackground(UI.BTN_BG).setHorizontalAlignment('center');
  sh.getRange(2, 5, 1, 2).merge().setValue('📧 Resumo')
    .setBackground(UI.CARD_BG).setFontColor(UI.BTN_BG)
    .setFontSize(12).setFontWeight('bold').setHorizontalAlignment('left');

  drawSeparator(sh, 3, ZONA.COLS);
  drawSectionTitle(sh, 4, ZONA.COLS, '📈 INDICADORES — toque para filtrar');

  ZONA_INDICADORES.forEach(function (ind, i) {
    var row = ZONA.IND_START + i;
    var value = indicatorValue(counts, ind.key);
    var active = (filter === ind.key);
    sh.getRange(row, 1).insertCheckboxes().setValue(active)
      .setBackground(UI.CARD_BG).setHorizontalAlignment('center');
    sh.getRange(row, 2, 1, 3).merge()
      .setValue(ind.label)
      .setBackground(active ? '#E8F0FE' : UI.CARD_BG)
      .setFontColor(UI.VALUE_FG).setFontSize(12)
      .setFontWeight(active ? 'bold' : 'normal').setHorizontalAlignment('left');
    sh.getRange(row, 5, 1, 2).merge()
      .setValue(value)
      .setBackground(active ? '#E8F0FE' : UI.CARD_BG)
      .setFontColor(UI.BTN_BG).setFontSize(14).setFontWeight('bold')
      .setHorizontalAlignment('center');
  });

  drawSeparator(sh, ZONA.IND_START + ZONA_INDICADORES.length, ZONA.COLS);
  var listTitleRow = ZONA.IND_START + ZONA_INDICADORES.length + 1; // 12
  drawSectionTitle(sh, listTitleRow, ZONA.COLS,
    '👥 ' + filterLabel(filter) + ' (' + filtered.length + ')');

  if (!filtered.length) {
    mergeRow(sh, ZONA.LIST_START, 1, ZONA.COLS)
      .setValue('Nenhum pesquisador neste filtro.')
      .setHorizontalAlignment('center').setFontColor(UI.LABEL_FG);
  } else {
    renderResearcherList(sh, ZONA.LIST_START, filtered, ref, cfg);
  }

  SpreadsheetApp.flush();
}

function handleZonaEdit(e) {
  var a1 = e.range.getA1Notation();
  var sh = e.range.getSheet();
  if (a1 === ZONA.BTN_REFRESH && e.range.isChecked()) {
    sh.getRange(ZONA.BTN_REFRESH).setValue(false);
    renderZona();
    return;
  }
  if (a1 === ZONA.BTN_EMAIL && e.range.isChecked()) {
    sh.getRange(ZONA.BTN_EMAIL).setValue(false);
    sendResumoLZ();
    return;
  }
  var m = a1.match(/^A(\d+)$/);
  if (m) {
    var idx = Number(m[1]) - ZONA.IND_START;
    if (idx >= 0 && idx < ZONA_INDICADORES.length && e.range.isChecked()) {
      sysSet(SYS.ZONA_FILTER, ZONA_INDICADORES[idx].key);
      renderZona();
    }
  }
}

/* ----------------------------------------------------------------------- */
/* Lista de cards de pesquisador (compartilhada)                           */
/* ----------------------------------------------------------------------- */

function renderResearcherList(sh, startRow, records, ref, cfg) {
  records.forEach(function (r, i) {
    var row = startRow + i;
    var status = computeStatus(r, ref, cfg);
    sh.setRowHeight(row, 38);

    sh.getRange(row, 1)
      .setValue(statusIcon(status))
      .setBackground(statusSoft(status)).setFontColor(statusBg(status))
      .setFontSize(14).setHorizontalAlignment('center');

    sh.getRange(row, 2, 1, 2).merge()
      .setValue(r.nome)
      .setBackground(UI.CARD_BG).setFontColor(UI.VALUE_FG)
      .setFontSize(12).setFontWeight('bold').setHorizontalAlignment('left');

    sh.getRange(row, 4)
      .setValue('S' + (Number(r.semana) || 1))
      .setBackground(UI.CARD_BG).setFontColor(UI.LABEL_FG)
      .setFontSize(11).setHorizontalAlignment('center');

    sh.getRange(row, 5, 1, 2).merge()
      .setValue(statusReason(r, status, ref, cfg))
      .setBackground(UI.CARD_BG).setFontColor(UI.LABEL_FG)
      .setFontSize(10).setHorizontalAlignment('left').setWrap(true);
  });
}

/* ----------------------------------------------------------------------- */
/* Filtros / indicadores                                                   */
/* ----------------------------------------------------------------------- */

function indicatorValue(counts, key) {
  switch (key) {
    case 'TOTAL': return counts.TOTAL;
    case 'SEM_ATUALIZACAO': return counts.SEM_ATUALIZACAO;
    case 'SEM_MATCH': return counts.SEM_MATCH;
    case 'SEM_ENTREVISTA': return counts.SEM_ENTREVISTA;
    case 'DATAS_CAIDAS': return counts.DATAS_CAIDAS;
    case 'RESERVADOS': return counts.RESERVADOS;
    default: return 0;
  }
}

function filterResearchers(all, key, ref, cfg) {
  return all.filter(function (r) {
    switch (key) {
      case 'SEM_ATUALIZACAO': return computeStatus(r, ref, cfg) === STATUS.LARANJA;
      case 'SEM_MATCH': return !isTerminal(r) && r.semana >= 2 && !r.match;
      case 'SEM_ENTREVISTA': return !isTerminal(r) && r.semana >= 3 && !r.entrevista;
      case 'DATAS_CAIDAS': return r.resultado === RESULTADO.DATA_CAIDA;
      case 'RESERVADOS': return r.resultado === RESULTADO.RESERVADO;
      default: return true; // TOTAL
    }
  });
}

function filterLabel(key) {
  for (var i = 0; i < ZONA_INDICADORES.length; i++) {
    if (ZONA_INDICADORES[i].key === key) return ZONA_INDICADORES[i].label;
  }
  return '👥 Quantidade';
}
