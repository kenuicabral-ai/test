/**
 * Mission Tracker - Setup estrutural.
 */
var MTConfig = (function () {
  function setup() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets_(ss);
    setupBaseSheet_(ss.getSheetByName(MT.SHEETS.BASE));
    setupHistorySheet_(ss.getSheetByName(MT.SHEETS.HISTORICO));
    setupLogsSheet_(ss.getSheetByName(MT.SHEETS.LOGS));
    setupEmailsSheet_(ss.getSheetByName(MT.SHEETS.EMAILS));
    setupSistemaSheet_(ss.getSheetByName(MT.SHEETS.SISTEMA));
    setupCacheSheet_(ss.getSheetByName(MT.SHEETS.CACHE));
    setupHomeSheet_(ss.getSheetByName(MT.SHEETS.HOME));
    setupRegistroSheet_(ss.getSheetByName(MT.SHEETS.REGISTRO));
    setupDistritoDashboardSheet_(ss.getSheetByName(MT.SHEETS.DASH_DISTRITO));
    setupZonaDashboardSheet_(ss.getSheetByName(MT.SHEETS.DASH_ZONA));
    setupConfigSheet_(ss.getSheetByName(MT.SHEETS.CONFIG));
    setupDefaultProperties_();
    syncConfigFromProperties_(ss.getSheetByName(MT.SHEETS.CONFIG));
    hideTechnicalSheets_(ss);
    protectTechnicalSheets_(ss);
    protectHistorySheet_(ss.getSheetByName(MT.SHEETS.HISTORICO));
  }

  function ensureSheets_(ss) {
    var all = MT.VISIBLE_SHEETS.concat(MT.HIDDEN_SHEETS);
    var existing = {};
    ss.getSheets().forEach(function (sheet) {
      existing[sheet.getName()] = true;
    });
    all.forEach(function (name) {
      if (!existing[name]) {
        ss.insertSheet(name);
      }
    });
  }

  function setupBaseSheet_(sheet) {
    ensureHeader_(sheet, MT.BASE_COLUMNS);
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, MT.BASE_COLUMNS.length, 140);
  }

  function setupHistorySheet_(sheet) {
    var headers = ['data', 'hora', 'pesquisador_id', 'pesquisador_nome', 'campo', 'valor_antigo', 'valor_novo', 'usuario'];
    ensureHeader_(sheet, headers);
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, headers.length, 150);
  }

  function setupLogsSheet_(sheet) {
    var headers = ['data', 'hora', 'nivel', 'mensagem', 'metadata', 'usuario'];
    ensureHeader_(sheet, headers);
    sheet.setFrozenRows(1);
  }

  function setupEmailsSheet_(sheet) {
    var headers = ['status', 'tipo', 'destinatario', 'assunto', 'payload', 'criado_em'];
    ensureHeader_(sheet, headers);
    sheet.setFrozenRows(1);
  }

  function setupSistemaSheet_(sheet) {
    var headers = ['chave', 'valor', 'atualizado_em'];
    ensureHeader_(sheet, headers);
    sheet.setFrozenRows(1);
  }

  function setupCacheSheet_(sheet) {
    var headers = ['chave', 'json', 'atualizado_em'];
    ensureHeader_(sheet, headers);
    sheet.setFrozenRows(1);
  }

  function ensureHeader_(sheet, headers) {
    var range = sheet.getRange(1, 1, 1, headers.length);
    var current = range.getValues()[0];
    var isSame = headers.every(function (header, index) {
      return String(current[index] || '') === String(header);
    });
    if (!isSame) {
      range.setValues([headers]);
    }
  }

  function setupHomeSheet_(sheet) {
    sheet.clear();
    sheet.setHiddenGridlines(true);
    sheet.setColumnWidths(2, 4, 120);
    for (var row = 1; row <= 20; row++) {
      sheet.setRowHeight(row, 36);
    }
    sheet.getRange('B2:E2').merge().setValue('Mission Tracker').setFontSize(20).setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange('B3:E3').merge().setValue('Acompanhamento inteligente de pesquisadores').setFontColor('#4B5563').setHorizontalAlignment('center');
    sheet.getRange('B5:E12').setBackground('#F9FAFB').setBorder(true, true, true, true, true, true, '#E5E7EB', SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange('B6:E6').merge().setValue('Hoje existem').setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange('B14:E14').merge();
    sheet.getRange(MT.HOME.START_CELL).setValue(MT.APP.ACTION_EMPTY).setHorizontalAlignment('center').setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#2563EB');

    var startRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([MT.APP.ACTION_EMPTY, MT.ACTIONS.START], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(MT.HOME.START_CELL).setDataValidation(startRule);
  }

  function setupRegistroSheet_(sheet) {
    sheet.clear();
    sheet.setHiddenGridlines(true);
    sheet.setColumnWidths(2, 4, 120);
    for (var row = 1; row <= 40; row++) {
      sheet.setRowHeight(row, 32);
    }

    sheet.getRange('B2:E2').merge().setValue('📱 Registro Mission Tracker').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange('B4:E4').merge().setFontSize(18).setFontWeight('bold').setHorizontalAlignment('left');
    sheet.getRange('B6:E9').setBackground('#F9FAFB').setBorder(true, true, true, true, true, true, '#E5E7EB', SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange('B11:E11').merge().setValue('STATUS').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#EEF2FF');
    sheet.getRange('B13:B16').setValues([['TouchDown'], ['Plano Igreja'], ['Match'], ['Entrevista']]).setFontWeight('bold');
    sheet.getRange('B18:E18').merge().setValue('Próximo Passo').setFontWeight('bold').setBackground('#EEF2FF');
    sheet.getRange('B19:E20').merge().setWrap(true).setVerticalAlignment('top').setBackground('#FFFFFF').setBorder(true, true, true, true, true, true, '#E5E7EB', SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange('B22:E22').merge().setValue('Observação').setFontWeight('bold').setBackground('#EEF2FF');
    sheet.getRange('B23:E25').merge().setWrap(true).setVerticalAlignment('top').setBackground('#FFFFFF').setBorder(true, true, true, true, true, true, '#E5E7EB', SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange('B27:B27').setValue('Resultado').setFontWeight('bold');
    sheet.getRange('B29:E29').merge().setFontColor('#6B7280');
    sheet.getRange('B30:E30').merge().setBackground('#DBEAFE').setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange('B32:E32').merge().setFontColor('#6B7280');

    sheet.getRange('C13').insertCheckboxes();
    sheet.getRange('C15').insertCheckboxes();
    sheet.getRange('C16').insertCheckboxes();
    sheet.getRange('C14').setValue('Automático').setHorizontalAlignment('left').setFontColor('#6B7280');
    var resultRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(MT.RESULT_OPTIONS, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(MT.REGISTRO.RESULTADO_CELL).setDataValidation(resultRule);

    var actionRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([MT.APP.ACTION_EMPTY, MT.ACTIONS.PREV, MT.ACTIONS.SAVE, MT.ACTIONS.NEXT], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(MT.REGISTRO.ACTION_CELL).setDataValidation(actionRule).setValue(MT.APP.ACTION_EMPTY);
  }

  function setupDistritoDashboardSheet_(sheet) {
    sheet.clear();
    sheet.setHiddenGridlines(true);
    sheet.setColumnWidths(2, 4, 120);
    for (var row = 1; row <= 300; row++) {
      sheet.setRowHeight(row, 30);
    }
    sheet.getRange('B2:E2').merge().setValue('🚨 Dashboard Distrito').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  }

  function setupZonaDashboardSheet_(sheet) {
    sheet.clear();
    sheet.setHiddenGridlines(true);
    sheet.setColumnWidths(2, 5, 110);
    for (var row = 1; row <= 500; row++) {
      sheet.setRowHeight(row, 30);
    }
    sheet.getRange('B2:F2').merge().setValue('📊 Dashboard Zona').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  }

  function setupConfigSheet_(sheet) {
    sheet.clear();
    sheet.setHiddenGridlines(true);
    sheet.setColumnWidths(2, 3, 170);

    sheet.getRange('B2:D2').merge().setValue('⚙ Configuração').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange('B3').setValue('Distrito padrão');
    sheet.getRange('B4').setValue('Filtro Dashboard Zona');
    sheet.getRange('B7').setValue('Ação rápida');

    var districtRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Todos'], true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(MT.CONFIG.DISTRICT_CELL).setDataValidation(districtRule).setValue('Todos');

    var filterValues = MT.ZONE_FILTERS.map(function (item) {
      return item.label;
    });
    var filterRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(filterValues, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(MT.CONFIG.FILTER_CELL).setDataValidation(filterRule).setValue('Todos');

    var actionRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([MT.APP.ACTION_EMPTY, MT.ACTIONS.REFRESH], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(MT.CONFIG.ACTION_CELL).setDataValidation(actionRule).setValue(MT.APP.ACTION_EMPTY);
  }

  function setupDefaultProperties_() {
    var props = PropertiesService.getDocumentProperties();
    if (props.getProperty(MT.PROPS.CURRENT_INDEX) == null) {
      props.setProperty(MT.PROPS.CURRENT_INDEX, '0');
    }
    if (props.getProperty(MT.PROPS.SELECTED_DISTRICT) == null) {
      props.setProperty(MT.PROPS.SELECTED_DISTRICT, 'Todos');
    }
    if (props.getProperty(MT.PROPS.ZONE_FILTER) == null) {
      props.setProperty(MT.PROPS.ZONE_FILTER, 'todos');
    }
    if (props.getProperty(MT.PROPS.ZONE_FILTER_DISTRICT) == null) {
      props.setProperty(MT.PROPS.ZONE_FILTER_DISTRICT, 'Todos');
    }
  }

  function syncConfigFromProperties_(configSheet) {
    var props = PropertiesService.getDocumentProperties();
    var district = props.getProperty(MT.PROPS.SELECTED_DISTRICT) || 'Todos';
    var filterKey = props.getProperty(MT.PROPS.ZONE_FILTER) || 'todos';
    var filterItem = MT.ZONE_FILTERS.filter(function (item) {
      return item.key === filterKey;
    })[0];
    configSheet.getRange(MT.CONFIG.DISTRICT_CELL).setValue(district);
    configSheet.getRange(MT.CONFIG.FILTER_CELL).setValue(filterItem ? filterItem.label : 'Todos');
  }

  function hideTechnicalSheets_(ss) {
    MT.HIDDEN_SHEETS.forEach(function (name) {
      var sheet = ss.getSheetByName(name);
      if (sheet) {
        sheet.hideSheet();
      }
    });
  }

  function protectHistorySheet_(sheet) {
    try {
      var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      var alreadyProtected = protections.some(function (protection) {
        return protection.getDescription() === 'Histórico imutável';
      });
      if (alreadyProtected) {
        return;
      }
      var protection = sheet.protect();
      protection.setDescription('Histórico imutável');
      protection.setWarningOnly(true);
    } catch (err) {
      MTUtils.writeLog('WARN', 'Falha ao proteger histórico', { error: String(err) });
    }
  }

  function protectTechnicalSheets_(ss) {
    MT.HIDDEN_SHEETS.forEach(function (name) {
      var sheet = ss.getSheetByName(name);
      if (!sheet || name === MT.SHEETS.HISTORICO) {
        return;
      }
      try {
        var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
        var expected = 'Sistema protegido: ' + name;
        var exists = protections.some(function (protection) {
          return protection.getDescription() === expected;
        });
        if (!exists) {
          var protection = sheet.protect();
          protection.setDescription(expected);
          protection.setWarningOnly(true);
        }
      } catch (err) {
        MTUtils.writeLog('WARN', 'Falha ao proteger aba técnica', { sheet: name, error: String(err) });
      }
    });
  }

  return {
    setup: setup
  };
})();
