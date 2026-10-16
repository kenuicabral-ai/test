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
  last_enriched TEXT, classified INTEGER, forca REAL, tracao REAL
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
"""

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


def connect(path):
    con = sqlite3.connect(path, timeout=60)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    # Migração: acrescenta colunas novas a bancos criados por versões anteriores.
    have = {r["name"] for r in con.execute("PRAGMA table_info(domains)")}
    for col, decl in (("forca", "REAL"), ("tracao", "REAL")):
        if col not in have:
            con.execute(f"ALTER TABLE domains ADD COLUMN {col} {decl}")
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
