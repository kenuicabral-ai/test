/**
 * Colors.gs
 * Motor de status/cores: o LD registra fatos, o sistema deduz a cor.
 * Recalcula em lote e guarda contadores na aba Cache (usados por Home/Zona).
 */

/* Acessores de metadados de status. */
function statusBg(key) { return (STATUS_META[key] || STATUS_META.AMARELO).bg; }
function statusFg(key) { return (STATUS_META[key] || STATUS_META.AMARELO).fg; }
function statusSoft(key) { return (STATUS_META[key] || STATUS_META.AMARELO).soft; }
function statusIcon(key) { return (STATUS_META[key] || STATUS_META.AMARELO).icon; }
function statusLabel(key) { return (STATUS_META[key] || STATUS_META.AMARELO).label; }

/** Há resultado terminal (batizado / data caída)? */
function isTerminal(r) {
  return r.resultado === RESULTADO.BATIZADO || r.resultado === RESULTADO.DATA_CAIDA;
}

/**
 * Deduz a cor de um pesquisador (prioridade de cima para baixo).
 * @return {string} chave de STATUS
 */
function computeStatus(r, ref, cfg) {
  ref = ref || now();
  cfg = cfg || getConfig();

  if (r.resultado === RESULTADO.BATIZADO) return STATUS.AZUL;
  if (r.resultado === RESULTADO.DATA_CAIDA) return STATUS.CINZA;

  var semana = Number(r.semana) || 1;

  var missingRequired =
    (semana >= 1 && !r.touchDown) ||
    (semana >= 2 && !r.match) ||
    (semana >= 3 && !r.entrevista);

  var daysToBaptism = (r.dataBatismal instanceof Date) ? daysBetween(ref, r.dataBatismal) : null;

  // 🔴 Pendência crítica
  var critical = false;
  if (semana >= 2 && missingRequired) critical = true;
  if (daysToBaptism !== null) {
    if (daysToBaptism < 0 && r.resultado === RESULTADO.NENHUM) critical = true;
    if (daysToBaptism >= 0 && daysToBaptism <= cfg.diasCritico && !r.entrevista) critical = true;
  }
  if (critical) return STATUS.VERMELHO;

  // 🟠 Sem atualização (apenas se já houve alguma atualização antes)
  var daysSince = (r.ultimaAtualizacao instanceof Date) ? daysBetween(r.ultimaAtualizacao, ref) : 0;
  if (daysSince > cfg.diasSemAtualizacao) return STATUS.LARANJA;

  // 🟡 Pendência
  if (missingRequired) return STATUS.AMARELO;
  if (!r.proximoPasso) return STATUS.AMARELO;

  // 🟢 Tudo certo
  return STATUS.VERDE;
}

/** Texto curto explicando o motivo da cor (usado nos cards). */
function statusReason(r, status, ref, cfg) {
  ref = ref || now();
  cfg = cfg || getConfig();
  var semana = Number(r.semana) || 1;
  var daysToBaptism = (r.dataBatismal instanceof Date) ? daysBetween(ref, r.dataBatismal) : null;
  var daysSince = (r.ultimaAtualizacao instanceof Date) ? daysBetween(r.ultimaAtualizacao, ref) : null;

  switch (status) {
    case STATUS.AZUL:
      return 'Batizado 🎉';
    case STATUS.CINZA:
      return 'Data caída';
    case STATUS.VERMELHO:
      if (daysToBaptism !== null && daysToBaptism < 0) return 'Data batismal venceu sem resultado';
      if (daysToBaptism !== null && daysToBaptism <= cfg.diasCritico && !r.entrevista) {
        return 'Batismo em ' + daysToBaptism + 'd e sem entrevista';
      }
      if (semana >= 3 && !r.entrevista) return 'Atrasado: sem entrevista';
      if (semana >= 2 && !r.match) return 'Atrasado: sem match';
      return 'Pendência crítica';
    case STATUS.LARANJA:
      return 'Sem atualização há ' + daysSince + ' dias';
    case STATUS.AMARELO:
      if (semana >= 1 && !r.touchDown) return 'Falta TouchDown';
      if (semana >= 2 && !r.match) return 'Falta Match';
      if (semana >= 3 && !r.entrevista) return 'Falta Entrevista';
      if (!r.proximoPasso) return 'Definir próximo passo';
      return 'Pendência';
    default:
      return 'Tudo em dia';
  }
}

/**
 * Recalcula a cor de todos os pesquisadores, grava a coluna Cor em LOTE
 * e atualiza os contadores na aba Cache.
 * @return {Object} contadores
 */
function recomputeAll() {
  var cfg = getConfig();
  var ref = now();
  var all = readAll();

  var counts = {
    VERDE: 0, AMARELO: 0, VERMELHO: 0, LARANJA: 0, AZUL: 0, CINZA: 0,
    TOTAL: 0, SEM_ATUALIZACAO: 0, SEM_MATCH: 0, SEM_ENTREVISTA: 0,
    DATAS_CAIDAS: 0, RESERVADOS: 0
  };

  if (!all.length) {
    saveCounts(counts);
    return counts;
  }

  // Linhas contíguas: monta a coluna Cor inteira para 1 setValues.
  var firstRow = all[0].row;
  var lastRow = all[all.length - 1].row;
  var colHeight = lastRow - firstRow + 1;
  var corCol = [];
  for (var k = 0; k < colHeight; k++) corCol.push(['']);

  all.forEach(function (r) {
    var status = computeStatus(r, ref, cfg);
    corCol[r.row - firstRow][0] = status;

    counts[status] = (counts[status] || 0) + 1;
    counts.TOTAL++;
    if (status === STATUS.LARANJA) counts.SEM_ATUALIZACAO++;
    if (!isTerminal(r) && r.semana >= 2 && !r.match) counts.SEM_MATCH++;
    if (!isTerminal(r) && r.semana >= 3 && !r.entrevista) counts.SEM_ENTREVISTA++;
    if (r.resultado === RESULTADO.DATA_CAIDA) counts.DATAS_CAIDAS++;
    if (r.resultado === RESULTADO.RESERVADO) counts.RESERVADOS++;
  });

  var sh = getSheetOrNull(SHEETS.BASE);
  sh.getRange(firstRow, COL.COR, colHeight, 1).setValues(corCol);

  saveCounts(counts);
  return counts;
}

/** Salva contadores na aba Cache (JSON) para leitura rápida. */
function saveCounts(counts) {
  var sh = getOrCreateSheet(SHEETS.CACHE);
  upsertCacheKey(sh, CACHE_KEYS.COUNTS, JSON.stringify(counts));
  upsertCacheKey(sh, CACHE_KEYS.UPDATED_AT, new Date().toISOString());
}

function getCounts() {
  var sh = getSheetOrNull(SHEETS.CACHE);
  if (sh) {
    var values = sh.getDataRange().getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][0]) === CACHE_KEYS.COUNTS) {
        try { return JSON.parse(values[i][1]); } catch (e) { /* recalc abaixo */ }
      }
    }
  }
  return recomputeAll();
}

function upsertCacheKey(sh, key, value) {
  var values = sh.getDataRange().getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === key) {
      sh.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value]);
}
