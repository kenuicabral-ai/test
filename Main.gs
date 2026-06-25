function onOpen() {
  try {
    refreshMissionTracker();
  } catch (error) {
    Utils_log_('ERROR', 'onOpen', 'Falha ao atualizar ao abrir.', error.message);
  }
}

function onEdit(event) {
  if (!event || !event.range) {
    return;
  }

  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(3000)) {
    return;
  }

  try {
    Main_handleEdit_(event);
  } catch (error) {
    Utils_log_('ERROR', 'onEdit', 'Falha ao processar edição.', error.stack || error.message);
  } finally {
    lock.releaseLock();
  }
}

function setupMissionTracker() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    Main_ensureSheets_();
    Config_setup_();
    Database_setup_();
    History_setup_();
    Email_setup_();
    Navigation_setup_();
    Dashboard_setup_();
    Main_orderSheets_();
    Main_hideSystemSheets_();
  } finally {
    lock.releaseLock();
  }
}

function refreshMissionTracker() {
  Main_ensureSheets_();
  Main_hideSystemSheets_();
  Dashboard_refreshAll_();
}

function goToRegistration() {
  Navigation_goRegistration_();
}

function previousResearcher() {
  Navigation_previousRecord_();
}

function saveRegistration() {
  Navigation_saveRecord_();
}

function nextResearcher() {
  Navigation_nextRecord_();
}

function rebuildMissionTracker() {
  setupMissionTracker();
}

function Main_handleEdit_(event) {
  var range = event.range;
  if (Navigation_handleHomeEdit_(range)) {
    return;
  }
  if (Navigation_handleRegistrationEdit_(range)) {
    return;
  }
  if (Navigation_handleZoneDashboardEdit_(range)) {
    return;
  }
  if (Navigation_handleConfigEdit_(range)) {
    return;
  }
  if (range.getSheet().getName() === MT_SHEETS.base) {
    History_captureBaseEdit_(event);
    Database_recalculateAllStatuses_();
    Dashboard_refreshAll_();
  }
}

function Main_ensureSheets_() {
  MT_VISIBLE_SHEETS.concat(MT_HIDDEN_SHEETS).forEach(function (name) {
    Utils_getOrCreateSheet_(name);
  });
}

function Main_orderSheets_() {
  var spreadsheet = Utils_getSpreadsheet_();
  MT_VISIBLE_SHEETS.concat(MT_HIDDEN_SHEETS).forEach(function (name, index) {
    var sheet = spreadsheet.getSheetByName(name);
    if (sheet) {
      spreadsheet.setActiveSheet(sheet);
      spreadsheet.moveActiveSheet(index + 1);
    }
  });
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName(MT_SHEETS.home));
}

function Main_hideSystemSheets_() {
  MT_HIDDEN_SHEETS.forEach(function (name) {
    var sheet = Utils_getSheet_(name);
    if (sheet) {
      sheet.hideSheet();
    }
  });
}
