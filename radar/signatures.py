"""Assinaturas que identificam VSLs, checkouts e IDs de rastreamento no HTML.

Tudo aqui é editável: se surgir um player ou checkout novo, adicione o domínio.
"""
import re

# Players de vídeo usados em VSL. Chave = nome; valor = regex no HTML.
PLAYERS = {
    "vturb": r"converteai\.net|vturb\.com",
    "panda": r"pandavideo\.com",
    "vidalytics": r"vidalytics\.com",
    "wistia": r"wistia\.(?:com|net)",
    "vimeo": r"player\.vimeo\.com",
    "jwplayer": r"jwpcdn\.com|jwplayer\.com",
    "youtube": r"youtube\.com/embed|youtube-nocookie\.com",
}
# Players que quase só aparecem em VSL de resposta direta (peso maior no score).
STRONG_PLAYERS = {"vturb", "panda", "vidalytics"}

# Checkouts: domínio-base -> nome da plataforma.
CHECKOUT_HOSTS = {
    "pay.hotmart.com": "hotmart",
    "go.hotmart.com": "hotmart",
    "kiwify.com.br": "kiwify",
    "kiwify.app": "kiwify",
    "braip.com": "braip",
    "monetizze.com.br": "monetizze",
    "eduzz.com": "eduzz",
    "perfectpay.com.br": "perfectpay",
    "ticto.com.br": "ticto",
    "ticto.app": "ticto",
    "lastlink.com": "lastlink",
    "cartpanda.com": "cartpanda",
    "mycartpanda.com": "cartpanda",
    "yampi.com.br": "yampi",
    "greenn.com.br": "greenn",
    "kirvano.com": "kirvano",
    "payt.com.br": "payt",
    "clickbank.net": "clickbank",
    "digistore24.com": "digistore24",
    "buygoods.com": "buygoods",
}
_SKIP_SEGMENTS = {"", "pt-br", "pt", "en", "es", "login", "static", "assets", "img",
                  "images", "js", "css", "favicon.ico", "privacy", "terms", "signup",
                  "secure", "track", "tracking", "affiliates", "affiliate", "checkout", "order",
                  "pay", "cart", "buy", "go", "redir", "api", "v1", "v2", "widget", "embed",
                  "scripts", "cdn", "cartx-ecomm-ui-asset", "public", "app", "conversion"}


def valid_product_segment(seg: str) -> bool:
    """Um trecho de URL que identifica produto (não arquivo, não pasta genérica)."""
    return (bool(seg) and len(seg) >= 4 and "." not in seg and "asset" not in seg.lower()
            and seg.lower() not in _SKIP_SEGMENTS)

# IDs de rastreamento: o que liga domínios da mesma operação.
TRACKING = {
    "gtm": r"\b(GTM-[A-Z0-9]{4,9})\b",
    "ga4": r"['\"](G-[A-Z0-9]{8,12})['\"]",
    "ua": r"\b(UA-\d{4,10}-\d{1,4})\b",
    "fbpixel": r"fbq\(\s*['\"]init['\"]\s*,\s*['\"](\d{12,20})",
    "ttpixel": r"ttq\.load\(\s*['\"]([A-Z0-9]{15,25})",
    "utmify": r"pixelId\s*[=:]\s*['\"]([A-Za-z0-9]{16,32})",
}

# Palavras típicas de VSL/advertorial (sinal fraco, só reforça).
VSL_TEXT = re.compile(
    r"assista|até o final|vídeo abaixo|video below|watch (?:this|the) video|"
    r"sair do ar|oferta especial|garantia de \d+ dias|money.?back|depoimentos",
    re.I,
)

# Domínios de infraestrutura: nunca são "a oferta".
INFRA = {
    "facebook.com", "fbcdn.net", "instagram.com", "fb.com", "whatsapp.com", "wa.me",
    "google.com", "googleapis.com", "gstatic.com", "googletagmanager.com",
    "google-analytics.com", "doubleclick.net", "youtube.com", "youtu.be",
    "youtube-nocookie.com", "vimeo.com", "cloudflare.com", "jsdelivr.net",
    "unpkg.com", "cdnjs.cloudflare.com", "tiktok.com", "twitter.com", "x.com",
    "converteai.net", "vturb.com", "vturb.com.br", "pandavideo.com", "pandavideo.com.br",
    "vidalytics.com", "wistia.com", "wistia.net", "jwpcdn.com", "utmify.com.br",
    "hotmart.com", "kiwify.com.br", "kiwify.app", "braip.com", "monetizze.com.br",
    "eduzz.com", "perfectpay.com.br", "ticto.com.br", "ticto.app", "lastlink.com",
    "cartpanda.com", "mycartpanda.com", "yampi.com.br", "greenn.com.br", "kirvano.com",
    "payt.com.br", "clickbank.net", "digistore24.com", "buygoods.com",
    "bit.ly", "linktr.ee", "urlscan.io", "crt.sh", "wordpress.com", "wixsite.com",
}

_URL_RE = re.compile(r"https?://[^\s\"'<>()\\]+", re.I)
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
_LANG_RE = re.compile(r"<html[^>]*\blang=['\"]?([A-Za-z-]+)", re.I)
_TAGS_RE = re.compile(r"<(script|style|noscript)[^>]*>.*?</\1>|<[^>]+>", re.I | re.S)


def is_infra(domain: str) -> bool:
    d = domain.lower()
    return any(d == i or d.endswith("." + i) for i in INFRA)


def _checkout_of(url: str):
    """(plataforma, chave do produto ou do produtor) de um link de checkout."""
    from urllib.parse import parse_qs, urlparse
    try:
        u = urlparse(url)
    except ValueError:
        return None
    host = (u.hostname or "").lower()
    for base, plat in CHECKOUT_HOSTS.items():
        if not (host == base or host.endswith("." + base)):
            continue
        q = parse_qs(u.query)

        def first(*keys):
            for k in keys:
                if q.get(k) and q[k][0].strip():
                    return q[k][0].strip()
            return None

        product = None
        if plat == "buygoods":  # buygoods.com/secure/checkout.html?account_id=12994&product_codename=...
            acc = first("account_id", "a")
            product = f"buygoods:{acc}" if acc and acc.isdigit() else None
        elif plat == "clickbank":  # VENDOR.pay.clickbank.net / VENDOR.hop.clickbank.net
            labels = host.split(".")
            if len(labels) >= 4 and labels[-3] in ("hop", "pay"):
                product = f"clickbank:{labels[0]}"
            elif first("vendor"):
                product = f"clickbank:{first('vendor')}"
        elif plat == "digistore24":  # digistore24.com/product/12345 ou /redir/12345/...
            nums = [s for s in u.path.split("/") if s.isdigit()]
            product = f"digistore24:{nums[0]}" if nums else None
        if not product:
            for seg in [s for s in u.path.split("/") if s][:2]:
                if valid_product_segment(seg):
                    product = f"{plat}:{re.sub(r':\d+$', '', seg)}"  # tira sufixo de variante
                    break
        return plat, product
    return None


def valid_product_key(key: str) -> bool:
    """Filtra chaves antigas geradas antes das regras atuais (ex.: 'buygoods:secure')."""
    plat, _, seg = key.partition(":")
    if plat in ("buygoods", "digistore24"):
        return seg.isdigit()
    if plat == "clickbank":
        return bool(seg) and seg.lower() not in _SKIP_SEGMENTS and "." not in seg
    return valid_product_segment(seg)


def extract(html: str) -> dict:
    """Extrai sinais de uma página HTML."""
    html = html or ""
    players = sorted(n for n, rx in PLAYERS.items() if re.search(rx, html, re.I))
    checkouts, products, checkout_urls = set(), set(), []
    for m in _URL_RE.finditer(html):
        url = m.group(0).rstrip(".,;")
        c = _checkout_of(url)
        if c:
            checkouts.add(c[0])
            if c[1]:
                products.add(c[1])
            if len(checkout_urls) < 5 and url not in checkout_urls:
                checkout_urls.append(url)
    tracking = {}
    for kind, rx in TRACKING.items():
        vals = sorted(set(re.findall(rx, html)))
        if vals:
            tracking[kind] = vals[:10]
    t = _TITLE_RE.search(html)
    title = re.sub(r"\s+", " ", t.group(1)).strip()[:200] if t else ""
    lang = (_LANG_RE.search(html) or [None, ""])[1]
    text = re.sub(r"\s+", " ", _TAGS_RE.sub(" ", html)).strip()
    return {
        "players": players,
        "checkouts": sorted(checkouts),
        "products": sorted(products),
        "checkout_urls": checkout_urls,
        "tracking": tracking,
        "title": title,
        "lang": lang,
        "text": text[:1500],
        "vsl_text": bool(VSL_TEXT.search(text)),
    }
