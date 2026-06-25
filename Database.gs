/**
 * Mission Tracker - Persistência em Base única.
 */
var MTDatabase = (function () {
  function listResearchers_(includeInactive) {
    var sheet = getBaseSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }
    var rows = sheet.getRange(2, 1, lastRow - 1, MT.BASE_COLUMNS.length).getValues();
    var now = MTUtils.now();
    var list = rows.map(function (row, index) {
      var researcher = rowToResearcher_(row, index + 2);
      researcher.semana = MTUtils.getWeekFromBaptismDate(researcher.data_batismal, now);
      var status = MTColors.evaluateStatus(researcher, now);
      researcher.status_cor = status.colorKey;
      researcher.status_label = status.label;
      return researcher;
    });
    if (includeInactive) {
      return list;
    }
    return list.filter(function (item) {
      return item.ativo !== false;
    });
  }

  function getResearcherById(id) {
    if (!id) {
      return null;
    }
    var normalizedId = String(id);
    var researchers = listResearchers_(true);
    for (var i = 0; i < researchers.length; i++) {
      if (String(researchers[i].id) === normalizedId) {
        return researchers[i];
      }
    }
    return null;
  }

  function getCurrentResearcher() {
    var researchers = listResearchers_(false);
    if (!researchers.length) {
      return null;
    }
    var index = getCurrentIndex_();
    if (index >= researchers.length) {
      index = 0;
      setCurrentIndex_(index);
    }
    return researchers[index];
  }

  function moveCurrentIndex(delta) {
    var researchers = listResearchers_(false);
    if (!researchers.length) {
      setCurrentIndex_(0);
      return null;
    }
    var current = getCurrentIndex_();
    var next = (current + delta) % researchers.length;
    if (next < 0) {
      next += researchers.length;
    }
    setCurrentIndex_(next);
    return researchers[next];
  }

  function setCurrentById(id) {
    var researchers = listResearchers_(false);
    var normalizedId = String(id || '');
    for (var i = 0; i < researchers.length; i++) {
      if (String(researchers[i].id) === normalizedId) {
        setCurrentIndex_(i);
        return researchers[i];
      }
    }
    return null;
  }

  function updateResearcherFromRegistro(id, inputValues) {
    var lock = LockService.getDocumentLock();
    lock.waitLock(20000);
    try {
      var researcher = getResearcherById(id);
      if (!researcher) {
        return { updated: false, reason: 'Pesquisador não encontrado.' };
      }

      var old = clone_(researcher);
      researcher.touchdown = MTUtils.toBoolean(inputValues.touchdown);
      researcher.match = MTUtils.toBoolean(inputValues.match);
      researcher.entrevista = MTUtils.toBoolean(inputValues.entrevista);
      researcher.proximo_passo = MTUtils.normalizeText(inputValues.proximo_passo);
      researcher.observacao = MTUtils.normalizeText(inputValues.observacao);
      researcher.resultado = MTUtils.normalizeText(inputValues.resultado) || 'Em Progresso';
      researcher.plano_igreja = hasChurchPlan_(researcher.proximo_passo);
      researcher.semana = MTUtils.getWeekFromBaptismDate(researcher.data_batismal, MTUtils.now());

      var status = MTColors.evaluateStatus(researcher, MTUtils.now());
      researcher.status_cor = status.colorKey;
      researcher.status_label = status.label;

      var changes = diffResearcher_(old, researcher);
      if (!changes.length) {
        return { updated: false, reason: 'Sem alterações.', researcher: researcher, changes: [] };
      }

      var now = MTUtils.now();
      researcher.ultima_atualizacao_data = MTUtils.formatDate(now);
      researcher.ultima_atualizacao_hora = MTUtils.formatTime(now);
      researcher.ultima_atualizacao_ts = now.getTime();
      researcher.atualizado_por = MTUtils.getCurrentUserEmail();

      writeResearcherRow_(researcher);
      MTHistory.logChanges(old, researcher, changes);

      return {
        updated: true,
        researcher: researcher,
        changes: changes
      };
    } finally {
      lock.releaseLock();
    }
  }

  function writeResearcherRow_(researcher) {
    var sheet = getBaseSheet_();
    var row = researcherToRow_(researcher);
    sheet.getRange(researcher._rowNumber, 1, 1, row.length).setValues([row]);
  }

  function getDistricts() {
    var districts = listResearchers_(false).map(function (item) {
      return item.distrito;
    });
    return ['Todos'].concat(MTUtils.uniqueValues(districts).sort());
  }

  function upsertResearchers(researchers) {
    if (!researchers || !researchers.length) {
      return;
    }
    var sheet = getBaseSheet_();
    var existing = listResearchers_(true);
    var byId = {};
    existing.forEach(function (item) {
      byId[String(item.id)] = item;
    });

    var rowsToAppend = [];
    var rowsToUpdate = [];
    researchers.forEach(function (item) {
      var id = String(item.id || '');
      if (!id) {
        return;
      }
      if (byId[id]) {
        item._rowNumber = byId[id]._rowNumber;
        rowsToUpdate.push(item);
      } else {
        rowsToAppend.push(item);
      }
    });

    if (rowsToUpdate.length) {
      rowsToUpdate.forEach(function (item) {
        writeResearcherRow_(normalizeResearcher_(item));
      });
    }

    if (rowsToAppend.length) {
      var startRow = Math.max(2, sheet.getLastRow() + 1);
      var values = rowsToAppend.map(function (item) {
        var normalized = normalizeResearcher_(item);
        normalized._rowNumber = -1;
        return researcherToRow_(normalized);
      });
      sheet.getRange(startRow, 1, values.length, MT.BASE_COLUMNS.length).setValues(values);
    }
  }

  function getBaseSheet_() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(MT.SHEETS.BASE);
    if (!sheet) {
      throw new Error('Aba Base não encontrada.');
    }
    ensureHeaders_(sheet);
    return sheet;
  }

  function ensureHeaders_(sheet) {
    var headerRange = sheet.getRange(1, 1, 1, MT.BASE_COLUMNS.length);
    var current = headerRange.getValues()[0];
    var isEmpty = current.every(function (value) {
      return !String(value).trim();
    });
    if (isEmpty) {
      headerRange.setValues([MT.BASE_COLUMNS]);
      return;
    }
    var different = MT.BASE_COLUMNS.some(function (header, index) {
      return String(current[index]).trim() !== header;
    });
    if (different) {
      headerRange.setValues([MT.BASE_COLUMNS]);
    }
  }

  function rowToResearcher_(row, rowNumber) {
    var obj = {};
    MT.BASE_COLUMNS.forEach(function (key, index) {
      obj[key] = row[index];
    });
    obj = normalizeResearcher_(obj);
    obj._rowNumber = rowNumber;
    return obj;
  }

  function researcherToRow_(researcher) {
    var normalized = normalizeResearcher_(researcher);
    return MT.BASE_COLUMNS.map(function (key) {
      return normalized[key];
    });
  }

  function normalizeResearcher_(researcher) {
    var out = clone_(researcher);
    out.id = MTUtils.normalizeText(out.id);
    out.nome = MTUtils.normalizeText(out.nome);
    out.distrito = MTUtils.normalizeText(out.distrito);
    out.zona = MTUtils.normalizeText(out.zona);
    out.area = MTUtils.normalizeText(out.area);
    out.juncao = MTUtils.normalizeText(out.juncao);
    out.data_batismal = MTUtils.parseDate(out.data_batismal);
    out.semana = Number(out.semana || MTUtils.getWeekFromBaptismDate(out.data_batismal, MTUtils.now()));
    out.touchdown = MTUtils.toBoolean(out.touchdown);
    out.plano_igreja = MTUtils.toBoolean(out.plano_igreja);
    out.match = MTUtils.toBoolean(out.match);
    out.entrevista = MTUtils.toBoolean(out.entrevista);
    out.proximo_passo = MTUtils.normalizeText(out.proximo_passo);
    out.observacao = MTUtils.normalizeText(out.observacao);
    out.resultado = MTUtils.normalizeText(out.resultado) || 'Em Progresso';
    out.status_cor = MTUtils.normalizeText(out.status_cor) || MT.STATUS.GREEN;
    out.status_label = MTUtils.normalizeText(out.status_label) || MT.COLOR_MAP[MT.STATUS.GREEN].label;
    out.ultima_atualizacao_data = MTUtils.normalizeText(out.ultima_atualizacao_data);
    out.ultima_atualizacao_hora = MTUtils.normalizeText(out.ultima_atualizacao_hora);
    out.ultima_atualizacao_ts = Number(out.ultima_atualizacao_ts || 0);
    out.atualizado_por = MTUtils.normalizeText(out.atualizado_por);
    out.ativo = out.ativo === undefined ? true : MTUtils.toBoolean(out.ativo);
    return out;
  }

  function diffResearcher_(before, after) {
    var fields = ['touchdown', 'plano_igreja', 'match', 'entrevista', 'proximo_passo', 'observacao', 'resultado', 'status_cor', 'status_label'];
    var changes = [];
    fields.forEach(function (field) {
      var oldValue = before[field];
      var newValue = after[field];
      if (String(oldValue) !== String(newValue)) {
        changes.push({ field: field, oldValue: oldValue, newValue: newValue });
      }
    });
    return changes;
  }

  function hasChurchPlan_(nextStepText) {
    var text = MTUtils.normalizeText(nextStepText).toLowerCase();
    return /igreja|sacramental|reuni[aã]o|capela/.test(text);
  }

  function getCurrentIndex_() {
    var props = PropertiesService.getDocumentProperties();
    var value = Number(props.getProperty(MT.PROPS.CURRENT_INDEX) || 0);
    return isNaN(value) ? 0 : value;
  }

  function setCurrentIndex_(index) {
    PropertiesService.getDocumentProperties().setProperty(MT.PROPS.CURRENT_INDEX, String(index));
  }

  function clone_(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function getAllResearchers() {
    return listResearchers_(false);
  }

  return {
    getAllResearchers: getAllResearchers,
    getResearcherById: getResearcherById,
    getCurrentResearcher: getCurrentResearcher,
    moveCurrentIndex: moveCurrentIndex,
    setCurrentById: setCurrentById,
    updateResearcherFromRegistro: updateResearcherFromRegistro,
    getDistricts: getDistricts,
    upsertResearchers: upsertResearchers
  };
})();
