"""Classificação opcional com a API da Claude: tipo de página, nicho e promessa."""
import json
import re

from . import net
from .db import update

PROMPT = """Classifique esta página de vendas a partir do título e do texto.
Responda SOMENTE com JSON: {{"tipo": "vsl|advertorial|captura|loja|outro", "nicho": "...", "promessa": "frase curta"}}

Título: {title}
Texto: {text}"""


def run(con, cfg, limit=200, log=print):
    key = cfg.get("anthropic_api_key")
    if not key:
        log("  sem anthropic_api_key no config.json: classificação pulada")
        return 0
    rows = con.execute("""SELECT domain, title, text_sample FROM domains
                          WHERE score IS NOT NULL AND (classified IS NULL OR classified = 0)
                          ORDER BY score DESC LIMIT ?""", (limit,)).fetchall()
    n = 0
    for r in rows:
        body = {"model": cfg.get("anthropic_model", "claude-haiku-5-5"), "max_tokens": 200,
                "messages": [{"role": "user", "content": PROMPT.format(
                    title=r["title"] or "", text=(r["text_sample"] or "")[:1200])}]}
        try:
            resp = net.post("https://api.anthropic.com/v1/messages", json=body, headers={
                "x-api-key": key, "anthropic-version": "2023-06-01",
                "content-type": "application/json"})
            txt = resp.json()["content"][0]["text"]
            data = json.loads(re.search(r"\{.*\}", txt, re.S).group(0))
        except Exception as e:
            log(f"  classificação falhou em {r['domain']}: {e}")
            continue
        update(con, r["domain"], page_type=data.get("tipo"), niche=data.get("nicho"),
               promise=data.get("promessa"), classified=1)
        n += 1
    con.commit()
    log(f"  classificadas: {n}")
    return n
