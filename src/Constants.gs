/**
 * Constants.gs
 * Constantes estruturais imutáveis do Mission Tracker.
 * Nada aqui depende de configuração do usuário (isso fica em Config.gs).
 */

/** Nomes das abas visíveis. */
var SHEETS = {
  HOME: '🏠 Home',
  REGISTRO: '📱 Registro',
  DASH_DISTRITO: '🚨 Dashboard Distrito',
  DASH_ZONA: '📊 Dashboard Zona',
  CONFIG: '⚙️ Configuração',
  // Abas ocultas (banco + infraestrutura)
  BASE: 'Base',
  HISTORICO: 'Histórico',
  EMAILS: 'Emails',
  LOGS: 'Logs',
  SISTEMA: 'Sistema',
  CACHE: 'Cache'
};

var VISIBLE_SHEETS = [
  SHEETS.HOME,
  SHEETS.REGISTRO,
  SHEETS.DASH_DISTRITO,
  SHEETS.DASH_ZONA,
  SHEETS.CONFIG
];

var HIDDEN_SHEETS = [
  SHEETS.BASE,
  SHEETS.HISTORICO,
  SHEETS.EMAILS,
  SHEETS.LOGS,
  SHEETS.SISTEMA,
  SHEETS.CACHE
];

/**
 * Colunas da Base (1-indexadas). Único banco de dados do sistema.
 */
var COL = {
  ID: 1,
  NOME: 2,
  DISTRITO: 3,
  SEMANA: 4,
  AREA: 5,
  DATA_BATISMAL: 6,
  TOUCHDOWN: 7,
  PLANO_IGREJA: 8,
  MATCH: 9,
  ENTREVISTA: 10,
  PROXIMO_PASSO: 11,
  OBSERVACAO: 12,
  RESULTADO: 13,
  COR: 14,
  ULTIMA_ATUALIZACAO: 15,
  USUARIO: 16
};

var BASE_HEADERS = [
  'ID', 'Nome', 'Distrito', 'Semana', 'Área', 'Data Batismal',
  'TouchDown', 'Plano Igreja', 'Match', 'Entrevista',
  'Próximo Passo', 'Observação', 'Resultado',
  'Cor', 'Última Atualização', 'Usuário'
];

var BASE_NUM_COLS = BASE_HEADERS.length; // 16
var BASE_FIRST_DATA_ROW = 2;

/** Campos que o LD pode editar (e que geram histórico). */
var EDITABLE_FIELDS = [
  'TouchDown', 'PlanoIgreja', 'Match', 'Entrevista',
  'ProximoPasso', 'Observacao', 'Resultado'
];

/** Valores possíveis para a coluna Resultado. */
var RESULTADO = {
  NENHUM: '',
  RESERVADO: 'Reservado',
  BATIZADO: 'Batizado',
  DATA_CAIDA: 'Data Caída'
};

var RESULTADO_OPCOES = [
  RESULTADO.NENHUM,
  RESULTADO.RESERVADO,
  RESULTADO.BATIZADO,
  RESULTADO.DATA_CAIDA
];

/** Chaves de status (cor). */
var STATUS = {
  VERDE: 'VERDE',
  AMARELO: 'AMARELO',
  VERMELHO: 'VERMELHO',
  LARANJA: 'LARANJA',
  AZUL: 'AZUL',
  CINZA: 'CINZA'
};

/** Metadados de cada status: cor de fundo, cor do texto, ícone e rótulo. */
var STATUS_META = {
  VERDE: { bg: '#34A853', fg: '#FFFFFF', soft: '#E6F4EA', icon: '🟢', label: 'Em dia' },
  AMARELO: { bg: '#FBBC04', fg: '#3C2F00', soft: '#FEF7E0', icon: '🟡', label: 'Pendência' },
  VERMELHO: { bg: '#EA4335', fg: '#FFFFFF', soft: '#FCE8E6', icon: '🔴', label: 'Crítico' },
  LARANJA: { bg: '#FF6D00', fg: '#FFFFFF', soft: '#FEEFE3', icon: '🟠', label: 'Sem atualização' },
  AZUL: { bg: '#4285F4', fg: '#FFFFFF', soft: '#E8F0FE', icon: '🔵', label: 'Batizado' },
  CINZA: { bg: '#9E9E9E', fg: '#FFFFFF', soft: '#F1F1F1', icon: '⚪', label: 'Data caiu' }
};

/** Ordem de urgência usada nos dashboards. */
var STATUS_ORDER = [
  STATUS.LARANJA,
  STATUS.VERMELHO,
  STATUS.AMARELO,
  STATUS.VERDE,
  STATUS.AZUL,
  STATUS.CINZA
];

/** Paleta de UI (neutra, aparência de app). */
var UI = {
  HEADER_BG: '#1A237E',
  HEADER_FG: '#FFFFFF',
  CARD_BG: '#FFFFFF',
  PANEL_BG: '#F5F6FA',
  LABEL_FG: '#5F6368',
  VALUE_FG: '#202124',
  SEP_BG: '#E0E0E0',
  BTN_BG: '#1A73E8',
  BTN_FG: '#FFFFFF',
  FONT: 'Arial'
};

/**
 * Mapa de células de controle do card de Registro (notação A1).
 * O layout usa 6 colunas estreitas (A–F) para parecer um card no celular.
 */
var REG = {
  COLS: 6,                 // A..F
  HEADER: 'A1',            // título
  NOME: 'A2',              // nome (faixa colorida)
  SEMANA: 'A3',            // "Semana N"
  AREA: 'D3',              // área
  DATA: 'A4',              // data batismal
  SEP1: 'A5',
  STATUS_TITLE: 'A6',
  STATUS_ROWS: [7, 8, 9],  // checkbox em A{row}, rótulo em B{row}:F{row}
  STATUS_CHECK_COL: 1,     // coluna A
  SEP2: 'A10',
  PROX_TITLE: 'A11',
  PROX_INPUT: 'A12',
  OBS_TITLE: 'A13',
  OBS_INPUT: 'A14',
  RESULTADO_TITLE: 'A15',
  RESULTADO_INPUT: 'D15',
  SEP3: 'A16',
  UPDATE_INFO: 'A17',
  NAV_LABELS_ROW: 19,
  NAV_ANTERIOR: 'A20',
  NAV_SALVAR: 'C20',
  NAV_PROXIMO: 'E20',
  LAST_ROW: 21
};

/** Card inteligente: passos exibidos por semana. */
function statusItemsForWeek(semana) {
  var s = Number(semana) || 1;
  if (s <= 1) {
    return [
      { field: 'TouchDown', label: '🤝 TouchDown' },
      { field: 'PlanoIgreja', label: '⛪ Plano Igreja' }
    ];
  }
  if (s === 2) {
    return [{ field: 'Match', label: '🔗 Match' }];
  }
  return [{ field: 'Entrevista', label: '🎤 Entrevista' }];
}

/** Indicadores do Dashboard da Zona. */
var ZONA_INDICADORES = [
  { key: 'TOTAL', label: '👥 Quantidade', icon: '👥' },
  { key: 'SEM_ATUALIZACAO', label: '🟠 Sem atualização', icon: '🟠' },
  { key: 'SEM_MATCH', label: '🔗 Sem Match', icon: '🔗' },
  { key: 'SEM_ENTREVISTA', label: '🎤 Sem Entrevista', icon: '🎤' },
  { key: 'DATAS_CAIDAS', label: '⚪ Datas Caídas', icon: '⚪' },
  { key: 'RESERVADOS', label: '⭐ Reservados', icon: '⭐' }
];

/** Chaves de estado guardadas na aba Sistema (chave/valor). */
var SYS = {
  REGISTRO_INDEX: 'registro_index',
  REGISTRO_ORDER: 'registro_order',     // JSON: lista de IDs na ordem exibida
  REGISTRO_STATUS_MAP: 'registro_status_map', // JSON: { "7": "TouchDown", ... }
  ZONA_FILTER: 'zona_filter',
  ZONA_DISTRITO: 'zona_distrito',
  SETUP_DONE: 'setup_done'
};

/** Chaves de contadores guardadas na aba Cache. */
var CACHE_KEYS = {
  COUNTS: 'counts_json',
  UPDATED_AT: 'counts_updated_at'
};

var MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

var WEEKDAYS_PT = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
];
