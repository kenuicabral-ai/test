# Sistema de Datas Batismais

Este repositório contém um MVP em Google Apps Script para criar automaticamente:

- Dashboard LZ
- Datas Ativas
- Datas Caídas
- Config
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
- Configura dropdowns para status, match, TouchDown, entrevista, bloqueio e resultado.
- Lê emails recentes do Gmail enviados por `noreply-missionary-info@mail.churchofjesuschrist.org` com assunto `Batismo marcado`.
- Extrai nome, área e data batismal quando o email segue padrão semelhante a:

```text
Subject: Batismo marcado na área São José do Norte

São José do Norte acabou de agendar o batismo de Emily para o dia Jun 29, 2026.
Entre em contato com a área São José do Norte para marcar a entrevista batismal.
```

- Cria registros em **Datas Ativas**.
- Atualiza automaticamente **Última Atualização** quando o LD altera campos principais.
- Move para **Datas Caídas** quando `Resultado da Data` vira `Data Caiu`.
- Atualiza o **Dashboard LZ**.

## Ajuste importante

Se os emails tiverem outro formato, ajuste no script:

```javascript
var EMAIL_SEARCH_QUERY = 'newer_than:90d from:noreply-missionary-info@mail.churchofjesuschrist.org subject:"Batismo marcado" -label:' + PROCESSED_LABEL_NAME;
```

Também é possível adicionar apelidos de áreas na aba **Config**, coluna `Aliases da Área`.
