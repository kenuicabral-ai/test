# Mission Tracker (Google Sheets + Apps Script)

Sistema mobile-first para acompanhamento de pesquisadores com data batismal, usando Google Sheets como banco de dados + interface sem aparência de planilha.

## Estrutura

- `Main.gs`: gatilhos e bootstrap.
- `Config.gs`: criação de abas, layout, validações e proteções.
- `Database.gs`: leitura/escrita na Base única.
- `Navigation.gs`: card único da aba `📱 Registro`.
- `Colors.gs`: regras de status e cores.
- `History.gs`: histórico imutável de alterações.
- `Dashboard.gs`: Home + dashboards de Distrito/Zona.
- `Email.gs`: fila opcional de notificações.
- `Utils.gs`: helpers.
- `Constants.gs`: constantes do domínio e UI.
- `appsscript.json`: manifesto do projeto.

## Abas do Sistema

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

## Fluxo principal (LD)

1. Abra `🏠 Home`.
2. No botão azul, selecione `COMEÇAR REGISTROS`.
3. Em `📱 Registro`, atualize somente:
   - TouchDown
   - Match
   - Entrevista
   - Próximo Passo
   - Observação
   - Resultado
4. Use `💾 Salvar`, `⬅ Anterior` e `Próximo ➡`.

## Automações

Ao salvar/editar no card de Registro:

- Atualiza `Base` (linha única do pesquisador).
- Recalcula semana e status/cor.
- Atualiza data/hora/timestamp/usuário.
- Registra histórico campo a campo.
- Atualiza Home e dashboards.

## Dashboard Zona

Os indicadores são clicáveis via checkbox no próprio dashboard. Ao marcar um indicador, a lista filtrada é renderizada abaixo automaticamente.

## Inicialização

Execute `bootstrapMissionTracker()` uma vez no editor Apps Script para preparar toda a estrutura. Depois, o sistema usa `onOpen` e `onEdit`.
