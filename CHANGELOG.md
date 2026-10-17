# Changelog

Mudanças do radar, da mais recente para a mais antiga. Cada entrada diz o que mudou, por quê (o que os dados mostraram) e como foi verificado.

## 2026-10-17 — Cota do urlscan, idade real, ofertas sem agrupamento falso (PR #1)

**Por quê:** na rodada de 16/10 a cota do urlscan já estava esgotada na 1ª busca (0 domínios novos): cada push disparava uma rodada inteira e as canceladas não salvavam nada. O 1º lugar do ranking era falso (`centrorobux.com.br` juntava 20 lojas sem relação pela chave `cartpanda:shopify`). Só 120 de 2.296 domínios tinham idade e quase tudo aparecia como "nova".

- Descoberta incremental no urlscan: cada busca lembra até onde foi lida; por dia só o que é novo; histórico de 180 dias preenchido aos poucos com no máximo metade da cota.
- Cota lida no próprio urlscan e repartida entre as etapas; varreduras e expansão por IP em lote (40 por busca).
- Idade pela data de registro do domínio (o urlscan já informa, sem custo).
- Chaves de produto genéricas e arquivos das plataformas não agrupam mais ofertas; lojas virtuais saem do ranking; "Loja Fechada", domínio à venda e 404 disfarçado contam como fora do ar.
- Nativos pelo pixel do anunciante (Taboola `tfa.js`, Outbrain `amplify`) em vez dos widgets de portais.
- Workflow: rodada nova espera a atual; dados salvos mesmo se cancelada (só com banco íntegro); testes a cada push.

**Verificado:** rodada real numa cópia do banco, sem chave: 1.496 domínios novos e varreduras de 950 domínios com menos de 100 buscas; 2.342 domínios com idade real; 15 testes com urlscan simulado.
