/**
 * Database.gs
 * Acesso ao ÚNICO banco de dados (aba Base).
 * Leitura/escrita sempre em lote (arrays). Nenhuma linha é copiada
 * para outras abas — todas as telas leem daqui.
 */

/** Cria/garante o esquema e a formatação da Base. */
function buildBaseSchema() {
  var sh = getOrCreateSheet(SHEETS.BASE);
  sh.getRange(1, 1, 1, BASE_NUM_COLS).setValues([BASE_HEADERS])
    .setFontWeight('bold')
    .setBackground('#1A237E')
    .setFontColor('#FFFFFF');
  sh.setFrozenRows(1);

  // Garante linhas/colunas suficientes.
  if (sh.getMaxColumns() < BASE_NUM_COLS) {
    sh.insertColumnsAfter(sh.getMaxColumns(), BASE_NUM_COLS - sh.getMaxColumns());
  }

  applyBaseValidations(sh);
}

/** Aplica checkboxes e a lista de Resultado às linhas de dados. */
function applyBaseValidations(sh) {
  var maxRows = sh.getMaxRows();
  var nRows = maxRows - 1;
  if (nRows <= 0) return;

  var checkRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  [COL.TOUCHDOWN, COL.PLANO_IGREJA, COL.MATCH, COL.ENTREVISTA].forEach(function (c) {
    sh.getRange(2, c, nRows, 1).setDataValidation(checkRule);
  });

  var resultadoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(RESULTADO_OPCOES, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, COL.RESULTADO, nRows, 1).setDataValidation(resultadoRule);
}

/** Converte uma linha (array de 16 valores) em um objeto record. */
function recordFromRow(arr, rowIndex) {
  return {
    row: rowIndex,
    id: String(arr[COL.ID - 1] || ''),
    nome: String(arr[COL.NOME - 1] || ''),
    distrito: String(arr[COL.DISTRITO - 1] || ''),
    semana: Number(arr[COL.SEMANA - 1]) || 1,
    area: String(arr[COL.AREA - 1] || ''),
    dataBatismal: arr[COL.DATA_BATISMAL - 1] instanceof Date ? arr[COL.DATA_BATISMAL - 1] : parseDateLoose(arr[COL.DATA_BATISMAL - 1]),
    touchDown: arr[COL.TOUCHDOWN - 1] === true,
    planoIgreja: arr[COL.PLANO_IGREJA - 1] === true,
    match: arr[COL.MATCH - 1] === true,
    entrevista: arr[COL.ENTREVISTA - 1] === true,
    proximoPasso: String(arr[COL.PROXIMO_PASSO - 1] || ''),
    observacao: String(arr[COL.OBSERVACAO - 1] || ''),
    resultado: String(arr[COL.RESULTADO - 1] || ''),
    cor: String(arr[COL.COR - 1] || ''),
    ultimaAtualizacao: arr[COL.ULTIMA_ATUALIZACAO - 1] instanceof Date ? arr[COL.ULTIMA_ATUALIZACAO - 1] : null,
    usuario: String(arr[COL.USUARIO - 1] || '')
  };
}

/** Converte um record em array de 16 valores (ordem das colunas). */
function rowFromRecord(r) {
  var arr = new Array(BASE_NUM_COLS);
  arr[COL.ID - 1] = r.id;
  arr[COL.NOME - 1] = r.nome;
  arr[COL.DISTRITO - 1] = r.distrito;
  arr[COL.SEMANA - 1] = r.semana;
  arr[COL.AREA - 1] = r.area;
  arr[COL.DATA_BATISMAL - 1] = r.dataBatismal || '';
  arr[COL.TOUCHDOWN - 1] = !!r.touchDown;
  arr[COL.PLANO_IGREJA - 1] = !!r.planoIgreja;
  arr[COL.MATCH - 1] = !!r.match;
  arr[COL.ENTREVISTA - 1] = !!r.entrevista;
  arr[COL.PROXIMO_PASSO - 1] = r.proximoPasso || '';
  arr[COL.OBSERVACAO - 1] = r.observacao || '';
  arr[COL.RESULTADO - 1] = r.resultado || '';
  arr[COL.COR - 1] = r.cor || '';
  arr[COL.ULTIMA_ATUALIZACAO - 1] = r.ultimaAtualizacao || '';
  arr[COL.USUARIO - 1] = r.usuario || '';
  return arr;
}

/** Lê TODOS os pesquisadores (uma única chamada de I/O). */
function readAll() {
  var sh = getSheetOrNull(SHEETS.BASE);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < BASE_FIRST_DATA_ROW) return [];
  var n = last - 1;
  var values = sh.getRange(BASE_FIRST_DATA_ROW, 1, n, BASE_NUM_COLS).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][COL.ID - 1] || '') === '') continue; // ignora linhas vazias
    out.push(recordFromRow(values[i], BASE_FIRST_DATA_ROW + i));
  }
  return out;
}

/** Busca um record pelo ID. Retorna null se não encontrar. */
function getById(id) {
  var all = readAll();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === String(id)) return all[i];
  }
  return null;
}

/** Escreve a linha inteira de um record (um único setValues). */
function writeRecord(r) {
  var sh = getSheetOrNull(SHEETS.BASE);
  if (!sh || !r.row) return;
  sh.getRange(r.row, 1, 1, BASE_NUM_COLS).setValues([rowFromRecord(r)]);
}

/** Escreve várias colunas calculadas de uma vez (ex.: coluna Cor). */
function writeColumn(colIndex, valuesColumn) {
  var sh = getSheetOrNull(SHEETS.BASE);
  if (!sh || !valuesColumn.length) return;
  sh.getRange(BASE_FIRST_DATA_ROW, colIndex, valuesColumn.length, 1).setValues(valuesColumn);
}

/** Adiciona um novo pesquisador, sem duplicar (mesmo nome + distrito). */
function addResearcher(obj) {
  var sh = getOrCreateSheet(SHEETS.BASE);
  var all = readAll();
  var dup = all.some(function (r) {
    return r.nome.toLowerCase() === String(obj.nome || '').toLowerCase() &&
      r.distrito.toLowerCase() === String(obj.distrito || '').toLowerCase();
  });
  if (dup) {
    toast('Já existe "' + obj.nome + '" neste distrito. Não foi duplicado.', 'Mission Tracker');
    return null;
  }

  var record = {
    row: sh.getLastRow() + 1,
    id: generateId(),
    nome: obj.nome || '',
    distrito: obj.distrito || getConfig().distrito,
    semana: Number(obj.semana) || 1,
    area: obj.area || '',
    dataBatismal: obj.dataBatismal || '',
    touchDown: false,
    planoIgreja: false,
    match: false,
    entrevista: false,
    proximoPasso: '',
    observacao: '',
    resultado: RESULTADO.NENHUM,
    cor: STATUS.AMARELO,
    ultimaAtualizacao: '',
    usuario: ''
  };

  sh.getRange(record.row, 1, 1, BASE_NUM_COLS).setValues([rowFromRecord(record)]);
  applyBaseValidations(sh);
  return record;
}

/** Gera um ID curto e único. */
function generateId() {
  return 'P' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

/** Conta linhas de dados na Base. */
function countResearchers() {
  return readAll().length;
}
