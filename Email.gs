var MT = MT || {};

MT.Email = (function () {
  function queue(type, recipient, subject, message) {
    if (MT.Utils.isBlank(recipient)) return;
    var sheetObject = MT.Utils.ensureSheet(MT.SHEETS.EMAILS);
    if (sheetObject.getLastRow() === 0 || MT.Utils.isBlank(sheetObject.getRange(1, 1).getValue())) {
      MT.Utils.setHeaders(sheetObject, MT.EMAIL_HEADERS);
    }
    sheetObject.getRange(sheetObject.getLastRow() + 1, 1, 1, MT.EMAIL_HEADERS.length).setValues([[
      MT.Utils.nowParts().timestamp,
      type,
      recipient,
      subject,
      message,
      'Pendente',
      '',
      ''
    ]]);
  }

  function queueZoneDigest() {
    var config = getConfig();
    if (MT.Utils.isBlank(config.lzEmail)) return;
    var records = MT.Database.getRecords().records;
    var stale = records.filter(function (record) {
      return record['Status Cor'] === MT.STATUS.STALE;
    }).length;
    var critical = records.filter(function (record) {
      return record['Status Cor'] === MT.STATUS.CRITICAL;
    }).length;
    queue(
      'Resumo Zona',
      config.lzEmail,
      'Mission Tracker - acompanhamento da zona',
      'Sem atualização: ' + stale + '\nCríticos: ' + critical + '\nAbra o Dashboard Zona para ver os cartões.'
    );
  }

  function sendPending() {
    var sheetObject = MT.Utils.ensureSheet(MT.SHEETS.EMAILS);
    var lastRow = sheetObject.getLastRow();
    if (lastRow < 2) return;
    var rows = sheetObject.getRange(2, 1, lastRow - 1, MT.EMAIL_HEADERS.length).getValues();
    var now = MT.Utils.nowParts().timestamp;
    var changed = false;
    rows.forEach(function (row) {
      if (row[5] !== 'Pendente') return;
      try {
        MailApp.sendEmail(String(row[2]), String(row[3]), String(row[4]));
        row[5] = 'Enviado';
        row[6] = now;
        row[7] = '';
      } catch (error) {
        row[5] = 'Erro';
        row[7] = error.message;
      }
      changed = true;
    });
    if (changed) {
      sheetObject.getRange(2, 1, rows.length, MT.EMAIL_HEADERS.length).setValues(rows);
    }
  }

  function getConfig() {
    var sheetObject = MT.Utils.sheet(MT.SHEETS.CONFIG);
    if (!sheetObject) {
      return {
        ldEmail: '',
        lzEmail: ''
      };
    }
    return {
      ldEmail: sheetObject.getRange(MT.CONFIG.CELLS.LD_EMAIL).getValue(),
      lzEmail: sheetObject.getRange(MT.CONFIG.CELLS.LZ_EMAIL).getValue()
    };
  }

  return {
    queue: queue,
    queueZoneDigest: queueZoneDigest,
    sendPending: sendPending
  };
})();
