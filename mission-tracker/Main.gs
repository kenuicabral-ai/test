/**
 * Main.gs
 * -----------------------------------------------------------------------------
 * Ponto de entrada do aplicativo. Concentra:
 *  - onOpen        : prepara/atualiza o app ao abrir.
 *  - onEditApp     : DESPACHANTE único de todas as edições (instalável).
 *  - setupApp      : (re)constrói toda a estrutura do Sheets do zero.
 *  - installTriggers / refresh helpers / seed de exemplo.
 *
 * Estratégia de gatilho:
 *  - Usamos um gatilho INSTALÁVEL onEdit (onEditApp) criado por setupApp, pois
 *    ele roda com autorização total (necessário para e-mail) e também dispara
 *    no app Google Sheets do celular.
 *  - onEdit (simples) abaixo é um fallback leve caso o instalável não exista.
 */

/* ------------------------------ Lifecycle ---------------------------------- */

function onOpen(e) {
  // Mantém leve e resiliente: cada passo é isolado para que a falta de
  // permissão em um deles (ex.: colaborador sem acesso de escrita à Base
  // protegida) não impeça a renderização das telas visíveis.
  try { ensureConfigDefaults(); } catch (e1) { /* ignore */ }

  if (!getSheet(SHEETS.BASE)) {
    // Primeira abertura: tenta construir tudo (requer autorização do dono).
    try { setupApp(); } catch (e2) { logError('onOpen.setup', e2); }
    return;
  }

  try { recomputeAllStatus(); } catch (e3) { /* Base protegida p/ não-dono */ }
  try { refreshAll(); } catch (e4) { logError('onOpen.refresh', e4); }
}

/**
 * Gatilho instalável (principal e único). Criado por setupApp().
 *
 * Optamos por NÃO usar um onEdit simples adicional: simples e instalável
 * disparam ambos para a mesma edição, o que causaria processamento duplicado.
 * Além disso, o gatilho simples roda sem autorização (não envia e-mail). O
 * instalável resolve os dois problemas e também dispara no app mobile.
 */
function onEditApp(e) {
  dispatchEdit(e);
}

/**
 * DESPACHANTE: roteia a edição para o módulo da aba correspondente.
 * Mantém um único lugar de decisão -> fácil de raciocinar e estender.
 */
function dispatchEdit(e) {
  if (!e || !e.range) return;
  const name = e.range.getSheet().getName();
  try {
    switch (name) {
      case SHEETS.HOME: handleHomeEdit(e); break;
      case SHEETS.REGISTRO: handleRegistroEdit(e); break;
      case SHEETS.DASH_DISTRITO: handleDashDistritoEdit(e); break;
      case SHEETS.DASH_ZONA: handleDashZonaEdit(e); break;
      case SHEETS.CONFIG: handleConfigEdit(e); break;
      default: break; // abas ocultas: ignoradas (protegidas de qualquer forma)
    }
  } catch (err) {
    logError('dispatchEdit:' + name, err);
  }
}

/* ------------------------------ Refresh ------------------------------------ */

function refreshDashboards() {
  renderDashDistrito();
  renderDashZona();
}

function refreshAll() {
  renderHome();
  refreshDashboards();
  // Registro é renderizado sob demanda (depende do pesquisador atual).
}

/* ------------------------------- Setup ------------------------------------- */

/**
 * (RE)CONSTRÓI todo o app: abas, cabeçalhos, proteções, validações, gatilhos.
 * Idempotente — pode rodar quantas vezes quiser.
 *
 * Esta é a ÚNICA função que precisa ser executada uma vez no editor do Apps
 * Script (passo de instalação). Depois, tudo funciona pelo celular.
 */
function setupApp() {
  ensureConfigDefaults();

  // 1) Criar abas na ordem desejada.
  VISIBLE_SHEETS.concat(HIDDEN_SHEETS).forEach(function (n) { getOrCreateSheet(n); });
  reorderSheets();

  // 2) Back-end: cabeçalhos.
  ensureBaseHeaders();
  ensureHistoryHeaders();
  ensureEmailHeaders();
  sistemaSheet();
  cacheSheet();
  getOrCreateSheet(SHEETS.LOGS);

  // 3) Esconder abas internas.
  HIDDEN_SHEETS.forEach(function (n) {
    const s = getSheet(n);
    if (s) s.hideSheet();
  });

  // 4) Renderizar telas.
  renderConfig();
  recomputeAllStatus();
  refreshAll();

  // 5) Proteger o que não pode ser tocado.
  protectHistory();
  protectBackend();

  // 6) Instalar gatilhos.
  installTriggers();

  // 7) Posição inicial: Home.
  const home = getSheet(SHEETS.HOME);
  if (home) ss().setActiveSheet(home);
}

function reorderSheets() {
  const order = VISIBLE_SHEETS.concat(HIDDEN_SHEETS);
  order.forEach(function (name, idx) {
    const s = getSheet(name);
    if (s) {
      ss().setActiveSheet(s);
      ss().moveActiveSheet(idx + 1);
    }
  });
}

/**
 * Protege as abas de DADOS (Base e Emails). Sistema/Cache/Logs ficam apenas
 * ocultas (não protegidas), pois guardam estado de UI que precisa ser escrito
 * durante a renderização — inclusive por gatilhos simples de colaboradores.
 */
function protectBackend() {
  [SHEETS.BASE, SHEETS.EMAILS].forEach(function (n) {
    const s = getSheet(n);
    if (!s) return;
    removeAllProtections(s);
    try {
      const p = s.protect().setDescription('Back-end protegido');
      p.removeEditors(p.getEditors());
      p.addEditor(Session.getEffectiveUser());
    } catch (e) { /* ignore */ }
  });
}

/* ------------------------------ Triggers ----------------------------------- */

function installTriggers() {
  // Limpa gatilhos do projeto para evitar duplicatas.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const fn = t.getHandlerFunction();
    if (fn === 'onEditApp' || fn === 'processEmailQueue') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // onEdit instalável: roda com autorização total e dispara no app mobile.
  ScriptApp.newTrigger('onEditApp')
    .forSpreadsheet(ss()).onEdit().create();

  // Não criamos gatilho onOpen instalável: a função simples onOpen() já roda
  // automaticamente ao abrir (criar o instalável causaria execução dupla).

  ScriptApp.newTrigger('processEmailQueue')
    .timeBased().everyHours(1).create();
}

/* -------------------------------- Logs ------------------------------------- */

function logError(where, err) {
  try {
    const sh = getOrCreateSheet(SHEETS.LOGS);
    sh.appendRow([now(), where, String(err && err.message ? err.message : err),
      String(err && err.stack ? err.stack : '')]);
  } catch (e) { /* última linha de defesa: não relança */ }
}

/* ----------------------------- Seed (exemplo) ------------------------------ */

/**
 * Insere pesquisadores de exemplo (idempotente: só insere se a Base estiver
 * vazia). Útil para experimentar o app imediatamente.
 */
function seedSampleData() {
  ensureBaseHeaders();
  if (getAllRecords().length > 0) return;

  const distrito = getDistrito();
  const today = startOfDay(now());
  function daysAgo(n) { const d = new Date(today); d.setDate(d.getDate() - n); return d; }
  function daysFwd(n) { const d = new Date(today); d.setDate(d.getDate() + n); return d; }

  const samples = [
    // nome, area, inicioOffset(-dias), batismoOffset(+dias), td, plano, match, ent, proximo, obs, resultado, atualizadoOffset(-dias)
    ['Emily', 'Junção 1', 8, 4, true, true, false, false, 'Confirmar Match', '', '', 0],
    ['Lucas', 'Junção 1', 16, 2, true, true, true, false, 'Agendar entrevista', '', '', 5],
    ['Sofia', 'Centro', 22, 1, true, true, true, false, '', '', '', 1],
    ['Mateus', 'Centro', 3, 20, false, false, false, false, 'Marcar TouchDown', '', '', 0],
    ['Ana', 'Norte', 10, 6, true, true, true, true, '', '', RESULTADO.RESERVADO, 0],
    ['Pedro', 'Norte', 30, -1, true, true, true, true, '', '', RESULTADO.BATIZADO, 2],
    ['Júlia', 'Sul', 25, -2, true, false, false, false, '', 'Mudou de cidade', RESULTADO.DATA_CAIU, 3],
    ['Rafael', 'Sul', 5, 12, true, true, false, false, 'Plano para domingo', '', '', 0]
  ];

  const rows = samples.map(function (s) {
    const row = new Array(BASE_LAST_COL).fill('');
    row[COL.ID - 1] = uuid();
    row[COL.NOME - 1] = s[0];
    row[COL.DISTRITO - 1] = distrito;
    row[COL.AREA - 1] = s[1];
    row[COL.INICIO - 1] = daysAgo(s[2]);
    row[COL.BATISMO - 1] = daysFwd(s[3]);
    row[COL.TOUCHDOWN - 1] = s[4];
    row[COL.PLANO - 1] = s[5];
    row[COL.MATCH - 1] = s[6];
    row[COL.ENTREVISTA - 1] = s[7];
    row[COL.PROXIMO - 1] = s[8];
    row[COL.OBS - 1] = s[9];
    row[COL.RESULTADO - 1] = s[10];
    row[COL.ATUALIZADO - 1] = daysAgo(s[11]);
    row[COL.USUARIO - 1] = currentUser();
    return row;
  });

  // Um segundo distrito para a visão de Zona ter mais de uma linha.
  const distrito2 = 'Distrito 4';
  [['Bianca', 'Leste', 9, 5, true, true, false, false, '', '', '', 4],
   ['Caio', 'Leste', 18, 1, true, true, true, false, '', '', '', 0]]
   .forEach(function (s) {
     const row = new Array(BASE_LAST_COL).fill('');
     row[COL.ID - 1] = uuid();
     row[COL.NOME - 1] = s[0];
     row[COL.DISTRITO - 1] = distrito2;
     row[COL.AREA - 1] = s[1];
     row[COL.INICIO - 1] = daysAgo(s[2]);
     row[COL.BATISMO - 1] = daysFwd(s[3]);
     row[COL.TOUCHDOWN - 1] = s[4];
     row[COL.PLANO - 1] = s[5];
     row[COL.MATCH - 1] = s[6];
     row[COL.ENTREVISTA - 1] = s[7];
     row[COL.RESULTADO - 1] = s[10];
     row[COL.ATUALIZADO - 1] = daysAgo(s[11]);
     row[COL.USUARIO - 1] = currentUser();
     rows.push(row);
   });

  baseSheet().getRange(2, 1, rows.length, BASE_LAST_COL).setValues(rows);
  recomputeAllStatus();
}
