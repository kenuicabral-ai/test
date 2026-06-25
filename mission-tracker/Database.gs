/**
 * Database.gs
 * -----------------------------------------------------------------------------
 * Única porta de acesso à BASE de dados e ao ESTADO do sistema.
 *
 * Princípios:
 *  - Existe APENAS UMA base (aba "Base"). Nenhuma tela copia linhas.
 *  - Leitura/escrita SEMPRE em lote (getValues/setValues) — nunca célula a
 *    célula — para performance no app mobile.
 *  - Estado (qual pesquisador está aberto, lista de navegação, filtros) vive
 *    na aba "Sistema" como pares chave/valor.
 */

/* ------------------------------- BASE -------------------------------------- */

function baseSheet() {
  return getOrCreateSheet(SHEETS.BASE);
}

/** Garante cabeçalho da Base. */
function ensureBaseHeaders() {
  const sh = baseSheet();
  ensureDimensions(sh, 1, BASE_LAST_COL);
  sh.getRange(1, 1, 1, BASE_LAST_COL).setValues([BASE_HEADERS]).setFontWeight('bold');
  sh.setFrozenRows(1);
}

/**
 * Lê TODAS as linhas da Base de uma vez.
 * Retorna array de arrays (sem cabeçalho). Cada linha é um "record" indexado
 * pelas constantes COL (lembrando: COL é 1-indexed, array é 0-indexed).
 */
function getAllRecords() {
  const sh = baseSheet();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, BASE_LAST_COL).getValues();
}

/** Encontra o índice (0-based, relativo aos dados) de um ID. -1 se não achar. */
function findRowIndexById(records, id) {
  for (let i = 0; i < records.length; i++) {
    if (String(records[i][COL.ID - 1]) === String(id)) return i;
  }
  return -1;
}

/** Lê um único record pelo ID. */
function getRecordById(id) {
  const records = getAllRecords();
  const i = findRowIndexById(records, id);
  return i === -1 ? null : records[i];
}

/**
 * Persiste um record completo de volta na Base, em UMA escrita em lote.
 * @param {string} id
 * @param {Array} record  Linha completa (BASE_LAST_COL colunas).
 */
function writeRecord(id, record) {
  const sh = baseSheet();
  const records = getAllRecords();
  const i = findRowIndexById(records, id);
  if (i === -1) return false;
  sh.getRange(i + 2, 1, 1, BASE_LAST_COL).setValues([record]);
  return true;
}

/** Insere um novo pesquisador. Retorna o ID gerado. */
function insertRecord(partial) {
  ensureBaseHeaders();
  const sh = baseSheet();
  const id = partial[COL.ID - 1] || uuid();
  const row = new Array(BASE_LAST_COL).fill('');
  row[COL.ID - 1] = id;
  for (let c = 1; c <= BASE_LAST_COL; c++) {
    if (partial[c - 1] !== undefined && partial[c - 1] !== null) {
      row[c - 1] = partial[c - 1];
    }
  }
  if (row[COL.RESULTADO - 1] === '') row[COL.RESULTADO - 1] = RESULTADO.NENHUM;
  sh.appendRow(row);
  return id;
}

/* ------------------------------ ESTADO ------------------------------------- */

function sistemaSheet() {
  const sh = getOrCreateSheet(SHEETS.SISTEMA);
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, 2).setValues([['Chave', 'Valor']]).setFontWeight('bold');
  }
  return sh;
}

function sysGet(key, fallback) {
  const sh = sistemaSheet();
  const last = sh.getLastRow();
  if (last < 2) return fallback;
  const data = sh.getRange(2, 1, last - 1, 2).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return fallback;
}

function sysSet(key, value) {
  const sh = sistemaSheet();
  const last = sh.getLastRow();
  if (last >= 2) {
    const keys = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i][0] === key) {
        sh.getRange(i + 2, 2).setValue(value);
        return;
      }
    }
  }
  sh.appendRow([key, value]);
}

/* ------------------------------- CACHE ------------------------------------- */

function cacheSheet() {
  return getOrCreateSheet(SHEETS.CACHE);
}

/** Guarda uma lista de IDs em cache (ex.: ordem de navegação). */
function cachePutList(key, ids) {
  sysSet(key, (ids || []).join(','));
}

function cacheGetList(key) {
  const raw = sysGet(key, '');
  if (!raw) return [];
  return String(raw).split(',').filter(function (x) { return x !== ''; });
}
