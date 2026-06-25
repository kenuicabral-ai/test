/**
 * Navigation.gs
 * Navegação entre telas e renderização agregada.
 * Observação: em celulares, setActiveSheet nem sempre move a visão;
 * por isso cada tela também tem um botão "🔄 Atualizar".
 */

/** Ativa uma aba pelo nome (sem erro se não existir). */
function goTo(sheetName) {
  var sh = getSheetOrNull(sheetName);
  if (sh) {
    try {
      ss().setActiveSheet(sh);
      sh.activate();
    } catch (err) {
      logError('goTo', err);
    }
  }
}

/** Entra no fluxo de registros a partir do primeiro pesquisador. */
function goToRegistro() {
  sysSet(SYS.REGISTRO_INDEX, 0);
  buildRegistroOrder();
  renderRegistro();
  goTo(SHEETS.REGISTRO);
}

/** Renderiza todas as telas visíveis (após recalcular/reconstruir). */
function renderAll() {
  recomputeAll();
  renderHome();
  renderRegistro();
  renderDistrito();
  renderZona();
  renderConfig();
}
