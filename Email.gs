function Email_setup_() {
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.emails);
  Utils_ensureHeaders_(sheet, MT_EMAIL_HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, MT_EMAIL_HEADERS.length)
    .setBackground(MT_COLORS.darkBlue)
    .setFontColor(MT_COLORS.actionText)
    .setFontWeight('bold');
  sheet.hideSheet();
}

function Email_queueZoneDigest_() {
  var config = Config_get_();
  if (!config.zoneEmail || config.emailMode === 'DESATIVADO') {
    return;
  }

  var districts = Database_metricsByDistrict_();
  var criticalLines = [];
  districts.forEach(function (district) {
    if (district.stale || district.missingMatch || district.missingInterview || district.dropped) {
      criticalLines.push([
        district.district,
        'sem atualização: ' + district.stale,
        'sem Match: ' + district.missingMatch,
        'sem Entrevista: ' + district.missingInterview,
        'datas caídas: ' + district.dropped
      ].join(' | '));
    }
  });

  if (!criticalLines.length) {
    return;
  }

  var subject = MT_APP.name + ' · Acompanhamento da Zona';
  var message = criticalLines.join('\n');
  Email_appendQueue_('DIGEST_ZONA', config.zoneEmail, subject, message);

  if (config.emailMode === 'ENVIAR') {
    MailApp.sendEmail(config.zoneEmail, subject, message);
    Email_markLastAsSent_();
  }
}

function Email_appendQueue_(type, recipient, subject, message) {
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.emails);
  Utils_ensureHeaders_(sheet, MT_EMAIL_HEADERS);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, MT_EMAIL_HEADERS.length).setValues([[
    Utils_now_(),
    type,
    recipient,
    subject,
    message,
    'PENDENTE',
    ''
  ]]);
}

function Email_markLastAsSent_() {
  var sheet = Utils_getSheet_(MT_SHEETS.emails);
  if (!sheet || sheet.getLastRow() < 2) {
    return;
  }
  sheet.getRange(sheet.getLastRow(), 6, 1, 2).setValues([['ENVIADO', Utils_now_()]]);
}
