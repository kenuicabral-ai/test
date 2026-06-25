function onOpen(e) {
  mtInitializeMissionTracker();
}

function onEdit(e) {
  if (!e || !e.range) return;
  try {
    mtRouteEdit_(e);
  } catch (err) {
    mtLog('ERROR', 'Main.onEdit', err.stack || err.message);
  }
}

function setupMissionTracker() {
  mtInitializeMissionTracker();
}

function mtInitializeMissionTracker() {
  var ss = mtGetSpreadsheet();
  mtEnsureSheets(ss);
  mtSetupHistoryAndLogs(ss);
  mtSetupEmailSheet(ss);
  mtSetupConfigSheet(ss);
  mtSetupDatabase(ss);
  mtSetupSystemSheets_(ss);
  mtRefreshAllDashboards(ss);
  mtRenderRegisterCard(ss);
}

function mtRouteEdit_(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var sheetName = sheet.getName();
  var value = e.value;

  if (sheetName === MT_SHEETS.HOME &&
      mtRangeMatches(range, MT_HOME_ACTIONS.START) &&
      value === 'TRUE') {
    mtUncheck(range);
    mtStartRegistration();
    return;
  }

  if (sheetName === MT_SHEETS.REGISTER) {
    var action = mtRegisterActionFromRange(range);
    if (action) {
      mtUncheck(range);
      if (value !== 'TRUE') return;
      if (action === 'previous') {
        mtMoveRegistration(-1);
      } else if (action === 'next') {
        mtMoveRegistration(1);
      } else if (action === 'save') {
        mtSaveCurrentRegistration({ refreshDashboards: true, renderRegister: true });
      }
      return;
    }

    if (mtIsRegisterEditable(range)) {
      mtSaveCurrentRegistration({ refreshDashboards: true, renderRegister: false });
      return;
    }
  }

  if (sheetName === MT_SHEETS.ZONE_DASHBOARD &&
      range.getColumn() === MT_ZONE_ACTION_META.ACTION_COLUMN &&
      value === 'TRUE') {
    var meta = sheet.getRange(range.getRow(), MT_ZONE_ACTION_META.META_TYPE_COLUMN, 1, 3).getValues()[0];
    if (meta[0] === 'ZONE_FILTER') {
      mtUncheck(range);
      mtSetZoneFilter(meta[1], meta[2]);
      mtRenderZoneDashboard(mtGetSpreadsheet());
    }
    return;
  }

  if (mtIsConfigEdit(range)) {
    mtRefreshAllDashboards(mtGetSpreadsheet());
    mtRenderRegisterCard(mtGetSpreadsheet());
  }
}

function mtSetupSystemSheets_(ss) {
  var system = mtGetOrCreateSheet(ss, MT_SHEETS.SYSTEM);
  system.clear();
  system.getRange(1, 1, 4, 2).setValues([
    ['App', MT_APP.NAME],
    ['Versão', MT_APP.VERSION],
    ['Atualizado em', mtDateTimeStamp(mtNow())],
    ['Observação', 'Aba interna usada por Apps Script.']
  ]);
  mtApplyBaseSheetStyle(system);
  mtProtectSheet(system, 'Mission Tracker - sistema', false);

  var cache = mtGetOrCreateSheet(ss, MT_SHEETS.CACHE);
  cache.clear();
  cache.getRange(1, 1, 1, 2).setValues([['Chave', 'Valor']]);
  mtApplyBaseSheetStyle(cache);
  mtProtectSheet(cache, 'Mission Tracker - cache', true);
}
