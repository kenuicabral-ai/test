import datetime as dt

import pytest

from radar import expand, sources
from radar.db import add_domain, add_link, update

from conftest import FakeUrlscan, scan


def ago(days):
    return sources._utc(dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days))


@pytest.fixture
def fake(monkeypatch):
    def make(scans, **kw):
        f = FakeUrlscan(scans, **kw)
        monkeypatch.setattr(sources.net, "get", f.get)
        return f
    return make


CFG = {"urlscan_interval": 0, "urlscan_queries": ["domain:converteai.net"],
       "urlscan_max_per_query": 1000, "urlscan_first_days": 3, "urlscan_backfill_days": 180,
       "urlscan_discovery_share": 0.5}


def test_search_pages_by_date_until_complete(fake):
    f = fake([scan(f"d{i}.com", ago(i), ["x.com"]) for i in range(5)], page_max=2)
    res, total, complete = sources.urlscan_search("domain:x.com", dict(CFG), 1000)
    assert [r["page"]["domain"] for r in res] == ["d0.com", "d1.com", "d2.com", "d3.com", "d4.com"]
    assert (total, complete) == (5, True)
    assert len(f.calls) == 3 and sources.QUOTA["used"] == 3


def test_search_stops_at_quota(fake):
    fake([scan(f"d{i}.com", ago(i), ["x.com"]) for i in range(5)], page_max=2, quota=2)
    res, total, complete = sources.urlscan_search("domain:x.com", dict(CFG), 1000)
    assert len(res) == 4 and not complete
    assert not sources.urlscan_available()


def test_discovery_is_incremental(con, fake):
    f = fake([scan("nova.com", ago(1), ["converteai.net"], age=5),
              scan("ontem.com", ago(2), ["converteai.net"]),
              scan("antiga.com", ago(10), ["converteai.net"]),
              scan("velha.com", ago(50), ["converteai.net"]),
              scan("fora.com", ago(200), ["converteai.net"])])
    assert sources.discover_urlscan(con, dict(CFG)) == 4  # o que passa de 180 dias fica de fora
    assert len(f.calls) == 2  # últimos 3 dias + histórico
    st = con.execute("SELECT newest, oldest FROM discovery").fetchone()
    assert st["oldest"][:10] == ago(180)[:10]
    # A página carregou o VTurb: fica a testemunha, e a idade do domínio vem junto.
    assert con.execute("SELECT value FROM links WHERE domain='nova.com' AND kind='seen'").fetchone()[0] \
        == "player:vturb"
    created = con.execute("SELECT domain_created FROM domains WHERE domain='nova.com'").fetchone()[0]
    assert created == (dt.date.fromisoformat(ago(1)[:10]) - dt.timedelta(days=5)).isoformat()

    f.scans.insert(0, scan("hoje.com", ago(0.01), ["converteai.net"]))
    f.calls.clear()
    assert sources.discover_urlscan(con, dict(CFG)) == 1
    assert len(f.calls) == 1  # dia seguinte: uma busca só, sem reler o histórico


def test_backfill_respects_discovery_share(con, fake):
    scans = [scan(f"d{i}.com", ago(4 + i), ["converteai.net"]) for i in range(20)]
    f = fake(scans, page_max=2, quota=10)
    cfg = {**CFG, "urlscan_max_per_query": 2}
    sources.discover_urlscan(con, cfg)
    # 1 busca de novidades; o histórico usa no máximo metade das 9 restantes.
    assert len(f.calls) == 1 + 4
    oldest = con.execute("SELECT oldest FROM discovery").fetchone()[0]
    assert oldest > ago(180)  # parou no meio e continua de onde está na próxima rodada


def test_stats_batch_splits_until_exact(con, fake):
    doms = ["a.com", "b.com", "c.com", "d.com", "e.com"]
    for d in doms + ["f.com"]:
        add_domain(con, d, "t")
    scans = [scan("a.com", ago(1)), scan("a.com", ago(2)), scan("a.com", ago(40)),
             scan("sub.c.com", ago(3), age=100), scan("c.com", ago(4)),
             scan("d.com", ago(5)),
             *[scan("e.com", ago(6 + i)) for i in range(4)],
             *[scan("f.com", ago(1 + i)) for i in range(6)]]
    fake(scans, page_max=4)
    assert sources.urlscan_stats(con, doms, dict(CFG)) == set(doms)
    got = {r["domain"]: (r["urlscan_total"], r["urlscan_30d"])
           for r in con.execute("SELECT * FROM domains WHERE urlscan_total IS NOT NULL")}
    assert got == {"a.com": (3, 2), "b.com": (0, 0), "c.com": (2, 2), "d.com": (1, 1), "e.com": (4, 4)}
    assert con.execute("SELECT domain_created FROM domains WHERE domain='c.com'").fetchone()[0]
    # Um domínio sozinho com mais varreduras do que cabem: o total vem exato do urlscan.
    sources.urlscan_stats(con, ["f.com"], dict(CFG))
    assert con.execute("SELECT urlscan_total FROM domains WHERE domain='f.com'").fetchone()[0] == 6


def test_stats_without_quota_changes_nothing(con, fake):
    add_domain(con, "a.com", "t")
    fake([scan("a.com", ago(1))], quota=0)
    assert sources.urlscan_stats(con, ["a.com"], dict(CFG)) == set()
    assert con.execute("SELECT urlscan_total FROM domains").fetchone()[0] is None


def test_ip_expansion_in_batches_skips_shared_hosting(con, fake):
    for d, ip in (("oferta.com", "5.5.5.5"), ("outra.com", "6.6.6.6"), ("cdn.com", "104.16.0.1")):
        add_domain(con, d, "t")
        update(con, d, checkouts='["hotmart"]')
        add_link(con, d, "ip", ip)
    f = fake([scan("irma.com", ago(1), ip="5.5.5.5"), scan("oferta.com", ago(1), ip="5.5.5.5"),
              *[scan(f"site{i}.com", ago(1), ip="6.6.6.6") for i in range(30)]], page_max=1000)
    assert expand.run(con, {**CFG, "ip_max_domains_urlscan": 15}) == 1
    assert len(f.calls) == 1  # os dois IPs numa busca só; o da Cloudflare nem é consultado
    assert con.execute("SELECT sources FROM domains WHERE domain='irma.com'").fetchone()[0] == "grafo:ip"
    assert con.execute("SELECT COUNT(*) FROM domains WHERE domain LIKE 'site%'").fetchone()[0] == 0
    marked = {r["value"]: r["found"] for r in con.execute("SELECT * FROM expanded")}
    assert marked == {"5.5.5.5": 2, "6.6.6.6": 0, "104.16.0.1": 0}
