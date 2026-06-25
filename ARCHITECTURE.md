# Mission Tracker - Arquitetura

## Objetivo

Mission Tracker é um aplicativo executado dentro do Google Sheets. O Sheets atua como banco de dados, superfície mobile e runtime de automação; o usuário não deve precisar navegar por tabelas.

## Princípios

- Uma única base canônica: `Base`.
- Nenhuma duplicação de pesquisadores entre abas.
- Telas visíveis renderizadas como cards mobile-first.
- Interações por células, validações e checkboxes.
- Sem HTML Service, Sidebar, Dialog ou menus personalizados.
- Escritas em lote usando arrays e ranges, evitando atualização linha a linha.

## Abas

### Visíveis

- `🏠 Home`: resumo executivo e entrada para registros.
- `📱 Registro`: card de um pesquisador por vez.
- `🚨 Dashboard Distrito`: cards ordenados por prioridade.
- `📊 Dashboard Zona`: indicadores e filtro por indicador.
- `⚙ Configuração`: parâmetros e cadastro controlado.

### Ocultas

- `Base`: única fonte de pesquisadores.
- `Histórico`: auditoria somente leitura.
- `Emails`: fila de comunicação.
- `Logs`: diagnóstico técnico.
- `Sistema`: estado interno, seleção e filtros.
- `Cache`: espaço reservado para mapas de UI.

## Arquivos

- `Main.gs`: gatilhos e funções públicas.
- `Constants.gs`: nomes, cabeçalhos, células e estados.
- `Database.gs`: leitura, escrita, deduplicação e status.
- `Dashboard.gs`: renderização das telas visíveis.
- `History.gs`: auditoria de alterações.
- `Colors.gs`: semântica visual.
- `Email.gs`: fila e envio opcional.
- `Navigation.gs`: ações mobile por checkbox/edição.
- `Config.gs`: setup, validações e proteções.
- `Utils.gs`: helpers compartilhados.

## Fluxo de registro

1. LD toca em `COMEÇAR REGISTROS`.
2. `📱 Registro` mostra um único pesquisador, priorizado por status.
3. O card mostra apenas os campos relevantes para a semana:
   - Semana 1: TouchDown e Plano Igreja.
   - Semana 2: Match.
   - Semana 3: Entrevista.
4. Ao alterar campo ou tocar em Salvar:
   - `Base` é atualizada.
   - `Histórico` recebe campo, valor antigo, valor novo e usuário.
   - Status, cor, data/hora e última atualização são recalculados.
   - Home e dashboards são redesenhados.

## Status

- Verde: em dia.
- Amarelo: pendência.
- Vermelho: pendência crítica.
- Laranja: sem atualização.
- Azul: batizado/reservado.
- Cinza: data caiu.

## Performance

O código carrega dados em arrays, recalcula em memória e grava ranges completos com `setValues`/`setBackgrounds`. Dashboards são redesenhados como blocos de UI e não copiam linhas da base.
