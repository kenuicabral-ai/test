import datetime as dt
import json

from radar import analyze, graph, score
from radar.db import add_domain, add_link, update
from radar.signatures import _checkout_of, extract, seed_signal, valid_product_key


def test_checkout_keys():
    assert _checkout_of("https://astrongroup.mycartpanda.com/checkout/211836256:1?afid=x") \
        == ("cartpanda", "cartpanda:211836256")
    assert _checkout_of("https://payfast.greenn.com.br/redirect/293799") == ("greenn", "greenn:293799")
    assert _checkout_of("https://www.buygoods.com/secure/checkout.html?account_id=12994") \
        == ("buygoods", "buygoods:12994")
    # Carrinho de loja Shopify e upsell: agrupa pela loja do produtor, não por "shopify".
    assert _checkout_of("https://loja-x.mycartpanda.com/shopify/cart") == ("cartpanda", "cartpanda:loja-loja-x")
    assert _checkout_of("https://a3.mycartpanda.com/ex-ocu/next-offer/abc?accepted=yes")[1] == "cartpanda:loja-a3"
    # Arquivos da plataforma: a página usa o checkout, mas o arquivo não diz o produto.
    assert _checkout_of("https://assets.mycartpanda.com/js/libs/ocu-external.js") == ("cartpanda", None)
    assert _checkout_of("https://static.samcart.com/checkouts/sc-slide-script.js") == ("samcart", None)
    assert _checkout_of("https://cdn.samcart.com/marketplace-248657/assets/x.png") == ("samcart", None)
    assert _checkout_of("https://tinder.thrivecart.com/vprod-c404/embed/v1/courses.css") == ("thrivecart", None)
    assert _checkout_of("https://www.digistore24.com/info/contact/2?lang=en") == ("digistore24", None)
    assert _checkout_of("https://loja.samcart.com/products/curso-x") == ("samcart", "samcart:curso-x")
    # Não são checkout: cadastro da plataforma, link "feito com".
    assert _checkout_of("https://accounts.cartpanda.com/register?ref=closed-store") is None
    assert _checkout_of("https://cartpanda.com/") is None
    assert _checkout_of("https://www.eduzz.com/") is None


def test_old_generic_keys_are_cleaned():
    for k in ("cartpanda:shopify", "cartpanda:register", "cartpanda:ex-ocu", "greenn:redirect",
              "samcart:checkouts", "samcart:products", "samcart:tracker"):
        assert not valid_product_key(k)
    assert valid_product_key("hotmart:J95785385P")


def test_seed_signal():
    assert seed_signal("domain:converteai.net") == ("player", "vturb")
    assert seed_signal('filename:"tfa.js"') == ("adnet", "taboola")
    assert seed_signal("domain:desconhecido.com") is None


def test_dead_pages():
    assert extract("<title>Loja Fechada</title>")["dead"]
    assert extract('<a href="https://accounts.cartpanda.com/register?ref=closed-store">x</a>')["dead"]
    assert extract("<title>Domain is for sale</title>")["dead"]
    assert extract("<title>Your domain is expired</title>")["dead"]
    assert extract("<title>Parked Domain name on Hostinger DNS system</title>")["dead"]
    assert extract("<title>Este domínio expirou</title>")["dead"]
    assert extract("<title>Domínio expirado</title>")["dead"]
    assert not extract("<title>Protocolo Expira Gordura</title>")["dead"]
    assert not extract("<title>Assista até o final antes que saia do ar</title>")["dead"]


def _analyzed(con, domain, html, status=200):
    add_domain(con, domain, "t")
    analyze.save(con, {"domain": domain, "status": status, "final_url": f"https://{domain}/",
                       "final_domain": domain, "sig": extract(html), "cloaked": False, "ip": None})


def test_store_and_closed_store(con):
    store = "".join(f'<a href="https://loja.mycartpanda.com/checkout/{1000 + i}:1">p</a>' for i in range(30))
    _analyzed(con, "lojinha.com.br", "<title>Loja</title>" + store)
    _analyzed(con, "fechada.com.br", '<title>Loja Fechada</title>'
                                     '<a href="https://tecsat.mycartpanda.com">x</a>')
    vsl = '<script src="https://scripts.converteai.net/x/player.js"></script>'
    _analyzed(con, "oferta.com", "<title>VSL</title>" + vsl
              + '<a href="https://pay.hotmart.com/J95785385P">comprar</a>')
    rows = {r["domain"]: r for r in con.execute("SELECT * FROM domains")}
    assert rows["lojinha.com.br"]["store"] == 1 and not analyze.is_offer(rows["lojinha.com.br"])
    assert rows["fechada.com.br"]["alive"] == 0
    assert analyze.is_offer(rows["oferta.com"])


def test_age_comes_from_domain_registration(con):
    """Antes a idade caía na data da descoberta e quase tudo virava 'nova'."""
    today = dt.date.today()
    for d, created in (("antiga.com", today - dt.timedelta(days=400)), ("nova.com", today - dt.timedelta(days=5))):
        add_domain(con, d, "t")
        update(con, d, checkouts='["hotmart"]', alive=1, domain_created=created.isoformat())
    graph.run(con, {})
    score.run(con, {})
    stage = {r["domain"]: r["stage"] for r in con.execute("SELECT domain, stage FROM domains")}
    assert stage == {"antiga.com": "estabelecida", "nova.com": "nova"}


def test_unrelated_stores_are_not_one_offer(con):
    """O 1º lugar falso: 20 lojas sem relação juntas por 'cartpanda:shopify'."""
    for i in range(20):
        _analyzed(con, f"loja{i}.com.br", f'<title>Loja {i}</title>'
                  f'<script src="https://scripts.converteai.net/p.js"></script>'
                  f'<a href="https://loja{i}.mycartpanda.com/shopify/cart">carrinho</a>')
    graph.run(con, {})
    score.run(con, {})
    offs = score.offers(con)
    assert len(offs) == 20 and all(o["dominios"] == 1 for o in offs)
    assert json.loads(con.execute("SELECT checkouts FROM domains LIMIT 1").fetchone()[0]) == ["cartpanda"]


def test_same_product_affiliates_group(con):
    for d, afid in (("a.site", "x"), ("b.online", "y")):
        _analyzed(con, d, '<script src="https://scripts.converteai.net/p.js"></script>'
                  f'<a href="https://astrongroup.mycartpanda.com/checkout/211836256:1?afid={afid}">c</a>')
    graph.run(con, {})
    score.run(con, {})
    offs = score.offers(con)
    assert len(offs) == 1 and offs[0]["oferta"] == "cartpanda:211836256" and offs[0]["dominios"] == 2


def test_parked_pages_do_not_form_an_operation(con):
    """2º lugar falso da rodada #21: 28 páginas da Hostinger com o mesmo UA viraram 'operação'."""
    parked = '<title>Parked Domain name on Hostinger DNS system</title><script>ga("create","UA-26575989-44")</script>'
    for i in range(5):
        _analyzed(con, f"parado{i}.shop", parked)
        add_link(con, f"parado{i}.shop", "seen", "player:vturb")  # testemunha antiga, de quando vendia
    graph.run(con, {})
    score.run(con, {})
    rows = con.execute("SELECT alive, cluster_id FROM domains").fetchall()
    assert all(r["alive"] == 0 for r in rows)
    assert len({r["cluster_id"] for r in rows}) == 5
    assert con.execute("SELECT COUNT(*) FROM links WHERE kind='ua'").fetchone()[0] == 0
