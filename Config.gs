var MT = MT || {};

MT.Config = (function () {
  function setup() {
    MT.VISIBLE_SHEETS.forEach(function (name) {
      MT.Utils.showSheet(name);
    });
    MT.Database.ensure();
    render();
    protectHiddenSheets();
  }

  function render() {
    var previous = readExistingConfig();
    var sheetObject = MT.Utils.resetSheet(MT.SHEETS.CONFIG);
    MT.Colors.applyAppSheetStyle(sheetObject);
    MT.Utils.ensureRows(sheetObject, 35);
    sheetObject.setColumnWidth(1, 145);
    sheetObject.setColumnWidth(2, 190);
    sheetObject.setColumnWidth(3, 40);
    sheetObject.setRowHeights(1, 35, 30);

    sheetObject.getRange('A2:C2').merge().setValue('⚙ Configuração');
    MT.Colors.applyTitle(sheetObject.getRange('A2:C2'));
    sheetObject.getRange('A3:C3').merge().setValue('Parâmetros do app e cadastro controlado de pesquisadores.');
    MT.Colors.applySubtitle(sheetObject.getRange('A3:C3'));

    sheetObject.getRange('A5:A9').setValues([
      ['Distrito'],
      ['Zona'],
      ['Email LD'],
      ['Email LZ'],
      ['Dias sem atualização']
    ]);
    sheetObject.getRange('B5:B9').setValues([
      [previous.district],
      [previous.zone],
      [previous.ldEmail],
      [previous.lzEmail],
      [previous.updateLimitDays]
    ]);
    MT.Colors.applyCard(sheetObject.getRange('A5:B9'), MT.COLORS.CARD_BG);
    MT.Colors.applyInput(sheetObject.getRange('B5:B9'));

    sheetObject.getRange('A12:C12').merge().setValue('Novo pesquisador');
    sheetObject.getRange('A12:C12').setFontSize(16).setFontWeight('bold');
    sheetObject.getRange('A14:A20').setValues([
      ['Nome'],
      ['Distrito'],
      ['Zona'],
      ['Área'],
      ['Semana'],
      ['Data Batismal'],
      ['Próximo Passo']
    ]);
    sheetObject.getRange('B14:B20').clearContent();
    sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.DISTRICT).setValue(sheetObject.getRange(MT.CONFIG.CELLS.DISTRICT).getValue());
    sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.ZONE).setValue(sheetObject.getRange(MT.CONFIG.CELLS.ZONE).getValue());
    sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.WEEK).setValue('Semana 1');
    MT.Colors.applyCard(sheetObject.getRange('A14:B20'), MT.COLORS.CARD_BG);
    MT.Colors.applyInput(sheetObject.getRange('B14:B20'));
    MT.Utils.setValidationList(sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.WEEK), MT.WEEKS);
    sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.BAPTISM_DATE).setNumberFormat('dd/MM/yyyy');

    sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.ADD_BUTTON).insertCheckboxes().setValue(false);
    sheetObject.getRange('C22').setValue('ADICIONAR PESQUISADOR');
    MT.Colors.applyButton(sheetObject.getRange('B22:C22'), MT.COLORS.GREEN);

    sheetObject.getRange(MT.CONFIG.CELLS.STATUS + ':C27').merge().setValue('Pronto para usar.');
    MT.Colors.applySubtitle(sheetObject.getRange(MT.CONFIG.CELLS.STATUS + ':C27'));
  }

  function readExistingConfig() {
    return {
      district: readOrDefault(MT.CONFIG.CELLS.DISTRICT, 'Distrito 3'),
      zone: readOrDefault(MT.CONFIG.CELLS.ZONE, 'Zona 1'),
      ldEmail: readOrDefault(MT.CONFIG.CELLS.LD_EMAIL, ''),
      lzEmail: readOrDefault(MT.CONFIG.CELLS.LZ_EMAIL, ''),
      updateLimitDays: readOrDefault(MT.CONFIG.CELLS.UPDATE_LIMIT_DAYS, MT.CONFIG.DEFAULT_UPDATE_LIMIT_DAYS)
    };
  }

  function readOrDefault(a1, fallback) {
    var existing = MT.Utils.sheet(MT.SHEETS.CONFIG);
    if (!existing) return fallback;
    var value = existing.getRange(a1).getValue();
    return MT.Utils.isBlank(value) ? fallback : value;
  }

  function handleEdit(e) {
    var a1 = e.range.getA1Notation();
    if (a1 === MT.CONFIG.NEW_RESEARCHER.ADD_BUTTON && e.value === 'TRUE') {
      e.range.setValue(false);
      addResearcherFromForm();
      return true;
    }
    if ([
      MT.CONFIG.CELLS.DISTRICT,
      MT.CONFIG.CELLS.ZONE,
      MT.CONFIG.CELLS.UPDATE_LIMIT_DAYS
    ].indexOf(a1) >= 0) {
      MT.Dashboard.refreshAll();
      return true;
    }
    return false;
  }

  function addResearcherFromForm() {
    var sheetObject = MT.Utils.sheet(MT.SHEETS.CONFIG);
    var input = {
      'Nome': sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.NAME).getValue(),
      'Distrito': sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.DISTRICT).getValue(),
      'Zona': sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.ZONE).getValue(),
      'Área': sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.AREA).getValue(),
      'Semana': sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.WEEK).getValue(),
      'Data Batismal': sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.BAPTISM_DATE).getValue(),
      'Próximo Passo': sheetObject.getRange(MT.CONFIG.NEW_RESEARCHER.NEXT_STEP).getValue()
    };
    var validation = validateResearcher(input);
    if (!validation.ok) {
      setStatus(validation.message, MT.COLORS.RED);
      return;
    }
    var result = MT.Database.appendResearcher(input, MT.Utils.currentUser());
    if (!result.created) {
      setStatus('Este pesquisador já existe na Base. Nenhuma linha foi duplicada.', MT.COLORS.ORANGE);
      MT.Database.setCurrentRecordId(result.record['ID']);
      MT.Dashboard.renderRegistration(result.record['ID']);
      return;
    }
    clearNewResearcherForm(sheetObject);
    MT.Database.setCurrentRecordId(result.record['ID']);
    MT.Dashboard.refreshAll();
    setStatus('Pesquisador adicionado com sucesso.', MT.COLORS.GREEN);
  }

  function validateResearcher(input) {
    if (MT.Utils.isBlank(input['Nome'])) {
      return { ok: false, message: 'Informe o nome do pesquisador.' };
    }
    if (MT.Utils.isBlank(input['Distrito'])) {
      return { ok: false, message: 'Informe o distrito.' };
    }
    if (MT.Utils.isBlank(input['Área'])) {
      return { ok: false, message: 'Informe a área.' };
    }
    if (!MT.Utils.toDate(input['Data Batismal'])) {
      return { ok: false, message: 'Informe uma data batismal válida.' };
    }
    return { ok: true, message: '' };
  }

  function clearNewResearcherForm(sheetObject) {
    sheetObject.getRangeList([
      MT.CONFIG.NEW_RESEARCHER.NAME,
      MT.CONFIG.NEW_RESEARCHER.AREA,
      MT.CONFIG.NEW_RESEARCHER.BAPTISM_DATE,
      MT.CONFIG.NEW_RESEARCHER.NEXT_STEP
    ]).clearContent();
  }

  function setStatus(message, color) {
    var sheetObject = MT.Utils.sheet(MT.SHEETS.CONFIG);
    sheetObject.getRange(MT.CONFIG.CELLS.STATUS + ':C27').merge().setValue(message);
    sheetObject.getRange(MT.CONFIG.CELLS.STATUS + ':C27').setFontColor(color || MT.COLORS.MUTED);
    MT.Utils.toast(message);
  }

  function protectHiddenSheets() {
    MT.HIDDEN_SHEETS.forEach(function (name) {
      try {
        MT.Utils.protectSheet(MT.Utils.ensureSheet(name), 'Mission Tracker - ' + name + ' protegido');
      } catch (error) {
        MT.Utils.log('WARN', 'Config.protectHiddenSheets', 'Falha ao proteger ' + name, error.message);
      }
    });
  }

  function protectRegistration() {
    var sheetObject = MT.Utils.sheet(MT.SHEETS.REGISTRATION);
    if (!sheetObject) return;
    try {
      var protections = sheetObject.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      protections.forEach(function (protection) {
        if (protection.getDescription() === 'Mission Tracker - Registro controlado') protection.remove();
      });
      var editableRanges = [
        sheetObject.getRange(MT.REGISTRATION.TOUCHDOWN),
        sheetObject.getRange(MT.REGISTRATION.CHURCH_PLAN),
        sheetObject.getRange(MT.REGISTRATION.MATCH),
        sheetObject.getRange(MT.REGISTRATION.INTERVIEW),
        sheetObject.getRange(MT.REGISTRATION.NEXT_STEP),
        sheetObject.getRange(MT.REGISTRATION.OBSERVATION),
        sheetObject.getRange(MT.REGISTRATION.RESULT),
        sheetObject.getRange(MT.REGISTRATION.PREVIOUS_BUTTON),
        sheetObject.getRange(MT.REGISTRATION.SAVE_BUTTON),
        sheetObject.getRange(MT.REGISTRATION.NEXT_BUTTON)
      ];
      var protection = sheetObject.protect().setDescription('Mission Tracker - Registro controlado');
      protection.setWarningOnly(false);
      protection.setUnprotectedRanges(editableRanges);
    } catch (error) {
      MT.Utils.log('WARN', 'Config.protectRegistration', 'Falha ao proteger Registro', error.message);
    }
  }

  return {
    setup: setup,
    render: render,
    handleEdit: handleEdit,
    addResearcherFromForm: addResearcherFromForm,
    protectHiddenSheets: protectHiddenSheets,
    protectRegistration: protectRegistration
  };
})();
