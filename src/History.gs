/**
 * History.gs
 * Registro IMUTÁVEL de alterações. Nunca é editável (proteção aplicada no setup).
 * Sempre acrescenta: Data, Hora, Pesquisador, Campo, Valor antigo, Valor novo, Usuário.
 */

var HISTORICO_HEADERS = [
  'Data', 'Hora', 'Pesquisador', 'Campo', 'Valor Antigo', 'Valor Novo', 'Usuário'
];

/** Rótulos amigáveis dos campos editáveis. */
var FIELD_LABELS = {
  TouchDown: 'TouchDown',
  PlanoIgreja: 'Plano Igreja',
  Match: 'Match',
  Entrevista: 'Entrevista',
  ProximoPasso: 'Próximo Passo',
  Observacao: 'Observação',
  Resultado: 'Resultado'
};

function buildHistoricoSchema() {
  var sh = getOrCreateSheet(SHEETS.HISTORICO);
  sh.getRange(1, 1, 1, HISTORICO_HEADERS.length).setValues([HISTORICO_HEADERS])
    .setFontWeight('bold')
    .setBackground('#37474F')
    .setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
}

/**
 * Acrescenta uma entrada de histórico.
 * @param {Object} record  pesquisador
 * @param {string} field    chave do campo (ex.: 'Match')
 * @param {*} oldVal
 * @param {*} newVal
 * @param {string} user
 */
function logChange(record, field, oldVal, newVal, user) {
  var sh = getOrCreateSheet(SHEETS.HISTORICO);
  var d = now();
  sh.appendRow([
    Utilities.formatDate(d, ss().getSpreadsheetTimeZone(), 'dd/MM/yyyy'),
    Utilities.formatDate(d, ss().getSpreadsheetTimeZone(), 'HH:mm:ss'),
    record.nome + (record.distrito ? ' (' + record.distrito + ')' : ''),
    FIELD_LABELS[field] || field,
    formatHistValue(oldVal),
    formatHistValue(newVal),
    user || 'desconhecido'
  ]);
}

/** Normaliza valores para exibição no histórico. */
function formatHistValue(v) {
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  if (v instanceof Date) return formatDateShort(v);
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}
