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
from .db import add_domain, add_link, norm_domain, now, update
from .signatures import STRONG_PLAYERS, extract

AD_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 "
         "(KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0;FBBV/650000000;"
         "FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBLC/pt_BR]")
BOT_UA = "python-requests/2.32"


def _fetch(domain, profile, timeout):
    if profile == "ad":
        url = f"https://{domain}/?fbclid=IwAR{secrets.token_urlsafe(24)}&utm_source=facebook&utm_medium=paid"
        headers = {"User-Agent": AD_UA, "Referer": "https://l.facebook.com/",
                   "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.6"}
    else:
        url = f"https://{domain}/"
        headers = {"User-Agent": BOT_UA}
    try:
        r = net.get(url, headers=headers, timeout=timeout)
        return r.status_code, r.url, r.text[:2_000_000]
    except Exception:
        if profile == "ad":
            try:  # alguns domínios novos ainda não têm HTTPS válido
                r = net.get(url.replace("https://", "http://", 1), headers=headers, timeout=timeout)
                return r.status_code, r.url, r.text[:2_000_000]
            except Exception:
                pass
        return None, None, ""


def _render(domain, timeout):
    """Renderiza com Chromium (opcional) para pegar scripts inseridos por JS."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
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


def analyze_one(domain, render=False, timeout=20):
    status, final, html = _render(domain, timeout) if render else _fetch(domain, "ad", timeout)
    sig = extract(html)
    bot_status, bot_final, bot_html = _fetch(domain, "bot", timeout)
    bot = extract(bot_html)
    ad_hits = bool(sig["players"] or sig["checkouts"])
    bot_hits = bool(bot["players"] or bot["checkouts"])
    final_dom = norm_domain(final) if final else None
    bot_dom = norm_domain(bot_final) if bot_final else None
    cloaked = (ad_hits and not bot_hits) or (
        final_dom and bot_dom and final_dom != bot_dom and ad_hits)
    try:
        ip = socket.gethostbyname(domain)
    except OSError:
        ip = None
    return {
        "domain": domain, "status": status, "final_url": final, "final_domain": final_dom,
        "sig": sig, "cloaked": bool(cloaked), "ip": ip,
    }


def save(con, res):
    d, s = res["domain"], res["sig"]
    alive = 1 if res["status"] and res["status"] < 400 else 0
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
           ip=res["ip"])
    # A página pode ter mudado desde a última análise: troca os IDs pelos atuais.
    con.execute("""DELETE FROM links WHERE domain=? AND kind IN
                   ('product','gtm','ga4','ua','fbpixel','ttpixel','utmify')""", (d,))
    for kind, vals in s["tracking"].items():
        for v in vals:
            add_link(con, d, kind, v)
    for p in s["products"]:
        add_link(con, d, "product", p)
    if res["ip"]:
        add_link(con, d, "ip", res["ip"])


def pending(con, hours):
    q = """SELECT domain FROM domains
           WHERE last_analyzed IS NULL OR last_analyzed < datetime('now', 'localtime', ?)
           ORDER BY last_analyzed IS NOT NULL, first_discovered DESC"""
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

    def job(d):
        if deadline and time.time() > deadline:
            return None  # tempo da rodada esgotado: fica para a próxima
        return analyze_one(d, render, cfg.get("timeout", 20))

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


def is_offer(row):
    """Critério mínimo para entrar no ranking: VSL forte ou checkout de infoproduto."""
    from .db import jl
    players = set(jl(row["players"]))
    return bool(jl(row["checkouts"]) or players & STRONG_PLAYERS or
                (players and row["vsl_text"]) or (row["ad_count"] or 0) > 0)
