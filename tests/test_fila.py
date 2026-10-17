"""Fila de análise, vazão e enriquecimento (rede simulada)."""
import datetime as dt
import importlib.util
import os
import socket

import pytest

from radar import analyze, sources
from radar.db import add_domain, add_link, update

from conftest import FakeUrlscan, scan

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("radar_cli", os.path.join(ROOT, "radar.py"))
radar_cli = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(radar_cli)


def ago(days):
    return sources._utc(dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days))


def test_queue_puts_witnessed_offers_before_native_noise(con):
    for d in ("nativo.com", "tracker.com", "vsl.com", "velha-oferta.com", "semente.com", "ip.com"):
        add_domain(con, d, "urlscan")
    add_domain(con, "semente.com", "manual")
    add_domain(con, "ip.com", "grafo:ip")
    add_link(con, "nativo.com", "seen", "adnet:taboola")
    add_link(con, "tracker.com", "seen", "tracker:hyros")
    add_link(con, "vsl.com", "seen", "player:vturb")
    # Oferta já conhecida, analisada há 2 dias: reanálise vem logo depois dos novos fortes.
    update(con, "velha-oferta.com", last_analyzed="2000-01-01T00:00:00", score=50)
    order = analyze.pending(con, 24)
    assert order.index("vsl.com") < order.index("velha-oferta.com") < order.index("tracker.com")
    assert order.index("semente.com") < order.index("velha-oferta.com")
    assert order.index("ip.com") < order.index("nativo.com")
    assert order[-1] == "nativo.com"


def test_dead_dns_answers_without_fetching(monkeypatch):
    calls = []
    monkeypatch.setattr(socket, "gethostbyname", lambda d: (_ for _ in ()).throw(OSError("nx")))
    monkeypatch.setattr(analyze.net, "get", lambda *a, **k: calls.append(a) or None)
    res = analyze.analyze_one("nao-existe.com", timeout=1)
    assert res["status"] is None and res["ip"] is None and calls == []


def test_unreachable_page_skips_bot_visit(monkeypatch):
    calls = []
    monkeypatch.setattr(socket, "gethostbyname", lambda d: "1.2.3.4")

    def boom(url, **kw):
        calls.append(url)
        raise ConnectionError("timeout")
    monkeypatch.setattr(analyze.net, "get", boom)
    res = analyze.analyze_one("lento.com", timeout=1)
    assert res["status"] is None
    assert len(calls) == 2  # https e http do clique de anúncio; a visita do robô é pulada


@pytest.fixture
def fake(monkeypatch):
    def make(scans, **kw):
        f = FakeUrlscan(scans, **kw)
        monkeypatch.setattr(sources.net, "get", f.get)
        return f
    return make


def test_stats_are_not_redone_when_crtsh_is_down(con, fake, monkeypatch):
    for d in ("a.com", "b.com"):
        add_domain(con, d, "t")
        update(con, d, checkouts='["hotmart"]')
    f = fake([scan("a.com", ago(1)), scan("b.com", ago(2))])
    monkeypatch.setattr(sources, "crtsh", lambda d, cfg: None)  # crt.sh fora do ar
    cfg = {"enrich_days": 7, "urlscan_interval": 0}
    radar_cli.enrich(con, cfg)
    rows = {r["domain"]: r for r in con.execute("SELECT * FROM domains")}
    assert all(r["stats_checked"] for r in rows.values())
    assert not any(r["last_enriched"] for r in rows.values())  # certificados ficam pendentes
    n = len(f.calls)
    radar_cli.enrich(con, cfg)
    assert len(f.calls) == n  # dia seguinte: não gasta cota refazendo as varreduras


def test_native_pixel_queries_have_no_backfill(con, fake):
    f = fake([scan(f"n{i}.com", ago(10 + i), ["tfa.js"]) for i in range(5)]
             + [scan("vsl.com", ago(20), ["converteai.net"])])
    cfg = {"urlscan_interval": 0, "urlscan_max_per_query": 1000, "urlscan_first_days": 3,
           "urlscan_backfill_days": 180, "urlscan_discovery_share": 0.5,
           "urlscan_queries": ['filename:"tfa.js"', "domain:converteai.net"]}
    sources.discover_urlscan(con, cfg)
    doms = {r["domain"] for r in con.execute("SELECT domain FROM domains")}
    assert doms == {"vsl.com"}  # o histórico do player entra; o do pixel de nativo não
    assert not any("tfa.js" in q and "TO 20" in q and "now]" not in q for q in f.calls)


def test_dead_titles_already_in_db_are_fixed_at_ranking(con):
    """Regra nova vale já no próximo ranking, sem esperar reanalisar 30 mil domínios."""
    add_domain(con, "viralpackage.shop", "urlscan")
    update(con, "viralpackage.shop", alive=1, title="Your domain is expired",
           last_analyzed="2026-10-17T00:00:00")
    add_link(con, "viralpackage.shop", "ua", "UA-26575989-44")
    add_link(con, "viralpackage.shop", "ip", "1.2.3.4")
    radar_cli.cleanup_links(con)
    assert con.execute("SELECT alive FROM domains").fetchone()[0] == 0
    kinds = {r[0] for r in con.execute("SELECT kind FROM links")}
    assert kinds == {"ip"}


def test_more_dead_pages_infra_mainstream_and_catalog_at_ranking(con):
    rows = {
        "lojafechada.com": dict(title="Loja", final_url="https://lojafechada.com/closed-store"),
        "bloqueado.app": dict(title="Website Takedown Notice - Lovable Trust & Safety"),
        "estacionado.shop": dict(title="Welcome", ip="2.57.91.91"),
        "catalogo.com.br": dict(title="Loja X", text_sample="Todos os produtos | Rastrear pedido | Minha conta"),
        "vsl.com.br": dict(title="Assista ao vídeo", text_sample="o método que mudou minha vida"),
    }
    for d, kw in rows.items():
        add_domain(con, d, "urlscan")
        update(con, d, alive=1, last_analyzed="2026-10-17T00:00:00", checkouts='["hotmart"]', **kw)
    add_domain(con, "ds-review-1.dev.ds25.io", "t")  # infra: nem entra
    radar_cli.cleanup_links(con)
    r = {x["domain"]: x for x in con.execute("SELECT * FROM domains")}
    assert [d for d in r if r[d]["alive"] == 0] == ["lojafechada.com", "bloqueado.app", "estacionado.shop"]
    assert r["catalogo.com.br"]["store"] == 1 and not analyze.is_offer(r["catalogo.com.br"])
    assert analyze.is_offer(r["vsl.com.br"]) and "ds-review-1.dev.ds25.io" not in r


def test_mainstream_by_apex_tranco_is_not_an_offer(con):
    add_domain(con, "form.typeform.com", "urlscan")
    update(con, "form.typeform.com", players='["vidalytics"]', tranco_apex=1070)
    add_domain(con, "oferta-grande.com", "urlscan")
    update(con, "oferta-grande.com", players='["vturb"]', tranco_rank=180_000)
    r = {x["domain"]: x for x in con.execute("SELECT * FROM domains")}
    assert not analyze.is_offer(r["form.typeform.com"])
    assert analyze.is_offer(r["oferta-grande.com"])  # oferta grande no top 1M continua
