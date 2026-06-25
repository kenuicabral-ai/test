var MT = MT || {};

MT.COLORS = {
  APP_BG: '#f6f8fb',
  CARD_BG: '#ffffff',
  TEXT: '#202124',
  MUTED: '#5f6368',
  BORDER: '#dfe3ea',
  WHITE: '#ffffff',
  GREEN: '#34a853',
  GREEN_LIGHT: '#e6f4ea',
  YELLOW: '#fbbc04',
  YELLOW_LIGHT: '#fff8e1',
  RED: '#ea4335',
  RED_LIGHT: '#fce8e6',
  ORANGE: '#f29900',
  ORANGE_LIGHT: '#fff3e0',
  BLUE: '#1a73e8',
  BLUE_LIGHT: '#e8f0fe',
  GRAY: '#9aa0a6',
  GRAY_LIGHT: '#f1f3f4',
  DARK: '#1f2937'
};

MT.Colors = (function () {
  function getStatusStyle(status) {
    var styles = {};
    styles[MT.STATUS.OK] = {
      label: MT.STATUS_LABELS[MT.STATUS.OK],
      color: MT.COLORS.GREEN,
      background: MT.COLORS.GREEN_LIGHT
    };
    styles[MT.STATUS.PENDING] = {
      label: MT.STATUS_LABELS[MT.STATUS.PENDING],
      color: MT.COLORS.YELLOW,
      background: MT.COLORS.YELLOW_LIGHT
    };
    styles[MT.STATUS.CRITICAL] = {
      label: MT.STATUS_LABELS[MT.STATUS.CRITICAL],
      color: MT.COLORS.RED,
      background: MT.COLORS.RED_LIGHT
    };
    styles[MT.STATUS.STALE] = {
      label: MT.STATUS_LABELS[MT.STATUS.STALE],
      color: MT.COLORS.ORANGE,
      background: MT.COLORS.ORANGE_LIGHT
    };
    styles[MT.STATUS.BAPTIZED] = {
      label: MT.STATUS_LABELS[MT.STATUS.BAPTIZED],
      color: MT.COLORS.BLUE,
      background: MT.COLORS.BLUE_LIGHT
    };
    styles[MT.STATUS.FELL] = {
      label: MT.STATUS_LABELS[MT.STATUS.FELL],
      color: MT.COLORS.GRAY,
      background: MT.COLORS.GRAY_LIGHT
    };
    return styles[status] || styles[MT.STATUS.OK];
  }

  function applyAppSheetStyle(sheet) {
    sheet.setHiddenGridlines(true);
    sheet.setTabColor(MT.COLORS.BLUE);
    sheet.getRange('A:Z')
      .setFontFamily('Roboto')
      .setFontColor(MT.COLORS.TEXT)
      .setBackground(MT.COLORS.APP_BG)
      .setVerticalAlignment('middle');
    sheet.setFrozenRows(0);
  }

  function applyTitle(range) {
    range
      .setFontSize(22)
      .setFontWeight('bold')
      .setFontColor(MT.COLORS.DARK)
      .setBackground(MT.COLORS.APP_BG)
      .setHorizontalAlignment('left');
  }

  function applySubtitle(range) {
    range
      .setFontSize(12)
      .setFontColor(MT.COLORS.MUTED)
      .setBackground(MT.COLORS.APP_BG);
  }

  function applyCard(range, background) {
    range
      .setBackground(background || MT.COLORS.CARD_BG)
      .setBorder(true, true, true, true, false, false, MT.COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID)
      .setWrap(true)
      .setVerticalAlignment('middle');
  }

  function applyButton(range, background) {
    range
      .setBackground(background || MT.COLORS.BLUE)
      .setFontColor(MT.COLORS.WHITE)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false, background || MT.COLORS.BLUE, SpreadsheetApp.BorderStyle.SOLID);
  }

  function applyInput(range) {
    range
      .setBackground(MT.COLORS.WHITE)
      .setFontColor(MT.COLORS.TEXT)
      .setBorder(true, true, true, true, false, false, MT.COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID)
      .setWrap(true)
      .setVerticalAlignment('middle');
  }

  function applyStatus(range, status) {
    var style = getStatusStyle(status);
    range
      .setBackground(style.background)
      .setFontColor(style.color)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
  }

  function colorForStatus(status) {
    return getStatusStyle(status).color;
  }

  function backgroundForStatus(status) {
    return getStatusStyle(status).background;
  }

  return {
    getStatusStyle: getStatusStyle,
    applyAppSheetStyle: applyAppSheetStyle,
    applyTitle: applyTitle,
    applySubtitle: applySubtitle,
    applyCard: applyCard,
    applyButton: applyButton,
    applyInput: applyInput,
    applyStatus: applyStatus,
    colorForStatus: colorForStatus,
    backgroundForStatus: backgroundForStatus
  };
})();
