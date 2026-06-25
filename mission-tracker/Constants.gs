/**
 * Constants.gs
 * -----------------------------------------------------------------------------
 * Pontos de verdade do sistema. NADA de "magic strings" espalhadas pelo código.
 * Qualquer nome de aba, índice de coluna, status ou rótulo vive aqui.
 *
 * Decisão de arquitetura:
 *  - Centralizar identificadores evita divergência entre módulos e torna o
 *    refactor seguro (mudar um nome de aba não quebra 9 arquivos).
 */

/** Nomes das abas (visíveis e ocultas). */
const SHEETS = {
  // Visíveis (a "interface" do app)
  HOME: '🏠 Home',
  REGISTRO: '📱 Registro',
  DASH_DISTRITO: '🚨 Dashboard Distrito',
  DASH_ZONA: '📊 Dashboard Zona',
  CONFIG: '⚙ Configuração',
  // Ocultas (o "back-end")
  BASE: 'Base',
  HISTORICO: 'Histórico',
  EMAILS: 'Emails',
  LOGS: 'Logs',
  SISTEMA: 'Sistema',
  CACHE: 'Cache'
};

const VISIBLE_SHEETS = [
  SHEETS.HOME,
  SHEETS.REGISTRO,
  SHEETS.DASH_DISTRITO,
  SHEETS.DASH_ZONA,
  SHEETS.CONFIG
];

const HIDDEN_SHEETS = [
  SHEETS.BASE,
  SHEETS.HISTORICO,
  SHEETS.EMAILS,
  SHEETS.LOGS,
  SHEETS.SISTEMA,
  SHEETS.CACHE
];

/**
 * Colunas da Base (1-indexed, como o GAS espera em getRange).
 * Uma ÚNICA base de dados. Nenhuma outra aba duplica pesquisadores.
 */
const COL = {
  ID: 1,
  NOME: 2,
  DISTRITO: 3,
  AREA: 4,
  INICIO: 5,        // data de início do acompanhamento (define a "semana")
  BATISMO: 6,       // data batismal
  SEMANA: 7,        // semana calculada (cache de leitura)
  TOUCHDOWN: 8,     // bool
  PLANO: 9,         // Plano Igreja - bool
  MATCH: 10,        // bool
  ENTREVISTA: 11,   // bool
  PROXIMO: 12,      // Próximo Passo - texto
  OBS: 13,          // Observação - texto
  RESULTADO: 14,    // '', 'Reservado', 'Batizado', 'Data Caiu'
  COR: 15,          // chave de status calculada
  ATUALIZADO: 16,   // datetime da última atualização
  USUARIO: 17       // e-mail de quem atualizou
};

const BASE_LAST_COL = COL.USUARIO;

const BASE_HEADERS = [
  'ID', 'Nome', 'Distrito', 'Área', 'Início', 'Data Batismal', 'Semana',
  'TouchDown', 'Plano Igreja', 'Match', 'Entrevista',
  'Próximo Passo', 'Observação', 'Resultado',
  'Cor', 'Última Atualização', 'Usuário'
];

/** Campos que o LD pode editar. TUDO o mais é protegido/automático. */
const EDITABLE_FIELDS = [
  COL.TOUCHDOWN, COL.PLANO, COL.MATCH, COL.ENTREVISTA,
  COL.PROXIMO, COL.OBS, COL.RESULTADO
];

/** Chaves de status (cores). */
const STATUS = {
  VERDE: 'verde',     // tudo certo
  AMARELO: 'amarelo', // pendência
  VERMELHO: 'vermelho', // pendência crítica
  LARANJA: 'laranja', // sem atualização
  AZUL: 'azul',       // batizado
  CINZA: 'cinza'      // data caiu
};

/** Ordem de exibição no Dashboard do LD (conforme especificação). */
const STATUS_ORDER_LD = [
  STATUS.LARANJA, STATUS.VERMELHO, STATUS.AMARELO, STATUS.VERDE,
  STATUS.AZUL, STATUS.CINZA
];

/** Valores possíveis para "Resultado". */
const RESULTADO = {
  NENHUM: '',
  RESERVADO: 'Reservado',
  BATIZADO: 'Batizado',
  DATA_CAIU: 'Data Caiu'
};

const RESULTADO_OPTIONS = [
  RESULTADO.NENHUM,
  RESULTADO.RESERVADO,
  RESULTADO.BATIZADO,
  RESULTADO.DATA_CAIU
];

/** Chaves de estado guardadas na aba Sistema (key/value). */
const STATE = {
  CURRENT_ID: 'CURRENT_ID',         // pesquisador aberto no Registro
  CURRENT_LIST: 'CURRENT_LIST',     // lista ordenada de IDs (navegação)
  ZONA_FILTER: 'ZONA_FILTER'        // filtro ativo vindo do Dashboard Zona
};

/** Chaves de configuração guardadas na aba Configuração. */
const CONFIG_KEYS = {
  DISTRITO: 'Distrito do Líder',
  STALE_DAYS: 'Dias sem atualização (alerta)',
  CRITICAL_DAYS: 'Dias para crítico (batismo)',
  LZ_EMAIL: 'E-mail do Líder de Zona',
  NOTIFICAR: 'Enviar e-mail em crítico (SIM/NÃO)'
};

const CONFIG_DEFAULTS = {};
CONFIG_DEFAULTS[CONFIG_KEYS.DISTRITO] = 'Distrito 3';
CONFIG_DEFAULTS[CONFIG_KEYS.STALE_DAYS] = 3;
CONFIG_DEFAULTS[CONFIG_KEYS.CRITICAL_DAYS] = 3;
CONFIG_DEFAULTS[CONFIG_KEYS.LZ_EMAIL] = '';
CONFIG_DEFAULTS[CONFIG_KEYS.NOTIFICAR] = 'NÃO';

/** Rótulos de botões (checkboxes que agem como botões). */
const BTN = {
  COMECAR: 'COMEÇAR REGISTROS',
  ANTERIOR: '⬅ Anterior',
  SALVAR: '💾 Salvar',
  PROXIMO: 'Próximo ➡',
  ABRIR: 'Abrir',
  SETUP: 'CONSTRUIR / RECONSTRUIR APP',
  SEED: 'INSERIR DADOS DE EXEMPLO',
  REFRESH: 'ATUALIZAR TUDO'
};
