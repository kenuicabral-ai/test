"""Assinaturas que identificam VSLs, checkouts e IDs de rastreamento no HTML.

Tudo aqui é editável: se surgir um player ou checkout novo, adicione o domínio.
"""
import html as html_lib
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
    # Internacionais / profissionais
    "samcart.com": "samcart",
    "thrivecart.com": "thrivecart",
    "checkout.stripe.com": "stripe",
    "pay.hub.la": "hubla",
    "hub.la": "hubla",
}

# Trackers profissionais de mídia paga. Quem usa um destes está num nível acima do
# amador: roda campanhas com redirecionador e atribuição dedicados. Forte sinal de escala.
TRACKERS = {
    "redtrack": r"redtrack\.io|rtkclickid|\brtkcid\b",
    "hyros": r"\bhyros\b|t\.hyros\.com",
    "clickmagick": r"clickmagick\.com|cmclickid",
    "voluum": r"\bvoluum\b|voluumtrk",
    "funnelflux": r"funnelflux|flux_tok",
    "everflow": r"everflow|\befclick\b|ef_transaction_id",
    "cometly": r"\bcometly\b",
    "binom": r"\bbinom\b|cpa\.tw",
    "keitaro": r"keitaro|/click\.php\?cnv_id",
}

# Impressão digital do VÍDEO da VSL. É o vínculo mais durável: o operador troca
# domínio e pixel quando a Meta bane, mas reaproveita o mesmo vídeo vencedor, que
# mantém o mesmo ID no player. Liga a mesma oferta mesmo depois da rotação.
_UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
VIDEO_PATTERNS = [
    rf"vid[_-]({_UUID})",                               # VTurb <vturb-smartplayer id="vid_<uuid>">
    r"vid[_-]([0-9a-f]{24})",                            # VTurb (id estilo mongo)
    rf"converteai\.net/[0-9a-z-]+/(?:players/)?({_UUID})",  # VTurb/ConverteAI media/player
    rf"cdn\.converteai\.net/[0-9a-z-]+/({_UUID})",
    rf"pandavideo[^\"'\s]*?[?&]v=({_UUID})",             # Panda embed ?v=<uuid>
    rf"panda[_-]({_UUID})",
    r"vidalytics[._/](?:embed[_/]|embed_)([A-Za-z0-9]{8,24})",  # Vidalytics embed id
]


def video_ids(html: str) -> list:
    out = set()
    for rx in VIDEO_PATTERNS:
        for m in re.findall(rx, html, re.I):
            out.add(m.lower())
    return sorted(out)[:5]
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

# Redes de anúncio: o pixel/script na página revela ONDE a oferta compra tráfego.
# É o que diz em qual biblioteca de anúncios procurar os criativos.
AD_NETWORKS = {
    "meta": r"fbevents\.js|fbq\(\s*['\"](?:init|track)|facebook\.com/tr\b|connect\.facebook\.net",
    "google": r"googleadservices\.com|gtag\(\s*['\"]config['\"]\s*,\s*['\"]AW-|google_conversion|"
              r"\bAW-\d{9,12}\b|fls\.doubleclick\.net|googleads\.g\.doubleclick\.net",
    "tiktok": r"analytics\.tiktok\.com|ttq\.(?:load|track|page)\(",
    "taboola": r"trc\.taboola\.com|taboola\.com/libtrc|\b_tfa\b",
    "outbrain": r"outbrain\.com/outbrain\.js|\bobApi\(|amplify\.outbrain",
    "mgid": r"\bmgid\.com|jsc\.mgid\.com",
    "revcontent": r"revcontent\.com|trends\.revcontent",
    "bing": r"bat\.bing\.com|\buetq\b",
    "pinterest": r"pintrk\(|s\.pinimg\.com/ct",
    "kwai": r"s\d*\.kwai\.net|kwai(?:ad|pixel)",
}
# Onde procurar os criativos de cada rede (mostrado ao usuário).
ADNET_WHERE = {
    "meta": "Biblioteca de Anúncios da Meta (busque pelo nome do anunciante)",
    "google": "Google Ads Transparency Center (adstransparency.google.com) — busca por anunciante/domínio",
    "tiktok": "TikTok Commercial Content Library",
    "taboola": "rede nativa Taboola (spy tool de nativos)",
    "outbrain": "rede nativa Outbrain (spy tool de nativos)",
    "mgid": "rede nativa MGID (spy tool de nativos)",
    "revcontent": "rede nativa RevContent (spy tool de nativos)",
    "bing": "Microsoft/Bing Ads",
    "pinterest": "Pinterest Ads",
    "kwai": "Kwai for Business",
}


# O que cada busca de descoberta no urlscan PROVA sobre a página (o urlscan viu esse
# recurso carregar). Serve de testemunha quando a nossa própria leitura cai no cloaking.
SEED_SIGNAL = {
    "converteai.net": ("player", "vturb"), "vturb.com.br": ("player", "vturb"),
    "pandavideo.com.br": ("player", "panda"), "vidalytics.com": ("player", "vidalytics"),
    "utmify.com.br": ("tracker", "utmify"),
    "pay.hotmart.com": ("checkout", "hotmart"), "pay.kiwify.com.br": ("checkout", "kiwify"),
    "mycartpanda.com": ("checkout", "cartpanda"), "buygoods.com": ("checkout", "buygoods"),
    "pay.clickbank.net": ("checkout", "clickbank"), "ticto.app": ("checkout", "ticto"),
    "perfectpay.com.br": ("checkout", "perfectpay"), "samcart.com": ("checkout", "samcart"),
    "thrivecart.com": ("checkout", "thrivecart"), "digistore24.com": ("checkout", "digistore24"),
    "redtrack.io": ("tracker", "redtrack"), "t.hyros.com": ("tracker", "hyros"),
    "clickmagick.com": ("tracker", "clickmagick"),
    "taboola.com": ("adnet", "taboola"), "outbrain.com": ("adnet", "outbrain"),
    "mgid.com": ("adnet", "mgid"),
}


def ad_networks(html: str) -> list:
    return sorted(n for n, rx in AD_NETWORKS.items() if re.search(rx, html, re.I))


def trackers(html: str) -> list:
    return sorted(n for n, rx in TRACKERS.items() if re.search(rx, html, re.I))


# Anunciante: quem roda os anúncios. O pixel da Meta é o ID do pixel, NÃO da página,
# e não há como converter um no outro. Mas a própria página quase sempre linka o
# Facebook/Instagram/WhatsApp do anunciante, e por aí se chega a todos os anúncios dele.
_FB_SKIP = {"tr", "sharer", "sharer.php", "plugins", "dialog", "login", "ads", "events",
            "groups", "watch", "story.php", "policies", "help", "policy", "business",
            "l.php", "permalink.php", "photo.php", "home.php", "pages", "people", "gaming",
            "marketplace", "messages", "notifications", "privacy", "legal", "settings",
            "hashtag", "search", "games", "reel", "reels", "share", "profile.php",
            "v2.0", "v2.1", "v2.2", "v2.3", "v3.0", "v3.1", "v3.2", "v3.3", "v4.0",
            "v5.0", "v6.0", "v7.0", "v8.0", "v9.0", "v10.0", "v11.0", "v12.0",
            "v13.0", "v14.0", "v15.0", "v16.0", "v17.0", "v18.0", "v19.0", "public"}
_IG_SKIP = {"p", "reel", "reels", "explore", "accounts", "about", "developer", "legal",
            "directory", "tv", "stories", "privacy", "terms", "api"}
_FB_HANDLE = re.compile(r"(?:https?:)?//(?:www\.|m\.|web\.|pt-br\.)?(?:facebook|fb)\.com/"
                        r"([A-Za-z0-9.][A-Za-z0-9.\-]{2,59})(?=[\"'/?#]|\\|$)", re.I)
_FB_NUM = re.compile(r"(?:view_all_page_id=|profile\.php\?id=|/pages/[^/\"']+/|/people/[^/\"']+/"
                     r"|[\"']?page_id[\"']?\s*[:=]\s*[\"']?)(\d{9,20})", re.I)
_IG_HANDLE = re.compile(r"(?:https?:)?//(?:www\.)?instagram\.com/([A-Za-z0-9._]{2,40})(?=[\"'/?#]|\\|$)", re.I)
_WA = re.compile(r"(?:wa\.me/|(?:api|web)\.whatsapp\.com/send\?phone=|whatsapp\.com/send\?phone=)"
                 r"\+?(\d{10,15})", re.I)
_OG_SITE = re.compile(r"<meta[^>]+property=['\"]og:site_name['\"][^>]+content=['\"]([^'\"]{2,80})", re.I)
_CNPJ = re.compile(r"\b(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})\b")
_EMAIL = re.compile(r"\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b")
_EMAIL_SKIP = ("sentry", "example.", "wix", "godaddy", "cloudflare", "domain.com",
               "email.com", "seudominio", "your", "@2x", ".png", ".jpg", ".webp")


def advertiser(html: str) -> dict:
    """Quem roda a oferta: redes sociais, marca e identidade (CNPJ/e-mail) da página.

    O pixel não leva à página do anunciante, mas a própria página quase sempre expõe
    por onde chegar até ele — e, no Brasil, o CNPJ no rodapé identifica a empresa.
    """
    out = {}
    fb = [h for h in _FB_HANDLE.findall(html) if h.lower() not in _FB_SKIP and h[0] != "."]
    if fb:
        out["fb"] = max(set(fb), key=fb.count)
    nums = _FB_NUM.findall(html)
    if nums:
        out["fb_id"] = max(set(nums), key=nums.count)
    ig = [h for h in _IG_HANDLE.findall(html) if h.lower() not in _IG_SKIP]
    if ig:
        out["ig"] = max(set(ig), key=ig.count)
    wa = _WA.findall(html)
    if wa:
        out["wa"] = max(set(wa), key=wa.count)
    site = _OG_SITE.search(html)
    if site:
        out["brand"] = _unescape(site.group(1))[:80]
    cnpj = _CNPJ.findall(html)
    if cnpj:
        out["cnpj"] = cnpj[0]
    emails = [e for e in _EMAIL.findall(html)
              if not any(s in e.lower() for s in _EMAIL_SKIP) and len(e) < 60]
    if emails:
        out["email"] = max(set(emails), key=emails.count).lower()
    return out


def ad_library_url(fb=None, fb_id=None, brand=None, country="BR"):
    """Link que abre os anúncios do anunciante na Biblioteca da Meta.

    Com o ID numérico da página, abre TODOS os anúncios ativos dela (exaustivo).
    Sem o ID, cai para busca pelo @ do Facebook ou pela marca (aproximado).
    """
    base = "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&media_type=all"
    if fb_id:
        return f"{base}&country={country}&view_all_page_id={fb_id}"
    from urllib.parse import quote
    if fb:
        return f"{base}&country={country}&q={quote(fb)}&search_type=page"
    if brand:
        return f"{base}&country={country}&q={quote(brand)}&search_type=keyword_unordered"
    return ""


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
    "samcart.com", "thrivecart.com", "stripe.com", "hub.la",
    "redtrack.io", "hyros.com", "clickmagick.com", "voluum.com", "funnelflux.io",
    "everflow.io", "cometly.com", "taboola.com", "outbrain.com", "mgid.com",
    "clickfunnels.com", "systeme.io", "kajabi.com",
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


def _unescape(s: str) -> str:
    """Decodifica entidades HTML, inclusive as duplamente codificadas (&amp;#8211;)."""
    for _ in range(2):
        new = html_lib.unescape(s)
        if new == s:
            break
        s = new
    return s.strip()


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
    title = _unescape(re.sub(r"\s+", " ", t.group(1)))[:200] if t else ""
    lang = (_LANG_RE.search(html) or [None, ""])[1]
    text = _unescape(re.sub(r"\s+", " ", _TAGS_RE.sub(" ", html)))
    return {
        "players": players,
        "checkouts": sorted(checkouts),
        "products": sorted(products),
        "checkout_urls": checkout_urls,
        "tracking": tracking,
        "adnets": ad_networks(html),
        "trackers": trackers(html),
        "videos": video_ids(html),
        "advertiser": advertiser(html),
        "title": title,
        "lang": lang,
        "text": text[:1500],
        "vsl_text": bool(VSL_TEXT.search(text)),
    }
