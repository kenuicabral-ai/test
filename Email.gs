/**
 * Email.gs
 * ----------------------------------------------------------------------------
 * Notificações por e-mail com arquitetura de FILA.
 *
 * Por quê fila? No app do Sheets no celular, gatilhos instaláveis (que podem
 * enviar e-mail) não disparam de forma confiável — mas o onEdit SIMPLES dispara
 * e pode escrever numa aba. Então:
 *   1. onEdit enfileira a notificação na aba "Emails" (rápido, sempre funciona).
 *   2. Um gatilho de TEMPO (processEmailQueue) roda no servidor com permissão
 *      total e envia os pendentes — mesmo que o registro tenha sido feito no
 *      celular.
 * ----------------------------------------------------------------------------
 */

/**
 * Enfileira um e-mail (não envia agora). Escrita única na aba Emails.
 * @param {string} para
 * @param {string} assunto
 * @param {string} corpo
 */
function enqueueEmail(para, assunto, corpo) {
  if (!para) return;
  var sh = getSheet(SHEETS.EMAILS);
  if (!sh) return;
  sh.appendRow([now(), para, assunto, corpo, 'PENDENTE', '']);
}

/**
 * Avalia um pesquisador e, se entrou em estado crítico, enfileira alerta ao LZ.
 * Chamado após cada alteração. Idempotência simples: só alerta na transição
 * para VERMELHO (compara com status anterior recebido).
 *
 * @param {Object} p  pesquisador já atualizado
 * @param {string} statusAnterior
 */
function maybeNotifyCritical(p, statusAnterior) {
  var cfg = getConfig();
  if (!toBool(cfg[CONFIG_KEYS.NOTIFICAR_CRITICOS])) return;
  var para = cfg[CONFIG_KEYS.EMAIL_LZ];
  if (!para) return;

  var atual = p.status || computeStatus(p);
  if (atual !== STATUS.VERMELHO) return;
  if (statusAnterior === STATUS.VERMELHO) return; // já estava crítico

  var assunto = '🔴 Crítico: ' + p.nome + ' (' + p.distrito + ')';
  var corpo =
    'Pesquisador entrou em estado CRÍTICO.\n\n' +
    'Nome: ' + p.nome + '\n' +
    'Distrito: ' + p.distrito + '\n' +
    'Semana: ' + p.semana + '\n' +
    'Data batismal: ' + formatDateShort(p.dataBatismal) + '\n' +
    'Próximo passo: ' + (p.proximoPasso || '—') + '\n' +
    'Atualizado por: ' + (p.usuario || '—') + ' em ' + formatUpdate(p.ultimaAtualizacao) + '\n\n' +
    '— ' + APP.NAME;

  enqueueEmail(para, assunto, corpo);
}

/**
 * Processa a fila de e-mails (gatilho de tempo). Envia os PENDENTES em lote
 * e marca como ENVIADO. Tolerante a falhas individuais.
 */
function processEmailQueue() {
  var sh = getSheet(SHEETS.EMAILS);
  if (!sh) return;
  var last = sh.getLastRow();
  if (last < 2) return;

  var range = sh.getRange(2, 1, last - 1, EMAILS_HEADERS.length);
  var values = range.getValues();
  var changed = false;

  for (var i = 0; i < values.length; i++) {
    var status = values[i][4];
    if (status !== 'PENDENTE') continue;
    var para = values[i][1];
    var assunto = values[i][2];
    var corpo = values[i][3];
    try {
      MailApp.sendEmail(para, assunto, corpo);
      values[i][4] = 'ENVIADO';
      values[i][5] = now();
      changed = true;
    } catch (err) {
      values[i][4] = 'ERRO';
      values[i][5] = String(err);
      changed = true;
      logEvent('ERROR', 'processEmailQueue', err);
    }
  }

  if (changed) range.setValues(values);
}
