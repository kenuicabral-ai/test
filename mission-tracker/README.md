# Mission Tracker

Um **aplicativo que vive dentro do Google Sheets**. O Sheets é apenas o banco de
dados e a interface — o usuário (Líder de Distrito ou Líder de Zona) nunca deve
sentir que está usando uma planilha.

Feito 100% com **Google Apps Script + Google Sheets**, pensado para uso quase
exclusivo pelo **app do Google Sheets no celular**. Sem HTML Service, sem
Sidebar, sem Dialog, sem menus personalizados. Apenas: abas, células,
checkboxes, validação de dados, formatação, proteções e atualizações
automáticas via `onEdit`.

---

## 1. Filosofia

O sistema responde **apenas duas perguntas**:

| Para o **LD** | "O que aconteceu desde a última atualização?" |
| --- | --- |
| Para o **LZ** | "Quem está sendo bem acompanhado e quem precisa de ajuda?" |

O LD apenas **registra fatos** (TouchDown, Match, Entrevista, Próximo Passo,
Observação, Resultado). O sistema **interpreta** esses fatos e gera as cores e
os dashboards automaticamente. O sistema nunca diz ao LD o que fazer.

---

## 2. Arquitetura (decisões)

O código é separado por responsabilidade — nunca um `Code.gs` gigante:

| Arquivo | Responsabilidade |
| --- | --- |
| `Constants.gs` | Pontos de verdade: nomes de abas, colunas, status, rótulos. Zero "magic strings". |
| `Utils.gs` | Helpers puros: datas, acesso a abas e **helpers de layout** que criam a aparência de "app" (grid escondido, merges, alturas, cores). |
| `Config.gs` | Aba **⚙ Configuração**: parâmetros + botões de manutenção. |
| `Database.gs` | **Única** porta para a Base e para o Estado (Sistema/Cache). Leitura/escrita sempre em **lote**. |
| `Colors.gs` | O "cérebro": transforma fatos em **status/cor**. Determinístico e testável. |
| `History.gs` | Trilha de auditoria **imutável** (gravação em lote). |
| `Email.gs` | Fila de e-mails + notificação ao LZ em casos críticos. |
| `Navigation.gs` | A tela **📱 Registro**: um card por vez, inteligente por semana, com botões. |
| `Dashboard.gs` | **🚨 Dashboard Distrito** (mini-cards) + **📊 Dashboard Zona** (indicadores) + **🏠 Home**. |
| `Main.gs` | Lifecycle (`onOpen`), **despachante** de `onEdit`, `setupApp`, gatilhos, seed. |

### Por que estas decisões

- **Sem HTML/Sidebar/Dialog/Menu**: tudo isso depende de desktop ou não funciona
  bem no app mobile. A "UI" é construída escrevendo células formatadas; os
  "botões" são **checkboxes** que, ao serem marcados, disparam `onEdit`, executam
  a ação e se **desmarcam** sozinhos.
- **Gatilho instalável `onEditApp`**: criado por `setupApp()`. Roda com
  autorização total (necessária para enviar e-mail) e **também dispara no app
  mobile**. Há um `onEdit` simples como fallback.
- **Uma única Base**: nenhuma tela copia linhas. Todas leem/escrevem a mesma
  fonte. Dashboards e cards são **projeções** renderizadas em lote.
- **Performance**: nunca célula a célula. Lemos a Base inteira em arrays,
  alteramos em memória e gravamos faixas com `setValues`. Histórico também é
  gravado em lote.

---

## 3. Abas

**Visíveis (interface):** `🏠 Home`, `📱 Registro`, `🚨 Dashboard Distrito`,
`📊 Dashboard Zona`, `⚙ Configuração`.

**Ocultas (back-end):** `Base`, `Histórico`, `Emails`, `Logs`, `Sistema`,
`Cache`.

### Modelo de dados (`Base`)

`ID | Nome | Distrito | Área | Início | Data Batismal | Semana | TouchDown |
Plano Igreja | Match | Entrevista | Próximo Passo | Observação | Resultado |
Cor | Última Atualização | Usuário`

A **Semana** é calculada a partir de `Início`. A **Cor** é calculada por
`Colors.gs`.

---

## 4. Lógica de cores (interpretação automática)

| Cor | Significado | Regra (resumo) |
| --- | --- | --- |
| 🔵 Azul | Batizado | `Resultado = Batizado` |
| ⚪ Cinza | Data caiu | `Resultado = Data Caiu` |
| 🟠 Laranja | Sem atualização | última atualização ≥ N dias (config) |
| 🔴 Vermelho | Crítico | semana ≥ 3 sem Entrevista, ou batismo a ≤ N dias sem Entrevista, ou data passou sem batismo |
| 🟡 Amarelo | Pendência | etapa da semana não concluída (TouchDown/Plano/Match) |
| 🟢 Verde | Tudo certo | sem pendências |

### Card inteligente por semana

- **Semana 1** → mostra **TouchDown** e **Plano Igreja**
- **Semana 2** → mostra **Match**
- **Semana 3+** → mostra **Entrevista**

Nunca aparecem campos desnecessários.

---

## 5. Instalação (passo único no desktop)

> Este é o **único** passo que requer um computador. Depois, tudo funciona pelo
> celular.

1. Crie uma planilha nova no Google Sheets.
2. `Extensões → Apps Script`.
3. Copie cada arquivo `.gs` desta pasta para o projeto (mesmos nomes) e cole o
   conteúdo de `appsscript.json` no manifesto (ative "Mostrar arquivo de
   manifesto" nas configurações do projeto).
4. Rode a função **`setupApp`** uma vez e autorize os escopos.
   - Isso cria todas as abas, proteções, validações e **instala os gatilhos**
     (`onEditApp`, `onOpen`, e o de e-mail por hora).
5. (Opcional) Na aba **⚙ Configuração**, marque **"INSERIR DADOS DE EXEMPLO"**
   para popular a Base e experimentar.

> Alternativa com [clasp](https://github.com/google/clasp):
> `clasp create --type sheets`, copie os arquivos, `clasp push`, abra a planilha
> e rode `setupApp`.

---

## 6. Como usar (celular)

- **🏠 Home**: resumo do distrito (críticos, sem atualização, pendentes, em dia)
  e o botão **COMEÇAR REGISTROS**.
- **📱 Registro**: um pesquisador por vez (card). Marque os status da semana,
  preencha Próximo Passo / Observação / Resultado. Use **⬅ Anterior**,
  **💾 Salvar**, **Próximo ➡**. Tudo é salvo automaticamente e registrado no
  histórico.
- **🚨 Dashboard Distrito**: mini-cards ordenados por prioridade
  (Laranja → Vermelho → Amarelo → Verde → Azul → Cinza). Marque **Abrir** para
  ir direto ao Registro daquele pesquisador.
- **📊 Dashboard Zona**: indicadores por distrito (Quantidade, Sem atualização,
  Sem Match, Sem Entrevista, Datas caídas, Reservados). Marque um indicador para
  filtrar e ver **apenas** aqueles pesquisadores.
- **⚙ Configuração**: distrito do líder, limites de alerta, e-mail do LZ e
  notificação por e-mail; além dos botões de manutenção.

---

## 7. Automações (ao alterar qualquer campo)

Toda edição relevante dispara, **automaticamente e em lote**:

- atualização do **Histórico** (campo, valor antigo, valor novo, usuário, data/hora);
- recálculo da **Cor**;
- atualização dos **Dashboards** e da **Home**;
- gravação de **data/hora** e **usuário** da última atualização;
- (opcional) **e-mail** ao LZ quando um pesquisador fica **crítico**.

O LD edita somente: TouchDown, Match, Entrevista (conforme a semana), Plano
Igreja, Próximo Passo, Observação e Resultado. Tudo o mais é automático e
protegido.

---

## 8. Notas de plataforma

- Gatilhos `onEdit` (simples e instaláveis) disparam no app Google Sheets de
  Android/iOS — por isso o app inteiro funciona no celular.
- A navegação programática entre abas (`setActiveSheet`) é usada para parecer um
  app; se em alguma versão do app mobile ela não acompanhar, basta tocar na aba
  desejada na barra inferior.
- As abas de back-end ficam **ocultas e protegidas**: o usuário não as vê nem as
  edita.
