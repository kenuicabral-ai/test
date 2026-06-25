/**
 * Constants.gs
 * ----------------------------------------------------------------------------
 * Ponto único de verdade para nomes, índices, cores, textos e layout.
 *
 * Regra de ouro do projeto: NENHUM número mágico e NENHUMA string solta no
 * meio da lógica. Tudo que descreve "o formato do app" mora aqui. Assim, mudar
 * uma cor, um rótulo ou a posição de um campo é uma alteração de UMA linha.
 *
 * Este arquivo NÃO contém lógica — apenas dados.
 * ----------------------------------------------------------------------------
 */

/** Nome do produto exibido nas telas. */
var APP = Object.freeze({
  NAME: 'Mission Tracker',
  VERSION: '1.0.0'
});

/**
 * Nomes das abas.
 * VISIBLE = o usuário enxerga e navega.
 * HIDDEN  = banco de dados e infraestrutura (ocultas e protegidas).
 */
var SHEETS = Object.freeze({
  // Visíveis
  HOME: '🏠 Home',
  REGISTRO: '📱 Registro',
  DASH_DISTRITO: '🚨 Dashboard Distrito',
  DASH_ZONA: '📊 Dashboard Zona',
  CONFIG: '⚙ Configuração',
  // Ocultas
  BASE: 'Base',
  HISTORICO: 'Histórico',
  EMAILS: 'Emails',
  LOGS: 'Logs',
  SISTEMA: 'Sistema',
  CACHE: 'Cache'
});

var VISIBLE_SHEETS = Object.freeze([
  SHEETS.HOME,
  SHEETS.REGISTRO,
  SHEETS.DASH_DISTRITO,
  SHEETS.DASH_ZONA,
  SHEETS.CONFIG
]);

var HIDDEN_SHEETS = Object.freeze([
  SHEETS.BASE,
  SHEETS.HISTORICO,
  SHEETS.EMAILS,
  SHEETS.LOGS,
  SHEETS.SISTEMA,
  SHEETS.CACHE
]);

/**
 * Colunas da aba Base (única fonte de dados).
 * 1-indexado (igual à API do Sheets). NUNCA acessar colunas por número cru.
 */
var COL = Object.freeze({
  ID: 1,
  NOME: 2,
  DISTRITO: 3,
  AREA: 4,
  SEMANA: 5,
  DATA_BATISMAL: 6,
  TOUCHDOWN: 7,
  PLANO_IGREJA: 8,
  MATCH: 9,
  ENTREVISTA: 10,
  PROXIMO_PASSO: 11,
  OBSERVACAO: 12,
  RESULTADO: 13,
  RESERVA: 14,
  STATUS: 15,            // cor/status calculado (chave de COLORS)
  ULTIMA_ATUALIZACAO: 16,
  USUARIO: 17
});

/** Cabeçalhos da Base, na ordem de COL. */
var BASE_HEADERS = Object.freeze([
  'ID', 'Nome', 'Distrito', 'Área', 'Semana', 'Data Batismal',
  'TouchDown', 'Plano Igreja', 'Match', 'Entrevista',
  'Próximo Passo', 'Observação', 'Resultado', 'Reserva',
  'Status', 'Última Atualização', 'Usuário'
]);

/** Total de colunas da Base. */
var BASE_COLS = BASE_HEADERS.length;

/** Cabeçalhos do Histórico (append-only, imutável). */
var HISTORICO_HEADERS = Object.freeze([
  'Data', 'Hora', 'ID Pesquisador', 'Nome', 'Campo', 'Valor Antigo', 'Valor Novo', 'Usuário'
]);

/** Fila de e-mails (escrita pelo onEdit, enviada por gatilho de tempo). */
var EMAILS_HEADERS = Object.freeze([
  'Criado em', 'Para', 'Assunto', 'Corpo', 'Status', 'Enviado em'
]);

/** Logs de sistema. */
var LOGS_HEADERS = Object.freeze([
  'Timestamp', 'Nível', 'Origem', 'Mensagem'
]);

/**
 * Chaves de estado/configuração na aba Sistema (formato chave/valor).
 */
var STATE = Object.freeze({
  CURRENT_INDEX: 'CURRENT_INDEX',     // índice do pesquisador na tela Registro
  LZ_FILTER: 'LZ_FILTER',             // indicador atualmente filtrado no Dashboard Zona
  LAST_SETUP: 'LAST_SETUP'
});

/** Chaves de configuração na aba Configuração. */
var CONFIG_KEYS = Object.freeze({
  DISTRITO: 'Distrito',
  ZONA: 'Zona',
  EMAIL_LZ: 'E-mail do LZ',
  DIAS_SEM_ATUALIZACAO: 'Dias até "sem atualização"',
  DIAS_CRITICO_DATA: 'Dias da data p/ ficar crítico',
  NOTIFICAR_CRITICOS: 'Notificar críticos por e-mail'
});

/**
 * Status calculado de cada pesquisador. A chave é gravada na Base (COL.STATUS)
 * e mapeia para cor + rótulo + emoji em um único lugar.
 */
var STATUS = Object.freeze({
  VERDE: 'VERDE',       // tudo certo
  AMARELO: 'AMARELO',   // pendência
  VERMELHO: 'VERMELHO', // pendência crítica
  LARANJA: 'LARANJA',   // sem atualização
  AZUL: 'AZUL',         // batizado
  CINZA: 'CINZA'        // data caiu
});

/**
 * Paleta. background = fundo do card, text = cor do texto, emoji + label
 * para os contadores e títulos.
 */
var COLORS = Object.freeze({
  VERDE:    { bg: '#E6F4EA', strong: '#1E8E3E', emoji: '🟢', label: 'Em dia' },
  AMARELO:  { bg: '#FEF7E0', strong: '#F9AB00', emoji: '🟡', label: 'Pendente' },
  VERMELHO: { bg: '#FCE8E6', strong: '#D93025', emoji: '🔴', label: 'Crítico' },
  LARANJA:  { bg: '#FEEFE3', strong: '#E8710A', emoji: '🟠', label: 'Sem atualização' },
  AZUL:     { bg: '#E8F0FE', strong: '#1A73E8', emoji: '🔵', label: 'Batizado' },
  CINZA:    { bg: '#F1F3F4', strong: '#5F6368', emoji: '⚪', label: 'Data caiu' }
});

/** Cores neutras de UI (cabeçalhos, separadores, fundo de tela). */
var UI = Object.freeze({
  CANVAS: '#FFFFFF',
  HEADER_BG: '#202124',
  HEADER_TX: '#FFFFFF',
  SEP: '#DADCE0',
  MUTED: '#5F6368',
  ACCENT: '#1A73E8',
  BUTTON_BG: '#1A73E8',
  BUTTON_TX: '#FFFFFF',
  CARD_BORDER: '#E0E0E0',
  FIELD_BG: '#F8F9FA'
});

/** Valores possíveis de Resultado (dropdown na Base/Registro). */
var RESULTADO_OPCOES = Object.freeze(['', 'Em andamento', 'Batizado', 'Data Caiu', 'Reservado']);

/**
 * Quais marcos cada semana exige. É a "inteligência" do card: dado a semana,
 * sabemos o que mostrar e o que cobrar. Coluna referencia COL.
 */
var SEMANA_REGRAS = Object.freeze({
  1: { mostra: [COL.TOUCHDOWN, COL.PLANO_IGREJA], exige: [COL.TOUCHDOWN] },
  2: { mostra: [COL.MATCH], exige: [COL.MATCH] },
  3: { mostra: [COL.ENTREVISTA], exige: [COL.ENTREVISTA] }
});

/** Rótulo amigável de cada marco (coluna -> texto). */
var MARCO_LABEL = Object.freeze({
  7: 'TouchDown',     // COL.TOUCHDOWN
  8: 'Plano Igreja',  // COL.PLANO_IGREJA
  9: 'Match',         // COL.MATCH
  10: 'Entrevista'    // COL.ENTREVISTA
});

/**
 * Endereços fixos do card da aba Registro.
 * O card vive na coluna B (com B:D mesclados para largura), uma linha por bloco.
 * Centralizar as posições aqui mantém renderCard() limpo e auditável.
 */
var CARD = Object.freeze({
  COL: 2,            // coluna B
  COL_WIDTH: 3,      // mescla B:D
  ROW_HEADER: 2,
  ROW_NOME: 3,
  ROW_SEMANA: 4,
  ROW_SEP1: 5,
  ROW_AREA_LABEL: 6,
  ROW_AREA_VALUE: 7,
  ROW_DATA_LABEL: 8,
  ROW_DATA_VALUE: 9,
  ROW_SEP2: 10,
  ROW_STATUS_TITLE: 11,
  ROW_MARCO_1: 12,   // até 3 marcos dinâmicos (12,13,14)
  ROW_MARCO_2: 13,
  ROW_MARCO_3: 14,
  ROW_SEP3: 15,
  ROW_PROX_LABEL: 16,
  ROW_PROX_VALUE: 17,
  ROW_OBS_LABEL: 18,
  ROW_OBS_VALUE: 19,
  ROW_RESULT_LABEL: 20,
  ROW_RESULT_VALUE: 21,
  ROW_SEP4: 22,
  ROW_UPDATE_LABEL: 23,
  ROW_UPDATE_VALUE: 24,
  ROW_SEP5: 25,
  ROW_NAV: 26,       // ⬅ B | Salvar C | ➡ D (checkboxes)
  ROW_FOOTER: 28
});

/** Texto dos "botões" (checkboxes) da navegação. */
var BTN = Object.freeze({
  ANTERIOR: '⬅ Anterior',
  SALVAR: '💾 Salvar',
  PROXIMO: 'Próximo ➡',
  COMECAR: '▶  COMEÇAR REGISTROS'
});

/** Marcadores de checkbox-botão usados pelo roteador do onEdit. */
var BTN_CELLS = Object.freeze({
  HOME_COMECAR: 'B12'   // célula do botão na Home (checkbox)
});
