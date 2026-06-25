/**
 * Mission Tracker - Dashboards de Distrito e Zona.
 */
var MTDashboard = (function () {
  function refreshAll() {
    refreshConfigDistrictOptions_();
    refreshHome();
    refreshDistrictDashboard();
    refreshZoneDashboard();
  }

  function refreshHome() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MT.SHEETS.HOME);
    if (!sheet) {
      return;
    }
    var district = getSelectedDistrict_();
    var researchers = MTDatabase.getAllResearchers().filter(function (item) {
      return district === 'Todos' || item.distrito === district;
    });
    var counts = countByStatus_(researchers);
    var headerDistrict = district === 'Todos' ? 'Todos os distritos' : district;
    var lines = [
      ['Distrito selecionado: ' + headerDistrict, '', '', ''],
      ['🔴 ' + counts.red + ' críticos', '', '', ''],
      ['🟠 ' + counts.orange + ' sem atualização', '', '', ''],
      ['🟡 ' + counts.yellow + ' pendentes', '', '', ''],
      ['🟢 ' + counts.green + ' em dia', '', '', '']
    ];
    sheet.getRange('B8:E12').setValues(lines);
    sheet.getRange('B8:E12').setHorizontalAlignment('center').setFontSize(14);
  }

  function refreshDistrictDashboard() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MT.SHEETS.DASH_DISTRITO);
    if (!sheet) {
      return;
    }
    var district = getSelectedDistrict_();
    var researchers = MTDatabase.getAllResearchers().filter(function (item) {
      return district === 'Todos' || item.distrito === district;
    });
    researchers.sort(function (a, b) {
      var pA = MT.SORT_PRIORITY[a.status_cor] || 99;
      var pB = MT.SORT_PRIORITY[b.status_cor] || 99;
      if (pA !== pB) {
        return pA - pB;
      }
      return String(a.nome).localeCompare(String(b.nome));
    });

    sheet.getRange('B4:E200').breakApart();
    sheet.getRange('B4:E4').merge().setValue('Distrito: ' + district + ' | Pesquisadores: ' + researchers.length).setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange('B6:E200').clearContent().clearFormat();

    if (!researchers.length) {
      sheet.getRange('B6:E6').merge().setValue('Nenhum pesquisador encontrado.').setHorizontalAlignment('center');
      return;
    }

    var values = [];
    var backgrounds = [];
    var fontColors = [];
    researchers.forEach(function (item) {
      var palette = MT.COLOR_MAP[item.status_cor] || MT.COLOR_MAP[MT.STATUS.GREEN];
      values.push([buildDistrictCardText_(item), '', '', '']);
      backgrounds.push([palette.bg, palette.bg, palette.bg, palette.bg]);
      fontColors.push([palette.fg, palette.fg, palette.fg, palette.fg]);
    });

    var target = sheet.getRange(6, 2, values.length, 4);
    target.setValues(values);
    target.setBackgrounds(backgrounds);
    target.setFontColors(fontColors);
    target.setFontWeight('bold');
    target.setWrap(true);
    target.setBorder(true, true, true, true, true, true, '#FFFFFF', SpreadsheetApp.BorderStyle.SOLID);
  }

  function refreshZoneDashboard() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MT.SHEETS.DASH_ZONA);
    if (!sheet) {
      return;
    }
    var researchers = MTDatabase.getAllResearchers();
    var grouped = groupByDistrict_(researchers);

    var zoneRange = sheet.getRange('B4:F500');
    zoneRange.breakApart();
    zoneRange.clearContent();
    zoneRange.clearDataValidations();
    zoneRange.clearNote();
    zoneRange.clearFormat();
    var row = 4;
    var indicatorCells = [];

    Object.keys(grouped).sort().forEach(function (district) {
      var list = grouped[district];
      var metrics = buildDistrictMetrics_(list);
      sheet.getRange(row, 2, 1, 5).merge().setValue('🏘 ' + district).setFontWeight('bold').setBackground('#E5E7EB');
      row++;

      metrics.forEach(function (metric) {
        sheet.getRange(row, 2).setValue(metric.icon + ' ' + metric.label);
        sheet.getRange(row, 3).setValue(metric.count);
        var checkCell = sheet.getRange(row, 5);
        checkCell.insertCheckboxes();
        checkCell.setValue(false);
        checkCell.setNote(JSON.stringify({ district: district, filter: metric.key }));
        indicatorCells.push(checkCell.getA1Notation());
        row++;
      });
      row++;
    });

    var selectedFilter = getZoneFilter_();
    var selectedDistrict = getZoneFilterDistrict_();
    renderZoneFilteredList_(sheet, row + 1, researchers, selectedFilter, selectedDistrict);
    restoreSelectedIndicator_(sheet, indicatorCells, selectedFilter, selectedDistrict);
  }

  function handleZoneIndicatorToggle(e) {
    var range = e.range;
    if (range.getColumn() !== 5 || range.getRow() < 4) {
      return;
    }
    var note = range.getNote();
    if (!note) {
      return;
    }
    var parsed = JSON.parse(note);
    if (MTUtils.toBoolean(e.value)) {
      setZoneFilter_(parsed.filter, parsed.district);
    } else {
      setZoneFilter_('todos', 'Todos');
    }
    refreshZoneDashboard();
  }

  function handleConfigEdit(e) {
    var a1 = e.range.getA1Notation();
    if (a1 === MT.CONFIG.DISTRICT_CELL) {
      setSelectedDistrict_(MTUtils.normalizeText(e.range.getValue()) || 'Todos');
      refreshAll();
      return;
    }
    if (a1 === MT.CONFIG.FILTER_CELL) {
      var key = getFilterKeyFromLabel_(MTUtils.normalizeText(e.range.getValue()));
      setZoneFilter_(key, 'Todos');
      refreshZoneDashboard();
      return;
    }
    if (a1 === MT.CONFIG.ACTION_CELL && MTUtils.normalizeText(e.range.getValue()) === MT.ACTIONS.REFRESH) {
      refreshAll();
      e.range.setValue(MT.APP.ACTION_EMPTY);
    }
  }

  function refreshConfigDistrictOptions_() {
    var configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MT.SHEETS.CONFIG);
    if (!configSheet) {
      return;
    }
    var districts = MTDatabase.getDistricts();
    var districtRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(districts, true)
      .setAllowInvalid(false)
      .build();
    var districtCell = configSheet.getRange(MT.CONFIG.DISTRICT_CELL);
    districtCell.setDataValidation(districtRule);
    if (districts.indexOf(districtCell.getValue()) === -1) {
      districtCell.setValue('Todos');
      setSelectedDistrict_('Todos');
    }
  }

  function renderZoneFilteredList_(sheet, startRow, researchers, selectedFilter, selectedDistrict) {
    var label = getFilterLabelFromKey_(selectedFilter);
    sheet.getRange(startRow, 2, 1, 5).merge().setValue('🔎 Filtro ativo: ' + label + ' | Distrito: ' + selectedDistrict).setFontWeight('bold');
    startRow++;

    var filtered = applyFilter_(researchers, selectedFilter, selectedDistrict);
    if (!filtered.length) {
      sheet.getRange(startRow, 2, 1, 5).merge().setValue('Nenhum pesquisador para o filtro selecionado.');
      return;
    }

    var values = filtered.map(function (item) {
      return [buildDistrictCardText_(item), '', '', '', ''];
    });
    var backgrounds = filtered.map(function (item) {
      var palette = MT.COLOR_MAP[item.status_cor] || MT.COLOR_MAP[MT.STATUS.GREEN];
      return [palette.bg, palette.bg, palette.bg, palette.bg, palette.bg];
    });
    var fontColors = filtered.map(function (item) {
      var palette = MT.COLOR_MAP[item.status_cor] || MT.COLOR_MAP[MT.STATUS.GREEN];
      return [palette.fg, palette.fg, palette.fg, palette.fg, palette.fg];
    });

    var target = sheet.getRange(startRow, 2, values.length, 5);
    target.setValues(values);
    target.setBackgrounds(backgrounds);
    target.setFontColors(fontColors);
    target.setFontWeight('bold');
    target.setWrap(true);
  }

  function applyFilter_(researchers, filterKey, district) {
    return researchers.filter(function (item) {
      if (district !== 'Todos' && item.distrito !== district) {
        return false;
      }
      if (filterKey === 'todos') {
        return true;
      }
      if (filterKey === 'sem_atualizacao') {
        return item.status_cor === MT.STATUS.ORANGE;
      }
      if (filterKey === 'sem_match') {
        return Number(item.semana || 1) >= 2 && !item.match;
      }
      if (filterKey === 'sem_entrevista') {
        return Number(item.semana || 1) >= 3 && !item.entrevista;
      }
      if (filterKey === 'datas_caidas') {
        return item.status_cor === MT.STATUS.GRAY;
      }
      if (filterKey === 'reservados') {
        return MTUtils.normalizeText(item.resultado).toLowerCase() === 'reservado';
      }
      return true;
    });
  }

  function groupByDistrict_(researchers) {
    var grouped = {};
    researchers.forEach(function (item) {
      var district = item.distrito || 'Sem distrito';
      if (!grouped[district]) {
        grouped[district] = [];
      }
      grouped[district].push(item);
    });
    return grouped;
  }

  function buildDistrictMetrics_(researchers) {
    return [
      { key: 'todos', label: 'Quantidade', icon: '👥', count: researchers.length },
      { key: 'sem_atualizacao', label: 'Sem atualização', icon: '🟠', count: researchers.filter(function (x) { return x.status_cor === MT.STATUS.ORANGE; }).length },
      { key: 'sem_match', label: 'Sem Match', icon: '🧩', count: researchers.filter(function (x) { return Number(x.semana || 1) >= 2 && !x.match; }).length },
      { key: 'sem_entrevista', label: 'Sem Entrevista', icon: '🗣️', count: researchers.filter(function (x) { return Number(x.semana || 1) >= 3 && !x.entrevista; }).length },
      { key: 'datas_caidas', label: 'Datas Caídas', icon: '🩶', count: researchers.filter(function (x) { return x.status_cor === MT.STATUS.GRAY; }).length },
      { key: 'reservados', label: 'Reservados', icon: '📌', count: researchers.filter(function (x) { return MTUtils.normalizeText(x.resultado).toLowerCase() === 'reservado'; }).length }
    ];
  }

  function buildDistrictCardText_(item) {
    var statusIcon = getStatusIcon_(item.status_cor);
    return statusIcon + ' ' + item.nome + ' | Sem ' + (item.semana || 1) + ' | ' + (item.juncao || '-') +
      ' | Última: ' + (item.ultima_atualizacao_data ? (item.ultima_atualizacao_data + ' ' + item.ultima_atualizacao_hora) : 'sem atualização');
  }

  function getStatusIcon_(status) {
    var map = {
      orange: '🟠',
      red: '🔴',
      yellow: '🟡',
      green: '🟢',
      blue: '🔵',
      gray: '⚪'
    };
    return map[status] || '🟢';
  }

  function countByStatus_(researchers) {
    var out = { orange: 0, red: 0, yellow: 0, green: 0, blue: 0, gray: 0 };
    researchers.forEach(function (item) {
      var key = item.status_cor || MT.STATUS.GREEN;
      if (out[key] == null) {
        out[key] = 0;
      }
      out[key]++;
    });
    return out;
  }

  function restoreSelectedIndicator_(sheet, cells, selectedFilter, selectedDistrict) {
    cells.forEach(function (a1) {
      var cell = sheet.getRange(a1);
      var note = cell.getNote();
      if (!note) {
        return;
      }
      var info = JSON.parse(note);
      var selected = info.filter === selectedFilter && info.district === selectedDistrict;
      cell.setValue(selected);
    });
  }

  function getFilterLabelFromKey_(key) {
    var found = MT.ZONE_FILTERS.filter(function (item) {
      return item.key === key;
    })[0];
    return found ? found.label : 'Todos';
  }

  function getFilterKeyFromLabel_(label) {
    var found = MT.ZONE_FILTERS.filter(function (item) {
      return item.label === label;
    })[0];
    return found ? found.key : 'todos';
  }

  function getSelectedDistrict_() {
    return PropertiesService.getDocumentProperties().getProperty(MT.PROPS.SELECTED_DISTRICT) || 'Todos';
  }

  function setSelectedDistrict_(district) {
    PropertiesService.getDocumentProperties().setProperty(MT.PROPS.SELECTED_DISTRICT, district || 'Todos');
  }

  function getZoneFilter_() {
    return PropertiesService.getDocumentProperties().getProperty(MT.PROPS.ZONE_FILTER) || 'todos';
  }

  function getZoneFilterDistrict_() {
    return PropertiesService.getDocumentProperties().getProperty(MT.PROPS.ZONE_FILTER_DISTRICT) || 'Todos';
  }

  function setZoneFilter_(filterKey, district) {
    var props = PropertiesService.getDocumentProperties();
    props.setProperty(MT.PROPS.ZONE_FILTER, filterKey || 'todos');
    props.setProperty(MT.PROPS.ZONE_FILTER_DISTRICT, district || 'Todos');
  }

  return {
    refreshAll: refreshAll,
    refreshHome: refreshHome,
    handleZoneIndicatorToggle: handleZoneIndicatorToggle,
    handleConfigEdit: handleConfigEdit
  };
})();
