"""Expansão em grafo: cada oferta encontrada leva às irmãs.

- Mesmo GTM / GA4 / Pixel / produto no checkout -> PublicWWW (se tiver chave).
- Mesmo IP (só servidores com poucos sites, nunca CDN) -> urlscan.
- Mesmo certificado -> crt.sh (feito no enriquecimento).
"""
from .analyze import is_offer
from .db import add_domain, today
from .sources import log, publicwww_domains, urlscan_domains_for

CODE_KINDS = ("gtm", "ga4", "ua", "fbpixel", "ttpixel", "utmify", "product")


def run(con, cfg):
    offers = {r["domain"] for r in con.execute("SELECT * FROM domains") if is_offer(r)}
    if not offers:
        log("  nenhuma oferta ainda para expandir")
        return 0
    marks = ",".join("?" * len(offers))
    links = con.execute(
        f"""SELECT DISTINCT l.kind, l.value FROM links l
            LEFT JOIN expanded e ON e.kind = l.kind AND e.value = l.value
            WHERE e.value IS NULL AND l.domain IN ({marks})""", tuple(offers)).fetchall()
    new = 0
    has_pw = bool(cfg.get("publicwww_api_key"))
    import time
    for row in links:
        if cfg.get("_deadline") and time.time() > cfg["_deadline"]:
            log("  tempo da rodada esgotado; o resto da expansão fica para amanhã")
            break
        kind, value = row["kind"], row["value"]
        found = set()
        if kind in CODE_KINDS and has_pw:
            snippet = value.split(":", 1)[1] if kind == "product" else value
            found = publicwww_domains(snippet, cfg)
        elif kind == "ip":
            doms, total = urlscan_domains_for(f'page.ip:"{value}"', cfg, 200)
            if total and total > cfg.get("ip_max_domains_urlscan", 40):
                found = set()  # hospedagem compartilhada/CDN: ligação sem valor
            else:
                found = doms
        elif kind in CODE_KINDS:
            continue  # sem PublicWWW: não marca como expandido, tenta quando houver chave
        n0 = new
        for d in found:
            if add_domain(con, d, f"grafo:{kind}"):
                new += 1
        con.execute("INSERT OR REPLACE INTO expanded(kind, value, day, found) VALUES(?,?,?,?)",
                    (kind, value, today(), len(found)))
        con.commit()
        if new > n0:
            log(f"  {kind} {value}: +{new - n0} domínios")
    if not has_pw:
        log("  (sem chave do PublicWWW: expansão por GTM/pixel/produto desativada)")
    log(f"  expansão: {new} domínios novos")
    return new
