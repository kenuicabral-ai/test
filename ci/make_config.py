"""Ajusta o config.json para rodar no GitHub Actions, lendo as chaves dos Secrets."""
import json
import os

path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.json")
with open(path, encoding="utf-8") as f:
    cfg = json.load(f)

cfg.update({
    "urlscan_api_key": os.environ.get("URLSCAN_API_KEY", ""),
    "publicwww_api_key": os.environ.get("PUBLICWWW_API_KEY", ""),
    "anthropic_api_key": os.environ.get("ANTHROPIC_API_KEY", ""),
    "proxy": os.environ.get("PROXY_URL", ""),
    "workers": 24,
    "max_minutes": int(os.environ.get("RADAR_MAX_MINUTES") or 50),
    # Sem chave do urlscan, cada busca traz no máximo 100 resultados.
    "urlscan_max_per_query": 500 if os.environ.get("URLSCAN_API_KEY") else 100,
    # Ofertas nascendo: certificados dos últimos 7 dias com estas palavras no nome.
    "crtsh_keywords": ["metodo", "protocolo", "segredo", "emagrec", "renda-extra"],
})
with open(path, "w", encoding="utf-8") as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)

print("Configuração da rodada:")
for k in ("urlscan_api_key", "publicwww_api_key", "anthropic_api_key", "proxy"):
    print(f"  {k}: {'configurada' if cfg[k] else 'não configurada'}")
print(f"  tempo máximo da rodada: {cfg['max_minutes']} min, {cfg['workers']} análises em paralelo")
