# Radar de Ofertas

Sistema que roda no seu computador e monta um **ranking de ofertas de resposta direta**, novas e antigas, a partir de rastros que o anunciante não consegue esconder:

| Rastro | Por que não dá para esconder | Fonte usada |
|---|---|---|
| Player da VSL e pixel de rastreamento | Precisam carregar no navegador de quem compra | urlscan (varreduras públicas de páginas) |
| Certificado HTTPS | Todo certificado vai para logs públicos obrigatórios | Certstream (tempo real) e crt.sh (histórico) |
| Checkout e IDs (GTM, Pixel, produto) | Precisam estar na página para vender e medir | Análise da página + grafo |
| Tráfego | Visitas reais aparecem em rankings | Tranco (top 1M) e volume de varreduras |
| Anúncios | O que está sendo pago agora | CSV da extensão (opcional) |

Cloaking vira sinal: o sistema visita cada página **como quem clicou no anúncio** (celular, app do Facebook, `fbclid`) e **como um robô**. Se só a primeira vê VSL/checkout, a página está escondendo algo, e quem esconde está pagando tráfego.

## Rodar sozinho no GitHub, com resultados no Telegram (sem computador)

O arquivo `.github/workflows/radar.yml` faz o GitHub rodar o radar **todo dia às 07:00** (Brasília) e mandar o resultado para o seu Telegram: top 10, ofertas que entraram no dia, `ranking.html` e `ranking_ofertas.csv`.

Secrets do repositório (**Settings → Secrets and variables → Actions**):

| Secret | Obrigatório | O que é |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | sim | Token do bot criado no @BotFather. Mande um "oi" para o bot antes da 1ª rodada. |
| `URLSCAN_API_KEY` | recomendado | Chave gratuita do urlscan.io |
| `PUBLICWWW_API_KEY` | opcional | Liga a expansão por GTM, Pixel e produto |
| `ANTHROPIC_API_KEY` | opcional | Classifica nicho e promessa |

- **Rodar na hora:** aba **Actions → Radar de Ofertas → Run workflow**.
- **Ver os dados no GitHub:** branch `dados`, arquivo `saida/ranking_ofertas.csv` (o GitHub mostra como tabela).
- **Tempo por rodada:** cerca de 55 minutos (50 de radar + preparação). Em repositório público os minutos do GitHub Actions são ilimitados; em privado, cabem nos 2.000 minutos mensais gratuitos. Para mudar, crie a variável `RADAR_MAX_MINUTES` em **Settings → Secrets and variables → Actions → Variables**.
- **Freios automáticos:** se o urlscan esgotar a cota ou o crt.sh cair, o radar para de consultá-los naquela rodada e continua com o resto. O que faltou é retomado no dia seguinte.
- **Certstream:** o servidor público não enviou certificados nos testes, então ele não roda no GitHub. As ofertas novas entram pelo urlscan (que também pega páginas recém-criadas) e pela busca no crt.sh. O comando `certstream` continua disponível para rodar num computador.
- **Domínios que não couberam no dia** ficam na fila e são processados nas próximas rodadas. O banco é salvo na branch `dados` ao fim de cada rodada.
- **Limite:** os servidores do GitHub usam IP de datacenter, e cloaking que bloqueia esses IPs esconde a página do radar. Os sinais de infraestrutura (urlscan, certificados, Tranco) continuam funcionando.

## Instalar no computador (opcional)

```bash
pip install -r requirements.txt
python radar.py init
```

Abra o `config.json` e preencha as chaves que tiver. Todas são opcionais, mas cada uma aumenta a cobertura:

| Chave | Custo | O que libera |
|---|---|---|
| `urlscan_api_key` | grátis (cadastro em urlscan.io) | Até 10 mil resultados por busca em vez de 100. **Faça isso primeiro.** |
| `publicwww_api_key` | pago | Expansão em grafo por GTM, Pixel e produto: acha os outros domínios da mesma operação |
| `anthropic_api_key` | por uso | Classifica cada oferta por tipo, nicho e promessa |

## Rodar

```bash
python radar.py run
```

Abra `saida/ranking.html`. Também saem `ranking_ofertas.csv` e `ranking_dominios.csv`.

O que a rodada faz:

1. **Descobre** no urlscan todas as páginas que carregaram VTurb, Panda, Vidalytics ou Utmify nos últimos 180 dias. Isso pega ofertas antigas e novas, porque depende de a página existir e ser visitada, não de palavras-chave.
2. **Analisa** cada domínio: player, checkout, produto, GTM, GA4, Pixel, cloaking e se está no ar.
3. **Expande** pelo grafo: o mesmo IP (só servidores pequenos), o mesmo certificado, o mesmo GTM, Pixel ou produto (com PublicWWW). Cada oferta achada leva às irmãs.
4. **Enriquece**: idade pelo primeiro certificado, renovações (oferta que dura renova o certificado), volume de varreduras nos últimos 30 dias e posição no Tranco.
5. **Agrupa** domínios em operações e em ofertas (o mesmo produto no checkout = a mesma oferta).
6. **Pontua** de 0 a 100 e gera o ranking.

### Ofertas nascendo (deixe rodando numa janela)

```bash
python radar.py certstream
```

Guarda cada domínio novo cujo nome bate com os padrões do `config.json` (`certstream_patterns`). Na próxima rodada (`python radar.py run --sem-descoberta`), só ficam no ranking os que realmente têm VSL ou checkout. O padrão é só um funil de entrada: quem decide é a análise da página.

Se o servidor público do Certstream estiver fora, troque `certstream_url` ou use `crtsh_keywords` (busca certificados dos últimos 7 dias no crt.sh dentro do `run`).

### Juntar com a extensão

```bash
python radar.py importar anuncios_2026-10-15.csv
```

Os domínios de destino entram no sistema, e as idades dos anúncios, a quantidade e os vídeos entram no score. Encurtadores e trackers são seguidos até a página final.

### Sementes manuais

Crie `sementes.txt` (um domínio por linha). Ele é lido a cada `run`. Bom para ofertas que você viu em grupos, marketplaces ou concorrentes.

## Rotina diária automática

Rode `python radar.py run` uma vez por dia. O histórico (`snapshots`) faz o score de **momento** funcionar: ofertas que ganharam anúncios ou visitas na última semana sobem.

- **Windows:** Agendador de Tarefas → Criar tarefa básica → Diariamente → programa `python`, argumentos `radar.py run`, iniciar em: a pasta do radar.
- **Mac/Linux:** `crontab -e` e adicione `0 7 * * * cd /caminho/radar-ofertas && python3 radar.py run >> radar.log 2>&1`

## Como ler o ranking

Cada oferta tem **duas notas separadas**, para não enterrar ofertas novas e fortes:

- **Força (0–100):** o quanto a página parece um funil real sendo anunciado agora. Não depende de tempo. Soma: checkout de infoproduto (15), player de VSL VTurb/Panda/Vidalytics (12), pixel de rede de anúncio (10, prova de tráfego pago), tamanho da operação (7), cloaking (6), player genérico (5), texto de VSL (3).
- **Tração (0–100):** o quanto a oferta é grande/estabelecida. Depende de tempo e volume: idade dos anúncios (20), Tranco (10), momento (10), varreduras 30d (8), longevidade (8), volume/vídeo/páginas de anúncio, renovações de certificado.
- **Score = 60% Força + 40% Tração.** Assim uma oferta nova e bem montada aparece no topo pela Força, mesmo sem tração ainda. **Ordene pela coluna Força** para ver os melhores funis recém-nascidos; pela Tração, os já comprovados.
- A Tração é calculada só sobre o que dá para medir hoje. Enquanto você não importar anúncios da extensão e não houver 7 dias de histórico, esses pilares ficam de fora da conta, em vez de puxar todo mundo para baixo.

Outras colunas:

- **Estágio:** `crescendo` = ganhou anúncios ou visitas na semana (precisa de 7 dias de histórico); senão `nova` (até 30 dias de vida) ou `estabelecida` (mais). Nos primeiros 7 dias quase tudo é nova/estabelecida; "crescendo" começa a aparecer depois.
- **Tráfego:** a rede de anúncio detectada pelo pixel na página (meta, google, tiktok, taboola, outbrain, mgid…). É onde procurar os criativos. Vazio = nenhum pixel conhecido achado (comum em página com cloaking ou que injeta o pixel por JavaScript; use `--render`).
- **Domínios ativos/total:** muitos domínios na mesma oferta = operação grande, que troca de domínio para escalar.
- **Varred. 30d:** quantas vezes a página foi varrida no urlscan no último mês. Sinal indireto de circulação.
- **Tranco:** quanto menor, mais tráfego. Uma oferta no top 1M é grande.

Página fora do ar perde 75% do score. Veja de onde veio cada ponto em `ranking_dominios.csv` → `score_parts`.

## Onde achar os anúncios de uma oferta

A Biblioteca de Anúncios da Meta **não** busca por URL de destino, só por nome de anunciante ou palavra. Por isso procurar o domínio lá não acha nada. Use a coluna **Tráfego**:

- **meta** → Biblioteca de Anúncios da Meta, buscando o nome do anunciante ou o nome do produto (está no título da VSL).
- **google** → Google Ads Transparency Center (`adstransparency.google.com`), que busca por anunciante e por região. Cobre YouTube.
- **tiktok** → TikTok Commercial Content Library.
- **taboola / outbrain / mgid / revcontent** → são redes nativas (aqueles "notícias" tipo CNN/CBS). Os criativos ficam em ferramentas pagas de espionagem de nativos; sem elas, procure o título do advertorial.
- **vazio** → a oferta pode não estar anunciando no momento, estar com cloaking, ou injetar o pixel por JavaScript (rode com `--render` para pegar esses).

## Ajustes

- **Novo player ou checkout:** adicione em `radar/signatures.py` e acrescente `domain:novoplayer.com` em `urlscan_queries`.
- **Mais páginas por rodada:** `urlscan_max_per_query` (com a chave gratuita, até 10000).
- **Análise mais profunda:** `python radar.py run --render` usa o Chromium (instale o `playwright`), o que pega scripts carregados por JavaScript. É mais lento.
- **Comandos separados:** `descobrir`, `analisar`, `expandir`, `enriquecer`, `ranking` (sem rede), `classificar`.

## O que continua fora

- Páginas que nunca foram visitadas por ninguém que usa o urlscan e não estão no Certstream nem nos anúncios importados. Ligue o `certstream` para fechar essa porta nas ofertas novas.
- Cloaking que filtra por IP residencial de verdade. Rodar do seu computador (IP residencial) já ajuda.
- Funis que mostram o checkout só depois do vídeo. O player sozinho já as coloca no ranking, mas sem o produto elas ficam agrupadas por operação.
- O score mede sinais, não faturamento.
