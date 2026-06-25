# Mission Tracker

Um **aplicativo que roda dentro do Google Sheets**, não uma planilha.

O Google Sheets é apenas o **banco de dados** e a **interface**. O usuário (Líder
de Distrito / Líder de Zona) nunca deve sentir que está usando uma planilha:
ele vê telas em formato de **card**, com cards, ícones, cores e botões.

Feito para **celular** (app Google Sheets), sem depender de computador, HTML
Service, Sidebar, Dialog ou menus personalizados. Tudo funciona com **Apps
Script + Validação de Dados + Checkboxes + Formatação + Proteções + Gatilhos**.

---

## Filosofia

O sistema responde apenas a duas perguntas:

| Quem | Pergunta |
| --- | --- |
| **LD** (Líder de Distrito) | "O que aconteceu desde a última atualização?" |
| **LZ** (Líder de Zona) | "Quem está sendo bem acompanhado e quem precisa de ajuda?" |

O LD **registra** rapidamente o andamento de cada pesquisador. O sistema
**interpreta** as informações automaticamente (semana, cor, indicadores). O LZ
**acompanha** a qualidade pelos dashboards. O sistema nunca diz ao LD o que fazer.

---

## Arquitetura

Código separado por responsabilidade — sem um `Code.gs` gigante.

```
src/
├── appsscript.json   Manifesto (fuso, escopos OAuth, V8)
├── Constants.gs      Fonte única de nomes, colunas, cores, layout, status
├── Utils.gs          Mecânica reutilizável: datas, estado, logs, helpers de UI
├── Config.gs         Configuração (aba ⚙) + cache em PropertiesService
├── Database.gs       Acesso à ÚNICA base (CRUD em lote, nunca célula a célula)
├── Colors.gs         O "cérebro": semana, marcos, status (cor) por pesquisador
├── History.gs        Histórico append-only (nunca editável)
├── Navigation.gs     Tela de Registro (card único) + botões-checkbox
├── Dashboard.gs      Home + Dashboard Distrito (LD) + Dashboard Zona (LZ)
├── Email.gs          Resumo diário opcional + log de envios
└── Main.gs           setup(), onOpen, onEditTrigger, gatilhos, dados de exemplo
```

### Decisões de design (o "porquê")

1. **Botões sem menus/diálogos.** No app mobile não há menus, sidebars nem
   diálogos. Cada "botão" é um **checkbox**: ao marcá-lo, o gatilho `onEditTrigger`
   executa a ação e **desmarca o checkbox** automaticamente. É assim que
   funcionam `COMEÇAR REGISTROS`, `⬅ Anterior`, `Próximo ➡` e `Salvar`.

2. **Uma única base de dados** (aba `Base`, oculta). Nenhuma tela duplica
   pesquisadores nem copia linhas. Home, Registro e os dashboards **leem** a Base,
   recalculam em memória e desenham a UI. Single source of truth.

3. **Card inteligente por semana.** A semana é derivada automaticamente da
   `Data Início`. O card mostra apenas os marcos pertinentes:
   - Semana 1 → `TouchDown`, `Plano Igreja`
   - Semana 2 → `Match`
   - Semana 3 → `Entrevista`
   Marcos de semanas anteriores só reaparecem se ainda estiverem pendentes —
   nada "vaza", e nada desnecessário polui a tela.

4. **Interpretação automática de cor** (uma cor por pesquisador):
   | Cor | Significado |
   | --- | --- |
   | 🟢 Verde | Tudo certo |
   | 🟡 Amarelo | Existe uma pendência (marco do estágio faltando) |
   | 🔴 Vermelho | Pendência crítica (data próxima com marco faltando, ou pendência muito negligenciada) |
   | 🟠 Laranja | Sem atualização (passou do limite de dias) |
   | 🔵 Azul | Batizado |
   | ⚪ Cinza | Data caiu |

5. **Performance.** Leituras e escritas sempre em **arrays** (`getValues`/
   `setValues`). As colunas calculadas (`Semana`, `Status`) são persistidas em
   lote. As proteções são aplicadas **uma vez** no `setup()` (layouts têm
   posições fixas), evitando custo a cada edição.

6. **Automação total.** A cada alteração feita pelo LD, o sistema atualiza, de
   forma automática: histórico, cor, dashboards, data/hora, "última atualização"
   e usuário.

7. **Histórico imutável.** A aba `Histórico` é append-only e protegida.

---

## Abas

**Visíveis (parecem um app):**

- 🏠 **Home** — contadores do dia (🔴 críticos, 🟠 sem atualização, 🟡 pendentes,
  🟢 em dia…) e o botão **COMEÇAR REGISTROS**.
- 📱 **Registro** — **um** pesquisador por vez, em formato de card (nome, semana,
  área, data batismal, marcos, próximo passo, observação, última atualização e a
  navegação Anterior / Salvar / Próximo).
- 🚨 **Dashboard Distrito** — cards pequenos do LD, ordenados por prioridade
  (🟠 → 🔴 → 🟡 → 🟢).
- 📊 **Dashboard Zona** — indicadores por distrito (Quantidade, Sem atualização,
  Sem Match, Sem Entrevista, Datas Caídas, Reservados) com **drill-down**: escolha
  distrito + indicador para listar apenas aqueles pesquisadores.
- ⚙ **Configuração** — distrito, zona, limiares de cor e emails.

**Ocultas (infraestrutura):** `Base`, `Histórico`, `Emails`, `Logs`, `Sistema`,
`Cache`.

---

## O que o LD edita

Somente: `TouchDown`, `Match`, `Entrevista` (e `Plano Igreja`), `Próximo Passo`,
`Observação` e `Resultado`. Todo o restante é calculado e protegido.

---

## Instalação

### Opção A — Copiar e colar (mais simples)

1. Crie uma planilha nova no Google Sheets.
2. `Extensões → Apps Script`.
3. Crie um arquivo `.gs` para cada arquivo de `src/` (mesmo nome) e cole o
   conteúdo. Garanta que o manifesto (`appsscript.json`) use **runtime V8**.
4. Selecione a função **`setup`** e clique em **Executar**. Autorize as permissões.
5. Pronto: as abas, os dados de exemplo, as telas, as proteções e os gatilhos
   são criados automaticamente. Abra no app do celular e use a Home.

### Opção B — `clasp` (recomendado para versionar)

```bash
npm install -g @google/clasp
clasp login
# Crie/abra o projeto e copie o scriptId para .clasp.json:
cp .clasp.json.example .clasp.json   # edite o scriptId
clasp push
```

Depois, no editor do Apps Script, rode **`setup`** uma vez.

> O `setup()` insere **dados de exemplo** apenas quando a `Base` está vazia, para
> o sistema "nascer funcionando". Para começar do zero, limpe a aba `Base`
> (mantendo o cabeçalho) e adicione seus pesquisadores.

---

## Gatilhos instalados pelo `setup()`

- **onEditTrigger** (instalável, por edição): dá vida aos botões-checkbox e às
  edições do LD; grava na Base, registra histórico, recalcula cor e atualiza
  os dashboards.
- **dailyRecompute** (diário): recalcula semanas/cores, atualiza dashboards e,
  se ativado na Configuração, envia o **resumo diário** por email ao LD/LZ.

---

## Limitações conhecidas (mobile)

- `setActiveSheet` pode não mover a visualização do usuário no app do celular;
  ao tocar em COMEÇAR REGISTROS, a aba **Registro** é preparada e o usuário a
  abre pela barra de abas.
- Gatilhos simples (`onOpen`) têm escopo reduzido; o trabalho que exige
  autenticação roda no gatilho instalável.

---

## Modelo de dados (aba `Base`)

`ID • Nome • Distrito • Área • Data Início • Data Batismal • Semana • TouchDown •
Plano Igreja • Match • Entrevista • Resultado • Próximo Passo • Observação •
Status • Última Atualização • Usuário`

`Semana` e `Status` são **calculados** automaticamente.
