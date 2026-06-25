function mtSetupDatabase(ss) {
  var sheet = mtGetOrCreateSheet(ss, MT_SHEETS.BASE);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, MT_BASE_HEADERS.length).setValues([MT_BASE_HEADERS]);
  } else {
    mtEnsureBaseHeaders_(sheet);
  }
  mtApplyBaseSheetStyle(sheet);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, MT_BASE_HEADERS.length);
  mtProtectSheet(sheet, 'Mission Tracker - base única', true);
  mtRecalculateBaseStatuses(ss);
}

function mtEnsureBaseHeaders_(sheet) {
  var current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), MT_BASE_HEADERS.length)).getValues()[0];
  var existing = mtHeaderIndex(current);
  var missing = MT_BASE_HEADERS.filter(function(header) {
    return existing[header] === undefined;
  });
  if (missing.length === 0) {
    sheet.getRange(1, 1, 1, MT_BASE_HEADERS.length).setValues([MT_BASE_HEADERS]);
    return;
  }

  var data = sheet.getDataRange().getValues();
  var rebuilt = [MT_BASE_HEADERS];
  for (var i = 1; i < data.length; i++) {
    var row = [];
    MT_BASE_HEADERS.forEach(function(header) {
      var oldIndex = existing[header];
      row.push(oldIndex === undefined ? '' : data[i][oldIndex]);
    });
    rebuilt.push(row);
  }
  sheet.clear();
  sheet.getRange(1, 1, rebuilt.length, MT_BASE_HEADERS.length).setValues(rebuilt);
}

function mtReadBaseRecords(ss) {
  var sheet = mtGetOrCreateSheet(ss || mtGetSpreadsheet(), MT_SHEETS.BASE);
  if (sheet.getLastRow() < 2) return [];

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, MT_BASE_HEADERS.length).getValues();
  var records = [];
  values.forEach(function(row, i) {
    if (row.join('') === '') return;
    var record = {};
    MT_BASE_HEADERS.forEach(function(header, columnIndex) {
      record[header] = row[columnIndex];
    });
    record._rowNumber = i + 2;
    records.push(record);
  });
  return records;
}

function mtActiveRecords(records) {
  return records.filter(function(record) {
    return record.Status !== MT_STATUS.BAPTIZED && record.Status !== MT_STATUS.DATE_DROPPED;
  });
}

function mtRecordsForDistrict(records, district) {
  var wanted = mtNormalizeLower(district);
  if (!wanted) return records;
  return records.filter(function(record) {
    return mtNormalizeLower(record.Distrito) === wanted;
  });
}

function mtFindRecordById(records, recordId) {
  var id = mtNormalizeText(recordId);
  if (!id) return null;
  for (var i = 0; i < records.length; i++) {
    if (mtNormalizeText(records[i].ID) === id) return records[i];
  }
  return null;
}

function mtVisibleRegistrationRecords(ss) {
  var config = mtGetConfig(ss);
  var records = mtReadBaseRecords(ss).map(function(record) {
    return mtWithComputedStatus(record, config);
  });
  return mtSortRecordsByPriority(mtActiveRecords(mtRecordsForDistrict(records, config[MT_CONFIG_KEYS.DISTRICT])));
}

function mtEnsureRecordIds(ss) {
  var sheet = mtGetOrCreateSheet(ss || mtGetSpreadsheet(), MT_SHEETS.BASE);
  if (sheet.getLastRow() < 2) return;
  var idColumn = MT_BASE_HEADERS.indexOf('ID') + 1;
  var range = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1);
  var values = range.getValues();
  var changed = false;
  values.forEach(function(row) {
    if (!row[0]) {
      row[0] = 'MT-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      changed = true;
    }
  });
  if (changed) range.setValues(values);
}

function mtRecalculateBaseStatuses(ss) {
  var spreadsheet = ss || mtGetSpreadsheet();
  mtEnsureRecordIds(spreadsheet);
  var sheet = mtGetOrCreateSheet(spreadsheet, MT_SHEETS.BASE);
  if (sheet.getLastRow() < 2) return;

  var config = mtGetConfig(spreadsheet);
  var records = mtReadBaseRecords(spreadsheet);
  var headerIndex = mtBaseHeaderIndex();
  var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, MT_BASE_HEADERS.length);
  var values = dataRange.getValues();
  var changed = false;

  records.forEach(function(record) {
    var computed = mtComputeRecordState(record, config);
    var rowIndex = record._rowNumber - 2;
    if (values[rowIndex][headerIndex.Status] !== computed.status) {
      values[rowIndex][headerIndex.Status] = computed.status;
      changed = true;
    }
    if (values[rowIndex][headerIndex.Cor] !== computed.color) {
      values[rowIndex][headerIndex.Cor] = computed.color;
      changed = true;
    }
    if (values[rowIndex][headerIndex.Reservado] !== computed.reserved) {
      values[rowIndex][headerIndex.Reservado] = computed.reserved;
      changed = true;
    }
  });

  if (changed) dataRange.setValues(values);
}

function mtWithComputedStatus(record, config) {
  var computed = mtComputeRecordState(record, config || mtGetConfig(mtGetSpreadsheet()));
  record.Status = computed.status;
  record.Cor = computed.color;
  record.Reservado = computed.reserved;
  return record;
}

function mtComputeRecordState(record, config) {
  var result = mtNormalizeLower(record.Resultado);
  var today = mtNow();
  var baptismDate = mtAsDate(record['Data Batismal']);
  var lastUpdate = mtAsDate(record['Última Atualização Em']);
  var week = Math.max(1, Math.min(3, mtParseNumber(record.Semana, 1)));
  var noUpdateDays = config.noUpdateDays || MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.NO_UPDATE_DAYS];
  var criticalWindowDays = config.criticalWindowDays || MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.CRITICAL_WINDOW_DAYS];

  if (result === 'batizado') {
    return mtState_(MT_STATUS.BAPTIZED, true);
  }
  if (result === 'data caiu' || (baptismDate && mtDaysBetween(baptismDate, today) > 0)) {
    return mtState_(MT_STATUS.DATE_DROPPED, result === 'reservado');
  }

  var reserved = result === 'reservado';
  if (!lastUpdate || mtDaysBetween(lastUpdate, today) > noUpdateDays) {
    return mtState_(MT_STATUS.NO_UPDATE, reserved);
  }

  var daysUntilBaptism = baptismDate ? mtDaysBetween(today, baptismDate) : null;
  var missingMatch = week >= 2 && !mtToBoolean(record.Match);
  var missingInterview = week >= 3 && !mtToBoolean(record.Entrevista);
  var criticalByDate = daysUntilBaptism !== null &&
    daysUntilBaptism >= 0 &&
    daysUntilBaptism <= criticalWindowDays &&
    (missingMatch || missingInterview);

  if (criticalByDate || missingInterview) {
    return mtState_(MT_STATUS.CRITICAL, reserved);
  }

  var required = MT_WEEK_FIELDS[String(week)] || [];
  var hasPending = required.some(function(field) {
    return MT_BOOLEAN_FIELDS.indexOf(field) >= 0 ? !mtToBoolean(record[field]) : !mtNormalizeText(record[field]);
  });
  if (hasPending || missingMatch) {
    return mtState_(MT_STATUS.PENDING, reserved);
  }

  return mtState_(MT_STATUS.OK, reserved);
}

function mtState_(status, reserved) {
  return {
    status: status,
    color: mtStatusColor(status).strong,
    reserved: reserved === true
  };
}

function mtSaveRegistrationFromValues(recordId, valuesByField) {
  var ss = mtGetSpreadsheet();
  var sheet = mtGetOrCreateSheet(ss, MT_SHEETS.BASE);
  var config = mtGetConfig(ss);
  var records = mtReadBaseRecords(ss);
  var record = mtFindRecordById(records, recordId);
  if (!record) return { saved: false, changes: 0 };

  var headerIndex = mtBaseHeaderIndex();
  var rowRange = sheet.getRange(record._rowNumber, 1, 1, MT_BASE_HEADERS.length);
  var row = rowRange.getValues()[0];
  var now = mtNow();
  var user = mtUserEmail();
  var history = [];
  var changed = false;

  MT_EDITABLE_FIELDS.forEach(function(field) {
    if (valuesByField[field] === undefined) return;
    var oldValue = row[headerIndex[field]];
    var newValue = valuesByField[field];
    if (MT_BOOLEAN_FIELDS.indexOf(field) >= 0) {
      newValue = mtToBoolean(newValue);
    }
    if (String(oldValue) !== String(newValue)) {
      row[headerIndex[field]] = newValue;
      changed = true;
      history.push({
        recordId: record.ID,
        recordName: record.Nome,
        field: field,
        oldValue: MT_BOOLEAN_FIELDS.indexOf(field) >= 0 ? mtDisplayBoolean(oldValue) : oldValue,
        newValue: MT_BOOLEAN_FIELDS.indexOf(field) >= 0 ? mtDisplayBoolean(newValue) : newValue,
        user: user
      });
    }
  });

  if (!changed) return { saved: true, changes: 0 };

  row[headerIndex['Última Atualização Data']] = mtDateStamp(now);
  row[headerIndex['Última Atualização Hora']] = mtTimeStamp(now);
  row[headerIndex['Última Atualização Em']] = now;
  row[headerIndex['Usuário']] = user;
  row[headerIndex['Atualizado Em']] = now;
  if (!row[headerIndex['Criado Em']]) row[headerIndex['Criado Em']] = now;

  var updatedRecord = {};
  MT_BASE_HEADERS.forEach(function(header, i) {
    updatedRecord[header] = row[i];
  });
  var previousStatus = row[headerIndex.Status];
  var computed = mtComputeRecordState(updatedRecord, config);
  row[headerIndex.Status] = computed.status;
  row[headerIndex.Cor] = computed.color;
  row[headerIndex.Reservado] = computed.reserved;

  if (String(previousStatus) !== String(computed.status)) {
    history.push({
      recordId: record.ID,
      recordName: record.Nome,
      field: 'Status',
      oldValue: previousStatus,
      newValue: computed.status,
      user: user
    });
  }

  rowRange.setValues([row]);
  mtAppendHistory(history);
  return { saved: true, changes: history.length };
}

function mtDashboardStats(records) {
  var stats = {
    total: records.length,
    noUpdate: 0,
    critical: 0,
    pending: 0,
    ok: 0,
    noMatch: 0,
    noInterview: 0,
    dateDropped: 0,
    reserved: 0
  };

  records.forEach(function(record) {
    if (record.Status === MT_STATUS.NO_UPDATE) stats.noUpdate++;
    if (record.Status === MT_STATUS.CRITICAL) stats.critical++;
    if (record.Status === MT_STATUS.PENDING) stats.pending++;
    if (record.Status === MT_STATUS.OK) stats.ok++;
    if (mtParseNumber(record.Semana, 1) >= 2 && !mtToBoolean(record.Match) && record.Status !== MT_STATUS.DATE_DROPPED) stats.noMatch++;
    if (mtParseNumber(record.Semana, 1) >= 3 && !mtToBoolean(record.Entrevista) && record.Status !== MT_STATUS.DATE_DROPPED) stats.noInterview++;
    if (record.Status === MT_STATUS.DATE_DROPPED) stats.dateDropped++;
    if (mtToBoolean(record.Reservado) || mtNormalizeLower(record.Resultado) === 'reservado') stats.reserved++;
  });

  return stats;
}
