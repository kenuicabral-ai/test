/**
 * Database.gs
 * ----------------------------------------------------------------------------
 * Acesso à ÚNICA fonte de dados: a aba Base. Nenhuma outra parte do sistema
 * lê/escreve linhas de pesquisadores diretamente — tudo passa por aqui.
 *
 * Princípios:
 *  - Uma leitura em lote -> array de objetos (nada de getValue() em loop).
 *  - Escrita em lote (setValues) -> nunca célula por célula.
 *  - Pesquisadores NUNCA são duplicados nem copiados para outras abas.
 * ----------------------------------------------------------------------------
 */

/**
 * Converte uma linha crua da Base em objeto de domínio.
 * @param {Array} r  valores da linha (0-based interno)
 * @param {number} rowNumber  número real da linha na planilha
 */
function rowToResearcher(r, rowNumber) {
  return {
    row: rowNumber,
    id: r[COL.ID - 1],
    nome: r[COL.NOME - 1],
    distrito: r[COL.DISTRITO - 1],
    area: r[COL.AREA - 1],
    semana: Number(r[COL.SEMANA - 1]) || 1,
    dataBatismal: r[COL.DATA_BATISMAL - 1],
    touchdown: toBool(r[COL.TOUCHDOWN - 1]),
    planoIgreja: toBool(r[COL.PLANO_IGREJA - 1]),
    match: toBool(r[COL.MATCH - 1]),
    entrevista: toBool(r[COL.ENTREVISTA - 1]),
    proximoPasso: r[COL.PROXIMO_PASSO - 1],
    observacao: r[COL.OBSERVACAO - 1],
    resultado: r[COL.RESULTADO - 1],
    reserva: toBool(r[COL.RESERVA - 1]),
    status: r[COL.STATUS - 1],
    ultimaAtualizacao: r[COL.ULTIMA_ATUALIZACAO - 1],
    usuario: r[COL.USUARIO - 1]
  };
}

/**
 * Lê todos os pesquisadores em UMA chamada.
 * @return {Array<Object>}
 */
function readAll() {
  var sh = getSheet(SHEETS.BASE, true);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, BASE_COLS).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[COL.NOME - 1] === '' && r[COL.ID - 1] === '') continue; // pula linhas vazias
    out.push(rowToResearcher(r, i + 2));
  }
  return out;
}

/** Quantidade de pesquisadores ativos na Base. */
function countResearchers() {
  return readAll().length;
}

/** Pesquisador por posição (0-based) na lista lida. */
function getByIndex(i) {
  var all = readAll();
  if (all.length === 0) return null;
  var idx = clamp(i, 0, all.length - 1);
  return all[idx];
}

/** Pesquisador por número de linha real na Base. */
function getByRow(rowNumber) {
  var sh = getSheet(SHEETS.BASE, true);
  if (rowNumber < 2 || rowNumber > sh.getLastRow()) return null;
  var r = sh.getRange(rowNumber, 1, 1, BASE_COLS).getValues()[0];
  return rowToResearcher(r, rowNumber);
}

/**
 * Aplica uma atualização parcial a um pesquisador, em LOTE.
 * Recalcula status, carimba data/hora e usuário e registra histórico.
 *
 * @param {number} rowNumber  linha na Base
 * @param {Object} changes    mapa { COL.X: novoValor }
 * @param {string=} usuario   e-mail (default: usuário atual)
 * @return {Object} pesquisador atualizado
 */
function updateResearcher(rowNumber, changes, usuario) {
  var sh = getSheet(SHEETS.BASE, true);
  var before = sh.getRange(rowNumber, 1, 1, BASE_COLS).getValues()[0];
  var after = before.slice();

  var user = usuario || getUserEmail();
  var historyBatch = [];
  var changed = false;

  // Aplica mudanças e coleta histórico (somente do que de fato mudou).
  Object.keys(changes).forEach(function (colStr) {
    var col = Number(colStr);
    var oldVal = before[col - 1];
    var newVal = changes[col];
    if (asText(oldVal) === asText(newVal)) return; // sem mudança real
    after[col - 1] = newVal;
    changed = true;
    historyBatch.push({
      id: before[COL.ID - 1],
      nome: before[COL.NOME - 1],
      campo: headerForCol(col),
      antigo: oldVal,
      novo: newVal,
      usuario: user
    });
  });

  if (!changed) return rowToResearcher(after, rowNumber);

  // Carimbos automáticos.
  after[COL.ULTIMA_ATUALIZACAO - 1] = now();
  after[COL.USUARIO - 1] = user;

  // Recalcula status (cor) a partir do estado novo.
  var researcher = rowToResearcher(after, rowNumber);
  var status = computeStatus(researcher);
  after[COL.STATUS - 1] = status;
  researcher.status = status;

  // Escrita em LOTE (uma chamada).
  sh.getRange(rowNumber, 1, 1, BASE_COLS).setValues([after]);

  // Histórico + cor da linha na Base.
  appendHistory(historyBatch);
  paintBaseRow(sh, rowNumber, status);

  return researcher;
}

/** Cabeçalho legível para uma coluna da Base. */
function headerForCol(col) {
  return BASE_HEADERS[col - 1] || ('Coluna ' + col);
}

/**
 * Insere um novo pesquisador (append). Gera ID, status inicial e carimbos.
 * @param {Object} data  { nome, distrito, area, semana, dataBatismal }
 */
function insertResearcher(data) {
  var sh = getSheet(SHEETS.BASE, true);
  var row = new Array(BASE_COLS).fill('');
  row[COL.ID - 1] = newId();
  row[COL.NOME - 1] = data.nome || 'Sem nome';
  row[COL.DISTRITO - 1] = data.distrito || getConfig()[CONFIG_KEYS.DISTRITO];
  row[COL.AREA - 1] = data.area || '';
  row[COL.SEMANA - 1] = data.semana || 1;
  row[COL.DATA_BATISMAL - 1] = data.dataBatismal || '';
  row[COL.TOUCHDOWN - 1] = false;
  row[COL.PLANO_IGREJA - 1] = false;
  row[COL.MATCH - 1] = false;
  row[COL.ENTREVISTA - 1] = false;
  row[COL.PROXIMO_PASSO - 1] = '';
  row[COL.OBSERVACAO - 1] = '';
  row[COL.RESULTADO - 1] = '';
  row[COL.RESERVA - 1] = false;
  row[COL.ULTIMA_ATUALIZACAO - 1] = now();
  row[COL.USUARIO - 1] = getUserEmail();

  var researcher = rowToResearcher(row, sh.getLastRow() + 1);
  row[COL.STATUS - 1] = computeStatus(researcher);

  sh.appendRow(row);
  return getByRow(sh.getLastRow());
}
