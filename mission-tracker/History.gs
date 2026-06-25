/**
 * History.gs
 * -----------------------------------------------------------------------------
 * Aba Histórico: trilha de auditoria IMUTÁVEL. Nunca editável pelo usuário.
 *
 * Registra: Data | Hora | ID | Nome | Campo | Valor antigo | Valor novo | Usuário
 *
 * Decisão: gravar em LOTE (uma chamada setValues por commit de edição), mesmo
 * quando vários campos mudam, para não onerar o app mobile.
 */

const HIST_HEADERS = [
  'Data', 'Hora', 'ID', 'Nome', 'Campo', 'Valor antigo', 'Valor novo', 'Usuário'
];

function historicoSheet() {
  return getOrCreateSheet(SHEETS.HISTORICO);
}

function ensureHistoryHeaders() {
  const sh = historicoSheet();
  ensureDimensions(sh, 1, HIST_HEADERS.length);
  sh.getRange(1, 1, 1, HIST_HEADERS.length).setValues([HIST_HEADERS]).setFontWeight('bold');
  sh.setFrozenRows(1);
}

/** Normaliza valores para exibição no histórico. */
function histValue(colIndex, value) {
  if (colIndex === COL.TOUCHDOWN || colIndex === COL.PLANO ||
      colIndex === COL.MATCH || colIndex === COL.ENTREVISTA) {
    return toBool(value) ? 'Sim' : 'Não';
  }
  if (value instanceof Date) return formatDateHuman(value);
  return value === '' || value == null ? '—' : String(value);
}

/**
 * Acrescenta N mudanças ao histórico em UMA escrita.
 * @param {string} id
 * @param {string} nome
 * @param {Array<{col:number, oldVal:*, newVal:*}>} changes
 * @param {string} user
 */
function appendHistory(id, nome, changes, user) {
  if (!changes || !changes.length) return;
  const sh = historicoSheet();
  const d = now();
  const data = Utilities.formatDate(d, tz(), 'dd/MM/yyyy');
  const hora = Utilities.formatDate(d, tz(), 'HH:mm:ss');
  const rows = changes.map(function (c) {
    return [
      data, hora, id, nome,
      fieldLabel(c.col),
      histValue(c.col, c.oldVal),
      histValue(c.col, c.newVal),
      user || currentUser()
    ];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, HIST_HEADERS.length).setValues(rows);
}

/** Retorna as últimas N entradas de histórico de um pesquisador. */
function getHistoryFor(id, limit) {
  const sh = historicoSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const data = sh.getRange(2, 1, last - 1, HIST_HEADERS.length).getValues();
  const out = [];
  for (let i = data.length - 1; i >= 0 && out.length < (limit || 5); i--) {
    if (String(data[i][2]) === String(id)) out.push(data[i]);
  }
  return out;
}

/**
 * Protege a aba Histórico contra edição manual (somente o script escreve).
 * Em mobile não há como editar abas protegidas — garante imutabilidade.
 */
function protectHistory() {
  const sh = historicoSheet();
  removeAllProtections(sh);
  const p = sh.protect().setDescription('Histórico imutável');
  p.setWarningOnly(false);
  try {
    const me = Session.getEffectiveUser();
    p.removeEditors(p.getEditors());
    p.addEditor(me); // só o dono/script
  } catch (e) { /* ambiente sem permissão total */ }
}
