/**
 * Utils.gs
 * ----------------------------------------------------------------------------
 * Funções utilitárias puras e helpers de baixo nível, sem regra de negócio.
 * Tudo aqui é reutilizável por qualquer módulo.
 * ----------------------------------------------------------------------------
 */

/** Retorna a planilha ativa (cacheada na execução). */
var __ss = null;
function ss() {
  if (!__ss) __ss = SpreadsheetApp.getActiveSpreadsheet();
  return __ss;
}

/**
 * Obtém uma aba por nome. Se exigir existência e não existir, lança erro claro.
 * @param {string} name
 * @param {boolean=} required
 * @return {Sheet|null}
 */
function getSheet(name, required) {
  var sh = ss().getSheetByName(name);
  if (!sh && required) {
    throw new Error('Aba não encontrada: "' + name + '". Rode setup() novamente.');
  }
  return sh;
}

/** Cria a aba se não existir; sempre retorna a aba. */
function ensureSheet(name) {
  return ss().getSheetByName(name) || ss().insertSheet(name);
}

/** Timestamp atual. */
function now() {
  return new Date();
}

/** Fuso/locale da planilha para formatação consistente. */
function tz() {
  return ss().getSpreadsheetTimeZone() || 'America/Sao_Paulo';
}

/** Formata data como "29 Jun". */
function formatDateShort(d) {
  if (!isDate(d)) return '—';
  return Utilities.formatDate(d, tz(), 'dd MMM');
}

/** Formata data/hora como "Hoje 14:33" / "Ontem 09:10" / "12 Jun 14:33". */
function formatUpdate(d) {
  if (!isDate(d)) return '—';
  var hhmm = Utilities.formatDate(d, tz(), 'HH:mm');
  var today = Utilities.formatDate(now(), tz(), 'yyyy-MM-dd');
  var that = Utilities.formatDate(d, tz(), 'yyyy-MM-dd');
  if (today === that) return 'Hoje ' + hhmm;
  var y = new Date(now().getTime() - 86400000);
  if (Utilities.formatDate(y, tz(), 'yyyy-MM-dd') === that) return 'Ontem ' + hhmm;
  return Utilities.formatDate(d, tz(), 'dd MMM HH:mm');
}

/** É uma data válida? */
function isDate(d) {
  return Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d.getTime());
}

/** Dias inteiros entre duas datas (b - a). Positivo = b no futuro. */
function daysBetween(a, b) {
  if (!isDate(a) || !isDate(b)) return null;
  var ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

/** Zera horas de uma data. */
function startOfDay(d) {
  var x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * E-mail do usuário atual, com fallbacks. Em gatilho simples pode vir vazio se
 * não autorizado — por isso o tratamento defensivo.
 */
function getUserEmail() {
  try {
    var e = Session.getActiveUser().getEmail();
    if (e) return e;
  } catch (_) {}
  try {
    var e2 = Session.getEffectiveUser().getEmail();
    if (e2) return e2;
  } catch (_) {}
  return 'desconhecido';
}

/** Toast curto (inofensivo no mobile). */
function toast(msg, title, secs) {
  try {
    ss().toast(msg, title || APP.NAME, secs || 4);
  } catch (_) {}
}

/** Normaliza booleano vindo de checkbox/string. */
function toBool(v) {
  if (v === true) return true;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === 'VERDADEIRO' || v === '✓';
  return false;
}

/** Representação textual segura de um valor (para histórico/logs). */
function asText(v) {
  if (v === null || v === undefined || v === '') return '';
  if (isDate(v)) return formatDateShort(v);
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  return String(v);
}

/** Gera um ID curto e único para um pesquisador. */
function newId() {
  return 'P-' + Utilities.formatDate(now(), tz(), 'yyMMddHHmmss') + '-' +
    Math.floor(Math.random() * 900 + 100);
}

/** Limita um número a [min, max]. */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Registra uma linha em Logs (best-effort, nunca quebra o fluxo). */
function logEvent(level, origem, mensagem) {
  try {
    var sh = getSheet(SHEETS.LOGS);
    if (!sh) return;
    sh.appendRow([now(), level, origem, String(mensagem)]);
  } catch (_) {}
}

/**
 * Aplica um conjunto de propriedades visuais a um Range de forma declarativa.
 * Mantém renderizações limpas e em lote.
 */
function styleRange(range, opts) {
  opts = opts || {};
  if (opts.bg !== undefined) range.setBackground(opts.bg);
  if (opts.color !== undefined) range.setFontColor(opts.color);
  if (opts.size !== undefined) range.setFontSize(opts.size);
  if (opts.bold !== undefined) range.setFontWeight(opts.bold ? 'bold' : 'normal');
  if (opts.italic !== undefined) range.setFontStyle(opts.italic ? 'italic' : 'normal');
  if (opts.hAlign !== undefined) range.setHorizontalAlignment(opts.hAlign);
  if (opts.vAlign !== undefined) range.setVerticalAlignment(opts.vAlign);
  if (opts.wrap !== undefined) range.setWrap(opts.wrap);
  if (opts.border) {
    range.setBorder(true, true, true, true, false, false, UI.CARD_BORDER,
      SpreadsheetApp.BorderStyle.SOLID);
  }
  return range;
}
