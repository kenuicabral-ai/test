"""Agrupamento de ofertas e operações: casos reais da rodada #21."""
from radar import analyze, graph, score, sources
from radar.db import add_domain, add_link, update
from radar.signatures import _checkout_of, extract, valid_product_key


def test_placeholder_and_provider_ids_do_not_link():
    t = extract('''<script>gtag('config','G-XXXXXXXXXX'); GTM-XXXXXXX; ga("create","UA-52447-2");
                   fbq('init','111111111111111'); fbq('init','1272401681709351')</script>''')["tracking"]
    assert "gtm" not in t and "ga4" not in t and "ua" not in t
    assert t["fbpixel"] == ["1272401681709351"]


def test_vturb_player_id_and_account():
    html = '<script src="https://scripts.converteai.net/10a8aace-0f8a-44a8-a764-4b0ebbd85e70/players/68c1c9d92828c9fe4a9bde65/player.js"></script>'
    s = extract(html)
    assert s["videos"] == ["68c1c9d92828c9fe4a9bde65"]  # lungreset.com: antes não saía nada
    assert s["tracking"]["vturb_acct"] == ["10a8aace-0f8a-44a8-a764-4b0ebbd85e70"]


def test_more_cdn_paths_are_not_products():
    assert _checkout_of("https://tinder.thrivecart.com/vprod-c404076143/embed/v1/courses.css") == ("thrivecart", None)
    assert _checkout_of("https://spark.thrivecart.com/fit-in/600x0/x.png") == ("thrivecart", None)
    assert _checkout_of("https://pay.hotmart.com/SEU-LINK-AQUI") == ("hotmart", None)
    assert not valid_product_key("hotmart:SEU-LINK-AQUI")


def test_hosting_temporary_url_is_not_a_cert_sibling(con, monkeypatch):
    certs = [{"not_before": "2025-01-01", "serial_number": "05e4",
              "name_value": "puroresultado.com.br\npuroresultado.com.br.vinicius1766.0572087.meusitehostgator.com.br"},
             {"not_before": "2025-02-01", "serial_number": "07aa",
              "name_value": "oferta.com\noferta-irma.com"}]
    monkeypatch.setattr(sources, "crtsh", lambda d, cfg: certs)
    add_domain(con, "puroresultado.com.br", "t")
    sibs = sources.cert_history(con, "puroresultado.com.br", {})
    assert {s for s, _ in sibs} == {"oferta.com", "oferta-irma.com"}


def _save(con, domain, final, html="<title>x</title>"):
    add_domain(con, domain, "t")
    analyze.save(con, {"domain": domain, "status": 200, "final_url": f"https://{final}/",
                       "final_domain": final, "sig": extract(html), "cloaked": False, "ip": None})


def test_redirect_to_google_or_gov_does_not_link(con):
    for d in ("cloaker1.com", "cloaker2.com"):
        _save(con, d, "google.com")
    _save(con, "aposta.com", "brasilsembets.gov.br")
    _save(con, "presell.com", "vsl-real.com")
    vals = {r[0] for r in con.execute("SELECT DISTINCT value FROM links WHERE kind='redirect'")}
    assert vals == {"vsl-real.com"}
    assert not con.execute("SELECT 1 FROM domains WHERE domain='brasilsembets.gov.br'").fetchone()


def test_product_inherited_only_from_direct_neighbour(con):
    vsl = '<script src="https://scripts.converteai.net/p.js"></script>'
    for d, html in (("electroslim.com", vsl + '<a href="https://elecslim.pay.clickbank.net/">c</a>'),
                    ("arcticblast.com", vsl + "<title>Arctic Blast</title>"),
                    ("presell-electro.com", vsl)):
        _save(con, d, d, html)
    add_link(con, "electroslim.com", "gtm", "GTM-KMZ74FC")      # GTM do fornecedor: mesma operação
    add_link(con, "arcticblast.com", "gtm", "GTM-KMZ74FC")
    add_link(con, "electroslim.com", "fbpixel", "998877665544332")  # mesmo pixel: mesma oferta
    add_link(con, "presell-electro.com", "fbpixel", "998877665544332")
    graph.run(con, {})
    score.run(con, {})
    key = {o["dominio_principal"]: o["oferta"] for o in score.offers(con)}
    members = {o["oferta"]: o["lista_dominios"] for o in score.offers(con)}
    assert "arcticblast.com" not in members["clickbank:elecslim"]
    assert "presell-electro.com" in members["clickbank:elecslim"]
    assert key["arcticblast.com"].startswith("operacao:")
