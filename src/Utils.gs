/**
 * Utils.gs
 * ---------------------------------------------------------------------------
 * Funções utilitárias puras e helpers de baixo nível:
 *  - acesso a planilha/abas
 *  - datas e formatação
 *  - estado leve em PropertiesService
 *  - logging interno
 *
 * Nada aqui conhece regras de negócio. Apenas mecânica reutilizável.
 * ---------------------------------------------------------------------------
 */

/** @return {Spreadsheet} a planilha ativa. */
function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Obtém uma aba pelo nome, criando-a se necessário.
 * @param {string} name
 * @return {Sheet}
 */
function getSheet_(name) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

/** @return {Sheet|null} aba existente ou null. */
function findSheet_(name) {
  return ss_().getSheetByName(name);
}

/** Fuso configurado da planilha (para formatação consistente). */
function tz_() {
  return ss_().getSpreadsheetTimeZone() || 'America/Sao_Paulo';
}

/** Email do usuário atual (vazio se indisponível em trigger simples). */
function currentUser_() {
  try {
    const email = Session.getActiveUser().getEmail();
    return email || Session.getEffectiveUser().getEmail() || 'desconhecido';
  } catch (e) {
    return 'desconhecido';
  }
}

/* --------------------------------- Datas -------------------------------- */

/** Início do dia (00:00) de uma data. */
function startOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Dias inteiros entre duas datas (b - a), ignorando horas.
 * Positivo se b é depois de a.
 */
function daysBetween_(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay_(b) - startOfDay_(a)) / MS);
}

/** Formata data como "29 Junho" (dia + mês por extenso). */
function formatDateLong_(d) {
  if (!(d instanceof Date) || isNaN(d)) return '—';
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return d.getDate() + ' ' + meses[d.getMonth()];
}

/** Formata "Hoje 14:33" / "Ontem 09:10" / "12 Jun 14:33". */
function formatRelative_(d) {
  if (!(d instanceof Date) || isNaN(d)) return '—';
  const now = new Date();
  const diff = daysBetween_(d, now);
  const hh = Utilities.formatDate(d, tz_(), 'HH:mm');
  if (diff === 0) return 'Hoje ' + hh;
  if (diff === 1) return 'Ontem ' + hh;
  return Utilities.formatDate(d, tz_(), "dd 'de' MMM HH:mm");
}

/** Converte valor de célula para Date ou null. */
function toDate_(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const p = new Date(v);
    if (!isNaN(p)) return p;
  }
  return null;
}

/** Converte valor de checkbox para booleano. */
function toBool_(v) {
  return v === true || v === 'TRUE' || v === 'Sim' || v === 1;
}

/* ------------------------- Estado (Properties) -------------------------- */

function props_() {
  return PropertiesService.getDocumentProperties();
}

function getState_(key, fallback) {
  const raw = props_().getProperty(key);
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

function setState_(key, value) {
  props_().setProperty(key, JSON.stringify(value));
}

/* -------------------------------- Logs ---------------------------------- */

/**
 * Registra um evento na aba Logs (oculta). Tolerante a falhas: nunca
 * interrompe o fluxo principal por causa de log.
 */
function logEvent_(level, origin, message) {
  try {
    const sh = findSheet_(HIDDEN_SHEETS.LOGS);
    if (!sh) return;
    sh.appendRow([new Date(), level, origin, String(message)]);
  } catch (e) {
    // Silencioso por design.
  }
}

/** Mede e loga a duração de uma operação (apenas em DEBUG). */
function withTiming_(label, fn) {
  const t0 = Date.now();
  const out = fn();
  logEvent_('DEBUG', 'perf', label + ' levou ' + (Date.now() - t0) + 'ms');
  return out;
}

/** Garante string segura para célula (evita undefined/null). */
function s_(v) {
  return v == null ? '' : String(v);
}

/* ------------------------- UI / Layout (mecânica) ----------------------- */
/*
 * Helpers de aparência reutilizados por todas as telas para dar o visual de
 * "aplicativo" (cards, respiros, títulos) em vez de planilha. Nenhuma regra
 * de negócio aqui — apenas formatação.
 */

/**
 * Limpa completamente uma área de uma aba antes de re-renderizar:
 * desfaz mesclas, remove conteúdo, formatos, validações (checkboxes) e notas.
 * Essencial porque clear() não desfaz mesclas — re-mesclar quebraria o render.
 */
function resetSheet_(sh, rows, cols) {
  rows = rows || 120;
  cols = cols || 8;
  const r = sh.getRange(1, 1, rows, cols);
  try { r.breakApart(); } catch (e) { /* nenhuma mescla: ok */ }
  r.clear();
  r.clearDataValidations();
  r.clearNote();
  return sh;
}

/** Largura padrão das colunas para o visual de card no celular. */
function setColumnLayout_(sh) {
  sh.setColumnWidth(1, 18);    // A: respiro
  sh.setColumnWidth(2, 150);   // B
  sh.setColumnWidth(3, 120);   // C
  sh.setColumnWidth(4, 120);   // D
  sh.setColumnWidth(5, 60);    // E: controles
  sh.setColumnWidth(6, 18);    // F: respiro
}

/** Pinta o "canvas" (fundo) de uma área para parecer um app. */
function paintCanvas_(sh, rows, cols) {
  rows = rows || 40;
  cols = cols || 6;
  sh.getRange(1, 1, rows, cols).setBackground(UI.CANVAS);
}

/** Escreve um título grande + subtítulo discreto. */
function writeTitle_(sh, row, title, subtitle) {
  const t = sh.getRange(row, REG.COL_LABEL, 1, REG.WIDTH_FIRST).merge();
  t.setValue(title)
    .setFontSize(20).setFontWeight('bold').setFontColor(UI.TITLE)
    .setVerticalAlignment('middle');
  sh.setRowHeight(row, 38);
  if (subtitle != null) {
    const s = sh.getRange(row + 1, REG.COL_LABEL, 1, REG.WIDTH_FIRST).merge();
    s.setValue(subtitle).setFontSize(11).setFontColor(UI.SUBTLE);
  }
}

/**
 * Desenha um "botão" como bloco colorido (usado tanto para checkbox-botões
 * quanto para rótulos clicáveis). Retorna o range do rótulo.
 */
function drawButtonBlock_(sh, row, col, span, label, fill, textColor) {
  const r = sh.getRange(row, col, 1, span);
  if (span > 1) r.merge();
  r.setValue(label)
    .setBackground(fill || UI.BUTTON)
    .setFontColor(textColor || UI.BUTTON_TEXT)
    .setFontWeight('bold')
    .setFontSize(13)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sh.setRowHeight(row, 40);
  return r;
}

/** Mescla um intervalo horizontal de forma segura (desfaz mescla anterior). */
function mergeRow_(sh, row, col, span) {
  const r = sh.getRange(row, col, 1, span);
  if (r.isPartOfMerge()) r.breakApart();
  if (span > 1) r.merge();
  return r;
}

/** Linha divisória sutil (separador entre blocos do card). */
function drawDivider_(sh, row) {
  const r = mergeRow_(sh, row, REG.COL_LABEL, REG.WIDTH_FIRST);
  r.setBackground(UI.DIVIDER);
  sh.setRowHeight(row, 2);
  return r;
}
