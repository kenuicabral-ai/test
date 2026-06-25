/**
 * Config.gs
 * ----------------------------------------------------------------------------
 * Leitura/escrita de configuração (aba Configuração) e de estado de execução
 * (aba Sistema). Demais módulos NUNCA leem essas abas diretamente — passam por
 * aqui. Isso desacopla "onde está guardado" de "como é usado".
 * ----------------------------------------------------------------------------
 */

/** Valores padrão de configuração (usados na primeira execução). */
function defaultConfig() {
  return [
    [CONFIG_KEYS.DISTRITO, 'Distrito 3'],
    [CONFIG_KEYS.ZONA, 'Zona 1'],
    [CONFIG_KEYS.EMAIL_LZ, ''],
    [CONFIG_KEYS.DIAS_SEM_ATUALIZACAO, 3],
    [CONFIG_KEYS.DIAS_CRITICO_DATA, 7],
    [CONFIG_KEYS.NOTIFICAR_CRITICOS, false]
  ];
}

/**
 * Lê toda a configuração como objeto { chave: valor }.
 * Faz UMA leitura em lote e memoiza durante a execução (globais são recarregadas
 * a cada execução do Apps Script, então não há risco de cache obsoleto entre
 * eventos distintos).
 */
var __cfgCache = null;
function getConfig() {
  if (__cfgCache) return __cfgCache;
  var sh = getSheet(SHEETS.CONFIG);
  var out = {};
  defaultConfig().forEach(function (kv) { out[kv[0]] = kv[1]; });
  if (!sh) return out;
  var last = sh.getLastRow();
  if (last < 2) return out;
  var rows = sh.getRange(2, 1, last - 1, 2).getValues();
  rows.forEach(function (r) {
    var k = String(r[0]).trim();
    if (k) out[k] = r[1];
  });
  __cfgCache = out;
  return out;
}

/** Invalida o cache de configuração (após gravar novos valores). */
function invalidateConfigCache() {
  __cfgCache = null;
}

/** Atalho tipado para o número de dias até "sem atualização". */
function cfgDiasSemAtualizacao() {
  var v = Number(getConfig()[CONFIG_KEYS.DIAS_SEM_ATUALIZACAO]);
  return isNaN(v) || v <= 0 ? 3 : v;
}

/** Atalho tipado para a janela crítica da data batismal. */
function cfgDiasCriticoData() {
  var v = Number(getConfig()[CONFIG_KEYS.DIAS_CRITICO_DATA]);
  return isNaN(v) || v <= 0 ? 7 : v;
}

/* ------------------------------------------------------------------ */
/* Estado de execução (aba Sistema, formato chave/valor)              */
/* ------------------------------------------------------------------ */

/** Lê um valor de estado; retorna fallback se ausente. */
function getState(key, fallback) {
  var sh = getSheet(SHEETS.SISTEMA);
  if (!sh) return fallback;
  var last = sh.getLastRow();
  if (last < 2) return fallback;
  var rows = sh.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === key) return rows[i][1];
  }
  return fallback;
}

/** Grava (upsert) um valor de estado. */
function setState(key, value) {
  var sh = ensureSheet(SHEETS.SISTEMA);
  var last = sh.getLastRow();
  if (last < 1) {
    sh.getRange(1, 1, 1, 2).setValues([['Chave', 'Valor']]);
    last = 1;
  }
  if (last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === key) {
        sh.getRange(i + 2, 2).setValue(value);
        return;
      }
    }
  }
  sh.appendRow([key, value]);
}

/** Índice atual do pesquisador na tela Registro (0-based, saneado). */
function getCurrentIndex() {
  var v = Number(getState(STATE.CURRENT_INDEX, 0));
  return isNaN(v) || v < 0 ? 0 : Math.floor(v);
}

function setCurrentIndex(i) {
  setState(STATE.CURRENT_INDEX, Math.max(0, Math.floor(i)));
}
