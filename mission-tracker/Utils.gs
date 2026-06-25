/**
 * Utils.gs
 * -----------------------------------------------------------------------------
 * Funções utilitárias puras e helpers de baixo nível para datas, acesso a abas
 * e construção de "cards" (a camada de UI feita só com células).
 *
 * Decisão: toda a aparência de "app" (sem cara de planilha) nasce destes
 * helpers de layout — merges, alturas grandes, cores e grid escondido.
 */

/** Spreadsheet ativa (cacheado por execução). */
function ss() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Retorna a aba pelo nome, criando-a se necessário. */
function getOrCreateSheet(name) {
  const s = ss().getSheetByName(name);
  return s ? s : ss().insertSheet(name);
}

/** Retorna a aba ou null. */
function getSheet(name) {
  return ss().getSheetByName(name);
}

/** E-mail do usuário atual (vazio em alguns contextos mobile). */
function currentUser() {
  try {
    const e = Session.getActiveUser().getEmail();
    return e || Session.getEffectiveUser().getEmail() || 'desconhecido';
  } catch (err) {
    return 'desconhecido';
  }
}

/* ----------------------------- Datas --------------------------------------- */

function now() {
  return new Date();
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Diferença em dias inteiros (b - a). */
function daysBetween(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return 0;
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

function tz() {
  return ss().getSpreadsheetTimeZone() || 'America/Sao_Paulo';
}

/** "29 Junho" — formato curto e humano para data batismal. */
function formatDateHuman(d) {
  if (!(d instanceof Date) || isNaN(d)) return '—';
  return Utilities.formatDate(d, tz(), 'dd MMMM');
}

/** "Hoje 14:33" / "Ontem 09:10" / "12/06 08:00". */
function formatLastUpdate(d) {
  if (!(d instanceof Date) || isNaN(d)) return 'nunca';
  const diff = daysBetween(d, now());
  const hora = Utilities.formatDate(d, tz(), 'HH:mm');
  if (diff === 0) return 'Hoje ' + hora;
  if (diff === 1) return 'Ontem ' + hora;
  return Utilities.formatDate(d, tz(), 'dd/MM') + ' ' + hora;
}

/* ----------------------------- Diversos ------------------------------------ */

/** Mensagem rápida (toast). Inofensivo onde não aparece. */
function toast(msg, title) {
  try {
    ss().toast(msg, title || 'Mission Tracker', 4);
  } catch (e) { /* ignore */ }
}

function isCheckedValue(v) {
  return v === true || v === 'TRUE' || v === 'VERDADEIRO';
}

/** Garante boolean a partir de leitura de célula. */
function toBool(v) {
  return v === true || v === 'TRUE' || v === 'VERDADEIRO';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function uuid() {
  return Utilities.getUuid().slice(0, 8).toUpperCase();
}

/* ------------------------- Helpers de layout (UI) -------------------------- */

/**
 * Prepara uma aba para parecer um "app":
 *  - esconde o grid (gridlines)
 *  - limpa formatação anterior
 *  - define largura de colunas (margem + conteúdo + margem)
 */
function prepCanvas(sheet, contentCols) {
  contentCols = contentCols || 1;
  sheet.clear();
  sheet.clearConditionalFormatRules();
  // clear() não remove validações/checkboxes; limpamos explicitamente para
  // não deixar caixas de seleção "fantasma" ao reconstruir a tela.
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  removeAllProtections(sheet);
  sheet.setHiddenGridlines(true);

  // Coluna A = margem; colunas de conteúdo; última = margem.
  const totalCols = contentCols + 2;
  // Folga de linhas suficiente para dashboards com muitos cards/distritos.
  ensureDimensions(sheet, 220, Math.max(totalCols, 6));

  sheet.setColumnWidth(1, 18); // margem esquerda
  for (let c = 0; c < contentCols; c++) {
    sheet.setColumnWidth(2 + c, Math.floor(330 / contentCols));
  }
  sheet.setColumnWidth(2 + contentCols, 18); // margem direita

  // Fundo branco geral.
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
    .setBackground('#ffffff')
    .setFontFamily('Arial');
}

function ensureDimensions(sheet, rows, cols) {
  const maxR = sheet.getMaxRows();
  const maxC = sheet.getMaxColumns();
  if (maxR < rows) sheet.insertRowsAfter(maxR, rows - maxR);
  if (maxC < cols) sheet.insertColumnsAfter(maxC, cols - maxC);
}

function removeAllProtections(sheet) {
  const prots = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .concat(sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET));
  prots.forEach(function (p) {
    try { if (p.canEdit()) p.remove(); } catch (e) { /* ignore */ }
  });
}

/**
 * Escreve um "bloco" (card) começando em (row, col=2), mesclando largura.
 * Retorna a próxima linha livre. Usado para montar cards empilhados.
 */
function writeBlock(sheet, row, opts) {
  opts = opts || {};
  const col = 2;
  const span = opts.span || 1; // quantas colunas de conteúdo mesclar
  const range = sheet.getRange(row, col, 1, span);
  if (span > 1) range.merge();

  range.setValue(opts.text != null ? opts.text : '');
  range.setFontSize(opts.size || 11);
  range.setFontWeight(opts.bold ? 'bold' : 'normal');
  range.setFontColor(opts.color || '#202124');
  range.setBackground(opts.bg || '#ffffff');
  range.setHorizontalAlignment(opts.align || 'left');
  range.setVerticalAlignment('middle');
  range.setWrap(true);
  if (opts.height) sheet.setRowHeight(row, opts.height);
  if (opts.border) {
    range.setBorder(true, true, true, true, false, false,
      opts.borderColor || '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID);
  }
  return row + 1;
}

/** Linha separadora fina (visual de divisória entre seções). */
function writeSeparator(sheet, row, span) {
  const r = sheet.getRange(row, 2, 1, span || 1);
  if ((span || 1) > 1) r.merge();
  r.setBackground('#f1f3f4');
  sheet.setRowHeight(row, 6);
  return row + 1;
}

/** Linha de espaçamento (respiro). */
function writeSpacer(sheet, row, height) {
  sheet.setRowHeight(row, height || 10);
  return row + 1;
}
