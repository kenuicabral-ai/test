/**
 * Navigation.gs
 * -----------------------------------------------------------------------------
 * O coração da tela 📱 Registro: mostra UM pesquisador por vez como um CARD,
 * inteligente por semana, e trata os "botões" (checkboxes) Anterior / Salvar /
 * Próximo. Também trata a navegação a partir dos dashboards.
 *
 * Tudo sem HTML, sidebar ou dialog — apenas células, checkboxes e onEdit.
 *
 * MAPA DE LINHAS DO CARD (gravado na aba Sistema para o onEdit ler de volta):
 *   ROW_TOUCHDOWN, ROW_PLANO, ROW_MATCH, ROW_ENTREVISTA  -> checkboxes (col 3)
 *   ROW_PROXIMO, ROW_OBS, ROW_RESULTADO                  -> inputs (col 2/3)
 *   ROW_BTN_ANTERIOR, ROW_BTN_SALVAR, ROW_BTN_PROXIMO    -> checkboxes (col)
 */

/* ------------------------- Lista de navegação ------------------------------ */

/**
 * Constrói a lista ordenada de IDs para navegar no Registro.
 * Ordena por prioridade de status (Laranja, Vermelho, Amarelo, Verde, Azul, Cinza)
 * e filtra por distrito atual (e pelo filtro vindo do Dashboard Zona, se houver).
 */
function buildNavList() {
  const records = getAllRecords();
  const distrito = getDistrito();
  const filter = sysGet(STATE.ZONA_FILTER, '');

  const visible = records.filter(function (r) {
    if (distrito && r[COL.DISTRITO - 1] !== distrito) return false;
    if (filter) return matchesFilter(r, filter);
    return true;
  });

  visible.sort(function (a, b) {
    const pa = STATUS_ORDER_LD.indexOf(a[COL.COR - 1] || computeStatus(a));
    const pb = STATUS_ORDER_LD.indexOf(b[COL.COR - 1] || computeStatus(b));
    if (pa !== pb) return pa - pb;
    return String(a[COL.NOME - 1]).localeCompare(String(b[COL.NOME - 1]));
  });

  const ids = visible.map(function (r) { return r[COL.ID - 1]; });
  cachePutList(STATE.CURRENT_LIST, ids);
  return ids;
}

/** Avalia se um record bate com um filtro do Dashboard Zona. */
function matchesFilter(r, filter) {
  const week = computeWeek(r);
  switch (filter) {
    case 'SEM_ATUALIZACAO': return (r[COL.COR - 1] || computeStatus(r)) === STATUS.LARANJA;
    case 'SEM_MATCH': return week >= 2 && !toBool(r[COL.MATCH - 1]) &&
      r[COL.RESULTADO - 1] !== RESULTADO.BATIZADO && r[COL.RESULTADO - 1] !== RESULTADO.DATA_CAIU;
    case 'SEM_ENTREVISTA': return week >= 3 && !toBool(r[COL.ENTREVISTA - 1]) &&
      r[COL.RESULTADO - 1] !== RESULTADO.BATIZADO && r[COL.RESULTADO - 1] !== RESULTADO.DATA_CAIU;
    case 'DATA_CAIU': return r[COL.RESULTADO - 1] === RESULTADO.DATA_CAIU;
    case 'RESERVADO': return r[COL.RESULTADO - 1] === RESULTADO.RESERVADO;
    case 'TOTAL': return true;
    default: return true;
  }
}

/** Abre um pesquisador específico no Registro e navega até a aba. */
function openResearcher(id) {
  let ids = cacheGetList(STATE.CURRENT_LIST);
  if (ids.indexOf(String(id)) === -1) ids = buildNavList();
  sysSet(STATE.CURRENT_ID, id);
  renderRegistro(id);
  const sh = getSheet(SHEETS.REGISTRO);
  if (sh) ss().setActiveSheet(sh);
}

/** Move para o próximo/anterior na lista corrente. */
function navigate(delta) {
  let ids = cacheGetList(STATE.CURRENT_LIST);
  if (!ids.length) ids = buildNavList();
  if (!ids.length) { renderRegistroEmpty(); return; }

  const current = String(sysGet(STATE.CURRENT_ID, ids[0]));
  let idx = ids.indexOf(current);
  if (idx === -1) idx = 0;
  idx = clamp(idx + delta, 0, ids.length - 1);
  sysSet(STATE.CURRENT_ID, ids[idx]);
  renderRegistro(ids[idx]);
}

/* --------------------------- Render do card -------------------------------- */

function renderRegistroEmpty() {
  const sh = getOrCreateSheet(SHEETS.REGISTRO);
  prepCanvas(sh, 2);
  let r = 3;
  r = writeBlock(sh, r, { text: '📱 Registro', size: 20, bold: true, span: 2, height: 40 });
  r = writeSpacer(sh, r, 16);
  r = writeBlock(sh, r, {
    text: '🎉 Nenhum pesquisador pendente neste filtro.',
    size: 13, span: 2, height: 40, align: 'center', bg: '#E6F4EA'
  });
}

/**
 * Desenha o card do pesquisador `id`. Layout app-like: cabeçalho colorido,
 * blocos de informação, status por semana, inputs e botões.
 */
function renderRegistro(id) {
  const record = getRecordById(id);
  const sh = getOrCreateSheet(SHEETS.REGISTRO);
  prepCanvas(sh, 2);

  if (!record) { renderRegistroEmpty(); return; }

  const span = 2;
  const status = computeStatus(record);
  const pal = palette(status);
  const week = computeWeek(record);
  const ids = cacheGetList(STATE.CURRENT_LIST);
  const pos = ids.indexOf(String(id));

  let r = 2;
  r = writeSpacer(sh, r, 8);

  // Cabeçalho: nome + faixa colorida de status.
  r = writeBlock(sh, r, {
    text: record[COL.NOME - 1] + '   ' + pal.label,
    size: 22, bold: true, color: '#ffffff', bg: pal.accent,
    span: span, height: 48, align: 'center'
  });
  r = writeBlock(sh, r, {
    text: 'Semana ' + week + (ids.length ? '   •   ' + (pos + 1) + ' de ' + ids.length : ''),
    size: 11, color: '#ffffff', bg: pal.accent, span: span, height: 22, align: 'center'
  });
  r = writeSpacer(sh, r, 8);

  // Bloco de informações (Área + Data Batismal).
  r = infoRow(sh, r, span, 'Área', record[COL.AREA - 1] || '—');
  r = infoRow(sh, r, span, 'Data Batismal', formatDateHuman(record[COL.BATISMO - 1]));
  r = writeSpacer(sh, r, 8);

  // ---- STATUS (campos da semana) ----
  r = writeBlock(sh, r, { text: 'STATUS', size: 12, bold: true, color: '#5f6368', span: span, height: 24 });
  const fields = weekFields(week);
  const rowMap = {};
  fields.forEach(function (colIdx) {
    sh.getRange(r, 2).setValue(fieldLabel(colIdx))
      .setFontSize(13).setVerticalAlignment('middle');
    const cb = sh.getRange(r, 3);
    cb.insertCheckboxes().setValue(toBool(record[colIdx - 1])).setHorizontalAlignment('center');
    sh.getRange(r, 2, 1, 2).setBackground(pal.bg)
      .setBorder(true, true, true, true, false, false, '#e8eaed', SpreadsheetApp.BorderStyle.SOLID);
    sh.setRowHeight(r, 34);
    rowMap[colIdx] = r;
    r++;
  });
  r = writeSeparator(sh, r, span);

  // ---- Próximo Passo ----
  r = writeBlock(sh, r, { text: 'Próximo Passo', size: 11, bold: true, color: '#5f6368', span: span, height: 20 });
  sh.getRange(r, 2, 1, span).merge().setValue(record[COL.PROXIMO - 1] || '')
    .setBackground('#f8f9fa').setWrap(true).setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(r, 36);
  const rowProximo = r; r++;
  r = writeSpacer(sh, r, 4);

  // ---- Observação ----
  r = writeBlock(sh, r, { text: 'Observação', size: 11, bold: true, color: '#5f6368', span: span, height: 20 });
  sh.getRange(r, 2, 1, span).merge().setValue(record[COL.OBS - 1] || '')
    .setBackground('#f8f9fa').setWrap(true).setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(r, 40);
  const rowObs = r; r++;
  r = writeSpacer(sh, r, 4);

  // ---- Resultado (dropdown) ----
  r = writeBlock(sh, r, { text: 'Resultado', size: 11, bold: true, color: '#5f6368', span: span, height: 20 });
  const resCell = sh.getRange(r, 2, 1, span).merge();
  resCell.setValue(record[COL.RESULTADO - 1] || RESULTADO.NENHUM)
    .setBackground('#ffffff').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  applyResultadoValidation(sh.getRange(r, 2));
  sh.setRowHeight(r, 32);
  const rowResultado = r; r++;
  r = writeSeparator(sh, r, span);

  // ---- Última atualização ----
  r = writeBlock(sh, r, {
    text: 'Última atualização: ' + formatLastUpdate(record[COL.ATUALIZADO - 1]) +
      (record[COL.USUARIO - 1] ? '  •  ' + record[COL.USUARIO - 1] : ''),
    size: 10, color: '#80868b', span: span, height: 22
  });
  r = writeSpacer(sh, r, 8);

  // ---- Botões (checkboxes-ação): rótulo (col2) + checkbox (col3), 1 por linha.
  // Uma linha por botão evita toque ambíguo no mobile.
  const rowBtnAnterior = r;
  r = actionRow(sh, r, BTN.ANTERIOR, '#e8eaed', '#202124');
  const rowBtnSalvar = r;
  r = actionRow(sh, r, BTN.SALVAR, pal.accent, '#ffffff');
  const rowBtnProximo = r;
  r = actionRow(sh, r, BTN.PROXIMO, '#e8eaed', '#202124');

  // Persistir o mapa de linhas para o onEdit.
  const map = {
    ROW_PROXIMO: rowProximo,
    ROW_OBS: rowObs,
    ROW_RESULTADO: rowResultado,
    ROW_BTN_ANTERIOR: rowBtnAnterior,
    ROW_BTN_SALVAR: rowBtnSalvar,
    ROW_BTN_PROXIMO: rowBtnProximo,
    FIELD_ROWS: rowMap
  };
  sysSet('REG_MAP', JSON.stringify(map));

  sh.setColumnWidth(2, 230);
  sh.setColumnWidth(3, 110);
}

function infoRow(sh, r, span, label, value) {
  sh.getRange(r, 2).setValue(label).setFontColor('#5f6368').setFontSize(10).setVerticalAlignment('middle');
  sh.getRange(r, 3).setValue(value).setFontSize(13).setFontWeight('bold').setVerticalAlignment('middle');
  sh.setRowHeight(r, 26);
  return r + 1;
}

function actionRow(sh, r, label, bg, fg) {
  sh.getRange(r, 2).setValue(label).setFontWeight('bold').setFontColor(fg).setBackground(bg)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  const cb = sh.getRange(r, 3);
  cb.insertCheckboxes().setValue(false).setHorizontalAlignment('center').setBackground(bg);
  sh.setRowHeight(r, 38);
  return r + 1;
}

function applyResultadoValidation(range) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(RESULTADO_OPTIONS, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

/* ----------------------------- onEdit do Registro -------------------------- */

/**
 * Trata QUALQUER edição na aba Registro:
 *  - checkboxes de status / inputs -> salvar no record + histórico + cor.
 *  - botões Anterior/Salvar/Próximo -> navegação.
 */
function handleRegistroEdit(e) {
  const sh = e.range.getSheet();
  const row = e.range.getRow();
  const col = e.range.getColumn();
  const mapRaw = sysGet('REG_MAP', '');
  if (!mapRaw) return;
  const map = JSON.parse(mapRaw);
  const id = sysGet(STATE.CURRENT_ID, '');
  if (!id) return;

  // ---- Botões ----
  if (col === 3 && row === map.ROW_BTN_ANTERIOR) {
    e.range.setValue(false); commitRegistro(id); navigate(-1); return;
  }
  if (col === 3 && row === map.ROW_BTN_PROXIMO) {
    e.range.setValue(false); commitRegistro(id); navigate(1); return;
  }
  if (col === 3 && row === map.ROW_BTN_SALVAR) {
    e.range.setValue(false); commitRegistro(id); renderRegistro(id);
    toast('Salvo ✔'); return;
  }

  // ---- Campos editáveis: persistimos imediatamente (auto-save) ----
  const fieldRows = map.FIELD_ROWS || {};
  // Status (checkbox) na col 3
  if (col === 3) {
    for (const colIdx in fieldRows) {
      if (fieldRows[colIdx] === row) { commitRegistro(id); return; }
    }
  }
  // Próximo/Obs (col 2, merge) e Resultado (col 2)
  if (col === 2 && (row === map.ROW_PROXIMO || row === map.ROW_OBS || row === map.ROW_RESULTADO)) {
    commitRegistro(id);
    if (row === map.ROW_RESULTADO) renderRegistro(id); // cor pode mudar drasticamente
    return;
  }
}

/**
 * Lê os campos editáveis do card, compara com a Base, e faz UM commit:
 * grava record, histórico (lote), recalcula cor, timestamps e usuário.
 */
function commitRegistro(id) {
  const sh = getSheet(SHEETS.REGISTRO);
  const mapRaw = sysGet('REG_MAP', '');
  if (!sh || !mapRaw) return;
  const map = JSON.parse(mapRaw);

  const record = getRecordById(id);
  if (!record) return;
  const before = record.slice();

  const fieldRows = map.FIELD_ROWS || {};
  for (const colIdx in fieldRows) {
    const v = sh.getRange(fieldRows[colIdx], 3).getValue();
    record[Number(colIdx) - 1] = toBool(v);
  }
  if (map.ROW_PROXIMO) record[COL.PROXIMO - 1] = sh.getRange(map.ROW_PROXIMO, 2).getValue();
  if (map.ROW_OBS) record[COL.OBS - 1] = sh.getRange(map.ROW_OBS, 2).getValue();
  if (map.ROW_RESULTADO) record[COL.RESULTADO - 1] = sh.getRange(map.ROW_RESULTADO, 2).getValue();

  // Detecta mudanças apenas nos campos editáveis.
  const changes = [];
  EDITABLE_FIELDS.forEach(function (c) {
    const oldVal = before[c - 1];
    const newVal = record[c - 1];
    const changed = (c === COL.TOUCHDOWN || c === COL.PLANO || c === COL.MATCH || c === COL.ENTREVISTA)
      ? (toBool(oldVal) !== toBool(newVal))
      : (String(oldVal == null ? '' : oldVal) !== String(newVal == null ? '' : newVal));
    if (changed) changes.push({ col: c, oldVal: oldVal, newVal: newVal });
  });

  if (!changes.length) return; // nada mudou -> não toca em nada

  const user = currentUser();
  record[COL.SEMANA - 1] = computeWeek(record);
  record[COL.COR - 1] = computeStatus(record);
  record[COL.ATUALIZADO - 1] = now();
  record[COL.USUARIO - 1] = user;

  writeRecord(id, record);
  appendHistory(id, record[COL.NOME - 1], changes, user);
  maybeNotifyCritical(record);

  // Atualiza dashboards e home (cor pode ter mudado).
  refreshDashboards();
  renderHome();
}
