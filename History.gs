/**
 * History.gs
 * ----------------------------------------------------------------------------
 * Trilha de auditoria IMUTÁVEL. Toda alteração de dado gera uma linha aqui.
 * O usuário nunca edita o Histórico — a aba é oculta e protegida.
 *
 * Registra: Data, Hora, ID, Nome, Campo, Valor antigo, Valor novo, Usuário.
 * Escrita SEMPRE em lote.
 * ----------------------------------------------------------------------------
 */

/**
 * Acrescenta um lote de entradas ao histórico.
 * @param {Array<Object>} entries  [{id, nome, campo, antigo, novo, usuario}]
 */
function appendHistory(entries) {
  if (!entries || entries.length === 0) return;
  var sh = getSheet(SHEETS.HISTORICO);
  if (!sh) return;

  var d = now();
  var dataStr = Utilities.formatDate(d, tz(), 'dd/MM/yyyy');
  var horaStr = Utilities.formatDate(d, tz(), 'HH:mm:ss');

  var rows = entries.map(function (e) {
    return [
      dataStr,
      horaStr,
      e.id,
      e.nome,
      e.campo,
      asText(e.antigo),
      asText(e.novo),
      e.usuario
    ];
  });

  var startRow = sh.getLastRow() + 1;
  sh.getRange(startRow, 1, rows.length, HISTORICO_HEADERS.length).setValues(rows);
}

/**
 * Retorna as últimas N entradas de histórico de um pesquisador (por ID).
 * Leitura única + filtro em memória.
 */
function historyForResearcher(id, limit) {
  var sh = getSheet(SHEETS.HISTORICO);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, HISTORICO_HEADERS.length).getValues();
  var out = [];
  for (var i = values.length - 1; i >= 0 && out.length < (limit || 5); i--) {
    if (String(values[i][2]) === String(id)) out.push(values[i]);
  }
  return out;
}

/**
 * Marca o Histórico como protegido (aviso).
 *
 * NOTA DE ARQUITETURA: usamos proteção do tipo "warning-only". O motivo é
 * coerência com o mobile: o app roda em GATILHO SIMPLES (onEdit), que executa
 * COM A IDENTIDADE DO USUÁRIO. Uma proteção "hard" bloquearia até as escritas
 * legítimas do próprio script (renderização, append de histórico) quando o
 * usuário não é o dono do arquivo. O aviso desencoraja edição manual; a
 * imutabilidade real é garantida porque NADA no código edita linhas existentes
 * do Histórico — apenas acrescenta. A aba ainda é OCULTA.
 */
function protectHistory() {
  var sh = getSheet(SHEETS.HISTORICO);
  if (!sh) return;
  removeProtections(sh);
  try {
    sh.protect().setDescription('Histórico imutável — não editar').setWarningOnly(true);
  } catch (_) {}
}

/** Remove proteções existentes de uma aba (idempotência no setup). */
function removeProtections(sh) {
  var types = [SpreadsheetApp.ProtectionType.SHEET, SpreadsheetApp.ProtectionType.RANGE];
  types.forEach(function (t) {
    var ps = sh.getProtections(t);
    for (var i = 0; i < ps.length; i++) {
      try { ps[i].remove(); } catch (_) {}
    }
  });
}
