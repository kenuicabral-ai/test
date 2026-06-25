/**
 * Colors.gs
 * -----------------------------------------------------------------------------
 * O "cérebro" de interpretação. Transforma os fatos registrados pelo LD em um
 * STATUS (cor) — é isto que permite ao LZ enxergar qualidade de acompanhamento
 * sem ninguém precisar digitar "está bem" ou "está mal".
 *
 *   Verde    = tudo certo
 *   Amarelo  = existe uma pendência
 *   Vermelho = pendência crítica
 *   Laranja  = sem atualização
 *   Azul     = batizado
 *   Cinza    = data caiu
 */

/** Paleta: cor de destaque + fundo suave (para cards). */
const PALETTE = {};
PALETTE[STATUS.VERDE]    = { accent: '#34A853', bg: '#E6F4EA', label: '🟢 Em dia' };
PALETTE[STATUS.AMARELO]  = { accent: '#F9AB00', bg: '#FEF7E0', label: '🟡 Pendente' };
PALETTE[STATUS.VERMELHO] = { accent: '#EA4335', bg: '#FCE8E6', label: '🔴 Crítico' };
PALETTE[STATUS.LARANJA]  = { accent: '#FF6D00', bg: '#FFF0E6', label: '🟠 Sem atualização' };
PALETTE[STATUS.AZUL]     = { accent: '#1A73E8', bg: '#E8F0FE', label: '🔵 Batizado' };
PALETTE[STATUS.CINZA]    = { accent: '#80868B', bg: '#F1F3F4', label: '⚪ Data caiu' };

function palette(statusKey) {
  return PALETTE[statusKey] || PALETTE[STATUS.VERDE];
}

/** Semana de acompanhamento a partir da data de início. */
function computeWeek(record) {
  const inicio = record[COL.INICIO - 1];
  if (!(inicio instanceof Date) || isNaN(inicio)) return 1;
  const wk = Math.floor(daysBetween(inicio, now()) / 7) + 1;
  return clamp(wk, 1, 99);
}

/** Campos (status) que devem aparecer na semana atual. */
function weekFields(week) {
  if (week <= 1) return [COL.TOUCHDOWN, COL.PLANO];
  if (week === 2) return [COL.MATCH];
  return [COL.ENTREVISTA];
}

/** Rótulo amigável de cada campo de status. */
function fieldLabel(colIndex) {
  switch (colIndex) {
    case COL.TOUCHDOWN: return 'TouchDown';
    case COL.PLANO: return 'Plano Igreja';
    case COL.MATCH: return 'Match';
    case COL.ENTREVISTA: return 'Entrevista';
    case COL.PROXIMO: return 'Próximo Passo';
    case COL.OBS: return 'Observação';
    case COL.RESULTADO: return 'Resultado';
    default: return 'Campo ' + colIndex;
  }
}

/**
 * Núcleo da interpretação. Recebe um record e devolve a chave de status.
 * Determinístico e testável (sem efeitos colaterais).
 */
function computeStatus(record) {
  const resultado = record[COL.RESULTADO - 1];
  if (resultado === RESULTADO.BATIZADO) return STATUS.AZUL;
  if (resultado === RESULTADO.DATA_CAIU) return STATUS.CINZA;

  const staleDays = getConfigNumber(CONFIG_KEYS.STALE_DAYS, 3);
  const last = record[COL.ATUALIZADO - 1];
  if (!(last instanceof Date) || isNaN(last) || daysBetween(last, now()) >= staleDays) {
    return STATUS.LARANJA;
  }

  const week = computeWeek(record);
  const td = toBool(record[COL.TOUCHDOWN - 1]);
  const plano = toBool(record[COL.PLANO - 1]);
  const match = toBool(record[COL.MATCH - 1]);
  const entrevista = toBool(record[COL.ENTREVISTA - 1]);

  const criticalDays = getConfigNumber(CONFIG_KEYS.CRITICAL_DAYS, 3);
  const batismo = record[COL.BATISMO - 1];
  const daysToBaptism = (batismo instanceof Date && !isNaN(batismo))
    ? daysBetween(now(), batismo) : null;

  // Crítico: etapa-chave da semana faltando OU batismo muito próximo sem entrevista.
  if (week >= 3 && !entrevista) return STATUS.VERMELHO;
  if (daysToBaptism != null && daysToBaptism <= criticalDays && !entrevista) {
    return STATUS.VERMELHO;
  }
  if (daysToBaptism != null && daysToBaptism < 0 && resultado !== RESULTADO.BATIZADO) {
    return STATUS.VERMELHO; // data passou e não batizou
  }

  // Pendência (amarelo) por etapa não concluída da semana corrente/anteriores.
  let pending = false;
  if (week >= 1 && (!td || !plano)) pending = true;
  if (week >= 2 && !match) pending = true;
  if (pending) return STATUS.AMARELO;

  return STATUS.VERDE;
}

/** Lista textual de pendências (para Observação automática / e-mail). */
function pendingReasons(record) {
  const reasons = [];
  const week = computeWeek(record);
  if (week >= 1 && !toBool(record[COL.TOUCHDOWN - 1])) reasons.push('Sem TouchDown');
  if (week >= 1 && !toBool(record[COL.PLANO - 1])) reasons.push('Sem Plano Igreja');
  if (week >= 2 && !toBool(record[COL.MATCH - 1])) reasons.push('Sem Match');
  if (week >= 3 && !toBool(record[COL.ENTREVISTA - 1])) reasons.push('Sem Entrevista');
  return reasons;
}

/**
 * Recalcula a coluna COR de TODA a Base em uma única passada e grava em lote.
 * Chamada após qualquer edição. Performance: 1 leitura + 1 escrita.
 */
function recomputeAllStatus() {
  const sh = baseSheet();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  const records = getAllRecords();
  const corColumn = [];
  const semanaColumn = [];
  for (let i = 0; i < records.length; i++) {
    semanaColumn.push([computeWeek(records[i])]);
    corColumn.push([computeStatus(records[i])]);
  }
  sh.getRange(2, COL.SEMANA, records.length, 1).setValues(semanaColumn);
  sh.getRange(2, COL.COR, records.length, 1).setValues(corColumn);
}

/** Conta pesquisadores por status (apenas do distrito informado, se houver). */
function statusCounts(records, distrito) {
  const counts = {};
  Object.keys(STATUS).forEach(function (k) { counts[STATUS[k]] = 0; });
  records.forEach(function (r) {
    if (distrito && r[COL.DISTRITO - 1] !== distrito) return;
    const key = r[COL.COR - 1] || computeStatus(r);
    if (counts[key] === undefined) counts[key] = 0;
    counts[key]++;
  });
  return counts;
}
