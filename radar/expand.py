"""Expansão em grafo: cada oferta encontrada leva às irmãs.

- Mesmo GTM / GA4 / Pixel / produto no checkout -> PublicWWW (se tiver chave).
- Mesmo IP (só servidores com poucos sites, nunca CDN) -> urlscan.
- Mesmo certificado -> crt.sh (feito no enriquecimento).
"""
import ipaddress
import time

from .analyze import is_offer, refresh_seen
from .db import add_domain, today
from .sources import log, publicwww_domains, urlscan_available, urlscan_ip_domains

CODE_KINDS = ("gtm", "ga4", "ua", "fbpixel", "ttpixel", "utmify", "product")

# CDNs: o mesmo IP atende milhares de sites sem relação entre si.
CDN_NETS = [ipaddress.ip_network(n) for n in (
    # Cloudflare
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
    "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
    "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
    "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
    "2a06:98c0::/29", "2c0f:f248::/32",
    # Fastly, Vercel, Netlify, Google Front End, CloudFront (principais faixas)
    "151.101.0.0/16", "199.232.0.0/16", "76.76.21.0/24", "75.2.60.0/24", "99.83.0.0/16",
    "216.239.32.0/19", "13.32.0.0/15", "13.224.0.0/14", "18.64.0.0/14", "52.84.0.0/15",
    "54.230.0.0/16", "54.239.128.0/18", "143.204.0.0/16", "205.251.192.0/19",
)]


def is_cdn(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return any(addr in n for n in CDN_NETS if n.version == addr.version)


def run(con, cfg):
    refresh_seen(con)
    offers = {r["domain"] for r in con.execute("SELECT * FROM domains") if is_offer(r)}
    if not offers:
        log("  nenhuma oferta ainda para expandir")
        return 0
    marks = ",".join("?" * len(offers))
    links = con.execute(
        f"""SELECT DISTINCT l.kind, l.value FROM links l
            LEFT JOIN expanded e ON e.kind = l.kind AND e.value = l.value
            WHERE e.value IS NULL AND l.domain IN ({marks})""", tuple(offers)).fetchall()
    new = ip_done = 0
    has_pw = bool(cfg.get("publicwww_api_key"))
    ip_cap = cfg.get("ip_expand_max", 400)
    ip_limit = cfg.get("ip_max_domains_urlscan", 15)

    def mark(kind, value, n):
        con.execute("INSERT OR REPLACE INTO expanded(kind, value, day, found) VALUES(?,?,?,?)",
                    (kind, value, today(), n))

    def add(kind, value, found):
        nonlocal new
        n0 = new
        for d in found:
            if add_domain(con, d, f"grafo:{kind}"):
                new += 1
        mark(kind, value, len(found))
        con.commit()
        if new > n0:
            log(f"  {kind} {value}: +{new - n0} domínios")

    def late():
        return cfg.get("_deadline") and time.time() > cfg["_deadline"]

    ips = []
    for row in links:
        if late():
            log("  tempo da rodada esgotado; o resto da expansão fica para amanhã")
            break
        kind, value = row["kind"], row["value"]
        if kind == "ip":
            if is_cdn(value):
                mark(kind, value, 0)
            else:
                ips.append(value)
        elif kind in CODE_KINDS and has_pw:  # sem PublicWWW: fica pendente até haver chave
            snippet = value.split(":", 1)[1] if kind == "product" else value
            add(kind, value, publicwww_domains(snippet, cfg))
    # IPs em lotes: uma busca do urlscan cobre dezenas de IPs. Os não respondidos
    # (cota ou tempo) não são marcados e voltam na próxima rodada.
    batch = cfg.get("urlscan_batch", 40)
    ips = ips[:ip_cap]
    for i in range(0, len(ips), batch):
        if late() or not urlscan_available():
            break
        for ip, doms in urlscan_ip_domains(ips[i:i + batch], cfg).items():
            ip_done += 1
            add("ip", ip, doms if len(doms) <= ip_limit else set())  # muitos sites = hospedagem compartilhada
    con.commit()
    if not has_pw:
        log("  (sem chave do PublicWWW: expansão por GTM/pixel/produto desativada)")
    log(f"  expansão: {new} domínios novos ({ip_done} IPs consultados)")
    return new
