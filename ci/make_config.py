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
    "apify_token": os.environ.get("APIFY_TOKEN", ""),
    # APIFY_SEARCHES: uma busca por linha (URL da Biblioteca, page_id ou termo).
    "apify_searches": [s.strip() for s in os.environ.get("APIFY_SEARCHES", "").splitlines() if s.strip()],
    # Apify é opcional e pago: só roda se VOCÊ pedir (APIFY_AUTO=N ou APIFY_SEARCHES).
    # Ter o token não gasta nada sozinho.
    "apify_auto_advertisers": int(os.environ.get("APIFY_AUTO") or 0),
    # Análise é espera de rede: mais conexões em paralelo, e página que não responde
    # em 15 s fica para a próxima (a fila chegou a 23 mil domínios numa rodada).
    "workers": 48,
    "timeout": 15,
    "max_minutes": int(os.environ.get("RADAR_MAX_MINUTES") or 50),
    # Máx. de varreduras por busca em cada leitura (sem chave, cada página traz 100).
    "urlscan_max_per_query": 1000 if os.environ.get("URLSCAN_API_KEY") else 300,
    # Ofertas nascendo: certificados dos últimos 7 dias com estas palavras no nome.
    "crtsh_keywords": ["metodo", "protocolo", "segredo", "emagrec", "renda-extra"],
})
with open(path, "w", encoding="utf-8") as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)

print("Configuração da rodada:")
for k in ("urlscan_api_key", "publicwww_api_key", "anthropic_api_key", "proxy", "apify_token"):
    print(f"  {k}: {'configurada' if cfg[k] else 'não configurada'}")
print(f"  apify: auto={cfg['apify_auto_advertisers']} anunciantes, {len(cfg['apify_searches'])} buscas")
print(f"  tempo máximo da rodada: {cfg['max_minutes']} min, {cfg['workers']} análises em paralelo")
