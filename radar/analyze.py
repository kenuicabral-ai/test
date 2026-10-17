"""Visita cada domínio como alguém que clicou num anúncio e como um robô comum.

Se a versão "clique de anúncio" mostra VSL/checkout e a do robô não, a página
usa cloaking. Isso vira um SINAL (quem esconde a página está pagando tráfego),
não um obstáculo.
"""
import secrets
import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from . import net
from .db import STORE_MIN_PRODUCTS, add_domain, add_link, norm_domain, now, update
from .signatures import STRONG_PLAYERS, extract

AD_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 "
         "(KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0;FBBV/650000000;"
         "FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBLC/pt_BR]")
BOT_UA = "python-requests/2.32"


def _fetch(domain, profile, timeout, proxy=None):
    # Perfil "ad" imita um clique de anúncio no Facebook (celular, referência do FB,
    # fbclid). Com um proxy residencial no país-alvo, isso faz o cloaker abrir a
    # página real, porque é exatamente o visitante que ele quer deixar passar.
    if profile == "ad":
        url = f"https://{domain}/?fbclid=IwAR{secrets.token_urlsafe(24)}&utm_source=facebook&utm_medium=paid"
        headers = {"User-Agent": AD_UA, "Referer": "https://l.facebook.com/",
                   "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.6"}
    else:
        url = f"https://{domain}/"
        headers = {"User-Agent": BOT_UA}
        proxy = None  # o perfil robô vai sempre direto, para o contraste revelar o cloaking

    def body(r):
        if not r.encoding or r.encoding.lower() == "iso-8859-1":
            r.encoding = r.apparent_encoding or "utf-8"  # evita acentos trocados
        return r.text[:2_000_000]

    try:
        r = net.get(url, headers=headers, timeout=timeout, proxy=proxy)
        return r.status_code, r.url, body(r)
    except Exception:
        if profile == "ad":
            try:  # alguns domínios novos ainda não têm HTTPS válido
                r = net.get(url.replace("https://", "http://", 1), headers=headers,
                            timeout=timeout, proxy=proxy)
                return r.status_code, r.url, body(r)
            except Exception:
                pass
        return None, None, ""


def _render(domain, timeout, proxy=None):
    """Renderiza com Chromium (opcional) para pegar scripts inseridos por JS."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(proxy={"server": proxy} if proxy else None)
        ctx = b.new_context(user_agent=AD_UA, locale="pt-BR",
                            viewport={"width": 390, "height": 844}, is_mobile=True,
                            extra_http_headers={"Referer": "https://l.facebook.com/"})
        page = ctx.new_page()
        urls = []
        page.on("request", lambda req: urls.append(req.url))
        try:
            resp = page.goto(f"https://{domain}/?fbclid=IwAR{secrets.token_urlsafe(24)}",
                             timeout=timeout * 1000, wait_until="networkidle")
            html = page.content() + "\n" + "\n".join(urls)
            return (resp.status if resp else None), page.url, html
        except Exception:
            return None, None, ""
        finally:
            b.close()


def analyze_one(domain, render=False, timeout=20, proxy=None):
    # Domínio sem DNS está fora do ar: responde na hora, sem esperar dois timeouts.
    try:
        ip = socket.gethostbyname(domain)
    except OSError:
        return {"domain": domain, "status": None, "final_url": None, "final_domain": None,
                "sig": extract(""), "cloaked": False, "ip": None}
    status, final, html = (_render(domain, timeout, proxy) if render
                           else _fetch(domain, "ad", timeout, proxy))
    sig = extract(html)
    # Se nem a visita de "clique de anúncio" respondeu, a do robô não vai responder.
    bot_status, bot_final, bot_html = _fetch(domain, "bot", timeout) if status else (None, None, "")
    bot = extract(bot_html)
    ad_hits = bool(sig["players"] or sig["checkouts"])
    bot_hits = bool(bot["players"] or bot["checkouts"])
    final_dom = norm_domain(final) if final else None
    bot_dom = norm_domain(bot_final) if bot_final else None
    cloaked = (ad_hits and not bot_hits) or (
        final_dom and bot_dom and final_dom != bot_dom and ad_hits)
    return {
        "domain": domain, "status": status, "final_url": final, "final_domain": final_dom,
        "sig": sig, "cloaked": bool(cloaked), "ip": ip,
    }


def save(con, res):
    d, s = res["domain"], res["sig"]
    alive = 1 if res["status"] and res["status"] < 400 and not s.get("dead") else 0
    fd = res["final_domain"]
    if fd and fd != d:
        # Encurtador/tracker/página de entrada: a oferta é o destino. Guarda só o vínculo,
        # para não contar a mesma oferta duas vezes.
        update(con, d, last_analyzed=now(), alive=alive, status_code=res["status"],
               final_url=res["final_url"], title=s["title"], players=[], checkouts=[],
               checkout_urls=[], vsl_text=0, cloaked=int(res["cloaked"]), ip=res["ip"])
        add_domain(con, fd, "redirect")
        add_link(con, d, "redirect", fd)
        add_link(con, fd, "redirect", fd)
        return
    update(con, d, last_analyzed=now(), alive=alive, status_code=res["status"],
           final_url=res["final_url"], title=s["title"], lang=s["lang"],
           players=s["players"], checkouts=s["checkouts"], checkout_urls=s["checkout_urls"],
           text_sample=s["text"], vsl_text=int(s["vsl_text"]), cloaked=int(res["cloaked"]),
           ip=res["ip"], store=int(len(s["products"]) >= STORE_MIN_PRODUCTS))
    # A página pode ter mudado desde a última análise: troca os IDs pelos atuais.
    con.execute("""DELETE FROM links WHERE domain=? AND kind IN
                   ('product','gtm','ga4','ua','fbpixel','ttpixel','utmify','adnet','social','video')""", (d,))
    con.execute("DELETE FROM links WHERE domain=? AND kind='tracker'", (d,))
    if s.get("dead"):
        # Página de estacionamento/expirado: os IDs (GA, GTM) são do provedor de
        # hospedagem, não do anunciante; ligariam dezenas de domínios sem relação.
        if res["ip"]:
            add_link(con, d, "ip", res["ip"])
        return
    # O que a varredura do urlscan viu na página real (radar/witness.py) continua valendo,
    # mesmo que a nossa visita caia na página isca.
    con.execute("""INSERT OR IGNORE INTO links(domain, kind, value)
                   SELECT domain, kind, value FROM witness_links WHERE domain=?""", (d,))
    for kind, vals in s["tracking"].items():
        for v in vals:
            add_link(con, d, kind, v)
    for p in s["products"]:
        add_link(con, d, "product", p)
    for n in s.get("adnets", []):
        add_link(con, d, "adnet", n)
    for n in s.get("trackers", []):
        add_link(con, d, "tracker", n)
    for v in s.get("videos", []):
        add_link(con, d, "video", v)
    # Histórico: registra cada pixel/vídeo/produto já visto no domínio (não é apagado),
    # para medir quantas vezes ele trocou de pixel ao longo do tempo.
    ts = now()
    for kind, vals in (("fbpixel", s["tracking"].get("fbpixel", [])),
                       ("video", s.get("videos", [])), ("product", s["products"])):
        for v in vals:
            con.execute(
                "INSERT INTO signal_history(domain,kind,value,first_seen,last_seen) VALUES(?,?,?,?,?) "
                "ON CONFLICT(domain,kind,value) DO UPDATE SET last_seen=excluded.last_seen",
                (d, kind, v, ts, ts))
    for k, v in s.get("advertiser", {}).items():
        add_link(con, d, "social", f"{k}:{v}")
    if res["ip"]:
        add_link(con, d, "ip", res["ip"])


def pending(con, hours):
    """Fila de análise, do mais promissor para o menos promissor.

    0. novos que o urlscan viu com player/checkout, ou vindos de anúncio/semente/redirect;
    1. reanálise de quem já é oferta;
    2. novos com testemunha de tracker, ou da expansão/certificados;
    3. novos só com testemunha de rede de anúncio (pixel de nativo: muito volume, pouca oferta);
    4. reanálise do resto.
    """
    q = """WITH seen AS (
             SELECT domain, MAX(value LIKE 'player:%' OR value LIKE 'checkout:%') AS strong,
                    MAX(value LIKE 'tracker:%') AS tracker
             FROM links WHERE kind='seen' GROUP BY domain)
           SELECT d.domain FROM domains d LEFT JOIN seen s ON s.domain = d.domain
           WHERE d.last_analyzed IS NULL OR d.last_analyzed < datetime('now', 'localtime', ?)
           ORDER BY CASE
             WHEN d.last_analyzed IS NULL AND (s.strong OR d.sources LIKE '%anuncios%'
                  OR d.sources LIKE '%apify%' OR d.sources LIKE '%manual%'
                  OR d.sources LIKE '%adspy%' OR d.sources LIKE '%redirect%') THEN 0
             WHEN d.last_analyzed IS NOT NULL AND d.score IS NOT NULL THEN 1
             WHEN d.last_analyzed IS NULL AND (s.tracker OR s.domain IS NULL) THEN 2
             WHEN d.last_analyzed IS NULL THEN 3
             ELSE 4 END, d.first_discovered DESC"""
    return [r["domain"] for r in con.execute(q, (f"-{hours} hours",))]


def run(con, cfg, render=False, limit=None, log=print):
    todo = pending(con, cfg.get("reanalyze_hours", 24))
    if limit:
        todo = todo[:limit]
    if not todo:
        log("  nada para analisar")
        return 0
    log(f"  analisando {len(todo)} domínios ({cfg.get('workers', 8)} em paralelo)...")
    workers = 1 if render else cfg.get("workers", 8)
    done = hits = 0
    # Cada análise usa no máximo 60% do tempo restante, para sobrar tempo para a
    # expansão e o enriquecimento mesmo quando há muitos domínios na fila.
    g = cfg.get("_deadline")
    deadline = time.time() + max(0, g - time.time()) * cfg.get("analyze_share", 0.6) if g else None

    proxy = cfg.get("proxy") or None

    def job(d):
        if deadline and time.time() > deadline:
            return None  # tempo da rodada esgotado: fica para a próxima
        return analyze_one(d, render, cfg.get("timeout", 20), proxy)

    with ThreadPoolExecutor(workers) as ex:
        futs = {ex.submit(job, d): d for d in todo}
        for f in as_completed(futs):
            try:
                res = f.result()
            except Exception as e:  # nunca deixa um domínio derrubar a rodada
                log(f"  erro em {futs[f]}: {e}")
                continue
            if res is None:
                continue
            save(con, res)
            done += 1
            if res["sig"]["players"] or res["sig"]["checkouts"]:
                hits += 1
            if done % 25 == 0:
                con.commit()
                log(f"  {done}/{len(todo)} analisados, {hits} com VSL/checkout")
    con.commit()
    left = len(todo) - done
    log(f"  concluído: {done} analisados, {hits} com VSL/checkout"
        + (f" ({left} ficaram para a próxima rodada)" if left and deadline and time.time() > deadline else ""))
    return done


# Domínios que o urlscan testemunhou carregando player/checkout/tracker, mesmo que a
# nossa leitura tenha caído no cloaking. Preenchido por refresh_seen() antes de pontuar.
SEEN_OFFERS = set()


def refresh_seen(con):
    SEEN_OFFERS.clear()
    for r in con.execute("SELECT DISTINCT domain FROM links WHERE kind='seen' AND "
                         "(value LIKE 'player:%' OR value LIKE 'checkout:%' OR value LIKE 'tracker:%')"):
        SEEN_OFFERS.add(r["domain"])


def is_offer(row):
    """Entra no ranking: VSL/checkout na nossa leitura, anúncio, ou testemunha do urlscan.

    A testemunha do urlscan é o que impede uma grande oferta com cloaking de sumir só
    porque ela nos mostrou a página isca. Loja virtual (dezenas de produtos no checkout)
    fica de fora, a não ser que tenha player de VSL.
    """
    from .db import jl
    players = set(jl(row["players"]))
    if row["store"] and not players & STRONG_PLAYERS:
        return False
    return bool(jl(row["checkouts"]) or players & STRONG_PLAYERS or
                (players and row["vsl_text"]) or (row["ad_count"] or 0) > 0 or
                row["domain"] in SEEN_OFFERS)
