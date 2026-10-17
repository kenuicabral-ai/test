"""Envia o resultado da rodada para o Telegram: resumo + relatório + CSV."""
import csv
import datetime as dt
import html
import json
import os
import sqlite3
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
CHAT_FILE = os.path.join(ROOT, "telegram_chat_id.txt")
API = f"https://api.telegram.org/bot{TOKEN}"
RUN_URL = "{}/{}/actions/runs/{}".format(os.environ.get("GITHUB_SERVER_URL", "https://github.com"),
                                         os.environ.get("GITHUB_REPOSITORY", ""),
                                         os.environ.get("GITHUB_RUN_ID", ""))
REPO_URL = "{}/{}".format(os.environ.get("GITHUB_SERVER_URL", "https://github.com"),
                          os.environ.get("GITHUB_REPOSITORY", ""))


def call(method, data=None, files=None):
    url = f"{API}/{method}"
    if files:
        boundary = "----radar" + os.urandom(8).hex()
        body = b""
        for k, v in (data or {}).items():
            body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n").encode()
        for k, (name, content) in files.items():
            body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"; filename=\"{name}\"\r\n"
                     "Content-Type: application/octet-stream\r\n\r\n").encode() + content + b"\r\n"
        body += f"--{boundary}--\r\n".encode()
        req = urllib.request.Request(url, data=body,
                                     headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    else:
        req = urllib.request.Request(url, data=urllib.parse.urlencode(data or {}).encode())
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def chat_id():
    cid = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if cid:
        return cid
    if os.path.exists(CHAT_FILE):
        cid = open(CHAT_FILE).read().strip()
        if cid:
            return cid
    # Descobre pela última mensagem enviada ao bot (o "oi" que você mandou).
    upd = call("getUpdates").get("result", [])
    for u in reversed(upd):
        msg = u.get("message") or u.get("edited_message") or u.get("my_chat_member") or {}
        chat = msg.get("chat") or {}
        if chat.get("id"):
            cid = str(chat["id"])
            with open(CHAT_FILE, "w") as f:
                f.write(cid)
            return cid
    return None


def load_offers():
    path = os.path.join(ROOT, "saida", "ranking_ofertas.csv")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def first_seen_today():
    db = os.path.join(ROOT, "radar.db")
    if not os.path.exists(db):
        return set(), True
    con = sqlite3.connect(db)
    today = dt.date.today().isoformat()
    rows = con.execute("SELECT domain, MIN(day) FROM snapshots GROUP BY domain").fetchall()
    days = {d for _, d in rows}
    first_run = days <= {today}
    return {d for d, first in rows if first == today}, first_run


def line(i, o):
    e = html.escape
    bits = [o.get("estagio") or ""]
    if o.get("trafego"):
        bits.append(f"tráfego: {o['trafego']}")
    if o.get("checkouts"):
        bits.append(o["checkouts"])
    if o.get("max_dias_anuncio") not in ("", "0", None):
        bits.append(f"anúncio {o['max_dias_anuncio']}d")
    if o.get("dominios_ativos") and o["dominios_ativos"] not in ("0", "1"):
        bits.append(f"{o['dominios_ativos']} domínios")
    if o.get("cloaking"):
        bits.append("cloaking")
    title = (o.get("nicho") or o.get("titulo") or "")[:60]
    forca = f"F{o['forca']}" if o.get("forca") else ""
    escala = f"E{o['escala']}" if o.get("escala") else ""
    ft = (" (" + " ".join(x for x in (forca, escala) if x) + ")") if (forca or escala) else ""
    ads = []
    if o.get("biblioteca_anuncios"):
        ads.append(f"<a href=\"{e(o['biblioteca_anuncios'])}\">Meta: {e(o.get('anunciante') or 'anunciante')}</a>")
    elif o.get("whatsapp"):
        ads.append(f"<a href=\"{e(o['whatsapp'])}\">{e(o.get('anunciante') or 'whatsapp')}</a>")
    if o.get("anuncios_google") and "google" in (o.get("trafego") or ""):
        ads.append(f"<a href=\"{e(o['anuncios_google'])}\">Google</a>")
    if o.get("anuncios_tiktok"):
        ads.append(f"<a href=\"{e(o['anuncios_tiktok'])}\">TikTok</a>")
    adv = ("\n    📢 " + " · ".join(ads)) if ads else ""
    return (f"{i}. <b>{e(o['score'])}</b>{ft} · <a href=\"https://{e(o['dominio_principal'])}\">"
            f"{e(o['dominio_principal'])}</a>\n    {e(' · '.join(b for b in bits if b))}"
            + (f"\n    <i>{e(title)}</i>" if title else "") + adv)


def main():
    if not TOKEN:
        print("TELEGRAM_BOT_TOKEN não configurado: aviso pulado.")
        return
    cid = chat_id()
    if not cid:
        print("Não achei seu chat: abra o seu bot no Telegram, mande 'oi' e rode de novo.")
        return
    status = os.environ.get("RADAR_STATUS", "success")
    offers = load_offers()
    today = dt.date.today().strftime("%d/%m/%Y")
    if not offers:
        call("sendMessage", {"chat_id": cid, "parse_mode": "HTML", "disable_web_page_preview": "true",
                             "text": f"⚠️ <b>Radar de Ofertas · {today}</b>\nA rodada não gerou ranking "
                                     f"(status: {html.escape(status)}).\nDetalhes: {RUN_URL}"})
        return
    new_doms, first_run = first_seen_today()
    new = [o for o in offers if o["dominio_principal"] in new_doms and float(o["score"] or 0) >= 25]
    stages = {s: sum(1 for o in offers if o.get("estagio") == s) for s in ("nova", "crescendo", "estabelecida")}
    head = (f"📊 <b>Radar de Ofertas · {today}</b>\n"
            f"{len(offers)} ofertas · {stages['nova']} novas · {stages['crescendo']} crescendo · "
            f"{stages['estabelecida']} estabelecidas")
    if status not in ("success", ""):
        head += "\n⏱ A rodada parou antes do fim (tempo ou erro); o ranking traz o que foi processado."
    parts = [head, "\n<b>🏆 Top 10</b>"] + [line(i, o) for i, o in enumerate(offers[:10], 1)]
    if new and not first_run:
        parts += ["\n<b>🆕 Entraram hoje</b>"] + [line(i, o) for i, o in enumerate(new[:8], 1)]
    parts.append("\nO ranking completo está no arquivo abaixo (abra no navegador).")
    text = "\n".join(parts)
    while len(text) > 4000:  # limite do Telegram
        parts.pop(-2)
        text = "\n".join(parts)
    call("sendMessage", {"chat_id": cid, "text": text, "parse_mode": "HTML",
                         "disable_web_page_preview": "true"})
    stamp = dt.date.today().isoformat()
    for fname, label in (("ranking.html", f"ranking_{stamp}.html"),
                         ("ranking_ofertas.csv", f"ranking_ofertas_{stamp}.csv"),
                         ("anunciantes.csv", f"anunciantes_{stamp}.csv"),
                         ("operacoes.csv", f"operacoes_{stamp}.csv")):
        p = os.path.join(ROOT, "saida", fname)
        if os.path.exists(p):
            with open(p, "rb") as f:
                call("sendDocument", {"chat_id": cid}, {"document": (label, f.read())})
    print("Enviado ao Telegram.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # o aviso nunca deve derrubar o salvamento dos dados
        print(f"Falha ao enviar ao Telegram: {e}", file=sys.stderr)
