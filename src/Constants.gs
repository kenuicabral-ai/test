/**
 * Constants.gs
 * ---------------------------------------------------------------------------
 * Fonte única de verdade para nomes de abas, colunas, cores, status e layout.
 *
 * Regra de ouro: este arquivo NÃO chama funções de outros arquivos e NÃO possui
 * código de inicialização no topo. Apenas literais. Isso evita qualquer
 * dependência de ordem de carregamento entre os arquivos .gs.
 * ---------------------------------------------------------------------------
 */

/** Identidade do produto. */
const APP = {
  NAME: 'Mission Tracker',
  VERSION: '1.0.0',
};

/** Abas visíveis (o usuário vê estas). */
const SHEETS = {
  HOME: '🏠 Home',
  REGISTRO: '📱 Registro',
  DASH_LD: '🚨 Dashboard Distrito',
  DASH_LZ: '📊 Dashboard Zona',
  CONFIG: '⚙ Configuração',
};

/** Abas ocultas (infraestrutura: nunca expostas ao usuário). */
const HIDDEN_SHEETS = {
  BASE: 'Base',
  HISTORY: 'Histórico',
  EMAILS: 'Emails',
  LOGS: 'Logs',
  SISTEMA: 'Sistema',
  CACHE: 'Cache',
};

/**
 * Cabeçalhos da ÚNICA base de dados. A ordem define os índices das colunas.
 * Nunca duplicar pesquisadores: cada linha é um pesquisador único (ID).
 */
const BASE_HEADERS = [
  'ID',                 // 1
  'Nome',               // 2
  'Distrito',           // 3
  'Área',               // 4
  'Data Início',        // 5  (define a semana automaticamente)
  'Data Batismal',      // 6
  'Semana',             // 7  (calculada)
  'TouchDown',          // 8  (checkbox)
  'Plano Igreja',       // 9  (checkbox)
  'Match',              // 10 (checkbox)
  'Entrevista',         // 11 (checkbox)
  'Resultado',          // 12 (Em andamento / Reservado / Batizado / Caiu)
  'Próximo Passo',      // 13
  'Observação',         // 14
  'Status',             // 15 (chave de cor calculada)
  'Última Atualização', // 16 (data/hora)
  'Usuário',            // 17 (email de quem alterou por último)
];

/** Mapa de coluna -> índice 1-based (gerado a partir de BASE_HEADERS). */
const COL = (function buildColMap_() {
  const map = {};
  const keys = [
    'ID', 'NOME', 'DISTRITO', 'AREA', 'INICIO', 'DATA_BAT', 'SEMANA',
    'TOUCHDOWN', 'PLANO', 'MATCH', 'ENTREVISTA', 'RESULTADO',
    'PROXIMO', 'OBS', 'STATUS', 'ATUALIZADO', 'USUARIO',
  ];
  keys.forEach(function (k, i) { map[k] = i + 1; });
  return map;
})();

/** Campos que o LD pode editar. Qualquer outro campo é calculado/protegido. */
const EDITABLE_FIELDS = [
  'TouchDown', 'Plano Igreja', 'Match', 'Entrevista',
  'Próximo Passo', 'Observação', 'Resultado',
];

/** Marcos (milestones) por estágio. Usado pelo card inteligente. */
const MILESTONES = {
  TOUCHDOWN: 'TouchDown',
  PLANO: 'Plano Igreja',
  MATCH: 'Match',
  ENTREVISTA: 'Entrevista',
};

/** Estágios por semana — base do "card inteligente". */
const STAGES = [
  { week: 1, fields: [MILESTONES.TOUCHDOWN, MILESTONES.PLANO] },
  { week: 2, fields: [MILESTONES.MATCH] },
  { week: 3, fields: [MILESTONES.ENTREVISTA] },
];

/** Valores possíveis do campo Resultado. */
const RESULTADO = {
  ANDAMENTO: 'Em andamento',
  RESERVADO: 'Reservado',
  BATIZADO: 'Batizado',
  CAIU: 'Caiu',
};
const RESULTADO_OPTIONS = [
  RESULTADO.ANDAMENTO, RESULTADO.RESERVADO, RESULTADO.BATIZADO, RESULTADO.CAIU,
];

/** Chaves de status (uma por pesquisador). */
const STATUS = {
  EM_DIA: 'EM_DIA',                   // 🟢 verde
  PENDENTE: 'PENDENTE',               // 🟡 amarelo
  CRITICO: 'CRITICO',                 // 🔴 vermelho
  SEM_ATUALIZACAO: 'SEM_ATUALIZACAO', // 🟠 laranja
  BATIZADO: 'BATIZADO',               // 🔵 azul
  CAIU: 'CAIU',                       // ⚪ cinza
};

/** Metadados de cada status: cores, emoji e rótulo. */
const STATUS_META = {
  EM_DIA:          { emoji: '🟢', label: 'Em dia',           fill: '#34A853', soft: '#E6F4EA', text: '#0B6B2E' },
  PENDENTE:        { emoji: '🟡', label: 'Pendente',         fill: '#FBBC04', soft: '#FEF7E0', text: '#7A5900' },
  CRITICO:         { emoji: '🔴', label: 'Crítico',          fill: '#EA4335', soft: '#FCE8E6', text: '#A50E0E' },
  SEM_ATUALIZACAO: { emoji: '🟠', label: 'Sem atualização',  fill: '#FF6D01', soft: '#FEEAD9', text: '#8A3B00' },
  BATIZADO:        { emoji: '🔵', label: 'Batizado',         fill: '#4285F4', soft: '#E8F0FE', text: '#174EA6' },
  CAIU:            { emoji: '⚪', label: 'Data caiu',        fill: '#9E9E9E', soft: '#F1F3F4', text: '#5F6368' },
};

/** Ordem de exibição no Dashboard do LD (mais acionável primeiro). */
const LD_ORDER = [
  STATUS.SEM_ATUALIZACAO, // 🟠 laranja
  STATUS.CRITICO,         // 🔴 vermelho
  STATUS.PENDENTE,        // 🟡 amarelo
  STATUS.EM_DIA,          // 🟢 verde
  STATUS.BATIZADO,        // 🔵 azul
  STATUS.CAIU,            // ⚪ cinza
];

/** Paleta neutra de UI (visual de aplicativo, não de planilha). */
const UI = {
  BG: '#FFFFFF',
  CANVAS: '#F8F9FB',
  CARD: '#FFFFFF',
  BORDER: '#E0E3E7',
  TITLE: '#202124',
  SUBTLE: '#5F6368',
  ACCENT: '#1A73E8',
  ACCENT_SOFT: '#E8F0FE',
  BUTTON: '#1A73E8',
  BUTTON_TEXT: '#FFFFFF',
  DIVIDER: '#E8EAED',
};

/**
 * Coordenadas fixas do card de Registro. Centralizar aqui evita "números
 * mágicos" espalhados e mantém o mapeamento célula -> campo determinístico.
 * Conteúdo concentrado nas colunas B..E (largura confortável no celular).
 */
const REG = {
  COL_PAD: 1,      // A: respiro lateral
  COL_LABEL: 2,    // B
  COL_VALUE: 4,    // D
  COL_CTRL: 5,     // E (checkboxes/controles)
  WIDTH_FIRST: 4,  // colunas iniciais para mesclar (B..E)
  ROWS: {
    TITLE: 2,
    SUB: 3,
    NOME: 5,
    SEMANA: 6,
    AREA: 8,
    DATA: 9,
    STATUS_HDR: 11,
    M_TOUCHDOWN: 12,
    M_PLANO: 13,
    M_MATCH: 14,
    M_ENTREVISTA: 15,
    RESULTADO: 17,
    PROXIMO_HDR: 19,
    PROXIMO_VAL: 20,
    OBS_HDR: 22,
    OBS_VAL: 23,
    ATUALIZADO: 25,
    NAV: 27,
  },
};

/** Linha de cada marco no card (para mapear edições de volta ao campo). */
const REG_MILESTONE_ROW = {
  'TouchDown': REG.ROWS.M_TOUCHDOWN,
  'Plano Igreja': REG.ROWS.M_PLANO,
  'Match': REG.ROWS.M_MATCH,
  'Entrevista': REG.ROWS.M_ENTREVISTA,
};

/** Botões de navegação do Registro (texto exibido nas células). */
const NAV_BTN = {
  PREV: '⬅ Anterior',
  SAVE: '✅ Salvar',
  NEXT: 'Próximo ➡',
};

/** Rótulos dos "botões" tipo checkbox em outras telas. */
const ACTIONS = {
  START_RECORDS: '▶  COMEÇAR REGISTROS',
};

/** Chaves de estado em PropertiesService (rápido, sem I/O de planilha). */
const STATE_KEYS = {
  REG_IDS: 'MT_REG_IDS',       // ordem dos pesquisadores na navegação
  REG_INDEX: 'MT_REG_INDEX',   // índice atual
  CONFIG: 'MT_CONFIG',         // cache da configuração
};

/** Cabeçalhos das abas ocultas. */
const HISTORY_HEADERS = [
  'Data', 'Hora', 'ID Pesquisador', 'Nome', 'Campo', 'Valor Antigo', 'Valor Novo', 'Usuário',
];
const EMAILS_HEADERS = [
  'Data/Hora', 'Destinatário', 'Assunto', 'Status', 'Resumo',
];
const LOGS_HEADERS = [
  'Data/Hora', 'Nível', 'Origem', 'Mensagem',
];

/** Configuração padrão (sobrescrita pela aba Configuração). */
const DEFAULT_CONFIG = {
  distrito: 'Distrito 3',
  zona: 'Zona 1',
  diasSemAtualizacao: 3,   // > este valor => 🟠 laranja
  diasCriticoData: 7,      // data batismal a <= X dias com marco faltando => 🔴
  emailLD: '',
  emailLZ: '',
  enviarDigestDiario: false,
};
