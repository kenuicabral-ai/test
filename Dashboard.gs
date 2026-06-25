/**
 * Dashboard.gs
 * ----------------------------------------------------------------------------
 * Os dois painéis de leitura:
 *
 *  - Dashboard do LD: mini-cards de pesquisadores ordenados por urgência
 *    (Laranja > Vermelho > Amarelo > Verde > Azul > Cinza).
 *
 *  - Dashboard do LZ: indicadores por distrito. Ao tocar num indicador
 *    (checkbox), a lista abaixo mostra SOMENTE aqueles pesquisadores.
 *
 * Ambos são reconstruídos a partir da Base (fonte única), nunca cópias.
 * ----------------------------------------------------------------------------
 */

/** Layout fixo do filtro do Dashboard Zona (para o roteador mapear toques). */
var ZONA = Object.freeze({
  FILTER_START_ROW: 0,           // resolvido em runtime (após blocos de distrito)
  FILTERS: [
    { key: 'SEM_ATUALIZACAO', label: 'Sem atualização' },
    { key: 'SEM_MATCH', label: 'Sem Match' },
    { key: 'SEM_ENTREVISTA', label: 'Sem Entrevista' },
    { key: 'DATAS_CAIDAS', label: 'Datas Caídas' },
    { key: 'RESERVADOS', label: 'Reservados' }
  ]
});

/* ============================ DASHBOARD DO LD ============================ */

/** Reconstrói o Dashboard do Distrito como mini-cards ordenados. */
function renderDashboardDistrito() {
  var sh = getSheet(SHEETS.DASH_DISTRITO, true);
  var cfg = getConfig();
  var distritoAtual = cfg[CONFIG_KEYS.DISTRITO];

  var all = readAll().filter(function (p) {
    return !distritoAtual || String(p.distrito) === String(distritoAtual);
  });

  all.sort(function (a, b) {
    var pa = statusPriority(a.status || computeStatus(a));
    var pb = statusPriority(b.status || computeStatus(b));
    if (pa !== pb) return pa - pb;
    return String(a.nome).localeCompare(String(b.nome));
  });

  resetScreen(sh, 1, Math.max(20, all.length * 3 + 8));

  mergeBlock(sh, 2, '🚨 ' + distritoAtual, { bg: UI.HEADER_BG, color: UI.HEADER_TX, size: 18, bold: true, hAlign: 'center' });
  var counts = statusCounts(all);
  mergeBlock(sh, 3, '🔴 ' + counts.VERMELHO + '  🟠 ' + counts.LARANJA + '  🟡 ' + counts.AMARELO + '  🟢 ' + counts.VERDE,
    { color: UI.MUTED, size: 12, hAlign: 'center' });
  separator(sh, 4);

  if (all.length === 0) {
    mergeBlock(sh, 6, 'Sem pesquisadores neste distrito.', { hAlign: 'center', italic: true, color: UI.MUTED });
    return;
  }

  var row = 5;
  all.forEach(function (p) {
    row = miniCard(sh, row, p);
  });
}

/**
 * Desenha um mini-card (2 linhas + separador) e devolve a próxima linha livre.
 */
function miniCard(sh, row, p) {
  var st = p.status || computeStatus(p);
  var c = colorOf(st);

  mergeBlock(sh, row, c.emoji + '  ' + p.nome + '   ·   Sem ' + p.semana,
    { bg: c.bg, color: c.strong, size: 15, bold: true });

  var prox = p.proximoPasso ? ('➡ ' + p.proximoPasso) : '➡ (sem próximo passo)';
  var quando = '🕓 ' + formatUpdate(p.ultimaAtualizacao);
  mergeBlock(sh, row + 1, prox + '    ' + quando, { size: 11, color: UI.MUTED, wrap: true });

  separator(sh, row + 2);
  return row + 3;
}

/* ============================ DASHBOARD DO LZ ============================ */

/** Reconstrói o Dashboard da Zona: indicadores por distrito + filtro. */
function renderDashboardZona() {
  var sh = getSheet(SHEETS.DASH_ZONA, true);
  var cfg = getConfig();
  var all = readAll();

  resetScreen(sh, 1, Math.max(80, all.length * 3 + 50));

  mergeBlock(sh, 2, '📊 ' + cfg[CONFIG_KEYS.ZONA], { bg: UI.HEADER_BG, color: UI.HEADER_TX, size: 18, bold: true, hAlign: 'center' });
  mergeBlock(sh, 3, all.length + ' pesquisadores · ' + distritos(all).length + ' distritos', { color: UI.MUTED, size: 12, hAlign: 'center' });
  separator(sh, 4);

  // Bloco de indicadores por distrito.
  var row = 5;
  mergeBlock(sh, row++, 'INDICADORES POR DISTRITO', { color: UI.MUTED, size: 11, bold: true });

  distritos(all).forEach(function (d) {
    var grupo = all.filter(function (p) { return String(p.distrito) === String(d); });
    var ind = indicators(grupo);
    mergeBlock(sh, row++, '🏷  ' + d + '  ·  ' + grupo.length + ' pesquisadores',
      { bg: UI.FIELD_BG, size: 13, bold: true });
    var linha = '🟠 ' + ind.SEM_ATUALIZACAO + ' s/ atualização   ·   🤝 ' + ind.SEM_MATCH + ' s/ Match   ·   🎤 ' + ind.SEM_ENTREVISTA + ' s/ Entrevista';
    mergeBlock(sh, row++, linha, { size: 11, color: UI.MUTED, wrap: true });
    var linha2 = '⚪ ' + ind.DATAS_CAIDAS + ' datas caídas   ·   📌 ' + ind.RESERVADOS + ' reservados';
    mergeBlock(sh, row++, linha2, { size: 11, color: UI.MUTED, wrap: true });
  });

  separator(sh, row++);

  // Filtro global por indicador (checkboxes).
  mergeBlock(sh, row++, '🔎 FILTRAR (toque um indicador)', { color: UI.MUTED, size: 11, bold: true });

  var filterStart = row;
  var totals = indicators(all);
  ZONA.FILTERS.forEach(function (f) {
    var cell = sh.getRange(row, CARD.COL, 1, 1);
    cell.clearDataValidations();
    cell.insertCheckboxes();
    cell.setValue(getState(STATE.LZ_FILTER, '') === f.key);
    cell.setHorizontalAlignment('center');
    var lab = sh.getRange(row, CARD.COL + 1, 1, CARD.COL_WIDTH - 1);
    try { lab.breakApart(); } catch (_) {}
    lab.merge();
    lab.setValue('  ' + f.label + '   (' + totals[f.key] + ')');
    styleRange(lab, { size: 13, vAlign: 'middle' });
    row++;
  });

  // Guarda a linha inicial do filtro para o roteador.
  setState('ZONA_FILTER_START', filterStart);

  separator(sh, row++);

  // Lista filtrada.
  var active = getState(STATE.LZ_FILTER, '');
  if (active) {
    var f = filterPredicate(active);
    var matched = all.filter(f.predicate);
    mergeBlock(sh, row++, '➡ ' + f.label + ': ' + matched.length + ' pesquisador(es)', { bold: true, size: 12, color: UI.ACCENT });
    if (matched.length === 0) {
      mergeBlock(sh, row++, 'Nenhum pesquisador neste filtro. 🎉', { italic: true, color: UI.MUTED });
    } else {
      matched.sort(function (a, b) { return String(a.distrito).localeCompare(String(b.distrito)); });
      matched.forEach(function (p) { row = miniCard(sh, row, p); });
    }
  } else {
    mergeBlock(sh, row++, 'Toque em um indicador acima para ver os pesquisadores.', { italic: true, color: UI.MUTED });
  }
}

/** Manipula toque em um checkbox de filtro do Dashboard Zona. */
function handleZonaFilterEdit(e) {
  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (col !== CARD.COL) return false;
  var start = Number(getState('ZONA_FILTER_START', 0));
  if (!start) return false;
  var idx = row - start;
  if (idx < 0 || idx >= ZONA.FILTERS.length) return false;

  var checked = e.range.getValue() === true;
  var key = ZONA.FILTERS[idx].key;
  setState(STATE.LZ_FILTER, checked ? key : '');
  renderDashboardZona();
  return true;
}

/* ============================ INDICADORES ============================ */

/** Lista de distritos únicos presentes em uma lista de pesquisadores. */
function distritos(list) {
  var seen = {};
  var out = [];
  list.forEach(function (p) {
    var d = String(p.distrito || '—');
    if (!seen[d]) { seen[d] = true; out.push(d); }
  });
  out.sort();
  return out;
}

/** Conta os indicadores de uma lista. */
function indicators(list) {
  var c = { SEM_ATUALIZACAO: 0, SEM_MATCH: 0, SEM_ENTREVISTA: 0, DATAS_CAIDAS: 0, RESERVADOS: 0 };
  list.forEach(function (p) {
    ZONA.FILTERS.forEach(function (f) {
      if (filterPredicate(f.key).predicate(p)) c[f.key]++;
    });
  });
  return c;
}

/** Devolve { label, predicate } para uma chave de indicador. */
function filterPredicate(key) {
  switch (key) {
    case 'SEM_ATUALIZACAO':
      return { label: 'Sem atualização', predicate: function (p) { return (p.status || computeStatus(p)) === STATUS.LARANJA; } };
    case 'SEM_MATCH':
      return { label: 'Sem Match', predicate: function (p) { return p.semana >= 2 && !p.match && !isTerminal(p); } };
    case 'SEM_ENTREVISTA':
      return { label: 'Sem Entrevista', predicate: function (p) { return p.semana >= 3 && !p.entrevista && !isTerminal(p); } };
    case 'DATAS_CAIDAS':
      return { label: 'Datas Caídas', predicate: function (p) { return p.resultado === 'Data Caiu'; } };
    case 'RESERVADOS':
      return { label: 'Reservados', predicate: function (p) { return p.reserva === true || p.resultado === 'Reservado'; } };
    default:
      return { label: 'Todos', predicate: function () { return true; } };
  }
}

/** Pesquisador em estado terminal (batizado/caiu)? */
function isTerminal(p) {
  return p.resultado === 'Batizado' || p.resultado === 'Data Caiu';
}

/** Reconstrói os dois dashboards (chamado após qualquer alteração na Base). */
function refreshDashboards() {
  renderDashboardDistrito();
  renderDashboardZona();
}
