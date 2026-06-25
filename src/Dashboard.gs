/**
 * Dashboard.gs
 * ---------------------------------------------------------------------------
 * As três telas de leitura, todas alimentadas pela ÚNICA base:
 *
 *   🏠 Home              -> "O que existe hoje?" + botão COMEÇAR REGISTROS
 *   🚨 Dashboard Distrito -> cards do LD, ordenados por prioridade
 *   📊 Dashboard Zona     -> indicadores do LZ + drill-down por indicador
 *
 * Nenhuma tela copia linhas. Todas leem a Base, recalculam em memória e
 * desenham um visual de aplicativo (cards/chips), nunca uma tabela crua.
 * ---------------------------------------------------------------------------
 */

/** Reconstrói as três telas a partir da Base (chamado após qualquer edição). */
function refreshAllDashboards_() {
  const cfg = getConfig_();
  const records = recomputeRecords_(readAllRecords_(), cfg, new Date());
  persistComputedColumns_(records);
  renderHome_(records, cfg);
  renderDashLD_(records, cfg);
  renderDashLZ_(records, cfg);
}

/* --------------------------------- HOME --------------------------------- */

const HOME_ROWS = {
  TITLE: 2, SUB: 3, HEADLINE: 5,
  STAT_CRIT: 7, STAT_LARANJA: 8, STAT_AMARELO: 9, STAT_VERDE: 10,
  STAT_AZUL: 11, STAT_CINZA: 12,
  BTN: 14,
};

/** Desenha a Home com cara de app. */
function renderHome_(records, cfg) {
  const sh = getSheet_(SHEETS.HOME);
  resetSheet_(sh, HOME_ROWS.BTN + 6, 6);
  setColumnLayout_(sh);
  sh.setHiddenGridlines(true);
  paintCanvas_(sh, HOME_ROWS.BTN + 4, 6);

  const counts = countByStatus_(records);

  writeTitle_(sh, HOME_ROWS.TITLE, APP.NAME, cfg.distrito);
  mergeRow_(sh, HOME_ROWS.HEADLINE, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue('Hoje existem').setFontSize(13).setFontColor(UI.SUBTLE);

  drawStat_(sh, HOME_ROWS.STAT_CRIT, STATUS.CRITICO, counts.CRITICO, 'críticos');
  drawStat_(sh, HOME_ROWS.STAT_LARANJA, STATUS.SEM_ATUALIZACAO, counts.SEM_ATUALIZACAO, 'sem atualização');
  drawStat_(sh, HOME_ROWS.STAT_AMARELO, STATUS.PENDENTE, counts.PENDENTE, 'pendentes');
  drawStat_(sh, HOME_ROWS.STAT_VERDE, STATUS.EM_DIA, counts.EM_DIA, 'em dia');
  drawStat_(sh, HOME_ROWS.STAT_AZUL, STATUS.BATIZADO, counts.BATIZADO, 'batizados');
  drawStat_(sh, HOME_ROWS.STAT_CINZA, STATUS.CAIU, counts.CAIU, 'datas caídas');

  // Botão COMEÇAR REGISTROS (checkbox em B + bloco rotulado C:E)
  sh.getRange(HOME_ROWS.BTN, 2).insertCheckboxes().setValue(false);
  drawButtonBlock_(sh, HOME_ROWS.BTN, 3, 3, ACTIONS.START_RECORDS, UI.BUTTON, UI.BUTTON_TEXT);
}

/** Linha-estatística da Home (emoji grande + número + rótulo). */
function drawStat_(sh, row, statusKey, count, label) {
  const meta = statusMeta_(statusKey);
  const c = mergeRow_(sh, row, REG.COL_LABEL, REG.WIDTH_FIRST);
  c.setValue(meta.emoji + '   ' + count + '  ' + label)
    .setFontSize(15).setFontWeight('bold').setFontColor(meta.text)
    .setBackground(meta.soft)
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, UI.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(row, 36);
}

/** Trata clique no botão COMEÇAR REGISTROS. */
function handleHomeEdit_(e) {
  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row === HOME_ROWS.BTN && col === 2) {
    try { e.range.setValue(false); } catch (ignore) {}
    startRegistros_();
    return true;
  }
  return false;
}

/* --------------------------- DASHBOARD DISTRITO ------------------------- */

/** Cards do LD: apenas pesquisadores, ordenados por prioridade. */
function renderDashLD_(records, cfg) {
  const sh = getSheet_(SHEETS.DASH_LD);
  resetSheet_(sh, 200, 6);
  setColumnLayout_(sh);
  sh.setHiddenGridlines(true);

  // Apenas o distrito configurado, ainda em acompanhamento.
  const list = sortForLD_(records.filter(function (r) {
    return s_(r['Distrito']) === s_(cfg.distrito) &&
      r['Resultado'] !== RESULTADO.BATIZADO && r['Resultado'] !== RESULTADO.CAIU;
  }));

  writeTitle_(sh, REG.ROWS.TITLE, '🚨 Distrito', cfg.distrito + '  •  ' + list.length + ' pesquisadores');

  let row = 5;
  if (!list.length) {
    mergeRow_(sh, row, REG.COL_LABEL, REG.WIDTH_FIRST)
      .setValue('Tudo tranquilo por aqui. 🎉').setFontSize(14).setFontColor(UI.SUBTLE);
    paintCanvas_(sh, row + 2, 6);
    return;
  }

  list.forEach(function (rec) {
    row = drawLDCard_(sh, row, rec);
  });
  paintCanvas_(sh, row + 2, 6);
}

/** Desenha um card pequeno de pesquisador no dashboard do LD. */
function drawLDCard_(sh, row, rec) {
  const meta = statusMeta_(rec['Status']);

  // Linha 1: emoji + Nome + Semana
  const head = mergeRow_(sh, row, REG.COL_LABEL, 3);
  head.setValue(meta.emoji + '  ' + s_(rec['Nome']) + '   •   Semana ' + s_(rec['Semana']))
    .setFontSize(14).setFontWeight('bold').setFontColor(UI.TITLE)
    .setBackground(meta.soft).setVerticalAlignment('middle');
  sh.getRange(row, REG.COL_CTRL).setValue(meta.emoji)
    .setBackground(meta.soft).setHorizontalAlignment('center');
  sh.setRowHeight(row, 30);

  // Linha 2: pendência / próximo passo
  const detail = missingMilestones_(rec, rec['Semana']);
  let sub;
  if (detail.length) sub = '⚠ Falta: ' + detail.join(', ');
  else if (s_(rec['Próximo Passo'])) sub = '→ ' + s_(rec['Próximo Passo']);
  else sub = 'Atualizado ' + formatRelative_(rec['Última Atualização']);
  mergeRow_(sh, row + 1, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue(sub).setFontSize(11).setFontColor(meta.text)
    .setBackground(meta.soft).setWrap(true);
  sh.setRowHeight(row + 1, 24);

  // Respiro entre cards
  sh.setRowHeight(row + 2, 6);
  return row + 3;
}

/* ----------------------------- DASHBOARD ZONA --------------------------- */

const LZ = {
  ROWS: {
    TITLE: 2, SUB: 3,
    IND_START: 5,
    IND_END: 40,
    DRILL_HDR: 42,
    DRILL_DISTRICT: 43,
    DRILL_METRIC: 44,
    RESULTS_HDR: 46,
    RESULTS_START: 47,
    RESULTS_END: 90,
  },
  METRICS: ['Quantidade', 'Sem atualização', 'Sem Match', 'Sem Entrevista', 'Datas Caídas', 'Reservados'],
  TODOS: 'Todos os distritos',
};

/** Indicadores do LZ + drill-down. */
function renderDashLZ_(records, cfg) {
  const sh = getSheet_(SHEETS.DASH_LZ);
  // Preserva seleção de drill-down já feita pelo usuário.
  const prevDistrict = s_(sh.getRange(LZ.ROWS.DRILL_DISTRICT, REG.COL_VALUE).getValue());
  const prevMetric = s_(sh.getRange(LZ.ROWS.DRILL_METRIC, REG.COL_VALUE).getValue());

  resetSheet_(sh, LZ.ROWS.RESULTS_END + 6, 6);
  setColumnLayout_(sh);
  sh.setHiddenGridlines(true);

  writeTitle_(sh, LZ.ROWS.TITLE, '📊 Zona', cfg.zona);

  const districts = distinctDistricts_(records);
  const byDistrict = metricsByDistrict_(records);

  // Blocos de indicadores por distrito.
  let row = LZ.ROWS.IND_START;
  districts.forEach(function (d) {
    if (row > LZ.ROWS.IND_END - 3) return;
    row = drawLZBlock_(sh, row, d, byDistrict[d]);
  });

  // Área de drill-down (seletores).
  drawDivider_(sh, LZ.ROWS.DRILL_HDR - 1);
  mergeRow_(sh, LZ.ROWS.DRILL_HDR, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue('🔎 Ver pesquisadores de um indicador')
    .setFontSize(12).setFontWeight('bold').setFontColor(UI.TITLE);

  const districtOptions = [LZ.TODOS].concat(districts);
  drawSelector_(sh, LZ.ROWS.DRILL_DISTRICT, 'Distrito', districtOptions,
    districtOptions.indexOf(prevDistrict) >= 0 ? prevDistrict : LZ.TODOS);
  drawSelector_(sh, LZ.ROWS.DRILL_METRIC, 'Indicador', LZ.METRICS,
    LZ.METRICS.indexOf(prevMetric) >= 0 ? prevMetric : LZ.METRICS[0]);

  // Resultados do drill-down.
  renderLZResults_(sh, records, cfg);
}

/** Bloco compacto de indicadores de um distrito. */
function drawLZBlock_(sh, row, district, m) {
  mergeRow_(sh, row, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue('📍 ' + district + '   •   ' + m.total + ' pesquisadores')
    .setFontSize(13).setFontWeight('bold').setFontColor(UI.TITLE)
    .setBackground(UI.ACCENT_SOFT);
  sh.setRowHeight(row, 28);

  const chips = [
    ['🟠 Sem att', m.semAtt],
    ['🔗 Sem Match', m.semMatch],
    ['🎤 Sem Entrev', m.semEntrev],
    ['⚪ Caídas', m.caidas],
    ['📌 Reservados', m.reservados],
  ];
  // Duas colunas de chips (B:C e D:E).
  for (let i = 0; i < chips.length; i++) {
    const r = row + 1 + Math.floor(i / 2);
    const startCol = (i % 2 === 0) ? REG.COL_LABEL : REG.COL_VALUE;
    sh.getRange(r, startCol, 1, 2).merge()
      .setValue(chips[i][0] + ': ' + chips[i][1])
      .setFontSize(11).setFontColor(UI.TITLE)
      .setBackground(UI.CARD).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false, UI.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  }
  const used = Math.ceil(chips.length / 2);
  return row + 1 + used + 1; // bloco + respiro
}

/** Seletor (rótulo + dropdown) reutilizável. */
function drawSelector_(sh, row, label, options, value) {
  sh.getRange(row, REG.COL_LABEL).setValue(label)
    .setFontColor(UI.SUBTLE).setFontSize(11);
  const cell = sh.getRange(row, REG.COL_VALUE, 1, 2).merge();
  cell.setFontSize(13).setFontWeight('bold').setFontColor(UI.ACCENT)
    .setBackground(UI.ACCENT_SOFT)
    .setBorder(true, true, true, true, false, false, UI.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true).setAllowInvalid(false).build();
  sh.getRange(row, REG.COL_VALUE).setDataValidation(rule).setValue(value);
}

/** Renderiza a lista filtrada conforme os seletores. */
function renderLZResults_(sh, records, cfg) {
  // Limpa área de resultados.
  sh.getRange(LZ.ROWS.RESULTS_HDR, 1,
    LZ.ROWS.RESULTS_END - LZ.ROWS.RESULTS_HDR + 1, 6).clearContent().setBackground(UI.CANVAS);

  const district = s_(sh.getRange(LZ.ROWS.DRILL_DISTRICT, REG.COL_VALUE).getValue()) || LZ.TODOS;
  const metric = s_(sh.getRange(LZ.ROWS.DRILL_METRIC, REG.COL_VALUE).getValue()) || LZ.METRICS[0];

  let pool = records;
  if (district !== LZ.TODOS) {
    pool = pool.filter(function (r) { return s_(r['Distrito']) === district; });
  }
  const filtered = filterByMetric_(pool, metric);

  mergeRow_(sh, LZ.ROWS.RESULTS_HDR, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue(metric + ' — ' + filtered.length + ' pesquisador(es)' +
      (district !== LZ.TODOS ? ' em ' + district : ''))
    .setFontSize(12).setFontWeight('bold').setFontColor(UI.TITLE);

  let row = LZ.ROWS.RESULTS_START;
  filtered.forEach(function (rec) {
    if (row > LZ.ROWS.RESULTS_END) return;
    const meta = statusMeta_(rec['Status']);
    mergeRow_(sh, row, REG.COL_LABEL, REG.WIDTH_FIRST)
      .setValue(meta.emoji + '  ' + s_(rec['Nome']) + '   •   ' + s_(rec['Distrito']) +
        '   •   Semana ' + s_(rec['Semana']))
      .setFontSize(12).setFontColor(UI.TITLE)
      .setBackground(meta.soft)
      .setBorder(true, true, true, true, false, false, UI.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sh.setRowHeight(row, 26);
    row++;
  });
  if (!filtered.length) {
    mergeRow_(sh, row, REG.COL_LABEL, REG.WIDTH_FIRST)
      .setValue('Nenhum pesquisador neste indicador. 🎉')
      .setFontSize(12).setFontColor(UI.SUBTLE);
  }
}

/** Filtra registros por indicador do LZ. */
function filterByMetric_(records, metric) {
  switch (metric) {
    case 'Sem atualização':
      return records.filter(function (r) { return r['Status'] === STATUS.SEM_ATUALIZACAO; });
    case 'Sem Match':
      return records.filter(function (r) {
        return isActive_(r) && r['Semana'] >= 2 && !r['Match'];
      });
    case 'Sem Entrevista':
      return records.filter(function (r) {
        return isActive_(r) && r['Semana'] >= 3 && !r['Entrevista'];
      });
    case 'Datas Caídas':
      return records.filter(function (r) { return r['Resultado'] === RESULTADO.CAIU; });
    case 'Reservados':
      return records.filter(function (r) { return r['Resultado'] === RESULTADO.RESERVADO; });
    case 'Quantidade':
    default:
      return records.filter(isActive_);
  }
}

/** Trata mudança nos seletores do LZ (drill-down). */
function handleDashLZEdit_(e) {
  const row = e.range.getRow();
  const col = e.range.getColumn();
  if ((row === LZ.ROWS.DRILL_DISTRICT || row === LZ.ROWS.DRILL_METRIC) && col === REG.COL_VALUE) {
    const sh = findSheet_(SHEETS.DASH_LZ);
    const cfg = getConfig_();
    const records = recomputeRecords_(readAllRecords_(), cfg, new Date());
    renderLZResults_(sh, records, cfg);
    return true;
  }
  return false;
}

/* ------------------------------ Métricas -------------------------------- */

/** Pesquisador "ativo" = ainda em acompanhamento. */
function isActive_(r) {
  return r['Resultado'] !== RESULTADO.BATIZADO && r['Resultado'] !== RESULTADO.CAIU;
}

/** Lista de distritos distintos presentes na base. */
function distinctDistricts_(records) {
  const seen = {};
  const out = [];
  records.forEach(function (r) {
    const d = s_(r['Distrito']) || '—';
    if (!seen[d]) { seen[d] = true; out.push(d); }
  });
  return out.sort();
}

/** Calcula os indicadores por distrito. */
function metricsByDistrict_(records) {
  const map = {};
  records.forEach(function (r) {
    const d = s_(r['Distrito']) || '—';
    if (!map[d]) map[d] = { total: 0, semAtt: 0, semMatch: 0, semEntrev: 0, caidas: 0, reservados: 0 };
    const m = map[d];
    if (isActive_(r)) m.total++;
    if (r['Status'] === STATUS.SEM_ATUALIZACAO) m.semAtt++;
    if (isActive_(r) && r['Semana'] >= 2 && !r['Match']) m.semMatch++;
    if (isActive_(r) && r['Semana'] >= 3 && !r['Entrevista']) m.semEntrev++;
    if (r['Resultado'] === RESULTADO.CAIU) m.caidas++;
    if (r['Resultado'] === RESULTADO.RESERVADO) m.reservados++;
  });
  return map;
}

/* ----------------------------- Proteções ------------------------------- */

function applyReadonlyProtection_(sh, name) {
  applyReadonlyProtectionExcept_(sh, name, []);
}

function applyReadonlyProtectionExcept_(sh, name, editableRanges) {
  try {
    sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
      if (p.canEdit()) p.remove();
    });
    const prot = sh.protect().setDescription('Mission Tracker • ' + name);
    if (editableRanges && editableRanges.length) prot.setUnprotectedRanges(editableRanges);
    // Sem warning: colaboradores só editam os controles liberados; o dono não
    // é bloqueado. Evita prompts repetidos ao usar os botões/seletores.
    prot.setWarningOnly(false);
  } catch (e) {
    logEvent_('WARN', 'protection', e.message);
  }
}
