"""Testemunha do urlscan: lê a página real das ofertas com cloaking (rede simulada)."""
from radar import analyze, graph, score, sources, witness
from radar.db import add_domain, add_link, update
from radar.signatures import extract

from conftest import Resp

# Formato do resultado de uma varredura (GET /api/v1/result/<uuid>/), só os campos usados.
REAL_PAGE = {
    "page": {"title": "SlimTide - The 7-second ritual"},
    "lists": {"urls": [
        "https://myslimtide.com/",
        "https://scripts.converteai.net/abc/players/0f8fad5b-d9cb-469f-a165-70867728950e/player.js",
        "https://www.facebook.com/tr?id=1122334455667788&ev=PageView",
        "https://www.googletagmanager.com/gtm.js?id=GTM-K9X7Q2",
    ]},
    "data": {
        "requests": [{"request": {"request": {"url": "https://redtrack.io/track.js"}}}],
        "links": [{"href": "https://slimtide.mycartpanda.com/checkout/198632137:1?afid=x", "text": "Buy"},
                  {"href": "https://www.facebook.com/slimtideofficial", "text": "Facebook"}],
    },
}
BAIT = "<title>Healthy recipes blog</title><p>Welcome to our blog</p>"


class FakeResults:
    def __init__(self, results, retrieve=100):
        self.results, self.retrieve, self.calls = results, retrieve, []

    def get(self, url, headers=None, params=None, **kw):
        if url.endswith("/user/quotas/"):
            lim = {"day": {"remaining": 1000, "limit": 1000}, "hour": {"remaining": 1000, "limit": 1000}}
            ret = {"day": {"remaining": self.retrieve, "limit": 1000}, "hour": {"remaining": self.retrieve, "limit": 1000}}
            return Resp(200, {"limits": {"search": lim, "retrieve": ret}})
        self.calls.append(url)
        uuid = url.rstrip("/").rsplit("/", 1)[1]
        if uuid not in self.results:
            return Resp(404, {"message": "not found"})
        return Resp(200, self.results[uuid])


def _bait_offer(con, domain, uuid):
    """Oferta que nos mostrou a isca, mas que o urlscan viu carregando o VTurb."""
    add_domain(con, domain, "urlscan")
    analyze.save(con, {"domain": domain, "status": 200, "final_url": f"https://{domain}/",
                       "final_domain": domain, "sig": extract(BAIT), "cloaked": False, "ip": None})
    add_link(con, domain, "seen", "player:vturb")
    update(con, domain, scan_uuid=uuid, scan_time="2026-10-16T10:00:00.000Z", seen_title="SlimTide")


def test_reads_real_page_of_cloaked_offer(con, monkeypatch):
    f = FakeResults({"u1": REAL_PAGE})
    monkeypatch.setattr(sources.net, "get", f.get)
    _bait_offer(con, "myslimtide.com", "u1")
    assert witness.run(con, {"urlscan_api_key": "k", "urlscan_retrieve_interval": 0}) == 1
    links = {(r["kind"], r["value"]) for r in con.execute("SELECT kind, value FROM links WHERE domain='myslimtide.com'")}
    assert {("fbpixel", "1122334455667788"), ("gtm", "GTM-K9X7Q2"), ("product", "cartpanda:198632137"),
            ("seen", "checkout:cartpanda"), ("tracker", "redtrack"), ("social", "fb:slimtideofficial"),
            ("video", "0f8fad5b-d9cb-469f-a165-70867728950e")} <= links
    # Lida uma vez por varredura: a próxima rodada não gasta cota de novo.
    assert witness.run(con, {"urlscan_api_key": "k", "urlscan_retrieve_interval": 0}) == 0


def test_witness_links_survive_reanalysis_and_rank(con, monkeypatch):
    monkeypatch.setattr(sources.net, "get", FakeResults({"u1": REAL_PAGE}).get)
    _bait_offer(con, "myslimtide.com", "u1")
    witness.run(con, {"urlscan_api_key": "k", "urlscan_retrieve_interval": 0})
    # Dia seguinte: a nossa visita cai na isca de novo e apaga os IDs que ela não vê.
    analyze.save(con, {"domain": "myslimtide.com", "status": 200, "final_url": "https://myslimtide.com/",
                       "final_domain": "myslimtide.com", "sig": extract(BAIT), "cloaked": False, "ip": None})
    assert con.execute("SELECT COUNT(*) FROM links WHERE domain='myslimtide.com' AND kind='fbpixel'").fetchone()[0] == 1
    graph.run(con, {})
    score.run(con, {})
    r = con.execute("SELECT score_parts, cloaked FROM domains WHERE domain='myslimtide.com'").fetchone()
    assert r["cloaked"] == 1 and '"checkout"' in r["score_parts"] and '"tracker_pro"' in r["score_parts"]
    o = score.offers(con)[0]
    assert o["oferta"] == "cartpanda:198632137" and o["visto_pelo_urlscan"] == "sim"
    assert o["titulo"] == "SlimTide" and o["anunciante"] == "fb/slimtideofficial"


def test_without_key_or_quota_nothing_is_spent(con, monkeypatch):
    f = FakeResults({"u1": REAL_PAGE}, retrieve=0)
    monkeypatch.setattr(sources.net, "get", f.get)
    _bait_offer(con, "myslimtide.com", "u1")
    assert witness.run(con, {}) == 0 and f.calls == []  # sem chave: nem tenta
    assert witness.run(con, {"urlscan_api_key": "k", "urlscan_retrieve_interval": 0}) == 0
    assert f.calls == []  # cota de leitura zerada
    assert con.execute("SELECT witness_scan FROM domains").fetchone()[0] is None  # tenta amanhã


def test_deleted_scan_is_not_retried(con, monkeypatch):
    f = FakeResults({})
    monkeypatch.setattr(sources.net, "get", f.get)
    _bait_offer(con, "sumiu.com", "u-apagada")
    witness.run(con, {"urlscan_api_key": "k", "urlscan_retrieve_interval": 0})
    witness.run(con, {"urlscan_api_key": "k", "urlscan_retrieve_interval": 0})
    assert len(f.calls) == 1


def test_offers_we_read_directly_are_not_fetched(con, monkeypatch):
    f = FakeResults({"u1": REAL_PAGE})
    monkeypatch.setattr(sources.net, "get", f.get)
    add_domain(con, "aberta.com", "urlscan")
    update(con, "aberta.com", players='["vturb"]', checkouts='["hotmart"]', cloaked=0, scan_uuid="u1")
    witness.run(con, {"urlscan_api_key": "k", "urlscan_retrieve_interval": 0})
    assert f.calls == []
