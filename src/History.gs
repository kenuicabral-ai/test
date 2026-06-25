/**
 * History.gs
 * ---------------------------------------------------------------------------
 * Histórico append-only. Nunca permite edição (a aba é protegida em setup).
 * Registra cada alteração de campo feita pelo LD:
 *   Data | Hora | ID | Nome | Campo | Valor Antigo | Valor Novo | Usuário
 * ---------------------------------------------------------------------------
 */

/** Garante estrutura da aba Histórico. */
function ensureHistoryStructure_() {
  const sh = getSheet_(HIDDEN_SHEETS.HISTORY);
  const firstRow = sh.getRange(1, 1, 1, HISTORY_HEADERS.length).getValues()[0];
  if (firstRow.join('') !== HISTORY_HEADERS.join('')) {
    sh.getRange(1, 1, 1, HISTORY_HEADERS.length).setValues([HISTORY_HEADERS])
      .setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Registra um conjunto de alterações em UMA escrita em lote.
 * @param {Object} rec registro alterado (precisa de ID e Nome)
 * @param {Array<{field:string, oldValue:*, newValue:*}>} changes
 * @param {string} user
 */
function logChanges_(rec, changes, user) {
  if (!changes || !changes.length) return;
  const sh = ensureHistoryStructure_();
  const now = new Date();
  const data = Utilities.formatDate(now, tz_(), 'dd/MM/yyyy');
  const hora = Utilities.formatDate(now, tz_(), 'HH:mm:ss');
  const rows = changes.map(function (c) {
    return [
      data, hora,
      s_(rec['ID']), s_(rec['Nome']),
      c.field,
      formatHistValue_(c.oldValue),
      formatHistValue_(c.newValue),
      user || 'desconhecido',
    ];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, HISTORY_HEADERS.length)
    .setValues(rows);
}

/** Formata valores para leitura humana no histórico. */
function formatHistValue_(v) {
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'dd/MM/yyyy HH:mm');
  return s_(v);
}

/**
 * Compara dois snapshots de registro e devolve a lista de mudanças
 * apenas para campos editáveis.
 * @return {Array<{field, oldValue, newValue}>}
 */
function diffEditableFields_(before, after) {
  const changes = [];
  EDITABLE_FIELDS.forEach(function (f) {
    const a = normalizeForDiff_(before ? before[f] : '');
    const b = normalizeForDiff_(after ? after[f] : '');
    if (a !== b) {
      changes.push({ field: f, oldValue: before ? before[f] : '', newValue: after ? after[f] : '' });
    }
  });
  return changes;
}

/** Normaliza valores para comparação estável. */
function normalizeForDiff_(v) {
  if (v === true) return 'true';
  if (v === false || v == null || v === '') return 'false_or_empty';
  if (v instanceof Date) return String(v.getTime());
  return String(v).trim();
}
