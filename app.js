/* PEP-prototype – vanilla JS, ingen eksterne biblioteker/CDN. EKSEMPELDATA. */
"use strict";
const S = { user: +(new URLSearchParams(location.search).get("demoUser") || localStorage.getItem("pepUser") || 2), meta: null };
const $ = (s, r = document) => r.querySelector(s);
const esc = v => (v === null || v === undefined) ? "" : String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (v, d = 1) => v === null || v === undefined ? "–" : Number(v).toLocaleString("nb-NO", { minimumFractionDigits: d, maximumFractionDigits: d });
const mnok = v => v === null || v === undefined ? "–" : nf(v / 1e6, 1);
const GR = ["UGRADERT", "BEGRENSET", "KONFIDENSIELT", "HEMMELIG", "STRENGT HEMMELIG"];
const grad = g => `<span class="grad l${g}">${GR[g]}</span>`;
const st = s => `<span class="st ${esc(s)}">${esc(s)}</span>`;
const chip = (cls, txt) => `<span class="st ${cls}">${esc(txt)}</span>`;
const msCls = s => s === "Iht. plan" || s === "Nådd" ? "st-ok" : (s === "Nådd forsinket" ? "st-warn" : "st-bad");
const can = p => S.meta && S.meta.bruker.rettigheter.includes(p);
const ACT = {};
const ROUTES = {};
const PTAB = {};

async function api(path, opt = {}) {
  const r = await fetch("/api/" + path, { method: opt.method || "GET", headers: { "X-Demo-User": S.user, "Content-Type": "application/json" }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  const ct = r.headers.get("Content-Type") || "";
  const d = ct.includes("json") ? await r.json() : await r.text();
  if (!r.ok) throw new Error(d.feil || r.status);
  return d;
}
function toast(msg, err) { const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ""); setTimeout(() => t.className = "toast hidden", 3500); }
function modal(html) { $("#modalc").innerHTML = html; $("#modal").classList.remove("hidden"); }
function closeModal() { $("#modal").classList.add("hidden"); }
$("#modalx").onclick = closeModal;
document.addEventListener("click", e => {
  const a = e.target.closest("[data-act]"); if (a && ACT[a.dataset.act]) { e.preventDefault(); ACT[a.dataset.act](a.dataset.arg, a, e); return; }
  const g = e.target.closest("[data-go]"); if (g && !e.target.closest("select,input,button:not([data-go])")) { location.hash = g.dataset.go; }
});

async function init() {
  try { S.meta = await api("meta"); }
  catch (e) { if (S.user !== 2) { S.user = 2; localStorage.setItem("pepUser", 2); return init(); } throw e; }
  const sel = $("#userSel");
  sel.innerHTML = S.meta.brukere.map(u => `<option value="${u.id}" ${u.id === S.meta.bruker.id ? "selected" : ""}>${esc(u.rolle)} – ${esc(u.navn)}${u.ekstern ? " [ekstern]" : ""}</option>`).join("");
  sel.onchange = () => { S.user = +sel.value; localStorage.setItem("pepUser", S.user); init(); };
  const ml = Math.min(S.meta.bruker.klarering, S.meta.plattform.maks);
  for (const id of ["#gradbar", "#gradbar2"]) { const b = $(id); b.className = "gradbar g" + ml; b.textContent = `EKSEMPELDATA · Sesjon inntil ${GR[ml]} · ${S.meta.plattform.navn} · Din klarering: ${GR[S.meta.bruker.klarering]}${S.meta.bruker.ekstern ? " · EKSTERN BRUKER" : ""}`; }
  $("#platform").textContent = S.meta.bruker.rolle;
  document.querySelectorAll("#nav a[data-int]").forEach(a => a.style.display = S.meta.bruker.ekstern ? "none" : "");
  $("#bellcount").textContent = S.meta.varsler.length || "";
  route();
}
$("#bell").onclick = async () => {
  const n = await api("notifications");
  modal(`<h2>Varsler for rollen ${esc(S.meta.bruker.rolle)}</h2>` + (n.length ? `<table>${n.map(x => `<tr><td>${esc(x.dato)}</td><td>${esc(x.tekst)}</td></tr>`).join("")}</table>` : "<p>Ingen varsler.</p>"));
};
window.addEventListener("hashchange", () => { document.body.classList.remove("navopen"); $("#navbtn") && $("#navbtn").setAttribute("aria-expanded", "false"); route(); });
if ($("#navbtn")) $("#navbtn").onclick = () => { const o = document.body.classList.toggle("navopen"); $("#navbtn").setAttribute("aria-expanded", o ? "true" : "false"); };
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); document.body.classList.remove("navopen"); } });

async function route() {
  const h = location.hash.replace(/^#/, "") || "/";
  const parts = h.split("/").filter(Boolean);
  const key = parts[0] === "prosjekt" ? "prosjekter" : (parts[0] || "");
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#/" + key));
  const fn = ROUTES[parts[0] || ""] || ROUTES[""];
  const m = $("#main");
  try { m.innerHTML = "<p>Laster …</p>"; await fn(m, parts.slice(1)); }
  catch (e) { m.innerHTML = `<div class="card"><h2>Ingen tilgang eller feil</h2><p>${esc(e.message)}</p><p class="note">Tilgang styres av rolle (RBAC), klarering/gradering og tjenstlig behov (need-to-know).</p></div>`; }
}

/* ---------- SVG-hjelpere ---------- */
function barChart(items, { w = 520, h = 220, keys, colors, labels, fmt = v => nf(v, 0) }) {
  const max = Math.max(1, ...items.flatMap(i => keys.map(k => i[k] || 0)));
  const pad = 46, bw = (w - pad - 10) / Math.max(1, items.length), sub = (bw * 0.8) / keys.length;
  let s = `<svg viewBox="0 0 ${w} ${h + 30}" width="100%" role="img">`;
  for (let t = 0; t <= 4; t++) { const y = 10 + (h - 10) * (1 - t / 4); s += `<line x1="${pad}" x2="${w}" y1="${y}" y2="${y}" stroke="#e6ebf0"/><text x="${pad - 4}" y="${y + 4}" font-size="10" text-anchor="end" fill="#5d6b7a">${fmt(max * t / 4)}</text>`; }
  items.forEach((it, i) => {
    keys.forEach((k, j) => { const v = it[k] || 0, bh = (h - 10) * v / max; s += `<rect x="${pad + i * bw + bw * 0.1 + j * sub}" y="${h - bh}" width="${Math.max(1, sub - 2)}" height="${bh}" fill="${colors[j]}"><title>${esc(it.label)} – ${labels[j]}: ${fmt(v)}</title></rect>`; });
    s += `<text x="${pad + i * bw + bw / 2}" y="${h + 14}" font-size="10" text-anchor="middle" fill="#38485a">${esc(String(it.label).slice(0, Math.max(6, Math.floor(bw / 5.6))))}</text>`;
  });
  return s + `</svg><div class="legend">${labels.map((l, j) => `<span><i style="background:${colors[j]}"></i>${l}</span>`).join("")}</div>`;
}
function lineChart(series, { w = 760, h = 240, labels, colors, xlabels, fmt = v => nf(v, 0) }) {
  const all = series.flat().filter(v => v !== null && v !== undefined); const max = Math.max(1, ...all); const n = Math.max(...series.map(s => s.length));
  const pad = 54, X = i => pad + (w - pad - 10) * i / Math.max(1, n - 1), Y = v => 10 + (h - 20) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${w} ${h + 30}" width="100%">`;
  for (let t = 0; t <= 4; t++) { const y = Y(max * t / 4); s += `<line x1="${pad}" x2="${w}" y1="${y}" y2="${y}" stroke="#e6ebf0"/><text x="${pad - 4}" y="${y + 4}" font-size="10" text-anchor="end" fill="#5d6b7a">${fmt(max * t / 4)}</text>`; }
  const step = Math.ceil(n / 12); (xlabels || []).forEach((l, i) => { if (i % step === 0) s += `<text x="${X(i)}" y="${h + 8}" font-size="10" text-anchor="middle" fill="#5d6b7a">${esc(l)}</text>`; });
  series.forEach((ser, j) => { const pts = ser.map((v, i) => v === null || v === undefined ? null : `${X(i)},${Y(v)}`).filter(Boolean); s += `<polyline fill="none" stroke="${colors[j]}" stroke-width="2.2" points="${pts.join(" ")}"/>`; });
  return s + `</svg><div class="legend">${labels.map((l, j) => `<span><i style="background:${colors[j]}"></i>${l}</span>`).join("")}</div>`;
}
function gantt(rows, { w = 1100 } = {}) {
  const ds = rows.flatMap(r => [r.start, r.end, ...r.ms.flatMap(m => [m.baseline, m.prognose])]).filter(Boolean).map(d => +new Date(d));
  const t0 = Math.min(...ds), t1 = Math.max(...ds), L = 270, rh = 26, h = rows.length * rh + 34;
  const X = d => L + (w - L - 10) * (+new Date(d) - t0) / (t1 - t0 || 1);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="100%">`;
  for (let y = new Date(t0).getFullYear(); y <= new Date(t1).getFullYear() + 1; y++) { const x = X(`${y}-01-01`); if (x >= L && x <= w) s += `<line x1="${x}" x2="${x}" y1="14" y2="${h}" stroke="#e1e7ee"/><text x="${x + 3}" y="11" font-size="10" fill="#5d6b7a">${y}</text>`; }
  const tx = X(new Date().toISOString().slice(0, 10)); s += `<line x1="${tx}" x2="${tx}" y1="14" y2="${h}" stroke="#c62828" stroke-dasharray="4 3"/><text x="${tx + 3}" y="${h - 2}" font-size="10" fill="#c62828">I dag</text>`;
  rows.forEach((r, i) => {
    const y = 22 + i * rh;
    s += `<g ${r.go ? `data-go="${r.go}" style="cursor:pointer"` : ""}><text x="4" y="${y + 13}" font-size="11" fill="#1b2430">${esc(r.label.slice(0, 44))}</text>`;
    if (r.start && r.end) s += `<rect x="${X(r.start)}" y="${y + 4}" width="${Math.max(2, X(r.end) - X(r.start))}" height="12" rx="3" fill="#cfe0f1"/>`;
    r.ms.forEach(m => {
      const col = { "Iht. plan": "#2e7d32", "Nådd": "#2e7d32", "Nådd forsinket": "#c88a00" }[m.statusvurdering] || "#c62828";
      const xb = X(m.baseline), xp = X(m.faktisk || m.prognose);
      if (Math.abs(xp - xb) > 1) s += `<line x1="${xb}" x2="${xp}" y1="${y + 10}" y2="${y + 10}" stroke="${col}" stroke-width="2"/><circle cx="${xb}" cy="${y + 10}" r="3" fill="#fff" stroke="#5d6b7a"/>`;
      s += `<path d="M${xp} ${y + 3} l6 7 l-6 7 l-6 -7z" fill="${col}"><title>${esc(m.navn)}: baseline ${m.baseline}, prognose ${m.prognose}${m.faktisk ? ", faktisk " + m.faktisk : ""} – ${m.statusvurdering}</title></path>`;
    });
    s += `</g>`;
  });
  return s + `</svg><div class="legend"><span><i style="background:#2e7d32"></i>Iht. plan / nådd</span><span><i style="background:#c88a00"></i>Nådd forsinket</span><span><i style="background:#c62828"></i>Forsinket / ikke rapportert</span><span>○ baseline · ◆ prognose/faktisk</span></div>`;
}
const riskColor = sc => sc >= 15 ? "#e57373" : sc >= 8 ? "#ffd54f" : "#a5d6a7";
function matrix(mat, sel) {
  let s = `<div class="matrix">`;
  for (let si = 5; si >= 1; si--) {
    s += `<div class="ax">S${si}</div>`;
    for (let ki = 1; ki <= 5; ki++) { const v = mat[si - 1][ki - 1]; s += `<div class="mc ${sel === si + "-" + ki ? "sel" : ""}" data-act="cell" data-arg="${si}-${ki}" style="background:${riskColor(si * ki)}">${v || ""}</div>`; }
  }
  return s + `<div class="ax"></div>` + [1, 2, 3, 4, 5].map(k => `<div class="ax">K${k}</div>`).join("") + `</div><p class="note">S = sannsynlighet, K = konsekvens.</p>`;
}
function sortable(tableId) {
  const t = document.getElementById(tableId); if (!t) return;
  t.querySelectorAll("th").forEach((th, i) => th.onclick = () => {
    const rows = [...t.tBodies[0].rows], asc = th.dataset.asc !== "1"; th.dataset.asc = asc ? "1" : "0";
    rows.sort((a, b) => { const x = a.cells[i].dataset.v ?? a.cells[i].textContent, y = b.cells[i].dataset.v ?? b.cells[i].textContent; const nx = parseFloat(x), ny = parseFloat(y); return (isNaN(nx) || isNaN(ny) ? x.localeCompare(y, "nb") : nx - ny) * (asc ? 1 : -1); });
    rows.forEach(r => t.tBodies[0].appendChild(r));
  });
}
function geo(pts) {
  const w = 460, h = 460, X = lon => 20 + (lon - 4) / (31 - 4) * (w - 40), Y = lat => 20 + (71.5 - lat) / (71.5 - 57.8) * (h - 40);
  const outline = [[58.0, 7.0], [58.9, 5.5], [60.4, 4.9], [62.0, 5.0], [63.0, 6.8], [64.5, 10.5], [66.0, 12.5], [67.5, 14.3], [68.5, 15.0], [69.5, 17.5], [70.3, 19.5], [71.1, 25.7], [70.5, 30.5], [69.8, 30.8], [69.0, 28.9], [69.7, 25.0], [68.6, 22.0], [68.4, 18.5], [67.0, 16.2], [65.8, 14.2], [64.3, 13.8], [63.0, 12.1], [61.5, 12.6], [59.8, 11.9], [59.0, 11.4], [59.0, 10.2], [58.5, 8.9], [58.0, 7.0]];
  let s = `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-height:420px"><polygon points="${outline.map(([la, lo]) => X(lo) + "," + Y(la)).join(" ")}" fill="#e8eef5" stroke="#b9c7d6"/>`;
  const byBase = {}; pts.forEach(p => (byBase[p.base] = byBase[p.base] || []).push(p));
  Object.values(byBase).forEach(arr => {
    const p = arr[0], worst = arr.some(a => a.status === "Rød") ? "#c62828" : arr.some(a => a.status === "Gul") ? "#c88a00" : "#2e7d32";
    s += `<g data-go="#/prosjekt/${p.id}" style="cursor:pointer"><circle cx="${X(p.lon)}" cy="${Y(p.lat)}" r="${5 + arr.length * 2}" fill="${worst}" fill-opacity=".8"><title>${esc(p.base)}: ${arr.map(a => a.kode + " " + a.navn).join("; ")}</title></circle><text x="${X(p.lon) + 9}" y="${Y(p.lat) + 4}" font-size="11">${esc(p.base)} (${arr.length})</text></g>`;
  });
  return s + `</svg>`;
}
/* ---------- Dashbord ---------- */
ROUTES[""] = async m => {
  const [s, ps, ms] = await Promise.all([api("portfolio/summary"), api("projects"), api("portfolio/milestones")]);
  const ext = !!S.meta.bruker.ekstern;
  const late = ms.filter(x => ["Forsinket", "Passert – ikke rapportert"].includes(x.statusvurdering));
  const progItems = Object.entries(s.program).map(([k, v]) => ({ label: k.replace(" (EKS)", ""), P50: v.P50, P85: v.P85, prognose: v.prognose }));
  m.innerHTML = `<div class="row"><h1>Porteføljedashbord</h1><span class="eks">EKSEMPELDATA</span></div>
  <p class="sub">${esc(s.merknad)} Innlogget rolle: ${esc(S.meta.bruker.rolle)}.</p>
  <div class="grid g6">
   <div class="card kpi"><b>${s.antall}</b><span>prosjekter</span></div>
   <div class="card kpi"><b>${s.sum ? nf(s.sum.P50, 0) : "–"}</b><span>sum styringsrammer (P50 ved KS2), MNOK</span></div>
   <div class="card kpi"><b>${s.sum ? nf(s.sum.prognose, 0) : "–"}</b><span>sum prognoser (MNOK)</span></div>
   <div class="card kpi"><b style="color:var(--r)">${s.status["Rød"] || 0}</b><span>prosjekter med rød status</span></div>
   <div class="card kpi"><b>${late.length}</b><span>milepæler forsinket</span></div>
   <div class="card kpi"><b>${s.sha_aapne}</b><span>åpne SHA-avvik</span></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
   <div class="card"><h3>Prosjekter per fase i prosjektmodellen</h3>${barChart(Object.entries(s.faser).map(([k, v]) => ({ label: k, n: v })), { keys: ["n"], colors: ["#1f5f99"], labels: ["Antall prosjekter"] })}
     <p class="note">Fasenavn og beslutningspunkter er konfigurerbare. ANTAKELSE: må tilpasses Forsvarsbyggs prosjektmodell.</p></div>
   <div class="card"><h3>Program: styringsramme (P50 KS2), kostnadsramme (P85 KS2) og prognose (MNOK)</h3>${ext ? "<p>Skjult for eksterne aktører.</p>" : barChart(progItems, { keys: ["P50", "P85", "prognose"], colors: ["#90b4d8", "#0b3d6b", "#e09a3a"], labels: ["Styringsramme P50", "Kostnadsramme P85", "Prognose"] })}</div>
  </div>
  <div class="grid g2" style="margin-top:14px">
   <div class="card"><h3>Geografi – baser (skjematisk)</h3>${geo(s.geografi)}<p class="note">Skjematisk plott på koordinater uten eksterne kartfliser. Kartgrunnlag hentes fra Forsvarsbyggs lokale GIS i produksjon.</p></div>
   <div class="card"><h3>Prosjekter som krever oppmerksomhet</h3><table><thead><tr><th>Prosjekt</th><th>Status</th><th>Maks risiko</th><th class="n">Prognose / P85</th></tr></thead><tbody>
   ${ps.filter(p => p.status !== "Grønn" || p.risikoscore >= 15).sort((a, b) => (b.status === "Rød") - (a.status === "Rød")).slice(0, 10).map(p => `<tr class="click" data-go="#/prosjekt/${p.id}"><td>${esc(p.kode)} ${esc(p.navn)}</td><td>${st(p.status)}</td><td><span class="st" style="background:${riskColor(p.risikoscore)}">${p.risikoscore}</span></td><td class="n">${p.prognose === null ? "–" : nf(p.prognose) + " / " + nf(p.kostnadsramme)}</td></tr>`).join("")}
   </tbody></table>
   <h3 style="margin-top:16px">Portefølje</h3><table>${Object.entries(s.portefoljer).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${v} prosjekter</td></tr>`).join("")}<tr><td>Uavklarte endringer/varsler</td><td class="n">${s.endringer_uavklart.antall} stk · ${mnok(s.endringer_uavklart.belop)} MNOK</td></tr></table></div>
  </div>`;
};

/* ---------- Prosjektliste ---------- */
ROUTES["prosjekter"] = async m => {
  const [ps, progs] = await Promise.all([api("projects"), api("programs")]);
  m.innerHTML = `<div class="row"><h1>Prosjekter</h1><span class="eks">EKSEMPELDATA</span><span class="sp"></span>
   <select id="fprog"><option value="">Alle program</option>${progs.map(p => `<option>${esc(p.navn)}</option>`).join("")}</select>
   <select id="fst"><option value="">Alle statuser</option><option>Grønn</option><option>Gul</option><option>Rød</option></select>
   <input id="fq" placeholder="Søk …"> ${can("project.write") ? `<button class="btn" data-act="newProject">+ Nytt prosjekt</button>` : ""}</div>
   <p class="sub">${ps.length} prosjekter synlige for deg (gradering + tjenstlig behov). Klikk en kolonneoverskrift for å sortere.</p>
   <div class="tbl"><table id="ptab"><thead><tr><th>Kode</th><th>Prosjekt</th><th>Program</th><th>Base</th><th>Fase</th><th>Status</th><th class="n">Styringsramme (P50)</th><th class="n">Kostnadsramme (P85)</th><th class="n">Prognose</th><th class="n">Risiko</th><th>Grad.</th></tr></thead><tbody>
   ${ps.map(p => `<tr class="click" data-go="#/prosjekt/${p.id}" data-prog="${esc(p.program)}" data-st="${p.status}"><td>${esc(p.kode)}</td><td>${esc(p.navn)}</td><td>${esc(p.program)}</td><td>${esc(p.base)}</td><td data-v="${p.fase}">${esc(p.fasenavn)}</td><td>${st(p.status)}</td><td class="n" data-v="${p.styringsramme}">${nf(p.styringsramme)}</td><td class="n" data-v="${p.kostnadsramme}">${nf(p.kostnadsramme)}</td><td class="n" data-v="${p.prognose}">${nf(p.prognose)}</td><td class="n" data-v="${p.risikoscore}">${p.risikoscore}</td><td data-v="${p.gradering}">${grad(p.gradering)}</td></tr>`).join("")}
   </tbody></table></div><p class="note">Beløp i MNOK. Styringsramme (P50) og kostnadsramme (P85) er vedtatte rammer fra KS2 – ikke simulerte verdier.</p>`;
  sortable("ptab");
  const f = () => { const pr = $("#fprog").value, s = $("#fst").value, q = $("#fq").value.toLowerCase(); document.querySelectorAll("#ptab tbody tr").forEach(r => r.style.display = (!pr || r.dataset.prog === pr) && (!s || r.dataset.st === s) && (!q || r.textContent.toLowerCase().includes(q)) ? "" : "none"); };
  ["#fprog", "#fst", "#fq"].forEach(id => $(id).oninput = f);
};
ACT.newProject = async () => {
  const progs = await api("programs"); const ml = Math.min(S.meta.bruker.klarering, S.meta.plattform.maks);
  modal(`<h2>Nytt prosjekt (EKSEMPEL)</h2><div class="form">
   <label>Kode</label><input id="n_kode" value="EKS-${2500 + Math.floor(Math.random() * 99)}"><label>Navn</label><input id="n_navn" value="Nytt eksempelprosjekt">
   <label>Program</label><select id="n_prog">${progs.map(p => `<option value="${p.id}">${esc(p.navn)}</option>`).join("")}</select>
   <label>Base</label><input id="n_base" value="Rena"><label>Styringsramme P50 (MNOK)</label><input id="n_p50" type="number" value="100">
   <label>Kostnadsramme P85 (MNOK)</label><input id="n_p85" type="number" value="118"><label>Start / slutt</label><div class="row"><input id="n_s" type="date" value="2027-01-01"><input id="n_e" type="date" value="2029-06-30"></div>
   <label>Gradering</label><select id="n_g">${GR.map((g, i) => `<option value="${i}">${g}${i > ml ? " (avvises her)" : ""}</option>`).join("")}</select></div>
   <p class="note">Objekter over plattformens maksnivå eller din klarering avvises av serveren.</p><button class="btn" data-act="saveProject">Lagre</button>`);
};
ACT.saveProject = async () => {
  try {
    const r = await api("projects", { method: "POST", body: { kode: $("#n_kode").value, navn: $("#n_navn").value, program_id: $("#n_prog").value, base: $("#n_base").value, lat: 61.1, lon: 11.4, styringsramme: $("#n_p50").value, kostnadsramme: $("#n_p85").value, start: $("#n_s").value, slutt: $("#n_e").value, gradering: $("#n_g").value } });
    closeModal(); toast("Prosjekt opprettet og logget i revisjonslogg"); location.hash = "#/prosjekt/" + r.id;
  } catch (e) { toast(e.message, 1); }
};

/* ---------- Prosjektkort ---------- */
ROUTES["prosjekt"] = async (m, [id, tab]) => {
  const d = await api("projects/" + id); const p = d.prosjekt; tab = tab || "oversikt"; const ext = !!S.meta.bruker.ekstern;
  const tabs = [["oversikt", "Oversikt og faser"], ["okonomi", "Økonomi"], ["fremdrift", "Fremdrift"], ["risiko", "Risiko"], ["endringer", "Kontrakter og endringer"], ["gevinster", "Gevinster"], ["ressurser", "Ressurser"], ["dokumenter", "Dokumenter"], ["eba", "EBA-kobling"], ["sha", "SHA"], ["ki", "KI-analyse"]]
    .filter(t => !ext || ["oversikt", "fremdrift", "endringer", "dokumenter", "eba", "sha"].includes(t[0]));
  m.innerHTML = `<div class="row"><a href="#/prosjekter">← Prosjekter</a></div>
  <div class="row"><h1>${esc(p.kode)} ${esc(p.navn)}</h1>${grad(p.gradering)}${st(p.status)}<span class="eks">EKSEMPELDATA</span></div>
  <p class="sub">${esc(p.program)} · ${esc(p.base)} (${esc(p.region)}) · ${esc(p.type)} · ${esc(p.entreprisemodell)} · PL: ${esc(p.prosjektleder)} · Prosjektsjef: ${esc(p.prosjektsjef)} · Prosjekteier: ${esc(p.prosjekteier)}</p>
  ${d.merknad ? `<div class="card" style="background:var(--ybg)">${esc(d.merknad)}</div>` : ""}
  <div class="phases">${S.meta.faser.map((f, i) => `<div class="ph ${i < p.fase ? "done" : i === p.fase ? "cur" : ""}">${esc(f)}<small>${i < 5 ? "→ BP" + (i + 1) : ""}</small></div>`).join("")}</div>
  <div class="tabs">${tabs.map(([k, l]) => `<button class="${k === tab ? "on" : ""}" data-go="#/prosjekt/${id}/${k}">${l}</button>`).join("")}</div><div id="tabc"></div>`;
  await (PTAB[tab] || PTAB.oversikt)($("#tabc"), d, id);
};
PTAB.oversikt = (c, d, id) => {
  const p = d.prosjekt; const ext = !!S.meta.bruker.ekstern;
  c.innerHTML = `${ext ? "" : `<div class="grid g4">
   <div class="card kpi"><b>${nf(p.styringsramme)}</b><span>Styringsramme P50 (MNOK)</span></div><div class="card kpi"><b>${nf(p.kostnadsramme)}</b><span>Kostnadsramme P85 (MNOK)</span></div>
   <div class="card kpi"><b style="color:${p.prognose > p.kostnadsramme ? "var(--r)" : p.prognose > p.styringsramme ? "var(--y)" : "var(--g)"}">${nf(p.prognose)}</b><span>Prognose sluttkost (MNOK)</span></div>
   <div class="card kpi"><b>${esc(p.kvalitet)}</b><span>Kvalitet (rapportert)</span></div></div>`}
  <div class="grid g2" style="margin-top:14px"><div class="card"><h3>Beslutningspunkter</h3><table><thead><tr><th>BP</th><th>Dato</th><th>Beslutning</th><th>Besluttet av</th></tr></thead><tbody>
   ${d.beslutninger.map(b => `<tr><td>${esc(b.bp)}</td><td>${esc(b.dato)}</td><td>${esc(b.beslutning)}</td><td>${esc(b.besluttet_av)}</td></tr>`).join("") || "<tr><td colspan=4>Ingen</td></tr>"}</tbody></table>
   ${can("phase.decide") && p.fase < 5 ? `<div class="row" style="margin-top:10px"><input id="bpk" placeholder="Kommentar til beslutning" style="flex:1"><button class="btn" data-act="decide" data-arg="${id}|Godkjent">Godkjenn BP${p.fase + 1}</button><button class="btn sec" data-act="decide" data-arg="${id}|Utsatt">Utsett</button></div>` : `<p class="note">Beslutning ved beslutningspunkt krever rollen Prosjekteier.</p>`}</div>
   <div class="card"><h3>Prosjektinformasjon</h3><table><tr><td>Periode</td><td>${esc(p.start)} – ${esc(p.slutt)}</td></tr><tr><td>Prioritet</td><td>${p.prioritet}</td></tr><tr><td>Beskrivelse</td><td>${esc(p.beskrivelse)}</td></tr>
   <tr><td>Erfaringer</td><td>${d.erfaringer.map(e => esc(e.tittel)).join("<br>") || "–"}</td></tr></table>
   ${can("project.write") && !ext ? `<div class="row" style="margin-top:10px"><label>Ny prognose (MNOK)</label><input id="newprog" type="number" step="0.1" value="${p.prognose}" style="width:110px"><button class="btn" data-act="saveProg" data-arg="${id}">Oppdater prognose</button></div>` : ""}</div></div>`;
};
ACT.decide = async arg => { const [id, b] = arg.split("|"); try { await api(`projects/${id}/phase`, { method: "POST", body: { beslutning: b, kommentar: $("#bpk").value } }); toast("Beslutning registrert og logget"); route(); } catch (e) { toast(e.message, 1); } };
ACT.saveProg = async id => { try { await api("projects/" + id, { method: "PATCH", body: { prognose: +$("#newprog").value } }); toast("Prognose oppdatert (historikk og revisjonslogg)"); route(); } catch (e) { toast(e.message, 1); } };
PTAB.okonomi = async (c, d, id) => {
  const e = await api(`projects/${id}/economy`);
  const mm = e.maaneder; const today = new Date().toISOString().slice(0, 7);
  const cur = mm.filter(x => x.mnd <= today).slice(-1)[0] || {};
  c.innerHTML = `<div class="grid g4"><div class="card kpi"><b>${mnok(cur.akk_budsjett)}</b><span>Akk. periodisert budsjett t.o.m. ${esc(cur.mnd || "")} (MNOK)</span></div>
   <div class="card kpi"><b>${mnok(e.bokfort_totalt)}</b><span>Akk. bokført produksjon (ERP-mock) (MNOK)</span></div>
   <div class="card kpi"><b>${cur.akk_budsjett ? nf((e.bokfort_totalt - cur.akk_budsjett) / 1e6) : "–"}</b><span>Avvik mot periodebudsjett (MNOK)</span></div>
   <div class="card kpi"><b>${nf(e.prognose - e.styringsramme_P50)}</b><span>Prognose − styringsramme = bruk av usikkerhetsavsetning (MNOK)</span></div></div>
  <div class="card" style="margin-top:14px"><h3>Akkumulert periodebudsjett vs. bokført produksjon (MNOK)</h3>${lineChart([mm.map(x => x.akk_budsjett / 1e6), mm.map(x => x.akk_bokfort === undefined ? null : x.akk_bokfort / 1e6)], { labels: ["Akk. budsjett (flatt pr. virkedag)", "Akk. bokført"], colors: ["#90b4d8", "#0b3d6b"], xlabels: mm.map(x => x.mnd) })}<p class="note">${esc(e.merknad)}</p></div>
  <div class="grid g2" style="margin-top:14px"><div class="card"><h3>Økonomi på WBS-nivå (MNOK)</h3><table><thead><tr><th>WBS</th><th>Navn</th><th class="n">Budsjett</th><th class="n">Prognose</th><th class="n">Bokført</th></tr></thead><tbody>
   ${e.wbs.map(w => `<tr><td>${esc(w.kode)}</td><td>${esc(w.navn)}</td><td class="n">${mnok(w.budsjett)}</td><td class="n">${mnok(w.prognose)}</td><td class="n">${mnok(w.bokfort)}</td></tr>`).join("")}</tbody></table>
   <h3>Siste bokførte bilag (ERP-mock)</h3><table><thead><tr><th>Dato</th><th>Bilag</th><th>WBS</th><th class="n">Beløp NOK</th></tr></thead><tbody>${e.siste_bilag.slice(0, 8).map(b => `<tr><td>${b.dato}</td><td>${b.bilag}</td><td>${b.wbs}</td><td class="n">${nf(b.belop, 0)}</td></tr>`).join("")}</tbody></table></div>
   <div class="card"><h3>Utvikling prognose mot P50/P85 (MNOK)</h3>${lineChart([e.estimathistorikk.map(x => x.p50), e.estimathistorikk.map(x => x.p85), e.estimathistorikk.map(x => x.prognose)], { w: 520, h: 200, labels: ["P50", "P85", "Prognose"], colors: ["#90b4d8", "#0b3d6b", "#e09a3a"], xlabels: e.estimathistorikk.map(x => x.dato.slice(0, 7)) })}
   <h3>Periodebudsjett siste 12 mnd</h3><table><thead><tr><th>Mnd</th><th class="n">Virkedager</th><th class="n">Budsjett</th><th class="n">Bokført</th></tr></thead><tbody>${mm.filter(x => x.mnd <= today).slice(-12).map(x => `<tr><td>${x.mnd}</td><td class="n">${x.virkedager}</td><td class="n">${mnok(x.budsjett)}</td><td class="n">${mnok(x.bokfort)}</td></tr>`).join("")}</tbody></table></div></div>`;
};
PTAB.fremdrift = (c, d, id) => {
  const p = d.prosjekt;
  c.innerHTML = `<div class="card"><h3>Gantt – milepæler mot baseline</h3>${gantt([{ label: "Prosjektperiode", start: p.start, end: p.slutt, ms: [] }].concat(d.milepaler.map(m => ({ label: m.navn, ms: [m] }))))}</div>
  <div class="grid g2" style="margin-top:14px"><div class="card"><h3>Milepæler</h3><table><thead><tr><th>Milepæl</th><th>Baseline</th><th>Prognose</th><th>Faktisk</th><th>Status</th></tr></thead><tbody>
   ${d.milepaler.map(m => `<tr><td>${esc(m.navn)}</td><td>${esc(m.baseline)}</td><td>${can("milestone.write") && !m.faktisk ? `<input type="date" aria-label="Ny prognose for ${esc(m.navn)}" id="msp${m.id}" value="${esc(m.prognose)}">` : esc(m.prognose)}</td><td>${can("milestone.write") && !m.faktisk ? `<input type="date" aria-label="Faktisk dato for ${esc(m.navn)}" id="msf${m.id}">` : esc(m.faktisk || "")}</td><td>${chip(msCls(m.statusvurdering), m.statusvurdering)}${can("milestone.write") && !m.faktisk ? ` <button class="btn sec" data-act="saveMs" data-arg="${m.id}">Lagre</button>` : ""}</td></tr>`).join("")}</tbody></table>${can("milestone.write") ? `<p class="note">Baseline er låst. Prognose og faktisk dato meldes av prosjektleder og logges.</p>` : ""}</div>
   <div class="card"><h3>Tiltaksplaner ved avvik</h3><p class="note">Prosess fra underlaget (s. 25): avvik fra tidsplan → tiltaksplan → godkjennes av prosjektsjef → porteføljeforvalter varsles.</p>
   <table><thead><tr><th>#</th><th>Tiltak</th><th>Status</th><th>Godkjent av</th><th></th></tr></thead><tbody>${d.tiltaksplaner.map(a => `<tr><td>${a.id}</td><td>${esc(a.beskrivelse)}<div class="note">${esc(a.opprettet_av)} ${esc(a.opprettet)}</div></td><td>${chip(a.status === "Godkjent" ? "st-ok" : "st-warn", a.status)}</td><td>${esc(a.godkjent_av || "")}</td><td>${a.status === "Til godkjenning" && can("actionplan.approve") ? `<button class="btn" data-act="approve" data-arg="${a.id}">Godkjenn</button>` : ""}</td></tr>`).join("") || "<tr><td colspan=5>Ingen tiltaksplaner</td></tr>"}</tbody></table>
   ${can("actionplan.create") ? `<div class="row" style="margin-top:10px"><select id="apms">${d.milepaler.filter(m => !["Iht. plan", "Nådd"].includes(m.statusvurdering)).map(m => `<option value="${m.id}">${esc(m.navn)}</option>`).join("") || "<option value=''>(ingen avvik)</option>"}</select><input id="aptxt" placeholder="Beskriv tiltak" style="flex:1"><button class="btn" data-act="newAP" data-arg="${id}">Send til godkjenning</button></div>` : `<p class="note">Bytt til rollen Prosjektleder for å opprette, og Prosjektsjef for å godkjenne.</p>`}</div></div>`;
};
ACT.saveMs = async id => { const b = { prognose: $("#msp" + id).value }; if ($("#msf" + id).value) b.faktisk = $("#msf" + id).value; try { const r = await api("milestones/" + id, { method: "PATCH", body: b }); toast("Milepæl oppdatert: " + r.statusvurdering); route(); } catch (e) { toast(e.message, 1); } };
ACT.newAP = async id => { try { await api("actionplans", { method: "POST", body: { project_id: id, milestone_id: $("#apms").value || null, beskrivelse: $("#aptxt").value || "Forsering med ekstra skift (EKSEMPEL)" } }); toast("Tiltaksplan sendt – prosjektsjef varslet"); route(); } catch (e) { toast(e.message, 1); } };
ACT.approve = async aid => { try { await api(`actionplans/${aid}/approve`, { method: "POST", body: { status: "Godkjent" } }); toast("Godkjent – porteføljeforvalter varslet"); route(); } catch (e) { toast(e.message, 1); } };
PTAB.risiko = async (c, d, id) => {
  const r = await api(`projects/${id}/risks`); let date = r.datoer[r.datoer.length - 1];
  const draw = async () => {
    const rr = date === r.datoer[r.datoer.length - 1] ? r : await api(`projects/${id}/risks?dato=${date}`);
    const mat = [0, 1, 2, 3, 4].map(() => [0, 0, 0, 0, 0]); rr.risikoer.filter(x => x.s && x.status !== "Lukket").forEach(x => mat[x.s - 1][x.k - 1]++);
    c.innerHTML = `<div class="grid g2"><div class="card"><h3>Prosjektets risikomatrise per ${esc(date)}</h3>${matrix(mat)}
      <label>Tidsdimensjon: <input type="range" id="rdate" min="0" max="${r.datoer.length - 1}" value="${r.datoer.indexOf(date)}" style="width:260px"></label> <b>${esc(date)}</b>
      <p class="note">Dra for å se hvordan risikobildet har endret seg over tid.${d.skjulte_risikoer ? ` ${d.skjulte_risikoer} risiko(er) over din klarering er skjult.` : ""}</p></div>
      <div class="card"><h3>Registrer risiko eller mulighet</h3>${can("risk.write") ? `<div class="form"><label>Tittel</label><input id="rt" value="Ny risiko (EKSEMPEL)"><label>Type</label><select id="rty"><option>Risiko</option><option>Mulighet</option></select><label>S / K (1–5)</label><div class="row"><input id="rs" type="number" min=1 max=5 value=3 style="width:60px"><input id="rk" type="number" min=1 max=5 value=3 style="width:60px"></div><label>Kostkonsekvens (MNOK)</label><input id="rc" type="number" value="2"><label>Tiltak</label><input id="rti" value=""><label>Gradering</label><select id="rg">${GR.slice(0, 3).map((g, i) => `<option value="${i}">${g}</option>`).join("")}</select></div><button class="btn" data-act="newRisk" data-arg="${id}" style="margin-top:8px">Lagre</button>` : "<p class='note'>Krever rollen Prosjektleder eller Prosjektsjef.</p>"}</div></div>
      <div class="card" style="margin-top:14px"><h3>Risikoregister med handlingsplan</h3><table><thead><tr><th>Risiko</th><th>Type</th><th>Kategori</th><th>S</th><th>K</th><th>Score</th><th class="n">Kost MNOK</th><th>Tiltak</th><th>Status</th><th>Grad.</th></tr></thead><tbody>
      ${rr.risikoer.map(x => `<tr><td>${esc(x.tittel)}</td><td>${x.type}</td><td>${x.kategori}</td><td>${x.s ?? "–"}</td><td>${x.k ?? "–"}</td><td><span class="st" style="background:${riskColor((x.s || 0) * (x.k || 0))}">${(x.s || 0) * (x.k || 0)}</span></td><td class="n">${nf(x.kost)}</td><td>${esc(x.tiltak)}</td><td>${can("risk.write") ? `<select class="rstat" data-rid="${x.id}">${["Åpen", "Tiltak pågår", "Lukket"].map(s => `<option ${s === x.status ? "selected" : ""}>${s}</option>`).join("")}</select>` : esc(x.status)}</td><td>${grad(x.gradering)}</td></tr>`).join("")}</tbody></table></div>`;
    $("#rdate").oninput = ev => { date = r.datoer[+ev.target.value]; draw(); };
    document.querySelectorAll(".rstat").forEach(s => s.onchange = async () => { try { await api("risks/" + s.dataset.rid, { method: "PATCH", body: { status: s.value } }); toast("Risiko oppdatert og logget"); } catch (e) { toast(e.message, 1); } });
  };
  ACT.cell = () => { };
  await draw();
};
ACT.newRisk = async id => { try { await api("risks", { method: "POST", body: { project_id: id, tittel: $("#rt").value, type: $("#rty").value, s: $("#rs").value, k: $("#rk").value, kost: $("#rc").value, tiltak: $("#rti").value, gradering: $("#rg").value } }); toast("Risiko registrert"); route(); } catch (e) { toast(e.message, 1); } };
PTAB.endringer = (c, d, id) => {
  const types = can("change.write") ? ["Varsel", "Krav", "Endringsordre", "Budsjettendring", "Opsjon", "Mengderegulering"] : can("change.varsel") ? ["Varsel"] : [];
  const ext = !!S.meta.bruker.ekstern;
  c.innerHTML = `<div class="card"><h3>Kontrakter (andel fordelt på dette prosjektet)</h3><table><thead><tr><th>Kontrakt</th><th>Navn</th><th>Leverandør</th><th>Standard</th><th class="n">Verdi MNOK</th><th class="n">Andel</th><th>Periode</th></tr></thead><tbody>
  ${d.kontrakter.map(k => `<tr><td>${k.kontraktsnr}</td><td>${esc(k.navn)}</td><td>${esc(k.leverandor)}</td><td>${esc(k.standard)}</td><td class="n">${ext ? "–" : mnok(k.verdi)}</td><td class="n">${nf(k.andel * 100, 0)} %</td><td>${k.start} – ${k.slutt}</td></tr>`).join("") || "<tr><td colspan=7>Ingen</td></tr>"}</tbody></table></div>
  <div class="card" style="margin-top:14px"><h3>Varsler, krav, endringer, opsjoner og mengdereguleringer</h3><table><thead><tr><th>Nr</th><th>Type</th><th>Tittel</th><th>Kontrakt</th><th class="n">Beløp MNOK</th><th class="n">Dager</th><th>Status</th><th>Dato</th></tr></thead><tbody>
  ${d.endringer.map(x => `<tr><td>${esc(x.nr)}</td><td>${esc(x.type)}</td><td>${esc(x.tittel)}</td><td>${esc(x.kontraktsnr || "")}</td><td class="n">${mnok(x.belop)}</td><td class="n">${esc(x.dager)}</td><td>${(can("change.write") || can("change.approve")) && !["Godkjent", "Avvist"].includes(x.status) ? `<select aria-label="Status for ${esc(x.nr)}" class="cstat" data-cid="${x.id}">${["Registrert", "Under behandling", "Godkjent", "Avvist"].map(s => `<option ${s === x.status ? "selected" : ""}>${s}</option>`).join("")}</select>` : esc(x.status)}</td><td>${esc(x.dato)}</td></tr>`).join("")}</tbody></table>
  <p class="note">Konsekvens av godkjente endringer: ${mnok(d.endringer.filter(x => x.status === "Godkjent").reduce((a, x) => a + x.belop, 0))} MNOK · uavklart: ${mnok(d.endringer.filter(x => ["Registrert", "Under behandling"].includes(x.status)).reduce((a, x) => a + x.belop, 0))} MNOK</p>
  ${types.length ? `<div class="row"><select id="ct">${types.map(t => `<option>${t}</option>`).join("")}</select><input id="ctt" placeholder="Tittel" style="flex:1"><input id="cb" type="number" placeholder="Beløp NOK" style="width:130px"><input id="cd" type="number" placeholder="Dager" style="width:80px"><button class="btn" data-act="newChange" data-arg="${id}">Registrer</button></div>` : ""}</div>`;
  document.querySelectorAll(".cstat").forEach(s => s.onchange = async () => { try { await api("changes/" + s.dataset.cid, { method: "PATCH", body: { status: s.value } }); toast("Status endret og logget"); route(); } catch (e) { toast(e.message, 1); route(); } });
};
ACT.newChange = async id => { try { await api("changes", { method: "POST", body: { project_id: id, type: $("#ct").value, tittel: $("#ctt").value || "Ny endring (EKSEMPEL)", belop: +$("#cb").value || 0, dager: +$("#cd").value || 0 } }); toast("Registrert"); route(); } catch (e) { toast(e.message, 1); } };
function benefitTable(bs) {
  return `<div class="card"><table><thead><tr><th>Prosjekt</th><th>Gevinst</th><th>KPI</th><th class="n">Baseline</th><th class="n">Mål</th><th class="n">Nå</th><th>Realisert</th><th>Eier</th><th>Status</th><th>Måldato</th></tr></thead><tbody>
  ${bs.map(b => { const pct = Math.max(0, Math.min(1, (b.naa - b.baseline) / ((b.maal - b.baseline) || 1))); return `<tr><td>${esc(b.kode || "")}</td><td>${esc(b.gevinst)}</td><td>${esc(b.kpi)} (${esc(b.enhet)})</td><td class="n">${nf(b.baseline)}</td><td class="n">${nf(b.maal)}</td><td class="n">${nf(b.naa)}</td><td style="width:140px"><div class="bar"><i style="width:${pct * 100}%"></i></div>${nf(pct * 100, 0)} %</td><td>${esc(b.eier)}</td><td>${esc(b.status)}</td><td>${esc(b.maaldato)}</td></tr>`; }).join("") || "<tr><td colspan=10>Ingen gevinster registrert</td></tr>"}</tbody></table></div>`;
}
PTAB.gevinster = (c, d) => { c.innerHTML = benefitTable(d.gevinster); };
PTAB.ressurser = (c, d) => { c.innerHTML = `<div class="card"><table><thead><tr><th>Ressurs</th><th>Kompetanse</th><th>Enhet</th><th class="n">Andel på prosjektet</th></tr></thead><tbody>${d.ressurser.map(r => `<tr><td>${esc(r.navn)}</td><td>${esc(r.kompetanse)}</td><td>${esc(r.enhet)}</td><td class="n">${nf(r.andel * 100, 0)} %</td></tr>`).join("")}</tbody></table></div>`; };
function docTable(ds, skjult, pid) {
  const ml = Math.min(S.meta.bruker.klarering, S.meta.plattform.maks);
  return `<div class="card"><div class="tbl"><table><thead><tr><th>Dokumentnr</th><th>Tittel</th><th>Type</th><th>Rev</th><th>Status</th><th>Gradering</th><th>Offentlighet</th><th>Saksnr (arkiv)</th><th>Avsender</th><th>Sjekksum</th></tr></thead><tbody>
  ${ds.map(x => `<tr><td>${esc(x.dokumentnr)}</td><td>${esc(x.tittel)}</td><td>${esc(x.type)}</td><td>${esc(x.revisjon)}</td><td>${(can("doc.write") || can("doc.approve")) && x.status !== "Arkivert" ? `<select aria-label="Status for ${esc(x.dokumentnr)}" class="dstat" data-did="${x.id}">${["Under arbeid", "Til gjennomsyn", "Godkjent", "Arkivert"].map(s => `<option ${s === x.status ? "selected" : ""}>${s}</option>`).join("")}</select>` : esc(x.status)}</td><td>${grad(x.gradering)}</td><td>${esc(x.offentlighet)}</td><td>${esc(x.saksnr || "")}</td><td>${esc(x.avsender)}</td><td class="mono" title="${esc(x.sha256)}">${esc((x.sha256 || "").slice(0, 10))}…</td></tr>`).join("")}</tbody></table></div>
  ${skjult ? `<p class="note">${skjult} dokument(er) er skjult fordi graderingen er over din klarering eller plattformens nivå.</p>` : ""}
  ${pid && can("doc.write") ? `<h3>Registrer dokument (metadata – demo)</h3><div class="row"><input id="dt" placeholder="Tittel" value="Nytt dokument (EKSEMPEL)"><select id="dty"><option>Rapport</option><option>Tegning</option><option>FDV</option><option>Møtereferat</option></select><select id="dg">${GR.slice(0, 3).map((g, i) => `<option value="${i}" ${i > ml ? "disabled" : ""}>${g}</option>`).join("")}</select><select id="doff"><option>Offentlig</option><option>Unntatt – offl. § 13 jf. sikkerhetsloven</option><option>Unntatt – offl. § 21</option><option>Unntatt – offl. § 24 tredje ledd</option></select><button class="btn" data-act="newDoc" data-arg="${pid}">Registrer</button></div>` : ""}
  <p class="note">Gradert dokument krever unntakshjemmel. Status «Godkjent»/«Arkivert» krever rollen Dokumentkontroller; arkivering tildeler saksnummer (Noark-mock).</p></div>`;
}
function bindDocs() { document.querySelectorAll(".dstat").forEach(s => s.onchange = async () => { try { await api("documents/" + s.dataset.did, { method: "PATCH", body: { status: s.value } }); toast("Dokumentstatus endret og logget"); route(); } catch (e) { toast(e.message, 1); route(); } }); }
PTAB.dokumenter = (c, d, id) => { c.innerHTML = docTable(d.dokumenter, d.skjulte_dokumenter, id); bindDocs(); };
ACT.newDoc = async pid => { try { await api("documents", { method: "POST", body: { project_id: pid, tittel: $("#dt").value, type: $("#dty").value, gradering: $("#dg").value, offentlighet: $("#doff").value } }); toast("Dokument registrert"); route(); } catch (e) { toast(e.message, 1); } };
PTAB.eba = (c, d) => { c.innerHTML = `<div class="card"><h3>EBA-objekter som berøres av prosjektet</h3><table><thead><tr><th>Objektnr</th><th>Type</th><th>Navn</th><th>Relasjon</th><th>Tilstand</th><th>Byggeår</th></tr></thead><tbody>${d.eba.map(e => `<tr class="click" data-go="#/eba/${e.id}"><td>${e.objektnr}</td><td>${e.type}</td><td>${esc(e.navn)}</td><td>${e.relasjon}</td><td>${e.tilstand || ""}</td><td>${e.byggeaar || ""}</td></tr>`).join("")}</tbody></table><p class="note">PEP lagrer kun referanse (objektnr) og relasjon. Masterdata eies av eiendoms- og FDV-registeret, slik at data ikke dupliseres.</p></div>`; };
function shaTable(xs, pid) {
  return `<div class="card"><table><thead><tr><th>Dato</th><th>Prosjekt</th><th>Type</th><th>Alvorlighet</th><th>Beskrivelse</th><th>Status</th></tr></thead><tbody>${xs.map(s => `<tr><td>${esc(s.dato)}</td><td>${esc(s.kode || "")}</td><td>${esc(s.type)}</td><td>${chip(s.alvorlighet === "Høy" ? "st-bad" : s.alvorlighet === "Middels" ? "st-warn" : "st-ok", s.alvorlighet)}</td><td>${esc(s.beskrivelse)}${s.tiltak ? `<div class="note">Tiltak: ${esc(s.tiltak)}${s.lukket_av ? ` · lukket ${esc(s.lukket_dato)} av ${esc(s.lukket_av)}` : ""}</div>` : ""}</td><td>${esc(s.status)}${s.status !== "Lukket" && can("sha.write") && !S.meta.bruker.ekstern ? `<div class="row"><input id="shat${s.id}" aria-label="Tiltak for avvik ${s.id}" placeholder="Tiltak" value="${esc(s.tiltak || "")}"><button class="btn sec" data-act="closeSha" data-arg="${s.id}">Lukk</button></div>` : ""}</td></tr>`).join("") || "<tr><td colspan=6>Ingen</td></tr>"}</tbody></table>
  ${pid && can("sha.write") ? `<div class="row" style="margin-top:8px"><select id="sty"><option>RUH</option><option>Nestenulykke</option><option>Personskade</option><option>Miljøhendelse</option></select><select id="sal"><option>Lav</option><option>Middels</option><option>Høy</option></select><input id="sb" placeholder="Beskrivelse" style="flex:1"><button class="btn" data-act="newSha" data-arg="${pid}">Registrer avvik</button></div>` : ""}</div>`;
}
PTAB.sha = (c, d, id) => { c.innerHTML = shaTable(d.sha, id); };
ACT.closeSha = async id => { try { await api("sha/" + id, { method: "PATCH", body: { status: "Lukket", tiltak: $("#shat" + id).value } }); toast("SHA-avvik lukket og logget"); route(); } catch (e) { toast(e.message, 1); } };
ACT.newSha = async pid => { try { await api("sha", { method: "POST", body: { project_id: pid, type: $("#sty").value, alvorlighet: $("#sal").value, beskrivelse: $("#sb").value || "EKSEMPEL-avvik" } }); toast("SHA-avvik registrert"); route(); } catch (e) { toast(e.message, 1); } };
PTAB.ki = async (c, d, id) => {
  const a = await api(`projects/${id}/ai`);
  c.innerHTML = `<div class="card"><h3>KI-støtte: analyse og utkast til statustekst</h3><p class="note">${esc(a.merknad)}</p><h3>Funn</h3><ul>${a.funn.map(f => `<li>${esc(f)}</li>`).join("")}</ul><h3>Utkast til statusrapport (må kvalitetssikres av prosjektleder)</h3><textarea style="width:100%;min-height:90px">${esc(a.utkast_statustekst)}</textarea></div>`;
};
/* ---------- Porteføljesider ---------- */
const isLate = x => ["Forsinket", "Passert – ikke rapportert"].includes(x.statusvurdering);
ROUTES["fremdrift"] = async m => {
  const ms = await api("portfolio/milestones"); const by = {};
  ms.forEach(x => (by[x.project_id] = by[x.project_id] || { label: x.kode + " " + x.prosjekt, start: x.pstart, end: x.pslutt, ms: [], go: "#/prosjekt/" + x.project_id + "/fremdrift" }).ms.push(x));
  const late = ms.filter(isLate);
  m.innerHTML = `<div class="row"><h1>Fremdrift – top view for alle prosjekter</h1><span class="eks">EKSEMPELDATA</span></div><p class="sub">Milepæler mot baseline. ${late.length} milepæler avviker. Klikk en rad for prosjektets fremdrift og tiltaksplan.</p>
  <div class="card">${gantt(Object.values(by))}</div>
  <div class="card" style="margin-top:14px"><h3>Avvikende milepæler</h3><table><thead><tr><th>Prosjekt</th><th>Milepæl</th><th>Baseline</th><th>Prognose</th><th class="n">Avvik (dager)</th><th>Status</th></tr></thead><tbody>${late.map(x => `<tr class="click" data-go="#/prosjekt/${x.project_id}/fremdrift"><td>${esc(x.kode)} ${esc(x.prosjekt)}</td><td>${esc(x.navn)}</td><td>${x.baseline}</td><td>${x.prognose}</td><td class="n">${Math.round((new Date(x.prognose) - new Date(x.baseline)) / 864e5)}</td><td>${chip("st-bad", x.statusvurdering)}</td></tr>`).join("")}</tbody></table></div>`;
};
ROUTES["okonomi"] = async m => {
  const [ps, u] = await Promise.all([api("projects"), api("portfolio/uncertainty")]);
  const progs = Object.entries(u.program);
  m.innerHTML = `<div class="row"><h1>Økonomi og usikkerhet – portefølje og program</h1><span class="eks">EKSEMPELDATA</span></div><p class="sub">${esc(u.portefolje.metode)}</p>
  <div class="grid g4"><div class="card kpi"><b>${nf(u.portefolje.sum_styringsrammer, 0)}</b><span>Sum styringsrammer (P50), MNOK</span></div><div class="card kpi"><b>${nf(u.portefolje.P50, 0)}</b><span>Beregnet P50 (Monte Carlo) for porteføljen, MNOK</span></div>
  <div class="card kpi"><b>${nf(u.portefolje.P85, 0)}</b><span>Beregnet P85 (Monte Carlo) for porteføljen, MNOK</span></div><div class="card kpi"><b>${nf(u.portefolje.sum_kostnadsrammer, 0)}</b><span>Sum kostnadsrammer (P85), MNOK</span></div></div>
  <div class="card" style="margin-top:14px"><h3>Usikkerhet per program (simulert P10 / P50 / P85 mot sum kostnadsrammer, MNOK)</h3>${barChart(progs.map(([k, v]) => ({ label: k.replace(" (EKS)", ""), P10: v.P10, P50: v.P50, P85: v.P85, R: v.sum_kostnadsrammer })), { w: 760, keys: ["P10", "P50", "P85", "R"], colors: ["#c9dbee", "#90b4d8", "#0b3d6b", "#e09a3a"], labels: ["P10", "P50", "P85", "Sum kostnadsrammer"] })}
  <p class="note">Summen av prosjektenes P85 er normalt høyere enn porteføljens P85, fordi ikke alle prosjekter treffer høyt samtidig. Korrelasjonen er en ANTAKELSE og kan justeres: <a href="#" data-act="rho" data-arg="0.6">ρ = 0,6</a> · <a href="#" data-act="rho" data-arg="0">ρ = 0</a></p></div>
  <div class="card" style="margin-top:14px"><h3>Prosjektøkonomi (MNOK)</h3><div class="tbl"><table id="etab"><thead><tr><th>Prosjekt</th><th>Program</th><th class="n">Styringsramme (P50)</th><th class="n">Kostnadsramme (P85)</th><th class="n">Prognose</th><th class="n">Prognose − P50</th><th>Bruk av usikkerhetsavsetning</th></tr></thead><tbody>
  ${ps.map(p => { const pct = (p.prognose - p.styringsramme) / ((p.kostnadsramme - p.styringsramme) || 1); return `<tr class="click" data-go="#/prosjekt/${p.id}/okonomi"><td>${esc(p.kode)} ${esc(p.navn)}</td><td>${esc(p.program)}</td><td class="n">${nf(p.styringsramme)}</td><td class="n">${nf(p.kostnadsramme)}</td><td class="n">${nf(p.prognose)}</td><td class="n" data-v="${p.prognose - p.styringsramme}">${nf(p.prognose - p.styringsramme)}</td><td style="width:170px" data-v="${pct}"><div class="bar ${pct > 1 ? "over" : ""}"><i style="width:${Math.max(0, Math.min(1, pct)) * 100}%"></i></div>${nf(pct * 100, 0)} %</td></tr>`; }).join("")}</tbody></table></div></div>`;
  sortable("etab");
};
ACT.rho = async r => { const u = await api("portfolio/uncertainty?rho=" + r); toast(`ρ = ${r}: P50 ${nf(u.portefolje.P50, 0)} / P85 ${nf(u.portefolje.P85, 0)} MNOK`); };
ROUTES["risiko"] = async m => {
  const r = await api("portfolio/risks"); let sel = null;
  const draw = () => {
    const list = sel ? r.risikoer.filter(x => x.s + "-" + x.k === sel) : r.risikoer;
    m.innerHTML = `<div class="row"><h1>Risiko – portefølje</h1><span class="eks">EKSEMPELDATA</span></div><p class="sub">Akkumulert risikomatrise for åpne risikoer. Drill ned fra matrise til register, og videre til prosjektets matrise med historikk.</p>
    <div class="grid g2"><div class="card"><h3>Akkumulert risikomatrise ${sel ? "(filter " + sel + ")" : ""}</h3>${matrix(r.matrise, sel)}${sel ? `<a href="#" data-act="cell" data-arg="">Vis alle</a>` : "<p class='note'>Klikk en celle for å filtrere registeret.</p>"}</div>
    <div class="card kpi"><b>${r.risikoer.length}</b><span>åpne risikoer og muligheter</span><b style="margin-top:12px">${nf(r.forventet_kost_MNOK)}</b><span>Forventet kostkonsekvens (MNOK, forenklet: kost × S/5)</span></div></div>
    <div class="card" style="margin-top:14px"><h3>Risikoregister</h3><div class="tbl"><table><thead><tr><th>Prosjekt</th><th>Program</th><th>Risiko</th><th>S</th><th>K</th><th>Score</th><th class="n">Kost MNOK</th><th>Status</th></tr></thead><tbody>
    ${list.sort((a, b) => b.s * b.k - a.s * a.k).map(x => `<tr class="click" data-go="#/prosjekt/${x.project_id}/risiko"><td>${esc(x.kode)}</td><td>${esc(x.program)}</td><td>${esc(x.tittel)}</td><td>${x.s}</td><td>${x.k}</td><td><span class="st" style="background:${riskColor(x.s * x.k)}">${x.s * x.k}</span></td><td class="n">${nf(x.kost)}</td><td>${x.status}</td></tr>`).join("")}</tbody></table></div></div>`;
  };
  ACT.cell = a => { sel = a || null; draw(); }; draw();
};
ROUTES["endringer"] = async m => {
  const [cs, ch] = await Promise.all([api("contracts"), api("changes")]);
  m.innerHTML = `<div class="row"><h1>Kontrakter og endringer</h1><span class="eks">EKSEMPELDATA</span></div><p class="sub">En kontrakt kan fordeles på flere prosjekter. Endringer følges per kontrakt og per prosjekt.</p>
  <div class="card"><h3>Kontrakter</h3><table><thead><tr><th>Nr</th><th>Navn</th><th>Leverandør</th><th>Standard</th><th class="n">Verdi MNOK</th><th>Fordeling på prosjekter</th><th class="n">Antall endr.</th><th class="n">Godkjente endr. MNOK</th></tr></thead><tbody>
  ${cs.map(c => `<tr><td>${c.kontraktsnr}</td><td>${esc(c.navn)}</td><td>${esc(c.leverandor)}</td><td>${esc(c.standard)}</td><td class="n">${mnok(c.verdi)}</td><td>${c.fordeling.map(f => `<a href="#/prosjekt/${f.id}/endringer">${f.kode}</a> ${nf(f.andel * 100, 0)} %`).join(", ")}</td><td class="n">${c.endringer[0]}</td><td class="n">${mnok(c.endringer[1])}</td></tr>`).join("")}</tbody></table></div>
  <div class="card" style="margin-top:14px"><h3>Alle endringer</h3><div class="tbl"><table id="chtab"><thead><tr><th>Nr</th><th>Prosjekt</th><th>Type</th><th>Tittel</th><th class="n">Beløp MNOK</th><th>Status</th><th>Dato</th></tr></thead><tbody>
  ${ch.map(x => `<tr class="click" data-go="#/prosjekt/${x.project_id}/endringer"><td>${x.nr}</td><td>${esc(x.kode)}</td><td>${x.type}</td><td>${esc(x.tittel)}</td><td class="n" data-v="${x.belop}">${mnok(x.belop)}</td><td>${x.status}</td><td>${x.dato}</td></tr>`).join("")}</tbody></table></div></div>`;
  sortable("chtab");
};
ROUTES["gevinster"] = async m => { const bs = await api("benefits"); m.innerHTML = `<div class="row"><h1>Gevinstrealisering</h1><span class="eks">EKSEMPELDATA</span></div><p class="sub">Gevinster med KPI, baseline, mål og måling, koblet til investeringen (prosjektet).</p>${benefitTable(bs)}`; };
ROUTES["ressurser"] = async m => {
  const rs = await api("resources");
  m.innerHTML = `<div class="row"><h1>Ressurser og kapasitet</h1><span class="eks">EKSEMPELDATA</span></div><p class="sub">Allokering på tvers av prosjekter. Over 100 % betyr overbooket.</p>
  <div class="card"><table><thead><tr><th>Ressurs</th><th>Kompetanse</th><th>Enhet</th><th>Utnyttelse</th><th>Allokert til</th></tr></thead><tbody>${rs.map(r => `<tr><td>${esc(r.navn)}</td><td>${esc(r.kompetanse)}</td><td>${esc(r.enhet)}</td><td style="width:180px"><div class="bar ${r.utnyttelse > 1 ? "over" : ""}"><i style="width:${Math.min(1, r.utnyttelse) * 100}%"></i></div>${nf(r.utnyttelse * 100, 0)} %</td><td>${r.allokeringer.map(a => `${a.kode} (${nf(a.andel * 100, 0)} %)`).join(", ")}</td></tr>`).join("")}</tbody></table></div>`;
};
ROUTES["sha"] = async m => { const xs = await api("sha"); m.innerHTML = `<div class="row"><h1>SHA-avvik – portefølje</h1><span class="eks">EKSEMPELDATA</span></div><p class="sub">${xs.filter(x => x.status === "Åpen").length} åpne avvik. Registrering skjer fra prosjektkortet, også for entreprenør.</p>${shaTable(xs)}`; };
ROUTES["dokumenter"] = async m => {
  const d = await api("documents");
  m.innerHTML = `<div class="row"><h1>Dokumenter og arkiv</h1><span class="eks">EKSEMPELDATA</span><span class="sp"></span>${can("export.noark") ? `<button class="btn" data-act="dl" data-arg="export/noark|noark_uttrekk.xml">Noark-uttrekk (XML)</button>` : ""}</div>
  <p class="sub">Dokumentstyring med revisjon, status, gradering per objekt, offentlighetsvurdering og arkivreferanse. Demoen lagrer bare metadata og sjekksum, ikke selve filinnholdet.</p>${docTable(d.dokumenter, d.skjult)}`;
  bindDocs();
};
ACT.dl = async arg => {
  const [path, fn] = arg.split("|");
  try { const r = await fetch("/api/" + path, { headers: { "X-Demo-User": S.user } }); if (!r.ok) throw new Error((await r.json()).feil); const b = await r.blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = fn; a.click(); toast("Eksport lastet ned og logget"); } catch (e) { toast(e.message, 1); }
};
ROUTES["eba"] = async (m, [id]) => {
  if (id) {
    const e = await api("eba/" + id);
    m.innerHTML = `<a href="#/eba">← EBA-register</a><div class="row"><h1>${esc(e.objektnr)} ${esc(e.navn)}</h1><span class="eks">EKSEMPELDATA</span></div><p class="sub">${e.type} · ${esc(e.base)} · Tilstand ${e.tilstand || "–"} · Byggeår ${e.byggeaar || "–"} ${e.areal ? "· " + nf(e.areal, 0) + " m²" : ""} ${e.energi ? "· " + e.energi + " kWh/m²/år" : ""} ${e.vedlikeholdsbehov ? "· Vedlikeholdsbehov " + nf(e.vedlikeholdsbehov) + " MNOK" : ""}</p>
    <div class="grid g2"><div class="card"><h3>Prosjekter som har påvirket eller påvirker objektet</h3><table><thead><tr><th>Prosjekt</th><th>Relasjon</th><th>Periode</th><th>Fase</th></tr></thead><tbody>${e.prosjekter.map(p => `<tr class="click" data-go="#/prosjekt/${p.id}"><td>${p.kode} ${esc(p.navn)}</td><td>${p.relasjon}</td><td>${p.start} – ${p.slutt}</td><td>${S.meta.faser[p.fase]}</td></tr>`).join("") || "<tr><td colspan=4>Ingen</td></tr>"}</tbody></table></div>
    <div class="card"><h3>Underliggende objekter (bygg, inventar, komponenter)</h3><table>${e.barn.map(b => `<tr class="click" data-go="#/eba/${b.id}"><td>${b.objektnr}</td><td>${b.type}</td><td>${esc(b.navn)}</td><td>${b.tilstand || ""}</td></tr>`).join("") || "<tr><td>Ingen</td></tr>"}</table>
    <h3>FDV-dokumentasjon fra prosjektene</h3><table>${e.dokumenter.map(d => `<tr><td>${d.dokumentnr}</td><td>${esc(d.tittel)}</td><td>${d.status}</td></tr>`).join("") || "<tr><td>Ingen</td></tr>"}</table>
    <p class="note">BIM-modell: oppslag mot BIM-server (mock). Tilstand og vedlikehold hentes fra FDV-systemet i produksjon.</p></div></div>`;
    return;
  }
  const es = await api("eba");
  m.innerHTML = `<div class="row"><h1>EBA-register: prosjekt ↔ eiendom, bygg, anlegg og inventar</h1><span class="eks">EKSEMPELDATA</span><span class="sp"></span><input id="eq" placeholder="Søk objekt …"><select id="ety"><option value="">Alle typer</option><option>Eiendom</option><option>Bygg</option><option>Anlegg</option><option>Inventar/teknisk komponent</option></select></div>
  <p class="sub">Referansevisning av masterdata. Klikk et objekt for prosjekthistorikk og FDV.</p>
  <div class="tbl"><table id="etab2"><thead><tr><th>Objektnr</th><th>Type</th><th>Navn</th><th>Base</th><th>Tilstand</th><th class="n">Byggeår</th><th class="n">Vedl.behov MNOK</th><th>Prosjekter</th></tr></thead><tbody>
  ${es.map(e => `<tr class="click" data-go="#/eba/${e.id}" data-ty="${e.type}"><td>${e.objektnr}</td><td>${e.type}</td><td>${esc(e.navn)}</td><td>${esc(e.base)}</td><td>${e.tilstand || ""}</td><td class="n">${e.byggeaar || ""}</td><td class="n">${e.vedlikeholdsbehov ? nf(e.vedlikeholdsbehov) : ""}</td><td>${e.prosjekter.map(p => p.kode + " (" + p.relasjon + ")").join(", ")}</td></tr>`).join("")}</tbody></table></div>`;
  sortable("etab2");
  const f = () => { const q = $("#eq").value.toLowerCase(), t = $("#ety").value; document.querySelectorAll("#etab2 tbody tr").forEach(r => r.style.display = (!t || r.dataset.ty === t) && (!q || r.textContent.toLowerCase().includes(q)) ? "" : "none"); };
  $("#eq").oninput = f; $("#ety").onchange = f;
};
ROUTES["erfaringer"] = async m => {
  m.innerHTML = `<div class="row"><h1>Erfaringsdatabase</h1><span class="eks">EKSEMPELDATA</span><span class="sp"></span><input id="lq" placeholder="Søk (f.eks. fdv, samspill)"><button class="btn sec" data-act="lsearch">Søk</button></div><p class="sub">Strukturert etter kategori og fase, med anbefalt tiltak og oppfølging av om tiltaket faktisk er gjennomført.</p><div id="lres"></div>
  ${can("lesson.write") ? `<div class="card" style="margin-top:14px"><h3>Registrer erfaring</h3><div class="form"><label>Tittel</label><input id="lt"><label>Kategori</label><select id="lk"><option>Teknisk</option><option>Kontrakt</option><option>Behov</option><option>Dokumentasjon</option><option>Sikkerhet</option><option>Marked</option></select><label>Erfaring</label><textarea id="ltx"></textarea><label>Anbefalt tiltak</label><input id="lti"><label>Stikkord</label><input id="ltg"></div><button class="btn" data-act="newLesson" style="margin-top:8px">Lagre</button></div>` : ""}`;
  ACT.lsearch();
};
ACT.lsearch = async () => {
  const q = $("#lq") ? $("#lq").value : ""; const ls = await api("lessons?q=" + encodeURIComponent(q));
  $("#lres").innerHTML = `<div class="card"><table><thead><tr><th>Erfaring</th><th>Kategori</th><th>Fase</th><th>Prosjekt</th><th>Tiltak</th><th>Tiltaksstatus</th><th>Stikkord</th></tr></thead><tbody>${ls.map(l => `<tr><td><b>${esc(l.tittel)}</b><div class="note">${esc(l.tekst)}</div></td><td>${esc(l.kategori)}</td><td>${esc(l.fase)}</td><td>${esc(l.kode || "")}</td><td>${esc(l.tiltak)}</td><td>${esc(l.tiltak_status)}</td><td>${esc(l.tags)}</td></tr>`).join("") || "<tr><td colspan=7>Ingen treff</td></tr>"}</tbody></table></div>`;
};
ACT.newLesson = async () => { try { await api("lessons", { method: "POST", body: { tittel: $("#lt").value || "Ny erfaring (EKSEMPEL)", kategori: $("#lk").value, tekst: $("#ltx").value, tiltak: $("#lti").value, tags: $("#ltg").value } }); toast("Erfaring lagret"); route(); } catch (e) { toast(e.message, 1); } };
ROUTES["rapporter"] = async m => {
  const ps = await api("projects");
  m.innerHTML = `<div class="row"><h1>Rapporter, eksport og scenarioanalyse</h1><span class="eks">EKSEMPELDATA</span></div>
  <div class="grid g3"><div class="card"><h3>Porteføljerapport til ledelse og departement</h3><p>Automatisk generert og utskriftsvennlig rapport (HTML til PDF). Tar bare med prosjekter du har tilgang til, og viser høyeste gradering i innholdet.</p>${can("report") ? `<button class="btn" data-act="report">Åpne rapport</button>` : "<p class='note'>Krever rapport-rettighet.</p>"}</div>
  <div class="card"><h3>Eksport</h3><p>CSV for analyse og datafabrikk (semikolon, UTF-8).</p><button class="btn sec" data-act="dl" data-arg="export/portfolio.csv|portefolje.csv">Porteføljeliste (CSV)</button>
   <p style="margin-top:10px">Dataflytpakke filtrert på gradering, med SHA-256-manifest for overføring via godkjent mekanisme:</p><button class="btn sec" data-act="dl" data-arg="export/package?maks=0|dataflytpakke_ugradert.json">Pakke – kun UGRADERT</button></div>
  <div class="card"><h3>Exit og dataportabilitet</h3><p>Full eksport av alle tabeller og skjema i åpent format (JSON). Krever rollen Systemforvalter.</p><button class="btn sec" data-act="dl" data-arg="export/full|pep_full_eksport.json">Full eksport (JSON)</button></div></div>
  <div class="card" style="margin-top:14px"><h3>Scenarioanalyse: investeringsvalg mot årlig ramme</h3>${can("scenario") ? `<div class="row"><label>Årlig ramme (MNOK) <input id="sram" type="number" value="1500" style="width:100px"></label><button class="btn" data-act="scenario">Beregn</button><span class="note">Huk av prosjektene som skal inngå i scenarioet.</span></div>
   <div class="tbl" style="max-height:260px;margin-top:8px"><table>${ps.map(p => `<tr><td><input type="checkbox" class="scp" value="${p.id}" ${p.status !== "Rød" ? "checked" : ""}></td><td>${esc(p.kode)} ${esc(p.navn)}</td><td>${st(p.status)}</td><td>Prioritet ${p.prioritet}</td><td class="n">${nf(p.styringsramme)}</td></tr>`).join("")}</table></div><div id="scres"></div>` : "<p class='note'>Krever rollen Prosjekteier, Porteføljeforvalter eller Avdelingsdirektør.</p>"}</div>`;
};
ACT.report = async () => { try { const h = await api("report/portfolio"); const w = window.open("", "_blank"); if (w) { w.document.write(h); w.document.close(); } else modal(h); } catch (e) { toast(e.message, 1); } };
ACT.scenario = async () => {
  const sel = [...document.querySelectorAll(".scp:checked")].map(x => +x.value);
  try {
    const r = await api("scenario", { method: "POST", body: { prosjekter: sel, arsramme_MNOK: +$("#sram").value } });
    const items = Object.entries(r.aar).map(([y, v]) => ({ label: y, v, R: r.ramme }));
    $("#scres").innerHTML = `<h3>Årlig budsjettbehov mot ramme</h3>${barChart(items, { w: 760, keys: ["v", "R"], colors: ["#1f5f99", "#e09a3a"], labels: ["Budsjettbehov valgte prosjekter (MNOK)", "Årlig ramme"] })}<p>${Object.keys(r.over_ramme).length ? "Over ramme: " + Object.entries(r.over_ramme).map(([y, v]) => `${y} (+${nf(v)} MNOK)`).join(", ") : "Innenfor ramme alle år."} ${r.usikkerhet ? `Usikkerhet i scenarioet: P50 ${nf(r.usikkerhet.P50, 0)} / P85 ${nf(r.usikkerhet.P85, 0)} MNOK.` : ""}</p>`;
  } catch (e) { toast(e.message, 1); }
};
ROUTES["revisjon"] = async m => {
  const [a, v] = await Promise.all([api("audit"), api("audit/verify")]);
  m.innerHTML = `<div class="row"><h1>Revisjonslogg</h1><span class="sp"></span><button class="btn sec" data-act="dl" data-arg="audit/export.jsonl|revisjonslogg.jsonl">Eksport til SIEM (JSONL)</button></div>
  <p class="sub">Append-only, hash-kjedet logg (SHA-256) over alle endringer, beslutninger, eksporter og lesing av graderte objekter. Integritet: ${chip(v.ok ? "st-ok" : "st-bad", v.ok ? "OK – " + v.kontrollert + " poster verifisert" : "BRUDD ved post " + v.brudd_ved_id)}</p>
  <div class="card tbl"><table><thead><tr><th>#</th><th>Tid</th><th>Bruker</th><th>Rolle</th><th>Handling</th><th>Objekt</th><th>Detaljer</th><th>Hash</th></tr></thead><tbody>${a.map(x => `<tr><td>${x.id}</td><td>${x.ts}</td><td>${esc(x.bruker)}</td><td>${esc(x.rolle)}</td><td>${esc(x.handling)}</td><td>${esc(x.objekt)} ${esc(x.objekt_id)}</td><td class="mono">${esc(String(x.detaljer).slice(0, 220))}</td><td class="mono" title="${x.hash}">${x.hash.slice(0, 10)}…</td></tr>`).join("")}</tbody></table></div>`;
};
ROUTES["admin"] = async m => {
  const ints = await api("integrations"); const mx = S.meta.rettighetsmatrise; const perms = [...new Set(Object.values(mx).flat())].sort();
  m.innerHTML = `<h1>Tilgang, integrasjoner og plattform</h1>
  <div class="grid g2"><div class="card"><h3>Plattform og gradering</h3><table><tr><td>Instans</td><td>${esc(S.meta.plattform.navn)}</td></tr><tr><td>Maks gradering på plattformen</td><td>${grad(S.meta.plattform.maks)}</td></tr><tr><td>Din klarering</td><td>${grad(S.meta.bruker.klarering)}</td></tr><tr><td>Need-to-know</td><td>${S.meta.bruker.alle_prosjekter ? "Porteføljetilgang (alle prosjekter innen klarering)" : "Kun prosjekter du er medlem av (" + S.meta.bruker.prosjekter.length + ")"}</td></tr><tr><td>Ekstern bruker</td><td>${S.meta.bruker.ekstern ? "Ja – økonomi, risiko, gevinst og ressurs er skjult" : "Nei"}</td></tr></table>
   <p class="note">Samme kodebase kjører på ugradert, lukket og gradert plattform (miljøvariabel PEP_PLATFORM). Ingen eksterne avhengigheter, CDN-er eller kall ut av nettet. I produksjon: Entra ID (ugradert) eller lokal IdP (gradert). Forsvarsbygg eier tilgangsstyringen.</p></div>
   <div class="card"><h3>Oppslag i historisk base (føderert, ingen kopi)</h3><div class="row"><input id="href" value="PP-2019-0042"><button class="btn sec" data-act="hist">Slå opp</button></div><div id="hres" class="note">Prøv PP-2019-0042 eller OM-2022-0007.</div></div></div>
  <div class="card" style="margin-top:14px"><h3>Rettighetsmatrise (RBAC – demo)</h3><div class="tbl"><table><thead><tr><th>Rolle</th>${perms.map(p => `<th style="font-size:10px">${p}</th>`).join("")}</tr></thead><tbody>${Object.entries(mx).map(([r, ps]) => `<tr><td>${r}</td>${perms.map(p => `<td style="text-align:center">${ps.includes(p) ? "●" : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>
  <div class="card" style="margin-top:14px"><h3>Integrasjons- og API-katalog</h3><table><thead><tr><th>System</th><th>Dataflyt</th><th>Protokoll</th><th>Demo-endepunkt</th><th>Kilde i underlaget</th></tr></thead><tbody>${ints.map(i => `<tr><td><b>${esc(i.navn)}</b></td><td>${esc(i.retning)}</td><td>${esc(i.protokoll)}</td><td>${i.endepunkt ? `<a href="#" data-act="tryapi" data-arg="${esc(i.endepunkt)}">${esc(i.endepunkt)}</a>` : "–"}</td><td class="note">${esc(i.kilde)}</td></tr>`).join("")}</tbody></table>
  <p class="note">Alle data i PEP er tilgjengelige via REST/JSON (/api/...). Se README for full endepunktliste.</p></div>`;
};
ACT.hist = async () => { try { const h = await api("historikk/lookup?ref=" + encodeURIComponent($("#href").value)); $("#hres").innerHTML = `<pre class="mono">${esc(JSON.stringify(h, null, 1))}</pre>`; } catch (e) { $("#hres").textContent = e.message; } };
ACT.tryapi = async ep => { try { const r = await fetch(ep, { headers: { "X-Demo-User": S.user } }); const t = await r.text(); modal(`<h3>${esc(ep)}</h3><pre class="mono" style="white-space:pre-wrap">${esc(t.slice(0, 4000))}</pre>`); } catch (e) { toast(e.message, 1); } };

init();
