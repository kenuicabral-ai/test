/**
 * Config.gs
 * ---------------------------------------------------------------------------
 * Configuração do sistema. A aba "⚙ Configuração" é a fonte editável pelo
 * usuário; os valores são espelhados em PropertiesService para leitura rápida
 * (evita I/O de planilha em cada cálculo de cor).
 * ---------------------------------------------------------------------------
 */

/** Linhas da aba de configuração (chave -> linha). */
const CONFIG_ROWS = {
  TITLE: 2,
  DISTRITO: 4,
  ZONA: 5,
  DIAS_SEM_ATT: 6,
  DIAS_CRITICO: 7,
  EMAIL_LD: 8,
  EMAIL_LZ: 9,
  DIGEST: 10,
};

/**
 * Lê a configuração efetiva (merge de DEFAULT_CONFIG + cache + aba).
 * @return {Object} config
 */
function getConfig_() {
  const cached = getState_(STATE_KEYS.CONFIG, null);
  if (cached) return Object.assign({}, DEFAULT_CONFIG, cached);
  return Object.assign({}, DEFAULT_CONFIG);
}

/**
 * Salva a configuração no cache de propriedades.
 * @param {Object} cfg
 */
function saveConfig_(cfg) {
  const merged = Object.assign({}, DEFAULT_CONFIG, cfg);
  setState_(STATE_KEYS.CONFIG, merged);
  return merged;
}

/**
 * Reconstrói a aba de Configuração com a aparência de "tela de ajustes".
 * @param {Object=} cfg
 */
function renderConfig_(cfg) {
  cfg = cfg || getConfig_();
  const sh = getSheet_(SHEETS.CONFIG);
  resetSheet_(sh, 30, 8);

  setColumnLayout_(sh);

  // Cabeçalho
  writeTitle_(sh, CONFIG_ROWS.TITLE, '⚙ Configuração', APP.NAME + ' • v' + APP.VERSION);

  const fields = [
    [CONFIG_ROWS.DISTRITO, 'Distrito', cfg.distrito, 'text'],
    [CONFIG_ROWS.ZONA, 'Zona', cfg.zona, 'text'],
    [CONFIG_ROWS.DIAS_SEM_ATT, 'Dias até "sem atualização" 🟠', cfg.diasSemAtualizacao, 'number'],
    [CONFIG_ROWS.DIAS_CRITICO, 'Dias da data p/ ficar crítico 🔴', cfg.diasCriticoData, 'number'],
    [CONFIG_ROWS.EMAIL_LD, 'Email do LD', cfg.emailLD, 'text'],
    [CONFIG_ROWS.EMAIL_LZ, 'Email do LZ', cfg.emailLZ, 'text'],
    [CONFIG_ROWS.DIGEST, 'Enviar resumo diário', cfg.enviarDigestDiario, 'bool'],
  ];

  fields.forEach(function (f) {
    const row = f[0], label = f[1], value = f[2], type = f[3];
    const labelCell = sh.getRange(row, REG.COL_LABEL);
    labelCell.setValue(label)
      .setFontColor(UI.SUBTLE)
      .setFontSize(11);
    const valueCell = sh.getRange(row, REG.COL_VALUE, 1, 2).merge();
    valueCell.setFontSize(13).setFontWeight('bold').setFontColor(UI.TITLE)
      .setBackground(UI.ACCENT_SOFT).setBorder(true, true, true, true, false, false, UI.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    if (type === 'bool') {
      sh.getRange(row, REG.COL_VALUE).insertCheckboxes();
      sh.getRange(row, REG.COL_VALUE).setValue(!!value);
    } else {
      sh.getRange(row, REG.COL_VALUE).setValue(value);
    }
  });

  // Dica
  const hintRow = CONFIG_ROWS.DIGEST + 2;
  sh.getRange(hintRow, REG.COL_LABEL, 1, REG.WIDTH_FIRST).merge()
    .setValue('As alterações são aplicadas automaticamente ao sair da célula.')
    .setFontColor(UI.SUBTLE).setFontSize(10).setWrap(true);

  paintCanvas_(sh);
  sh.setHiddenGridlines(true);
}

/** Protege os rótulos da Configuração, liberando só as células de valor. */
function protectConfig_(sh) {
  try {
    sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
      if (p.canEdit()) p.remove();
    });
    const editable = sh.getRange(CONFIG_ROWS.DISTRITO, REG.COL_VALUE,
      CONFIG_ROWS.DIGEST - CONFIG_ROWS.DISTRITO + 1, 1); // D4:D10
    const prot = sh.protect().setDescription('Mission Tracker • Configuração');
    prot.setUnprotectedRanges([editable]);
    prot.setWarningOnly(false);
  } catch (e) {
    logEvent_('WARN', 'protection', e.message);
  }
}

/**
 * Lê os valores da aba de Configuração de volta para o objeto de config.
 * Chamado quando o usuário edita a aba.
 */
function readConfigFromSheet_() {
  const sh = findSheet_(SHEETS.CONFIG);
  if (!sh) return getConfig_();
  const get = function (row) { return sh.getRange(row, REG.COL_VALUE).getValue(); };
  const cfg = {
    distrito: s_(get(CONFIG_ROWS.DISTRITO)) || DEFAULT_CONFIG.distrito,
    zona: s_(get(CONFIG_ROWS.ZONA)) || DEFAULT_CONFIG.zona,
    diasSemAtualizacao: Number(get(CONFIG_ROWS.DIAS_SEM_ATT)) || DEFAULT_CONFIG.diasSemAtualizacao,
    diasCriticoData: Number(get(CONFIG_ROWS.DIAS_CRITICO)) || DEFAULT_CONFIG.diasCriticoData,
    emailLD: s_(get(CONFIG_ROWS.EMAIL_LD)),
    emailLZ: s_(get(CONFIG_ROWS.EMAIL_LZ)),
    enviarDigestDiario: toBool_(get(CONFIG_ROWS.DIGEST)),
  };
  return saveConfig_(cfg);
}

/**
 * Trata edições na aba Configuração: relê os valores, salva no cache e
 * atualiza os dashboards (pois distrito/zona/limiares afetam tudo).
 * @param {Object} e evento onEdit
 * @return {boolean} true se tratou
 */
function handleConfigEdit_(e) {
  const row = e.range.getRow();
  const validRows = [
    CONFIG_ROWS.DISTRITO, CONFIG_ROWS.ZONA, CONFIG_ROWS.DIAS_SEM_ATT,
    CONFIG_ROWS.DIAS_CRITICO, CONFIG_ROWS.EMAIL_LD, CONFIG_ROWS.EMAIL_LZ, CONFIG_ROWS.DIGEST,
  ];
  if (validRows.indexOf(row) === -1) return false;
  readConfigFromSheet_();
  refreshAllDashboards_();
  return true;
}
