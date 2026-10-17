# Changelog

Mudanças do radar, da mais recente para a mais antiga. Cada entrada diz o que mudou, por quê (o que os dados mostraram) e como foi verificado.

## 2026-10-17 — Caminho para os anúncios da Meta em quase toda oferta (PR #7)

**Por quê:** 239 das 300 ofertas do topo têm o pixel da Meta (anunciam no Facebook/Instagram), mas só 18% tinham link para a Biblioteca de Anúncios — porque o link só era gerado quando achávamos o Facebook do anunciante na página, o que falha na maioria das VSLs (cloaking, ou a página simplesmente não linka a fanpage).

- **page_id numérico** reconhecido em mais formatos (`facebook.com/Nome-Da-Pagina-123…`, `"pageId":…`, `fb_page_id`): abre os anúncios exatos do anunciante.
- **Busca por nome do produto:** quando a página tem pixel da Meta mas não achamos o anunciante, o radar gera um link de busca na Biblioteca pelo nome do produto tirado do título da VSL (`VSL - Linfozen` → `Linfozen`), ignorando títulos genéricos ou com acento quebrado. É o que um humano faria à mão.
- O ranking distingue **"ver anúncios"** (exato, pelo anunciante) de **"Meta (busca)"** (ponto de partida por palavra), para não prometer precisão que não tem.

**Verificado no banco de produção:** cobertura de link Meta no top 300 subiu de 18% para 76% (14 exatos, 216 por busca). 52 testes (sem pixel Meta não gera busca; page_id numérico dá link exato).

## 2026-10-17 — Assinatura da página escalada: heatmaps/gravadores de sessão e VSL por HLS (PR #6)

**Por quê:** operação de resposta direta que investe em otimização instala gravador de sessão e mapa de calor (Microsoft Clarity, Hotjar, Lucky Orange, FullStory, Smartlook, Mouseflow). É um sinal de escala que o radar ignorava, e que separa o funil amador do profissional. Algumas VSLs também servem o vídeo por HLS (`.m3u8`) sem usar um player conhecido.

- Detecta os seis gravadores de sessão/heatmap na página e grava como `heatmap`. Entra na Força (operação que otimiza, peso 6) e na Escala (operação inteira, peso 6).
- Player `hls` por `.m3u8`: reforça que a página tem VSL (peso de player comum, não forte — só VTurb/Panda/Vidalytics são fortes).
- Coluna Tracker no ranking passa a mostrar também os heatmaps.

**Escopo:** isto é leitura de sinais na página, do mesmo jeito que o radar já lê pixel e checkout. Não inclui (e o projeto não fará) burlar a detecção de cloaker — navegador anti-detecção, aquecimento de cookies, simulação de comportamento humano ou exportar/injetar a sessão aprovada. O cloaking continua tratado pela testemunha do urlscan (PR #3) e pelo proxy residencial opcional.

**Verificado:** 49 testes (snippets reais de Clarity e Hotjar; `.m3u8` conta como player comum, não forte).

## 2026-10-17 — Escala no topo: nota de Escala por oferta e limpeza de ruído e agrupamento (PR #5)

**Por quê (banco da rodada #21, auditado em 5 ângulos com simulação no pipeline real):** o topo era só "cara de funil" (Força), e a Tração olhava um domínio só. Das 300 primeiras, 39 eram ruído: SaaS e marcas que entravam só porque o urlscan viu o tracker Hyros (porkbun.com, um CRM, uma loja de roupas), portais de curso da ThriveCart agrupados por uma pasta de CDN, ambientes de revisão da Digistore24 (ds25.io, 120 "ofertas"), páginas "Coming Soon". Produtos diferentes do mesmo fornecedor eram fundidos pelo GTM dele.

- **Escala (0–100) por oferta**, somando todos os domínios: varreduras no urlscan, domínios ativos distintos (afiliados/landers), operação, rotação de pixel, longevidade, anúncios (se consultados), redes, Tranco. Só sinais medidos entram na conta. **Score = 40% Força + 60% Escala**, com a Escala pesando inteira a partir de Força 50 (sem funil, volume é popularidade). Porte vem da Escala. HTML e Telegram mostram Força e Escala.
- **Ruído:** testemunha só de tracker genérico (Hyros, ClickMagick, RedTrack) não faz oferta (Utmify sim); áreas de membros/login fora; hosts das plataformas (ds25.io, checkout-ds24, jvzoo, ClickMagick, Kartra…) fora; top 50 mil do Tranco (também pelo domínio raiz) fora; lojas de catálogo por marcadores e pelo nº de links para a plataforma de checkout; mais títulos e endereços de página morta.
- **Agrupamento:** IDs de exemplo/provedor não ligam domínios; conta e vídeo da VTurb viram vínculo; pastas de CDN, tokens assinados e "SEU-LINK-AQUI" não viram produto; URL temporária da HostGator não vira irmã de certificado; redirect para site comum/governo não liga; produto herdado só de vizinho direto.

**Verificado no banco de produção:** 1.572 falsas ofertas a menos; topo 40 com Linfozen, ElectroSlim, VitalFlush, Breathe, ProDentim, Arctic Blast, Sciaticyl, SlimTide (cloaking, de 1.526º para 21º). 47 testes.

## 2026-10-17 — Anúncios de cada oferta: links oficiais por rede e Google por API opcional (PR #4)

**Por quê:** só 463 das 12.236 ofertas tinham link para a Biblioteca da Meta (precisa achar o anunciante na página), e nenhuma tinha caminho para os anúncios no Google/YouTube ou no TikTok, mesmo quando o pixel dessas redes estava na página.

- Coluna **Ver anúncios** (ranking.html, CSV e Telegram): Meta pelo anunciante; **Google Ads Transparency Center pelo domínio** (exato, cobre Google e YouTube, funciona sem achar o anunciante); TikTok pelo nome do anunciante quando o pixel do TikTok está na página (a biblioteca do TikTok só cobre anúncios na Europa).
- Conector **opcional e desligado** do Google Ads Transparency via SerpApi (pago por busca): só roda com o secret `SERPAPI_KEY`, até `SERPAPI_MAX` (10) ofertas por rodada. Traz nº de anúncios, dias no ar do mais antigo, vídeos e o anunciante verificado pelo Google.
- Correção no score: bastava um domínio ter dado de anúncio para os pilares de anúncio entrarem na Tração de todos, puxando para baixo quem nunca foi consultado. Agora contam só para quem foi consultado.

**Verificado:** 33 testes (SerpApi simulada: sem chave não chama nada; 429 para na hora; consultado não é refeito na semana). Links conferidos no ranking do banco de produção.

## 2026-10-17 — Testemunha do urlscan lê a página real das ofertas com cloaking (PR #3)

**Por quê:** com cloaking por IP, a nossa visita (servidor do GitHub, IP de datacenter) cai na página isca e a oferta perde player, pixel e checkout no ranking. Ofertas reais como `myslimtide.com`, `trysciaticyl.com` e `sodaslim.com` apareciam sem nada disso, embora o urlscan tivesse visto a página real ("home - SlimTide").

- A busca no urlscan já devolve a varredura mais recente de cada domínio e o título que ela viu: agora isso é guardado (sem custo).
- Passo novo `testemunha` (também na rodada): para as ofertas sem player/checkout na nossa leitura, ou com cloaking, lê o resultado da varredura (endereços pedidos e links da página) e extrai player, ID do vídeo, pixel, GTM, checkout/produto, tracker e redes sociais do anunciante. Exige a chave do urlscan, usa a cota de leitura (separada da de busca), lê cada varredura uma vez e no máximo 300 por rodada.
- Esses sinais continuam valendo quando a nossa visita volta a ver a isca. No ranking: título da página real e coluna `visto_pelo_urlscan`.
- IDs de pixel, GA4 e TikTok também reconhecidos pelas URLs (`facebook.com/tr?id=`, `<noscript>`), não só pelo `fbq('init')`.
- Páginas mortas pelo título (estacionada, expirada) corrigidas já no ranking, sem esperar a reanálise: 34 no banco de produção; `viralpackage.shop` saiu do 2º lugar.

**Honestidade:** a leitura mostra o que o urlscan viu na data da varredura (pode ser antiga); cloaking que só abre para IP residencial no país continua exigindo proxy para a nossa própria leitura.

**Verificado:** 28 testes com o resultado do urlscan simulado (formato da API). A API de resultado exige chave, então não deu para testar ao vivo daqui; a confirmação vem do log da próxima rodada (linha "varreduras lidas").

## 2026-10-17 — Fila de análise por prioridade; páginas estacionadas não viram "operação" (PR #2)

**Por quê (rodada #21, a primeira com o PR #1):** a descoberta incremental trouxe 25.998 domínios novos, mas só 2.823 foram analisados e 23.585 ficaram na fila, na ordem de descoberta; 23.302 vinham só do pixel de nativos (anunciantes comuns). O 2º lugar era `viralpackage.shop` ("Your domain is expired"): 28 páginas de estacionamento da Hostinger ligadas pelo mesmo Google Analytics do provedor (`UA-26575989-44`). As 7.920 varreduras feitas no urlscan não foram marcadas porque o crt.sh não teve tempo, e seriam refeitas todo dia.

- Fila de análise: primeiro o que o urlscan viu com player/checkout e o que veio de anúncio, semente ou redirect; depois reanálise das ofertas; tracker; por último o pixel de nativos.
- Domínio sem DNS responde na hora; página que não abriu pula a visita do robô. CI com 48 análises em paralelo e timeout de 15 s.
- urlscan e crt.sh com datas separadas: crt.sh fora do ar não faz refazer as varreduras.
- Buscas de pixel de nativos só leem o que é novo, sem histórico de 180 dias.
- Página estacionada/expirada não guarda IDs de rastreamento (são do provedor). Novos títulos de página morta: "domain is expired", "domínio expirado".
- Chave de produto `samcart:tracker` descartada (juntava 12 lojas).

**Verificado:** no banco de produção, a fila nova põe os 2.372 domínios com testemunha de player/checkout na frente; 150 analisados com 35% de VSL/checkout, contra 7,6% na ordem antiga. 21 testes com rede simulada.

## 2026-10-17 — Cota do urlscan, idade real, ofertas sem agrupamento falso (PR #1)

**Por quê:** na rodada de 16/10 a cota do urlscan já estava esgotada na 1ª busca (0 domínios novos): cada push disparava uma rodada inteira e as canceladas não salvavam nada. O 1º lugar do ranking era falso (`centrorobux.com.br` juntava 20 lojas sem relação pela chave `cartpanda:shopify`). Só 120 de 2.296 domínios tinham idade e quase tudo aparecia como "nova".

- Descoberta incremental no urlscan: cada busca lembra até onde foi lida; por dia só o que é novo; histórico de 180 dias preenchido aos poucos com no máximo metade da cota.
- Cota lida no próprio urlscan e repartida entre as etapas; varreduras e expansão por IP em lote (40 por busca).
- Idade pela data de registro do domínio (o urlscan já informa, sem custo).
- Chaves de produto genéricas e arquivos das plataformas não agrupam mais ofertas; lojas virtuais saem do ranking; "Loja Fechada", domínio à venda e 404 disfarçado contam como fora do ar.
- Nativos pelo pixel do anunciante (Taboola `tfa.js`, Outbrain `amplify`) em vez dos widgets de portais.
- Workflow: rodada nova espera a atual; dados salvos mesmo se cancelada (só com banco íntegro); testes a cada push.

**Verificado:** rodada real numa cópia do banco, sem chave: 1.496 domínios novos e varreduras de 950 domínios com menos de 100 buscas; 2.342 domínios com idade real; 15 testes com urlscan simulado.
