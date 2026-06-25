function mtRefreshAllDashboards(ss) {
  var spreadsheet = ss || mtGetSpreadsheet();
  mtRecalculateBaseStatuses(spreadsheet);
  mtRenderHome(spreadsheet);
  mtRenderDistrictDashboard(spreadsheet);
  mtRenderZoneDashboard(spreadsheet);
  mtUpdateLastRefresh(spreadsheet);
}

function mtRenderHome(ss) {
  var spreadsheet = ss || mtGetSpreadsheet();
  var sheet = mtGetOrCreateSheet(spreadsheet, MT_SHEETS.HOME);
  mtPrepareAppSheet(sheet);

  var config = mtGetConfig(spreadsheet);
  var records = mtReadBaseRecords(spreadsheet).map(function(record) {
    return mtWithComputedStatus(record, config);
  });
  var districtRecords = mtActiveRecords(mtRecordsForDistrict(records, config[MT_CONFIG_KEYS.DISTRICT]));
  var stats = mtDashboardStats(districtRecords);

  mtMergeAndStyle(sheet.getRange('A1:F3'), 'Mission Tracker', {
    background: MT_COLORS.DARK,
    fontColor: MT_COLORS.WHITE,
    fontSize: 22,
    fontWeight: 'bold',
    horizontalAlignment: 'center',
    borderColor: MT_COLORS.DARK
  });
  mtMergeAndStyle(sheet.getRange('A4:F5'), config[MT_CONFIG_KEYS.DISTRICT], {
    background: MT_COLORS.DARK,
    fontColor: MT_COLORS.WHITE,
    fontSize: 14,
    horizontalAlignment: 'center',
    borderColor: MT_COLORS.DARK
  });

  mtMergeAndStyle(sheet.getRange('A7:F8'), 'Hoje existem', {
    background: MT_COLORS.APP_BG,
    fontColor: MT_COLORS.MUTED_TEXT,
    fontSize: 13,
    fontWeight: 'bold',
    horizontalAlignment: 'center',
    border: false
  });

  mtHomeMetric_(sheet, 10, '🔴', stats.critical, 'críticos', MT_COLORS.RED_SOFT, MT_COLORS.RED);
  mtHomeMetric_(sheet, 12, '🟠', stats.noUpdate, 'sem atualização', MT_COLORS.ORANGE_SOFT, MT_COLORS.ORANGE);
  mtHomeMetric_(sheet, 14, '🟡', stats.pending, 'pendentes', MT_COLORS.YELLOW_SOFT, MT_COLORS.YELLOW);
  mtHomeMetric_(sheet, 16, '🟢', stats.ok, 'em dia', MT_COLORS.GREEN_SOFT, MT_COLORS.GREEN);

  mtSetCheckbox(sheet, MT_HOME_ACTIONS.START.row, MT_HOME_ACTIONS.START.column, false)
    .setBackground(MT_COLORS.BLUE)
    .setFontColor(MT_COLORS.WHITE);
  mtStyleButton(sheet.getRange('C18:E20'), 'COMEÇAR REGISTROS', MT_COLORS.BLUE);
  mtMergeAndStyle(sheet.getRange('A23:F25'), 'Abra a aba Registro para acompanhar um pesquisador por vez. Os dashboards são atualizados automaticamente.', {
    background: MT_COLORS.CARD_BG,
    fontColor: MT_COLORS.MUTED_TEXT,
    horizontalAlignment: 'center'
  });
}

function mtHomeMetric_(sheet, row, icon, count, label, background, color) {
  mtMergeAndStyle(sheet.getRange(row, 2, 1, 4), icon + ' ' + count + ' ' + label, {
    background: background,
    fontColor: color,
    fontSize: 15,
    fontWeight: 'bold',
    horizontalAlignment: 'center',
    borderColor: color
  });
}

function mtRenderDistrictDashboard(ss) {
  var spreadsheet = ss || mtGetSpreadsheet();
  var sheet = mtGetOrCreateSheet(spreadsheet, MT_SHEETS.DISTRICT_DASHBOARD);
  mtPrepareAppSheet(sheet);

  var config = mtGetConfig(spreadsheet);
  var records = mtReadBaseRecords(spreadsheet).map(function(record) {
    return mtWithComputedStatus(record, config);
  });
  var districtRecords = mtSortRecordsByPriority(mtActiveRecords(mtRecordsForDistrict(records, config[MT_CONFIG_KEYS.DISTRICT])));

  mtMergeAndStyle(sheet.getRange('A1:F2'), '🚨 Dashboard Distrito', {
    background: MT_COLORS.DARK,
    fontColor: MT_COLORS.WHITE,
    fontSize: 18,
    fontWeight: 'bold',
    horizontalAlignment: 'center',
    borderColor: MT_COLORS.DARK
  });
  mtMergeAndStyle(sheet.getRange('A3:F4'), 'Quem precisa de atenção aparece primeiro.', {
    background: MT_COLORS.APP_BG,
    fontColor: MT_COLORS.MUTED_TEXT,
    horizontalAlignment: 'center',
    border: false
  });

  if (districtRecords.length === 0) {
    mtEmptyState_(sheet, 7, 'Nenhum pesquisador ativo neste distrito.');
    return;
  }

  var row = 6;
  districtRecords.forEach(function(record) {
    row = mtRenderResearcherCard_(sheet, row, record, false) + 1;
  });
}

function mtRenderZoneDashboard(ss) {
  var spreadsheet = ss || mtGetSpreadsheet();
  var sheet = mtGetOrCreateSheet(spreadsheet, MT_SHEETS.ZONE_DASHBOARD);
  mtPrepareAppSheet(sheet);

  var config = mtGetConfig(spreadsheet);
  var records = mtReadBaseRecords(spreadsheet).map(function(record) {
    return mtWithComputedStatus(record, config);
  });
  var activeAndClosed = records;
  var districts = mtUnique(activeAndClosed.map(function(record) { return record.Distrito; }));
  var selected = mtGetZoneFilter_();

  mtMergeAndStyle(sheet.getRange('A1:F2'), '📊 Dashboard Zona', {
    background: MT_COLORS.DARK,
    fontColor: MT_COLORS.WHITE,
    fontSize: 18,
    fontWeight: 'bold',
    horizontalAlignment: 'center',
    borderColor: MT_COLORS.DARK
  });
  mtMergeAndStyle(sheet.getRange('A3:F4'), 'Toque em um indicador para ver somente aqueles pesquisadores.', {
    background: MT_COLORS.APP_BG,
    fontColor: MT_COLORS.MUTED_TEXT,
    horizontalAlignment: 'center',
    border: false
  });

  if (districts.length === 0) {
    mtEmptyState_(sheet, 7, 'Nenhum pesquisador cadastrado na Base.');
    return;
  }

  var row = 6;
  districts.forEach(function(district) {
    var districtRecords = activeAndClosed.filter(function(record) {
      return mtNormalizeText(record.Distrito) === mtNormalizeText(district);
    });
    var stats = mtDashboardStats(districtRecords);
    row = mtRenderDistrictSummaryCard_(sheet, row, district, stats, selected) + 1;
  });

  var filtered = mtApplyZoneFilter_(activeAndClosed, selected);
  row += 1;
  mtMergeAndStyle(sheet.getRange(row, 1, 1, 6), mtZoneFilterLabel_(selected), {
    background: MT_COLORS.BLUE_SOFT,
    fontColor: MT_COLORS.BLUE,
    fontWeight: 'bold',
    horizontalAlignment: 'center',
    borderColor: MT_COLORS.BLUE
  });
  row += 2;

  if (filtered.length === 0) {
    mtEmptyState_(sheet, row, 'Nenhum pesquisador encontrado para este indicador.');
    return;
  }

  mtSortRecordsByPriority(filtered).forEach(function(record) {
    row = mtRenderResearcherCard_(sheet, row, record, true) + 1;
  });
}

function mtRenderDistrictSummaryCard_(sheet, row, district, stats, selected) {
  mtMergeAndStyle(sheet.getRange(row, 1, 1, 6), 'Distrito: ' + district, {
    background: MT_COLORS.CARD_BG,
    fontColor: MT_COLORS.TEXT,
    fontSize: 14,
    fontWeight: 'bold',
    horizontalAlignment: 'center'
  });
  row++;
  mtZoneIndicator_(sheet, row++, district, MT_ZONE_FILTERS.ALL, 'Quantidade', stats.total, MT_COLORS.BLUE);
  mtZoneIndicator_(sheet, row++, district, MT_ZONE_FILTERS.NO_UPDATE, 'Sem atualização', stats.noUpdate, MT_COLORS.ORANGE);
  mtZoneIndicator_(sheet, row++, district, MT_ZONE_FILTERS.NO_MATCH, 'Sem Match', stats.noMatch, MT_COLORS.YELLOW);
  mtZoneIndicator_(sheet, row++, district, MT_ZONE_FILTERS.NO_INTERVIEW, 'Sem Entrevista', stats.noInterview, MT_COLORS.RED);
  mtZoneIndicator_(sheet, row++, district, MT_ZONE_FILTERS.DATE_DROPPED, 'Datas Caídas', stats.dateDropped, MT_COLORS.GRAY);
  mtZoneIndicator_(sheet, row++, district, MT_ZONE_FILTERS.RESERVED, 'Reservados', stats.reserved, MT_COLORS.GREEN);
  sheet.getRange(row - 6, MT_ZONE_ACTION_META.META_TYPE_COLUMN, 6, 3).setFontColor(MT_COLORS.APP_BG);
  return row;
}

function mtZoneIndicator_(sheet, row, district, filter, label, count, color) {
  sheet.getRange(row, 1, 1, 4)
    .merge()
    .setValue(label)
    .setBackground(MT_COLORS.CARD_BG)
    .setFontColor(MT_COLORS.TEXT)
    .setFontWeight('bold')
    .setBorder(true, true, true, false, false, false, MT_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(row, 5)
    .setValue(count)
    .setBackground(MT_COLORS.CARD_BG)
    .setFontColor(color)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBorder(true, false, true, false, false, false, MT_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mtSetCheckbox(sheet, row, MT_ZONE_ACTION_META.ACTION_COLUMN, false)
    .setBackground(MT_COLORS.CARD_BG)
    .setBorder(true, false, true, true, false, false, MT_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(row, MT_ZONE_ACTION_META.META_TYPE_COLUMN, 1, 3).setValues([['ZONE_FILTER', district, filter]]);
}

function mtRenderResearcherCard_(sheet, row, record, showDistrict) {
  var palette = mtStatusColor(record.Status);
  mtMergeAndStyle(sheet.getRange(row, 1, 1, 6), palette.icon + ' ' + record.Nome, {
    background: palette.soft,
    fontColor: palette.strong,
    fontSize: 15,
    fontWeight: 'bold',
    horizontalAlignment: 'center',
    borderColor: palette.strong
  });
  row++;
  var details = [
    ['Semana', 'Semana ' + (record.Semana || '-')],
    ['Área', record['Área'] || '-'],
    ['Data Batismal', mtFormatBaptismDate(record['Data Batismal'])],
    ['Próximo Passo', record['Próximo Passo'] || 'Sem próximo passo']
  ];
  if (showDistrict) {
    details.unshift(['Distrito', record.Distrito || '-']);
  }
  details.forEach(function(item) {
    sheet.getRange(row, 1, 1, 2)
      .merge()
      .setValue(item[0])
      .setBackground(MT_COLORS.CARD_BG)
      .setFontColor(MT_COLORS.MUTED_TEXT)
      .setFontWeight('bold');
    sheet.getRange(row, 3, 1, 4)
      .merge()
      .setValue(item[1])
      .setBackground(MT_COLORS.CARD_BG)
      .setFontColor(MT_COLORS.TEXT);
    sheet.getRange(row, 1, 1, 6).setBorder(false, true, false, true, false, false, MT_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    row++;
  });
  sheet.getRange(row - 1, 1, 1, 6).setBorder(false, true, true, true, false, false, MT_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  return row;
}

function mtEmptyState_(sheet, row, message) {
  mtMergeAndStyle(sheet.getRange(row, 1, 3, 6), message, {
    background: MT_COLORS.GRAY_SOFT,
    fontColor: MT_COLORS.MUTED_TEXT,
    horizontalAlignment: 'center'
  });
}

function mtSetZoneFilter(district, filter) {
  var props = PropertiesService.getUserProperties();
  props.setProperty(MT_USER_PROPERTIES.ZONE_FILTER_DISTRICT, district || '');
  props.setProperty(MT_USER_PROPERTIES.ZONE_FILTER, filter || MT_ZONE_FILTERS.ALL);
}

function mtGetZoneFilter_() {
  var props = PropertiesService.getUserProperties();
  return {
    district: props.getProperty(MT_USER_PROPERTIES.ZONE_FILTER_DISTRICT) || '',
    filter: props.getProperty(MT_USER_PROPERTIES.ZONE_FILTER) || MT_ZONE_FILTERS.ALL
  };
}

function mtApplyZoneFilter_(records, selected) {
  var district = mtNormalizeText(selected.district);
  var filter = selected.filter || MT_ZONE_FILTERS.ALL;
  return records.filter(function(record) {
    if (district && mtNormalizeText(record.Distrito) !== district) return false;
    if (filter === MT_ZONE_FILTERS.ALL) return true;
    if (filter === MT_ZONE_FILTERS.NO_UPDATE) return record.Status === MT_STATUS.NO_UPDATE;
    if (filter === MT_ZONE_FILTERS.NO_MATCH) return mtParseNumber(record.Semana, 1) >= 2 && !mtToBoolean(record.Match) && record.Status !== MT_STATUS.DATE_DROPPED;
    if (filter === MT_ZONE_FILTERS.NO_INTERVIEW) return mtParseNumber(record.Semana, 1) >= 3 && !mtToBoolean(record.Entrevista) && record.Status !== MT_STATUS.DATE_DROPPED;
    if (filter === MT_ZONE_FILTERS.DATE_DROPPED) return record.Status === MT_STATUS.DATE_DROPPED;
    if (filter === MT_ZONE_FILTERS.RESERVED) return mtToBoolean(record.Reservado) || mtNormalizeLower(record.Resultado) === 'reservado';
    return true;
  });
}

function mtZoneFilterLabel_(selected) {
  var labels = {};
  labels[MT_ZONE_FILTERS.ALL] = 'Quantidade';
  labels[MT_ZONE_FILTERS.NO_UPDATE] = 'Sem atualização';
  labels[MT_ZONE_FILTERS.NO_MATCH] = 'Sem Match';
  labels[MT_ZONE_FILTERS.NO_INTERVIEW] = 'Sem Entrevista';
  labels[MT_ZONE_FILTERS.DATE_DROPPED] = 'Datas Caídas';
  labels[MT_ZONE_FILTERS.RESERVED] = 'Reservados';
  var district = selected.district ? selected.district + ' • ' : '';
  return 'Filtro: ' + district + (labels[selected.filter] || 'Quantidade');
}
