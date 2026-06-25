var MT_APP = {
  NAME: 'Mission Tracker',
  VERSION: '1.0.0'
};

var MT_SHEETS = {
  HOME: '🏠 Home',
  REGISTER: '📱 Registro',
  DISTRICT_DASHBOARD: '🚨 Dashboard Distrito',
  ZONE_DASHBOARD: '📊 Dashboard Zona',
  CONFIG: '⚙ Configuração',
  BASE: 'Base',
  HISTORY: 'Histórico',
  EMAILS: 'Emails',
  LOGS: 'Logs',
  SYSTEM: 'Sistema',
  CACHE: 'Cache'
};

var MT_VISIBLE_SHEETS = [
  MT_SHEETS.HOME,
  MT_SHEETS.REGISTER,
  MT_SHEETS.DISTRICT_DASHBOARD,
  MT_SHEETS.ZONE_DASHBOARD,
  MT_SHEETS.CONFIG
];

var MT_HIDDEN_SHEETS = [
  MT_SHEETS.BASE,
  MT_SHEETS.HISTORY,
  MT_SHEETS.EMAILS,
  MT_SHEETS.LOGS,
  MT_SHEETS.SYSTEM,
  MT_SHEETS.CACHE
];

var MT_BASE_HEADERS = [
  'ID',
  'Nome',
  'Distrito',
  'Zona',
  'Área',
  'Semana',
  'Data Batismal',
  'TouchDown',
  'Plano Igreja',
  'Match',
  'Entrevista',
  'Próximo Passo',
  'Observação',
  'Resultado',
  'Status',
  'Cor',
  'Reservado',
  'Última Atualização Data',
  'Última Atualização Hora',
  'Última Atualização Em',
  'Usuário',
  'Criado Em',
  'Atualizado Em'
];

var MT_HISTORY_HEADERS = [
  'Data',
  'Hora',
  'ID Pesquisador',
  'Pesquisador',
  'Campo alterado',
  'Valor antigo',
  'Valor novo',
  'Usuário'
];

var MT_EMAIL_HEADERS = [
  'Tipo',
  'Distrito',
  'Zona',
  'Email',
  'Ativo'
];

var MT_LOG_HEADERS = [
  'Data',
  'Hora',
  'Nível',
  'Origem',
  'Mensagem'
];

var MT_STATUS = {
  NO_UPDATE: 'Sem atualização',
  CRITICAL: 'Crítico',
  PENDING: 'Pendente',
  OK: 'Em dia',
  BAPTIZED: 'Batizado',
  DATE_DROPPED: 'Data caiu'
};

var MT_STATUS_ORDER = [
  MT_STATUS.NO_UPDATE,
  MT_STATUS.CRITICAL,
  MT_STATUS.PENDING,
  MT_STATUS.OK,
  MT_STATUS.BAPTIZED,
  MT_STATUS.DATE_DROPPED
];

var MT_RESULT_OPTIONS = [
  'Em acompanhamento',
  'Reservado',
  'Batizado',
  'Data caiu'
];

var MT_EDITABLE_FIELDS = [
  'TouchDown',
  'Plano Igreja',
  'Match',
  'Entrevista',
  'Próximo Passo',
  'Observação',
  'Resultado'
];

var MT_BOOLEAN_FIELDS = [
  'TouchDown',
  'Plano Igreja',
  'Match',
  'Entrevista'
];

var MT_WEEK_FIELDS = {
  '1': ['TouchDown', 'Plano Igreja'],
  '2': ['Match'],
  '3': ['Entrevista']
};

var MT_CONFIG_KEYS = {
  DISTRICT: 'Distrito',
  ZONE: 'Zona',
  NO_UPDATE_DAYS: 'Dias sem atualização',
  CRITICAL_WINDOW_DAYS: 'Janela crítica (dias)',
  LAST_REFRESH: 'Última reconstrução'
};

var MT_DEFAULT_CONFIG = {};
MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.DISTRICT] = 'Distrito 3';
MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.ZONE] = 'Zona 1';
MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.NO_UPDATE_DAYS] = 2;
MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.CRITICAL_WINDOW_DAYS] = 2;
MT_DEFAULT_CONFIG[MT_CONFIG_KEYS.LAST_REFRESH] = '';

var MT_USER_PROPERTIES = {
  CURRENT_RECORD_ID: 'missionTracker.currentRecordId',
  ZONE_FILTER: 'missionTracker.zoneFilter',
  ZONE_FILTER_DISTRICT: 'missionTracker.zoneFilterDistrict'
};

var MT_HOME_ACTIONS = {
  START: { row: 18, column: 2 }
};

var MT_REGISTER_ACTIONS = {
  PREVIOUS: { row: 34, column: 1 },
  SAVE: { row: 34, column: 3 },
  NEXT: { row: 34, column: 5 }
};

var MT_REGISTER_CELLS = {
  RECORD_ID: { row: 2, column: 8 },
  NAME: { row: 3, column: 1 },
  WEEK: { row: 6, column: 1 },
  STATUS: { row: 6, column: 4 },
  AREA: { row: 8, column: 3 },
  BAPTISM_DATE: { row: 10, column: 3 },
  FIELD_START_ROW: 15,
  FIELD_NAME_COLUMN: 8,
  FIELD_VALUE_COLUMN: 5,
  NEXT_STEP: { row: 22, column: 2 },
  NOTE: { row: 26, column: 2 },
  RESULT: { row: 30, column: 2 },
  LAST_UPDATE: { row: 32, column: 2 }
};

var MT_ZONE_ACTION_META = {
  ACTION_COLUMN: 6,
  META_TYPE_COLUMN: 8,
  META_DISTRICT_COLUMN: 9,
  META_FILTER_COLUMN: 10
};

var MT_ZONE_FILTERS = {
  ALL: 'all',
  NO_UPDATE: 'no_update',
  NO_MATCH: 'no_match',
  NO_INTERVIEW: 'no_interview',
  DATE_DROPPED: 'date_dropped',
  RESERVED: 'reserved'
};
