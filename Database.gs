function Database_setup_() {
  var base = Utils_getOrCreateSheet_(MT_SHEETS.base);
  Utils_ensureHeaders_(base, MT_BASE_HEADERS);
  base.setFrozenRows(1);
  base.getRange(1, 1, 1, MT_BASE_HEADERS.length)
    .setBackground(MT_COLORS.darkBlue)
    .setFontColor(MT_COLORS.actionText)
    .setFontWeight('bold');

  var maxRows = Math.max(base.getMaxRows() - 1, 1);
  Database_applyValidations_(base, maxRows);
  Utils_protectSheet_(base, 'Base única do Mission Tracker', true);
  base.hideSheet();
}

function Database_applyValidations_(sheet, rowCount) {
  var map = Database_headerMap_(sheet);
  Object.keys(MT_BOOLEAN_FIELDS).forEach(function (field) {
    if (map[field] !== undefined) {
      sheet.getRange(2, map[field] + 1, rowCount, 1).insertCheckboxes();
    }
  });
  if (map['Resultado'] !== undefined) {
    Utils_setDropdown_(sheet.getRange(2, map['Resultado'] + 1, rowCount, 1), MT_RESULT_OPTIONS);
  }
}

function Database_headerMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), MT_BASE_HEADERS.length)).getValues()[0];
  return Utils_headerMap_(headers);
}

function Database_getAllRecords_() {
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.base);
  Utils_ensureHeaders_(sheet, MT_BASE_HEADERS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  var values = sheet.getRange(2, 1, lastRow - 1, MT_BASE_HEADERS.length).getValues();
  var records = values.map(function (row, index) {
    return Database_rowToRecord_(row, index + 2);
  });
  return records.filter(function (record) {
    return record.ID || record.Nome;
  });
}

function Database_getActiveRecords_() {
  return Database_getAllRecords_().filter(function (record) {
    return record.Ativo !== false && String(record.Resultado || '') !== 'Pausado';
  });
}

function Database_getSortedActiveRecords_() {
  var config = Config_get_();
  return Database_getActiveRecords_().map(function (record) {
    return Database_applyComputedFields_(record, config);
  }).sort(Database_compareRecords_);
}

function Database_rowToRecord_(row, rowNumber) {
  var record = { rowNumber: rowNumber };
  MT_BASE_HEADERS.forEach(function (header, index) {
    record[header] = row[index];
  });
  return record;
}

function Database_recordToRow_(record) {
  return MT_BASE_HEADERS.map(function (header) {
    return record[header] === undefined ? '' : record[header];
  });
}

function Database_compareRecords_(left, right) {
  var leftStatus = MT_STATUS_ORDER[left.statusKey] || 99;
  var rightStatus = MT_STATUS_ORDER[right.statusKey] || 99;
  if (leftStatus !== rightStatus) {
    return leftStatus - rightStatus;
  }
  var leftDate = Utils_toDate_(left['Data Batismal']);
  var rightDate = Utils_toDate_(right['Data Batismal']);
  if (leftDate && rightDate && leftDate.getTime() !== rightDate.getTime()) {
    return leftDate.getTime() - rightDate.getTime();
  }
  return String(left.Nome || '').localeCompare(String(right.Nome || ''));
}

function Database_getCurrentRecord_() {
  var records = Database_getSortedActiveRecords_();
  if (!records.length) {
    return null;
  }
  var index = Navigation_getCurrentIndex_();
  index = Math.max(0, Math.min(index, records.length - 1));
  Navigation_setCurrentIndex_(index);
  return records[index];
}

function Database_getWeekRule_(week) {
  var numericWeek = Number(week) || 1;
  if (numericWeek <= 1) {
    return MT_WEEK_RULES[1];
  }
  if (numericWeek === 2) {
    return MT_WEEK_RULES[2];
  }
  return MT_WEEK_RULES[3];
}

function Database_applyComputedFields_(record, config) {
  var computed = Database_computeStatus_(record, config || Config_get_());
  record.Status = computed.label;
  record.Cor = computed.color;
  record.statusKey = computed.key;
  record.pendingFields = computed.pendingFields;
  record.isCritical = computed.key === MT_STATUS_KEYS.critical;
  record.isStale = computed.key === MT_STATUS_KEYS.stale;
  record.isDropped = computed.key === MT_STATUS_KEYS.dropped;
  record.isReserved = String(record.Resultado || '') === 'Reservado' || Utils_isChecked_(record.Reservado);
  return record;
}

function Database_computeStatus_(record, config) {
  var result = String(record.Resultado || '');
  if (result === 'Batizado') {
    return Database_statusResult_(MT_STATUS_KEYS.baptized, []);
  }
  if (result === 'Data caiu') {
    return Database_statusResult_(MT_STATUS_KEYS.dropped, []);
  }

  var today = Utils_startOfDay_(Utils_now_());
  var baptismDate = Utils_toDate_(record['Data Batismal']);
  var daysUntilBaptism = baptismDate ? Utils_daysBetween_(today, baptismDate) : null;
  if (daysUntilBaptism !== null && daysUntilBaptism < 0 && result !== 'Reservado') {
    return Database_statusResult_(MT_STATUS_KEYS.dropped, []);
  }

  var lastUpdate = Utils_toDate_(record['Última Atualização']);
  var hoursWithoutUpdate = lastUpdate ? Utils_hoursBetween_(lastUpdate, Utils_now_()) : null;
  if (hoursWithoutUpdate === null || hoursWithoutUpdate > config.staleHours) {
    return Database_statusResult_(MT_STATUS_KEYS.stale, []);
  }

  var rule = Database_getWeekRule_(record.Semana);
  var pendingFields = rule.requiredFields.filter(function (field) {
    return !Utils_isChecked_(record[field]);
  });

  if (pendingFields.length) {
    var isNearDate = daysUntilBaptism !== null && daysUntilBaptism <= config.criticalDays;
    var missingInterview = pendingFields.indexOf('Entrevista') >= 0;
    if (isNearDate || missingInterview) {
      return Database_statusResult_(MT_STATUS_KEYS.critical, pendingFields);
    }
    return Database_statusResult_(MT_STATUS_KEYS.pending, pendingFields);
  }

  return Database_statusResult_(MT_STATUS_KEYS.ok, []);
}

function Database_statusResult_(key, pendingFields) {
  return {
    key: key,
    label: MT_STATUS[key],
    color: Colors_statusColor_(key),
    pendingFields: pendingFields || []
  };
}

function Database_saveCurrentRegistration_() {
  var record = Database_getCurrentRecord_();
  if (!record) {
    return null;
  }

  var sheet = Utils_getSheet_(MT_SHEETS.registration);
  var changes = {};
  changes.TouchDown = sheet.getRange('E12').getValue();
  changes.Match = sheet.getRange('E14').getValue();
  changes.Entrevista = sheet.getRange('E16').getValue();
  changes['Próximo Passo'] = sheet.getRange(MT_REGISTRATION_CELLS.nextStep).getValue();
  changes['Observação'] = sheet.getRange(MT_REGISTRATION_CELLS.observation).getValue();
  changes.Resultado = sheet.getRange(MT_REGISTRATION_CELLS.result).getValue();

  return Database_updateRecord_(record, changes, Utils_getActiveUserEmail_());
}

function Database_updateRecord_(record, changes, userEmail) {
  var base = Utils_getSheet_(MT_SHEETS.base);
  if (!base || !record || !record.rowNumber) {
    return null;
  }

  var updated = {};
  MT_BASE_HEADERS.forEach(function (header) {
    updated[header] = record[header];
  });

  if (!updated.ID) {
    updated.ID = Utilities.getUuid();
  }
  if (!updated['Criado Em']) {
    updated['Criado Em'] = Utils_now_();
  }
  if (updated.Ativo === '') {
    updated.Ativo = true;
  }

  var history = [];
  MT_EDITABLE_BASE_FIELDS.forEach(function (field) {
    if (changes[field] !== undefined && !Utils_valuesEqual_(updated[field], changes[field])) {
      history.push({
        id: updated.ID,
        name: updated.Nome,
        field: field,
        oldValue: updated[field],
        newValue: changes[field],
        user: userEmail
      });
      updated[field] = changes[field];
    }
  });

  if (!history.length) {
    return updated;
  }

  var now = Utils_now_();
  updated['Última Atualização'] = now;
  updated['Data Atualização'] = Utils_formatDate_(now);
  updated['Hora Atualização'] = Utils_formatTime_(now);
  updated['Usuário'] = userEmail;
  updated.Reservado = String(updated.Resultado || '') === 'Reservado';
  updated['Atualizado Em'] = now;
  Database_applyComputedFields_(updated, Config_get_());

  base.getRange(record.rowNumber, 1, 1, MT_BASE_HEADERS.length).setValues([Database_recordToRow_(updated)]);
  History_append_(history);
  State_set_(MT_STATE_KEYS.lastRefresh, now.toISOString());
  return updated;
}

function Database_recalculateAllStatuses_() {
  var base = Utils_getSheet_(MT_SHEETS.base);
  if (!base) {
    return;
  }
  var records = Database_getAllRecords_();
  if (!records.length) {
    return;
  }
  var config = Config_get_();
  var rows = records.map(function (record) {
    return Database_recordToRow_(Database_applyComputedFields_(record, config));
  });
  base.getRange(2, 1, rows.length, MT_BASE_HEADERS.length).setValues(rows);
}

function Database_metricsByDistrict_() {
  var records = Database_getActiveRecords_().map(function (record) {
    return Database_applyComputedFields_(record, Config_get_());
  });
  var metrics = {};
  records.forEach(function (record) {
    var district = record.Distrito || 'Sem distrito';
    if (!metrics[district]) {
      metrics[district] = {
        district: district,
        all: 0,
        stale: 0,
        missingMatch: 0,
        missingInterview: 0,
        dropped: 0,
        reserved: 0,
        records: []
      };
    }
    metrics[district].all += 1;
    metrics[district].records.push(record);
    if (record.statusKey === MT_STATUS_KEYS.stale) {
      metrics[district].stale += 1;
    }
    if (!Utils_isChecked_(record.Match)) {
      metrics[district].missingMatch += 1;
    }
    if (!Utils_isChecked_(record.Entrevista)) {
      metrics[district].missingInterview += 1;
    }
    if (record.statusKey === MT_STATUS_KEYS.dropped || String(record.Resultado || '') === 'Data caiu') {
      metrics[district].dropped += 1;
    }
    if (record.isReserved) {
      metrics[district].reserved += 1;
    }
  });
  return Object.keys(metrics).sort().map(function (district) {
    return metrics[district];
  });
}
