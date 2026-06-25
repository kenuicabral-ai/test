var MT = MT || {};

MT.refreshAllDashboards = function () {
  MT.renderHome();
  MT.renderRegistration();
  MT.renderDistrictDashboard();
  MT.renderZoneDashboard();
};

MT.renderHome = function () {
  var sheet = MT.ensureSheet(MT.SHEETS.HOME, 40, 6);
  sheet.showSheet();
  MT.clearSheet(sheet, 40, 6);
  MT.applyAppChrome(sheet);
  sheet.setColumnWidths(1, 6, 92);
  sheet.setRowHeights(1, 40, 34);
  sheet.setRowHeight(1, 54);

  var config = MT.getConfig();
  var records = MT.getTrackableRecords();
  var counts = MT.getStatusCounts(records);

  sheet.getRange('A1:F1').merge().setValue(MT.APP_NAME);
  MT.styleTitle(sheet.getRange('A1:F1'));

  sheet.getRange('A2:F2').merge().setValue(config.district || 'Todos os distritos');
  sheet.getRange('A2:F2')
    .setHorizontalAlignment('center')
    .setFontSize(13)
    .setFontColor(MT.COLORS.MUTED_TEXT);

  sheet.getRange('A4:F4').merge().setValue('Hoje existem');
  sheet.getRange('A4:F4')
    .setHorizontalAlignment('center')
    .setFontSize(14)
    .setFontWeight('bold');

  sheet.getRange('B6:E13').setValues([
    ['🔴', counts[MT.STATUS.CRITICAL], 'críticos', ''],
    ['', '', '', ''],
    ['🟠', counts[MT.STATUS.STALE], 'sem atualização', ''],
    ['', '', '', ''],
    ['🟡', counts[MT.STATUS.PENDING], 'pendentes', ''],
    ['', '', '', ''],
    ['🟢', counts[MT.STATUS.OK], 'em dia', ''],
    ['', '', '', '']
  ]);
  sheet.getRange('B6:E13').setFontSize(16).setFontWeight('bold');
  sheet.getRange('B6:E13').setHorizontalAlignment('center');
  MT.styleCard(sheet.getRange('B6:E13'), MT.COLORS.CARD);

  sheet.getRange(MT.HOME_ACTION_CELLS.START).insertCheckboxes().setValue(false);
  sheet.getRange('C18:F18').merge().setValue('COMEÇAR REGISTROS');
  MT.styleButton(sheet.getRange('B18:F18'), MT.COLORS.DARK_BLUE, '#ffffff');
  sheet.getRange(MT.HOME_ACTION_CELLS.START).setHorizontalAlignment('center');

  sheet.getRange('A21:F23').merge().setValue('Atualize apenas o que aconteceu desde a última atualização. O sistema interpreta o acompanhamento automaticamente.');
  MT.styleCard(sheet.getRange('A21:F23'), MT.COLORS.LIGHT_BLUE);
  sheet.getRange('A21:F23').setFontColor(MT.COLORS.DARK_BLUE).setFontWeight('bold');
};

MT.renderRegistration = function () {
  var sheet = MT.ensureSheet(MT.SHEETS.REGISTRATION, 45, 6);
  sheet.showSheet();
  MT.clearSheet(sheet, 45, 6);
  MT.applyAppChrome(sheet);
  sheet.showRows(1, Math.min(sheet.getMaxRows(), 45));
  sheet.setColumnWidths(1, 6, 92);
  sheet.setRowHeights(1, 45, 30);
  sheet.setRowHeight(1, 50);
  sheet.setRowHeight(5, 42);
  sheet.setRowHeights(20, 2, 38);
  sheet.setRowHeights(24, 3, 38);

  var current = MT.getCurrentRecord();
  if (!current) {
    sheet.getRange('A1:F1').merge().setValue('📱 Registro');
    MT.styleTitle(sheet.getRange('A1:F1'));
    sheet.getRange('A4:F8').merge().setValue('Nenhum pesquisador encontrado na Base para o distrito configurado.');
    MT.styleCard(sheet.getRange('A4:F8'), MT.COLORS.LIGHT_ORANGE);
    return;
  }

  var record = current.record.data;
  var status = record.Status || MT.STATUS.STALE;
  var statusColor = MT.getStatusColor(status);

  sheet.getRange('A1:F1').merge().setValue('📱 Registro');
  MT.styleTitle(sheet.getRange('A1:F1'));

  sheet.getRange('A2:F2').merge().setValue('Pesquisador ' + current.index + ' de ' + current.count);
  sheet.getRange('A2:F2').setHorizontalAlignment('center').setFontColor(MT.COLORS.MUTED_TEXT);

  sheet.getRange('A4:F10').setBackground(MT.COLORS.CARD);
  sheet.getRange('A4:F10').setBorder(true, true, true, true, false, false, MT.COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange('B5:F5').merge().setValue(record.Nome || 'Sem nome');
  sheet.getRange('B5:F5').setFontSize(24).setFontWeight('bold');
  sheet.getRange('B6:F6').merge().setValue('Semana ' + (record.Semana || 1));
  sheet.getRange('B6:F6').setFontSize(13).setFontColor(MT.COLORS.MUTED_TEXT);
  sheet.getRange('B7:C7').merge().setValue('Área');
  sheet.getRange('D7:F7').merge().setValue(record['Área'] || '-');
  sheet.getRange('B8:C8').merge().setValue('Data Batismal');
  sheet.getRange('D8:F8').merge().setValue(MT.toDisplayDate(record['Data Batismal']) || '-');
  sheet.getRange('B9:C9').merge().setValue('Status');
  sheet.getRange('D9:F9').merge().setValue(MT.statusIcon(status) + ' ' + status);
  sheet.getRange('D9:F9').setBackground(MT.getStatusSoftColor(status)).setFontColor(statusColor).setFontWeight('bold');

  sheet.getRange('A12:F12').merge().setValue('STATUS');
  MT.styleSectionTitle(sheet.getRange('A12:F12'));

  MT.renderRegistrationBooleanField(sheet, 'TouchDown', 13, record.TouchDown);
  MT.renderRegistrationBooleanField(sheet, 'Plano Igreja', 14, record['Plano Igreja']);
  MT.renderRegistrationBooleanField(sheet, 'Match', 15, record.Match);
  MT.renderRegistrationBooleanField(sheet, 'Entrevista', 16, record.Entrevista);
  MT.applyWeekVisibility(sheet, MT.safeNumber(record.Semana, 1));

  sheet.getRange('A19:F19').merge().setValue('Próximo Passo');
  MT.styleSectionTitle(sheet.getRange('A19:F19'));
  sheet.getRange('B20:F21').merge().setValue(record['Próximo Passo'] || '');
  MT.styleCard(sheet.getRange('B20:F21'), MT.COLORS.CARD);

  sheet.getRange('A23:F23').merge().setValue('Observação');
  MT.styleSectionTitle(sheet.getRange('A23:F23'));
  sheet.getRange('B24:F26').merge().setValue(record['Observação'] || '');
  MT.styleCard(sheet.getRange('B24:F26'), MT.COLORS.CARD);

  sheet.getRange('A28:F28').merge().setValue('Resultado');
  MT.styleSectionTitle(sheet.getRange('A28:F28'));
  sheet.getRange('B29:F29').merge().setValue(record.Resultado || '');
  MT.styleCard(sheet.getRange('B29:F29'), MT.COLORS.CARD);
  MT.applyDataValidationList(sheet.getRange('B29'), MT.RESULT_OPTIONS, false);

  sheet.getRange('A31:F31').merge().setValue('Última atualização: ' + MT.toDisplayDateTime(record['Última Atualização']));
  sheet.getRange('A31:F31').setHorizontalAlignment('center').setFontColor(MT.COLORS.MUTED_TEXT);

  sheet.getRange(MT.REGISTRATION_NAV_CELLS.PREVIOUS).insertCheckboxes().setValue(false);
  sheet.getRange(MT.REGISTRATION_NAV_CELLS.SAVE).insertCheckboxes().setValue(false);
  sheet.getRange(MT.REGISTRATION_NAV_CELLS.NEXT).insertCheckboxes().setValue(false);
  sheet.getRange('A33:C33').setBackground(MT.COLORS.LIGHT_GRAY);
  sheet.getRange('C33').setValue('⬅ Anterior').setFontWeight('bold');
  sheet.getRange('D33:E33').setBackground(MT.COLORS.DARK_BLUE).setFontColor('#ffffff');
  sheet.getRange('E33').setValue('Salvar').setFontWeight('bold').setFontColor('#ffffff');
  sheet.getRange('F33').setBackground(MT.COLORS.LIGHT_GRAY);
  sheet.getRange('A34:F34').merge().setValue('Próximo ➡');
  MT.styleButton(sheet.getRange('A34:F34'), MT.COLORS.DARK_BLUE, '#ffffff');

  sheet.getRange('A36:F38').merge().setValue('Edite somente os campos do card. Histórico, cores, dashboards, data, hora e usuário são atualizados automaticamente.');
  MT.styleCard(sheet.getRange('A36:F38'), MT.COLORS.LIGHT_BLUE);
  sheet.getRange('A36:F38').setFontColor(MT.COLORS.DARK_BLUE).setFontWeight('bold');
};

MT.renderRegistrationBooleanField = function (sheet, label, row, value) {
  sheet.getRange(row, 2, 1, 3).merge().setValue(label);
  sheet.getRange(row, 2, 1, 3).setFontSize(14).setFontWeight('bold');
  sheet.getRange(row, 6).insertCheckboxes().setValue(MT.normalizeBoolean(value));
  MT.styleCard(sheet.getRange(row, 2, 1, 5), MT.COLORS.CARD);
};

MT.applyWeekVisibility = function (sheet, week) {
  sheet.showRows(13, 4);

  if (week <= 1) {
    sheet.hideRows(15, 2);
    return;
  }

  if (week === 2) {
    sheet.hideRows(13, 2);
    sheet.hideRows(16, 1);
    return;
  }

  sheet.hideRows(13, 3);
};

MT.renderDistrictDashboard = function () {
  var records = MT.sortRecordsByPriority(MT.getTrackableRecords());
  var rowsNeeded = Math.max(80, records.length * 4 + 12);
  var sheet = MT.ensureSheet(MT.SHEETS.DISTRICT_DASHBOARD, rowsNeeded, 6);
  sheet.showSheet();
  MT.clearSheet(sheet, rowsNeeded, 6);
  MT.applyAppChrome(sheet);
  sheet.setColumnWidths(1, 6, 92);
  sheet.setRowHeights(1, rowsNeeded, 28);
  sheet.setRowHeight(1, 50);

  var config = MT.getConfig();
  var counts = MT.getStatusCounts(records);

  sheet.getRange('A1:F1').merge().setValue('🚨 Dashboard Distrito');
  MT.styleTitle(sheet.getRange('A1:F1'));
  sheet.getRange('A2:F2').merge().setValue(config.district || 'Todos os distritos');
  sheet.getRange('A2:F2').setHorizontalAlignment('center').setFontColor(MT.COLORS.MUTED_TEXT);

  sheet.getRange('A4:F5').setValues([
    ['🟠 Sem atualização', counts[MT.STATUS.STALE], '🔴 Críticos', counts[MT.STATUS.CRITICAL], '🟡 Pendentes', counts[MT.STATUS.PENDING]],
    ['🟢 Em dia', counts[MT.STATUS.OK], '🔵 Batizados', counts[MT.STATUS.BAPTIZED], '⚫ Datas caídas', counts[MT.STATUS.FALLEN_DATE]]
  ]);
  sheet.getRange('A4:F5').setFontWeight('bold').setHorizontalAlignment('center');
  MT.styleCard(sheet.getRange('A4:F5'), MT.COLORS.CARD);

  if (!records.length) {
    sheet.getRange('A8:F11').merge().setValue('Nenhum pesquisador encontrado para o distrito configurado.');
    MT.styleCard(sheet.getRange('A8:F11'), MT.COLORS.LIGHT_ORANGE);
    return;
  }

  var startRow = 8;
  records.forEach(function (record, index) {
    var row = startRow + index * 4;
    var data = record.data;
    var status = data.Status || MT.STATUS.STALE;

    sheet.getRange(row, 1, 3, 6).setBackground(MT.getStatusSoftColor(status));
    sheet.getRange(row, 1, 3, 6).setBorder(true, true, true, true, false, false, MT.getStatusColor(status), SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.getRange(row, 1).setValue(MT.statusIcon(status));
    sheet.getRange(row, 2, 1, 3).merge().setValue(data.Nome || 'Sem nome').setFontSize(16).setFontWeight('bold');
    sheet.getRange(row, 5, 1, 2).merge().setValue(status).setFontWeight('bold').setFontColor(MT.getStatusColor(status));
    sheet.getRange(row + 1, 1, 1, 6).setValues([[
      'Área',
      data['Área'] || '-',
      'Semana',
      data.Semana || '-',
      'Batismo',
      MT.toDisplayDate(data['Data Batismal']) || '-'
    ]]);
    sheet.getRange(row + 2, 1, 1, 6).setValues([[
      'Próximo',
      data['Próximo Passo'] || '-',
      '',
      '',
      'Atualizado',
      MT.toDisplayDateTime(data['Última Atualização'])
    ]]);
  });
};

MT.renderZoneDashboard = function () {
  var records = MT.getBaseRecords();
  var districts = MT.getDistrictNames(records);
  var selectedIndicator = MT.getSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_INDICATOR, 'Todos');
  var selectedDistrict = MT.getSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_DISTRICT, 'Todos');
  var filtered = MT.filterZoneRecords(records, selectedDistrict, selectedIndicator);
  var rowsNeeded = Math.max(100, districts.length * 5 + filtered.length * 4 + 18);
  var sheet = MT.ensureSheet(MT.SHEETS.ZONE_DASHBOARD, rowsNeeded, 7);

  sheet.showSheet();
  MT.clearSheet(sheet, rowsNeeded, 7);
  MT.applyAppChrome(sheet);
  sheet.setColumnWidths(1, 7, 88);
  sheet.setRowHeights(1, rowsNeeded, 28);
  sheet.setRowHeight(1, 50);

  sheet.getRange('A1:G1').merge().setValue('📊 Dashboard Zona');
  MT.styleTitle(sheet.getRange('A1:G1'));

  sheet.getRange('A3:G3').merge().setValue('Toque nos filtros para ver somente quem precisa do tipo de ajuda escolhido.');
  sheet.getRange('A3:G3').setHorizontalAlignment('center').setFontColor(MT.COLORS.MUTED_TEXT);

  sheet.getRange('A4').setValue('Indicador');
  sheet.getRange(MT.ZONE_FILTER_CELLS.INDICATOR).setValue(selectedIndicator);
  MT.applyDataValidationList(sheet.getRange(MT.ZONE_FILTER_CELLS.INDICATOR), MT.ZONE_INDICATORS, false);
  sheet.getRange('A5').setValue('Distrito');
  sheet.getRange(MT.ZONE_FILTER_CELLS.DISTRICT).setValue(selectedDistrict);
  MT.applyDataValidationList(sheet.getRange(MT.ZONE_FILTER_CELLS.DISTRICT), ['Todos'].concat(districts), false);
  sheet.getRange('A4:B5').setFontWeight('bold');
  MT.styleCard(sheet.getRange('A4:B5'), MT.COLORS.CARD);

  var metrics = MT.getDistrictMetrics(records);
  var startRow = 8;

  if (!districts.length) {
    sheet.getRange('A8:G11').merge().setValue('Nenhum pesquisador cadastrado na Base.');
    MT.styleCard(sheet.getRange('A8:G11'), MT.COLORS.LIGHT_ORANGE);
    return;
  }

  districts.forEach(function (district, index) {
    var metric = metrics[district];
    var row = startRow + index * 4;
    sheet.getRange(row, 1, 3, 7).setBackground(MT.COLORS.CARD);
    sheet.getRange(row, 1, 3, 7).setBorder(true, true, true, true, false, false, MT.COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(row, 1, 1, 7).merge().setValue(district).setFontSize(15).setFontWeight('bold');
    sheet.getRange(row + 1, 1, 2, 7).setValues([
      ['Quantidade', 'Sem atualização', 'Sem Match', 'Sem Entrevista', 'Datas Caídas', 'Reservados', ''],
      [metric.total, metric.stale, metric.noMatch, metric.noInterview, metric.fallen, metric.reserved, '']
    ]);
    sheet.getRange(row + 1, 1, 1, 6).setFontWeight('bold').setFontColor(MT.COLORS.MUTED_TEXT);
    sheet.getRange(row + 2, 1, 1, 6).setFontWeight('bold').setHorizontalAlignment('center');
  });

  var detailStart = startRow + districts.length * 4 + 2;
  sheet.getRange(detailStart, 1, 1, 7).merge().setValue('Pesquisadores filtrados: ' + selectedIndicator + ' / ' + selectedDistrict);
  MT.styleSectionTitle(sheet.getRange(detailStart, 1, 1, 7));

  if (!filtered.length) {
    sheet.getRange(detailStart + 2, 1, 3, 7).merge().setValue('Nenhum pesquisador neste filtro.');
    MT.styleCard(sheet.getRange(detailStart + 2, 1, 3, 7), MT.COLORS.LIGHT_GREEN);
    return;
  }

  MT.sortRecordsByPriority(filtered).forEach(function (record, index) {
    var row = detailStart + 2 + index * 4;
    var data = record.data;
    var status = data.Status || MT.STATUS.STALE;

    sheet.getRange(row, 1, 3, 7).setBackground(MT.getStatusSoftColor(status));
    sheet.getRange(row, 1, 3, 7).setBorder(true, true, true, true, false, false, MT.getStatusColor(status), SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.getRange(row, 1).setValue(MT.statusIcon(status));
    sheet.getRange(row, 2, 1, 3).merge().setValue(data.Nome || 'Sem nome').setFontSize(15).setFontWeight('bold');
    sheet.getRange(row, 5, 1, 3).merge().setValue((data.Distrito || '-') + ' · ' + status).setFontWeight('bold').setFontColor(MT.getStatusColor(status));
    sheet.getRange(row + 1, 1, 1, 7).setValues([[
      'Área',
      data['Área'] || '-',
      'Semana',
      data.Semana || '-',
      'Batismo',
      MT.toDisplayDate(data['Data Batismal']) || '-',
      ''
    ]]);
    sheet.getRange(row + 2, 1, 1, 7).setValues([[
      'Próximo',
      data['Próximo Passo'] || '-',
      '',
      '',
      'Atualizado',
      MT.toDisplayDateTime(data['Última Atualização']),
      ''
    ]]);
  });
};

MT.getStatusCounts = function (records) {
  var counts = {};
  Object.keys(MT.STATUS).forEach(function (key) {
    counts[MT.STATUS[key]] = 0;
  });

  records.forEach(function (record) {
    var status = record.data.Status || MT.STATUS.STALE;
    counts[status] = (counts[status] || 0) + 1;
  });

  return counts;
};

MT.getDistrictNames = function (records) {
  var names = {};
  records.forEach(function (record) {
    names[record.data.Distrito || 'Sem distrito'] = true;
  });

  return Object.keys(names).sort();
};

MT.getDistrictMetrics = function (records) {
  var metrics = {};
  MT.getDistrictNames(records).forEach(function (district) {
    metrics[district] = {
      total: 0,
      stale: 0,
      noMatch: 0,
      noInterview: 0,
      fallen: 0,
      reserved: 0
    };
  });

  records.forEach(function (record) {
    var data = record.data;
    var district = data.Distrito || 'Sem distrito';
    var metric = metrics[district];
    metric.total++;
    metric.stale += data.Status === MT.STATUS.STALE ? 1 : 0;
    metric.noMatch += MT.normalizeBoolean(data.Match) ? 0 : 1;
    metric.noInterview += MT.normalizeBoolean(data.Entrevista) ? 0 : 1;
    metric.fallen += data.Status === MT.STATUS.FALLEN_DATE || data.Resultado === 'Data caiu' ? 1 : 0;
    metric.reserved += data.Resultado === 'Reservado' ? 1 : 0;
  });

  return metrics;
};

MT.filterZoneRecords = function (records, district, indicator) {
  return records.filter(function (record) {
    var data = record.data;
    var districtMatch = district === 'Todos' || String(data.Distrito || 'Sem distrito') === String(district);
    if (!districtMatch) {
      return false;
    }

    if (indicator === 'Todos') {
      return true;
    }

    if (indicator === 'Sem atualização') {
      return data.Status === MT.STATUS.STALE;
    }

    if (indicator === 'Sem Match') {
      return !MT.normalizeBoolean(data.Match);
    }

    if (indicator === 'Sem Entrevista') {
      return !MT.normalizeBoolean(data.Entrevista);
    }

    if (indicator === 'Datas Caídas') {
      return data.Status === MT.STATUS.FALLEN_DATE || data.Resultado === 'Data caiu';
    }

    if (indicator === 'Reservados') {
      return data.Resultado === 'Reservado';
    }

    return true;
  });
};
