/**
 * Database.gs
 * ---------------------------------------------------------------------------
 * Camada de acesso à ÚNICA base de dados (aba "Base", oculta).
 *
 * Princípios:
 *  - Existe apenas UMA base. Nenhuma tela duplica pesquisadores.
 *  - Telas (Home, Registro, Dashboards) LEEM daqui; nunca copiam linhas.
 *  - Operações em lote (getValues/setValues). Nunca célula por célula em loop.
 * ---------------------------------------------------------------------------
 */

/** Garante que a aba Base exista com os cabeçalhos corretos. */
function ensureBaseStructure_() {
  const sh = getSheet_(HIDDEN_SHEETS.BASE);
  const firstRow = sh.getRange(1, 1, 1, BASE_HEADERS.length).getValues()[0];
  const needsHeader = firstRow.join('') !== BASE_HEADERS.join('');
  if (needsHeader) {
    sh.getRange(1, 1, 1, BASE_HEADERS.length).setValues([BASE_HEADERS])
      .setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** @return {number} quantidade de linhas de dados (excluindo cabeçalho). */
function baseDataCount_() {
  const sh = ensureBaseStructure_();
  return Math.max(0, sh.getLastRow() - 1);
}

/**
 * Lê TODOS os pesquisadores em uma única chamada e devolve objetos.
 * Cada objeto inclui `_row` (linha real na planilha) para updates.
 * @return {Array<Object>}
 */
function readAllRecords_() {
  const sh = ensureBaseStructure_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, BASE_HEADERS.length).getValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (s_(row[COL.ID - 1]) === '' && s_(row[COL.NOME - 1]) === '') continue; // linha vazia
    out.push(rowToRecord_(row, i + 2));
  }
  return out;
}

/** Converte um array de célula em objeto de registro. */
function rowToRecord_(row, rowNumber) {
  const rec = { _row: rowNumber };
  BASE_HEADERS.forEach(function (h, i) { rec[h] = row[i]; });
  // Normalizações de tipo
  rec['TouchDown'] = toBool_(rec['TouchDown']);
  rec['Plano Igreja'] = toBool_(rec['Plano Igreja']);
  rec['Match'] = toBool_(rec['Match']);
  rec['Entrevista'] = toBool_(rec['Entrevista']);
  rec['Data Início'] = toDate_(rec['Data Início']);
  rec['Data Batismal'] = toDate_(rec['Data Batismal']);
  rec['Última Atualização'] = toDate_(rec['Última Atualização']);
  if (!rec['Resultado']) rec['Resultado'] = RESULTADO.ANDAMENTO;
  return rec;
}

/** Converte um objeto de registro em array na ordem dos cabeçalhos. */
function recordToRow_(rec) {
  return BASE_HEADERS.map(function (h) {
    const v = rec[h];
    return v == null ? '' : v;
  });
}

/** Localiza um registro por ID (leitura completa + filtro em memória). */
function readRecordById_(id) {
  const all = readAllRecords_();
  for (let i = 0; i < all.length; i++) {
    if (s_(all[i]['ID']) === s_(id)) return all[i];
  }
  return null;
}

/** Lê um registro pela linha física. */
function readRecordByRow_(rowNumber) {
  const sh = ensureBaseStructure_();
  const row = sh.getRange(rowNumber, 1, 1, BASE_HEADERS.length).getValues()[0];
  return rowToRecord_(row, rowNumber);
}

/**
 * Atualiza campos de um registro em UMA escrita em lote.
 * @param {number} rowNumber linha física na Base
 * @param {Object} fieldMap  { 'Match': true, 'Observação': 'texto', ... }
 * @return {Object} registro atualizado
 */
function updateRecordFields_(rowNumber, fieldMap) {
  const sh = ensureBaseStructure_();
  const range = sh.getRange(rowNumber, 1, 1, BASE_HEADERS.length);
  const row = range.getValues()[0];
  BASE_HEADERS.forEach(function (h, i) {
    if (Object.prototype.hasOwnProperty.call(fieldMap, h)) {
      row[i] = fieldMap[h];
    }
  });
  range.setValues([row]);
  return rowToRecord_(row, rowNumber);
}

/** Gera o próximo ID sequencial (P001, P002, ...). */
function nextId_() {
  const all = readAllRecords_();
  let max = 0;
  all.forEach(function (r) {
    const m = /^P(\d+)$/.exec(s_(r['ID']));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'P' + ('00' + (max + 1)).slice(-3);
}

/**
 * Insere um novo pesquisador (append em lote de uma linha).
 * @param {Object} rec
 * @return {Object} registro inserido
 */
function addRecord_(rec) {
  const sh = ensureBaseStructure_();
  if (!rec['ID']) rec['ID'] = nextId_();
  if (!rec['Resultado']) rec['Resultado'] = RESULTADO.ANDAMENTO;
  const rowNumber = sh.getLastRow() + 1;
  sh.getRange(rowNumber, 1, 1, BASE_HEADERS.length).setValues([recordToRow_(rec)]);
  return rowToRecord_(recordToRow_(rec), rowNumber);
}

/**
 * Persiste em lote a Semana e o Status calculados para todos os registros.
 * Usado pelo recálculo diário e após edições. Uma única escrita por coluna.
 * @param {Array<Object>} records registros já com 'Semana' e 'Status' definidos
 */
function persistComputedColumns_(records) {
  if (!records.length) return;
  const sh = ensureBaseStructure_();
  const minRow = records.reduce(function (m, r) { return Math.min(m, r._row); }, Infinity);
  const maxRow = records.reduce(function (m, r) { return Math.max(m, r._row); }, 0);
  const byRow = {};
  records.forEach(function (r) { byRow[r._row] = r; });

  const height = maxRow - minRow + 1;
  const semanaCol = sh.getRange(minRow, COL.SEMANA, height, 1).getValues();
  const statusCol = sh.getRange(minRow, COL.STATUS, height, 1).getValues();
  for (let i = 0; i < height; i++) {
    const r = byRow[minRow + i];
    if (!r) continue;
    semanaCol[i][0] = r['Semana'];
    statusCol[i][0] = r['Status'];
  }
  sh.getRange(minRow, COL.SEMANA, height, 1).setValues(semanaCol);
  sh.getRange(minRow, COL.STATUS, height, 1).setValues(statusCol);
}
