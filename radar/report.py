"""Gera ranking_ofertas.csv, ranking_dominios.csv e ranking.html."""
import csv
import html
import json
import os

from .db import jl
from .score import offers

DOMAIN_COLS = ["domain", "score", "forca", "tracao", "stage", "alive", "cloaked", "title", "niche",
               "players", "checkouts", "ad_count", "ad_video", "ad_max_days", "urlscan_30d",
               "urlscan_total", "tranco_rank", "cert_first", "cert_count", "cluster_id", "sources",
               "final_url", "checkout_urls", "score_parts"]


def _operations(con):
    """Agrupa por operação (cluster): o mesmo dono rodando vários funis.

    Uma operação grande — muitos domínios, trackers profissionais, vários checkouts —
    é o alvo profissional. Mostra a escala do dono, não de uma oferta isolada.
    """
    from collections import defaultdict
    doms = [r for r in con.execute("SELECT * FROM domains WHERE score IS NOT NULL")]
    links = defaultdict(lambda: defaultdict(set))
    for r in con.execute("SELECT domain, kind, value FROM links WHERE kind IN "
                         "('tracker','adnet','product','social')"):
        links[r["domain"]][r["kind"]].add(r["value"])
    g = defaultdict(list)
    for r in doms:
        g[r["cluster_id"]].append(r)
    out = []
    for cid, members in g.items():
        if len(members) < 2:  # operação = 2+ domínios ligados
            continue
        members.sort(key=lambda r: r["score"] or 0, reverse=True)
        agg = defaultdict(set)
        for m in members:
            for k, vs in links[m["domain"]].items():
                agg[k] |= vs
        socials = {v.split(":", 1)[0]: v.split(":", 1)[1] for v in agg["social"] if ":" in v}
        out.append({
            "operacao": cid,
            "dominios": len(members),
            "dominios_ativos": sum(1 for m in members if m["alive"]),
            "melhor_score": members[0]["score"],
            "produtos": len(agg["product"]),
            "trackers": ", ".join(sorted(agg["tracker"])),
            "redes_anuncio": ", ".join(sorted(agg["adnet"])),
            "checkouts": ", ".join(sorted({p.split(":", 1)[0] for p in agg["product"]})),
            "anunciante": socials.get("fb") and f"fb/{socials['fb']}" or socials.get("ig", ""),
            "lista_dominios": " | ".join(m["domain"] for m in members[:40]),
        })
    out.sort(key=lambda o: o["dominios"], reverse=True)
    return out


def _advertisers(offs):
    """Lista de anunciantes achados, cada um com link para seus anúncios e as ofertas dele.

    É a 'lista de trabalho' para usar a extensão por anunciante, em vez de palavra-chave:
    abra os anúncios de cada um e colha os destinos — que voltam para o radar.
    """
    from collections import defaultdict

    from .signatures import ad_library_url
    # O @ do Facebook é o identificador estável; o ID numérico às vezes só aparece em
    # alguns funis. Mapeia @ -> ID para não separar o mesmo anunciante.
    handle_id = {o["fb"]: o["fb_id"] for o in offs if o.get("fb") and o.get("fb_id")}
    groups = defaultdict(list)
    for o in offs:
        key = (o.get("fb") and f"fb:{o['fb']}") or (o.get("fb_id") and f"fbid:{o['fb_id']}") \
            or (o.get("ig") and f"ig:{o['ig']}") or (o.get("cnpj") and f"cnpj:{o['cnpj']}") \
            or (o.get("wa") and f"wa:{o['wa']}")
        if key:
            groups[key].append(o)
    out = []
    for key, items in groups.items():
        items.sort(key=lambda o: o["score"], reverse=True)
        top = items[0]
        fb_id = handle_id.get(top.get("fb")) or top.get("fb_id")
        out.append({
            "anunciante": top["anunciante"],
            "biblioteca_anuncios": ad_library_url(top.get("fb"), fb_id, top.get("marca")),
            "facebook": f"https://facebook.com/{top['fb']}" if top.get("fb") else "",
            "instagram": top.get("instagram", ""),
            "whatsapp": top.get("whatsapp", ""),
            "cnpj": top.get("cnpj", ""),
            "email": top.get("email", ""),
            "ofertas": len(items),
            "melhor_score": top["score"],
            "nichos": ", ".join(sorted({o["nicho"] for o in items if o["nicho"]}))[:120],
            "dominios": " | ".join(o["dominio_principal"] for o in items[:20]),
        })
    out.sort(key=lambda a: (a["ofertas"], a["melhor_score"]), reverse=True)
    return out


def _adv_cell(o, e):
    """Célula do anunciante: link para a Biblioteca de Anúncios quando há Facebook."""
    if o.get("biblioteca_anuncios"):
        return f"<a href='{e(o['biblioteca_anuncios'])}'>{e(o['anunciante'] or 'ver anúncios')}</a>"
    if o.get("whatsapp"):
        return f"<a href='{e(o['whatsapp'])}'>{e(o['anunciante'] or 'whatsapp')}</a>"
    return e(o.get("anunciante") or "")


def _write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def run(con, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    offs = offers(con)
    if offs:
        _write_csv(os.path.join(out_dir, "ranking_ofertas.csv"), list(offs[0].keys()),
                   [list(o.values()) for o in offs])
    doms = con.execute("SELECT * FROM domains WHERE score IS NOT NULL ORDER BY score DESC").fetchall()
    _write_csv(os.path.join(out_dir, "ranking_dominios.csv"), DOMAIN_COLS,
               [[r[c] for c in DOMAIN_COLS] for r in doms])
    advs = _advertisers(offs)
    if advs:
        _write_csv(os.path.join(out_dir, "anunciantes.csv"), list(advs[0].keys()),
                   [list(a.values()) for a in advs])
    ops = _operations(con)
    if ops:
        _write_csv(os.path.join(out_dir, "operacoes.csv"), list(ops[0].keys()),
                   [list(o.values()) for o in ops])
    stats = {
        "descobertos": con.execute("SELECT COUNT(*) FROM domains").fetchone()[0],
        "analisados": con.execute("SELECT COUNT(*) FROM domains WHERE last_analyzed IS NOT NULL").fetchone()[0],
        "ofertas": len(offs),
        "dominios_oferta": len(doms),
        "anunciantes": len(advs),
    }
    by_src = {}
    for r in con.execute("SELECT sources FROM domains WHERE score IS NOT NULL"):
        for s in (r["sources"] or "").split(","):
            if s:
                by_src[s.split(":")[0]] = by_src.get(s.split(":")[0], 0) + 1
    stats["fontes"] = by_src
    path = os.path.join(out_dir, "ranking.html")
    e = html.escape
    static = "".join(
        f"<tr><td class='n'>{i}</td><td><b>{o['score']}</b></td>"
        f"<td class='n'>{o['forca'] if o['forca'] is not None else ''}</td>"
        f"<td class='n'>{o['tracao'] if o['tracao'] is not None else ''}</td>"
        f"<td class='t'><a href='https://{e(o['dominio_principal'])}'>{e(o['dominio_principal'])}</a>"
        f"<div>{e(o['titulo'][:120])}</div><div class='doms'>{e(o['oferta'])}</div></td>"
        f"<td>{e(o['estagio'] or '')}</td><td>{e(o['trafego'])}</td><td>{e(o.get('tracker',''))}</td>"
        f"<td>{_adv_cell(o, e)}</td>"
        f"<td>{e(o['checkouts'])}</td><td>{e(o['players'])}</td>"
        f"<td class='n'>{o['dominios_ativos']}/{o['dominios']}</td><td class='n'>{o['anuncios'] or ''}</td>"
        f"<td class='n'>{o['anuncios_video'] or ''}</td><td class='n'>{o['max_dias_anuncio'] or ''}</td>"
        f"<td class='n'>{o['varreduras_30d'] or ''}</td><td class='n'>{o['melhor_tranco']}</td>"
        f"<td class='n'>{e(o['visto_desde'])}</td></tr>"
        for i, o in enumerate(offs[:500], 1))
    static_head = "".join(f"<th>{h}</th>" for h in ["#", "Score", "Força", "Tração", "Oferta", "Estágio",
                                                     "Tráfego", "Tracker", "Anunciante", "Checkout",
                                                     "Player", "Domínios", "Anúncios", "Vídeo",
                                                     "Máx. dias", "Varred. 30d", "Tranco", "Desde"])
    sub = (f"{stats['ofertas']} ofertas · {stats['anunciantes']} anunciantes · "
           f"{stats['descobertos']} domínios descobertos, {stats['analisados']} analisados")
    page = (PAGE.replace("__ROWS__", static).replace("__HEAD__", static_head).replace("__SUB__", e(sub))
            .replace("__DATA__", json.dumps({"offers": offs, "stats": stats}, ensure_ascii=False)
                     .replace("</", "<\\/")))
    with open(path, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"  relatório: {len(offs)} ofertas -> {path}")
    return path


PAGE = r"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ranking de Ofertas</title>
<style>
:root{--bg:#f7f7f5;--card:#fff;--fg:#1d1d1b;--mute:#6b6b66;--line:#e4e3de;--acc:#0b6bcb;--hot:#c0392b;--warm:#d68910;--ok:#1e8449}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141413;--card:#1e1e1c;--fg:#ecebe6;--mute:#9a9992;--line:#2f2f2c;--acc:#5aa9f0;--hot:#ef6f5e;--warm:#f0b54a;--ok:#5cc88a}}
:root[data-theme="dark"]{--bg:#141413;--card:#1e1e1c;--fg:#ecebe6;--mute:#9a9992;--line:#2f2f2c;--acc:#5aa9f0;--hot:#ef6f5e;--warm:#f0b54a;--ok:#5cc88a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1400px;margin:0 auto;padding:20px 16px}
h1{font-size:22px;margin:0 0 4px}.sub{color:var(--mute);margin:0 0 16px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.kpi b{display:block;font-size:22px;font-variant-numeric:tabular-nums}.kpi span{color:var(--mute);font-size:12px}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
input,select{background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit}
input{flex:1;min-width:200px}
.wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;min-width:1000px}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{position:sticky;top:0;background:var(--card);cursor:pointer;user-select:none;font-size:12px;color:var(--mute);white-space:nowrap}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.sc{display:inline-block;min-width:44px;text-align:center;padding:2px 6px;border-radius:6px;font-weight:700;color:#fff}
.tag{display:inline-block;padding:1px 6px;border-radius:5px;font-size:11px;border:1px solid var(--line);margin:1px 2px 1px 0;white-space:nowrap}
.nova{color:var(--ok);border-color:var(--ok)}.crescendo{color:var(--warm);border-color:var(--warm)}.estabelecida{color:var(--acc);border-color:var(--acc)}
a{color:var(--acc);text-decoration:none}.doms{color:var(--mute);font-size:12px;max-width:360px}
.t{max-width:300px}
</style></head><body><main>
<h1>Ranking de Ofertas</h1>
<p class="sub" id="sub">__SUB__</p>
<div class="kpis" id="kpis"></div>
<div class="bar">
<input id="q" placeholder="Filtrar por domínio, título, nicho, checkout...">
<select id="st"><option value="">Todos os estágios</option><option>nova</option><option>crescendo</option><option>estabelecida</option></select>
<select id="ck"><option value="">Qualquer checkout</option></select>
</div>
<div class="wrap"><table><thead><tr id="hd">__HEAD__</tr></thead><tbody id="bd">__ROWS__</tbody></table></div>
</main>
<script>
const D=__DATA__;
const COLS=[["#","rank"],["Score","score"],["Força","forca"],["Tração","tracao"],["Oferta","dominio_principal"],["Estágio","estagio"],["Tráfego","trafego"],["Tracker","tracker"],["Anunciante","anunciante"],["Checkout","checkouts"],["Player","players"],["Domínios","dominios_ativos"],["Anúncios","anuncios"],["Vídeo","anuncios_video"],["Máx. dias","max_dias_anuncio"],["Varred. 30d","varreduras_30d"],["Tranco","melhor_tranco"],["Desde","visto_desde"]];
D.offers.forEach((o,i)=>o.rank=i+1);
const s=D.stats;
document.getElementById('sub').textContent=`${s.ofertas} ofertas · ${s.anunciantes||0} anunciantes · ${s.descobertos} domínios descobertos, ${s.analisados} analisados`;
const fontes=Object.entries(s.fontes).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}: ${v}`).join(' · ');
document.getElementById('kpis').innerHTML=[["Ofertas",s.ofertas],["Novas (≤30d)",D.offers.filter(o=>o.estagio==='nova').length],["Crescendo",D.offers.filter(o=>o.estagio==='crescendo').length],["Estabelecidas",D.offers.filter(o=>o.estagio==='estabelecida').length]].map(([l,v])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')+`<div class="kpi" style="grid-column:span 2"><span>Ofertas por fonte</span><div style="font-size:12px;margin-top:4px">${esc(fontes)}</div></div>`;
const cks=[...new Set(D.offers.flatMap(o=>o.checkouts?o.checkouts.split(', '):[]))].sort();
document.getElementById('ck').innerHTML+=cks.map(c=>`<option>${esc(c)}</option>`).join('');
let sortK='score',dir=-1;
function esc(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function color(x){return x>=60?'var(--hot)':x>=40?'var(--warm)':x>=20?'var(--acc)':'var(--mute)'}
function head(){document.getElementById('hd').innerHTML=COLS.map(([l,k])=>`<th data-k="${k}">${l}${k===sortK?(dir<0?' ▼':' ▲'):''}</th>`).join('');
document.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;dir=k===sortK?-dir:-1;sortK=k;render()})}
function render(){head();const q=document.getElementById('q').value.toLowerCase(),st=document.getElementById('st').value,ck=document.getElementById('ck').value;
let rows=D.offers.filter(o=>(!st||o.estagio===st)&&(!ck||(o.checkouts||'').split(', ').includes(ck))&&(!q||JSON.stringify(o).toLowerCase().includes(q)));
rows.sort((a,b)=>{let x=a[sortK],y=b[sortK];if(sortK==='melhor_tranco'){x=x||1e9;y=y||1e9}return (x>y?1:x<y?-1:0)*dir});
document.getElementById('bd').innerHTML=rows.map(o=>`<tr>
<td class="n">${o.rank}</td><td><span class="sc" style="background:${color(o.score)}">${o.score}</span></td>
<td class="n">${o.forca??''}</td><td class="n">${o.tracao??''}</td>
<td class="t"><a href="https://${esc(o.dominio_principal)}" target="_blank" rel="noopener noreferrer">${esc(o.dominio_principal)}</a>${o.cloaking?' <span class="tag">cloaking</span>':''}<div>${esc(o.titulo).slice(0,120)}</div>${o.nicho?`<div class="doms">${esc(o.nicho)} · ${esc(o.promessa)}</div>`:''}${o.dominios>1?`<div class="doms">${esc(o.lista_dominios)}</div>`:''}<div class="doms">${esc(o.oferta)}</div></td>
<td><span class="tag ${o.estagio}">${o.estagio}</span></td><td>${esc(o.trafego)}</td><td>${esc(o.tracker||'')}</td><td>${o.biblioteca_anuncios?`<a href="${esc(o.biblioteca_anuncios)}" target="_blank" rel="noopener noreferrer">${esc(o.anunciante||'ver anúncios')}</a>`:(o.whatsapp?`<a href="${esc(o.whatsapp)}" target="_blank" rel="noopener noreferrer">${esc(o.anunciante||'whatsapp')}</a>`:esc(o.anunciante||''))}</td><td>${esc(o.checkouts)}</td><td>${esc(o.players)}</td>
<td class="n">${o.dominios_ativos}/${o.dominios}</td><td class="n">${o.anuncios||''}</td><td class="n">${o.anuncios_video||''}</td><td class="n">${o.max_dias_anuncio||''}</td><td class="n">${o.varreduras_30d||''}</td><td class="n">${o.melhor_tranco}</td><td class="n">${esc(o.visto_desde)}</td></tr>`).join('')}
['q','st','ck'].forEach(id=>document.getElementById(id).addEventListener('input',render));render();
</script></body></html>"""
