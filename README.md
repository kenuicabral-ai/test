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

**Nível profissional.** O radar não procura só infoproduto amador: ele detecta **trackers de mídia paga** (RedTrack, Hyros, ClickMagick, Voluum, FunnelFlux, Everflow…) e checkouts internacionais (BuyGoods, ClickBank, Digistore24, SamCart, ThriveCart), e descobre ofertas pelos nativos (Taboola, Outbrain, MGID). Quem usa um tracker desses está um nível acima, e isso pesa no score. O arquivo `operacoes.csv` mostra as operações (o mesmo dono rodando vários funis), que é onde está o dinheiro grande.

**Testemunha do urlscan (para não perder oferta cloaked sem proxy).** Quando o radar abre uma página do servidor do GitHub (IP de datacenter), um funil com cloaking por IP mostra a isca, sem player nem checkout — e some do ranking. Mas o urlscan já tinha visto a página real quando a descobrimos (foi o que a trouxe). O radar guarda essa testemunha: "o urlscan viu esta página carregar VTurb / Hotmart / RedTrack". Com isso a oferta entra e pontua mesmo que a nossa leitura caia na isca, e o contraste (urlscan viu, nós não) vira um sinal extra de cloaking. O proxy depois melhora de "sabemos que é oferta" para "conseguimos ler a página inteira".

**Cloaking por IP e o proxy.** O cloaker abre a página real para um clique de anúncio vindo do Facebook no país-alvo. O que falta no servidor do GitHub é o IP: ele é de datacenter, nos EUA. Com um **proxy residencial** no país da oferta (secret `PROXY_URL`), o perfil "clique de anúncio" passa a abrir a página real dos funis com cloaking por IP/geo — enquanto o perfil robô continua indo direto, então o contraste ainda denuncia o cloaking. Proxies residenciais custam pouco (cobrados por GB). Sem o proxy, o radar ainda vê tudo que não é cloaked por IP; com ele, alcança as operações profissionais que se escondem.

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
- **Cota do urlscan:** o urlscan conta cada *busca*, não cada resultado. No início da rodada o radar lê quantas buscas restam (no próprio urlscan) e reparte: a descoberta lê só o que é novo desde a rodada anterior (uma busca por assinatura), o histórico de 180 dias é preenchido aos poucos com no máximo metade da cota, e as varreduras e a expansão por IP são feitas em lote (dezenas de domínios ou IPs por busca). Rodar várias vezes no mesmo dia não queima a cota: a segunda rodada só lê as últimas horas.
- **Freios automáticos:** se o urlscan esgotar a cota ou o crt.sh cair, o radar para de consultá-los naquela rodada e continua com o resto. O que faltou é retomado no dia seguinte.
- **Rodadas em fila:** um push com a rodada em andamento não a cancela mais; a nova espera a atual terminar (cancelar jogava fora a cota já gasta). E mesmo uma rodada cancelada na mão salva o que coletou.
- **Certstream:** o servidor público não enviou certificados nos testes, então ele não roda no GitHub. As ofertas novas entram pelo urlscan (que também pega páginas recém-criadas) e pela busca no crt.sh. O comando `certstream` continua disponível para rodar num computador.
- **Domínios que não couberam no dia** ficam na fila e são processados nas próximas rodadas. O banco é salvo na branch `dados` ao fim de cada rodada (só se estiver íntegro).
- **Testes:** cada push roda também o workflow **Testes** (alguns segundos, sem rede, sem gastar cota).
- **Limite:** os servidores do GitHub usam IP de datacenter, e cloaking que bloqueia esses IPs esconde a página do radar. Os sinais de infraestrutura (urlscan, certificados, Tranco) continuam funcionando.

## Instalar no computador (opcional)

```bash
pip install -r requirements.txt
python radar.py init
```

Abra o `config.json` e preencha as chaves que tiver. Todas são opcionais, mas cada uma aumenta a cobertura:

| Chave | Custo | O que libera |
|---|---|---|
| `urlscan_api_key` | grátis (cadastro em urlscan.io) | Mais buscas por dia e páginas de até 1000 resultados em vez de 100. **Faça isso primeiro.** |
| `publicwww_api_key` | pago | Expansão em grafo por GTM, Pixel e produto: acha os outros domínios da mesma operação |
| `anthropic_api_key` | por uso | Classifica cada oferta por tipo, nicho e promessa |

## Rodar

```bash
python radar.py run
```

Abra `saida/ranking.html`. Também saem `ranking_ofertas.csv` e `ranking_dominios.csv`.

O que a rodada faz:

1. **Descobre** no urlscan as páginas que carregaram VTurb, Panda, Vidalytics, Utmify, os checkouts e os trackers. Cada busca lembra até onde já foi lida: por dia, só o que apareceu desde a rodada anterior; o histórico de 180 dias entra aos poucos. Isso pega ofertas antigas e novas, porque depende de a página existir e ser visitada, não de palavras-chave. Cada resultado já traz a data de registro do domínio, que vira a idade da oferta.
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

### Banco de anúncios por API (recomendado): Apify

A API oficial da Meta não serve: ela não devolve a URL de destino de forma confiável e só cobre anúncio comercial na Europa. O que funciona para BR/EUA é o **Apify Facebook Ads Library Scraper**, que roda a Biblioteca e devolve, por API, o destino (`linkUrl`), o anunciante (`pageId`/`pageName`), a data de início e se o anúncio tem vídeo — em qualquer país. É a versão automática da extensão: puxa anúncios reais do lado do servidor, sem você navegar. Pago por uso (a partir de ~US$4 por 1.000 anúncios), com crédito grátis mensal para começar.

Ligar no GitHub:
1. Crie conta em apify.com, pegue o **API token** (Settings → Integrations).
2. Em **Settings → Secrets and variables → Actions**: secret `APIFY_TOKEN` = seu token.
3. Em **Variables** (mesma tela), defina o que puxar:
   - `APIFY_SEARCHES`: uma busca por linha — um termo (`emagrecer`), um `page_id`, ou uma URL pronta da Biblioteca.
   - `APIFY_AUTO`: um número N. O radar puxa automaticamente **todos os anúncios dos N anunciantes que ele já achou** (pelo `page_id`). É o ciclo que se fecha sozinho: achou o dono, puxa a operação inteira, os destinos voltam para o radar.

Os anúncios do Apify entram no mesmo score (idade, vídeo, volume) e já trazem o anunciante com link exato da Biblioteca. Sem `APIFY_TOKEN`, nada disso roda e nada é cobrado.

Na mão, sem API: `python radar.py apify` (com `apify_token` no config.json).

### Juntar com outros bancos de anúncios (AdHeart, BigSpy, Dropispy, Minea…)

```bash
python radar.py importar-urls export_adheart.csv
```

Exporte (ou copie) as URLs de destino de qualquer ferramenta de espionagem e jogue aqui. O comando lê o arquivo em qualquer formato, extrai todos os domínios de destino e põe no radar — que então escaneia cada um por IP, certificado, pixel e operação, do mesmo jeito que os outros. Assim você aproveita o banco deles e ele vira combustível para o seu. Se a ferramenta tiver API, dá para automatizar o download antes desse comando.

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

- **Estágio:** `crescendo` = ganhou anúncios ou visitas na semana (precisa de 7 dias de histórico); senão `nova` (até 30 dias de vida) ou `estabelecida` (mais). A idade é a data de registro do domínio (o urlscan informa); sem ela, o primeiro certificado ou a primeira varredura. Nos primeiros 7 dias quase tudo é nova/estabelecida; "crescendo" começa a aparecer depois.
- **Tráfego:** a rede de anúncio detectada pelo pixel na página (meta, google, tiktok, taboola, outbrain, mgid…). É onde procurar os criativos. Vazio = nenhum pixel conhecido achado (comum em página com cloaking ou que injeta o pixel por JavaScript; use `--render`).
- **Domínios ativos/total:** muitos domínios na mesma oferta = operação grande, que troca de domínio para escalar.
- **Varred. 30d:** quantas vezes a página foi varrida no urlscan no último mês. Sinal indireto de circulação.
- **Tranco:** quanto menor, mais tráfego. Uma oferta no top 1M é grande.

Página fora do ar perde 75% do score. Conta como fora do ar também a página que responde mas não vende: "Loja Fechada", domínio à venda, conta suspensa, 404 disfarçado. Lojas virtuais (10 ou mais produtos no checkout) não entram no ranking, a não ser que tenham player de VSL. Veja de onde veio cada ponto em `ranking_dominios.csv` → `score_parts`.

## Onde achar os anúncios de uma oferta

A coluna **Anunciante** já resolve isso na maioria dos casos: o sistema lê o Facebook, o Instagram e o WhatsApp que a própria página do funil expõe e, quando acha o Facebook, monta um link que abre **todos os anúncios ativos daquele anunciante** na Biblioteca da Meta (pelo ID numérico da página quando disponível, senão por busca). É o caminho certo, porque a Biblioteca não busca por URL de destino, só por anunciante. O ID do pixel da Meta não serve: ele identifica o pixel, não a página, e não há como converter um no outro.

O arquivo **`anunciantes.csv`** junta tudo por anunciante: cada operador achado, o link que abre os anúncios dele, e as ofertas que ele roda. Use-o como **lista de trabalho da extensão**: em vez de buscar palavras ao acaso, abra os anúncios de cada anunciante (a Biblioteca é exaustiva por página) e deixe a extensão colher os destinos — que voltam para o radar e revelam os outros domínios do mesmo operador. É o ciclo que cresce sozinho.

Quando a coluna Anunciante estiver vazia, caia para a coluna **Tráfego**:

- **meta** → Biblioteca de Anúncios da Meta, buscando o nome do anunciante ou o nome do produto (está no título da VSL).
- **google** → Google Ads Transparency Center (`adstransparency.google.com`), que busca por anunciante e por região. Cobre YouTube.
- **tiktok** → TikTok Commercial Content Library.
- **taboola / outbrain / mgid / revcontent** → são redes nativas (aqueles "notícias" tipo CNN/CBS). Os criativos ficam em ferramentas pagas de espionagem de nativos; sem elas, procure o título do advertorial.
- **vazio** → a oferta pode não estar anunciando no momento, estar com cloaking, ou injetar o pixel por JavaScript (rode com `--render` para pegar esses).

## Ajustes

- **Novo player ou checkout:** adicione em `radar/signatures.py` e acrescente `domain:novoplayer.com` em `urlscan_queries`.
- **Mais páginas por rodada:** `urlscan_max_per_query` (máximo de varreduras lidas por busca em cada rodada). `urlscan_discovery_share` define quanto da cota o histórico pode usar (padrão 0.5).
- **Análise mais profunda:** `python radar.py run --render` usa o Chromium (instale o `playwright`), o que pega scripts carregados por JavaScript. É mais lento.
- **Comandos separados:** `descobrir`, `analisar`, `expandir`, `enriquecer`, `ranking` (sem rede), `classificar`.
- **Testes:** `pip install pytest` e `python -m pytest -q tests` (sem rede; o urlscan é simulado).

## O que continua fora

- Páginas que nunca foram visitadas por ninguém que usa o urlscan e não estão no Certstream nem nos anúncios importados. Ligue o `certstream` para fechar essa porta nas ofertas novas.
- Cloaking que filtra por IP residencial de verdade. Rodar do seu computador (IP residencial) já ajuda.
- Funis que mostram o checkout só depois do vídeo. O player sozinho já as coloca no ranking, mas sem o produto elas ficam agrupadas por operação.
- O score mede sinais, não faturamento.
