"""Escala da oferta e filtros de ruído (dados no formato do banco de produção)."""
import datetime as dt

from radar import analyze, graph, score
from radar.db import add_domain, add_link, update


def _offer(con, d, created_days=400, scans30=0, scans=0, checkout=True, player=True, **kw):
    add_domain(con, d, "urlscan")
    update(con, d, alive=1, last_analyzed="2026-10-17T00:00:00", title=kw.pop("title", "Oferta"),
           checkouts='["hotmart"]' if checkout else "[]", players='["vturb"]' if player else "[]",
           domain_created=(dt.date.today() - dt.timedelta(days=created_days)).isoformat(),
           urlscan_30d=scans30, urlscan_total=scans, **kw)


def _rank(con):
    graph.run(con, {})
    score.run(con, {})
    return score.offers(con)


def test_scaled_offer_beats_small_one(con):
    # Mesma cara de funil; uma tem 5 afiliados no mesmo produto, volume e 3 pixels no tempo.
    for i in range(5):
        _offer(con, f"afiliado{i}.com", scans30=8, scans=30)
        add_link(con, f"afiliado{i}.com", "product", "cartpanda:211836256")
        add_link(con, f"afiliado{i}.com", "fbpixel", f"11112222333344{i % 3}")
    _offer(con, "pequena.com", created_days=10, scans30=1, scans=1)
    add_link(con, "pequena.com", "product", "hotmart:X1")
    offs = _rank(con)
    assert [o["oferta"] for o in offs] == ["cartpanda:211836256", "hotmart:X1"]
    big = offs[0]
    assert big["escala"] > 50 and big["porte"] == "grande" and big["dominios"] == 5
    assert '"rotacao_pixel"' in big["escala_detalhe"] and '"dominios"' in big["escala_detalhe"]


def test_popular_site_without_funnel_does_not_ride_scale(con):
    """Site comum tem muitas varreduras; sem funil, a escala não o leva ao topo."""
    _offer(con, "funil.com", scans30=3, scans=10)
    _offer(con, "crm-popular.com", scans30=60, scans=900, checkout=False, player=False)
    add_link(con, "crm-popular.com", "seen", "player:vturb")  # testemunha antiga
    offs = _rank(con)
    assert offs[0]["dominio_principal"] == "funil.com"


def test_generic_tracker_witness_is_not_an_offer(con):
    _offer(con, "porkbun.com", checkout=False, player=False, title="porkbun.com | domains")
    add_link(con, "porkbun.com", "seen", "tracker:hyros")
    _offer(con, "produtor.com.br", checkout=False, player=False)
    add_link(con, "produtor.com.br", "seen", "tracker:utmify")  # só produtor de DR usa
    analyze.refresh_seen(con)
    rows = {r["domain"]: r for r in con.execute("SELECT * FROM domains")}
    assert not analyze.is_offer(rows["porkbun.com"])
    assert analyze.is_offer(rows["produtor.com.br"])


def test_members_area_is_not_an_offer(con):
    _offer(con, "courses.marca.academy", title="Sign in to view your content » Powered by ThriveCart")
    _offer(con, "membros.curso.com.br", title="Área de Membros - Curso X")
    _offer(con, "vsl.curso.com.br", title="Assista: o método que...")
    rows = {r["domain"]: r for r in con.execute("SELECT * FROM domains")}
    assert [d for d, r in rows.items() if analyze.is_offer(r)] == ["vsl.curso.com.br"]


def test_missing_signals_do_not_lower_scale(con):
    """Sem varreduras medidas e sem anúncios consultados, a escala não cai por isso."""
    _offer(con, "a.com", scans30=None, scans=None)
    _offer(con, "b.com", scans30=0, scans=0)
    e = {o["dominio_principal"]: o["escala"] for o in _rank(con)}
    assert e["a.com"] > e["b.com"]


def test_heatmap_adds_force_and_scale(con):
    from radar.signatures import extract
    base = '<script src="https://scripts.converteai.net/p.js"></script><a href="https://pay.hotmart.com/A1">c</a>'
    _save = lambda d, html: (add_domain(con, d, "t"),
                             analyze.save(con, {"domain": d, "status": 200, "final_url": f"https://{d}/",
                                                "final_domain": d, "sig": extract(html), "cloaked": False, "ip": None}))
    _save("comheat.com", base + '<script>(function(c,l,a,r,i,t,y){})(window,document,"clarity","script","x")</script>')
    _save("semheat.com", base)
    graph.run(con, {})
    score.run(con, {})
    o = {x["dominio_principal"]: x for x in score.offers(con)}
    assert o["comheat.com"]["forca"] > o["semheat.com"]["forca"]
    assert o["comheat.com"]["escala"] > o["semheat.com"]["escala"]
    assert o["comheat.com"]["heatmap"] == "clarity"
    assert '"heatmap"' in o["comheat.com"]["escala_detalhe"]


def test_hls_m3u8_counts_as_player(con):
    from radar.signatures import extract
    s = extract('<video><source src="https://cdn.vz.net/abc/master.m3u8"></video>')
    assert s["players"] == ["hls"]
    assert "hls" not in __import__("radar.signatures", fromlist=["STRONG_PLAYERS"]).STRONG_PLAYERS
