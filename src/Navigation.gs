/**
 * Navigation.gs
 * ---------------------------------------------------------------------------
 * A tela de Registro: UM pesquisador por vez, como um card de aplicativo.
 *
 * Como "botões" funcionam sem menus/diálogos (restrição mobile):
 *   - Cada botão é um CHECKBOX. Ao marcá-lo, o onEdit dispara a ação e o
 *     checkbox é desmarcado automaticamente (volta a ficar pronto para uso).
 *
 * Edições do LD na tela são gravadas direto na Base (autosave), com histórico,
 * recálculo de cor e atualização dos dashboards.
 * ---------------------------------------------------------------------------
 */

/* --------------------------- Lista de navegação ------------------------- */

/**
 * (Re)constrói a ordem dos pesquisadores "em acompanhamento" para navegação,
 * ordenada pela prioridade do LD. Persiste IDs e reseta o índice se preciso.
 * @return {Array<string>} ids
 */
function buildRegistroList_(cfg) {
  cfg = cfg || getConfig_();
  const now = new Date();
  let records = readAllRecords_();
  recomputeRecords_(records, cfg, now);

  // Em acompanhamento = ainda não batizado nem caído.
  const active = records.filter(function (r) {
    return r['Resultado'] !== RESULTADO.BATIZADO && r['Resultado'] !== RESULTADO.CAIU;
  });
  const ordered = sortForLD_(active);
  const ids = ordered.map(function (r) { return s_(r['ID']); });
  setState_(STATE_KEYS.REG_IDS, ids);

  let idx = getState_(STATE_KEYS.REG_INDEX, 0);
  if (idx >= ids.length) idx = 0;
  setState_(STATE_KEYS.REG_INDEX, idx);
  return ids;
}

/** ID atualmente exibido no Registro (ou null). */
function currentRegistroId_() {
  const ids = getState_(STATE_KEYS.REG_IDS, []);
  const idx = getState_(STATE_KEYS.REG_INDEX, 0);
  return ids[idx] || null;
}

/** Vai para o início da lista e renderiza (usado pelo botão da Home). */
function startRegistros_() {
  const cfg = getConfig_();
  const ids = buildRegistroList_(cfg);
  setState_(STATE_KEYS.REG_INDEX, 0);
  renderRegistroAt_(0);
  const sh = findSheet_(SHEETS.REGISTRO);
  if (sh) ss_().setActiveSheet(sh);
}

/** Move o índice por delta (com clamp) e renderiza. */
function navMove_(delta) {
  const ids = getState_(STATE_KEYS.REG_IDS, []);
  if (!ids.length) { renderRegistroAt_(0); return; }
  let idx = getState_(STATE_KEYS.REG_INDEX, 0) + delta;
  if (idx < 0) idx = 0;
  if (idx > ids.length - 1) idx = ids.length - 1;
  setState_(STATE_KEYS.REG_INDEX, idx);
  renderRegistroAt_(idx);
}

/* ------------------------------- Render --------------------------------- */

/** Renderiza o card do índice informado. */
function renderRegistroAt_(index) {
  const cfg = getConfig_();
  const ids = getState_(STATE_KEYS.REG_IDS, []);
  const sh = getSheet_(SHEETS.REGISTRO);

  if (!ids.length) {
    renderRegistroEmpty_(sh, cfg);
    return;
  }
  if (index < 0) index = 0;
  if (index > ids.length - 1) index = ids.length - 1;

  const rec = readRecordById_(ids[index]);
  if (!rec) { renderRegistroEmpty_(sh, cfg); return; }
  recomputeRecords_([rec], cfg, new Date());

  renderRegistroCard_(sh, rec, index, ids.length, cfg);
}

/** Estado vazio (nenhum pesquisador em acompanhamento). */
function renderRegistroEmpty_(sh, cfg) {
  resetSheet_(sh, REG.ROWS.NAV + 6, 6);
  setColumnLayout_(sh);
  sh.setHiddenGridlines(true);
  paintCanvas_(sh);
  writeTitle_(sh, REG.ROWS.TITLE, '📱 Registro', cfg.distrito);
  mergeRow_(sh, REG.ROWS.NOME, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue('Nenhum pesquisador em acompanhamento.')
    .setFontSize(14).setFontColor(UI.SUBTLE).setWrap(true);
  mergeRow_(sh, REG.ROWS.NOME + 2, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue('Adicione pesquisadores na aba Base ou rode a configuração inicial.')
    .setFontSize(11).setFontColor(UI.SUBTLE).setWrap(true);
}

/** Desenha o card completo de um pesquisador. */
function renderRegistroCard_(sh, rec, index, total, cfg) {
  resetSheet_(sh, REG.ROWS.NAV + 6, 6);
  setColumnLayout_(sh);
  sh.setHiddenGridlines(true);
  paintCanvas_(sh, REG.ROWS.NAV + 4, 6);

  const meta = statusMeta_(rec['Status']);

  // Cabeçalho
  writeTitle_(sh, REG.ROWS.TITLE, APP.NAME,
    cfg.distrito + '  •  Pesquisador ' + (index + 1) + ' de ' + total);

  // Nome (grande) + chip de status
  const nome = mergeRow_(sh, REG.ROWS.NOME, REG.COL_LABEL, 3);
  nome.setValue(s_(rec['Nome']))
    .setFontSize(24).setFontWeight('bold').setFontColor(UI.TITLE);
  sh.setRowHeight(REG.ROWS.NOME, 44);
  sh.getRange(REG.ROWS.NOME, REG.COL_CTRL)
    .setValue(meta.emoji)
    .setHorizontalAlignment('center').setFontSize(18);

  // Semana
  mergeRow_(sh, REG.ROWS.SEMANA, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue('Semana ' + s_(rec['Semana']) + '  •  ' + meta.emoji + ' ' + meta.label)
    .setFontSize(12).setFontColor(meta.text).setFontWeight('bold');

  // Área / Data Batismal
  writeFieldPair_(sh, REG.ROWS.AREA, 'Área', s_(rec['Área']) || '—');
  writeFieldPair_(sh, REG.ROWS.DATA, 'Data Batismal', formatDateLong_(rec['Data Batismal']));

  // STATUS / marcos
  drawDivider_(sh, REG.ROWS.STATUS_HDR - 1);
  mergeRow_(sh, REG.ROWS.STATUS_HDR, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue('STATUS').setFontSize(11).setFontWeight('bold').setFontColor(UI.SUBTLE);

  const toShow = milestonesForCard_(rec, rec['Semana']);
  ['TouchDown', 'Plano Igreja', 'Match', 'Entrevista'].forEach(function (field) {
    const row = REG_MILESTONE_ROW[field];
    if (toShow.indexOf(field) === -1) {
      // Esconde marco não pertinente (limpa célula e linha).
      sh.getRange(row, REG.COL_LABEL, 1, REG.WIDTH_FIRST).clearContent().clearDataValidations();
      sh.setRowHeight(row, 8);
      return;
    }
    const done = !!rec[field];
    const label = mergeRow_(sh, row, REG.COL_LABEL, 3);
    label.setValue((done ? '✓ ' : '○ ') + field)
      .setFontSize(14).setFontWeight(done ? 'bold' : 'normal')
      .setFontColor(done ? STATUS_META.EM_DIA.text : UI.TITLE)
      .setBackground(done ? STATUS_META.EM_DIA.soft : UI.CARD)
      .setBorder(true, true, true, true, false, false, UI.BORDER, SpreadsheetApp.BorderStyle.SOLID)
      .setVerticalAlignment('middle');
    sh.setRowHeight(row, 36);
    const cb = sh.getRange(row, REG.COL_CTRL);
    cb.insertCheckboxes();
    cb.setValue(done);
  });

  // Resultado (dropdown)
  drawDivider_(sh, REG.ROWS.RESULTADO - 1);
  sh.getRange(REG.ROWS.RESULTADO, REG.COL_LABEL)
    .setValue('Resultado').setFontColor(UI.SUBTLE).setFontSize(11);
  const resCell = sh.getRange(REG.ROWS.RESULTADO, REG.COL_VALUE, 1, 2).merge();
  resCell.setFontSize(13).setFontWeight('bold').setFontColor(UI.TITLE)
    .setBackground(UI.ACCENT_SOFT)
    .setBorder(true, true, true, true, false, false, UI.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(RESULTADO_OPTIONS, true).setAllowInvalid(false).build();
  sh.getRange(REG.ROWS.RESULTADO, REG.COL_VALUE).setDataValidation(rule)
    .setValue(rec['Resultado'] || RESULTADO.ANDAMENTO);

  // Próximo Passo
  drawDivider_(sh, REG.ROWS.PROXIMO_HDR - 1);
  sh.getRange(REG.ROWS.PROXIMO_HDR, REG.COL_LABEL)
    .setValue('Próximo Passo').setFontColor(UI.SUBTLE).setFontSize(11);
  inputCell_(sh, REG.ROWS.PROXIMO_VAL, s_(rec['Próximo Passo']));

  // Observação
  sh.getRange(REG.ROWS.OBS_HDR, REG.COL_LABEL)
    .setValue('Observação').setFontColor(UI.SUBTLE).setFontSize(11);
  inputCell_(sh, REG.ROWS.OBS_VAL, s_(rec['Observação']));

  // Última atualização
  drawDivider_(sh, REG.ROWS.ATUALIZADO - 1);
  mergeRow_(sh, REG.ROWS.ATUALIZADO, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue('Última atualização: ' + formatRelative_(rec['Última Atualização']) +
      (rec['Usuário'] ? '  •  ' + s_(rec['Usuário']) : ''))
    .setFontSize(10).setFontColor(UI.SUBTLE);

  // Navegação (checkboxes-botões)
  drawNav_(sh, index, total);
}

/** Par rótulo/valor lado a lado (Área, Data...). */
function writeFieldPair_(sh, row, label, value) {
  sh.getRange(row, REG.COL_LABEL).setValue(label)
    .setFontColor(UI.SUBTLE).setFontSize(11);
  sh.getRange(row, REG.COL_VALUE, 1, 2).merge().setValue(value)
    .setFontSize(14).setFontWeight('bold').setFontColor(UI.TITLE);
}

/** Campo de entrada de texto (merge largo, com leve fundo). */
function inputCell_(sh, row, value) {
  const c = mergeRow_(sh, row, REG.COL_LABEL, REG.WIDTH_FIRST);
  c.setValue(value)
    .setFontSize(13).setFontColor(UI.TITLE).setWrap(true)
    .setBackground(UI.CARD).setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, UI.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(row, 40);
  return c;
}

/** Desenha os botões de navegação Anterior / Próximo / Salvar. */
function drawNav_(sh, index, total) {
  const navRow = REG.ROWS.NAV;
  // Anterior (B = checkbox, C = rótulo)
  sh.getRange(navRow, 2).insertCheckboxes().setValue(false);
  sh.getRange(navRow, 3).setValue(NAV_BTN.PREV)
    .setFontWeight('bold').setFontColor(index > 0 ? UI.ACCENT : UI.SUBTLE)
    .setFontSize(12);
  // Próximo (E = checkbox, D = rótulo)
  sh.getRange(navRow, 5).insertCheckboxes().setValue(false);
  sh.getRange(navRow, 4).setValue(NAV_BTN.NEXT)
    .setFontWeight('bold').setFontColor(index < total - 1 ? UI.ACCENT : UI.SUBTLE)
    .setFontSize(12).setHorizontalAlignment('right');
  sh.setRowHeight(navRow, 34);

  // Salvar e avançar (botão primário, largura total)
  const saveRow = navRow + 1;
  sh.getRange(saveRow, 2).insertCheckboxes().setValue(false);
  drawButtonBlock_(sh, saveRow, 3, 3, NAV_BTN.SAVE + ' e avançar', UI.BUTTON, UI.BUTTON_TEXT);
}

/* ------------------------------ Edição ---------------------------------- */

/**
 * Mapeia a célula editada para uma ação ou campo.
 * @return {Object|null} { kind:'nav', action } | { kind:'field', field }
 */
function classifyRegistroCell_(row, col) {
  const R = REG.ROWS;
  if (row === R.NAV && col === 2) return { kind: 'nav', action: 'prev' };
  if (row === R.NAV && col === 5) return { kind: 'nav', action: 'next' };
  if (row === R.NAV + 1 && col === 2) return { kind: 'nav', action: 'save' };

  if (col === REG.COL_CTRL) {
    const fields = Object.keys(REG_MILESTONE_ROW);
    for (let i = 0; i < fields.length; i++) {
      if (REG_MILESTONE_ROW[fields[i]] === row) return { kind: 'field', field: fields[i] };
    }
  }
  if (row === R.RESULTADO && col === REG.COL_VALUE) return { kind: 'field', field: 'Resultado' };
  if (row === R.PROXIMO_VAL && col === REG.COL_LABEL) return { kind: 'field', field: 'Próximo Passo' };
  if (row === R.OBS_VAL && col === REG.COL_LABEL) return { kind: 'field', field: 'Observação' };
  return null;
}

/**
 * Trata uma edição na aba Registro.
 * @param {Object} e evento onEdit
 * @return {boolean} true se tratou
 */
function handleRegistroEdit_(e) {
  const range = e.range;
  const row = range.getRow();
  const col = range.getColumn();
  const hit = classifyRegistroCell_(row, col);
  if (!hit) return false;

  if (hit.kind === 'nav') {
    // Desmarca o botão e executa.
    try { range.setValue(false); } catch (ignore) {}
    if (hit.action === 'prev') navMove_(-1);
    else if (hit.action === 'next') navMove_(1);
    else if (hit.action === 'save') { buildRegistroList_(); refreshAllDashboards_(); navMove_(0); }
    return true;
  }

  // hit.kind === 'field'
  const id = currentRegistroId_();
  if (!id) return true;
  let newValue = e.value !== undefined ? e.value : range.getValue();
  // Checkbox vem como boolean da própria célula.
  if (hit.field === 'TouchDown' || hit.field === 'Plano Igreja' ||
      hit.field === 'Match' || hit.field === 'Entrevista') {
    newValue = toBool_(range.getValue());
  }
  applyFieldEdit_(id, hit.field, newValue, hit.field === 'Resultado');
  return true;
}

/**
 * Aplica uma alteração de campo: grava na Base, registra histórico,
 * recalcula cor e atualiza dashboards.
 * @param {string} id
 * @param {string} field
 * @param {*} newValue
 * @param {boolean} reRender  se deve redesenhar o card (ex.: Resultado)
 */
function applyFieldEdit_(id, field, newValue, reRender) {
  const cfg = getConfig_();
  const now = new Date();
  const user = currentUser_();

  const before = readRecordById_(id);
  if (!before) return;

  const fieldMap = {};
  fieldMap[field] = newValue;
  fieldMap['Última Atualização'] = now;
  fieldMap['Usuário'] = user;
  const after = updateRecordFields_(before._row, fieldMap);

  recomputeRecords_([after], cfg, now);
  persistComputedColumns_([after]);

  const changes = diffEditableFields_(before, after);
  logChanges_(after, changes, user);

  // Atualiza dashboards (são pequenos) e Home.
  refreshAllDashboards_();

  if (reRender) {
    // Mudança de Resultado pode tirar o pesquisador da lista de ativos.
    buildRegistroList_(cfg);
    navMove_(0);
  } else {
    // Atualiza apenas o rótulo de "Última atualização", o chip de status e,
    // se foi um marco, o próprio rótulo do marco — sem redesenhar (evita
    // "pulo" durante o toque).
    updateRegistroTimestamp_(after, cfg);
    if (REG_MILESTONE_ROW[field] != null) {
      updateMilestoneLabel_(findSheet_(SHEETS.REGISTRO), field, !!after[field]);
    }
  }
}

/** Atualiza o rótulo visual de um marco (✓/○ e cor) sem redesenhar o card. */
function updateMilestoneLabel_(sh, field, done) {
  if (!sh) return;
  const row = REG_MILESTONE_ROW[field];
  mergeRow_(sh, row, REG.COL_LABEL, 3)
    .setValue((done ? '✓ ' : '○ ') + field)
    .setFontWeight(done ? 'bold' : 'normal')
    .setFontColor(done ? STATUS_META.EM_DIA.text : UI.TITLE)
    .setBackground(done ? STATUS_META.EM_DIA.soft : UI.CARD);
}

/** Atualiza no card o status/última atualização sem redesenhar tudo. */
function updateRegistroTimestamp_(rec, cfg) {
  const sh = findSheet_(SHEETS.REGISTRO);
  if (!sh) return;
  const meta = statusMeta_(rec['Status']);
  sh.getRange(REG.ROWS.NOME, REG.COL_CTRL).setValue(meta.emoji);
  mergeRow_(sh, REG.ROWS.SEMANA, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue('Semana ' + s_(rec['Semana']) + '  •  ' + meta.emoji + ' ' + meta.label)
    .setFontColor(meta.text);
  mergeRow_(sh, REG.ROWS.ATUALIZADO, REG.COL_LABEL, REG.WIDTH_FIRST)
    .setValue('Última atualização: ' + formatRelative_(rec['Última Atualização']) +
      (rec['Usuário'] ? '  •  ' + s_(rec['Usuário']) : ''))
    .setFontSize(10).setFontColor(UI.SUBTLE);
}

/* ----------------------------- Proteção --------------------------------- */

/**
 * Protege a estrutura do card, deixando editáveis apenas os controles do LD:
 * checkboxes de marcos, Resultado, Próximo Passo, Observação e navegação.
 */
function applyRegistroProtection_(sh) {
  try {
    sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
      if (p.canEdit()) p.remove();
    });
    const R = REG.ROWS;
    const editable = [
      sh.getRange(R.M_TOUCHDOWN, REG.COL_CTRL, 4, 1),       // E12:E15 marcos
      sh.getRange(R.RESULTADO, REG.COL_VALUE),              // D17 Resultado
      sh.getRange(R.PROXIMO_VAL, REG.COL_LABEL, 1, REG.WIDTH_FIRST), // B20:E20
      sh.getRange(R.OBS_VAL, REG.COL_LABEL, 1, REG.WIDTH_FIRST),     // B23:E23
      sh.getRange(R.NAV, 2),                                // B27 anterior
      sh.getRange(R.NAV, 5),                                // E27 próximo
      sh.getRange(R.NAV + 1, 2),                            // B28 salvar
    ];
    const prot = sh.protect().setDescription('Mission Tracker • Registro');
    prot.setUnprotectedRanges(editable);
    prot.setWarningOnly(false);
  } catch (e) {
    logEvent_('WARN', 'protection', e.message);
  }
}
