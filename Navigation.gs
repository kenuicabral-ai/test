/**
 * Mission Tracker - Navegação do card de Registro.
 */
var MTNavigation = (function () {
  function renderCurrentCard() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MT.SHEETS.REGISTRO);
    if (!sheet) {
      return;
    }

    var researcher = MTDatabase.getCurrentResearcher();
    if (!researcher) {
      renderEmptyState_(sheet);
      return;
    }

    renderResearcher_(sheet, researcher);
  }

  function handleRegistroEdit(e) {
    var range = e.range;
    var a1 = range.getA1Notation();
    if (a1 === MT.REGISTRO.ACTION_CELL) {
      handleActionSelection_(e);
      return;
    }

    if (isRegistroInputEdit_(range)) {
      saveCurrentCard_(false);
    }
  }

  function handleHomeEdit(e) {
    if (e.range.getA1Notation() !== MT.HOME.START_CELL) {
      return;
    }
    var value = MTUtils.normalizeText(e.value);
    if (value !== MT.ACTIONS.START) {
      return;
    }
    goToRegistro_();
    e.range.setValue(MT.APP.ACTION_EMPTY);
  }

  function goToRegistro_() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(MT.SHEETS.REGISTRO);
    if (sheet) {
      ss.setActiveSheet(sheet);
    }
  }

  function handleActionSelection_(e) {
    var action = MTUtils.normalizeText(e.value);
    if (!action || action === MT.APP.ACTION_EMPTY) {
      return;
    }

    if (action === MT.ACTIONS.PREV) {
      saveCurrentCard_(true);
      MTDatabase.moveCurrentIndex(-1);
      renderCurrentCard();
    } else if (action === MT.ACTIONS.NEXT) {
      saveCurrentCard_(true);
      MTDatabase.moveCurrentIndex(1);
      renderCurrentCard();
    } else if (action === MT.ACTIONS.SAVE) {
      saveCurrentCard_(false);
      renderCurrentCard();
    }

    e.range.setValue(MT.APP.ACTION_EMPTY);
  }

  function saveCurrentCard_(silentWhenNoChanges) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MT.SHEETS.REGISTRO);
    if (!sheet) {
      return;
    }
    var id = MTUtils.normalizeText(sheet.getRange(MT.REGISTRO.ID_CELL).getValue());
    if (!id) {
      return;
    }
    var input = readRegistroInput_(sheet);
    var result = MTDatabase.updateResearcherFromRegistro(id, input);
    if (result && result.updated) {
      MTDashboard.refreshAll();
      return;
    }
    if (!silentWhenNoChanges && result && result.reason) {
      MTUtils.writeLog('INFO', result.reason, { id: id });
    }
  }

  function readRegistroInput_(sheet) {
    return {
      touchdown: sheet.getRange(MT.REGISTRO.TOUCHDOWN_CELL).getValue(),
      match: sheet.getRange(MT.REGISTRO.MATCH_CELL).getValue(),
      entrevista: sheet.getRange(MT.REGISTRO.ENTREVISTA_CELL).getValue(),
      proximo_passo: sheet.getRange(MT.REGISTRO.PROXIMO_PASSO_CELL).getValue(),
      observacao: sheet.getRange(MT.REGISTRO.OBSERVACAO_CELL).getValue(),
      resultado: sheet.getRange(MT.REGISTRO.RESULTADO_CELL).getValue()
    };
  }

  function renderResearcher_(sheet, researcher) {
    var statusPalette = MT.COLOR_MAP[researcher.status_cor] || MT.COLOR_MAP[MT.STATUS.GREEN];
    sheet.getRange(MT.REGISTRO.ID_CELL).setValue(researcher.id).setFontColor('#FFFFFF');
    sheet.getRange(MT.REGISTRO.NAME_CELL + ':E4').merge().setValue(researcher.nome || 'Sem nome');
    sheet.getRange(MT.REGISTRO.WEEK_CELL + ':E6').merge().setValue('Semana ' + (researcher.semana || 1));
    sheet.getRange(MT.REGISTRO.AREA_CELL + ':E7').merge().setValue('Área: ' + (researcher.area || '-'));
    sheet.getRange(MT.REGISTRO.JUNCAO_CELL + ':E8').merge().setValue('Junção: ' + (researcher.juncao || '-'));
    sheet.getRange(MT.REGISTRO.DATE_CELL + ':E9').merge().setValue('Data Batismal: ' + (MTUtils.formatDate(researcher.data_batismal) || '-'));
    sheet.getRange('B11:E11').setBackground(statusPalette.bg).setFontColor(statusPalette.fg).setValue('STATUS - ' + (researcher.status_label || 'Em dia'));

    sheet.getRange(MT.REGISTRO.TOUCHDOWN_CELL).setValue(!!researcher.touchdown);
    sheet.getRange(MT.REGISTRO.PLANO_IGREJA_CELL).setValue(researcher.plano_igreja ? '✅ Definido' : '⏳ Pendente');
    sheet.getRange(MT.REGISTRO.MATCH_CELL).setValue(!!researcher.match);
    sheet.getRange(MT.REGISTRO.ENTREVISTA_CELL).setValue(!!researcher.entrevista);
    sheet.getRange(MT.REGISTRO.PROXIMO_PASSO_CELL).setValue(researcher.proximo_passo || '');
    sheet.getRange(MT.REGISTRO.OBSERVACAO_CELL).setValue(researcher.observacao || '');
    var resultado = researcher.resultado || 'Em Progresso';
    if (MT.RESULT_OPTIONS.indexOf(resultado) === -1) {
      resultado = 'Em Progresso';
    }
    sheet.getRange(MT.REGISTRO.RESULTADO_CELL).setValue(resultado);
    sheet.getRange(MT.REGISTRO.LAST_UPDATE_CELL + ':E32').merge().setValue(
      'Última atualização: ' + buildLastUpdateText_(researcher)
    );

    configureWeekVisibility_(sheet, Number(researcher.semana || 1));
  }

  function renderEmptyState_(sheet) {
    sheet.showRows(MT.REGISTRO.STATUS_ROWS_START, MT.REGISTRO.STATUS_ROWS_COUNT);
    sheet.getRange(MT.REGISTRO.CARD_RANGE).clearContent();
    sheet.getRange('B2:E2').merge().setValue('📱 Registro Mission Tracker');
    sheet.getRange('B5:E7').merge().setValue('Nenhum pesquisador ativo na Base.').setHorizontalAlignment('center').setFontWeight('bold');
  }

  function configureWeekVisibility_(sheet, week) {
    sheet.showRows(MT.REGISTRO.STATUS_ROWS_START, MT.REGISTRO.STATUS_ROWS_COUNT);
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
  }

  function buildLastUpdateText_(researcher) {
    if (!researcher.ultima_atualizacao_ts) {
      return 'sem registro';
    }
    var stamp = new Date(Number(researcher.ultima_atualizacao_ts));
    return MTUtils.formatDateTime(stamp) + ' por ' + (researcher.atualizado_por || 'usuário');
  }

  function isRegistroInputEdit_(range) {
    var a1 = range.getA1Notation();
    if (a1 === MT.REGISTRO.TOUCHDOWN_CELL ||
        a1 === MT.REGISTRO.MATCH_CELL ||
        a1 === MT.REGISTRO.ENTREVISTA_CELL ||
        a1 === MT.REGISTRO.RESULTADO_CELL) {
      return true;
    }
    return intersects_(a1, 'B19:E20') || intersects_(a1, 'B23:E25');
  }

  function intersects_(editedA1, targetA1) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MT.SHEETS.REGISTRO);
    var edited = sheet.getRange(editedA1);
    var target = sheet.getRange(targetA1);
    return !(
      edited.getLastRow() < target.getRow() ||
      edited.getRow() > target.getLastRow() ||
      edited.getLastColumn() < target.getColumn() ||
      edited.getColumn() > target.getLastColumn()
    );
  }

  return {
    renderCurrentCard: renderCurrentCard,
    handleRegistroEdit: handleRegistroEdit,
    handleHomeEdit: handleHomeEdit
  };
})();
