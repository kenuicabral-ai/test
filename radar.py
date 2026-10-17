#!/usr/bin/env python3
"""Radar de Ofertas: descobre, analisa, agrupa e ranqueia ofertas de resposta direta.

Uso rápido:
  python radar.py init                 # cria config.json e o banco
  python radar.py run                  # rodada completa (descoberta -> relatório)
  python radar.py importar anuncios_2026-10-15.csv   # CSV da extensão
  python radar.py certstream           # escuta domínios nascendo (deixe rodando)
"""
import argparse
import datetime as dt
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from radar import analyze, classify, expand, graph, report, score, sources, witness  # noqa: E402
from radar.analyze import is_offer  # noqa: E402
from radar.db import add_domain, add_link, connect, now, update  # noqa: E402

DEFAULT_CONFIG = {
    "db": "radar.db",
    "saida": "saida",
    "proxy": "",  # proxy residencial no país-alvo (abre páginas com cloaking por IP/geo)
    "urlscan_api_key": "",
    "publicwww_api_key": "",
    "anthropic_api_key": "",
    "apify_token": "",  # API de anúncios (traz destino, idade e anunciante); pago por uso
    "apify_actor": "apify/facebook-ads-scraper",
    "apify_searches": [],  # URLs da Biblioteca, page_ids, ou {q, country}
    "apify_auto_advertisers": 0,  # puxa os anúncios dos N anunciantes já achados
    "apify_limit": 200,
    "anthropic_model": "claude-haiku-5-5",
    "urlscan_queries": [
        # Players de VSL (o funil carrega o player).
        "domain:converteai.net",
        "domain:vturb.com.br",
        "domain:pandavideo.com.br",
        "domain:vidalytics.com",
        "domain:utmify.com.br",
        # Checkouts (acha funis que usam um player que ainda não listamos, ou nenhum).
        "domain:pay.hotmart.com",
        "domain:pay.kiwify.com.br",
        "domain:mycartpanda.com",
        "domain:buygoods.com",
        "domain:pay.clickbank.net",
        "domain:ticto.app",
        "domain:perfectpay.com.br",
        # Operações profissionais: trackers de mídia paga e checkouts internacionais.
        "domain:redtrack.io",
        "domain:t.hyros.com",
        "domain:clickmagick.com",
        "domain:samcart.com",
        "domain:thrivecart.com",
        "domain:digistore24.com",
        # Nativos: o pixel do ANUNCIANTE (advertoriais). "domain:taboola.com" trazia
        # sobretudo portais de notícia que exibem os widgets, não quem compra tráfego.
        'filename:"tfa.js"',  # Taboola Pixel
        "domain:amplify.outbrain.com",  # Outbrain Pixel
        "domain:mgid.com",
    ],
    "urlscan_max_per_query": 1000,  # máx. de varreduras por busca em cada leitura
    "urlscan_first_days": 3,  # 1ª leitura de uma busca nova: últimos N dias
    "urlscan_backfill_days": 180,  # histórico preenchido aos poucos até aqui
    "urlscan_discovery_share": 0.5,  # fração da cota que o histórico pode usar
    "urlscan_batch": 40,  # domínios/IPs por busca nas varreduras e na expansão
    "urlscan_backfill_adnet": False,  # histórico das buscas de pixel de nativos (muito volume)
    "urlscan_witness_max": 300,  # varreduras lidas por rodada (ofertas com cloaking; exige chave)
    "urlscan_interval": 2.0,
    "certstream_url": "wss://certstream.calidog.io/",
    "certstream_patterns": [
        "metodo", "protocolo", "segredo", "oferta", "saude", "emagrec", "renda", "dinheiro",
        "receita", "natural", "cura", "dieta", "vsl", "desafio", "treinamento", "curso",
        "formula", "suplement", "secret", "method", "protocol", "remedy", "offer",
    ],
    "certstream_tlds": [],
    "crtsh_keywords": [],
    "crtsh_days": 7,
    "workers": 8,
    "timeout": 20,
    "reanalyze_hours": 24,
    "enrich_days": 7,
    "rounds": 2,
    "ip_max_domains_urlscan": 15,
    "ip_expand_max": 400,
    "link_max_degree": 40,
    "max_minutes": 0,
    "weights": {},
}


def load_cfg(path):
    if not os.path.exists(path):
        raise SystemExit("config.json não existe. Rode: python radar.py init")
    with open(path, encoding="utf-8") as f:
        cfg = {**DEFAULT_CONFIG, **json.load(f)}
    base = os.path.dirname(os.path.abspath(path))
    cfg["db"] = os.path.join(base, cfg["db"])
    cfg["saida"] = os.path.join(base, cfg["saida"])
    return cfg


def step(title):
    print(f"\n== {title} ({dt.datetime.now():%H:%M:%S})", flush=True)


def discover(con, cfg):
    step("Descoberta: urlscan (páginas que carregam player/rastreamento de VSL)")
    n = sources.discover_urlscan(con, cfg)
    print(f"  total: {n} domínios novos pelo urlscan")
    if cfg.get("crtsh_keywords"):
        step("Descoberta: crt.sh (certificados recentes por palavra)")
        sources.crtsh_keyword_discovery(con, cfg)
    seeds = os.path.join(os.path.dirname(cfg["db"]), "sementes.txt")
    if os.path.exists(seeds):
        n = sources.import_seeds(con, seeds)
        print(f"  sementes.txt: {n} domínios novos")
    if cfg.get("apify_token") and (cfg.get("apify_searches") or cfg.get("apify_auto_advertisers")):
        step("Descoberta: Apify (anúncios reais com destino, idade e anunciante)")
        print(f"  {sources.apify_fetch(con, cfg)} destinos novos pela API de anúncios")


def enrich(con, cfg, share=1.0):
    step("Enriquecimento: varreduras e idade (urlscan), certificados e irmãos (crt.sh)")
    cutoff = (dt.datetime.now() - dt.timedelta(days=cfg["enrich_days"])).isoformat()
    offers = [r for r in con.execute("SELECT * FROM domains ORDER BY COALESCE(score, 0) DESC")
              if is_offer(r)]
    # Cada fonte tem a sua data: o urlscan não refaz as varreduras porque o crt.sh
    # (lento, cai com frequência) não teve tempo, nem o contrário.
    stats_todo = [r["domain"] for r in offers if not r["stats_checked"] or r["stats_checked"] < cutoff]
    cert_todo = [r["domain"] for r in offers if not r["last_enriched"] or r["last_enriched"] < cutoff]
    print(f"  {len(offers)} ofertas; varreduras pendentes: {len(stats_todo)}, "
          f"certificados pendentes: {len(cert_todo)}")
    g = cfg.get("_deadline")
    deadline = time.time() + max(0, g - time.time()) * share if g else None
    # urlscan em lotes: uma busca traz as varreduras de dezenas de domínios.
    batch = cfg.get("urlscan_batch", 40)
    stats_ok = 0
    for i in range(0, len(stats_todo), batch):
        if (deadline and time.time() > deadline) or not sources.urlscan_available():
            break
        for d in sources.urlscan_stats(con, stats_todo[i:i + batch], cfg):
            update(con, d, stats_checked=now())
            stats_ok += 1
        con.commit()
    print(f"  varreduras do urlscan: {stats_ok}/{len(stats_todo)} domínios")
    new = done = 0
    for i, d in enumerate(cert_todo, 1):
        if deadline and time.time() > deadline:
            print(f"  tempo desta etapa esgotado; {len(cert_todo) - i + 1} certificados ficam para a próxima")
            break
        if sources.BREAKER["crtsh_fail"] >= 3:
            print(f"  crt.sh indisponível; {len(cert_todo) - i + 1} certificados ficam para a próxima")
            break
        try:
            sibs = sources.cert_history(con, d, cfg)
        except Exception as e:
            print(f"  erro ao enriquecer {d}: {e}")
            continue
        if sibs is None:
            continue  # crt.sh não respondeu: tenta na próxima rodada
        for sib, serial in sibs:
            if add_domain(con, sib, "grafo:cert"):
                new += 1
            add_link(con, sib, "cert", serial)
        update(con, d, last_enriched=now())
        done += 1
        if i % 20 == 0:
            con.commit()
            print(f"  {i}/{len(cert_todo)}")
    con.commit()
    print(f"  certificados: {done}; domínios-irmãos novos via certificado: {new}")


def tranco(con, cfg):
    step("Tráfego: ranking Tranco")
    doms = [r["domain"] for r in con.execute("SELECT domain FROM domains")]
    try:
        ranks = sources.tranco_ranks(doms, os.path.join(os.path.dirname(cfg["db"]), "tranco.zip"))
    except Exception as e:
        print(f"  Tranco falhou: {e}")
        return
    con.execute("UPDATE domains SET tranco_rank=NULL")
    for d, rk in ranks.items():
        update(con, d, tranco_rank=rk)
    con.commit()
    print(f"  {len(ranks)} domínios no top 1M")


def cleanup_links(con):
    """Remove chaves de produto geradas por regras antigas (ex.: 'buygoods:secure')."""
    from radar.signatures import valid_product_key
    bad = [r["value"] for r in con.execute("SELECT DISTINCT value FROM links WHERE kind='product'")
           if not valid_product_key(r["value"])]
    for v in bad:
        con.execute("DELETE FROM links WHERE kind='product' AND value=?", (v,))
    if bad:
        con.commit()
        print(f"  {len(bad)} chaves de produto genéricas removidas")


def finish(con, cfg, do_classify=True):
    cleanup_links(con)
    step("Grafo de operações")
    graph.run(con, cfg)
    step("Score")
    score.run(con, cfg)
    if do_classify and cfg.get("anthropic_api_key"):
        step("Classificação (Claude)")
        classify.run(con, cfg)
    step("Relatório")
    return report.run(con, cfg["saida"])


def cmd_run(con, cfg, args):
    cleanup_links(con)
    if not args.sem_descoberta:
        discover(con, cfg)
    analyze.refresh_seen(con)  # testemunhas do urlscan contam como oferta daqui para frente
    step("Análise das páginas")
    analyze.run(con, cfg, render=args.render, limit=args.limite)
    step("Testemunha do urlscan: página real das ofertas com cloaking")
    witness.run(con, cfg)
    enrich(con, cfg, share=0.5)  # idade e varreduras das ofertas (metade do tempo restante)
    for i in range(cfg["rounds"]):
        step(f"Expansão em grafo (rodada {i + 1}/{cfg['rounds']})")
        if not expand.run(con, cfg):
            break
        step("Análise dos domínios novos")
        analyze.run(con, cfg, render=args.render, limit=args.limite)
    step("Análise do que ficou na fila (irmãos de certificado, expansão)")
    if analyze.run(con, cfg, render=args.render, limit=args.limite):
        enrich(con, cfg)  # só processa os que ainda não foram enriquecidos
    tranco(con, cfg)
    path = finish(con, cfg)
    print(f"\nPronto. Abra {path}")


def main():
    p = argparse.ArgumentParser(description="Radar de Ofertas")
    p.add_argument("--config", default=os.path.join(HERE, "config.json"))
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init", help="cria config.json e banco")
    r = sub.add_parser("run", help="rodada completa")
    r.add_argument("--render", action="store_true", help="usa Chromium (mais lento, pega mais)")
    r.add_argument("--limite", type=int, help="máx. de domínios analisados por etapa")
    r.add_argument("--sem-descoberta", action="store_true")
    sub.add_parser("descobrir", help="só descoberta")
    a = sub.add_parser("analisar", help="só análise")
    a.add_argument("--render", action="store_true")
    a.add_argument("--limite", type=int)
    sub.add_parser("expandir", help="só expansão em grafo")
    sub.add_parser("enriquecer", help="idade, varreduras, Tranco")
    sub.add_parser("ranking", help="grafo + score + relatório (sem rede)")
    sub.add_parser("classificar", help="classifica com a API da Claude")
    sub.add_parser("testemunha", help="lê no urlscan a página real das ofertas com cloaking")
    i = sub.add_parser("importar", help="importa CSV da extensão")
    i.add_argument("arquivos", nargs="+")
    u = sub.add_parser("importar-urls", help="importa URLs/domínios de qualquer export de ad-spy")
    u.add_argument("arquivos", nargs="+")
    sub.add_parser("apify", help="puxa anúncios reais pela API do Apify (precisa de apify_token)")
    s = sub.add_parser("sementes", help="importa lista de domínios (um por linha)")
    s.add_argument("arquivo")
    c = sub.add_parser("certstream", help="escuta certificados novos (contínuo)")
    c.add_argument("--limite", type=int)
    args = p.parse_args()

    if args.cmd == "init":
        if not os.path.exists(args.config):
            with open(args.config, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_CONFIG, f, indent=2, ensure_ascii=False)
            print(f"Criado {args.config}. Coloque suas chaves (opcionais) e rode: python radar.py run")
        else:
            print("config.json já existe.")
        connect(load_cfg(args.config)["db"]).close()
        return

    cfg = load_cfg(args.config)
    if cfg.get("max_minutes"):
        cfg["_deadline"] = time.time() + cfg["max_minutes"] * 60
    con = connect(cfg["db"])
    if args.cmd == "run":
        cmd_run(con, cfg, args)
    elif args.cmd == "descobrir":
        discover(con, cfg)
    elif args.cmd == "analisar":
        analyze.run(con, cfg, render=args.render, limit=args.limite)
    elif args.cmd == "expandir":
        expand.run(con, cfg)
    elif args.cmd == "enriquecer":
        enrich(con, cfg)
        tranco(con, cfg)
    elif args.cmd == "ranking":
        finish(con, cfg, do_classify=False)
    elif args.cmd == "classificar":
        classify.run(con, cfg)
    elif args.cmd == "testemunha":
        witness.run(con, cfg)
    elif args.cmd == "importar":
        for f in args.arquivos:
            print(f"{f}: {sources.import_extension_csv(con, f)} domínios novos")
    elif args.cmd == "importar-urls":
        for f in args.arquivos:
            print(f"{f}: {sources.import_urls(con, f)} domínios novos")
    elif args.cmd == "apify":
        print(f"{sources.apify_fetch(con, cfg)} destinos novos pela API de anúncios")
    elif args.cmd == "sementes":
        print(f"{sources.import_seeds(con, args.arquivo)} domínios novos")
    elif args.cmd == "certstream":
        try:
            sources.certstream_listen(con, cfg, args.limite)
        except KeyboardInterrupt:
            print("\nParado. Rode 'python radar.py run --sem-descoberta' para analisar o que entrou.")
    con.close()


if __name__ == "__main__":
    main()
