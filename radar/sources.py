"""Fontes de descoberta e de evidência.

- urlscan: páginas que carregaram um player/checkout/pixel (pega ofertas antigas e novas).
- crt.sh: histórico de certificados (idade, se está viva, domínios-irmãos no mesmo certificado).
- Certstream: certificados emitidos agora (ofertas nascendo).
- PublicWWW (opcional, pago): busca no código-fonte por um ID (GTM, pixel, produto).
- CSV da extensão: anúncios com idade e domínio de destino.
- Tranco: ranking público de tráfego (top 1 milhão).
"""
import csv
import datetime as dt
import io
import json
import re
import zipfile
from urllib.parse import quote

from . import net
from .db import add_domain, add_link, norm_domain, update

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"


def log(*a):
    print(*a, flush=True)


# ------------------------------------------------------------------ urlscan
def urlscan_search(query, cfg, max_results=1000):
    """Pagina a busca do urlscan. Retorna (resultados, total_estimado)."""
    headers = {"User-Agent": UA}
    if cfg.get("urlscan_api_key"):
        headers["API-Key"] = cfg["urlscan_api_key"]
    out, total, after, retries = [], 0, None, 0
    while len(out) < max_results:
        params = {"q": query, "size": min(100, max_results - len(out))}
        if after:
            params["search_after"] = after
        try:
            r = net.get("https://urlscan.io/api/v1/search/", headers=headers, params=params,
                        min_interval=cfg.get("urlscan_interval", 2.0))
        except Exception as e:
            log(f"  urlscan falhou: {e}")
            break
        if r.status_code == 429 and retries < 3:
            import time
            try:
                wait = float(r.headers.get("X-Rate-Limit-Reset-After") or 30)
            except (TypeError, ValueError, AttributeError):
                wait = 30
            retries += 1
            log(f"  urlscan: limite por minuto; aguardando {min(wait, 90):.0f}s")
            time.sleep(min(wait, 90) + 1)
            continue
        if r.status_code == 429:
            log("  urlscan: limite diário atingido; o resto fica para a próxima rodada.")
            break
        if r.status_code != 200:
            log(f"  urlscan {r.status_code}: {r.text[:150]}")
            break
        try:
            data = r.json()
        except ValueError:
            break
        res = data.get("results", [])
        total = data.get("total", total)
        out.extend(res)
        if not res or not data.get("has_more"):
            break
        after = ",".join(str(x) for x in res[-1].get("sort", []))
        if not after:
            break
    return out, total


def discover_urlscan(con, cfg):
    """Enumera páginas que carregam assinaturas de VSL/checkout/rastreamento."""
    new = 0
    for q in cfg["urlscan_queries"]:
        res, total = urlscan_search(q, cfg, cfg.get("urlscan_max_per_query", 1000))
        n0 = new
        for r in res:
            page = r.get("page", {})
            d = norm_domain(page.get("domain") or page.get("url"))
            if d and add_domain(con, d, "urlscan"):
                new += 1
            if d and page.get("ip"):
                add_link(con, d, "ip", page["ip"])
        con.commit()
        log(f"  urlscan [{q}]: {len(res)} resultados (total ~{total}), {new - n0} domínios novos")
    return new


def urlscan_stats(con, domain, cfg):
    """Quantas varreduras o domínio teve (proxy de visitas reais) e quando."""
    res, total = urlscan_search(f'page.domain:"{domain}"', cfg, 100)
    if not res:
        update(con, domain, urlscan_total=0, urlscan_30d=0)
        return
    times = sorted(r.get("task", {}).get("time", "")[:10] for r in res if r.get("task"))
    cutoff = (dt.date.today() - dt.timedelta(days=30)).isoformat()
    update(con, domain,
           urlscan_total=max(total, len(res)),
           urlscan_30d=sum(1 for t in times if t >= cutoff),
           urlscan_first=times[0] if times else None,
           urlscan_last=times[-1] if times else None)


def urlscan_domains_for(query, cfg, max_results=300):
    res, total = urlscan_search(query, cfg, max_results)
    doms = {norm_domain((r.get("page") or {}).get("domain")) for r in res}
    return {d for d in doms if d}, total


# ------------------------------------------------------------------ crt.sh
def crtsh(domain, cfg):
    for q in ("%." + domain, domain):
        try:
            r = net.get(f"https://crt.sh/?q={quote(q)}&output=json", headers={"User-Agent": UA},
                        timeout=60, min_interval=cfg.get("crtsh_interval", 1.5))
        except Exception:
            continue
        if r.status_code == 200:
            try:
                return r.json()
            except ValueError:
                return []
    return []


def _registrable(host):
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in {"com", "net", "org", "gov", "edu", "co"} and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def cert_history(con, domain, cfg):
    """Idade (1º certificado), vida (último) e irmãos no mesmo certificado."""
    certs = crtsh(domain, cfg)
    if not certs:
        return set()
    befores = sorted(c.get("not_before", "")[:10] for c in certs if c.get("not_before"))
    serials = {c.get("serial_number") for c in certs}
    update(con, domain, cert_first=befores[0] if befores else None,
           cert_last=befores[-1] if befores else None, cert_count=len(serials))
    siblings = set()
    mine = _registrable(domain)
    for c in certs:
        names = {norm_domain(n) for n in (c.get("name_value") or "").split("\n")}
        regs = {_registrable(n) for n in names if n}
        if len(regs) > 1 and len(regs) <= 20:  # certificado compartilhado por poucos domínios
            serial = c.get("serial_number") or c.get("id")
            add_link(con, domain, "cert", serial)
            for reg in regs - {mine}:
                siblings.add((reg, serial))
    return siblings


# ------------------------------------------------------------------ Certstream
def certstream_listen(con, cfg, limit=None):
    """Escuta certificados emitidos em tempo real e guarda os que batem nos padrões."""
    try:
        import websocket  # websocket-client
    except ImportError:
        raise SystemExit("Instale: pip install websocket-client")
    pat = re.compile("|".join(cfg["certstream_patterns"]), re.I)
    tlds = tuple(cfg.get("certstream_tlds") or ())
    seen = {"n": 0, "msgs": 0}

    def on_message(ws, msg):
        seen["msgs"] += 1
        if seen["msgs"] % 20000 == 0:
            log(f"  {seen['msgs']} certificados vistos, {seen['n']} domínios guardados")
        try:
            data = json.loads(msg)
        except ValueError:
            return
        if data.get("message_type") != "certificate_update":
            return
        for name in data.get("data", {}).get("leaf_cert", {}).get("all_domains", []):
            d = norm_domain(name)
            if not d or (tlds and not d.endswith(tlds)) or not pat.search(d):
                continue
            if add_domain(con, d, "certstream"):
                con.commit()
                seen["n"] += 1
                log(f"  novo: {d}")
                if limit and seen["n"] >= limit:
                    ws.close()

    import time
    log(f"Conectando a {cfg['certstream_url']} (Ctrl+C para parar)...")
    failures = 0
    while True:
        before = seen["msgs"]
        ws = websocket.WebSocketApp(
            cfg["certstream_url"], on_message=on_message,
            on_error=lambda ws, e: log(f"  erro no Certstream: {e}"))
        ws.run_forever(ping_interval=30, ping_timeout=10)
        if limit and seen["n"] >= limit:
            return
        failures = 0 if seen["msgs"] > before else failures + 1
        if failures >= 3:
            log("  Certstream não respondeu em 3 tentativas; servidor provavelmente fora do ar. Pulando.")
            return
        log("  conexão caiu; reconectando em 5s")
        time.sleep(5)


def crtsh_keyword_discovery(con, cfg):
    """Alternativa ao Certstream: busca certificados recentes por palavra no nome."""
    new = 0
    since = (dt.date.today() - dt.timedelta(days=cfg.get("crtsh_days", 7))).isoformat()
    for kw in cfg.get("crtsh_keywords", []):
        try:
            r = net.get(f"https://crt.sh/?q={quote('%' + kw + '%')}&output=json&exclude=expired",
                        headers={"User-Agent": UA}, timeout=120, min_interval=3)
        except Exception as e:
            log(f"  crt.sh [{kw}]: {type(e).__name__} (crt.sh costuma ficar lento; tenta amanhã)")
            continue
        if r.status_code != 200:
            log(f"  crt.sh [{kw}]: HTTP {r.status_code}")
            continue
        try:
            rows = r.json()
        except ValueError:
            continue
        n0 = new
        for c in rows:
            if (c.get("not_before") or "")[:10] < since:
                continue
            for n in (c.get("name_value") or "").split("\n"):
                d = norm_domain(n)
                if d and add_domain(con, d, "crtsh"):
                    new += 1
        con.commit()
        log(f"  crt.sh [{kw}]: {new - n0} domínios novos")
    return new


# ------------------------------------------------------------------ PublicWWW
def publicwww_domains(snippet, cfg, limit=500):
    """Domínios cujo código-fonte contém o trecho (exige chave paga do PublicWWW)."""
    key = cfg.get("publicwww_api_key")
    if not key:
        return set()
    url = f"https://publicwww.com/websites/{quote(chr(34) + snippet + chr(34))}/"
    try:
        r = net.get(url, params={"export": "csvu", "key": key}, timeout=90, min_interval=2)
    except Exception as e:
        log(f"  PublicWWW falhou: {e}")
        return set()
    if r.status_code != 200:
        log(f"  PublicWWW {r.status_code} para {snippet}")
        return set()
    out = set()
    for line in r.text.splitlines()[:limit]:
        d = norm_domain(line.split(";")[0].split(",")[0])
        if d:
            out.add(d)
    return out


# ------------------------------------------------------------------ Extensão
def import_extension_csv(con, path):
    """Importa anuncios_*.csv ou dominios_*.csv exportados pela extensão."""
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        return 0
    agg = {}
    if "library_id" in rows[0]:  # um anúncio por linha
        for r in rows:
            d = norm_domain(r.get("destination_domain") or r.get("destination_url"))
            if not d:
                continue
            a = agg.setdefault(d, {"ads": 0, "video": 0, "max": 0, "pages": set()})
            a["ads"] += 1
            a["video"] += 1 if r.get("has_video") == "sim" else 0
            try:
                a["max"] = max(a["max"], int(r.get("days_running") or 0))
            except ValueError:
                pass
            if r.get("page_url") or r.get("page_name"):
                a["pages"].add(r.get("page_url") or r.get("page_name"))
    else:  # resumo por domínio
        for r in rows:
            d = norm_domain(r.get("destination_domain"))
            if not d:
                continue
            pages = set(filter(None, (r.get("page_names") or "").split(" | ")))
            agg[d] = {"ads": int(r.get("ads") or 0), "video": int(r.get("video_ads") or 0),
                      "max": int(r.get("max_days_running") or 0), "pages": pages}
    new = 0
    for d, a in agg.items():
        if add_domain(con, d, "anuncios"):
            new += 1
        row = con.execute("SELECT ad_count, ad_video, ad_max_days FROM domains WHERE domain=?",
                          (d,)).fetchone()
        if row is None:  # infraestrutura (ex.: bit.ly) é ignorada
            continue
        update(con, d, ad_count=max(a["ads"], row["ad_count"] or 0),
               ad_video=max(a["video"], row["ad_video"] or 0),
               ad_max_days=max(a["max"], row["ad_max_days"] or 0),
               ad_pages=len(a["pages"]))
        for p in a["pages"]:
            add_link(con, d, "adpage", p)
    con.commit()
    return new


def import_seeds(con, path, source="manual"):
    new = 0
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and add_domain(con, line, source):
                new += 1
    con.commit()
    return new


# ------------------------------------------------------------------ Tranco
def tranco_ranks(domains, cache_path):
    """Posição no ranking Tranco (top 1M sites por tráfego). Baixa uma vez por dia."""
    import os
    import time
    if not os.path.exists(cache_path) or time.time() - os.path.getmtime(cache_path) > 86400:
        log("  baixando lista Tranco (~10 MB)...")
        r = net.get("https://tranco-list.eu/top-1m.csv.zip", timeout=180)
        if r.status_code != 200:
            log(f"  Tranco indisponível ({r.status_code})")
            return {}
        with open(cache_path, "wb") as f:
            f.write(r.content)
    want = set(domains)
    out = {}
    with zipfile.ZipFile(cache_path) as z:
        with z.open(z.namelist()[0]) as f:
            for line in io.TextIOWrapper(f, encoding="utf-8"):
                rank, _, dom = line.strip().partition(",")
                if dom in want:
                    out[dom] = int(rank)
    return out
