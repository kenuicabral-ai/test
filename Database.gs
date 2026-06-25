var MT = MT || {};

MT.Database = (function () {
  function ensure() {
    ensureTable(MT.SHEETS.BASE, MT.BASE_HEADERS);
    ensureTable(MT.SHEETS.HISTORY, MT.HISTORY_HEADERS);
    ensureTable(MT.SHEETS.EMAILS, MT.EMAIL_HEADERS);
    ensureTable(MT.SHEETS.LOGS, MT.LOG_HEADERS);
    ensureTable(MT.SHEETS.SYSTEM, MT.SYSTEM_HEADERS);
    ensureTable(MT.SHEETS.CACHE, MT.CACHE_HEADERS);
    MT.HIDDEN_SHEETS.forEach(function (name) {
      MT.Utils.hideSheet(name);
    });
  }

  function ensureTable(sheetName, headers) {
    var target = MT.Utils.ensureSheet(sheetName);
    if (target.getLastRow() === 0 || MT.Utils.isBlank(target.getRange(1, 1).getValue())) {
      MT.Utils.setHeaders(target, headers);
    }
    return target;
  }

  function getRecords() {
    ensure();
    var sheetObject = MT.Utils.sheet(MT.SHEETS.BASE);
    var headers = MT.BASE_HEADERS.slice();
    var lastRow = sheetObject.getLastRow();
    if (lastRow < 2) {
      return {
        headers: headers,
        rows: [],
        records: []
      };
    }
    var rows = sheetObject.getRange(2, 1, lastRow - 1, headers.length).getValues()
      .filter(function (row) {
        return !MT.Utils.isRowBlank(row);
      });
    var records = rows.map(function (row, index) {
      return MT.Utils.rowToRecord(headers, row, index + 2);
    });
    return {
      headers: headers,
      rows: rows,
      records: records
    };
  }

  function saveRecords(records) {
    ensure();
    var sheetObject = MT.Utils.sheet(MT.SHEETS.BASE);
    var headers = MT.BASE_HEADERS.slice();
    var lastRow = sheetObject.getLastRow();
    if (lastRow > 1) {
      sheetObject.getRange(2, 1, lastRow - 1, headers.length).clearContent();
    }
    if (!records.length) return;
    var rows = records.map(function (record) {
      return MT.Utils.recordToRow(headers, record);
    });
    MT.Utils.ensureRows(sheetObject, rows.length + 1);
    sheetObject.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  function recalculateRecords(records) {
    var limit = getUpdateLimitDays();
    return records.map(function (record) {
      var status = MT.Utils.statusReason(record, limit);
      record['Status Cor'] = status;
      record['Status'] = MT.STATUS_LABELS[status];
      record['Semana'] = MT.Utils.weekLabel(record);
      record['Reservado'] = MT.Utils.toBoolean(record['Reservado']) || MT.Utils.normalize(record['Resultado']) === 'reservado';
      record['Data Caiu'] = MT.Utils.toBoolean(record['Data Caiu']) || MT.Utils.normalize(record['Resultado']) === 'data caiu';
      return record;
    });
  }

  function refreshStatuses() {
    var data = getRecords();
    saveRecords(recalculateRecords(data.records));
  }

  function getRecordById(id) {
    if (MT.Utils.isBlank(id)) return null;
    var records = getRecords().records;
    for (var i = 0; i < records.length; i += 1) {
      if (String(records[i]['ID']) === String(id)) return records[i];
    }
    return null;
  }

  function findRecordIndex(records, id) {
    for (var i = 0; i < records.length; i += 1) {
      if (String(records[i]['ID']) === String(id)) return i;
    }
    return -1;
  }

  function updateRecord(id, patch, user) {
    var data = getRecords();
    var index = findRecordIndex(data.records, id);
    if (index < 0) return null;
    var record = data.records[index];
    var historyRows = [];
    Object.keys(patch).forEach(function (field) {
      var oldValue = record[field];
      var newValue = patch[field];
      if (!MT.Utils.sameValue(oldValue, newValue)) {
        historyRows.push(MT.History.makeRow(record, field, oldValue, newValue, user));
        record[field] = newValue;
      }
    });

    if (!historyRows.length) return record;

    var now = MT.Utils.nowParts();
    record['Última Atualização'] = now.timestamp;
    record['Última Atualização ISO'] = now.iso;
    record['Atualizado Por'] = user || MT.Utils.currentUser();
    data.records[index] = recalculateRecords(data.records)[index];
    saveRecords(data.records);
    MT.History.appendRows(historyRows);
    return data.records[index];
  }

  function updateRecordFromCard(id, cardValues, user) {
    var patch = {};
    Object.keys(cardValues).forEach(function (field) {
      patch[field] = cardValues[field];
    });
    return updateRecord(id, patch, user);
  }

  function appendResearcher(input, user) {
    var data = getRecords();
    var duplicate = findDuplicate(data.records, input);
    if (duplicate) {
      return {
        created: false,
        duplicate: duplicate,
        record: duplicate
      };
    }
    var now = MT.Utils.nowParts();
    var record = {};
    MT.BASE_HEADERS.forEach(function (header) {
      record[header] = '';
    });
    record['ID'] = MT.Utils.generateId('PESQ');
    record['Nome'] = input['Nome'];
    record['Distrito'] = input['Distrito'];
    record['Zona'] = input['Zona'];
    record['Área'] = input['Área'];
    record['Semana'] = input['Semana'] || 'Semana 1';
    record['Data Batismal'] = input['Data Batismal'];
    record['Próximo Passo'] = input['Próximo Passo'] || '';
    record['Resultado'] = 'Em acompanhamento';
    record['Criado Em'] = now.timestamp;
    record['Criado Por'] = user || MT.Utils.currentUser();
    record['Última Atualização'] = now.timestamp;
    record['Última Atualização ISO'] = now.iso;
    record['Atualizado Por'] = user || MT.Utils.currentUser();
    data.records.push(record);
    saveRecords(recalculateRecords(data.records));
    MT.History.appendRows([
      MT.History.makeRow(record, 'Pesquisador criado', '', record['Nome'], user || MT.Utils.currentUser())
    ]);
    return {
      created: true,
      record: record
    };
  }

  function findDuplicate(records, input) {
    var name = MT.Utils.normalize(input['Nome']);
    var area = MT.Utils.normalize(input['Área']);
    var baptismDate = MT.Utils.toDate(input['Data Batismal']);
    var baptismKey = baptismDate ? baptismDate.getTime() : String(input['Data Batismal'] || '');
    for (var i = 0; i < records.length; i += 1) {
      var recordDate = MT.Utils.toDate(records[i]['Data Batismal']);
      var recordDateKey = recordDate ? recordDate.getTime() : String(records[i]['Data Batismal'] || '');
      if (
        MT.Utils.normalize(records[i]['Nome']) === name &&
        MT.Utils.normalize(records[i]['Área']) === area &&
        String(recordDateKey) === String(baptismKey)
      ) {
        return records[i];
      }
    }
    return null;
  }

  function activeRecords() {
    var records = getRecords().records;
    return records.filter(function (record) {
      var status = record['Status Cor'];
      return status !== MT.STATUS.BAPTIZED && status !== MT.STATUS.FELL;
    });
  }

  function sortedActiveRecords() {
    return MT.Utils.sortRecordsByStatus(activeRecords());
  }

  function districtRecords(district) {
    var normalizedDistrict = MT.Utils.normalize(district);
    var records = getRecords().records.filter(function (record) {
      if (MT.Utils.isBlank(normalizedDistrict)) return true;
      return MT.Utils.normalize(record['Distrito']) === normalizedDistrict;
    });
    return MT.Utils.sortRecordsByStatus(records);
  }

  function getDistricts() {
    var seen = {};
    var districts = [];
    getRecords().records.forEach(function (record) {
      var district = String(record['Distrito'] || '').trim();
      if (district && !seen[district]) {
        seen[district] = true;
        districts.push(district);
      }
    });
    return districts.sort();
  }

  function getSystemValue(key, fallback) {
    ensure();
    var sheetObject = MT.Utils.sheet(MT.SHEETS.SYSTEM);
    var lastRow = sheetObject.getLastRow();
    if (lastRow < 2) return fallback;
    var rows = sheetObject.getRange(2, 1, lastRow - 1, MT.SYSTEM_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i][0] === key) return rows[i][1] || fallback;
    }
    return fallback;
  }

  function setSystemValue(key, value) {
    ensure();
    var sheetObject = MT.Utils.sheet(MT.SHEETS.SYSTEM);
    var lastRow = sheetObject.getLastRow();
    var row = 0;
    if (lastRow >= 2) {
      var keys = sheetObject.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < keys.length; i += 1) {
        if (keys[i][0] === key) {
          row = i + 2;
          break;
        }
      }
    }
    if (!row) row = lastRow + 1;
    sheetObject.getRange(row, 1, 1, MT.SYSTEM_HEADERS.length).setValues([[
      key,
      value,
      MT.Utils.nowParts().timestamp
    ]]);
  }

  function getCurrentRecordId() {
    return getSystemValue(MT.SYSTEM_KEYS.CURRENT_RECORD_ID, '');
  }

  function setCurrentRecordId(id) {
    setSystemValue(MT.SYSTEM_KEYS.CURRENT_RECORD_ID, id || '');
  }

  function getUpdateLimitDays() {
    var configSheet = MT.Utils.sheet(MT.SHEETS.CONFIG);
    if (!configSheet) return MT.CONFIG.DEFAULT_UPDATE_LIMIT_DAYS;
    var value = Number(configSheet.getRange(MT.CONFIG.CELLS.UPDATE_LIMIT_DAYS).getValue());
    return value > 0 ? value : MT.CONFIG.DEFAULT_UPDATE_LIMIT_DAYS;
  }

  return {
    ensure: ensure,
    getRecords: getRecords,
    saveRecords: saveRecords,
    recalculateRecords: recalculateRecords,
    refreshStatuses: refreshStatuses,
    getRecordById: getRecordById,
    updateRecord: updateRecord,
    updateRecordFromCard: updateRecordFromCard,
    appendResearcher: appendResearcher,
    activeRecords: activeRecords,
    sortedActiveRecords: sortedActiveRecords,
    districtRecords: districtRecords,
    getDistricts: getDistricts,
    getSystemValue: getSystemValue,
    setSystemValue: setSystemValue,
    getCurrentRecordId: getCurrentRecordId,
    setCurrentRecordId: setCurrentRecordId,
    getUpdateLimitDays: getUpdateLimitDays
  };
})();
