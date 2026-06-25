/**
 * Mission Tracker - Constantes centrais do sistema.
 */
var MT = MT || {};

MT.APP = {
  NAME: 'Mission Tracker',
  VERSION: '1.0.0',
  ACTION_EMPTY: 'Toque para escolher'
};

MT.SHEETS = {
  HOME: '🏠 Home',
  REGISTRO: '📱 Registro',
  DASH_DISTRITO: '🚨 Dashboard Distrito',
  DASH_ZONA: '📊 Dashboard Zona',
  CONFIG: '⚙ Configuração',
  BASE: 'Base',
  HISTORICO: 'Histórico',
  EMAILS: 'Emails',
  LOGS: 'Logs',
  SISTEMA: 'Sistema',
  CACHE: 'Cache'
};

MT.VISIBLE_SHEETS = [
  MT.SHEETS.HOME,
  MT.SHEETS.REGISTRO,
  MT.SHEETS.DASH_DISTRITO,
  MT.SHEETS.DASH_ZONA,
  MT.SHEETS.CONFIG
];

MT.HIDDEN_SHEETS = [
  MT.SHEETS.BASE,
  MT.SHEETS.HISTORICO,
  MT.SHEETS.EMAILS,
  MT.SHEETS.LOGS,
  MT.SHEETS.SISTEMA,
  MT.SHEETS.CACHE
];

MT.BASE_COLUMNS = [
  'id',
  'nome',
  'distrito',
  'zona',
  'area',
  'juncao',
  'data_batismal',
  'semana',
  'touchdown',
  'plano_igreja',
  'match',
  'entrevista',
  'proximo_passo',
  'observacao',
  'resultado',
  'status_cor',
  'status_label',
  'ultima_atualizacao_data',
  'ultima_atualizacao_hora',
  'ultima_atualizacao_ts',
  'atualizado_por',
  'ativo'
];

MT.RESULT_OPTIONS = [
  'Em Progresso',
  'Reservado',
  'Batizado',
  'Data Caiu',
  'Pausado'
];

MT.ZONE_FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'sem_atualizacao', label: 'Sem atualização' },
  { key: 'sem_match', label: 'Sem Match' },
  { key: 'sem_entrevista', label: 'Sem Entrevista' },
  { key: 'datas_caidas', label: 'Datas Caídas' },
  { key: 'reservados', label: 'Reservados' }
];

MT.STATUS = {
  ORANGE: 'orange',
  RED: 'red',
  YELLOW: 'yellow',
  GREEN: 'green',
  BLUE: 'blue',
  GRAY: 'gray'
};

MT.COLOR_MAP = {
  orange: { bg: '#F97316', fg: '#FFFFFF', label: 'Sem atualização' },
  red: { bg: '#DC2626', fg: '#FFFFFF', label: 'Crítico' },
  yellow: { bg: '#EAB308', fg: '#1F2937', label: 'Pendente' },
  green: { bg: '#16A34A', fg: '#FFFFFF', label: 'Em dia' },
  blue: { bg: '#2563EB', fg: '#FFFFFF', label: 'Batizado' },
  gray: { bg: '#6B7280', fg: '#FFFFFF', label: 'Data caiu' }
};

MT.SORT_PRIORITY = {};
MT.SORT_PRIORITY[MT.STATUS.ORANGE] = 1;
MT.SORT_PRIORITY[MT.STATUS.RED] = 2;
MT.SORT_PRIORITY[MT.STATUS.YELLOW] = 3;
MT.SORT_PRIORITY[MT.STATUS.GREEN] = 4;
MT.SORT_PRIORITY[MT.STATUS.BLUE] = 5;
MT.SORT_PRIORITY[MT.STATUS.GRAY] = 6;

MT.PROPS = {
  CURRENT_INDEX: 'MT_CURRENT_INDEX',
  SELECTED_DISTRICT: 'MT_SELECTED_DISTRICT',
  ZONE_FILTER: 'MT_ZONE_FILTER',
  ZONE_FILTER_DISTRICT: 'MT_ZONE_FILTER_DISTRICT'
};

MT.BEHAVIOR = {
  STALE_UPDATE_HOURS: 48
};

MT.REGISTRO = {
  CARD_RANGE: 'B2:E33',
  ID_CELL: 'E2',
  NAME_CELL: 'B4',
  WEEK_CELL: 'B6',
  AREA_CELL: 'B7',
  JUNCAO_CELL: 'B8',
  DATE_CELL: 'B9',
  TOUCHDOWN_CELL: 'C13',
  PLANO_IGREJA_CELL: 'C14',
  MATCH_CELL: 'C15',
  ENTREVISTA_CELL: 'C16',
  PROXIMO_PASSO_CELL: 'B19',
  OBSERVACAO_CELL: 'B23',
  RESULTADO_CELL: 'C27',
  ACTION_CELL: 'B30',
  LAST_UPDATE_CELL: 'B32',
  STATUS_ROWS_START: 13,
  STATUS_ROWS_COUNT: 4
};

MT.HOME = {
  CARD_RANGE: 'B2:E16',
  START_CELL: 'B14'
};

MT.CONFIG = {
  DISTRICT_CELL: 'C3',
  FILTER_CELL: 'C4',
  ACTION_CELL: 'C7'
};

MT.ACTIONS = {
  PREV: '⬅ Anterior',
  SAVE: '💾 Salvar',
  NEXT: 'Próximo ➡',
  START: 'COMEÇAR REGISTROS',
  REFRESH: '🔄 Atualizar agora'
};
