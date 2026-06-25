/**
 * Utils.gs
 * Helpers genéricos: acesso a abas, estado (Sistema), datas,
 * toast e primitivas de desenho de UI (cards) reutilizadas por todas as telas.
 */

/* ----------------------------------------------------------------------- */
/* Abas                                                                    */
/* ----------------------------------------------------------------------- */

function ss() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheetOrNull(name) {
  return ss().getSheetByName(name);
}

function getOrCreateSheet(name) {
  var s = ss().getSheetByName(name);
  if (!s) {
    s = ss().insertSheet(name);
  }
  return s;
}

/* ----------------------------------------------------------------------- */
/* Estado (aba Sistema, chave/valor)                                       */
/* ----------------------------------------------------------------------- */

function sysGet(key, fallback) {
  var sh = getSheetOrNull(SHEETS.SISTEMA);
  if (!sh) return fallback;
  var values = sh.getDataRange().getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === key) {
      var v = values[i][1];
      return (v === '' || v === null || v === undefined) ? fallback : v;
    }
  }
  return fallback;
}

function sysGetInt(key, fallback) {
  var v = sysGet(key, fallback);
  var n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

function sysGetJson(key, fallback) {
  var v = sysGet(key, null);
  if (v === null) return fallback;
  try {
    return JSON.parse(v);
  } catch (err) {
    return fallback;
  }
}

function sysSet(key, value) {
  var sh = getOrCreateSheet(SHEETS.SISTEMA);
  var stored = (typeof value === 'object') ? JSON.stringify(value) : value;
  var values = sh.getDataRange().getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === key) {
      sh.getRange(i + 1, 2).setValue(stored);
      return;
    }
  }
  sh.appendRow([key, stored]);
}

/* ----------------------------------------------------------------------- */
/* Usuário / Toast / Logs                                                  */
/* ----------------------------------------------------------------------- */

function getUserEmail() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (email) return email;
    email = Session.getEffectiveUser().getEmail();
    return email || 'desconhecido';
  } catch (err) {
    return 'desconhecido';
  }
}

function toast(message, title) {
  try {
    ss().toast(message, title || 'Mission Tracker', 5);
  } catch (err) {
    // toast pode não estar disponível em alguns contextos; ignora.
  }
}

function logEvent(scope, message) {
  try {
    var sh = getOrCreateSheet(SHEETS.LOGS);
    sh.appendRow([new Date(), scope, String(message)]);
  } catch (err) {
    // Nunca deixar o log derrubar a execução principal.
  }
}

function logError(scope, err) {
  var msg = (err && err.stack) ? err.stack : String(err);
  logEvent('ERRO:' + scope, msg);
}

/* ----------------------------------------------------------------------- */
/* Datas                                                                   */
/* ----------------------------------------------------------------------- */

function now() {
  return new Date();
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Dias inteiros entre duas datas (b - a), ignorando horário. */
function daysBetween(a, b) {
  var ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

/** "29 Junho" */
function formatDateShort(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  return d.getDate() + ' ' + MONTHS_PT[d.getMonth()];
}

/** "Hoje 14:33", "Ontem 09:10" ou "12 Junho 14:33". */
function formatUpdate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return 'nunca';
  var diff = daysBetween(d, now());
  var hh = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  if (diff === 0) return 'Hoje ' + hh;
  if (diff === 1) return 'Ontem ' + hh;
  return formatDateShort(d) + ' ' + hh;
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Aceita Date, "aaaa-mm-dd" ou "dd/mm/aaaa". Retorna Date ou ''. */
function parseDateLoose(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  var s = String(value || '').trim();
  if (!s) return '';
  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  var br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  var d = new Date(s);
  return isNaN(d.getTime()) ? '' : d;
}

/* ----------------------------------------------------------------------- */
/* Primitivas de UI (cards)                                                */
/* ----------------------------------------------------------------------- */

/**
 * Prepara a "tela": limpa conteúdo/formatação, define largura de colunas,
 * altura de linhas, esconde linhas de grade e fixa fonte padrão.
 */
function prepareCanvas(sh, cols, rows, colWidthPx) {
  sh.clear();
  sh.clearNotes();
  removeCheckboxValidations(sh, cols, rows);
  try { sh.getRange(1, 1, Math.max(rows, 1), Math.max(cols, 1)).breakApart(); } catch (err) { /* sem merges */ }
  sh.setHiddenGridlines(true);
  for (var c = 1; c <= cols; c++) {
    sh.setColumnWidth(c, colWidthPx);
  }
  for (var r = 1; r <= rows; r++) {
    sh.setRowHeight(r, 30);
  }
  var all = sh.getRange(1, 1, rows, cols);
  all.setFontFamily(UI.FONT)
    .setVerticalAlignment('middle')
    .setBackground(UI.PANEL_BG)
    .setFontColor(UI.VALUE_FG);
}

function removeCheckboxValidations(sh, cols, rows) {
  try {
    sh.getRange(1, 1, Math.max(rows, 1), Math.max(cols, 1)).clearDataValidations();
  } catch (err) {
    // ignora
  }
}

/** Faixa de título do app (parece o topo de um app). */
function drawHeader(sh, cols, title, subtitle) {
  sh.setRowHeight(1, 56);
  var rng = mergeRow(sh, 1, 1, cols);
  rng.setValue(title + (subtitle ? '\n' + subtitle : ''))
    .setBackground(UI.HEADER_BG)
    .setFontColor(UI.HEADER_FG)
    .setFontSize(16)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
}

function drawSeparator(sh, row, cols) {
  sh.setRowHeight(row, 8);
  mergeRow(sh, row, 1, cols).setBackground(UI.SEP_BG);
}

function drawSectionTitle(sh, row, cols, text) {
  mergeRow(sh, row, 1, cols)
    .setValue(text)
    .setBackground(UI.PANEL_BG)
    .setFontColor(UI.LABEL_FG)
    .setFontSize(11)
    .setFontWeight('bold')
    .setHorizontalAlignment('left');
}

/** Linha com rótulo (A:C) e valor (D:F) — usada na Configuração. */
function drawFieldRow(sh, row, label, value) {
  var half = 3;
  var lab = sh.getRange(row, 1, 1, half).merge();
  lab.setValue(label)
    .setBackground(UI.PANEL_BG)
    .setFontColor(UI.LABEL_FG)
    .setFontSize(11)
    .setHorizontalAlignment('left');
  var val = sh.getRange(row, half + 1, 1, half).merge();
  val.setValue(value === null || value === undefined ? '' : value)
    .setBackground(UI.CARD_BG)
    .setFontColor(UI.VALUE_FG)
    .setFontSize(12)
    .setHorizontalAlignment('left')
    .setBorder(true, true, true, true, false, false, '#DADCE0', SpreadsheetApp.BorderStyle.SOLID);
}

/** Botão: checkbox em A{row} + rótulo em B:cols. */
function drawButtonRow(sh, row, cols, label) {
  sh.getRange(row, 1).insertCheckboxes().setValue(false)
    .setBackground(UI.CARD_BG)
    .setHorizontalAlignment('center');
  sh.getRange(row, 2, 1, cols - 1).merge()
    .setValue(label)
    .setBackground(UI.CARD_BG)
    .setFontColor(UI.BTN_BG)
    .setFontSize(13)
    .setFontWeight('bold')
    .setHorizontalAlignment('left');
}

/** Mescla um intervalo dentro de uma linha e retorna o range mesclado. */
function mergeRow(sh, row, startCol, numCols) {
  var rng = sh.getRange(row, startCol, 1, numCols);
  rng.breakApart();
  rng.merge();
  return rng;
}

/** Limpa todos os gatilhos instaláveis de uma função (evita duplicidade). */
function removeTriggers(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(t);
    }
  });
}
