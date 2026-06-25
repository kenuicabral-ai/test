/**
 * Config.gs
 * -----------------------------------------------------------------------------
 * Aba ⚙ Configuração: parâmetros do app + botões de manutenção.
 *
 * É a ÚNICA tela onde algo parecido com "ajustes" aparece. Mantém o app
 * configurável (distrito, limites de alerta, e-mail do LZ) sem nenhum menu,
 * dialog ou sidebar — apenas células e checkboxes.
 */

/** Lê uma configuração (texto). */
function getConfig(key, fallback) {
  const v = sysGet('CFG::' + key, undefined);
  if (v === undefined || v === '') {
    return (CONFIG_DEFAULTS[key] !== undefined) ? CONFIG_DEFAULTS[key] : fallback;
  }
  return v;
}

function getConfigNumber(key, fallback) {
  const v = Number(getConfig(key, fallback));
  return isNaN(v) ? fallback : v;
}

function setConfig(key, value) {
  sysSet('CFG::' + key, value);
}

/** Inicializa configurações padrão (idempotente). */
function ensureConfigDefaults() {
  Object.keys(CONFIG_DEFAULTS).forEach(function (key) {
    if (sysGet('CFG::' + key, undefined) === undefined) {
      setConfig(key, CONFIG_DEFAULTS[key]);
    }
  });
}

/** Distrito do líder (atalho muito usado). */
function getDistrito() {
  return getConfig(CONFIG_KEYS.DISTRITO, 'Distrito 3');
}

/**
 * Renderiza a aba Configuração: cada parâmetro é um par rótulo/valor editável
 * e, abaixo, os botões de manutenção (checkboxes-ação).
 */
function renderConfig() {
  const sh = getOrCreateSheet(SHEETS.CONFIG);
  prepCanvas(sh, 2);

  let r = 2;
  r = writeSpacer(sh, r, 12);
  r = writeBlock(sh, r, { text: '⚙ Configuração', size: 20, bold: true, span: 2, height: 40 });
  r = writeBlock(sh, r, { text: 'Ajustes do Mission Tracker', size: 11, color: '#5f6368', span: 2, height: 22 });
  r = writeSpacer(sh, r, 10);

  // Parâmetros editáveis (rótulo | valor).
  const params = [
    CONFIG_KEYS.DISTRITO,
    CONFIG_KEYS.STALE_DAYS,
    CONFIG_KEYS.CRITICAL_DAYS,
    CONFIG_KEYS.LZ_EMAIL,
    CONFIG_KEYS.NOTIFICAR
  ];

  params.forEach(function (key) {
    sh.getRange(r, 2).setValue(key)
      .setFontWeight('bold').setFontColor('#202124').setVerticalAlignment('middle');
    sh.getRange(r, 3).setValue(getConfig(key, ''))
      .setBackground('#f8f9fa')
      .setBorder(true, true, true, true, false, false, '#dadce0', SpreadsheetApp.BorderStyle.SOLID)
      .setVerticalAlignment('middle');
    sh.setRowHeight(r, 30);
    r++;
  });

  // Marca onde estão os valores para o onEdit conseguir mapear de volta.
  sysSet('CFG_FIRST_ROW', String(2 + 5)); // 1ª linha de parâmetro = depois do cabeçalho
  // (recalculamos no onEdit pela linha do rótulo, então só guardamos a âncora)
  sysSet('CFG_PARAMS', params.join('||'));

  r = writeSpacer(sh, r, 14);
  r = writeBlock(sh, r, { text: 'MANUTENÇÃO', size: 11, bold: true, color: '#5f6368', span: 2, height: 22 });

  // Botões-ação (checkboxes).
  const actions = [BTN.SETUP, BTN.SEED, BTN.REFRESH];
  actions.forEach(function (label) {
    sh.getRange(r, 2).setValue(label).setFontWeight('bold').setVerticalAlignment('middle');
    const cb = sh.getRange(r, 3);
    cb.insertCheckboxes().setValue(false).setHorizontalAlignment('center');
    sh.setRowHeight(r, 32);
    r++;
  });

  sysSet('CFG_ACTIONS_FIRST_ROW', String(r - actions.length));
  sysSet('CFG_ACTIONS', actions.join('||'));

  r = writeSpacer(sh, r, 16);
  r = writeBlock(sh, r, {
    text: 'Dica: marque "' + BTN.SETUP + '" para (re)criar toda a estrutura do app.',
    size: 10, color: '#80868b', span: 2, height: 30
  });
}

/**
 * Trata edições na aba Configuração.
 * - Edição de valor de parâmetro -> persiste em Sistema.
 * - Checkbox de ação -> executa e desmarca.
 */
function handleConfigEdit(e) {
  const sh = e.range.getSheet();
  const row = e.range.getRow();
  const col = e.range.getColumn();

  // Ações (checkboxes na coluna 3).
  const actionsFirst = Number(sysGet('CFG_ACTIONS_FIRST_ROW', 0));
  const actions = String(sysGet('CFG_ACTIONS', '')).split('||').filter(Boolean);
  if (col === 3 && actionsFirst && row >= actionsFirst && row < actionsFirst + actions.length) {
    if (!toBool(e.value)) return;
    const label = actions[row - actionsFirst];
    e.range.setValue(false); // "botão" volta ao normal
    runConfigAction(label);
    return;
  }

  // Valores de parâmetros (coluna 3, rótulo na coluna 2).
  if (col === 3) {
    const label = sh.getRange(row, 2).getValue();
    const params = String(sysGet('CFG_PARAMS', '')).split('||').filter(Boolean);
    if (params.indexOf(label) !== -1) {
      setConfig(label, e.range.getValue());
      recomputeAllStatus();
      refreshAll();
      toast('Configuração salva: ' + label);
    }
  }
}

function runConfigAction(label) {
  if (label === BTN.SETUP) {
    setupApp();
    toast('App reconstruído.');
  } else if (label === BTN.SEED) {
    seedSampleData();
    refreshAll();
    toast('Dados de exemplo inseridos.');
  } else if (label === BTN.REFRESH) {
    recomputeAllStatus();
    refreshAll();
    toast('Tudo atualizado.');
  }
}
