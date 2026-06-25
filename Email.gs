/**
 * Mission Tracker - Notificações por e-mail (opcional).
 */
var MTEmail = (function () {
  function queueNotification(type, recipient, subject, payload) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MT.SHEETS.EMAILS);
    if (!sheet) {
      return;
    }
    var now = MTUtils.now();
    sheet.appendRow([
      'pendente',
      MTUtils.normalizeText(type),
      MTUtils.normalizeText(recipient),
      MTUtils.normalizeText(subject),
      payload ? JSON.stringify(payload) : '',
      MTUtils.formatDateTime(now)
    ]);
  }

  return {
    queueNotification: queueNotification
  };
})();
