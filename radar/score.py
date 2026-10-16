"""Pontua cada oferta em duas medidas separadas, para não enterrar ofertas novas:

- FORÇA (0-100): o quanto a página parece um funil real de resposta direta, sendo
  anunciado agora. Não depende de idade: checkout, player de VSL, cloaking, pixel de
  rede de anúncio (prova de tráfego pago), texto de VSL, tamanho da operação.
- TRAÇÃO (0-100): o quanto a oferta é grande/estabelecida. Depende de tempo e volume:
  idade, anúncios (se importados), varreduras no urlscan, Tranco, renovações, momento.

SCORE = mistura das duas. Uma oferta nova e bem montada tem FORÇA alta e sobe, mesmo
com TRAÇÃO baixa. Cada medida é normalizada só pelos sinais mensuráveis hoje, então
não fica comprimida por pilares ainda vazios (ex.: anúncios não importados).
"""
import datetime as dt
import json
import math
from collections import defaultdict

from .analyze import is_offer
from .db import jl, today
from .signatures import STRONG_PLAYERS, ad_library_url

FORCA_W = {"checkout": 15, "player_forte": 12, "player": 5, "texto_vsl": 3,
           "cloaking": 6, "trafego_pago": 10, "operacao": 7}
TRACAO_W = {"anuncio_idade": 20, "anuncio_video": 6, "anuncio_volume": 8, "anuncio_paginas": 4,
            "trafego_tranco": 10, "varreduras_30d": 8, "varreduras_total": 4,
            "longevidade": 8, "renovacoes_cert": 3, "momento": 10}
AD_PARTS = {"anuncio_idade", "anuncio_video", "anuncio_volume", "anuncio_paginas"}
BLEND = 0.6  # peso da FORÇA no score final (TRAÇÃO leva 0.4)


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
        return None  # ainda sem histórico de 7 dias para este domínio
    gain = max(0, (row["ad_count"] or 0) - (old["ad_count"] or 0))
    gain += max(0, (row["urlscan_30d"] or 0) - (old["urlscan_30d"] or 0)) / 2
    return _cap(gain / 5)


def run(con, cfg):
    fw = {**FORCA_W, **cfg.get("forca_weights", {})}
    tw = {**TRACAO_W, **cfg.get("tracao_weights", {})}
    rows = con.execute("SELECT * FROM domains").fetchall()
    adnets = defaultdict(set)
    for r in con.execute("SELECT domain, value FROM links WHERE kind='adnet'"):
        adnets[r["domain"]].add(r["value"])
    cluster_size = defaultdict(int)
    for r in rows:
        if is_offer(r):
            cluster_size[r["cluster_id"]] += 1
    # O que é mensurável nesta rodada decide o denominador de TRAÇÃO.
    has_ads = any((r["ad_count"] or 0) > 0 for r in rows)
    has_history = con.execute(
        "SELECT 1 FROM snapshots WHERE day <= date('now','localtime','-7 days') LIMIT 1").fetchone()
    t = dt.date.today()
    scored = 0
    for r in rows:
        if not is_offer(r):
            con.execute("""UPDATE domains SET score=NULL, score_parts=NULL, stage=NULL,
                           forca=NULL, tracao=NULL WHERE domain=?""", (r["domain"],))
            continue
        players = set(jl(r["players"]))
        dates = [d for d in (_date(r["cert_first"]), _date(r["urlscan_first"]),
                             _date(r["first_discovered"])) if d]
        age = (t - min(dates)).days if dates else 0
        if r["ad_max_days"]:
            age = max(age, r["ad_max_days"])
        mom = _momentum(con, r["domain"], r)

        forca_f = {
            "checkout": 1.0 if jl(r["checkouts"]) else 0.0,
            "player_forte": 1.0 if players & STRONG_PLAYERS else 0.0,
            "player": 1.0 if players else 0.0,
            "texto_vsl": 1.0 if r["vsl_text"] else 0.0,
            "cloaking": 1.0 if r["cloaked"] else 0.0,
            "trafego_pago": 1.0 if adnets[r["domain"]] else 0.0,
            "operacao": _cap((cluster_size[r["cluster_id"]] - 1) / 10),
        }
        tracao_f = {
            "anuncio_idade": _cap((r["ad_max_days"] or 0) / 90),
            "anuncio_video": _cap((r["ad_video"] or 0) / 5),
            "anuncio_volume": _cap((r["ad_count"] or 0) / 20),
            "anuncio_paginas": _cap((r["ad_pages"] or 0) / 3),
            "trafego_tranco": _cap(1 - math.log10(r["tranco_rank"]) / 6) if r["tranco_rank"] else 0.0,
            "varreduras_30d": _log_ratio(r["urlscan_30d"], 50),
            "varreduras_total": _log_ratio(r["urlscan_total"], 200),
            "longevidade": _cap(age / 180),
            "renovacoes_cert": _cap((r["cert_count"] or 0) / 6),
            "momento": mom or 0.0,
        }
        # Denominador = só os sinais mensuráveis hoje.
        tracao_den = 0
        for k, w in tw.items():
            if k in AD_PARTS and not has_ads:
                continue
            if k == "momento" and not has_history:
                continue
            tracao_den += w
        forca = 100 * sum(fw[k] * v for k, v in forca_f.items()) / sum(fw.values())
        tracao = 100 * sum(tw[k] * v for k, v in tracao_f.items()
                           if not (k in AD_PARTS and not has_ads)
                           and not (k == "momento" and not has_history)) / (tracao_den or 1)
        score = BLEND * forca + (1 - BLEND) * tracao
        if r["alive"] == 0:
            score *= 0.25
        parts = {**{k: round(fw[k] * v, 1) for k, v in forca_f.items() if v},
                 **{k: round(tw[k] * v, 1) for k, v in tracao_f.items() if v}}
        if mom and mom > 0:
            stage = "crescendo"
        elif age <= 30:
            stage = "nova"
        else:
            stage = "estabelecida"
        con.execute("""UPDATE domains SET score=?, forca=?, tracao=?, score_parts=?, stage=?
                       WHERE domain=?""",
                    (round(score, 1), round(forca, 1), round(tracao, 1),
                     json.dumps(parts, ensure_ascii=False), stage, r["domain"]))
        con.execute("""INSERT OR REPLACE INTO snapshots(domain, day, alive, score, ad_count, urlscan_30d)
                       VALUES(?,?,?,?,?,?)""",
                    (r["domain"], today(), r["alive"], round(score, 1), r["ad_count"], r["urlscan_30d"]))
        scored += 1
    con.commit()
    print(f"  score: {scored} ofertas pontuadas (ads={'sim' if has_ads else 'não'}, "
          f"histórico={'sim' if has_history else 'ainda não'})")


def offers(con):
    """Agrupa domínios em ofertas: mesmo produto no checkout, senão mesma operação."""
    rows = [r for r in con.execute("SELECT * FROM domains WHERE score IS NOT NULL")]
    prod = defaultdict(set)
    adnet = defaultdict(set)
    social = defaultdict(dict)
    for r in con.execute("SELECT domain, kind, value FROM links WHERE kind IN ('product','adnet','social')"):
        if r["kind"] == "product":
            prod[r["domain"]].add(r["value"])
        elif r["kind"] == "adnet":
            adnet[r["domain"]].add(r["value"])
        else:  # social: "fb:handle", "fb_id:123", "ig:handle", "wa:number"
            k, _, v = r["value"].partition(":")
            social[r["domain"]][k] = v
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
        nets = sorted({n for m in members for n in adnet[m["domain"]]})
        soc = {}
        for m in members:  # junta o anunciante achado em qualquer domínio da oferta
            for k, v in social[m["domain"]].items():
                soc.setdefault(k, v)
        anunciante = (f"fb/{soc['fb']}" if soc.get("fb") else
                      f"ig/{soc['ig']}" if soc.get("ig") else
                      f"wa/{soc['wa']}" if soc.get("wa") else "")
        out.append({
            "oferta": key,
            "score": round(min(100, (top["score"] or 0) + bonus), 1),
            "forca": top["forca"],
            "tracao": top["tracao"],
            "estagio": top["stage"],
            "trafego": ", ".join(nets),
            "anunciante": anunciante,
            "biblioteca_anuncios": ad_library_url(soc.get("fb"), soc.get("fb_id")),
            "instagram": f"https://instagram.com/{soc['ig']}" if soc.get("ig") else "",
            "whatsapp": f"https://wa.me/{soc['wa']}" if soc.get("wa") else "",
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
