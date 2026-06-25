/**
 * Navigation.gs
 * ----------------------------------------------------------------------------
 * As telas que o usuário toca: Home e o card de Registro (um pesquisador por
 * vez). Aqui mora o "parece um app, não uma planilha".
 *
 * Interação 100% mobile, sem menus/diálogos:
 *  - "Botões" são checkboxes. Ao tocar, o onEdit roteia a ação e desmarca.
 *  - O card mostra APENAS os campos relevantes para a semana do pesquisador.
 *  - Editar um campo salva na Base imediatamente (ver Database/automations).
 * ----------------------------------------------------------------------------
 */

/* ============================ HOME ============================ */

/**
 * Renderiza a Home como um "painel de app": título, distrito, contadores por
 * cor e o botão COMEÇAR REGISTROS. Tudo em uma coluna central.
 */
function renderHome() {
  var sh = getSheet(SHEETS.HOME, true);
  var cfg = getConfig();
  var counts = statusCounts();

  resetScreen(sh, 1, 20);

  // Cabeçalho do app.
  mergeBlock(sh, 2, '🛰  ' + APP.NAME, { bg: UI.HEADER_BG, color: UI.HEADER_TX, size: 22, bold: true, hAlign: 'center' });
  mergeBlock(sh, 3, cfg[CONFIG_KEYS.DISTRITO] + '  •  ' + cfg[CONFIG_KEYS.ZONA], { color: UI.MUTED, size: 12, hAlign: 'center' });

  separator(sh, 4);

  mergeBlock(sh, 5, 'Hoje existem', { color: UI.MUTED, size: 12, hAlign: 'center' });

  // Contadores (cada um em um bloco, cor forte).
  counterLine(sh, 6, STATUS.VERMELHO, counts.VERMELHO, 'críticos');
  counterLine(sh, 7, STATUS.LARANJA, counts.LARANJA, 'sem atualização');
  counterLine(sh, 8, STATUS.AMARELO, counts.AMARELO, 'pendentes');
  counterLine(sh, 9, STATUS.VERDE, counts.VERDE, 'em dia');

  separator(sh, 10);

  var extras = '🔵 ' + counts.AZUL + ' batizados   •   ⚪ ' + counts.CINZA + ' datas caídas';
  mergeBlock(sh, 11, extras, { color: UI.MUTED, size: 11, hAlign: 'center' });

  // Botão (checkbox) COMEÇAR REGISTROS — célula B12 (ver BTN_CELLS.HOME_COMECAR).
  button(sh, 12, BTN.COMECAR);

  mergeBlock(sh, 14, 'Toque na caixa acima para iniciar', { color: UI.MUTED, italic: true, size: 10, hAlign: 'center' });

  setState('HOME_RENDERED_AT', formatUpdate(now()));
}

/** Uma linha de contador: "🔴  3  críticos". */
function counterLine(sh, row, statusKey, n, palavra) {
  var c = colorOf(statusKey);
  var txt = c.emoji + '   ' + n + '   ' + palavra;
  mergeBlock(sh, row, txt, { bg: c.bg, color: c.strong, size: 16, bold: true, hAlign: 'center' });
}

/* ============================ REGISTRO (CARD) ============================ */

/**
 * Renderiza o card do pesquisador no índice atual.
 * Reconstrói layout, mostra apenas os marcos da semana e prepara os campos
 * editáveis + checkboxes de navegação.
 */
function renderRegistro() {
  var sh = getSheet(SHEETS.REGISTRO, true);
  var all = readAll();

  resetScreen(sh, 1, CARD.ROW_FOOTER);

  if (all.length === 0) {
    mergeBlock(sh, CARD.ROW_HEADER, '📱 REGISTRO', { bg: UI.HEADER_BG, color: UI.HEADER_TX, size: 18, bold: true, hAlign: 'center' });
    mergeBlock(sh, CARD.ROW_NOME, 'Nenhum pesquisador cadastrado.', { hAlign: 'center', italic: true, color: UI.MUTED });
    mergeBlock(sh, CARD.ROW_SEMANA, 'Adicione na aba Base ou rode seedExemplo().', { hAlign: 'center', size: 10, color: UI.MUTED });
    return;
  }

  var idx = clamp(getCurrentIndex(), 0, all.length - 1);
  setCurrentIndex(idx);
  var p = all[idx];
  var c = colorOf(p.status || computeStatus(p));

  // Cabeçalho com posição e cor do status.
  mergeBlock(sh, CARD.ROW_HEADER, '📱 REGISTRO   (' + (idx + 1) + '/' + all.length + ')  ' + c.emoji,
    { bg: UI.HEADER_BG, color: UI.HEADER_TX, size: 16, bold: true, hAlign: 'center' });

  // Nome + semana.
  mergeBlock(sh, CARD.ROW_NOME, p.nome, { bg: c.bg, color: c.strong, size: 24, bold: true, hAlign: 'center' });
  mergeBlock(sh, CARD.ROW_SEMANA, 'Semana ' + p.semana + '  •  ' + labelOf(p.status), { color: UI.MUTED, size: 12, hAlign: 'center' });

  separator(sh, CARD.ROW_SEP1);

  // Área e Data Batismal.
  mergeBlock(sh, CARD.ROW_AREA_LABEL, '📍 Área', { color: UI.MUTED, size: 10, bold: true });
  mergeBlock(sh, CARD.ROW_AREA_VALUE, p.area || '—', { size: 14, bg: UI.FIELD_BG });
  mergeBlock(sh, CARD.ROW_DATA_LABEL, '📅 Data Batismal', { color: UI.MUTED, size: 10, bold: true });
  mergeBlock(sh, CARD.ROW_DATA_VALUE, dataBatismalText(p), { size: 14, bg: UI.FIELD_BG });

  separator(sh, CARD.ROW_SEP2);

  // STATUS / marcos da semana (somente os relevantes).
  mergeBlock(sh, CARD.ROW_STATUS_TITLE, 'STATUS', { color: UI.MUTED, size: 11, bold: true });
  renderMarcos(sh, p);

  separator(sh, CARD.ROW_SEP3);

  // Campos editáveis: Próximo Passo, Observação, Resultado.
  mergeBlock(sh, CARD.ROW_PROX_LABEL, '➡ Próximo Passo', { color: UI.MUTED, size: 10, bold: true });
  editableText(sh, CARD.ROW_PROX_VALUE, p.proximoPasso);
  mergeBlock(sh, CARD.ROW_OBS_LABEL, '📝 Observação', { color: UI.MUTED, size: 10, bold: true });
  editableText(sh, CARD.ROW_OBS_VALUE, p.observacao);
  mergeBlock(sh, CARD.ROW_RESULT_LABEL, '🏁 Resultado', { color: UI.MUTED, size: 10, bold: true });
  resultadoDropdown(sh, CARD.ROW_RESULT_VALUE, p.resultado);

  separator(sh, CARD.ROW_SEP4);

  // Carimbo de última atualização.
  mergeBlock(sh, CARD.ROW_UPDATE_LABEL, '🕓 Última atualização', { color: UI.MUTED, size: 10, bold: true });
  mergeBlock(sh, CARD.ROW_UPDATE_VALUE, formatUpdate(p.ultimaAtualizacao) + '  ·  ' + (p.usuario || '—'),
    { size: 11, color: UI.MUTED });

  separator(sh, CARD.ROW_SEP5);

  // Navegação: ⬅  | Salvar | ➡  (checkboxes).
  navRow(sh, CARD.ROW_NAV);
}

/** Texto da data batismal com contagem regressiva. */
function dataBatismalText(p) {
  if (!isDate(p.dataBatismal)) return '—';
  var dias = daysBetween(now(), p.dataBatismal);
  var base = formatDateShort(p.dataBatismal);
  if (dias === null) return base;
  if (dias < 0) return base + '  (vencida há ' + (-dias) + 'd)';
  if (dias === 0) return base + '  (hoje!)';
  return base + '  (em ' + dias + 'd)';
}

/**
 * Renderiza os marcos visíveis da semana como checkboxes. Limpa as linhas de
 * marco não usadas para nunca mostrar campo desnecessário.
 */
function renderMarcos(sh, p) {
  var marcoRows = [CARD.ROW_MARCO_1, CARD.ROW_MARCO_2, CARD.ROW_MARCO_3];
  var regra = SEMANA_REGRAS[clamp(p.semana, 1, 3)] || SEMANA_REGRAS[1];
  var visiveis = regra.mostra;

  for (var i = 0; i < marcoRows.length; i++) {
    var row = marcoRows[i];
    if (i < visiveis.length) {
      var col = visiveis[i];
      checkboxField(sh, row, MARCO_LABEL[col], milestoneValue(p, col));
    } else {
      // Linha de marco não usada: limpa e mescla vazia.
      clearRow(sh, row);
    }
  }
}

function milestoneValue(p, col) {
  switch (col) {
    case COL.TOUCHDOWN: return p.touchdown;
    case COL.PLANO_IGREJA: return p.planoIgreja;
    case COL.MATCH: return p.match;
    case COL.ENTREVISTA: return p.entrevista;
    default: return false;
  }
}

/**
 * Dada a semana e a linha editada, devolve a coluna da Base correspondente
 * ao marco. Espelha a ordem de renderMarcos.
 */
function marcoColForRow(semana, row) {
  var marcoRows = [CARD.ROW_MARCO_1, CARD.ROW_MARCO_2, CARD.ROW_MARCO_3];
  var i = marcoRows.indexOf(row);
  if (i === -1) return null;
  var regra = SEMANA_REGRAS[clamp(semana, 1, 3)] || SEMANA_REGRAS[1];
  return regra.mostra[i] || null;
}

/* ============================ AÇÕES DE NAVEGAÇÃO ============================ */

/** Avança para o próximo pesquisador (com wrap) e re-renderiza. */
function navNext() {
  var total = countResearchers();
  if (total === 0) return;
  setCurrentIndex((getCurrentIndex() + 1) % total);
  renderRegistro();
}

/** Volta ao pesquisador anterior (com wrap) e re-renderiza. */
function navPrev() {
  var total = countResearchers();
  if (total === 0) return;
  setCurrentIndex((getCurrentIndex() - 1 + total) % total);
  renderRegistro();
}

/** Salvar = re-renderiza (os campos já foram persistidos no edit) + feedback. */
function navSave() {
  renderRegistro();
  toast('Salvo ✓', APP.NAME, 3);
}

/** Botão COMEÇAR REGISTROS: vai para o primeiro pesquisador. */
function navComecar() {
  setCurrentIndex(0);
  renderRegistro();
  try { getSheet(SHEETS.REGISTRO).activate(); } catch (_) {}
  toast('Bons registros! 🚀', APP.NAME, 3);
}

/* ============================ PRIMITIVOS DE UI ============================ */

/** Limpa conteúdo e formatos de uma região de tela e desfaz merges. */
function resetScreen(sh, fromRow, toRow) {
  var rng = sh.getRange(fromRow, 1, toRow - fromRow + 1, 6);
  try { rng.breakApart(); } catch (_) {}
  rng.clearContent();
  rng.clearDataValidations();
  rng.setBackground(UI.CANVAS);
  rng.setFontColor('#000000');
  rng.setFontWeight('normal');
  rng.setFontStyle('normal');
  rng.setFontSize(11);
  rng.setBorder(false, false, false, false, false, false);
}

/** Bloco mesclado B:D em uma linha, com estilo. */
function mergeBlock(sh, row, value, style) {
  var rng = sh.getRange(row, CARD.COL, 1, CARD.COL_WIDTH);
  try { rng.breakApart(); } catch (_) {}
  rng.merge();
  rng.setValue(value);
  styleRange(rng, Object.assign({ vAlign: 'middle', wrap: true }, style || {}));
  return rng;
}

/** Separador visual (linha fina). */
function separator(sh, row) {
  var rng = sh.getRange(row, CARD.COL, 1, CARD.COL_WIDTH);
  try { rng.breakApart(); } catch (_) {}
  rng.merge();
  rng.setValue('');
  rng.setBackground(UI.SEP);
  sh.setRowHeight(row, 6);
}

/** Limpa uma linha (marco não usado). */
function clearRow(sh, row) {
  var rng = sh.getRange(row, CARD.COL, 1, CARD.COL_WIDTH);
  try { rng.breakApart(); } catch (_) {}
  rng.clearContent();
  rng.clearDataValidations();
  rng.setBackground(UI.CANVAS);
}

/** Campo de texto editável (mesclado, fundo claro). */
function editableText(sh, row, value) {
  var rng = sh.getRange(row, CARD.COL, 1, CARD.COL_WIDTH);
  try { rng.breakApart(); } catch (_) {}
  rng.merge();
  rng.setValue(value || '');
  styleRange(rng, { bg: UI.FIELD_BG, size: 13, vAlign: 'middle', wrap: true, border: true });
}

/** Dropdown de Resultado. */
function resultadoDropdown(sh, row, value) {
  var rng = sh.getRange(row, CARD.COL, 1, CARD.COL_WIDTH);
  try { rng.breakApart(); } catch (_) {}
  rng.merge();
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(RESULTADO_OPCOES.slice(1), true)
    .setAllowInvalid(true)
    .build();
  rng.setDataValidation(rule);
  rng.setValue(value || '');
  styleRange(rng, { bg: UI.FIELD_BG, size: 13, vAlign: 'middle', border: true });
}

/** Campo de marco: checkbox em B + rótulo em C:D. */
function checkboxField(sh, row, label, checked) {
  var box = sh.getRange(row, CARD.COL, 1, 1);
  box.clearDataValidations();
  box.insertCheckboxes();
  box.setValue(!!checked);
  box.setHorizontalAlignment('center');

  var lab = sh.getRange(row, CARD.COL + 1, 1, CARD.COL_WIDTH - 1);
  try { lab.breakApart(); } catch (_) {}
  lab.merge();
  lab.setValue('  ' + label);
  styleRange(lab, { size: 14, vAlign: 'middle', bold: !!checked, color: checked ? COLORS.VERDE.strong : '#000000' });
}

/** Linha de navegação: três checkboxes-botão. */
function navRow(sh, row) {
  var labels = [BTN.ANTERIOR, BTN.SALVAR, BTN.PROXIMO];
  for (var i = 0; i < 3; i++) {
    var cell = sh.getRange(row, CARD.COL + i, 1, 1);
    try { cell.breakApart(); } catch (_) {}
    cell.clearContent();
    cell.clearDataValidations();
    cell.insertCheckboxes();
    cell.setValue(false);
    cell.setBackground(UI.BUTTON_BG);
  }
  // Rótulos logo abaixo dos checkboxes.
  var labelRow = row + 1;
  for (var j = 0; j < 3; j++) {
    var lc = sh.getRange(labelRow, CARD.COL + j, 1, 1);
    try { lc.breakApart(); } catch (_) {}
    lc.setValue(labels[j]);
    styleRange(lc, { size: 10, bold: true, hAlign: 'center', color: UI.ACCENT });
  }
}

/** Botão único (checkbox) mesclado, estilo destaque (usado na Home). */
function button(sh, row, label) {
  var rng = sh.getRange(row, CARD.COL, 1, CARD.COL_WIDTH);
  try { rng.breakApart(); } catch (_) {}
  rng.merge();
  rng.insertCheckboxes();
  rng.setValue(false);
  styleRange(rng, { bg: UI.BUTTON_BG, color: UI.BUTTON_TX, size: 16, bold: true, hAlign: 'center', vAlign: 'middle' });
  sh.setRowHeight(row, 44);
  var lab = sh.getRange(row + 1, CARD.COL, 1, CARD.COL_WIDTH);
  try { lab.breakApart(); } catch (_) {}
  lab.merge();
  lab.setValue(label);
  styleRange(lab, { color: UI.ACCENT, size: 13, bold: true, hAlign: 'center' });
}
