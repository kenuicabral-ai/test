var MT = MT || {};

MT.APP_NAME = 'Mission Tracker';

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
  'Prioridade',
  'Última Atualização',
  'Data Última Atualização',
  'Hora Última Atualização',
  'Usuário',
  'Criado Em',
  'Atualizado Em'
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
  'Data',
  'Hora',
  'Tipo',
  'Destinatário',
  'Assunto',
  'Status',
  'Mensagem'
];

MT.LOG_HEADERS = [
  'Data',
  'Hora',
  'Nível',
  'Origem',
  'Mensagem',
  'Detalhes'
];

MT.SYSTEM_HEADERS = ['Chave', 'Valor'];

MT.CONFIG_CELLS = {
  DISTRICT: 'B5',
  ZONE: 'B6',
  ZONE_LEADER_EMAIL: 'B7',
  STALE_HOURS: 'B8'
};

MT.SYSTEM_KEYS = {
  CURRENT_INDEX: 'current_registration_index',
  ZONE_FILTER_DISTRICT: 'zone_filter_district',
  ZONE_FILTER_INDICATOR: 'zone_filter_indicator'
};

MT.STATUS = {
  STALE: 'Sem atualização',
  CRITICAL: 'Crítico',
  PENDING: 'Pendente',
  OK: 'Em dia',
  BAPTIZED: 'Batizado',
  FALLEN_DATE: 'Data caiu'
};

MT.STATUS_ORDER = {};
MT.STATUS_ORDER[MT.STATUS.STALE] = 1;
MT.STATUS_ORDER[MT.STATUS.CRITICAL] = 2;
MT.STATUS_ORDER[MT.STATUS.PENDING] = 3;
MT.STATUS_ORDER[MT.STATUS.OK] = 4;
MT.STATUS_ORDER[MT.STATUS.BAPTIZED] = 5;
MT.STATUS_ORDER[MT.STATUS.FALLEN_DATE] = 6;

MT.RESULT_OPTIONS = [
  '',
  'Ativo',
  'Reservado',
  'Batizado',
  'Data caiu',
  'Descontinuado'
];

MT.ZONE_INDICATORS = [
  'Todos',
  'Sem atualização',
  'Sem Match',
  'Sem Entrevista',
  'Datas Caídas',
  'Reservados'
];

MT.BOOLEAN_FIELDS = ['TouchDown', 'Plano Igreja', 'Match', 'Entrevista'];

MT.REGISTRATION_FIELD_CELLS = {
  TouchDown: 'F13',
  'Plano Igreja': 'F14',
  Match: 'F15',
  Entrevista: 'F16',
  'Próximo Passo': 'B20',
  'Observação': 'B24',
  Resultado: 'B29'
};

MT.REGISTRATION_NAV_CELLS = {
  PREVIOUS: 'B33',
  SAVE: 'D33',
  NEXT: 'F33'
};

MT.HOME_ACTION_CELLS = {
  START: 'B18'
};

MT.ZONE_FILTER_CELLS = {
  INDICATOR: 'B4',
  DISTRICT: 'B5'
};

MT.DEFAULT_COLUMN_COUNT = 8;
MT.DEFAULT_ROW_COUNT = 80;
