var MT = MT || {};

MT.Navigation = (function () {
  function handleEdit(e) {
    if (!e || !e.range) return;
    var sheetName = e.range.getSheet().getName();
    try {
      if (sheetName === MT.SHEETS.HOME) handleHomeEdit(e);
      if (sheetName === MT.SHEETS.REGISTRATION) handleRegistrationEdit(e);
      if (sheetName === MT.SHEETS.ZONE_DASHBOARD) handleZoneDashboardEdit(e);
      if (sheetName === MT.SHEETS.CONFIG) MT.Config.handleEdit(e);
    } catch (error) {
      MT.Utils.log('ERROR', 'Navigation.handleEdit', error.message, error.stack || '');
      MT.Utils.toast('Não foi possível concluir a ação. Verifique Logs.');
    }
  }

  function handleHomeEdit(e) {
    if (e.range.getA1Notation() !== MT.HOME.START_BUTTON || e.value !== 'TRUE') return;
    e.range.setValue(false);
    goToFirstRegistration();
  }

  function handleRegistrationEdit(e) {
    var a1 = e.range.getA1Notation();
    if (a1 === MT.REGISTRATION.PREVIOUS_BUTTON && e.value === 'TRUE') {
      e.range.setValue(false);
      moveRegistration(-1);
      return;
    }
    if (a1 === MT.REGISTRATION.NEXT_BUTTON && e.value === 'TRUE') {
      e.range.setValue(false);
      moveRegistration(1);
      return;
    }
    if (a1 === MT.REGISTRATION.SAVE_BUTTON && e.value === 'TRUE') {
      e.range.setValue(false);
      saveRegistrationCard();
      return;
    }
    if (MT.REGISTRATION.EDITABLE_FIELDS[a1]) {
      saveRegistrationField(a1, e.range.getValue());
    }
  }

  function handleZoneDashboardEdit(e) {
    var a1 = e.range.getA1Notation();
    if (a1 === MT.ZONE_DASHBOARD.FILTER_DISTRICT_CELL) {
      MT.Database.setSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_DISTRICT, e.range.getValue() || 'Todos');
      MT.Dashboard.renderZoneDashboard();
      return;
    }
    if (a1 === MT.ZONE_DASHBOARD.FILTER_METRIC_CELL) {
      MT.Database.setSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_METRIC, e.range.getValue() || MT.ZONE_METRICS.ALL);
      MT.Dashboard.renderZoneDashboard();
      return;
    }
    if (e.range.getColumn() === MT.ZONE_DASHBOARD.CLICK_COLUMN && e.value === 'TRUE') {
      var row = e.range.getRow();
      var sheetObject = e.range.getSheet();
      var district = sheetObject.getRange(row, MT.ZONE_DASHBOARD.CACHE_DISTRICT_COLUMN).getValue();
      var metric = sheetObject.getRange(row, MT.ZONE_DASHBOARD.CACHE_METRIC_COLUMN).getValue();
      e.range.setValue(false);
      if (district) MT.Database.setSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_DISTRICT, district);
      if (metric) MT.Database.setSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_METRIC, metric);
      MT.Dashboard.renderZoneDashboard();
    }
  }

  function goToFirstRegistration() {
    var records = MT.Database.sortedActiveRecords();
    if (!records.length) {
      MT.Utils.toast('Nenhum pesquisador ativo para registrar.');
      MT.Dashboard.renderRegistration();
      activate(MT.SHEETS.REGISTRATION);
      return;
    }
    MT.Database.setCurrentRecordId(records[0]['ID']);
    MT.Dashboard.renderRegistration(records[0]['ID']);
    activate(MT.SHEETS.REGISTRATION);
  }

  function moveRegistration(direction) {
    var records = MT.Database.sortedActiveRecords();
    if (!records.length) {
      MT.Dashboard.renderRegistration();
      return;
    }
    var currentId = getRegistrationRecordId();
    var index = 0;
    for (var i = 0; i < records.length; i += 1) {
      if (String(records[i]['ID']) === String(currentId)) {
        index = i;
        break;
      }
    }
    var nextIndex = (index + direction + records.length) % records.length;
    MT.Database.setCurrentRecordId(records[nextIndex]['ID']);
    MT.Dashboard.renderRegistration(records[nextIndex]['ID']);
    activate(MT.SHEETS.REGISTRATION);
  }

  function saveRegistrationField(a1, value) {
    var field = MT.REGISTRATION.EDITABLE_FIELDS[a1];
    var recordId = getRegistrationRecordId();
    if (!recordId || !field) return;
    var patch = {};
    patch[field] = value;
    var updated = MT.Database.updateRecord(recordId, patch, MT.Utils.currentUser());
    if (!updated) return;
    afterRegistrationSave(updated['ID']);
  }

  function saveRegistrationCard() {
    var sheetObject = MT.Utils.sheet(MT.SHEETS.REGISTRATION);
    var recordId = getRegistrationRecordId();
    if (!recordId) return;
    var values = {};
    Object.keys(MT.REGISTRATION.EDITABLE_FIELDS).forEach(function (a1) {
      var field = MT.REGISTRATION.EDITABLE_FIELDS[a1];
      values[field] = sheetObject.getRange(a1).getValue();
    });
    var updated = MT.Database.updateRecordFromCard(recordId, values, MT.Utils.currentUser());
    if (!updated) {
      MT.Utils.toast('Nenhuma alteração para salvar.');
      return;
    }
    afterRegistrationSave(updated['ID']);
  }

  function afterRegistrationSave(recordId) {
    MT.Database.setCurrentRecordId(recordId);
    MT.Dashboard.renderHome();
    MT.Dashboard.renderRegistration(recordId);
    MT.Dashboard.renderDistrictDashboard();
    MT.Dashboard.renderZoneDashboard();
    MT.Config.protectRegistration();
    MT.Utils.toast('Registro atualizado.');
    activate(MT.SHEETS.REGISTRATION);
  }

  function getRegistrationRecordId() {
    var sheetObject = MT.Utils.sheet(MT.SHEETS.REGISTRATION);
    if (!sheetObject) return MT.Database.getCurrentRecordId();
    return sheetObject.getRange(MT.REGISTRATION.RECORD_ID).getValue() || MT.Database.getCurrentRecordId();
  }

  function activate(sheetName) {
    var sheetObject = MT.Utils.sheet(sheetName);
    if (sheetObject) MT.Utils.ss().setActiveSheet(sheetObject);
  }

  return {
    handleEdit: handleEdit,
    goToFirstRegistration: goToFirstRegistration,
    moveRegistration: moveRegistration,
    saveRegistrationCard: saveRegistrationCard,
    activate: activate
  };
})();
