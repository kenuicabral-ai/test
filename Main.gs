/**
 * Mission Tracker - Entradas principais e gatilhos.
 */
function onOpen() {
  bootstrapMissionTracker();
}

function onEdit(e) {
  if (!e || !e.range) {
    return;
  }
  try {
    var sheetName = e.range.getSheet().getName();
    if (sheetName === MT.SHEETS.REGISTRO) {
      MTNavigation.handleRegistroEdit(e);
      return;
    }
    if (sheetName === MT.SHEETS.HOME) {
      MTNavigation.handleHomeEdit(e);
      return;
    }
    if (sheetName === MT.SHEETS.DASH_ZONA) {
      MTDashboard.handleZoneIndicatorToggle(e);
      return;
    }
    if (sheetName === MT.SHEETS.CONFIG) {
      MTDashboard.handleConfigEdit(e);
    }
  } catch (err) {
    MTUtils.writeLog('ERROR', 'Falha no onEdit', { error: String(err) });
  }
}

function bootstrapMissionTracker() {
  try {
    MTConfig.setup();
    MTDashboard.refreshAll();
    MTNavigation.renderCurrentCard();
  } catch (err) {
    MTUtils.writeLog('ERROR', 'Falha no bootstrap', { error: String(err) });
    throw err;
  }
}

function MT_refreshAll() {
  MTDashboard.refreshAll();
  MTNavigation.renderCurrentCard();
}
