var MT = MT || {};

MT.APP = {
  NAME: 'Mission Tracker',
  VERSION: '1.0.0',
  TIMEZONE: 'America/Sao_Paulo'
};

MT.SHEETS = {
  HOME: '🏠 Home',
  REGISTRATION: '📱 Registro',
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

MT.VISIBLE_SHEETS = [
  MT.SHEETS.HOME,
  MT.SHEETS.REGISTRATION,
  MT.SHEETS.DISTRICT_DASHBOARD,
  MT.SHEETS.ZONE_DASHBOARD,
  MT.SHEETS.CONFIG
];

MT.HIDDEN_SHEETS = [
  MT.SHEETS.BASE,
  MT.SHEETS.HISTORY,
  MT.SHEETS.EMAILS,
  MT.SHEETS.LOGS,
  MT.SHEETS.SYSTEM,
  MT.SHEETS.CACHE
];

MT.BASE_HEADERS = [
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
  'Status Cor',
  'Última Atualização',
  'Última Atualização ISO',
  'Atualizado Por',
  'Reservado',
  'Data Caiu',
  'Criado Em',
  'Criado Por'
];

MT.HISTORY_HEADERS = [
  'Data',
  'Hora',
  'Pesquisador ID',
  'Pesquisador',
  'Campo alterado',
  'Valor antigo',
  'Valor novo',
  'Usuário'
];

MT.EMAIL_HEADERS = [
  'Criado Em',
  'Tipo',
  'Destinatário',
  'Assunto',
  'Mensagem',
  'Status',
  'Enviado Em',
  'Erro'
];

MT.LOG_HEADERS = [
  'Data',
  'Hora',
  'Nível',
  'Origem',
  'Mensagem',
  'Detalhes',
  'Usuário'
];

MT.SYSTEM_HEADERS = [
  'Chave',
  'Valor',
  'Atualizado Em'
];

MT.CACHE_HEADERS = [
  'Tela',
  'Linha',
  'Chave',
  'Valor',
  'Atualizado Em'
];

MT.SYSTEM_KEYS = {
  CURRENT_RECORD_ID: 'currentRecordId',
  CURRENT_RECORD_INDEX: 'currentRecordIndex',
  DISTRICT_FILTER: 'districtFilter',
  ZONE_FILTER_DISTRICT: 'zoneFilterDistrict',
  ZONE_FILTER_METRIC: 'zoneFilterMetric',
  LAST_REFRESH: 'lastRefresh',
  INSTALLABLE_ON_EDIT: 'installableOnEdit'
};

MT.CONFIG = {
  DEFAULT_UPDATE_LIMIT_DAYS: 2,
  CELLS: {
    DISTRICT: 'B5',
    ZONE: 'B6',
    LD_EMAIL: 'B7',
    LZ_EMAIL: 'B8',
    UPDATE_LIMIT_DAYS: 'B9',
    STATUS: 'A27'
  },
  NEW_RESEARCHER: {
    NAME: 'B14',
    DISTRICT: 'B15',
    ZONE: 'B16',
    AREA: 'B17',
    WEEK: 'B18',
    BAPTISM_DATE: 'B19',
    NEXT_STEP: 'B20',
    ADD_BUTTON: 'B22'
  }
};

MT.HOME = {
  START_BUTTON: 'B17'
};

MT.REGISTRATION = {
  RECORD_ID: 'F2',
  NAME: 'B4',
  WEEK: 'B5',
  AREA: 'B7',
  BAPTISM_DATE: 'B9',
  TOUCHDOWN: 'B13',
  CHURCH_PLAN: 'B14',
  MATCH: 'B15',
  INTERVIEW: 'B16',
  NEXT_STEP: 'B19',
  OBSERVATION: 'B22',
  RESULT: 'B25',
  LAST_UPDATE: 'B28',
  PREVIOUS_BUTTON: 'A31',
  SAVE_BUTTON: 'B31',
  NEXT_BUTTON: 'C31',
  EDITABLE_FIELDS: {
    'B13': 'TouchDown',
    'B14': 'Plano Igreja',
    'B15': 'Match',
    'B16': 'Entrevista',
    'B19': 'Próximo Passo',
    'B22': 'Observação',
    'B25': 'Resultado'
  },
  SMART_ROWS: {
    TOUCHDOWN: 13,
    CHURCH_PLAN: 14,
    MATCH: 15,
    INTERVIEW: 16
  }
};

MT.ZONE_DASHBOARD = {
  FILTER_DISTRICT_CELL: 'B5',
  FILTER_METRIC_CELL: 'B6',
  FIRST_METRIC_ROW: 10,
  CLICK_COLUMN: 6,
  CACHE_DISTRICT_COLUMN: 7,
  CACHE_METRIC_COLUMN: 8
};

MT.STATUS = {
  CRITICAL: 'critical',
  STALE: 'stale',
  PENDING: 'pending',
  OK: 'ok',
  BAPTIZED: 'baptized',
  FELL: 'fell'
};

MT.STATUS_LABELS = {
  critical: '🔴 Crítico',
  stale: '🟠 Sem atualização',
  pending: '🟡 Pendente',
  ok: '🟢 Em dia',
  baptized: '🔵 Batizado',
  fell: '⚪ Data caiu'
};

MT.STATUS_ORDER = [
  MT.STATUS.STALE,
  MT.STATUS.CRITICAL,
  MT.STATUS.PENDING,
  MT.STATUS.OK,
  MT.STATUS.BAPTIZED,
  MT.STATUS.FELL
];

MT.RESULTS = [
  '',
  'Em acompanhamento',
  'Reservado',
  'Batizado',
  'Data caiu',
  'Pausado'
];

MT.WEEKS = [
  'Semana 1',
  'Semana 2',
  'Semana 3'
];

MT.ZONE_METRICS = {
  ALL: 'Quantidade',
  STALE: 'Sem atualização',
  NO_MATCH: 'Sem Match',
  NO_INTERVIEW: 'Sem Entrevista',
  FELL: 'Datas Caídas',
  RESERVED: 'Reservados'
};
