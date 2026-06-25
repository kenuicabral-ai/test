var MT = MT || {};

MT.handleEdit = function (event) {
  if (!event || !event.range) {
    return;
  }

  MT.withDocumentLock(function () {
    var sheet = event.range.getSheet();
    var sheetName = sheet.getName();

    if (sheetName === MT.SHEETS.HOME) {
      MT.handleHomeEdit(event);
      return;
    }

    if (sheetName === MT.SHEETS.REGISTRATION) {
      MT.handleRegistrationEdit(event);
      return;
    }

    if (sheetName === MT.SHEETS.ZONE_DASHBOARD) {
      MT.handleZoneDashboardEdit(event);
      return;
    }

    if (sheetName === MT.SHEETS.CONFIG) {
      MT.handleConfigEdit(event);
      return;
    }

    if (sheetName === MT.SHEETS.BASE) {
      MT.handleBaseEdit(event);
    }
  });
};

MT.handleHomeEdit = function (event) {
  var sheet = event.range.getSheet();
  if (event.range.getA1Notation() !== MT.HOME_ACTION_CELLS.START || event.range.getValue() !== true) {
    return;
  }

  MT.resetCheckbox(sheet, MT.HOME_ACTION_CELLS.START);
  MT.renderRegistration();
  MT.getSpreadsheet().setActiveSheet(MT.getSheet(MT.SHEETS.REGISTRATION));
};

MT.handleRegistrationEdit = function (event) {
  var sheet = event.range.getSheet();
  var cell = event.range.getA1Notation();

  if (MT.handleRegistrationNavigation(sheet, cell)) {
    return;
  }

  var field = MT.getRegistrationFieldByCell(cell);
  if (!field) {
    return;
  }

  var current = MT.getCurrentRecord();
  if (!current) {
    MT.renderRegistration();
    return;
  }

  var changes = {};
  changes[field] = event.range.getValue();
  MT.updateRecordFields(current.record.data.ID, changes, MT.currentUser(event));
  MT.refreshAllDashboards();
  MT.getSpreadsheet().setActiveSheet(MT.getSheet(MT.SHEETS.REGISTRATION));
};

MT.handleRegistrationNavigation = function (sheet, cell) {
  if (cell === MT.REGISTRATION_NAV_CELLS.PREVIOUS && sheet.getRange(cell).getValue() === true) {
    MT.resetCheckbox(sheet, cell);
    MT.moveCurrentRecord(-1);
    MT.renderRegistration();
    return true;
  }

  if (cell === MT.REGISTRATION_NAV_CELLS.SAVE && sheet.getRange(cell).getValue() === true) {
    MT.resetCheckbox(sheet, cell);
    MT.refreshAllDashboards();
    MT.getSpreadsheet().setActiveSheet(MT.getSheet(MT.SHEETS.REGISTRATION));
    return true;
  }

  if (cell === MT.REGISTRATION_NAV_CELLS.NEXT && sheet.getRange(cell).getValue() === true) {
    MT.resetCheckbox(sheet, cell);
    MT.moveCurrentRecord(1);
    MT.renderRegistration();
    return true;
  }

  return false;
};

MT.getRegistrationFieldByCell = function (cell) {
  var fields = Object.keys(MT.REGISTRATION_FIELD_CELLS);
  for (var i = 0; i < fields.length; i++) {
    if (MT.REGISTRATION_FIELD_CELLS[fields[i]] === cell) {
      return fields[i];
    }
  }

  return null;
};

MT.handleZoneDashboardEdit = function (event) {
  var cell = event.range.getA1Notation();
  if (cell === MT.ZONE_FILTER_CELLS.INDICATOR) {
    MT.setSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_INDICATOR, event.range.getValue() || 'Todos');
    MT.renderZoneDashboard();
    return;
  }

  if (cell === MT.ZONE_FILTER_CELLS.DISTRICT) {
    MT.setSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_DISTRICT, event.range.getValue() || 'Todos');
    MT.renderZoneDashboard();
  }
};

MT.handleConfigEdit = function (event) {
  var cell = event.range.getA1Notation();
  var watched = Object.keys(MT.CONFIG_CELLS).map(function (key) {
    return MT.CONFIG_CELLS[key];
  });

  if (watched.indexOf(cell) === -1) {
    return;
  }

  MT.setSystemValue(MT.SYSTEM_KEYS.CURRENT_INDEX, 1);
  MT.refreshAllDashboards();
};

MT.handleBaseEdit = function (event) {
  if (event.range.getNumRows() !== 1 || event.range.getNumColumns() !== 1 || event.range.getRow() === 1) {
    MT.normalizeBaseRows();
    MT.refreshAllDashboards();
    return;
  }

  var table = MT.getBaseTable();
  var rowNumber = event.range.getRow();
  var column = event.range.getColumn();
  var field = table.headers[column - 1];
  var row = table.sheet.getRange(rowNumber, 1, 1, table.headers.length).getValues()[0];

  if (MT.isBlank(row[table.headerMap.Nome])) {
    return;
  }

  var now = new Date();
  if (MT.isBlank(row[table.headerMap.ID])) {
    row[table.headerMap.ID] = MT.makeId();
  }

  if (MT.isBlank(row[table.headerMap['Criado Em']])) {
    row[table.headerMap['Criado Em']] = now;
  }

  var computed = MT.calculateRecordStatus(row, table.headerMap);
  row[table.headerMap.Status] = computed.status;
  row[table.headerMap.Prioridade] = computed.priority;
  row[table.headerMap['Última Atualização']] = now;
  row[table.headerMap['Data Última Atualização']] = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  row[table.headerMap['Hora Última Atualização']] = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm');
  row[table.headerMap['Usuário']] = MT.currentUser(event);
  row[table.headerMap['Atualizado Em']] = now;

  table.sheet.getRange(rowNumber, 1, 1, table.headers.length).setValues([row]);
  MT.invalidateRecordCache();

  var ignoredFields = ['ID', 'Status', 'Prioridade', 'Última Atualização', 'Data Última Atualização', 'Hora Última Atualização', 'Usuário', 'Criado Em', 'Atualizado Em'];
  if (field && ignoredFields.indexOf(field) === -1) {
    MT.appendHistoryRows([{
      id: row[table.headerMap.ID],
      name: row[table.headerMap.Nome],
      field: field,
      oldValue: event.oldValue || '',
      newValue: event.range.getValue(),
      user: MT.currentUser(event)
    }]);
  }

  MT.refreshAllDashboards();
};
