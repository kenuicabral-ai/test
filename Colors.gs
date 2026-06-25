var MT = MT || {};

MT.COLORS = {
  BACKGROUND: '#f6f8fb',
  CARD: '#ffffff',
  TEXT: '#1f2937',
  MUTED_TEXT: '#6b7280',
  BORDER: '#d9e2ec',
  GREEN: '#34a853',
  YELLOW: '#fbbc04',
  RED: '#ea4335',
  ORANGE: '#f29900',
  BLUE: '#4285f4',
  GRAY: '#9aa0a6',
  DARK_BLUE: '#174ea6',
  LIGHT_BLUE: '#e8f0fe',
  LIGHT_GREEN: '#e6f4ea',
  LIGHT_YELLOW: '#fef7e0',
  LIGHT_RED: '#fce8e6',
  LIGHT_ORANGE: '#fff4e5',
  LIGHT_GRAY: '#f1f3f4'
};

MT.getStatusColor = function (status) {
  var colors = {};
  colors[MT.STATUS.OK] = MT.COLORS.GREEN;
  colors[MT.STATUS.PENDING] = MT.COLORS.YELLOW;
  colors[MT.STATUS.CRITICAL] = MT.COLORS.RED;
  colors[MT.STATUS.STALE] = MT.COLORS.ORANGE;
  colors[MT.STATUS.BAPTIZED] = MT.COLORS.BLUE;
  colors[MT.STATUS.FALLEN_DATE] = MT.COLORS.GRAY;
  return colors[status] || MT.COLORS.GRAY;
};

MT.getStatusSoftColor = function (status) {
  var colors = {};
  colors[MT.STATUS.OK] = MT.COLORS.LIGHT_GREEN;
  colors[MT.STATUS.PENDING] = MT.COLORS.LIGHT_YELLOW;
  colors[MT.STATUS.CRITICAL] = MT.COLORS.LIGHT_RED;
  colors[MT.STATUS.STALE] = MT.COLORS.LIGHT_ORANGE;
  colors[MT.STATUS.BAPTIZED] = MT.COLORS.LIGHT_BLUE;
  colors[MT.STATUS.FALLEN_DATE] = MT.COLORS.LIGHT_GRAY;
  return colors[status] || MT.COLORS.LIGHT_GRAY;
};

MT.statusIcon = function (status) {
  var icons = {};
  icons[MT.STATUS.OK] = '🟢';
  icons[MT.STATUS.PENDING] = '🟡';
  icons[MT.STATUS.CRITICAL] = '🔴';
  icons[MT.STATUS.STALE] = '🟠';
  icons[MT.STATUS.BAPTIZED] = '🔵';
  icons[MT.STATUS.FALLEN_DATE] = '⚫';
  return icons[status] || '⚪';
};

MT.applyAppChrome = function (sheet) {
  sheet.setHiddenGridlines(true);
  sheet.setTabColor(MT.COLORS.DARK_BLUE);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
    .setFontFamily('Arial')
    .setFontColor(MT.COLORS.TEXT)
    .setVerticalAlignment('middle')
    .setWrap(true);
};

MT.styleTitle = function (range) {
  range
    .setFontSize(22)
    .setFontWeight('bold')
    .setFontColor(MT.COLORS.TEXT)
    .setHorizontalAlignment('center');
};

MT.styleSectionTitle = function (range) {
  range
    .setFontSize(12)
    .setFontWeight('bold')
    .setFontColor(MT.COLORS.MUTED_TEXT)
    .setHorizontalAlignment('left');
};

MT.styleButton = function (range, background, fontColor) {
  range
    .setBackground(background || MT.COLORS.DARK_BLUE)
    .setFontColor(fontColor || '#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, background || MT.COLORS.DARK_BLUE, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
};

MT.styleCard = function (range, background) {
  range
    .setBackground(background || MT.COLORS.CARD)
    .setBorder(true, true, true, true, false, false, MT.COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID)
    .setVerticalAlignment('middle');
};
