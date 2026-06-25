var MT_APP = {
  name: 'Mission Tracker',
  version: '1.0.0',
  timeZone: 'America/Sao_Paulo'
};

var MT_SHEETS = {
  home: '🏠 Home',
  registration: '📱 Registro',
  districtDashboard: '🚨 Dashboard Distrito',
  zoneDashboard: '📊 Dashboard Zona',
  config: '⚙ Configuração',
  base: 'Base',
  history: 'Histórico',
  emails: 'Emails',
  logs: 'Logs',
  system: 'Sistema',
  cache: 'Cache'
};

var MT_VISIBLE_SHEETS = [
  MT_SHEETS.home,
  MT_SHEETS.registration,
  MT_SHEETS.districtDashboard,
  MT_SHEETS.zoneDashboard,
  MT_SHEETS.config
];

var MT_HIDDEN_SHEETS = [
  MT_SHEETS.base,
  MT_SHEETS.history,
  MT_SHEETS.emails,
  MT_SHEETS.logs,
  MT_SHEETS.system,
  MT_SHEETS.cache
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
  'Última Atualização',
  'Data Atualização',
  'Hora Atualização',
  'Usuário',
  'Reservado',
  'Criado Em',
  'Atualizado Em',
  'Ativo'
];

var MT_HISTORY_HEADERS = [
  'Data',
  'Hora',
  'ID',
  'Pesquisador',
  'Campo alterado',
  'Valor antigo',
  'Valor novo',
  'Usuário'
];

var MT_EMAIL_HEADERS = [
  'Criado Em',
  'Tipo',
  'Destinatário',
  'Assunto',
  'Mensagem',
  'Status',
  'Enviado Em'
];

var MT_LOG_HEADERS = [
  'Data',
  'Hora',
  'Nível',
  'Origem',
  'Mensagem',
  'Detalhes'
];

var MT_SYSTEM_HEADERS = ['Chave', 'Valor'];

var MT_STATUS = {
  ok: '🟢 Em dia',
  pending: '🟡 Pendente',
  critical: '🔴 Crítico',
  stale: '🟠 Sem atualização',
  baptized: '🔵 Batizado',
  dropped: '⚫ Data caiu'
};

var MT_STATUS_KEYS = {
  ok: 'ok',
  pending: 'pending',
  critical: 'critical',
  stale: 'stale',
  baptized: 'baptized',
  dropped: 'dropped'
};

var MT_STATUS_ORDER = {
  stale: 1,
  critical: 2,
  pending: 3,
  ok: 4,
  baptized: 5,
  dropped: 6
};

var MT_RESULT_OPTIONS = [
  'Em acompanhamento',
  'Reservado',
  'Batizado',
  'Data caiu',
  'Pausado'
];

var MT_BOOLEAN_FIELDS = {
  'TouchDown': true,
  'Plano Igreja': true,
  'Match': true,
  'Entrevista': true,
  'Reservado': true,
  'Ativo': true
};

var MT_EDITABLE_BASE_FIELDS = [
  'TouchDown',
  'Match',
  'Entrevista',
  'Próximo Passo',
  'Observação',
  'Resultado'
];

var MT_WEEK_RULES = {
  1: {
    visibleFields: ['TouchDown', 'Plano Igreja'],
    requiredFields: ['TouchDown', 'Plano Igreja']
  },
  2: {
    visibleFields: ['Match'],
    requiredFields: ['Match']
  },
  3: {
    visibleFields: ['Entrevista'],
    requiredFields: ['Entrevista']
  }
};

var MT_STATE_KEYS = {
  currentIndex: 'currentIndex',
  activeDistrictFilter: 'activeDistrictFilter',
  activeZoneMetric: 'activeZoneMetric',
  activeZoneDistrict: 'activeZoneDistrict',
  lastSetup: 'lastSetup',
  lastRefresh: 'lastRefresh'
};

var MT_HOME_CELLS = {
  startCheckbox: 'B20',
  refreshCheckbox: 'E20'
};

var MT_REGISTRATION_CELLS = {
  name: 'B4',
  week: 'E4',
  area: 'B7',
  baptismDate: 'E7',
  statusStartRow: 11,
  nextStep: 'B21',
  observation: 'B25',
  result: 'E30',
  lastUpdate: 'B33',
  previousCheckbox: 'B37',
  saveCheckbox: 'D37',
  nextCheckbox: 'F37'
};

var MT_CONFIG_CELLS = {
  district: 'C4',
  zone: 'C5',
  staleHours: 'C6',
  criticalDays: 'C7',
  zoneEmail: 'C8',
  emailMode: 'C9',
  rebuildCheckbox: 'D13'
};

var MT_ZONE_METRICS = [
  { key: 'all', label: 'Quantidade' },
  { key: 'stale', label: 'Sem atualização' },
  { key: 'missingMatch', label: 'Sem Match' },
  { key: 'missingInterview', label: 'Sem Entrevista' },
  { key: 'dropped', label: 'Datas Caídas' },
  { key: 'reserved', label: 'Reservados' }
];
