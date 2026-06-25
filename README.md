# Mission Tracker

Mission Tracker é um aplicativo para Google Sheets criado com Google Apps Script.
O Sheets funciona como banco de dados e interface mobile-first; o usuário não deve navegar por tabelas.

## Estrutura

- `Main.gs`: gatilhos `onOpen`, `onEdit` e inicialização.
- `Constants.gs`: nomes de abas, cabeçalhos, status, campos editáveis e células de ação.
- `Config.gs`: aba visível de configuração.
- `Database.gs`: base única, leitura em lote, cálculo de status e salvamento auditado.
- `History.gs`: histórico append-only e logs.
- `Dashboard.gs`: Home, Dashboard Distrito e Dashboard Zona.
- `Navigation.gs`: card único de registro, navegação e salvamento.
- `Colors.gs`: paleta visual e helpers de cards.
- `Email.gs`: infraestrutura oculta para emails futuros.
- `Utils.gs`: utilitários compartilhados.

## Abas

Visíveis:

- 🏠 Home
- 📱 Registro
- 🚨 Dashboard Distrito
- 📊 Dashboard Zona
- ⚙ Configuração

Ocultas:

- Base
- Histórico
- Emails
- Logs
- Sistema
- Cache

## Como instalar

1. Crie uma planilha Google Sheets.
2. Abra Extensões > Apps Script.
3. Copie os arquivos `.gs` e o manifesto `appsscript.json` para o projeto Apps Script.
4. Execute manualmente `setupMissionTracker` uma vez para autorizar e montar as abas.
5. Cadastre pesquisadores na aba oculta `Base` usando os cabeçalhos criados.

## Uso

- Na Home, toque no checkbox ao lado de `COMEÇAR REGISTROS`.
- Em Registro, edite somente os campos exibidos no card.
- Os campos de status mudam conforme a semana:
  - Semana 1: TouchDown e Plano Igreja.
  - Semana 2: Match.
  - Semana 3: Entrevista.
- Alterações salvam histórico, usuário, data/hora, status, cor e dashboards.
- No Dashboard Zona, toque no checkbox de qualquer indicador para filtrar os pesquisadores.
