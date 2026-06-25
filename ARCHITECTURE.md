# Mission Tracker - Arquitetura (Google Sheets + Apps Script)

## 1) Princípios de Produto

- O sistema deve **parecer aplicativo**, não planilha.
- O Google Sheets atua como:
  - **Banco de dados central** (aba `Base`).
  - **Camada de interface** (abas visíveis em formato de cards).
- Sem HTML Service, Sidebar, Dialog ou menus customizados.
- Fluxo mobile-first para uso no app do Google Sheets.

## 2) Estrutura de Arquivos Apps Script

- `Main.gs`  
  Orquestra bootstrap, `onOpen`, `onEdit`, inicialização e rotas principais.
- `Database.gs`  
  Leitura/escrita em lote na aba `Base`, índices em memória e persistência.
- `Config.gs`  
  Setup inicial do arquivo, criação de abas, validações, proteções e metadados.
- `Dashboard.gs`  
  Construção dos dashboards (Distrito/Zona) em formato de cards.
- `History.gs`  
  Registro imutável do histórico de alterações.
- `Colors.gs`  
  Regras de classificação por cor/estado e paleta visual.
- `Email.gs`  
  Estrutura para notificações/eventos (sem envio automático obrigatório).
- `Navigation.gs`  
  Navegação de card único na aba `📱 Registro` (anterior/próximo/salvar).
- `Utils.gs`  
  Utilitários gerais: datas, normalização, cache, mapeamentos.
- `Constants.gs`  
  Constantes de abas, campos, colunas, enums, ícones e textos fixos.

## 3) Modelo de Dados Único (sem duplicação)

### Aba `Base` (oculta) - fonte única da verdade

Cada linha representa **um pesquisador**.

Campos de negócio:

1. `id`
2. `nome`
3. `distrito`
4. `zona`
5. `area`
6. `juncao`
7. `data_batismal`
8. `semana` (calculada por data batismal)
9. `touchdown` (checkbox)
10. `plano_igreja` (checkbox)
11. `match` (checkbox)
12. `entrevista` (checkbox)
13. `proximo_passo` (texto)
14. `observacao` (texto)
15. `resultado` (enum texto)
16. `status_cor` (enum: orange/red/yellow/green/blue/gray)
17. `status_label` (texto amigável)
18. `ultima_atualizacao_data`
19. `ultima_atualizacao_hora`
20. `ultima_atualizacao_ts`
21. `atualizado_por`
22. `ativo` (checkbox)

Campos 16-21 são automáticos.

## 4) Abas

### Visíveis

- `🏠 Home`
- `📱 Registro`
- `🚨 Dashboard Distrito`
- `📊 Dashboard Zona`
- `⚙ Configuração`

### Ocultas

- `Base`
- `Histórico`
- `Emails`
- `Logs`
- `Sistema`
- `Cache`

## 5) Fluxo Principal

1. LD abre `📱 Registro`.
2. Sistema mostra **um único card** do pesquisador atual (sem tabela).
3. LD edita apenas:
   - TouchDown
   - Match
   - Entrevista
   - Próximo Passo
   - Observação
   - Resultado
4. Ao salvar (ou editar célula de entrada):
   - Atualiza `Base` em lote.
   - Recalcula semana e status/cor.
   - Atualiza data/hora/usuário.
   - Gera histórico de alterações.
   - Reconstroi `Home` e dashboards.

## 6) Card Inteligente por Semana

- Semana 1: mostra `TouchDown` e `Plano Igreja`.
- Semana 2: mostra `Match`.
- Semana 3+: mostra `Entrevista`.

Campos não aplicáveis ficam ocultos visualmente e travados.

## 7) Regras de Status e Cores

Ordem de prioridade para classificação:

1. **Azul** (`blue`) - batizado/reservado confirmado.
2. **Cinza** (`gray`) - data batismal caiu/expirada.
3. **Laranja** (`orange`) - sem atualização dentro da janela.
4. **Vermelho** (`red`) - pendência crítica da semana.
5. **Amarelo** (`yellow`) - pendência não crítica.
6. **Verde** (`green`) - acompanhamento em dia.

## 8) Histórico Imutável

Toda alteração relevante gera append-only em `Histórico`:

- Data
- Hora
- Pesquisador (id/nome)
- Campo alterado
- Valor antigo
- Valor novo
- Usuário

Aba protegida contra edição manual.

## 9) Dashboards

### Dashboard Distrito (LD)

- Lista somente pesquisadores como cards compactos.
- Ordenação por prioridade:
  - Laranja
  - Vermelho
  - Amarelo
  - Verde
  - Azul
  - Cinza

### Dashboard Zona (LZ)

- Blocos de indicadores por distrito:
  - Quantidade total
  - Sem atualização
  - Sem Match
  - Sem Entrevista
  - Datas Caídas
  - Reservados
- Seletor por indicador em `⚙ Configuração` para filtrar lista renderizada.

## 10) Performance

- Leituras em massa (`getValues`) e escrita em massa (`setValues`).
- Evitar escrita linha a linha.
- Cache de dados e índices em `CacheService` e aba `Cache`.
- Rebuild de UI apenas onde houve impacto.

## 11) Segurança e Integridade

- Abas técnicas ocultas e protegidas.
- Células editáveis restritas nas abas visíveis.
- `onEdit` aceita apenas range de entrada previsto.
- Logs em `Logs` para exceções e eventos relevantes.

## 12) Implementação em Etapas

1. Criar estrutura de arquivos e constantes.
2. Implementar setup automático do workbook.
3. Implementar camada `Database`.
4. Implementar `Registro` card único + navegação.
5. Implementar regras de cor/status.
6. Implementar histórico imutável.
7. Implementar Home e Dashboards.
8. Revisar performance, proteções e validações.
