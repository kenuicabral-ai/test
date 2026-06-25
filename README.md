# Mission Tracker

Aplicativo de acompanhamento de pesquisadores com data batismal, construído **dentro do Google Sheets** usando apenas **Google Apps Script**.

> O Google Sheets é apenas o **banco de dados** e a **interface**.
> O usuário nunca deve sentir que está usando uma planilha.

O sistema responde a duas perguntas:

- **Líder de Distrito (LD):** _"O que aconteceu desde a última atualização?"_
- **Líder de Zona (LZ):** _"Quem está sendo bem acompanhado e quem precisa de ajuda?"_

---

## Princípios de projeto

- **Mobile first** — usado quase só pelo app do Google Sheets no celular.
- **Sem HTML Service, sem Sidebar, sem Dialog, sem menus personalizados.** Tudo
  funciona com abas, validação de dados, checkboxes, formatação, proteções e
  atualização automática via gatilho `onEdit` instalável.
- **Um único banco de dados** (`Base`). Nenhum pesquisador é duplicado. Nenhuma
  linha é copiada para outras abas — todas as telas leem da `Base`.
- **Performance:** leitura/escrita sempre em arrays e em lote. Nunca célula a célula.
- **Aparência de app, não de planilha:** cards, ícones, emojis, blocos, espaços.

---

## Estrutura do projeto (arquitetura)

Código separado por responsabilidade (nunca um `Code.gs` gigante):

| Arquivo          | Responsabilidade                                                        |
| ---------------- | ----------------------------------------------------------------------- |
| `Constants.gs`   | Constantes estruturais imutáveis (abas, colunas, células, cores, ícones)|
| `Config.gs`      | Configurações editáveis (distrito, limites, e‑mail do LZ) com defaults  |
| `Utils.gs`       | Helpers genéricos: abas, datas, estado `Sistema` (chave/valor), toast   |
| `Database.gs`    | Acesso à `Base` (CRUD, leitura/escrita em lote, esquema)                |
| `Colors.gs`      | Motor de status/cores + recálculo em lote + contadores em `Cache`       |
| `History.gs`     | Registro imutável de alterações (`Histórico`)                           |
| `Dashboard.gs`   | Renderização de `Home`, `Dashboard Distrito` e `Dashboard Zona`         |
| `Registro.gs`    | Renderização e edição do card de Registro (um pesquisador por vez)      |
| `Navigation.gs`  | Navegação entre abas, anterior/próximo/salvar, filtros do LZ            |
| `Email.gs`       | Resumo por e‑mail para o LZ (`Emails`)                                  |
| `Main.gs`        | `setup()`, roteador `onEditInstallable`, proteções, dados de exemplo    |

> Observação: a especificação cita `History.gs`. Para deixar o card de registro
> autocontido, a renderização do card fica em `Registro.gs` e o histórico
> imutável fica em `History.gs`.

### Abas visíveis

`🏠 Home` · `📱 Registro` · `🚨 Dashboard Distrito` · `📊 Dashboard Zona` · `⚙️ Configuração`

### Abas ocultas (banco e infraestrutura)

`Base` · `Histórico` · `Emails` · `Logs` · `Sistema` · `Cache`

---

## Modelo de dados (`Base`)

Uma linha por pesquisador. Colunas:

| # | Coluna             | Tipo      | Editável pelo LD |
| - | ------------------ | --------- | ---------------- |
| 1 | ID                 | texto     | não              |
| 2 | Nome               | texto     | não              |
| 3 | Distrito           | texto     | não              |
| 4 | Semana             | número    | não              |
| 5 | Área               | texto     | não              |
| 6 | Data Batismal      | data      | não              |
| 7 | TouchDown          | booleano  | **sim**          |
| 8 | Plano Igreja       | booleano  | **sim**          |
| 9 | Match              | booleano  | **sim**          |
| 10| Entrevista         | booleano  | **sim**          |
| 11| Próximo Passo      | texto     | **sim**          |
| 12| Observação         | texto     | **sim**          |
| 13| Resultado          | lista     | **sim**          |
| 14| Cor                | calculado | não              |
| 15| Última Atualização | data/hora | automático       |
| 16| Usuário            | e‑mail    | automático       |

`Resultado` ∈ { _(vazio)_, `Reservado`, `Batizado`, `Data Caída` }.

---

## Motor de cores (a "interpretação" do sistema)

O LD apenas registra fatos. O sistema deduz a cor (prioridade de cima para baixo):

| Cor          | Significado          | Regra                                                                                  |
| ------------ | -------------------- | -------------------------------------------------------------------------------------- |
| 🔵 Azul      | Batizado             | `Resultado = Batizado`                                                                  |
| ⚪ Cinza     | Data caiu            | `Resultado = Data Caída`                                                                |
| 🔴 Vermelho  | Pendência crítica    | passo obrigatório da semana faltando (semana ≥ 2) **ou** batismo em ≤ N dias sem entrevista **ou** data batismal já passou |
| 🟠 Laranja   | Sem atualização      | sem alteração há mais de `DIAS_SEM_ATUALIZACAO` dias                                    |
| 🟡 Amarelo   | Pendência            | passo da semana atual pendente **ou** "Próximo Passo" vazio                            |
| 🟢 Verde     | Tudo certo           | nenhum dos casos acima                                                                  |

Passos obrigatórios por semana (card inteligente):

- **Semana 1:** TouchDown, Plano Igreja
- **Semana 2:** Match
- **Semana 3+:** Entrevista

Limites configuráveis na aba `⚙️ Configuração`.

---

## Automações (gatilho `onEdit` instalável)

Sempre que o LD altera um campo permitido, automaticamente:

1. grava na `Base` (em lote, a linha inteira);
2. registra a mudança no `Histórico` (campo, valor antigo, valor novo, usuário);
3. recalcula a `Cor`;
4. atualiza `Última Atualização`, data, hora e `Usuário`;
5. atualiza os contadores em `Cache` (usados pelos dashboards e pela Home).

O `Histórico` nunca é editável (proteção + sem células liberadas).

---

## Instalação

### Opção A — `clasp` (recomendado)

```bash
npm install -g @google/clasp
clasp login
clasp create --type sheets --title "Mission Tracker"   # gera o .clasp.json
cp .clasp.json.example .clasp.json                       # ou edite o scriptId gerado
clasp push
```

Depois abra a planilha, vá em **Extensões → Apps Script**, execute a função
`setup` uma vez e autorize os escopos.

### Opção B — manual

1. Crie uma planilha nova → **Extensões → Apps Script**.
2. Crie cada arquivo `.gs` de `src/` com o mesmo nome e cole o conteúdo.
3. Atualize o `appsscript.json` (Configurações do projeto → mostrar manifesto).
4. Execute `setup` uma vez e autorize.

### O que `setup()` faz

- cria todas as abas (visíveis e ocultas) e o esquema da `Base`;
- insere dados de exemplo (apenas se a `Base` estiver vazia);
- cria o gatilho `onEdit` **instalável** (necessário para enviar e‑mail e para
  rodar com permissões completas);
- aplica proteções e renderiza todas as telas.

> O gatilho precisa ser **instalável** (criado por `setup`) porque o `onEdit`
> simples não tem autorização para enviar e‑mails nem para outras operações
> autenticadas.

---

## Uso

- **Home:** mostra os contadores do dia e o botão **▶ COMEÇAR REGISTROS**.
- **Registro:** um card por pesquisador. Marque os checkboxes, escreva o próximo
  passo/observação e navegue com **⬅ Anterior / 💾 Salvar / Próximo ➡**. Tudo é
  salvo automaticamente.
- **Dashboard Distrito:** mini‑cards por pesquisador, ordenados por urgência
  (Laranja → Vermelho → Amarelo → Verde).
- **Dashboard Zona:** indicadores agregados; marque o checkbox de um indicador
  para ver apenas os pesquisadores correspondentes. Botão de **resumo por e‑mail**.
- **Configuração:** nome do distrito, e‑mail do LZ, limites, adicionar
  pesquisador, recalcular tudo e reconstruir o sistema.

---

## Limitações conhecidas (mobile)

- A troca de aba programática (`setActiveSheet`) nem sempre move a visão no app
  mobile. Por isso cada tela tem um botão **🔄 Atualizar**, e a navegação nativa
  por abas continua disponível.
- `Session.getActiveUser().getEmail()` pode vir vazio em contas pessoais; nesses
  casos o sistema registra `desconhecido`.
