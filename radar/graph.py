"""Agrupa domínios em operações (componentes conectados por IDs compartilhados)."""
from collections import defaultdict

# Vínculos que ligam domínios da mesma operação. "product" e "video" são os duráveis
# (sobrevivem à troca de domínio/pixel); o resto vale para o que está no ar agora.
STRONG = {"gtm", "ga4", "ua", "fbpixel", "ttpixel", "utmify", "product", "video",
          "adpage", "cert", "redirect"}


def run(con, cfg):
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    domains = [r["domain"] for r in con.execute("SELECT domain FROM domains")]
    for d in domains:
        find(d)
    groups = defaultdict(set)
    for r in con.execute("SELECT domain, kind, value FROM links"):
        groups[(r["kind"], r["value"])].add(r["domain"])
    max_deg = cfg.get("link_max_degree", 40)
    for (kind, _), members in groups.items():
        # IP não agrupa: um IP de CDN (Cloudflare etc.) parece raro no banco mas é de
        # milhões de sites. Ele só é usado na expansão, onde o urlscan diz o total real.
        if len(members) < 2 or kind not in STRONG:
            continue
        if len(members) > max_deg:
            continue  # ID genérico de template, não de operação
        members = sorted(members)
        for m in members[1:]:
            union(members[0], m)
    roots = {}
    for d in sorted(domains):
        r = find(d)
        roots.setdefault(r, len(roots) + 1)
        con.execute("UPDATE domains SET cluster_id=? WHERE domain=?", (roots[r], d))
    con.commit()
    sizes = defaultdict(int)
    for d in domains:
        sizes[find(d)] += 1
    big = sum(1 for s in sizes.values() if s > 1)
    print(f"  grafo: {len(domains)} domínios em {len(roots)} grupos ({big} operações com 2+ domínios)")
