# Mission Tracker

Aplicativo CRM mobile-first que funciona dentro do Google Sheets usando apenas Google Sheets e Apps Script.

O Google Sheets atua como banco de dados e interface. A experiência foi desenhada para que LDs e LZs usem cards, checkboxes, validações e dashboards sem navegar por tabelas.

## Arquitetura

- `Main.gs`: setup, refresh e gatilho `onEdit(e)`.
- `Constants.gs`: nomes de abas, schema da Base, células de UI, status e opções.
- `Utils.gs`: helpers compartilhados, escrita em bloco, locks e sistema interno.
- `Colors.gs`: paleta visual e estilos.
- `Config.gs`: criação das abas, configuração e visibilidade.
- `Database.gs`: Base única, normalização, status e persistência.
- `History.gs`: histórico imutável e logs.
- `Dashboard.gs`: Home, Registro, Dashboard Distrito e Dashboard Zona.
- `Navigation.gs`: botões por checkbox, filtros e edição automática.
- `Email.gs`: fila opcional de emails.

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

## Base única

A aba `Base` é a única fonte de verdade. Nenhum pesquisador é duplicado em outra aba. As demais telas são renderizações derivadas.

Campos principais:

- ID
- Nome
- Distrito
- Zona
- Área
- Semana
- Data Batismal
- TouchDown
- Plano Igreja
- Match
- Entrevista
- Próximo Passo
- Observação
- Resultado
- Status
- Prioridade
- Última Atualização
- Data Última Atualização
- Hora Última Atualização
- Usuário
- Criado Em
- Atualizado Em

## Como instalar

1. Crie ou abra a planilha Google Sheets que receberá o aplicativo.
2. Abra **Extensões > Apps Script**.
3. Copie os arquivos `.gs` e `appsscript.json` para o projeto Apps Script.
4. Execute `setupMissionTracker()` uma vez.
5. Autorize o script quando o Google solicitar.

Depois disso, o uso normal acontece somente nas abas do Google Sheets, sem HTML Service, sidebar, dialog ou menus personalizados.

## Uso

- LD usa `🏠 Home` e `📱 Registro`.
- `📱 Registro` mostra um pesquisador por vez.
- O card exibe campos inteligentes por semana:
  - Semana 1: TouchDown e Plano Igreja.
  - Semana 2: Match.
  - Semana 3 ou maior: Entrevista.
- Cada edição atualiza automaticamente histórico, status, cor, dashboards, data, hora e usuário.
- LZ usa `📊 Dashboard Zona` para analisar indicadores por distrito e filtro.

## Status

- Verde: em dia.
- Amarelo: pendente.
- Vermelho: crítico.
- Laranja: sem atualização.
- Azul: batizado.
- Cinza: data caiu.
