var MT = MT || {};

function setupMissionTracker() {
  MT.withDocumentLock(function () {
    MT.ensureApplicationSheets();
    MT.bootstrapSystemValues();
    MT.refreshAllDashboards();
    MT.getSpreadsheet().setActiveSheet(MT.getSheet(MT.SHEETS.HOME));
    SpreadsheetApp.flush();
    MT.getSpreadsheet().toast('Mission Tracker configurado.', MT.APP_NAME, 5);
  });
}

function refreshMissionTracker() {
  MT.withDocumentLock(function () {
    MT.ensureApplicationSheets();
    MT.refreshAllDashboards();
    SpreadsheetApp.flush();
    MT.getSpreadsheet().toast('Mission Tracker atualizado.', MT.APP_NAME, 5);
  });
}

function onEdit(event) {
  try {
    MT.handleEdit(event);
  } catch (error) {
    MT.log('ERROR', 'onEdit', 'Falha ao processar edição', error.stack || error.message);
    MT.getSpreadsheet().toast('Não foi possível processar a edição. Verifique Logs.', MT.APP_NAME, 6);
  }
}

function onOpen() {
  try {
    MT.ensureApplicationSheets();
    MT.renderHome();
  } catch (error) {
    MT.log('ERROR', 'onOpen', 'Falha ao preparar Home', error.stack || error.message);
  }
}

MT.bootstrapSystemValues = function () {
  if (MT.isBlank(MT.getSystemValue(MT.SYSTEM_KEYS.CURRENT_INDEX, ''))) {
    MT.setSystemValue(MT.SYSTEM_KEYS.CURRENT_INDEX, 1);
  }

  if (MT.isBlank(MT.getSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_INDICATOR, ''))) {
    MT.setSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_INDICATOR, 'Todos');
  }

  if (MT.isBlank(MT.getSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_DISTRICT, ''))) {
    MT.setSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_DISTRICT, 'Todos');
  }
};
