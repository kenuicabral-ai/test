var MT_COLORS = {
  canvas: '#f8fafc',
  card: '#ffffff',
  text: '#1f2937',
  mutedText: '#6b7280',
  border: '#e5e7eb',
  input: '#fff7ed',
  action: '#2563eb',
  actionText: '#ffffff',
  green: '#d9ead3',
  yellow: '#fff2cc',
  red: '#f4cccc',
  orange: '#fce5cd',
  blue: '#cfe2f3',
  gray: '#d9d9d9',
  darkGreen: '#38761d',
  darkYellow: '#bf9000',
  darkRed: '#990000',
  darkOrange: '#b45f06',
  darkBlue: '#1155cc',
  darkGray: '#666666'
};

function Colors_statusColor_(statusKey) {
  var map = {
    ok: MT_COLORS.green,
    pending: MT_COLORS.yellow,
    critical: MT_COLORS.red,
    stale: MT_COLORS.orange,
    baptized: MT_COLORS.blue,
    dropped: MT_COLORS.gray
  };
  return map[statusKey] || MT_COLORS.card;
}

function Colors_statusTextColor_(statusKey) {
  var map = {
    ok: MT_COLORS.darkGreen,
    pending: MT_COLORS.darkYellow,
    critical: MT_COLORS.darkRed,
    stale: MT_COLORS.darkOrange,
    baptized: MT_COLORS.darkBlue,
    dropped: MT_COLORS.darkGray
  };
  return map[statusKey] || MT_COLORS.text;
}

function Colors_applyCanvas_(sheet) {
  sheet.setHiddenGridlines(true);
  Utils_batchUpdate_([{
    updateSheetProperties: {
      properties: {
        sheetId: Utils_sheetId_(sheet),
        gridProperties: {
          hideGridlines: true
        }
      },
      fields: 'gridProperties.hideGridlines'
    }
  }]);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
    .setBackground(MT_COLORS.canvas)
    .setFontColor(MT_COLORS.text)
    .setFontFamily('Arial')
    .setVerticalAlignment('middle');
}

function Colors_applyTitle_(range) {
  range
    .setFontSize(22)
    .setFontWeight('bold')
    .setFontColor(MT_COLORS.text)
    .setBackground(MT_COLORS.canvas);
}

function Colors_applySectionTitle_(range) {
  range
    .setFontSize(13)
    .setFontWeight('bold')
    .setFontColor(MT_COLORS.mutedText)
    .setBackground(MT_COLORS.canvas);
}

function Colors_applyCard_(range, background) {
  range
    .setBackground(background || MT_COLORS.card)
    .setBorder(true, true, true, true, false, false, MT_COLORS.border, SpreadsheetApp.BorderStyle.SOLID)
    .setWrap(true);
}

function Colors_applyAction_(range, background) {
  range
    .setBackground(background || MT_COLORS.action)
    .setFontColor(MT_COLORS.actionText)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, background || MT_COLORS.action, SpreadsheetApp.BorderStyle.SOLID);
}

function Colors_applyInput_(range) {
  range
    .setBackground(MT_COLORS.input)
    .setBorder(true, true, true, true, false, false, MT_COLORS.border, SpreadsheetApp.BorderStyle.SOLID)
    .setWrap(true);
}
