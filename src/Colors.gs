/**
 * Colors.gs
 * ---------------------------------------------------------------------------
 * O "cérebro" interpretativo do sistema. Traduz os dados crus de cada
 * pesquisador em:
 *   - Semana atual (automática, a partir da Data Início)
 *   - Marcos esperados / faltantes
 *   - Status (cor) único por pesquisador
 *
 * Regra de cores (uma cor por pesquisador):
 *   🔵 Azul    = Batizado
 *   ⚪ Cinza   = Data caiu
 *   🟠 Laranja = Sem atualização (passou do limite de dias)
 *   🔴 Vermelho= Pendência crítica (data próxima com marco faltando, ou
 *                pendência muito negligenciada)
 *   🟡 Amarelo = Existe uma pendência (marco do estágio faltando)
 *   🟢 Verde   = Tudo certo
 * ---------------------------------------------------------------------------
 */

/**
 * Calcula a semana do processo a partir da Data Início.
 * @return {number} semana >= 1
 */
function computeWeek_(rec, now) {
  const inicio = rec['Data Início'];
  if (!(inicio instanceof Date)) return 1;
  const days = daysBetween_(inicio, now);
  if (days < 0) return 1;
  return Math.floor(days / 7) + 1;
}

/** Marcos esperados de forma CUMULATIVA até a semana (para cálculo de cor). */
function expectedMilestones_(week) {
  const out = [];
  STAGES.forEach(function (stage) {
    if (stage.week <= week) out.push.apply(out, stage.fields);
  });
  return out;
}

/** Marcos esperados ainda não cumpridos. */
function missingMilestones_(rec, week) {
  return expectedMilestones_(week).filter(function (f) { return !rec[f]; });
}

/**
 * Marcos que o CARD deve mostrar (visual minimalista):
 *   - todos os marcos do estágio atual
 *   - marcos de estágios anteriores apenas se ainda estiverem pendentes
 * Assim nunca mostramos campos desnecessários, mas nada "vaza".
 */
function milestonesForCard_(rec, week) {
  const current = Math.min(week, 3);
  const show = [];
  STAGES.forEach(function (stage) {
    if (stage.week === current) {
      show.push.apply(show, stage.fields);
    } else if (stage.week < current) {
      stage.fields.forEach(function (f) { if (!rec[f]) show.push(f); });
    }
  });
  return show;
}

/**
 * Determina o status (cor) único de um pesquisador.
 * @param {Object} rec
 * @param {Object} cfg
 * @param {Date} now
 * @return {string} chave de STATUS
 */
function computeStatus_(rec, cfg, now) {
  const resultado = rec['Resultado'];
  if (resultado === RESULTADO.BATIZADO) return STATUS.BATIZADO; // 🔵
  if (resultado === RESULTADO.CAIU) return STATUS.CAIU;         // ⚪

  const week = computeWeek_(rec, now);
  const last = rec['Última Atualização'];
  const daysSince = last instanceof Date ? daysBetween_(last, now) : 9999;
  const pendentes = missingMilestones_(rec, week);

  const dataBat = rec['Data Batismal'];
  const daysToDate = dataBat instanceof Date ? daysBetween_(now, dataBat) : null;

  // Crítico: data batismal próxima (ou já passou) com marco faltando,
  // OU pendência negligenciada por muito tempo.
  let critico = false;
  if (daysToDate !== null && daysToDate <= cfg.diasCriticoData && pendentes.length > 0) {
    critico = true;
  }
  if (pendentes.length > 0 && daysSince > cfg.diasSemAtualizacao * 2) {
    critico = true;
  }
  if (critico) return STATUS.CRITICO; // 🔴

  if (daysSince > cfg.diasSemAtualizacao) return STATUS.SEM_ATUALIZACAO; // 🟠
  if (pendentes.length > 0) return STATUS.PENDENTE; // 🟡
  return STATUS.EM_DIA; // 🟢
}

/** Metadados (cor/emoji/rótulo) de um status, com fallback seguro. */
function statusMeta_(statusKey) {
  return STATUS_META[statusKey] || STATUS_META.EM_DIA;
}

/**
 * Recalcula Semana e Status (em memória) para uma lista de registros.
 * Não escreve na planilha — quem persiste é persistComputedColumns_.
 * @return {Array<Object>} os mesmos registros, mutados
 */
function recomputeRecords_(records, cfg, now) {
  cfg = cfg || getConfig_();
  now = now || new Date();
  records.forEach(function (rec) {
    rec['Semana'] = computeWeek_(rec, now);
    rec['Status'] = computeStatus_(rec, cfg, now);
  });
  return records;
}

/**
 * Conta pesquisadores por categoria de status (para a Home).
 * @return {Object} { CRITICO, SEM_ATUALIZACAO, PENDENTE, EM_DIA, BATIZADO, CAIU, total }
 */
function countByStatus_(records) {
  const counts = {
    CRITICO: 0, SEM_ATUALIZACAO: 0, PENDENTE: 0,
    EM_DIA: 0, BATIZADO: 0, CAIU: 0, total: records.length,
  };
  records.forEach(function (r) {
    if (counts[r['Status']] != null) counts[r['Status']]++;
  });
  return counts;
}

/** Ordena registros pela prioridade de exibição do LD (laranja primeiro). */
function sortForLD_(records) {
  const rank = {};
  LD_ORDER.forEach(function (s, i) { rank[s] = i; });
  return records.slice().sort(function (a, b) {
    const ra = rank[a['Status']] == null ? 99 : rank[a['Status']];
    const rb = rank[b['Status']] == null ? 99 : rank[b['Status']];
    if (ra !== rb) return ra - rb;
    return s_(a['Nome']).localeCompare(s_(b['Nome']));
  });
}
