var MT = MT || {};

MT.queueEmail = function (type, recipient, subject, message) {
  if (MT.isBlank(recipient)) {
    return;
  }

  var sheet = MT.ensureEmailSheet();
  var now = new Date();
  sheet.appendRow([
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss'),
    type,
    recipient,
    subject,
    'Pendente',
    message
  ]);
};

MT.queueZoneSummaryEmail = function () {
  var config = MT.getConfig();
  if (MT.isBlank(config.zoneLeaderEmail)) {
    return;
  }

  var records = MT.getBaseRecords();
  var counts = MT.getStatusCounts(records);
  var subject = MT.APP_NAME + ' - resumo da zona';
  var message = [
    'Resumo automático do Mission Tracker',
    '',
    'Sem atualização: ' + counts[MT.STATUS.STALE],
    'Críticos: ' + counts[MT.STATUS.CRITICAL],
    'Pendentes: ' + counts[MT.STATUS.PENDING],
    'Em dia: ' + counts[MT.STATUS.OK],
    'Batizados: ' + counts[MT.STATUS.BAPTIZED],
    'Datas caídas: ' + counts[MT.STATUS.FALLEN_DATE]
  ].join('\n');

  MT.queueEmail('Resumo Zona', config.zoneLeaderEmail, subject, message);
};

MT.sendQueuedEmails = function () {
  var sheet = MT.ensureEmailSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, MT.EMAIL_HEADERS.length).getValues();
  var updates = [];

  rows.forEach(function (row, index) {
    if (row[5] !== 'Pendente') {
      updates.push([row[5]]);
      return;
    }

    try {
      MailApp.sendEmail(String(row[3]), String(row[4]), String(row[6]));
      updates.push(['Enviado']);
    } catch (error) {
      updates.push(['Erro: ' + error.message]);
      MT.log('ERROR', 'sendQueuedEmails', 'Falha ao enviar email', error.message);
    }
  });

  sheet.getRange(2, 6, updates.length, 1).setValues(updates);
};
