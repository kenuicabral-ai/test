var MT_COLORS = {
  APP_BG: '#F6F8FB',
  CARD_BG: '#FFFFFF',
  TEXT: '#1F2937',
  MUTED_TEXT: '#6B7280',
  BORDER: '#E5E7EB',
  DARK: '#111827',
  WHITE: '#FFFFFF',
  GREEN: '#34A853',
  GREEN_SOFT: '#E6F4EA',
  YELLOW: '#FBBC04',
  YELLOW_SOFT: '#FEF7E0',
  RED: '#EA4335',
  RED_SOFT: '#FCE8E6',
  ORANGE: '#F29900',
  ORANGE_SOFT: '#FFF4E5',
  BLUE: '#4285F4',
  BLUE_SOFT: '#E8F0FE',
  GRAY: '#9AA0A6',
  GRAY_SOFT: '#F1F3F4'
};

function mtStatusColor(status) {
  var map = {};
  map[MT_STATUS.NO_UPDATE] = { strong: MT_COLORS.ORANGE, soft: MT_COLORS.ORANGE_SOFT, icon: '🟠' };
  map[MT_STATUS.CRITICAL] = { strong: MT_COLORS.RED, soft: MT_COLORS.RED_SOFT, icon: '🔴' };
  map[MT_STATUS.PENDING] = { strong: MT_COLORS.YELLOW, soft: MT_COLORS.YELLOW_SOFT, icon: '🟡' };
  map[MT_STATUS.OK] = { strong: MT_COLORS.GREEN, soft: MT_COLORS.GREEN_SOFT, icon: '🟢' };
  map[MT_STATUS.BAPTIZED] = { strong: MT_COLORS.BLUE, soft: MT_COLORS.BLUE_SOFT, icon: '🔵' };
  map[MT_STATUS.DATE_DROPPED] = { strong: MT_COLORS.GRAY, soft: MT_COLORS.GRAY_SOFT, icon: '⚪' };
  return map[status] || map[MT_STATUS.PENDING];
}

function mtApplyBaseSheetStyle(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .setBackground(MT_COLORS.DARK)
    .setFontColor(MT_COLORS.WHITE)
    .setFontWeight('bold');
}

function mtPrepareAppSheet(sheet) {
  sheet.clear();
  sheet.getRange('A1:K120').breakApart();
  sheet.setHiddenGridlines(true);
  sheet.setTabColor(MT_COLORS.BLUE);
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);

  for (var column = 1; column <= 6; column++) {
    sheet.setColumnWidth(column, 64);
  }
  sheet.setColumnWidth(1, 72);
  sheet.setColumnWidth(2, 88);
  sheet.setColumnWidth(3, 88);
  sheet.setColumnWidth(4, 88);
  sheet.setColumnWidth(5, 88);
  sheet.setColumnWidth(6, 72);

  for (var row = 1; row <= 60; row++) {
    sheet.setRowHeight(row, 30);
  }
  sheet.getRange('A1:F60')
    .setBackground(MT_COLORS.APP_BG)
    .setFontColor(MT_COLORS.TEXT)
    .setFontFamily('Arial')
    .setVerticalAlignment('middle')
    .setWrap(true);

  try {
    sheet.hideColumns(8, 5);
  } catch (err) {
    mtLog('WARN', 'Colors.mtPrepareAppSheet', err.message);
  }
}

function mtMergeAndStyle(range, value, options) {
  var style = options || {};
  range.breakApart();
  range.merge();
  range
    .setValue(value)
    .setBackground(style.background || MT_COLORS.CARD_BG)
    .setFontColor(style.fontColor || MT_COLORS.TEXT)
    .setFontSize(style.fontSize || 12)
    .setFontWeight(style.fontWeight || 'normal')
    .setHorizontalAlignment(style.horizontalAlignment || 'left')
    .setVerticalAlignment(style.verticalAlignment || 'middle')
    .setWrap(true);

  if (style.border !== false) {
    range.setBorder(true, true, true, true, false, false, style.borderColor || MT_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  }
}

function mtStyleButton(range, label, background) {
  mtMergeAndStyle(range, label, {
    background: background || MT_COLORS.BLUE,
    fontColor: MT_COLORS.WHITE,
    fontSize: 13,
    fontWeight: 'bold',
    horizontalAlignment: 'center',
    borderColor: background || MT_COLORS.BLUE
  });
}

function mtStylePill(range, label, status) {
  var palette = mtStatusColor(status);
  mtMergeAndStyle(range, label, {
    background: palette.soft,
    fontColor: palette.strong,
    fontWeight: 'bold',
    horizontalAlignment: 'center',
    borderColor: palette.strong
  });
}

function mtStyleSectionTitle(range, label) {
  mtMergeAndStyle(range, label, {
    background: MT_COLORS.APP_BG,
    fontColor: MT_COLORS.MUTED_TEXT,
    fontSize: 10,
    fontWeight: 'bold',
    border: false
  });
}
