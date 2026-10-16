"""Score 0-100 por domínio e ranking por oferta.

Cada sinal vale até N pontos (pesos no config.json). O score é a soma dividida
pelo máximo possível. Página fora do ar perde 75%.
"""
import datetime as dt
import json
import math
from collections import defaultdict

from .analyze import is_offer
from .db import jl, today
from .signatures import STRONG_PLAYERS

DEFAULT_WEIGHTS = {
    "checkout": 15, "player_forte": 12, "player": 5, "texto_vsl": 3,
    "anuncio_idade": 20, "anuncio_video": 8, "anuncio_volume": 8, "anuncio_paginas": 4,
    "trafego_tranco": 10, "varreduras_30d": 8, "varreduras_total": 4,
    "longevidade": 8, "renovacoes_cert": 3, "operacao": 8, "cloaking": 4, "momento": 8,
}


def _cap(x):
    return max(0.0, min(1.0, x))


def _log_ratio(n, ref):
    return _cap(math.log1p(n or 0) / math.log1p(ref))


def _date(s):
    try:
        return dt.date.fromisoformat((s or "")[:10])
    except ValueError:
        return None


def _momentum(con, domain, row):
    old = con.execute(
        """SELECT ad_count, urlscan_30d FROM snapshots
           WHERE domain=? AND day <= date('now', 'localtime', '-7 days')
           ORDER BY day DESC LIMIT 1""", (domain,)).fetchone()
    if not old:
        return 0.0
    gain = max(0, (row["ad_count"] or 0) - (old["ad_count"] or 0))
    gain += max(0, (row["urlscan_30d"] or 0) - (old["urlscan_30d"] or 0)) / 2
    return _cap(gain / 5)


def run(con, cfg):
    W = {**DEFAULT_WEIGHTS, **cfg.get("weights", {})}
    total_w = sum(W.values())
    rows = con.execute("SELECT * FROM domains").fetchall()
    cluster_size = defaultdict(int)
    for r in rows:
        if is_offer(r):
            cluster_size[r["cluster_id"]] += 1
    t = dt.date.today()
    scored = 0
    for r in rows:
        if not is_offer(r):
            con.execute("UPDATE domains SET score=NULL, score_parts=NULL, stage=NULL WHERE domain=?",
                        (r["domain"],))
            continue
        players = set(jl(r["players"]))
        dates = [d for d in (_date(r["cert_first"]), _date(r["urlscan_first"]),
                             _date(r["first_discovered"])) if d]
        age = (t - min(dates)).days if dates else 0
        if r["ad_max_days"]:
            age = max(age, r["ad_max_days"])
        f = {
            "checkout": 1.0 if jl(r["checkouts"]) else 0.0,
            "player_forte": 1.0 if players & STRONG_PLAYERS else 0.0,
            "player": 1.0 if players else 0.0,
            "texto_vsl": 1.0 if r["vsl_text"] else 0.0,
            "anuncio_idade": _cap((r["ad_max_days"] or 0) / 90),
            "anuncio_video": _cap((r["ad_video"] or 0) / 5),
            "anuncio_volume": _cap((r["ad_count"] or 0) / 20),
            "anuncio_paginas": _cap((r["ad_pages"] or 0) / 3),
            "trafego_tranco": _cap(1 - math.log10(r["tranco_rank"]) / 6) if r["tranco_rank"] else 0.0,
            "varreduras_30d": _log_ratio(r["urlscan_30d"], 50),
            "varreduras_total": _log_ratio(r["urlscan_total"], 200),
            "longevidade": _cap(age / 180),
            "renovacoes_cert": _cap((r["cert_count"] or 0) / 6),
            "operacao": _cap((cluster_size[r["cluster_id"]] - 1) / 10),
            "cloaking": 1.0 if r["cloaked"] else 0.0,
            "momento": _momentum(con, r["domain"], r),
        }
        parts = {k: round(W[k] * v, 1) for k, v in f.items() if v}
        score = 100 * sum(parts.values()) / total_w
        if r["alive"] == 0:
            score *= 0.25
        stage = "nova" if age <= 30 else "crescendo" if age <= 90 else "estabelecida"
        con.execute("UPDATE domains SET score=?, score_parts=?, stage=? WHERE domain=?",
                    (round(score, 1), json.dumps(parts, ensure_ascii=False), stage, r["domain"]))
        con.execute("""INSERT OR REPLACE INTO snapshots(domain, day, alive, score, ad_count, urlscan_30d)
                       VALUES(?,?,?,?,?,?)""",
                    (r["domain"], today(), r["alive"], round(score, 1), r["ad_count"], r["urlscan_30d"]))
        scored += 1
    con.commit()
    print(f"  score: {scored} ofertas pontuadas")


def offers(con):
    """Agrupa domínios em ofertas: mesmo produto no checkout, senão mesma operação."""
    rows = [r for r in con.execute("SELECT * FROM domains WHERE score IS NOT NULL")]
    prod = defaultdict(set)
    for r in con.execute("SELECT domain, value FROM links WHERE kind='product'"):
        prod[r["domain"]].add(r["value"])
    # Domínio sem produto (ex.: página de entrada que recebe os anúncios) herda o produto
    # mais comum da sua operação, para os anúncios somarem na oferta certa.
    cluster_prod = defaultdict(lambda: defaultdict(int))
    for r in rows:
        for p in prod[r["domain"]]:
            cluster_prod[r["cluster_id"]][p] += 1
    groups = defaultdict(list)
    for r in rows:
        if prod[r["domain"]]:
            key = sorted(prod[r["domain"]])[0]
        elif cluster_prod[r["cluster_id"]]:
            cp = cluster_prod[r["cluster_id"]]
            key = max(sorted(cp), key=cp.get)
        else:
            key = f"operacao:{r['cluster_id']}"
        groups[key].append(r)
    out = []
    for key, members in groups.items():
        members.sort(key=lambda r: r["score"] or 0, reverse=True)
        top = members[0]
        alive = [m for m in members if m["alive"]]
        bonus = 3 * math.log2(len(alive)) if len(alive) > 1 else 0
        firsts = [m["cert_first"] or m["urlscan_first"] or (m["first_discovered"] or "")[:10]
                  for m in members]
        firsts += [(dt.date.today() - dt.timedelta(days=m["ad_max_days"])).isoformat()
                   for m in members if m["ad_max_days"]]
        out.append({
            "oferta": key,
            "score": round(min(100, (top["score"] or 0) + bonus), 1),
            "estagio": top["stage"],
            "dominio_principal": top["domain"],
            "titulo": top["title"] or "",
            "nicho": top["niche"] or "",
            "promessa": top["promise"] or "",
            "dominios": len(members),
            "dominios_ativos": len(alive),
            "checkouts": ", ".join(sorted({c for m in members for c in jl(m["checkouts"])})),
            "players": ", ".join(sorted({p for m in members for p in jl(m["players"])})),
            "anuncios": sum(m["ad_count"] or 0 for m in members),
            "anuncios_video": sum(m["ad_video"] or 0 for m in members),
            "max_dias_anuncio": max((m["ad_max_days"] or 0) for m in members),
            "varreduras_30d": sum(m["urlscan_30d"] or 0 for m in members),
            "melhor_tranco": min((m["tranco_rank"] for m in members if m["tranco_rank"]), default=""),
            "cloaking": "sim" if any(m["cloaked"] for m in members) else "",
            "visto_desde": min(f for f in firsts if f) if any(firsts) else "",
            "lista_dominios": " | ".join(m["domain"] for m in members[:30]),
        })
    out.sort(key=lambda o: o["score"], reverse=True)
    return out
