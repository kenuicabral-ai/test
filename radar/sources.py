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
import time
import zipfile
from urllib.parse import quote

from . import net
from .db import add_domain, add_link, norm_domain, update

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"


def log(*a):
    print(*a, flush=True)


# Freios: quando um serviço limita o acesso ou cai, para de chamá-lo nesta rodada
# em vez de gastar o tempo esperando. O que faltou fica para a próxima rodada.
BREAKER = {"urlscan": False, "crtsh_fail": 0, "crtsh_kw_fail": 0}

# Cota do urlscan: ele conta cada BUSCA (não cada resultado). A rodada lê quantas
# buscas restam e reparte entre descoberta, varreduras e expansão, em vez de gastar
# tudo na primeira etapa. "cap" é o teto da etapa em andamento (None = sem teto).
QUOTA = {"checked": False, "left": None, "used": 0, "cap": None}


def urlscan_available():
    if BREAKER["urlscan"]:
        return False
    if QUOTA["left"] is not None and QUOTA["used"] >= QUOTA["left"]:
        return False
    return QUOTA["cap"] is None or QUOTA["used"] < QUOTA["cap"]


def urlscan_left():
    """Buscas que ainda cabem nesta rodada (None = não deu para ler a cota)."""
    if BREAKER["urlscan"]:
        return 0
    return None if QUOTA["left"] is None else max(0, QUOTA["left"] - QUOTA["used"])


# ------------------------------------------------------------------ urlscan
def _urlscan_headers(cfg):
    headers = {"User-Agent": UA}
    if cfg.get("urlscan_api_key"):
        headers["API-Key"] = cfg["urlscan_api_key"]
    return headers


def urlscan_quota(cfg):
    """Lê no próprio urlscan quantas buscas restam (o menor entre o dia e a hora)."""
    QUOTA["checked"] = True
    try:
        r = net.get("https://urlscan.io/user/quotas/", headers=_urlscan_headers(cfg), timeout=20)
        s = r.json()["limits"]["search"]
        day, hour = s["day"], s["hour"]
        QUOTA["left"] = max(0, min(day["remaining"], hour["remaining"]))
    except Exception as e:
        log(f"  urlscan: não consegui ler a cota ({type(e).__name__}); sigo sem orçamento")
        return None
    log(f"  urlscan: {QUOTA['left']} buscas disponíveis agora "
        f"(dia {day['remaining']}/{day['limit']}, hora {hour['remaining']}/{hour['limit']})")
    return QUOTA["left"]


def _page_size(cfg):
    # Com chave, uma busca devolve até milhares de resultados; sem chave, 100.
    return cfg.get("urlscan_page_size") or (1000 if cfg.get("urlscan_api_key") else 100)


def _utc(t):
    return t.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def urlscan_search(query, cfg, max_results=1000, since=None, until=None):
    """Busca no urlscan, da varredura mais recente para a mais antiga.

    Pagina pelo horário (date:[since TO cursor}), o que funciona com e sem chave.
    Retorna (resultados, total, completo): completo=False quando parou antes de ler
    tudo (limite de resultados, cota ou erro).
    """
    if not QUOTA["checked"]:
        urlscan_quota(cfg)
    out, total, cursor, retries = [], None, until, 0
    while len(out) < max_results:
        if not urlscan_available():
            return out, total or 0, False
        q = query
        if since or cursor:
            q += f" AND date:[{since or '*'} TO {cursor + '}' if cursor else 'now]'}"
        size = min(_page_size(cfg), max_results - len(out))
        try:
            r = net.get("https://urlscan.io/api/v1/search/", headers=_urlscan_headers(cfg),
                        params={"q": q, "size": size}, min_interval=cfg.get("urlscan_interval", 2.0))
        except Exception as e:
            log(f"  urlscan falhou: {e}")
            return out, total or 0, False
        if r.status_code == 429:
            try:
                wait = float(r.headers.get("X-Rate-Limit-Reset-After") or 61)
            except (TypeError, ValueError, AttributeError):
                wait = 61
            if wait <= 70 and retries < 1:
                retries += 1
                log(f"  urlscan: limite por minuto; aguardando {wait:.0f}s")
                time.sleep(wait + 1)
                continue
            BREAKER["urlscan"] = True
            log("  urlscan: cota esgotada; consultas ao urlscan pausadas até a próxima rodada.")
            return out, total or 0, False
        if r.status_code == 400 and size > 100:
            cfg["urlscan_page_size"] = 100  # o plano não aceita páginas maiores
            log("  urlscan: páginas limitadas a 100 resultados neste plano")
            continue
        if r.status_code != 200:
            log(f"  urlscan {r.status_code}: {r.text[:150]}")
            return out, total or 0, False
        QUOTA["used"] += 1
        try:
            data = r.json()
        except ValueError:
            return out, total or 0, False
        res = data.get("results") or []
        if total is None:
            total = data.get("total", len(res))
        out.extend(res)
        # "total" é o que resta na faixa pedida: se coube nesta página, acabou.
        if not res or data.get("total", 0) <= len(res):
            return out, total, True
        t = (res[-1].get("task") or {}).get("time")
        if not t or t == cursor:
            break
        cursor = t
    return out, total or 0, False


def _note_age(con, domain, result):
    """Data de criação do domínio, que o urlscan informa (WHOIS) em cada varredura."""
    page = result.get("page") or {}
    days = page.get("apexDomainAgeDays", page.get("domainAgeDays"))
    seen = ((result.get("task") or {}).get("time") or "")[:10]
    if not isinstance(days, int) or days < 0 or not seen:
        return
    try:
        created = (dt.date.fromisoformat(seen) - dt.timedelta(days=days)).isoformat()
    except ValueError:
        return
    # Fica a mais recente: domínio que expirou e foi registrado de novo é novo.
    con.execute("UPDATE domains SET domain_created=? WHERE domain=? AND "
                "(domain_created IS NULL OR domain_created < ?)", (created, domain, created))


def discover_urlscan(con, cfg):
    """Enumera páginas que carregam assinaturas de VSL/checkout/rastreamento.

    Incremental: cada busca guarda até onde já foi lida (tabela discovery). Por dia,
    lê só o que apareceu desde a rodada anterior (uma ou duas buscas por assinatura);
    o histórico de urlscan_backfill_days dias é preenchido aos poucos, do mais recente
    para o mais antigo, com até urlscan_discovery_share da cota disponível.
    """
    from .signatures import seed_signal
    new = 0
    per = cfg.get("urlscan_max_per_query", 1000)
    now_dt = dt.datetime.now(dt.timezone.utc)
    now_ts = _utc(now_dt)
    horizon = _utc(now_dt - dt.timedelta(days=cfg.get("urlscan_backfill_days", 180)))
    first = _utc(now_dt - dt.timedelta(days=cfg.get("urlscan_first_days", 3)))

    def state(q):
        return con.execute("SELECT newest, oldest FROM discovery WHERE query=?", (q,)).fetchone()

    def save(q, newest, oldest):
        con.execute("INSERT OR REPLACE INTO discovery(query, newest, oldest) VALUES(?,?,?)",
                    (q, newest, oldest))
        con.commit()

    def harvest(q, since, until, label):
        nonlocal new
        res, total, complete = urlscan_search(q, cfg, per, since=since, until=until)
        seen, n = seed_signal(q), 0
        for r in res:
            page = r.get("page") or {}
            d = norm_domain(page.get("domain") or page.get("url"))
            if not d:
                continue
            if add_domain(con, d, "urlscan"):
                n += 1
            if page.get("ip"):
                add_link(con, d, "ip", page["ip"])
            if seen:  # testemunha do urlscan: "esta página carregou X"
                add_link(con, d, "seen", f"{seen[0]}:{seen[1]}")
            _note_age(con, d, r)
        con.commit()
        new += n
        if res or complete:
            log(f"  urlscan [{q} | {label}]: {len(res)} varreduras (total ~{total}), {n} domínios novos")
        oldest = (res[-1].get("task") or {}).get("time") if res else None
        return len(res), complete, oldest

    # 1) Novidades desde a última rodada: sempre roda, é barato.
    for q in cfg["urlscan_queries"]:
        if not urlscan_available():
            log("  urlscan sem cota; o resto da descoberta fica para a próxima rodada")
            return new
        st = state(q)
        if st and st["newest"]:
            since = _utc(dt.datetime.fromisoformat(st["newest"].replace("Z", "+00:00"))
                         - dt.timedelta(hours=1))
            got, complete, oldest = harvest(q, since, None, "novas")
            if complete or got >= per:
                if not complete:
                    log(f"  (mais de {per} varreduras desde a última rodada; as mais antigas ficaram de fora)")
                save(q, now_ts, st["oldest"])
        else:
            got, complete, oldest = harvest(q, first, None, "primeira leitura")
            if got or complete:
                save(q, now_ts, first if complete else oldest)

    # 2) Histórico, do ponto mais antigo já lido para trás, com a cota que sobrar.
    # Pixel de rede nativa traz dezenas de milhares de anunciantes comuns por semestre:
    # dele só interessa o que é novo (a fila de análise não daria conta do histórico).
    backfill = [q for q in cfg["urlscan_queries"]
                if cfg.get("urlscan_backfill_adnet") or (seed_signal(q) or ("",))[0] != "adnet"]
    left = urlscan_left()
    QUOTA["cap"] = (QUOTA["used"] + int(left * cfg.get("urlscan_discovery_share", 0.5))
                    if left is not None else None)
    try:
        progress = True
        while progress and urlscan_available():
            progress = False
            for q in backfill:
                st = state(q)
                if not (st and st["oldest"] and st["oldest"] > horizon) or not urlscan_available():
                    continue
                got, complete, oldest = harvest(q, horizon, st["oldest"], "histórico")
                if complete or oldest:
                    save(q, st["newest"], horizon if complete else oldest)
                    progress = True
    finally:
        QUOTA["cap"] = None
    behind = [r["oldest"][:10] for r in con.execute("SELECT query, oldest FROM discovery")
              if r["query"] in backfill and r["oldest"] and r["oldest"] > horizon]
    if behind:
        log(f"  histórico: {len(behind)} buscas ainda não chegaram a {horizon[:10]} "
            f"(a mais atrasada está em {min(behind)}); continua nas próximas rodadas")
    return new


def _owner(host, domains):
    """O domínio do lote a que a varredura pertence (o mais específico)."""
    best = None
    for d in domains:
        if (host == d or host.endswith("." + d)) and (best is None or len(d) > len(best)):
            best = d
    return best


def urlscan_stats(con, domains, cfg):
    """Varreduras de vários domínios numa busca só: page.domain:("a" OR "b" ...).

    Quantas vezes a página foi varrida (proxy de visitas reais) e quando. Se a página
    de resultados não trouxe tudo, divide o lote ao meio e repete: os números de cada
    domínio saem exatos e o custo fica perto de uma busca por lote. Retorna os domínios
    atualizados; os outros ficam para a próxima rodada.
    """
    domains = list(domains)
    if not domains or not urlscan_available():
        return set()
    q = "page.domain:(" + " OR ".join(f'"{d}"' for d in domains) + ")"
    res, total, complete = urlscan_search(q, cfg, _page_size(cfg))
    if not complete:
        if not urlscan_available() or not res:
            return set()  # cota acabou ou erro: tenta na próxima rodada
        if len(domains) > 1:
            h = len(domains) // 2
            return urlscan_stats(con, domains[:h], cfg) | urlscan_stats(con, domains[h:], cfg)
    per = {d: [] for d in domains}
    for r in res:
        owner = _owner(norm_domain((r.get("page") or {}).get("domain")) or "", domains)
        if owner:
            per[owner].append(r)
    cutoff = (dt.date.today() - dt.timedelta(days=30)).isoformat()
    for d, rs in per.items():
        times = sorted(t for t in (((x.get("task") or {}).get("time") or "")[:10] for x in rs) if t)
        update(con, d,
               urlscan_total=len(rs) if complete else max(total, len(rs)),
               urlscan_30d=sum(1 for t in times if t >= cutoff),
               urlscan_first=times[0] if times else None,
               urlscan_last=times[-1] if times else None)
        if rs:
            _note_age(con, d, rs[0])
    return set(domains)


def urlscan_ip_domains(ips, cfg):
    """Domínios hospedados em cada IP, vários IPs por busca (mesma divisão do lote).

    Retorna {ip: domínios} só dos IPs respondidos; os outros ficam para depois.
    """
    ips = list(ips)
    if not ips or not urlscan_available():
        return {}
    q = "page.ip:(" + " OR ".join(f'"{ip}"' for ip in ips) + ")"
    res, total, complete = urlscan_search(q, cfg, _page_size(cfg))
    if not complete and len(ips) > 1:
        if not urlscan_available() or not res:
            return {}
        h = len(ips) // 2
        return {**urlscan_ip_domains(ips[:h], cfg), **urlscan_ip_domains(ips[h:], cfg)}
    if not complete and not res:
        return {}
    out = {ip: set() for ip in ips}
    for r in res:
        page = r.get("page") or {}
        d = norm_domain(page.get("domain"))
        if d and page.get("ip") in out:
            out[page["ip"]].add(d)
    return out


# ------------------------------------------------------------------ crt.sh
def crtsh(domain, cfg):
    """Certificados do domínio. None = crt.sh não respondeu (tenta de novo depois)."""
    if BREAKER["crtsh_fail"] >= 3:
        return None
    for q in ("%." + domain, domain):
        try:
            r = net.get(f"https://crt.sh/?q={quote(q)}&output=json", headers={"User-Agent": UA},
                        timeout=60, min_interval=cfg.get("crtsh_interval", 1.5))
        except Exception:
            continue
        if r.status_code == 200:
            BREAKER["crtsh_fail"] = 0
            try:
                return r.json()
            except ValueError:
                return []
    BREAKER["crtsh_fail"] += 1
    if BREAKER["crtsh_fail"] == 3:
        log("  crt.sh: 3 falhas seguidas; consultas ao crt.sh pausadas nesta rodada.")
    return None


def _registrable(host):
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in {"com", "net", "org", "gov", "edu", "co"} and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def cert_history(con, domain, cfg):
    """Idade (1º certificado), vida (último) e irmãos no mesmo certificado.

    None quando o crt.sh não respondeu (o domínio fica para a próxima rodada).
    """
    certs = crtsh(domain, cfg)
    if certs is None:
        return None
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
        if BREAKER["crtsh_kw_fail"] >= 2:
            log("  crt.sh fora do ar; busca por palavra pulada.")
            break
        try:
            r = net.get(f"https://crt.sh/?q={quote('%' + kw + '%')}&output=json&exclude=expired",
                        headers={"User-Agent": UA}, timeout=120, min_interval=3)
        except Exception as e:
            log(f"  crt.sh [{kw}]: {type(e).__name__} (crt.sh costuma ficar lento; tenta amanhã)")
            BREAKER["crtsh_kw_fail"] += 1
            continue
        if r.status_code != 200:
            log(f"  crt.sh [{kw}]: HTTP {r.status_code}")
            BREAKER["crtsh_kw_fail"] += 1
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
    return _apply_ads(con, agg, "anuncios")


def _apply_ads(con, agg, source):
    """Grava dados de anúncio (idade, vídeo, volume) e o anunciante no domínio de destino.

    Compartilhado pela extensão e pelo Apify. fb_ids/fb_names viram o anunciante, com
    link exato da Biblioteca pelo page_id.
    """
    new = 0
    for d, a in agg.items():
        if add_domain(con, d, source):
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
        for fid in a.get("fb_ids", ()):
            add_link(con, d, "social", f"fb_id:{fid}")
        for fn in a.get("fb_names", ()):
            add_link(con, d, "social", f"brand:{fn}")
    con.commit()
    return new


# ------------------------------------------------------------------ Apify (API de anúncios)
def _ads_library_url(s):
    """Aceita uma URL pronta da Biblioteca, um page_id, ou {q, country}."""
    base = "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&media_type=all"
    if isinstance(s, str):
        if s.startswith("http"):
            return s
        if s.isdigit():
            return f"{base}&view_all_page_id={s}"
        s = {"q": s}
    from urllib.parse import quote
    country = s.get("country", "BR")
    if s.get("page_id"):
        return f"{base}&country={country}&view_all_page_id={s['page_id']}"
    return f"{base}&country={country}&q={quote(s.get('q', ''))}&search_type=keyword_unordered"


def _unwrap_fb(url):
    """l.facebook.com/l.php?u=<destino> -> destino."""
    from urllib.parse import parse_qs, unquote, urlparse
    try:
        u = urlparse(url)
    except ValueError:
        return url
    if (u.hostname or "").lower() in ("l.facebook.com", "lm.facebook.com") or u.path == "/l.php":
        q = parse_qs(u.query).get("u")
        if q:
            return unquote(q[0])
    return url


def _accum_apify(agg, it):
    snap = it.get("snapshot") if isinstance(it.get("snapshot"), dict) else {}
    link = (it.get("linkUrl") or it.get("link") or it.get("url") or it.get("landingUrl")
            or snap.get("link_url"))
    d = norm_domain(_unwrap_fb(link) if link else None)
    if not d:
        return
    a = agg.setdefault(d, {"ads": 0, "video": 0, "max": 0, "pages": set(),
                           "fb_ids": set(), "fb_names": set()})
    a["ads"] += 1
    vids = it.get("videos") or it.get("video") or snap.get("videos")
    if vids or (it.get("displayFormat") or "").lower() in ("video", "dco_video"):
        a["video"] += 1
    start = it.get("startDate") or it.get("start_date") or it.get("startDateFormatted") \
        or it.get("ad_delivery_start_time")
    days = _ad_age_days(start)
    if days is not None:
        a["max"] = max(a["max"], days)
    pid, pname = it.get("pageId") or it.get("page_id"), it.get("pageName") or it.get("page_name")
    if pname:
        a["pages"].add(pname)
        a["fb_names"].add(str(pname)[:80])
    if pid and str(pid).isdigit():
        a["fb_ids"].add(str(pid))


def _ad_age_days(start):
    if start in (None, ""):
        return None
    try:  # epoch (segundos)
        n = int(float(start))
        if n > 10_000_000:
            return max(0, (dt.date.today() - dt.date.fromtimestamp(n)).days)
    except (TypeError, ValueError):
        pass
    try:  # ISO 'YYYY-MM-DD...'
        return max(0, (dt.date.today() - dt.date.fromisoformat(str(start)[:10])).days)
    except ValueError:
        return None


def apify_fetch(con, cfg):
    """Puxa anúncios reais (destino, idade, anunciante) via Apify. Opcional e pago."""
    token = cfg.get("apify_token")
    searches = list(cfg.get("apify_searches") or [])
    # Puxa automaticamente todos os anúncios dos anunciantes que já achamos (page_id):
    # é o ciclo que se fecha sozinho — achou o dono, puxa a operação inteira dele.
    auto = cfg.get("apify_auto_advertisers", 0)
    if token and auto:
        ids = [r["value"].split(":", 1)[1] for r in con.execute(
            "SELECT DISTINCT value FROM links WHERE kind='social' AND value LIKE 'fb_id:%' LIMIT ?",
            (auto,))]
        searches += [{"page_id": i} for i in ids]
    if not token or not searches:
        return 0
    actor = (cfg.get("apify_actor") or "apify/facebook-ads-scraper").replace("/", "~")
    limit = cfg.get("apify_limit", 200)
    endpoint = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={token}"
    agg = {}
    for s in searches:
        url = _ads_library_url(s)
        payload = {"startUrls": [{"url": url}], "urls": [url], "count": limit,
                   "resultsLimit": limit, "maxItems": limit, "activeStatus": "active"}
        try:
            r = net.post(endpoint, json=payload, timeout=cfg.get("apify_timeout", 600))
        except Exception as e:
            log(f"  apify falhou ({s}): {e}")
            continue
        if r.status_code not in (200, 201):
            log(f"  apify {r.status_code}: {r.text[:200]}")
            continue
        try:
            items = r.json()
        except ValueError:
            continue
        n = len(agg)
        for it in (items or []):
            if isinstance(it, dict):
                _accum_apify(agg, it)
        log(f"  apify [{url[:60]}...]: {len(items or [])} anúncios, {len(agg) - n} destinos novos")
    return _apply_ads(con, agg, "apify")


def import_seeds(con, path, source="manual"):
    new = 0
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and add_domain(con, line, source):
                new += 1
    con.commit()
    return new


_ANY_URL = re.compile(r"https?://[^\s\"',;]+", re.I)


def import_urls(con, path, source="adspy"):
    """Importa qualquer export com URLs/domínios de destino (AdHeart, BigSpy, etc.).

    Lê o arquivo inteiro (CSV, TSV, txt — qualquer formato), extrai todas as URLs e
    também domínios soltos, e joga os destinos no radar. Encurtadores/trackers viram
    o próprio domínio deles agora e são resolvidos até o destino final na análise.
    """
    with open(path, encoding="utf-8", errors="ignore") as f:
        text = f.read()
    cands = set(_ANY_URL.findall(text))
    for tok in re.split(r"[\s\"',;|]+", text):  # domínios soltos sem http
        if "." in tok and "/" not in tok and not tok.startswith("@"):
            cands.add(tok)
    new = 0
    for c in cands:
        d = norm_domain(c)
        if d and add_domain(con, d, source):
            new += 1
    con.commit()
    return new


# ------------------------------------------------------------------ Tranco
def tranco_ranks(domains, cache_path):
    """Posição no ranking Tranco (top 1M sites por tráfego). Baixa uma vez por dia."""
    import os
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
