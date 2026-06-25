function Dashboard_setup_() {
  Dashboard_refreshAll_();
}

function Dashboard_refreshAll_() {
  Database_recalculateAllStatuses_();
  Dashboard_renderHome_();
  Dashboard_renderRegistration_();
  Dashboard_renderDistrict_();
  Dashboard_renderZone_();
}

function Dashboard_renderHome_() {
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.home);
  Utils_clearSheet_(sheet);
  Colors_applyCanvas_(sheet);
  Utils_setColumnWidths_(sheet, { 1: 22, 2: 76, 3: 96, 4: 96, 5: 76, 6: 22 });
  Utils_setRowHeights_(sheet, { 2: 44, 4: 34, 6: 54, 8: 40, 10: 40, 12: 40, 14: 40, 20: 42 });

  var config = Config_get_();
  var records = Database_getActiveRecords_().map(function (record) {
    return Database_applyComputedFields_(record, config);
  }).filter(function (record) {
    return !config.district || record.Distrito === config.district;
  });
  var counts = Dashboard_statusCounts_(records);

  sheet.getRange('B2:E2').merge().setValue(MT_APP.name);
  Colors_applyTitle_(sheet.getRange('B2:E2'));
  sheet.getRange('B4:E4').merge().setValue(config.district);
  sheet.getRange('B4:E4').setFontSize(16).setFontWeight('bold').setFontColor(MT_COLORS.mutedText);

  sheet.getRange('B6:E6').merge().setValue('Hoje existem');
  sheet.getRange('B6:E6').setFontSize(18).setHorizontalAlignment('center');

  Dashboard_renderHomeMetric_(sheet, 'B8:E8', '🔴 ' + counts.critical + ' críticos', MT_COLORS.red, MT_COLORS.darkRed);
  Dashboard_renderHomeMetric_(sheet, 'B10:E10', '🟠 ' + counts.stale + ' sem atualização', MT_COLORS.orange, MT_COLORS.darkOrange);
  Dashboard_renderHomeMetric_(sheet, 'B12:E12', '🟡 ' + counts.pending + ' pendentes', MT_COLORS.yellow, MT_COLORS.darkYellow);
  Dashboard_renderHomeMetric_(sheet, 'B14:E14', '🟢 ' + counts.ok + ' em dia', MT_COLORS.green, MT_COLORS.darkGreen);

  sheet.getRange(MT_HOME_CELLS.startCheckbox).insertCheckboxes().setValue(false);
  sheet.getRange('C20:D20').merge().setValue('COMEÇAR REGISTROS');
  Colors_applyAction_(sheet.getRange('B20:D20'), MT_COLORS.action);
  sheet.getRange(MT_HOME_CELLS.refreshCheckbox).insertCheckboxes().setValue(false);
  sheet.getRange('F20').setValue('↻');
  Colors_applyAction_(sheet.getRange('E20:F20'), MT_COLORS.darkGray);
}

function Dashboard_renderHomeMetric_(sheet, rangeA1, label, background, textColor) {
  var range = sheet.getRange(rangeA1).merge();
  range
    .setValue(label)
    .setFontSize(15)
    .setFontWeight('bold')
    .setFontColor(textColor)
    .setHorizontalAlignment('center');
  Colors_applyCard_(range, background);
}

function Dashboard_statusCounts_(records) {
  return records.reduce(function (counts, record) {
    if (record.statusKey === MT_STATUS_KEYS.critical) {
      counts.critical += 1;
    } else if (record.statusKey === MT_STATUS_KEYS.stale) {
      counts.stale += 1;
    } else if (record.statusKey === MT_STATUS_KEYS.pending) {
      counts.pending += 1;
    } else if (record.statusKey === MT_STATUS_KEYS.ok) {
      counts.ok += 1;
    }
    return counts;
  }, { critical: 0, stale: 0, pending: 0, ok: 0 });
}

function Dashboard_renderRegistration_() {
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.registration);
  Utils_clearSheet_(sheet);
  Colors_applyCanvas_(sheet);
  Utils_setColumnWidths_(sheet, { 1: 18, 2: 82, 3: 82, 4: 82, 5: 82, 6: 82 });
  Utils_setRowHeights_(sheet, {
    2: 34, 4: 42, 7: 38, 10: 28, 12: 36, 13: 36, 14: 36, 16: 36,
    20: 28, 21: 58, 24: 28, 25: 80, 29: 28, 30: 38, 33: 34, 36: 34, 37: 34
  });

  var record = Database_getCurrentRecord_();
  if (!record) {
    Dashboard_renderEmptyRegistration_(sheet);
    return;
  }

  sheet.getRange('B2:F2').merge().setValue('📱 Registro');
  Colors_applyTitle_(sheet.getRange('B2:F2'));

  Utils_merge_(sheet, 'B4:D5').setValue(record.Nome || 'Sem nome');
  sheet.getRange('B4:D5').setFontSize(20).setFontWeight('bold');
  Colors_applyCard_(sheet.getRange('B4:D5'), MT_COLORS.card);

  Utils_merge_(sheet, 'E4:F5').setValue('Semana ' + (record.Semana || 1));
  sheet.getRange('E4:F5').setHorizontalAlignment('center').setFontSize(14).setFontWeight('bold');
  Colors_applyCard_(sheet.getRange('E4:F5'), Colors_statusColor_(record.statusKey));

  Utils_merge_(sheet, 'B7:D8').setValue('Área\n' + (record['Área'] || '-'));
  Utils_merge_(sheet, 'E7:F8').setValue('Data Batismal\n' + Utils_formatDate_(record['Data Batismal'], 'dd MMMM'));
  sheet.getRange('B7:F8').setFontSize(12).setWrap(true);
  Colors_applyCard_(sheet.getRange('B7:D8'), MT_COLORS.card);
  Colors_applyCard_(sheet.getRange('E7:F8'), MT_COLORS.card);

  sheet.getRange('B10:F10').merge().setValue('STATUS');
  Colors_applySectionTitle_(sheet.getRange('B10:F10'));
  Dashboard_renderStatusField_(sheet, 12, 'TouchDown', record.TouchDown, true);
  Dashboard_renderStatusField_(sheet, 13, 'Plano Igreja', record['Plano Igreja'], false);
  Dashboard_renderStatusField_(sheet, 14, 'Match', record.Match, true);
  Dashboard_renderStatusField_(sheet, 16, 'Entrevista', record.Entrevista, true);

  Dashboard_hideIrrelevantStatusRows_(sheet, record.Semana);

  sheet.getRange('B20:F20').merge().setValue('Próximo Passo');
  Colors_applySectionTitle_(sheet.getRange('B20:F20'));
  Utils_merge_(sheet, 'B21:F22').setValue(record['Próximo Passo'] || '');
  Colors_applyInput_(sheet.getRange('B21:F22'));

  sheet.getRange('B24:F24').merge().setValue('Observação');
  Colors_applySectionTitle_(sheet.getRange('B24:F24'));
  Utils_merge_(sheet, 'B25:F27').setValue(record['Observação'] || '');
  Colors_applyInput_(sheet.getRange('B25:F27'));

  sheet.getRange('B29:D29').merge().setValue('Resultado');
  Colors_applySectionTitle_(sheet.getRange('B29:D29'));
  sheet.getRange(MT_REGISTRATION_CELLS.result).setValue(record.Resultado || 'Em acompanhamento');
  Utils_setDropdown_(sheet.getRange(MT_REGISTRATION_CELLS.result), MT_RESULT_OPTIONS);
  Colors_applyInput_(sheet.getRange(MT_REGISTRATION_CELLS.result));

  Utils_merge_(sheet, 'B33:F33').setValue('Última atualização: ' + Dashboard_lastUpdateLabel_(record));
  sheet.getRange('B33:F33').setFontColor(MT_COLORS.mutedText).setHorizontalAlignment('center');

  Dashboard_renderRegistrationActions_(sheet);
}

function Dashboard_renderEmptyRegistration_(sheet) {
  sheet.getRange('B2:F2').merge().setValue('📱 Registro');
  Colors_applyTitle_(sheet.getRange('B2:F2'));
  sheet.getRange('B6:F10').merge().setValue('Nenhum pesquisador ativo na Base.');
  Colors_applyCard_(sheet.getRange('B6:F10'), MT_COLORS.card);
  sheet.getRange('B6:F10').setHorizontalAlignment('center').setFontSize(15);
}

function Dashboard_renderStatusField_(sheet, row, label, value, editable) {
  sheet.getRange(row, 2, 1, 3).merge().setValue(label);
  sheet.getRange(row, 2, 1, 3).setFontWeight('bold');
  Colors_applyCard_(sheet.getRange(row, 2, 1, 4), MT_COLORS.card);
  if (editable) {
    sheet.getRange(row, 5).insertCheckboxes().setValue(Utils_isChecked_(value));
    Colors_applyInput_(sheet.getRange(row, 5));
  } else {
    sheet.getRange(row, 5).setValue(Utils_isChecked_(value) ? '✅' : '—');
    sheet.getRange(row, 5).setHorizontalAlignment('center');
    Colors_applyCard_(sheet.getRange(row, 5), MT_COLORS.gray);
  }
}

function Dashboard_hideIrrelevantStatusRows_(sheet, week) {
  var rule = Database_getWeekRule_(week);
  var rowByField = {
    'TouchDown': 12,
    'Plano Igreja': 13,
    'Match': 14,
    'Entrevista': 16
  };
  Object.keys(rowByField).forEach(function (field) {
    if (rule.visibleFields.indexOf(field) < 0) {
      sheet.hideRows(rowByField[field]);
    }
  });
}

function Dashboard_lastUpdateLabel_(record) {
  var lastUpdate = Utils_toDate_(record['Última Atualização']);
  if (!lastUpdate) {
    return 'sem registro';
  }
  var today = Utils_startOfDay_(Utils_now_()).getTime();
  var updatedDay = Utils_startOfDay_(lastUpdate).getTime();
  var prefix = today === updatedDay ? 'Hoje' : Utils_formatDate_(lastUpdate);
  return prefix + ' ' + Utils_formatTime_(lastUpdate);
}

function Dashboard_renderRegistrationActions_(sheet) {
  sheet.getRange('B36:C36').merge().setValue('⬅ Anterior');
  sheet.getRange('D36:E36').merge().setValue('Salvar');
  sheet.getRange('F36').setValue('Próximo ➡');
  Colors_applyAction_(sheet.getRange('B36:C36'), MT_COLORS.darkGray);
  Colors_applyAction_(sheet.getRange('D36:E36'), MT_COLORS.action);
  Colors_applyAction_(sheet.getRange('F36'), MT_COLORS.darkGreen);
  sheet.getRange(MT_REGISTRATION_CELLS.previousCheckbox).insertCheckboxes().setValue(false);
  sheet.getRange(MT_REGISTRATION_CELLS.saveCheckbox).insertCheckboxes().setValue(false);
  sheet.getRange(MT_REGISTRATION_CELLS.nextCheckbox).insertCheckboxes().setValue(false);
  sheet.getRange('C37').setValue('tocar');
  sheet.getRange('E37').setValue('tocar');
  sheet.getRange('F37').setHorizontalAlignment('center');
}

function Dashboard_renderDistrict_() {
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.districtDashboard);
  Utils_clearSheet_(sheet);
  Colors_applyCanvas_(sheet);
  Utils_setColumnWidths_(sheet, { 1: 16, 2: 112, 3: 112, 4: 112, 5: 112, 6: 16 });
  sheet.getRange('B2:E2').merge().setValue('🚨 Dashboard Distrito');
  Colors_applyTitle_(sheet.getRange('B2:E2'));

  var config = Config_get_();
  var records = Database_getSortedActiveRecords_().filter(function (record) {
    return !config.district || record.Distrito === config.district;
  });
  sheet.getRange('B4:E4').merge().setValue(config.district + ' · ' + records.length + ' pesquisadores');
  sheet.getRange('B4:E4').setFontColor(MT_COLORS.mutedText).setFontWeight('bold');

  Dashboard_renderResearcherCards_(sheet, records, 6);
}

function Dashboard_renderZone_() {
  var sheet = Utils_getOrCreateSheet_(MT_SHEETS.zoneDashboard);
  Utils_clearSheet_(sheet);
  Colors_applyCanvas_(sheet);
  Utils_setColumnWidths_(sheet, { 1: 16, 2: 132, 3: 76, 4: 120, 5: 58, 6: 46 });
  sheet.getRange('B2:F2').merge().setValue('📊 Dashboard Zona');
  Colors_applyTitle_(sheet.getRange('B2:F2'));
  sheet.getRange('B4:F4').merge().setValue('Toque no checkbox de um indicador para ver somente aqueles pesquisadores.');
  sheet.getRange('B4:F4').setFontColor(MT_COLORS.mutedText).setWrap(true);

  var districts = Database_metricsByDistrict_();
  var row = 6;
  districts.forEach(function (districtMetrics) {
    Dashboard_renderDistrictMetricCard_(sheet, districtMetrics, row);
    row += 9;
  });

  var selectedDistrict = State_get_(MT_STATE_KEYS.activeZoneDistrict);
  var selectedMetric = State_get_(MT_STATE_KEYS.activeZoneMetric);
  var filtered = Dashboard_filterZoneRecords_(districts, selectedDistrict, selectedMetric);
  if (selectedDistrict && selectedMetric) {
    var label = Dashboard_metricLabel_(selectedMetric);
    sheet.getRange(row + 1, 2, 1, 5).merge().setValue(selectedDistrict + ' · ' + label);
    Colors_applySectionTitle_(sheet.getRange(row + 1, 2, 1, 5));
    Dashboard_renderResearcherCards_(sheet, filtered, row + 3);
  }
}

function Dashboard_renderDistrictMetricCard_(sheet, districtMetrics, startRow) {
  sheet.getRange(startRow, 2, 1, 5).merge().setValue(districtMetrics.district);
  sheet.getRange(startRow, 2, 1, 5).setFontWeight('bold').setFontSize(14);
  Colors_applyCard_(sheet.getRange(startRow, 2, 1, 5), MT_COLORS.card);

  MT_ZONE_METRICS.forEach(function (metric, index) {
    var row = startRow + index + 1;
    sheet.getRange(row, 2, 1, 2).merge().setValue(metric.label);
    sheet.getRange(row, 4).setValue(districtMetrics[metric.key] || 0).setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange(row, 6).insertCheckboxes().setValue(false);
    Colors_applyCard_(sheet.getRange(row, 2, 1, 5), MT_COLORS.card);
  });
}

function Dashboard_metricForActionCell_(row, column) {
  if (column !== 6 || row < 7) {
    return null;
  }
  var districts = Database_metricsByDistrict_();
  for (var index = 0; index < districts.length; index += 1) {
    var cardStart = 6 + index * 9;
    var metricIndex = row - cardStart - 1;
    if (metricIndex >= 0 && metricIndex < MT_ZONE_METRICS.length) {
      return {
        district: districts[index].district,
        key: MT_ZONE_METRICS[metricIndex].key
      };
    }
  }
  return null;
}

function Dashboard_metricLabel_(key) {
  var metric = MT_ZONE_METRICS.filter(function (item) {
    return item.key === key;
  })[0];
  return metric ? metric.label : '';
}

function Dashboard_filterZoneRecords_(districts, selectedDistrict, selectedMetric) {
  if (!selectedDistrict || !selectedMetric) {
    return [];
  }
  var district = districts.filter(function (item) {
    return item.district === selectedDistrict;
  })[0];
  if (!district) {
    return [];
  }
  var records = district.records.slice().sort(Database_compareRecords_);
  if (selectedMetric === 'all') {
    return records;
  }
  return records.filter(function (record) {
    if (selectedMetric === 'stale') {
      return record.statusKey === MT_STATUS_KEYS.stale;
    }
    if (selectedMetric === 'missingMatch') {
      return !Utils_isChecked_(record.Match);
    }
    if (selectedMetric === 'missingInterview') {
      return !Utils_isChecked_(record.Entrevista);
    }
    if (selectedMetric === 'dropped') {
      return record.statusKey === MT_STATUS_KEYS.dropped || String(record.Resultado || '') === 'Data caiu';
    }
    if (selectedMetric === 'reserved') {
      return record.isReserved;
    }
    return false;
  });
}

function Dashboard_renderResearcherCards_(sheet, records, startRow) {
  if (!records.length) {
    sheet.getRange(startRow, 2, 4, 4).merge().setValue('Nenhum pesquisador para este filtro.');
    Colors_applyCard_(sheet.getRange(startRow, 2, 4, 4), MT_COLORS.card);
    sheet.getRange(startRow, 2, 4, 4).setHorizontalAlignment('center');
    return;
  }

  records.forEach(function (record, index) {
    var row = startRow + index * 7;
    var color = Colors_statusColor_(record.statusKey);
    sheet.getRange(row, 2, 1, 4).merge().setValue((record.Status || '') + ' · ' + (record.Nome || 'Sem nome'));
    sheet.getRange(row, 2, 1, 4).setFontWeight('bold').setFontSize(13).setFontColor(Colors_statusTextColor_(record.statusKey));
    sheet.getRange(row + 1, 2, 1, 4).merge().setValue('Área: ' + (record['Área'] || '-') + ' · Semana ' + (record.Semana || 1));
    sheet.getRange(row + 2, 2, 1, 4).merge().setValue('Data Batismal: ' + Utils_formatDate_(record['Data Batismal']));
    sheet.getRange(row + 3, 2, 1, 4).merge().setValue('Pendências: ' + (record.pendingFields && record.pendingFields.length ? record.pendingFields.join(', ') : 'nenhuma'));
    sheet.getRange(row + 4, 2, 1, 4).merge().setValue('Próximo Passo: ' + (record['Próximo Passo'] || '-'));
    sheet.getRange(row + 5, 2, 1, 4).merge().setValue('Atualização: ' + Dashboard_lastUpdateLabel_(record));
    Colors_applyCard_(sheet.getRange(row, 2, 6, 4), color);
    sheet.getRange(row + 1, 2, 5, 4).setFontColor(MT_COLORS.text).setWrap(true);
  });
}
