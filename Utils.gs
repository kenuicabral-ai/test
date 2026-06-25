function Utils_getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function Utils_getSheet_(name) {
  return Utils_getSpreadsheet_().getSheetByName(name);
}

function Utils_getOrCreateSheet_(name) {
  var spreadsheet = Utils_getSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(name);
  return sheet || spreadsheet.insertSheet(name);
}

function Utils_now_() {
  return new Date();
}

function Utils_formatDate_(date, pattern) {
  if (!date) {
    return '';
  }
  var parsed = Utils_toDate_(date);
  if (!parsed) {
    return '';
  }
  return Utilities.formatDate(parsed, MT_APP.timeZone, pattern || 'dd/MM/yyyy');
}

function Utils_formatTime_(date) {
  return Utils_formatDate_(date, 'HH:mm');
}

function Utils_toDate_(value) {
  if (!value) {
    return null;
  }
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function Utils_daysBetween_(startDate, endDate) {
  var start = Utils_startOfDay_(Utils_toDate_(startDate));
  var end = Utils_startOfDay_(Utils_toDate_(endDate));
  if (!start || !end) {
    return null;
  }
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function Utils_hoursBetween_(startDate, endDate) {
  var start = Utils_toDate_(startDate);
  var end = Utils_toDate_(endDate);
  if (!start || !end) {
    return null;
  }
  return (end.getTime() - start.getTime()) / 3600000;
}

function Utils_startOfDay_(date) {
  if (!date) {
    return null;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function Utils_isChecked_(value) {
  return value === true || String(value).toUpperCase() === 'TRUE' || String(value).toUpperCase() === 'SIM';
}

function Utils_normalizeText_(value) {
  return String(value || '').trim();
}

function Utils_getActiveUserEmail_() {
  try {
    return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'usuário não identificado';
  } catch (error) {
    return 'usuário não identificado';
  }
}

function Utils_headerMap_(headers) {
  return headers.reduce(function (map, header, index) {
    map[header] = index;
    return map;
  }, {});
}

function Utils_clearSheet_(sheet) {
  try {
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  } catch (error) {
    // Some protected sheets may reject breakApart; the next operations still keep the app usable.
  }
  sheet.clear();
  sheet.clearConditionalFormatRules();
  sheet.showRows(1, sheet.getMaxRows());
  sheet.showColumns(1, sheet.getMaxColumns());
}

function Utils_setColumnWidths_(sheet, widths) {
  Object.keys(widths).forEach(function (column) {
    sheet.setColumnWidth(Number(column), widths[column]);
  });
}

function Utils_setRowHeights_(sheet, heights) {
  Object.keys(heights).forEach(function (row) {
    sheet.setRowHeight(Number(row), heights[row]);
  });
}

function Utils_setCheckbox_(range) {
  range.insertCheckboxes();
  range.setValue(false);
}

function Utils_setDropdown_(range, values) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

function Utils_protectSheet_(sheet, description, warningOnly) {
  try {
    var protection = sheet.protect().setDescription(description || 'Mission Tracker');
    protection.setWarningOnly(Boolean(warningOnly));
    if (!warningOnly && protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
    return protection;
  } catch (error) {
    Utils_log_('WARN', 'Utils_protectSheet_', 'Não foi possível proteger a aba.', error.message);
    return null;
  }
}

function Utils_protectRange_(range, description, warningOnly) {
  try {
    var protection = range.protect().setDescription(description || 'Mission Tracker');
    protection.setWarningOnly(Boolean(warningOnly));
    return protection;
  } catch (error) {
    Utils_log_('WARN', 'Utils_protectRange_', 'Não foi possível proteger o intervalo.', error.message);
    return null;
  }
}

function Utils_log_(level, source, message, details) {
  try {
    var sheet = Utils_getOrCreateSheet_(MT_SHEETS.logs);
    Utils_ensureHeaders_(sheet, MT_LOG_HEADERS);
    var now = Utils_now_();
    sheet.appendRow([
      Utils_formatDate_(now),
      Utils_formatTime_(now),
      level,
      source,
      message,
      details || ''
    ]);
  } catch (error) {
    console.log([level, source, message, details || '', error.message].join(' | '));
  }
}

function Utils_ensureHeaders_(sheet, headers) {
  var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var needsUpdate = headers.some(function (header, index) {
    return current[index] !== header;
  });
  if (needsUpdate) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}

function Utils_batchUpdate_(requests) {
  if (!requests || !requests.length) {
    return;
  }
  try {
    Sheets.Spreadsheets.batchUpdate({ requests: requests }, Utils_getSpreadsheet_().getId());
  } catch (error) {
    Utils_log_('WARN', 'Utils_batchUpdate_', 'batchUpdate indisponível; alterações visuais básicas foram mantidas.', error.message);
  }
}

function Utils_sheetId_(sheet) {
  return sheet.getSheetId();
}

function Utils_merge_(sheet, a1Notation) {
  var range = sheet.getRange(a1Notation);
  try {
    range.breakApart();
  } catch (error) {
    // The range may not be merged yet.
  }
  range.merge();
  return range;
}

function Utils_resetActionCheckbox_(sheet, a1Notation) {
  var range = sheet.getRange(a1Notation);
  if (Utils_isChecked_(range.getValue())) {
    range.setValue(false);
  }
}

function Utils_valuesEqual_(oldValue, newValue) {
  if (Object.prototype.toString.call(oldValue) === '[object Date]' || Object.prototype.toString.call(newValue) === '[object Date]') {
    var oldDate = Utils_toDate_(oldValue);
    var newDate = Utils_toDate_(newValue);
    return oldDate && newDate && oldDate.getTime() === newDate.getTime();
  }
  return String(oldValue || '') === String(newValue || '');
}
