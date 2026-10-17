"""Fontes de anúncios opcionais (rede simulada): nada roda nem gasta sem a chave."""
from radar import graph, score, sources
from radar.db import add_domain, add_link, update

from conftest import Resp

SERP = {"search_information": {"total_results": 37},
        "ad_creatives": [
            {"advertiser_id": "AR123", "advertiser": "Pure Health LLC", "format": "video",
             "total_days_shown": 140, "first_shown": 1700000000, "last_shown": 1712000000},
            {"advertiser_id": "AR123", "advertiser": "Pure Health LLC", "format": "text",
             "total_days_shown": 12}]}


class FakeSerp:
    def __init__(self, status=200):
        self.status, self.calls = status, []

    def get(self, url, params=None, **kw):
        self.calls.append(params)
        return Resp(self.status, SERP if self.status == 200 else {"error": "x"})


def _offer(con, d, google=True, s=50):
    add_domain(con, d, "t")
    update(con, d, checkouts='["buygoods"]', alive=1, score=s)
    if google:
        add_link(con, d, "adnet", "google")


def test_google_ads_off_without_key(con, monkeypatch):
    f = FakeSerp()
    monkeypatch.setattr(sources.net, "get", f.get)
    _offer(con, "lungreset.com")
    assert sources.google_ads_fetch(con, {}) == 0 and f.calls == []


def test_google_ads_fill_ad_signals_and_advertiser(con, monkeypatch):
    f = FakeSerp()
    monkeypatch.setattr(sources.net, "get", f.get)
    _offer(con, "cb.lungreset.com")
    _offer(con, "semgoogle.com", google=False)
    assert sources.google_ads_fetch(con, {"serpapi_key": "k", "serpapi_max": 5}) == 1
    assert f.calls[0]["text"] == "lungreset.com" and f.calls[0]["engine"] == "google_ads_transparency_center"
    r = con.execute("SELECT * FROM domains WHERE domain='cb.lungreset.com'").fetchone()
    assert (r["ad_count"], r["ad_video"], r["ad_max_days"]) == (37, 1, 140)
    # Consultado há pouco: a próxima rodada não gasta crédito com ele de novo.
    assert sources.google_ads_fetch(con, {"serpapi_key": "k"}) == 0 and len(f.calls) == 1
    graph.run(con, {})
    score.run(con, {})
    o = {x["dominio_principal"]: x for x in score.offers(con)}["cb.lungreset.com"]
    assert o["anunciante_google"] == "Pure Health LLC"
    assert o["anuncios_google"] == "https://adstransparency.google.com/advertiser/AR123?region=anywhere"


def test_google_ads_stops_when_credits_end(con, monkeypatch):
    f = FakeSerp(status=429)
    monkeypatch.setattr(sources.net, "get", f.get)
    for i in range(3):
        _offer(con, f"o{i}.com", s=50 + i)
    sources.google_ads_fetch(con, {"serpapi_key": "k"})
    assert len(f.calls) == 1
    assert con.execute("SELECT COUNT(*) FROM domains WHERE gads_checked IS NOT NULL").fetchone()[0] == 0


def test_offers_without_ad_data_are_not_penalized(con):
    """Antes, um único domínio com anúncio puxava a Tração de todos os outros para baixo."""
    for d in ("a.com", "b.com"):
        add_domain(con, d, "t")
        update(con, d, checkouts='["hotmart"]', alive=1, domain_created="2025-01-01")
    graph.run(con, {})
    score.run(con, {})
    before = con.execute("SELECT tracao FROM domains WHERE domain='b.com'").fetchone()[0]
    update(con, "a.com", ad_count=30, ad_max_days=120)  # só a.com foi consultado
    score.run(con, {})
    t = {r[0]: r[1] for r in con.execute("SELECT domain, tracao FROM domains")}
    assert t["b.com"] == before and t["a.com"] > before
