function Navigation_setup_() {
  var system = Utils_getOrCreateSheet_(MT_SHEETS.system);
  Utils_clearSheet_(system);
  Utils_ensureHeaders_(system, MT_SYSTEM_HEADERS);
  State_set_(MT_STATE_KEYS.currentIndex, 0);
  State_set_(MT_STATE_KEYS.activeZoneMetric, '');
  State_set_(MT_STATE_KEYS.activeZoneDistrict, '');
  State_set_(MT_STATE_KEYS.lastSetup, Utils_now_().toISOString());
  system.hideSheet();

  Utils_getOrCreateSheet_(MT_SHEETS.cache).hideSheet();
}

function Navigation_goHome_() {
  Utils_getSpreadsheet_().setActiveSheet(Utils_getSheet_(MT_SHEETS.home));
}

function Navigation_goRegistration_() {
  Navigation_setCurrentIndex_(Navigation_getCurrentIndex_());
  Dashboard_renderRegistration_();
  Utils_getSpreadsheet_().setActiveSheet(Utils_getSheet_(MT_SHEETS.registration));
}

function Navigation_previousRecord_() {
  Database_saveCurrentRegistration_();
  var count = Database_getSortedActiveRecords_().length;
  if (count) {
    Navigation_setCurrentIndex_((Navigation_getCurrentIndex_() + count - 1) % count);
  }
  Dashboard_renderRegistration_();
}

function Navigation_nextRecord_() {
  Database_saveCurrentRegistration_();
  var count = Database_getSortedActiveRecords_().length;
  if (count) {
    Navigation_setCurrentIndex_((Navigation_getCurrentIndex_() + 1) % count);
  }
  Dashboard_renderRegistration_();
}

function Navigation_saveRecord_() {
  Database_saveCurrentRegistration_();
  Dashboard_refreshAll_();
  Utils_getSpreadsheet_().setActiveSheet(Utils_getSheet_(MT_SHEETS.registration));
}

function Navigation_getCurrentIndex_() {
  var value = Number(State_get_(MT_STATE_KEYS.currentIndex));
  return isNaN(value) ? 0 : value;
}

function Navigation_setCurrentIndex_(index) {
  State_set_(MT_STATE_KEYS.currentIndex, Number(index) || 0);
}

function Navigation_handleHomeEdit_(range) {
  var sheet = range.getSheet();
  if (sheet.getName() !== MT_SHEETS.home) {
    return false;
  }
  if (range.getA1Notation() === MT_HOME_CELLS.startCheckbox && Utils_isChecked_(range.getValue())) {
    Utils_resetActionCheckbox_(sheet, MT_HOME_CELLS.startCheckbox);
    Navigation_goRegistration_();
    return true;
  }
  if (range.getA1Notation() === MT_HOME_CELLS.refreshCheckbox && Utils_isChecked_(range.getValue())) {
    Utils_resetActionCheckbox_(sheet, MT_HOME_CELLS.refreshCheckbox);
    Dashboard_refreshAll_();
    return true;
  }
  return false;
}

function Navigation_handleRegistrationEdit_(range) {
  var sheet = range.getSheet();
  if (sheet.getName() !== MT_SHEETS.registration) {
    return false;
  }
  var a1 = range.getA1Notation();
  if (a1 === MT_REGISTRATION_CELLS.previousCheckbox && Utils_isChecked_(range.getValue())) {
    Utils_resetActionCheckbox_(sheet, MT_REGISTRATION_CELLS.previousCheckbox);
    Navigation_previousRecord_();
    return true;
  }
  if (a1 === MT_REGISTRATION_CELLS.saveCheckbox && Utils_isChecked_(range.getValue())) {
    Utils_resetActionCheckbox_(sheet, MT_REGISTRATION_CELLS.saveCheckbox);
    Navigation_saveRecord_();
    return true;
  }
  if (a1 === MT_REGISTRATION_CELLS.nextCheckbox && Utils_isChecked_(range.getValue())) {
    Utils_resetActionCheckbox_(sheet, MT_REGISTRATION_CELLS.nextCheckbox);
    Navigation_nextRecord_();
    return true;
  }
  if (Navigation_isRegistrationInput_(range)) {
    Database_saveCurrentRegistration_();
    Dashboard_refreshAll_();
    return true;
  }
  return false;
}

function Navigation_isRegistrationInput_(range) {
  var row = range.getRow();
  var column = range.getColumn();
  if (column === 5 && (row === 12 || row === 14 || row === 16 || row === 30)) {
    return true;
  }
  var isNextStep = row >= 21 && row <= 22 && column >= 2 && column <= 6;
  var isObservation = row >= 25 && row <= 27 && column >= 2 && column <= 6;
  return isNextStep || isObservation;
}

function Navigation_handleConfigEdit_(range) {
  if (Config_isRebuildAction_(range)) {
    Utils_resetActionCheckbox_(range.getSheet(), range.getA1Notation());
    Dashboard_refreshAll_();
    return true;
  }
  if (Config_isConfigCell_(range)) {
    Dashboard_refreshAll_();
    return true;
  }
  return false;
}

function Navigation_handleZoneDashboardEdit_(range) {
  var sheet = range.getSheet();
  if (sheet.getName() !== MT_SHEETS.zoneDashboard || !Utils_isChecked_(range.getValue())) {
    return false;
  }
  var row = range.getRow();
  var column = range.getColumn();
  var metric = Dashboard_metricForActionCell_(row, column);
  if (!metric) {
    return false;
  }
  sheet.getRange(row, column).setValue(false);
  State_set_(MT_STATE_KEYS.activeZoneDistrict, metric.district);
  State_set_(MT_STATE_KEYS.activeZoneMetric, metric.key);
  Dashboard_renderZone_();
  return true;
}

function State_get_(key) {
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.system);
  Utils_ensureHeaders_(sheet, MT_SYSTEM_HEADERS);
  var values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 2).getValues();
  for (var index = 0; index < values.length; index += 1) {
    if (values[index][0] === key) {
      return values[index][1];
    }
  }
  return '';
}

function State_set_(key, value) {
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.system);
  Utils_ensureHeaders_(sheet, MT_SYSTEM_HEADERS);
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var index = 0; index < values.length; index += 1) {
      if (values[index][0] === key) {
        sheet.getRange(index + 2, 2).setValue(value);
        return;
      }
    }
  }
  sheet.getRange(lastRow + 1, 1, 1, 2).setValues([[key, value]]);
}
