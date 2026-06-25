/**
 * Colors.gs
 * ----------------------------------------------------------------------------
 * A "inteligência" de status. Dado um pesquisador, decide a COR — e portanto
 * toda a leitura visual do sistema. Centralizar essa decisão aqui garante que
 * Home, Registro, Dashboards e e-mails contem SEMPRE a mesma história.
 *
 * Prioridade (do mais forte ao mais fraco):
 *   AZUL  (batizado)  > CINZA (data caiu)
 *   LARANJA (sem atualização há X dias)
 *   VERMELHO (crítico: marco da semana faltando E data próxima/vencida)
 *   AMARELO (pendência: marco da semana faltando)
 *   VERDE (tudo certo)
 * ----------------------------------------------------------------------------
 */

/**
 * Calcula o status (chave de COLORS) de um pesquisador.
 * @param {Object} p  pesquisador (de rowToResearcher)
 * @return {string} STATUS.*
 */
function computeStatus(p) {
  // Estados terminais têm prioridade absoluta.
  if (p.resultado === 'Batizado') return STATUS.AZUL;
  if (p.resultado === 'Data Caiu') return STATUS.CINZA;

  var diasSem = cfgDiasSemAtualizacao();
  var diasCrit = cfgDiasCriticoData();

  // Sem atualização há muito tempo: laranja (independe dos marcos).
  var idade = isDate(p.ultimaAtualizacao) ? daysBetween(p.ultimaAtualizacao, now()) : null;
  if (idade !== null && idade >= diasSem) return STATUS.LARANJA;

  // Marcos pendentes para a semana atual e anteriores.
  var pendencias = pendingMilestones(p);

  if (pendencias.length === 0) return STATUS.VERDE;

  // Crítico se a data batismal está próxima/vencida e há marco faltando.
  var diasData = isDate(p.dataBatismal) ? daysBetween(now(), p.dataBatismal) : null;
  if (diasData !== null && diasData <= diasCrit) return STATUS.VERMELHO;

  return STATUS.AMARELO;
}

/**
 * Lista os marcos (colunas) que deveriam estar concluídos até a semana atual
 * mas não estão. Acumula regras das semanas 1..semanaAtual.
 * @return {Array<number>} colunas de COL pendentes
 */
function pendingMilestones(p) {
  var out = [];
  var maxSemana = clamp(p.semana, 1, 3);
  for (var s = 1; s <= maxSemana; s++) {
    var regra = SEMANA_REGRAS[s];
    if (!regra) continue;
    regra.exige.forEach(function (col) {
      if (!isMilestoneDone(p, col)) out.push(col);
    });
  }
  return out;
}

/** Um marco específico (coluna) está concluído? */
function isMilestoneDone(p, col) {
  switch (col) {
    case COL.TOUCHDOWN: return p.touchdown;
    case COL.PLANO_IGREJA: return p.planoIgreja;
    case COL.MATCH: return p.match;
    case COL.ENTREVISTA: return p.entrevista;
    default: return true;
  }
}

/** Acessores de paleta. */
function colorOf(statusKey) {
  return COLORS[statusKey] || COLORS.CINZA;
}
function emojiOf(statusKey) {
  return colorOf(statusKey).emoji;
}
function labelOf(statusKey) {
  return colorOf(statusKey).label;
}

/**
 * Pinta a linha do pesquisador na Base (somente a célula de Status, para feedback
 * discreto na fonte de dados). A Base é oculta; isto é apenas para auditoria.
 */
function paintBaseRow(sh, rowNumber, statusKey) {
  var c = colorOf(statusKey);
  sh.getRange(rowNumber, COL.STATUS, 1, 1)
    .setBackground(c.bg)
    .setFontColor(c.strong)
    .setFontWeight('bold')
    .setValue(statusKey);
}

/**
 * Recalcula e regrava o status de TODOS os pesquisadores em lote.
 * Usado no setup e em manutenções. Uma leitura + uma escrita.
 */
function recomputeAllStatuses() {
  var sh = getSheet(SHEETS.BASE, true);
  var last = sh.getLastRow();
  if (last < 2) return;
  var range = sh.getRange(2, 1, last - 1, BASE_COLS);
  var values = range.getValues();
  var statusBg = [];
  for (var i = 0; i < values.length; i++) {
    var p = rowToResearcher(values[i], i + 2);
    if (!p.nome && !p.id) { statusBg.push([null]); continue; }
    var st = computeStatus(p);
    values[i][COL.STATUS - 1] = st;
    statusBg.push([colorOf(st).bg]);
  }
  range.setValues(values);
  sh.getRange(2, COL.STATUS, values.length, 1).setBackgrounds(statusBg);
}

/** Conta pesquisadores por status, retornando um mapa { STATUS: n }. */
function statusCounts(list) {
  var all = list || readAll();
  var c = { VERDE: 0, AMARELO: 0, VERMELHO: 0, LARANJA: 0, AZUL: 0, CINZA: 0 };
  all.forEach(function (p) {
    var st = p.status || computeStatus(p);
    if (c[st] === undefined) c[st] = 0;
    c[st]++;
  });
  return c;
}

/** Ordem de prioridade para os dashboards: Laranja > Vermelho > Amarelo > Verde > Azul > Cinza. */
function statusPriority(statusKey) {
  var order = [STATUS.LARANJA, STATUS.VERMELHO, STATUS.AMARELO, STATUS.VERDE, STATUS.AZUL, STATUS.CINZA];
  var i = order.indexOf(statusKey);
  return i === -1 ? 999 : i;
}
