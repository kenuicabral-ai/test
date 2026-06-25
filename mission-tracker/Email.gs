/**
 * Email.gs
 * -----------------------------------------------------------------------------
 * Aba Emails: fila de notificações + envio ao Líder de Zona.
 *
 * Por que uma FILA?
 *  - O gatilho onEdit precisa ser leve. Em vez de enviar e-mail dentro da
 *    edição (lento e sujeito a cotas), enfileiramos a notificação e um gatilho
 *    de tempo (a cada hora) processa a fila chamando processEmailQueue().
 *  - Tudo continua automático e sem qualquer interação manual.
 */

const EMAIL_HEADERS = [
  'Timestamp', 'Para', 'Assunto', 'Corpo', 'Status', 'Enviado em'
];

function emailsSheet() {
  return getOrCreateSheet(SHEETS.EMAILS);
}

function ensureEmailHeaders() {
  const sh = emailsSheet();
  ensureDimensions(sh, 1, EMAIL_HEADERS.length);
  sh.getRange(1, 1, 1, EMAIL_HEADERS.length).setValues([EMAIL_HEADERS]).setFontWeight('bold');
  sh.setFrozenRows(1);
}

/** Enfileira uma notificação (não envia agora). */
function queueEmail(to, subject, body) {
  if (!to) return;
  const sh = emailsSheet();
  sh.appendRow([now(), to, subject, body, 'PENDENTE', '']);
}

/**
 * Avalia um record e, se virou crítico, enfileira aviso ao LZ.
 * Chamado após cada commit de edição.
 */
function maybeNotifyCritical(record) {
  if (String(getConfig(CONFIG_KEYS.NOTIFICAR, 'NÃO')).toUpperCase().indexOf('SIM') === -1) return;
  const lz = getConfig(CONFIG_KEYS.LZ_EMAIL, '');
  if (!lz) return;
  if (computeStatus(record) !== STATUS.VERMELHO) return;

  const nome = record[COL.NOME - 1];
  const distrito = record[COL.DISTRITO - 1];
  const motivos = pendingReasons(record).join(', ') || 'Situação crítica';
  const subject = '🔴 Crítico: ' + nome + ' (' + distrito + ')';
  const body =
    'Pesquisador: ' + nome + '\n' +
    'Distrito: ' + distrito + '\n' +
    'Data batismal: ' + formatDateHuman(record[COL.BATISMO - 1]) + '\n' +
    'Motivo: ' + motivos + '\n' +
    'Atualizado por: ' + record[COL.USUARIO - 1] + '\n';
  queueEmail(lz, subject, body);
}

/**
 * Processa a fila e envia e-mails PENDENTES (gatilho de tempo).
 * Escreve status de volta em lote.
 */
function processEmailQueue() {
  const sh = emailsSheet();
  const last = sh.getLastRow();
  if (last < 2) return;
  const range = sh.getRange(2, 1, last - 1, EMAIL_HEADERS.length);
  const data = range.getValues();
  let changed = false;
  for (let i = 0; i < data.length; i++) {
    if (data[i][4] === 'PENDENTE' && data[i][1]) {
      try {
        MailApp.sendEmail(String(data[i][1]), String(data[i][2]), String(data[i][3]));
        data[i][4] = 'ENVIADO';
        data[i][5] = now();
        changed = true;
      } catch (err) {
        data[i][4] = 'ERRO: ' + err.message;
        changed = true;
      }
    }
  }
  if (changed) range.setValues(data);
}
