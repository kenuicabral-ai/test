/**
 * Dashboard.gs
 * -----------------------------------------------------------------------------
 * 🚨 Dashboard Distrito (LD): mini-cards de pesquisadores, ordenados por
 *     prioridade (Laranja, Vermelho, Amarelo, Verde, Azul, Cinza). Cada card
 *     tem um "Abrir" (checkbox) que leva direto ao Registro daquele pesquisador.
 *
 * 📊 Dashboard Zona (LZ): indicadores por distrito. Cada indicador é clicável
 *     (checkbox) e filtra o Registro/Distrito para mostrar SÓ aqueles
 *     pesquisadores. Responde: "quem está bem acompanhado e quem precisa de
 *     ajuda?".
 *
 * Tudo é renderizado em LOTE e sem aparência de tabela.
 */

/* ----------------------- Dashboard do Distrito (LD) ------------------------ */

function renderDashDistrito() {
  const sh = getOrCreateSheet(SHEETS.DASH_DISTRITO);
  prepCanvas(sh, 2);
  const span = 2;

  const distrito = getDistrito();
  const filter = sysGet(STATE.ZONA_FILTER, '');
  let records = getAllRecords().filter(function (r) {
    return !distrito || r[COL.DISTRITO - 1] === distrito;
  });
  if (filter) records = records.filter(function (r) { return matchesFilter(r, filter); });

  records.sort(function (a, b) {
    const pa = STATUS_ORDER_LD.indexOf(a[COL.COR - 1] || computeStatus(a));
    const pb = STATUS_ORDER_LD.indexOf(b[COL.COR - 1] || computeStatus(b));
    if (pa !== pb) return pa - pb;
    return String(a[COL.NOME - 1]).localeCompare(String(b[COL.NOME - 1]));
  });

  let r = 2;
  r = writeSpacer(sh, r, 8);
  r = writeBlock(sh, r, { text: '🚨 Dashboard Distrito', size: 20, bold: true, span: span, height: 38 });
  r = writeBlock(sh, r, {
    text: distrito + (filter ? '   •   filtro: ' + filterLabel(filter) : '') +
      '   •   ' + records.length + ' pesquisadores',
    size: 11, color: '#5f6368', span: span, height: 22
  });

  // Botão para limpar filtro (se houver).
  if (filter) {
    sh.getRange(r, 2).setValue('✖ Limpar filtro').setFontWeight('bold')
      .setHorizontalAlignment('center').setBackground('#f1f3f4').setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r, 3).insertCheckboxes().setValue(false).setHorizontalAlignment('center');
    sysSet('DASH_CLEAR_ROW', String(r));
    sh.setRowHeight(r, 32);
    r++;
  } else {
    sysSet('DASH_CLEAR_ROW', '0');
  }
  r = writeSpacer(sh, r, 8);

  if (!records.length) {
    writeBlock(sh, r, { text: 'Nenhum pesquisador.', size: 12, span: span, height: 32, align: 'center', bg: '#f1f3f4' });
    sysSet('DASH_CARD_MAP', JSON.stringify({}));
    return;
  }

  // Mini-cards: nome + status (col2) e "Abrir" (col3).
  const cardMap = {}; // row -> id
  records.forEach(function (rec) {
    const status = rec[COL.COR - 1] || computeStatus(rec);
    const pal = palette(status);
    const week = computeWeek(rec);
    const proximo = rec[COL.PROXIMO - 1] ? '  •  ' + rec[COL.PROXIMO - 1] : '';

    sh.getRange(r, 2).setValue(pal.label.slice(0, 2) + ' ' + rec[COL.NOME - 1])
      .setFontSize(13).setFontWeight('bold').setFontColor('#202124')
      .setBackground(pal.bg).setVerticalAlignment('middle').setWrap(true)
      .setBorder(true, true, false, true, false, false, pal.accent, SpreadsheetApp.BorderStyle.SOLID_THICK);

    const cb = sh.getRange(r, 3);
    cb.insertCheckboxes().setValue(false).setHorizontalAlignment('center')
      .setBackground(pal.bg)
      .setBorder(true, true, false, true, false, false, pal.accent, SpreadsheetApp.BorderStyle.SOLID_THICK);
    sh.setRowHeight(r, 30);
    cardMap[r] = rec[COL.ID - 1];
    r++;

    sh.getRange(r, 2, 1, span).merge()
      .setValue('Semana ' + week + '  •  ' + formatDateHuman(rec[COL.BATISMO - 1]) + proximo)
      .setFontSize(10).setFontColor('#5f6368').setBackground(pal.bg).setWrap(true)
      .setVerticalAlignment('middle')
      .setBorder(false, true, true, true, false, false, pal.accent, SpreadsheetApp.BorderStyle.SOLID_THICK);
    sh.setRowHeight(r, 26);
    r++;
    r = writeSpacer(sh, r, 6);
  });

  sysSet('DASH_CARD_MAP', JSON.stringify(cardMap));
  sh.setColumnWidth(2, 250);
  sh.setColumnWidth(3, 90);
}

/** onEdit do Dashboard Distrito: "Abrir" um card ou "Limpar filtro". */
function handleDashDistritoEdit(e) {
  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (col !== 3) return;
  if (!toBool(e.value)) return;
  e.range.setValue(false);

  const clearRow = Number(sysGet('DASH_CLEAR_ROW', 0));
  if (clearRow && row === clearRow) {
    sysSet(STATE.ZONA_FILTER, '');
    buildNavList();
    renderDashDistrito();
    return;
  }

  const map = JSON.parse(sysGet('DASH_CARD_MAP', '{}'));
  const id = map[row];
  if (id) {
    buildNavList();
    openResearcher(id);
  }
}

/* ------------------------- Dashboard da Zona (LZ) -------------------------- */

function filterLabel(key) {
  switch (key) {
    case 'TOTAL': return 'Todos';
    case 'SEM_ATUALIZACAO': return 'Sem atualização';
    case 'SEM_MATCH': return 'Sem Match';
    case 'SEM_ENTREVISTA': return 'Sem Entrevista';
    case 'DATA_CAIU': return 'Datas caídas';
    case 'RESERVADO': return 'Reservados';
    default: return key;
  }
}

/** Calcula os indicadores de um conjunto de records. */
function computeIndicators(records) {
  const ind = {
    TOTAL: records.length,
    SEM_ATUALIZACAO: 0, SEM_MATCH: 0, SEM_ENTREVISTA: 0, DATA_CAIU: 0, RESERVADO: 0
  };
  records.forEach(function (r) {
    const status = r[COL.COR - 1] || computeStatus(r);
    const week = computeWeek(r);
    const res = r[COL.RESULTADO - 1];
    const ativo = res !== RESULTADO.BATIZADO && res !== RESULTADO.DATA_CAIU;
    if (status === STATUS.LARANJA) ind.SEM_ATUALIZACAO++;
    if (ativo && week >= 2 && !toBool(r[COL.MATCH - 1])) ind.SEM_MATCH++;
    if (ativo && week >= 3 && !toBool(r[COL.ENTREVISTA - 1])) ind.SEM_ENTREVISTA++;
    if (res === RESULTADO.DATA_CAIU) ind.DATA_CAIU++;
    if (res === RESULTADO.RESERVADO) ind.RESERVADO++;
  });
  return ind;
}

function renderDashZona() {
  const sh = getOrCreateSheet(SHEETS.DASH_ZONA);
  prepCanvas(sh, 3);
  const span = 3;

  const records = getAllRecords();
  const distritos = uniqueDistricts(records);

  let r = 2;
  r = writeSpacer(sh, r, 8);
  r = writeBlock(sh, r, { text: '📊 Dashboard Zona', size: 20, bold: true, span: span, height: 38 });
  r = writeBlock(sh, r, { text: 'Visão da qualidade do acompanhamento', size: 11, color: '#5f6368', span: span, height: 22 });
  r = writeSpacer(sh, r, 8);

  const indicatorDefs = [
    { key: 'TOTAL', label: 'Quantidade', icon: '👥' },
    { key: 'SEM_ATUALIZACAO', label: 'Sem atualização', icon: '🟠' },
    { key: 'SEM_MATCH', label: 'Sem Match', icon: '🤝' },
    { key: 'SEM_ENTREVISTA', label: 'Sem Entrevista', icon: '🗣️' },
    { key: 'DATA_CAIU', label: 'Datas caídas', icon: '⚪' },
    { key: 'RESERVADO', label: 'Reservados', icon: '🔵' }
  ];

  const clickMap = {}; // row -> {distrito, key}

  distritos.forEach(function (distrito) {
    const recs = records.filter(function (x) { return x[COL.DISTRITO - 1] === distrito; });
    const ind = computeIndicators(recs);

    r = writeBlock(sh, r, { text: '🏷️ ' + distrito, size: 14, bold: true, span: span, height: 30, bg: '#e8eaed' });

    indicatorDefs.forEach(function (def) {
      sh.getRange(r, 2).setValue(def.icon + '  ' + def.label)
        .setFontSize(12).setVerticalAlignment('middle');
      sh.getRange(r, 3).setValue(ind[def.key])
        .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle')
        .setFontColor(ind[def.key] > 0 && def.key !== 'TOTAL' && def.key !== 'RESERVADO' ? '#EA4335' : '#202124');
      const cb = sh.getRange(r, 4);
      cb.insertCheckboxes().setValue(false).setHorizontalAlignment('center').setVerticalAlignment('middle');
      sh.getRange(r, 2, 1, span).setBackground('#f8f9fa')
        .setBorder(true, true, true, true, false, false, '#e8eaed', SpreadsheetApp.BorderStyle.SOLID);
      sh.setRowHeight(r, 30);
      clickMap[r] = { distrito: distrito, key: def.key };
      r++;
    });
    r = writeSpacer(sh, r, 10);
  });

  sysSet('ZONA_CLICK_MAP', JSON.stringify(clickMap));
  sh.setColumnWidth(2, 200);
  sh.setColumnWidth(3, 70);
  sh.setColumnWidth(4, 70);
}

/** onEdit do Dashboard Zona: clicar indicador -> filtra Distrito + Registro. */
function handleDashZonaEdit(e) {
  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (col !== 4) return;
  if (!toBool(e.value)) return;
  e.range.setValue(false);

  const map = JSON.parse(sysGet('ZONA_CLICK_MAP', '{}'));
  const entry = map[row];
  if (!entry) return;

  setConfig(CONFIG_KEYS.DISTRITO, entry.distrito);
  sysSet(STATE.ZONA_FILTER, entry.key === 'TOTAL' ? '' : entry.key);
  buildNavList();
  renderDashDistrito();
  const sh = getSheet(SHEETS.DASH_DISTRITO);
  if (sh) ss().setActiveSheet(sh);
}

function uniqueDistricts(records) {
  const set = {};
  records.forEach(function (r) {
    const d = r[COL.DISTRITO - 1];
    if (d) set[d] = true;
  });
  const arr = Object.keys(set);
  if (!arr.length) arr.push(getDistrito());
  arr.sort();
  return arr;
}

/* ------------------------------ Home (resumo) ------------------------------ */

function renderHome() {
  const sh = getOrCreateSheet(SHEETS.HOME);
  prepCanvas(sh, 2);
  const span = 2;

  const distrito = getDistrito();
  const records = getAllRecords();
  const counts = statusCounts(records, distrito);

  let r = 3;
  r = writeBlock(sh, r, { text: 'Mission Tracker', size: 26, bold: true, span: span, height: 50, align: 'center' });
  r = writeBlock(sh, r, { text: distrito, size: 14, color: '#5f6368', span: span, height: 26, align: 'center' });
  r = writeSpacer(sh, r, 14);
  r = writeBlock(sh, r, { text: 'Hoje existem', size: 13, color: '#5f6368', span: span, height: 24, align: 'center' });

  const rows = [
    { k: STATUS.VERMELHO, n: counts[STATUS.VERMELHO], t: 'críticos' },
    { k: STATUS.LARANJA, n: counts[STATUS.LARANJA], t: 'sem atualização' },
    { k: STATUS.AMARELO, n: counts[STATUS.AMARELO], t: 'pendentes' },
    { k: STATUS.VERDE, n: counts[STATUS.VERDE], t: 'em dia' }
  ];
  rows.forEach(function (row) {
    const pal = palette(row.k);
    sh.getRange(r, 2, 1, span).merge()
      .setValue(pal.label.slice(0, 2) + '   ' + row.n + '   ' + row.t)
      .setFontSize(16).setFontWeight('bold').setFontColor(pal.accent)
      .setBackground(pal.bg).setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sh.setRowHeight(r, 44);
    r++;
    r = writeSpacer(sh, r, 4);
  });

  // Linha extra: batizados / datas caídas (contexto).
  r = writeSpacer(sh, r, 6);
  r = writeBlock(sh, r, {
    text: '🔵 ' + counts[STATUS.AZUL] + ' batizados   •   ⚪ ' + counts[STATUS.CINZA] + ' datas caídas',
    size: 11, color: '#5f6368', span: span, height: 24, align: 'center'
  });
  r = writeSpacer(sh, r, 16);

  // Botão COMEÇAR REGISTROS: rótulo grande (sem checkbox) + linha com a
  // checkbox-ação ao lado (evita inserir checkbox em célula mesclada).
  sh.getRange(r, 2, 1, span).merge().setValue('▶  ' + BTN.COMECAR)
    .setFontSize(16).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1A73E8')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(r, 38);
  r++;
  sh.getRange(r, 2).setValue('Toque para iniciar →').setFontColor('#1A73E8')
    .setBackground('#E8F0FE').setVerticalAlignment('middle').setHorizontalAlignment('center')
    .setBorder(true, true, true, false, false, false, '#1A73E8', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(r, 3).insertCheckboxes().setValue(false)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#E8F0FE')
    .setBorder(true, false, true, true, false, false, '#1A73E8', SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(r, 36);
  sysSet('HOME_START_ROW', String(r));
  sysSet('HOME_START_COL', '3');

  sh.setColumnWidth(2, 180);
  sh.setColumnWidth(3, 180);
}

/** onEdit da Home: botão COMEÇAR REGISTROS. */
function handleHomeEdit(e) {
  const row = e.range.getRow();
  const startRow = Number(sysGet('HOME_START_ROW', 0));
  if (row !== startRow) return;
  if (!toBool(e.value)) return;
  e.range.setValue(false);
  buildNavList();
  const ids = cacheGetList(STATE.CURRENT_LIST);
  if (ids.length) openResearcher(ids[0]);
  else { renderRegistroEmpty(); const s = getSheet(SHEETS.REGISTRO); if (s) ss().setActiveSheet(s); }
}
