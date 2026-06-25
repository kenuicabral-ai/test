function mtSetupEmailSheet(ss) {
  var sheet = mtGetOrCreateSheet(ss, MT_SHEETS.EMAILS);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, MT_EMAIL_HEADERS.length).setValues([MT_EMAIL_HEADERS]);
  }
  mtApplyBaseSheetStyle(sheet);
  mtProtectSheet(sheet, 'Mission Tracker - emails', true);
}

function mtReadActiveEmails(ss, type) {
  var sheet = mtGetOrCreateSheet(ss || mtGetSpreadsheet(), MT_SHEETS.EMAILS);
  if (sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, MT_EMAIL_HEADERS.length).getValues();
  return values.filter(function(row) {
    var matchesType = !type || mtNormalizeLower(row[0]) === mtNormalizeLower(type);
    return matchesType && mtToBoolean(row[4]);
  }).map(function(row) {
    return {
      type: row[0],
      district: row[1],
      zone: row[2],
      email: row[3],
      active: mtToBoolean(row[4])
    };
  });
}
