var MT = MT || {};

MT.Dashboard = (function () {
  function refreshAll() {
    MT.Database.refreshStatuses();
    renderHome();
    renderRegistration();
    renderDistrictDashboard();
    renderZoneDashboard();
    MT.Database.setSystemValue(MT.SYSTEM_KEYS.LAST_REFRESH, MT.Utils.nowParts().timestamp);
  }

  function renderHome() {
    var sheetObject = MT.Utils.resetSheet(MT.SHEETS.HOME);
    prepareMobileSheet(sheetObject);
    sheetObject.setColumnWidths(1, 1, 24);
    sheetObject.setColumnWidths(2, 3, 120);
    sheetObject.setRowHeights(1, 24, 34);

    var config = getConfigSummary();
    var counts = countByStatus(MT.Database.getRecords().records);
    sheetObject.getRange('B2:D2').merge().setValue(MT.APP.NAME);
    MT.Colors.applyTitle(sheetObject.getRange('B2:D2'));
    sheetObject.getRange('B3:D3').merge().setValue(config.district || 'Distrito não configurado');
    MT.Colors.applySubtitle(sheetObject.getRange('B3:D3'));

    sheetObject.getRange('B5:D5').merge().setValue('Hoje existem');
    sheetObject.getRange('B5:D5').setFontSize(14).setFontWeight('bold');

    var summary = [
      ['🔴', counts[MT.STATUS.CRITICAL] || 0, 'críticos'],
      ['🟠', counts[MT.STATUS.STALE] || 0, 'sem atualização'],
      ['🟡', counts[MT.STATUS.PENDING] || 0, 'pendentes'],
      ['🟢', counts[MT.STATUS.OK] || 0, 'em dia']
    ];
    sheetObject.getRange(7, 2, summary.length, 3).setValues(summary);
    sheetObject.getRange('B7:D10').setFontSize(16).setFontWeight('bold');
    MT.Colors.applyCard(sheetObject.getRange('B7:D10'), MT.COLORS.CARD_BG);

    sheetObject.getRange('B13:D15').merge().setValue('Registre rapidamente o que aconteceu desde a última atualização.');
    sheetObject.getRange('B13:D15').setFontSize(12).setFontColor(MT.COLORS.MUTED).setWrap(true);

    sheetObject.getRange(MT.HOME.START_BUTTON).insertCheckboxes().setValue(false);
    sheetObject.getRange('C17:D17').merge().setValue('COMEÇAR REGISTROS');
    MT.Colors.applyButton(sheetObject.getRange('B17:D17'), MT.COLORS.BLUE);
    sheetObject.getRange(MT.HOME.START_BUTTON).setFontColor(MT.COLORS.WHITE);

    sheetObject.getRange('B20:D20').merge().setValue('Use os cartões. A planilha fica invisível.');
    MT.Colors.applySubtitle(sheetObject.getRange('B20:D20'));
  }

  function renderRegistration(recordId) {
    var sheetObject = MT.Utils.resetSheet(MT.SHEETS.REGISTRATION);
    prepareMobileSheet(sheetObject);
    MT.Utils.ensureRows(sheetObject, 40);
    MT.Utils.ensureColumns(sheetObject, 6);
    sheetObject.setColumnWidth(1, 92);
    sheetObject.setColumnWidth(2, 150);
    sheetObject.setColumnWidth(3, 132);
    sheetObject.setColumnWidths(4, 3, 40);
    sheetObject.hideColumns(5, 2);
    sheetObject.setRowHeights(1, 35, 34);

    var records = MT.Database.sortedActiveRecords();
    var selected = resolveRegistrationRecord(records, recordId);
    if (!selected) {
      renderEmptyRegistration(sheetObject);
      return;
    }
    MT.Database.setCurrentRecordId(selected['ID']);

    sheetObject.getRange(MT.REGISTRATION.RECORD_ID).setValue(selected['ID']);
    sheetObject.getRange('A2:C2').merge().setValue('📱 Registro');
    MT.Colors.applyTitle(sheetObject.getRange('A2:C2'));
    sheetObject.getRange(MT.REGISTRATION.NAME + ':C4').merge().setValue(selected['Nome']);
    sheetObject.getRange(MT.REGISTRATION.NAME + ':C4').setFontSize(22).setFontWeight('bold');
    sheetObject.getRange('A5').setValue('Semana');
    sheetObject.getRange(MT.REGISTRATION.WEEK + ':C5').merge().setValue(MT.Utils.weekLabel(selected));
    sheetObject.getRange('A7').setValue('Área');
    sheetObject.getRange(MT.REGISTRATION.AREA + ':C7').merge().setValue(selected['Área']);
    sheetObject.getRange('A9').setValue('Data Batismal');
    sheetObject.getRange(MT.REGISTRATION.BAPTISM_DATE + ':C9').merge().setValue(MT.Utils.formatDate(selected['Data Batismal'], selected['Data Batismal']));
    sheetObject.getRange('A11:C11').merge().setValue('STATUS');
    sheetObject.getRange('A11:C11').setFontWeight('bold').setFontColor(MT.COLORS.MUTED);

    setStatusInput(sheetObject, 'A13', MT.REGISTRATION.TOUCHDOWN, 'TouchDown', selected['TouchDown']);
    setStatusInput(sheetObject, 'A14', MT.REGISTRATION.CHURCH_PLAN, 'Plano Igreja', selected['Plano Igreja']);
    setStatusInput(sheetObject, 'A15', MT.REGISTRATION.MATCH, 'Match', selected['Match']);
    setStatusInput(sheetObject, 'A16', MT.REGISTRATION.INTERVIEW, 'Entrevista', selected['Entrevista']);

    sheetObject.getRange('A18:C18').merge().setValue('Próximo Passo');
    sheetObject.getRange(MT.REGISTRATION.NEXT_STEP + ':C20').merge().setValue(selected['Próximo Passo']);
    MT.Colors.applyInput(sheetObject.getRange(MT.REGISTRATION.NEXT_STEP + ':C20'));
    sheetObject.getRange('A21:C21').merge().setValue('Observação');
    sheetObject.getRange(MT.REGISTRATION.OBSERVATION + ':C23').merge().setValue(selected['Observação']);
    MT.Colors.applyInput(sheetObject.getRange(MT.REGISTRATION.OBSERVATION + ':C23'));
    sheetObject.getRange('A24:C24').merge().setValue('Resultado');
    sheetObject.getRange(MT.REGISTRATION.RESULT + ':C25').merge().setValue(selected['Resultado'] || 'Em acompanhamento');
    MT.Colors.applyInput(sheetObject.getRange(MT.REGISTRATION.RESULT + ':C25'));
    MT.Utils.setValidationList(sheetObject.getRange(MT.REGISTRATION.RESULT), MT.RESULTS);

    sheetObject.getRange('A27:C27').merge().setValue('Última atualização');
    sheetObject.getRange(MT.REGISTRATION.LAST_UPDATE + ':C28').merge().setValue(selected['Última Atualização'] || 'Ainda sem atualização');
    var statusStyle = MT.Colors.getStatusStyle(selected['Status Cor']);
    sheetObject.getRange('A29:C29').merge().setValue(statusStyle.label);
    MT.Colors.applyStatus(sheetObject.getRange('A29:C29'), selected['Status Cor']);

    MT.Colors.applyCard(sheetObject.getRange('A4:C31'), MT.COLORS.CARD_BG);
    reapplyRegistrationInputs(sheetObject);
    MT.Colors.applyStatus(sheetObject.getRange('A29:C29'), selected['Status Cor']);
    addRegistrationButtons(sheetObject);
    applySmartRows(sheetObject, MT.Utils.activeWeek(selected));
  }

  function renderEmptyRegistration(sheetObject) {
    sheetObject.getRange('A3:C3').merge().setValue('📱 Registro');
    MT.Colors.applyTitle(sheetObject.getRange('A3:C3'));
    sheetObject.getRange('A6:C10').merge().setValue('Nenhum pesquisador ativo encontrado.');
    MT.Colors.applyCard(sheetObject.getRange('A6:C10'), MT.COLORS.CARD_BG);
  }

  function setStatusInput(sheetObject, labelCell, valueCell, label, value) {
    sheetObject.getRange(labelCell).setValue(label);
    sheetObject.getRange(valueCell).insertCheckboxes().setValue(MT.Utils.toBoolean(value));
    sheetObject.getRange(valueCell + ':C' + sheetObject.getRange(valueCell).getRow()).merge();
    MT.Colors.applyInput(sheetObject.getRange(valueCell + ':C' + sheetObject.getRange(valueCell).getRow()));
  }

  function addRegistrationButtons(sheetObject) {
    sheetObject.getRange(MT.REGISTRATION.PREVIOUS_BUTTON).insertCheckboxes().setValue(false);
    sheetObject.getRange(MT.REGISTRATION.SAVE_BUTTON).insertCheckboxes().setValue(false);
    sheetObject.getRange(MT.REGISTRATION.NEXT_BUTTON).insertCheckboxes().setValue(false);
    sheetObject.getRange('A32').setValue('⬅ Anterior');
    sheetObject.getRange('B32').setValue('Salvar');
    sheetObject.getRange('C32').setValue('Próximo ➡');
    MT.Colors.applyButton(sheetObject.getRange('A31:A32'), MT.COLORS.GRAY);
    MT.Colors.applyButton(sheetObject.getRange('B31:B32'), MT.COLORS.GREEN);
    MT.Colors.applyButton(sheetObject.getRange('C31:C32'), MT.COLORS.BLUE);
  }

  function reapplyRegistrationInputs(sheetObject) {
    [
      MT.REGISTRATION.TOUCHDOWN,
      MT.REGISTRATION.CHURCH_PLAN,
      MT.REGISTRATION.MATCH,
      MT.REGISTRATION.INTERVIEW
    ].forEach(function (a1) {
      var row = sheetObject.getRange(a1).getRow();
      MT.Colors.applyInput(sheetObject.getRange(a1 + ':C' + row));
    });
    MT.Colors.applyInput(sheetObject.getRange(MT.REGISTRATION.NEXT_STEP + ':C20'));
    MT.Colors.applyInput(sheetObject.getRange(MT.REGISTRATION.OBSERVATION + ':C23'));
    MT.Colors.applyInput(sheetObject.getRange(MT.REGISTRATION.RESULT + ':C25'));
  }

  function applySmartRows(sheetObject, week) {
    sheetObject.showRows(13, 4);
    if (week === 1) {
      sheetObject.hideRows(MT.REGISTRATION.SMART_ROWS.MATCH);
      sheetObject.hideRows(MT.REGISTRATION.SMART_ROWS.INTERVIEW);
    }
    if (week === 2) {
      sheetObject.hideRows(MT.REGISTRATION.SMART_ROWS.TOUCHDOWN);
      sheetObject.hideRows(MT.REGISTRATION.SMART_ROWS.CHURCH_PLAN);
      sheetObject.hideRows(MT.REGISTRATION.SMART_ROWS.INTERVIEW);
    }
    if (week >= 3) {
      sheetObject.hideRows(MT.REGISTRATION.SMART_ROWS.TOUCHDOWN);
      sheetObject.hideRows(MT.REGISTRATION.SMART_ROWS.CHURCH_PLAN);
      sheetObject.hideRows(MT.REGISTRATION.SMART_ROWS.MATCH);
    }
  }

  function resolveRegistrationRecord(records, recordId) {
    if (!records.length) return null;
    var requestedId = recordId || MT.Database.getCurrentRecordId();
    for (var i = 0; i < records.length; i += 1) {
      if (String(records[i]['ID']) === String(requestedId)) return records[i];
    }
    return records[0];
  }

  function renderDistrictDashboard() {
    var sheetObject = MT.Utils.resetSheet(MT.SHEETS.DISTRICT_DASHBOARD);
    prepareMobileSheet(sheetObject);
    sheetObject.setColumnWidth(1, 28);
    sheetObject.setColumnWidths(2, 3, 125);
    sheetObject.setRowHeights(1, 120, 28);

    var district = getConfigSummary().district;
    var records = MT.Database.districtRecords(district);
    sheetObject.getRange('B2:D2').merge().setValue('🚨 Dashboard Distrito');
    MT.Colors.applyTitle(sheetObject.getRange('B2:D2'));
    sheetObject.getRange('B3:D3').merge().setValue(district || 'Todos os distritos');
    MT.Colors.applySubtitle(sheetObject.getRange('B3:D3'));

    if (!records.length) {
      sheetObject.getRange('B6:D9').merge().setValue('Sem pesquisadores para exibir.');
      MT.Colors.applyCard(sheetObject.getRange('B6:D9'), MT.COLORS.CARD_BG);
      return;
    }

    var row = 5;
    records.forEach(function (record) {
      renderResearcherCard(sheetObject, row, 2, record);
      row += 6;
    });
  }

  function renderZoneDashboard() {
    var sheetObject = MT.Utils.resetSheet(MT.SHEETS.ZONE_DASHBOARD);
    prepareMobileSheet(sheetObject);
    sheetObject.setColumnWidth(1, 24);
    sheetObject.setColumnWidths(2, 4, 95);
    sheetObject.setColumnWidth(6, 44);
    sheetObject.setColumnWidths(7, 2, 1);
    sheetObject.hideColumns(7, 2);
    sheetObject.setRowHeights(1, 160, 28);

    sheetObject.getRange('B2:F2').merge().setValue('📊 Dashboard Zona');
    MT.Colors.applyTitle(sheetObject.getRange('B2:F2'));
    sheetObject.getRange('B4').setValue('Filtro Distrito');
    sheetObject.getRange(MT.ZONE_DASHBOARD.FILTER_DISTRICT_CELL).setValue(MT.Database.getSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_DISTRICT, 'Todos'));
    sheetObject.getRange('B6').setValue('Indicador');
    sheetObject.getRange(MT.ZONE_DASHBOARD.FILTER_METRIC_CELL).setValue(MT.Database.getSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_METRIC, MT.ZONE_METRICS.ALL));
    MT.Utils.setValidationList(sheetObject.getRange(MT.ZONE_DASHBOARD.FILTER_METRIC_CELL), Object.keys(MT.ZONE_METRICS).map(function (key) {
      return MT.ZONE_METRICS[key];
    }));
    MT.Colors.applyInput(sheetObject.getRange('B5:F6'));

    var records = MT.Database.getRecords().records;
    var districts = buildDistrictMetrics(records);
    var row = MT.ZONE_DASHBOARD.FIRST_METRIC_ROW;
    if (!districts.length) {
      sheetObject.getRange('B10:F13').merge().setValue('Ainda não há pesquisadores cadastrados.');
      MT.Colors.applyCard(sheetObject.getRange('B10:F13'), MT.COLORS.CARD_BG);
      return;
    }

    districts.forEach(function (districtMetrics) {
      sheetObject.getRange(row, 2, 1, 5).merge().setValue('Distrito ' + districtMetrics.name);
      sheetObject.getRange(row, 2, 1, 5).setFontWeight('bold').setFontSize(14);
      row += 1;
      row = renderMetricRow(sheetObject, row, districtMetrics.name, MT.ZONE_METRICS.ALL, districtMetrics.total);
      row = renderMetricRow(sheetObject, row, districtMetrics.name, MT.ZONE_METRICS.STALE, districtMetrics.stale);
      row = renderMetricRow(sheetObject, row, districtMetrics.name, MT.ZONE_METRICS.NO_MATCH, districtMetrics.noMatch);
      row = renderMetricRow(sheetObject, row, districtMetrics.name, MT.ZONE_METRICS.NO_INTERVIEW, districtMetrics.noInterview);
      row = renderMetricRow(sheetObject, row, districtMetrics.name, MT.ZONE_METRICS.FELL, districtMetrics.fell);
      row = renderMetricRow(sheetObject, row, districtMetrics.name, MT.ZONE_METRICS.RESERVED, districtMetrics.reserved);
      row += 2;
    });

    row += 1;
    sheetObject.getRange(row, 2, 1, 5).merge().setValue('Pesquisadores do filtro');
    sheetObject.getRange(row, 2, 1, 5).setFontWeight('bold');
    row += 2;
    var filtered = filterZoneRecords(records);
    if (!filtered.length) {
      sheetObject.getRange(row, 2, 3, 5).merge().setValue('Nenhum pesquisador neste indicador.');
      MT.Colors.applyCard(sheetObject.getRange(row, 2, 3, 5), MT.COLORS.CARD_BG);
      return;
    }
    MT.Utils.sortRecordsByStatus(filtered).forEach(function (record) {
      renderResearcherCard(sheetObject, row, 2, record, 5);
      row += 6;
    });
  }

  function renderMetricRow(sheetObject, row, district, metric, value) {
    sheetObject.getRange(row, 2, 1, 3).merge().setValue(metric);
    sheetObject.getRange(row, 5).setValue(value);
    sheetObject.getRange(row, MT.ZONE_DASHBOARD.CLICK_COLUMN).insertCheckboxes().setValue(false);
    sheetObject.getRange(row, MT.ZONE_DASHBOARD.CACHE_DISTRICT_COLUMN).setValue(district);
    sheetObject.getRange(row, MT.ZONE_DASHBOARD.CACHE_METRIC_COLUMN).setValue(metric);
    MT.Colors.applyCard(sheetObject.getRange(row, 2, 1, 5), MT.COLORS.CARD_BG);
    sheetObject.getRange(row, 5).setFontWeight('bold').setHorizontalAlignment('center');
    return row + 1;
  }

  function renderResearcherCard(sheetObject, row, column, record, width) {
    var cardWidth = width || 3;
    var style = MT.Colors.getStatusStyle(record['Status Cor']);
    sheetObject.getRange(row, column, 5, cardWidth).setBackground(style.background);
    sheetObject.getRange(row, column, 1, cardWidth).merge().setValue((record['Status'] || style.label) + '  ' + record['Nome']);
    sheetObject.getRange(row + 1, column, 1, cardWidth).merge().setValue('Área: ' + (record['Área'] || '-') + ' • ' + MT.Utils.weekLabel(record));
    sheetObject.getRange(row + 2, column, 1, cardWidth).merge().setValue('Data Batismal: ' + MT.Utils.formatDate(record['Data Batismal'], '-'));
    sheetObject.getRange(row + 3, column, 1, cardWidth).merge().setValue('Próximo: ' + (record['Próximo Passo'] || 'sem próximo passo'));
    sheetObject.getRange(row + 4, column, 1, cardWidth).merge().setValue('Última: ' + (record['Última Atualização'] || 'sem atualização'));
    sheetObject.getRange(row, column, 5, cardWidth)
      .setWrap(true)
      .setBorder(true, true, true, true, false, false, style.color, SpreadsheetApp.BorderStyle.SOLID);
    sheetObject.getRange(row, column, 1, cardWidth).setFontWeight('bold');
  }

  function buildDistrictMetrics(records) {
    var grouped = {};
    records.forEach(function (record) {
      var district = String(record['Distrito'] || 'Sem distrito').trim();
      if (!grouped[district]) {
        grouped[district] = {
          name: district,
          total: 0,
          stale: 0,
          noMatch: 0,
          noInterview: 0,
          fell: 0,
          reserved: 0
        };
      }
      grouped[district].total += 1;
      if (record['Status Cor'] === MT.STATUS.STALE) grouped[district].stale += 1;
      if (!MT.Utils.toBoolean(record['Match']) && MT.Utils.activeWeek(record) >= 2) grouped[district].noMatch += 1;
      if (!MT.Utils.toBoolean(record['Entrevista']) && MT.Utils.activeWeek(record) >= 3) grouped[district].noInterview += 1;
      if (record['Status Cor'] === MT.STATUS.FELL || MT.Utils.normalize(record['Resultado']) === 'data caiu') grouped[district].fell += 1;
      if (record['Status Cor'] === MT.STATUS.BAPTIZED || MT.Utils.normalize(record['Resultado']) === 'reservado') grouped[district].reserved += 1;
    });
    return Object.keys(grouped).sort().map(function (district) {
      return grouped[district];
    });
  }

  function filterZoneRecords(records) {
    var district = MT.Database.getSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_DISTRICT, 'Todos');
    var metric = MT.Database.getSystemValue(MT.SYSTEM_KEYS.ZONE_FILTER_METRIC, MT.ZONE_METRICS.ALL);
    return records.filter(function (record) {
      var districtMatch = district === 'Todos' || MT.Utils.normalize(record['Distrito']) === MT.Utils.normalize(district);
      return districtMatch && matchesMetric(record, metric);
    });
  }

  function matchesMetric(record, metric) {
    if (metric === MT.ZONE_METRICS.STALE) return record['Status Cor'] === MT.STATUS.STALE;
    if (metric === MT.ZONE_METRICS.NO_MATCH) return !MT.Utils.toBoolean(record['Match']) && MT.Utils.activeWeek(record) >= 2;
    if (metric === MT.ZONE_METRICS.NO_INTERVIEW) return !MT.Utils.toBoolean(record['Entrevista']) && MT.Utils.activeWeek(record) >= 3;
    if (metric === MT.ZONE_METRICS.FELL) return record['Status Cor'] === MT.STATUS.FELL || MT.Utils.normalize(record['Resultado']) === 'data caiu';
    if (metric === MT.ZONE_METRICS.RESERVED) return record['Status Cor'] === MT.STATUS.BAPTIZED || MT.Utils.normalize(record['Resultado']) === 'reservado';
    return true;
  }

  function countByStatus(records) {
    var counts = {};
    MT.STATUS_ORDER.forEach(function (status) {
      counts[status] = 0;
    });
    records.forEach(function (record) {
      counts[record['Status Cor']] = (counts[record['Status Cor']] || 0) + 1;
    });
    return counts;
  }

  function getConfigSummary() {
    var sheetObject = MT.Utils.sheet(MT.SHEETS.CONFIG);
    if (!sheetObject) {
      return {
        district: '',
        zone: ''
      };
    }
    return {
      district: sheetObject.getRange(MT.CONFIG.CELLS.DISTRICT).getValue(),
      zone: sheetObject.getRange(MT.CONFIG.CELLS.ZONE).getValue()
    };
  }

  function prepareMobileSheet(sheetObject) {
    MT.Colors.applyAppSheetStyle(sheetObject);
  }

  return {
    refreshAll: refreshAll,
    renderHome: renderHome,
    renderRegistration: renderRegistration,
    renderDistrictDashboard: renderDistrictDashboard,
    renderZoneDashboard: renderZoneDashboard,
    matchesMetric: matchesMetric
  };
})();
