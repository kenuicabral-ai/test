# Sistema de Datas Batismais

Este repositório contém um MVP em Google Apps Script para criar automaticamente:

- Dashboard LZ
- Datas Ativas
- Datas Caídas
- Config
- Reservados
- Histórico oculto para cálculo de progresso

## Como instalar

1. Crie uma planilha no Google Sheets.
2. Abra **Extensões > Apps Script**.
3. Copie todo o conteúdo de `google-apps-script-batismos.gs`.
4. Cole em `Code.gs`.
5. Salve.
6. Execute a função `setupSistemaBatismos`.
7. Autorize as permissões solicitadas.
8. Volte para a planilha e use o menu **Batismos**.

## O que o script faz

- Cria as abas com cabeçalhos e formatação.
- Configura dropdowns para status, TouchDown, match, entrevista, bloqueio, resultado e reserva.
- Lê emails recentes do Gmail enviados por `noreply-missionary-info@mail.churchofjesuschrist.org` com assunto `Batismo marcado`.
- Extrai nome, área e data batismal quando o email segue padrão semelhante a:

```text
Subject: Batismo marcado na área São José do Norte

São José do Norte acabou de agendar o batismo de Emily para o dia Jun 29, 2026.
Entre em contato com a área São José do Norte para marcar a entrevista batismal.
```

- Cria registros em **Datas Ativas**.
- Usa `Semana 1`, `Semana 2` e `Semana 3` em vez de uma data na coluna Semana.
- Organiza a aba **Datas Ativas** para uso no celular:
  - Nome
  - Semana
  - TouchDown
  - Match
  - Entrevista
  - Status
  - Próxima Ação
  - Plano Igreja
  - Data Batismal
  - Área
  - Distrito
- Atualiza automaticamente **Última Atualização** quando o LD altera campos principais.
- Atualiza **Último Próximo Passo** quando o LD muda a coluna `Próxima Ação`.
- Move para **Datas Caídas** quando `Resultado da Data` vira `Data Caiu`.
- Move para **Reservados** quando alguém passa 3 dias sem novo próximo passo.
- Só tira alguém de **Reservados** quando a coluna `Reserva` é alterada manualmente para `Não`.
- Atualiza o **Dashboard LZ** com uma tabela por distrito, separada por área.

## Lógica das semanas

- **Semana 1**: mais de uma semana antes da semana do batismo.
  - Prioridades: plano para ir à igreja e data batismal.
- **Semana 2**: semana anterior à semana do batismo.
  - Prioridades: acompanhar a data e ter match.
- **Semana 3**: semana do batismo.
  - Prioridade: entrevista batismal.

## Cores das linhas

- **Laranja**: sem novo próximo passo há mais de 24h.
- **Amarelo**: falta uma prioridade da semana.
- **Vermelho**: faltam duas prioridades da semana, ou está na semana do batismo sem entrevista.
- **Verde**: tudo em dia a partir de quinta-feira.
- **Branco**: tudo normal antes de quinta-feira.

O TouchDown só é foco da primeira semana; depois da primeira semana ele não deixa a linha vermelha para sempre.

## Alertas para LZs

Na aba **Config**, preencha a coluna `Email LZ` ao lado do distrito/área. O script envia um alerta diário com as pessoas sem novo próximo passo há mais de 24h.

## Ajuste importante

Se os emails tiverem outro formato, ajuste no script:

```javascript
var EMAIL_SEARCH_QUERY = 'newer_than:90d from:noreply-missionary-info@mail.churchofjesuschrist.org subject:"Batismo marcado" -label:' + PROCESSED_LABEL_NAME;
```

Também é possível adicionar apelidos de áreas na aba **Config**, coluna `Aliases da Área`.
