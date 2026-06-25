# Mission Tracker

Aplicativo Google Apps Script para funcionar dentro do Google Sheets como um CRM mobile-first de acompanhamento de pesquisadores com data batismal.

O Google Sheets é usado como banco de dados e interface. A experiência foi desenhada para que o usuário interaja com telas em formato de aplicativo, sem navegar por tabelas.

## Arquitetura

- `Main.gs`: gatilhos, inicialização e orquestração.
- `Database.gs`: Base única, status calculado e persistência.
- `Config.gs`: tela de configuração e parâmetros operacionais.
- `Dashboard.gs`: Home, Registro, Dashboard Distrito e Dashboard Zona.
- `History.gs`: histórico protegido de alterações.
- `Colors.gs`: tokens visuais e helpers de UI.
- `Email.gs`: fila e envio opcional de digest.
- `Navigation.gs`: estado, navegação e ações por checkbox.
- `Utils.gs`: datas, validações, proteções, logs e batchUpdate.
- `Constants.gs`: nomes de abas, cabeçalhos, células e regras.

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

## Instalação

1. Crie ou abra uma planilha Google Sheets.
2. Adicione os arquivos `.gs` e `appsscript.json` no projeto Apps Script da planilha.
3. Ative o serviço avançado Google Sheets API para o projeto.
4. Execute `setupMissionTracker()` uma vez pelo editor Apps Script.
5. Use a planilha pelo app Google Sheets.

## Operação

- A Home mostra a situação atual do distrito ativo.
- A aba Registro mostra apenas um pesquisador por vez.
- Os botões mobile são checkboxes estilizados.
- Ao alterar um campo permitido, o sistema atualiza Base, Histórico, cor, data/hora, usuário e dashboards.
- O Dashboard Distrito mostra cards ordenados por: laranja, vermelho, amarelo, verde.
- O Dashboard Zona mostra indicadores por distrito; tocar no checkbox de um indicador filtra os pesquisadores daquele grupo.

## Fonte da verdade

A aba `Base` é a única fonte de dados. Pesquisadores nunca são duplicados para compor dashboards ou telas.
