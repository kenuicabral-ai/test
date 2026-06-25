# 🛰 Mission Tracker

Aplicativo de acompanhamento de pesquisadores com data batismal, construído
**dentro do Google Sheets** com **Google Apps Script**.

O Google Sheets é apenas o **banco de dados** e a **interface**. O usuário nunca
deve sentir que está usando uma planilha — ele usa um **app**.

> Para **Líderes de Distrito (LD)**: _"O que aconteceu desde a última atualização?"_
> Para **Líderes de Zona (LZ)**: _"Quem está sendo bem acompanhado e quem precisa de ajuda?"_

---

## 1. Filosofia e princípios

- **Mobile-first absoluto.** Tudo funciona no **app do Google Sheets no celular**.
  Sem HTML Service, sem Sidebar, sem Dialog, sem menu personalizado. Apenas
  Sheets + Apps Script + validação de dados + checkboxes + formatação +
  proteções + atualizações automáticas.
- **Duas perguntas, nada mais.** Nenhuma tela existe sem responder uma das duas
  perguntas acima. Sem navegação por tabelas, sem telas desnecessárias.
- **Um pesquisador por vez.** A tela de Registro é um **card**, nunca uma tabela.
- **Uma fonte de verdade.** Existe **uma** aba `Base`. Pesquisadores nunca são
  duplicados nem copiados entre abas. Todas as telas leem da `Base`.
- **Automação total.** Qualquer alteração atualiza sozinha: histórico, cor,
  dashboards, data, hora, "última atualização" e usuário.

---

## 2. Arquitetura

O código é separado por responsabilidade (nada de `Code.gs` gigante):

| Arquivo | Responsabilidade |
| --- | --- |
| `Constants.gs` | Fonte única de nomes, colunas, cores, textos e **layout do card**. Sem lógica. |
| `Utils.gs` | Helpers puros: datas, usuário, estilos, logs, conversões. |
| `Config.gs` | Leitura/escrita de configuração (aba `⚙ Configuração`) e estado (aba `Sistema`). |
| `Database.gs` | CRUD da **única** `Base`. Leitura/escrita **em lote**, sempre por objetos. |
| `Colors.gs` | A "inteligência" do status: decide a **cor** de cada pesquisador. |
| `History.gs` | Trilha de auditoria **append-only** (imutável). |
| `Navigation.gs` | Telas **Home** e **Registro** (card) + navegação por checkboxes. |
| `Dashboard.gs` | **Dashboard do LD** (mini-cards) e **Dashboard do LZ** (indicadores + filtro). |
| `Email.gs` | Notificações por **fila** + envio por gatilho de tempo. |
| `Main.gs` | `setup()`, roteador `onEdit`, `onOpen`, gatilhos, proteções, dados de exemplo. |

### Abas

**Visíveis (o app):**
`🏠 Home` · `📱 Registro` · `🚨 Dashboard Distrito` · `📊 Dashboard Zona` · `⚙ Configuração`

**Ocultas (infraestrutura):**
`Base` · `Histórico` · `Emails` · `Logs` · `Sistema` · `Cache`

### Modelo de dados (`Base`)

Coluna única por pesquisador: `ID, Nome, Distrito, Área, Semana, Data Batismal,
TouchDown, Plano Igreja, Match, Entrevista, Próximo Passo, Observação,
Resultado, Reserva, Status, Última Atualização, Usuário`.

O **LD edita apenas**: TouchDown, Match, Entrevista, Próximo Passo, Observação,
Resultado. Todo o resto é calculado/carimbado automaticamente.

---

## 3. Decisões técnicas (e por quê)

### 3.1 Interação por checkboxes (não menus/diálogos)
No app mobile não há menus customizados nem diálogos. A solução: **"botões" são
checkboxes**. Ao tocar, o `onEdit` roteia a ação (Anterior / Salvar / Próximo /
Começar / Filtrar) e **desmarca** a caixa. É a única forma 100% mobile.

### 3.2 Gatilho **simples** `onEdit` (não instalável)
Gatilhos instaláveis **não disparam de forma confiável no app mobile**; o
`onEdit` **simples**, sim. Por isso TODA a interação (navegação, gravação,
histórico, cor, dashboards) vive no `onEdit` simples.

### 3.3 E-mail por **fila** + gatilho de **tempo**
O `onEdit` simples roda com permissões limitadas e não envia e-mail de forma
confiável no celular. Então:
1. `onEdit` **enfileira** a notificação na aba `Emails` (rápido, sempre funciona).
2. `processEmailQueue` (gatilho de **tempo**, a cada 5 min) roda no servidor com
   permissão total e **envia** os pendentes — mesmo registros feitos no celular.

### 3.4 Proteções "warning-only" nas telas
O `onEdit` simples executa **com a identidade do usuário**. Uma proteção "hard"
bloquearia as próprias escritas de renderização do script para LDs que não são
donos do arquivo, **quebrando o app**. Usamos proteção do tipo **aviso**: ela
comunica "não edite o layout" sem impedir o funcionamento. A imutabilidade do
`Histórico` é garantida porque **o código nunca edita** linhas existentes — só
acrescenta — e a aba é oculta.

### 3.5 Performance
- Leitura **em lote** (`getValues`) → array de objetos. Zero `getValue()` em loop.
- Escrita **em lote** (`setValues`/`setBackgrounds`).
- Status recalculado a partir do array em memória.

### 3.6 Card inteligente por semana
`SEMANA_REGRAS` define o que **mostrar** e o que **exigir** por semana:
- **Semana 1:** TouchDown + Plano Igreja
- **Semana 2:** Match
- **Semana 3:** Entrevista

Campos desnecessários nunca aparecem.

### 3.7 Cores (significado único, em um só lugar)
`🟢 Em dia` · `🟡 Pendência` · `🔴 Crítico` · `🟠 Sem atualização` ·
`🔵 Batizado` · `⚪ Data caiu`. A decisão mora só em `Colors.computeStatus()`,
então Home, Registro, Dashboards e e-mails contam **a mesma história**.

---

## 4. Como instalar

1. Crie uma planilha no Google Sheets.
2. **Extensões → Apps Script**.
3. Crie um arquivo `.gs` para cada arquivo deste repositório e cole o conteúdo
   (ou use [`clasp`](https://github.com/google/clasp) com o `appsscript.json`).
4. Salve e rode a função **`setup`** uma vez. Autorize as permissões.
5. (Opcional) Rode **`seedExemplo`** para criar dados de demonstração.
6. Abra a aba **🏠 Home** no celular e toque em **COMEÇAR REGISTROS**.

> O `setup()` cria todas as abas, formata o card, configura validações,
> aplica proteções e instala o gatilho de tempo dos e-mails. É **idempotente** —
> pode ser rodado novamente. Na aba **⚙ Configuração** há um botão
> **🔄 Reconstruir telas**.

---

## 5. Fluxo de uso

- **LD:** abre **📱 Registro**, vê um card por vez, marca TouchDown/Match/
  Entrevista, escreve o Próximo Passo, toca **Próximo ➡**. Tudo é salvo,
  datado, colorido e auditado automaticamente.
- **LZ:** abre **📊 Dashboard Zona**, vê indicadores por distrito e toca um
  indicador para ver **somente** aqueles pesquisadores.

---

## 6. Limitações conhecidas (plataforma)

- Gatilhos instaláveis e envio direto de e-mail não são confiáveis no app mobile
  → contornado com fila + gatilho de tempo (seção 3.3).
- Proteção "hard" é incompatível com renderização via gatilho simples para
  não-donos → usamos proteção de aviso (seção 3.4).
- `toast`/ativação de aba podem não aparecer/agir em todas as versões do app
  mobile; o sistema degrada graciosamente.
