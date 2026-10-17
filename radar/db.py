"""Banco SQLite: domínios, ligações entre eles e histórico diário."""
import datetime as dt
import json
import re
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS domains(
  domain TEXT PRIMARY KEY,
  first_discovered TEXT, sources TEXT DEFAULT '',
  last_analyzed TEXT, alive INTEGER, status_code INTEGER, final_url TEXT,
  title TEXT, lang TEXT, players TEXT, checkouts TEXT, checkout_urls TEXT,
  text_sample TEXT, vsl_text INTEGER, cloaked INTEGER, ip TEXT,
  page_type TEXT, niche TEXT, promise TEXT,
  cert_first TEXT, cert_last TEXT, cert_count INTEGER,
  urlscan_total INTEGER, urlscan_30d INTEGER, urlscan_first TEXT, urlscan_last TEXT,
  ad_count INTEGER, ad_video INTEGER, ad_max_days INTEGER, ad_pages INTEGER,
  tranco_rank INTEGER, cluster_id INTEGER, score REAL, score_parts TEXT, stage TEXT,
  last_enriched TEXT, classified INTEGER, forca REAL, tracao REAL, trend REAL,
  domain_created TEXT, store INTEGER, stats_checked TEXT,
  scan_uuid TEXT, scan_time TEXT, seen_title TEXT, witness_scan TEXT
);
CREATE TABLE IF NOT EXISTS links(
  domain TEXT, kind TEXT, value TEXT, PRIMARY KEY(domain, kind, value)
);
CREATE INDEX IF NOT EXISTS links_val ON links(kind, value);
CREATE TABLE IF NOT EXISTS snapshots(
  domain TEXT, day TEXT, alive INTEGER, score REAL, ad_count INTEGER,
  urlscan_30d INTEGER, PRIMARY KEY(domain, day)
);
CREATE TABLE IF NOT EXISTS expanded(
  kind TEXT, value TEXT, day TEXT, found INTEGER, PRIMARY KEY(kind, value)
);
CREATE TABLE IF NOT EXISTS signal_history(
  domain TEXT, kind TEXT, value TEXT, first_seen TEXT, last_seen TEXT,
  PRIMARY KEY(domain, kind, value)
);
CREATE INDEX IF NOT EXISTS hist_kind ON signal_history(kind);
CREATE TABLE IF NOT EXISTS discovery(
  query TEXT PRIMARY KEY, newest TEXT, oldest TEXT
);
CREATE TABLE IF NOT EXISTS witness_links(
  domain TEXT, kind TEXT, value TEXT, PRIMARY KEY(domain, kind, value)
);
"""

# Página com tantos produtos no checkout é loja virtual, não oferta de resposta direta.
STORE_MIN_PRODUCTS = 10

_HOST_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$")


def today():
    return dt.date.today().isoformat()


def now():
    return dt.datetime.now().isoformat(timespec="seconds")


def norm_domain(value: str):
    """'https://www.Loja.com/x' -> 'loja.com'. Retorna None se não for domínio."""
    if not value:
        return None
    v = value.strip().lower()
    v = re.sub(r"^[a-z]+://", "", v).split("/")[0].split("?")[0].split(":")[0]
    v = v.lstrip("*.").rstrip(".")
    if v.startswith("www."):
        v = v[4:]
    return v if _HOST_RE.match(v) else None


def registrable(host):
    """'cb.oferta.com' -> 'oferta.com'; 'x.loja.com.br' -> 'loja.com.br'."""
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in {"com", "net", "org", "gov", "edu", "co"} and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def connect(path):
    con = sqlite3.connect(path, timeout=60)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    # Migração: acrescenta colunas novas a bancos criados por versões anteriores.
    have = {r["name"] for r in con.execute("PRAGMA table_info(domains)")}
    for col, decl in (("forca", "REAL"), ("tracao", "REAL"), ("trend", "REAL"),
                      ("domain_created", "TEXT"), ("store", "INTEGER"), ("stats_checked", "TEXT"),
                      ("scan_uuid", "TEXT"), ("scan_time", "TEXT"), ("seen_title", "TEXT"),
                      ("witness_scan", "TEXT")):
        if col not in have:
            con.execute(f"ALTER TABLE domains ADD COLUMN {col} {decl}")
    if "store" not in have:  # marca as lojas já analisadas, sem esperar a próxima análise
        con.execute(f"""UPDATE domains SET store=1 WHERE domain IN (
                       SELECT domain FROM links WHERE kind='product' GROUP BY domain
                       HAVING COUNT(*) >= {STORE_MIN_PRODUCTS})""")
    con.commit()
    return con


def add_domain(con, domain, source):
    """Insere (ou só acrescenta a fonte). Retorna True se o domínio é novo."""
    from .signatures import is_infra
    d = norm_domain(domain)
    if not d or is_infra(d):
        return False
    row = con.execute("SELECT sources FROM domains WHERE domain=?", (d,)).fetchone()
    if row is None:
        con.execute("INSERT INTO domains(domain, first_discovered, sources) VALUES(?,?,?)",
                    (d, now(), source))
        return True
    srcs = set(filter(None, (row["sources"] or "").split(",")))
    if source not in srcs:
        srcs.add(source)
        con.execute("UPDATE domains SET sources=? WHERE domain=?", (",".join(sorted(srcs)), d))
    return False


def update(con, domain, **fields):
    if not fields:
        return
    for k, v in list(fields.items()):
        if isinstance(v, (list, dict)):
            fields[k] = json.dumps(v, ensure_ascii=False)
    cols = ", ".join(f"{k}=?" for k in fields)
    con.execute(f"UPDATE domains SET {cols} WHERE domain=?", (*fields.values(), domain))


def add_link(con, domain, kind, value):
    if value:
        con.execute("INSERT OR IGNORE INTO links(domain, kind, value) VALUES(?,?,?)",
                    (domain, kind, str(value)))


def jl(value):
    """Lê uma coluna JSON (lista) com segurança."""
    try:
        return json.loads(value) if value else []
    except (TypeError, ValueError):
        return []
