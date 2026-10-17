"""Testemunha do urlscan: a página real das ofertas com cloaking.

Quando a nossa visita cai na página isca (cloaking por IP de datacenter), a varredura
que o urlscan fez da página real ainda mostra o que ela carregou e para onde ela
linka: player, pixel, checkout, redes sociais do anunciante. Lê só as ofertas que
precisam (sem player/checkout na nossa leitura, ou com cloaking), uma vez por
varredura, com a cota de leitura do urlscan (exige a chave; não usa a cota de busca).

Os vínculos lidos ficam em witness_links e voltam para links a cada reanálise, para
a nossa visita (que vê a isca) não apagá-los.
"""
from . import sources
from .analyze import is_offer, refresh_seen
from .db import add_link, jl, update
from .signatures import extract


def candidates(con):
    """Ofertas cuja página real só o urlscan viu, da maior nota para a menor."""
    refresh_seen(con)
    out = []
    for r in con.execute("""SELECT * FROM domains WHERE scan_uuid IS NOT NULL
                            AND (witness_scan IS NULL OR witness_scan != scan_uuid)
                            ORDER BY COALESCE(score, 0) DESC"""):
        if not is_offer(r):
            continue
        if (jl(r["players"]) or jl(r["checkouts"])) and not r["cloaked"]:
            continue  # a nossa visita já viu a página real
        out.append((r["domain"], r["scan_uuid"]))
    return out


def save(con, domain, uuid, result):
    """Grava o que a varredura viu. Retorna True se ela mostrou player ou checkout."""
    s = extract(sources.witness_page(result))
    found = [(kind, v) for kind, vals in s["tracking"].items() for v in vals]
    found += [("product", p) for p in s["products"]]
    found += [("adnet", n) for n in s["adnets"]]
    found += [("tracker", n) for n in s["trackers"]]
    found += [("video", v) for v in s["videos"]]
    found += [("social", f"{k}:{v}") for k, v in s["advertiser"].items()]
    found += [("seen", f"player:{p}") for p in s["players"]]
    found += [("seen", f"checkout:{c}") for c in s["checkouts"]]
    con.execute("DELETE FROM witness_links WHERE domain=?", (domain,))
    for kind, value in found:
        con.execute("INSERT OR IGNORE INTO witness_links(domain, kind, value) VALUES(?,?,?)",
                    (domain, kind, value))
        add_link(con, domain, kind, value)
    update(con, domain, witness_scan=uuid)
    return bool(s["players"] or s["checkouts"])


def run(con, cfg, log=print):
    if not cfg.get("urlscan_api_key"):
        log("  sem chave do urlscan: leitura das varreduras pulada")
        return 0
    todo = candidates(con)
    cap = cfg.get("urlscan_witness_max", 300)
    log(f"  {len(todo)} ofertas com página real só vista pelo urlscan; lendo até {cap}")
    read = hits = 0
    for domain, uuid in todo[:cap]:
        result = sources.urlscan_result(uuid, cfg)
        if result is None:
            if sources.BREAKER.get("retrieve") or (
                    sources.QUOTA["retrieve_left"] is not None
                    and sources.QUOTA["retrieved"] >= sources.QUOTA["retrieve_left"]):
                log("  cota de leitura do urlscan esgotada; o resto fica para a próxima rodada")
                break
            update(con, domain, witness_scan=uuid)  # varredura apagada: não tenta de novo
            continue
        read += 1
        hits += save(con, domain, uuid, result)
        if read % 25 == 0:
            con.commit()
    con.commit()
    log(f"  varreduras lidas: {read}; com player/checkout na página real: {hits}")
    return read
