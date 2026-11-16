/* DEMO-modus for PEP-prototypen (U-26-03).
 * Ingen server: alle /api/-kall besvares fra demo-data.json (forhåndsgenerert fra fiktive EKSEMPELDATA).
 * Endringer lagres bare i nettleserens localStorage. Ingen innlogging, ingen hemmeligheter, ingen ekte data. */
"use strict";
(function () {
  const KEY = "pepDemoOps.v1";
  const realFetch = window.fetch.bind(window);
  const DATA = realFetch("demo-data.json", { cache: "no-cache" }).then(r => r.json());
  const parsed = {};
  const loadOps = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } };
  const saveOps = ops => localStorage.setItem(KEY, JSON.stringify(ops));
  const today = () => new Date().toISOString().slice(0, 10);
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
  const KIND = {
    risks: o => "s" in o && "k" in o && "tittel" in o,
    changes: o => "nr" in o && "belop" in o && "tittel" in o,
    documents: o => "dokumentnr" in o,
    sha: o => "alvorlighet" in o,
    lessons: o => "tiltak_status" in o || ("tags" in o && "tekst" in o),
    projects: o => "kode" in o && "styringsramme" in o,
    milestones: o => "baseline" in o && "navn" in o && "prognose" in o,
  };
  function walk(x, fn) { if (Array.isArray(x)) { fn(x); x.forEach(v => walk(v, fn)); } else if (x && typeof x === "object") Object.values(x).forEach(v => walk(v, fn)); }
  function walkObj(x, fn) { if (Array.isArray(x)) x.forEach(v => walkObj(v, fn)); else if (x && typeof x === "object") { fn(x); Object.values(x).forEach(v => walkObj(v, fn)); } }
  function msStatus(o) { if (o.faktisk) return o.faktisk <= o.baseline ? "Nådd" : "Nådd forsinket"; return (o.prognose || "") <= o.baseline ? "Iht. plan" : "Forsinket"; }
  function applyOps(j) {
    for (const op of loadOps()) {
      const sig = KIND[op.kind]; if (!sig) continue;
      if (op.t === "patch") walkObj(j, o => { if (o.id == op.id && sig(o)) { Object.assign(o, op.body); if (op.kind === "milestones") o.statusvurdering = msStatus(o); } });
      walk(j, arr => {
        if (op.t === "add" && arr.length && arr[0] && typeof arr[0] === "object" && sig(arr[0]) && !arr.some(o => o && o.id === op.obj.id)) {
          const pids = new Set(arr.map(o => o.project_id));
          if (op.obj.project_id === undefined || !("project_id" in arr[0]) || pids.size > 1 || pids.has(+op.obj.project_id)) {
            const tpl = {}; Object.keys(arr[0]).forEach(k => tpl[k] = typeof arr[0][k] === "number" ? null : ""); arr.unshift(Object.assign(tpl, op.obj));
          }
        }
      });
    }
    return j;
  }
  function addOp(op) { const ops = loadOps(); ops.push(op); saveOps(ops); }
  function nextId() { const n = +(localStorage.getItem(KEY + ".id") || 90000) + 1; localStorage.setItem(KEY + ".id", n); return n; }
  async function handleWrite(d, user, method, path, body) {
    const uname = (() => { try { return JSON.parse(d.blobs[d.idx[user].meta].b).bruker.navn; } catch (e) { return "Demo-bruker"; } })();
    const P = path.split("?")[0].split("/");
    const coll = P[0], id = P[1];
    if (method === "PATCH" && KIND[coll] && id) { addOp({ t: "patch", kind: coll, id: +id, body }); const o = Object.assign({ id: +id }, body); if (coll === "milestones") o.statusvurdering = msStatus(Object.assign({ baseline: "9999-12-31" }, body)); return json(o); }
    if (method === "POST" && KIND[coll] && !id) {
      const nid = nextId();
      const base = { id: nid, dato: today(), registrert_av: uname, status: coll === "sha" ? "Åpen" : (coll === "changes" ? "Varslet" : (coll === "documents" ? "Under arbeid" : "Åpen")), gradering: 0 };
      const obj = Object.assign(base, body);
      ["project_id", "s", "k", "kost", "gradering", "belop", "dager", "program_id", "styringsramme", "kostnadsramme"].forEach(k => { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") obj[k] = +obj[k]; });
      if (coll === "changes") obj.nr = "DEMO-" + nid;
      if (coll === "documents") { obj.dokumentnr = "DEMO-" + nid; obj.revisjon = "A"; }
      if (coll === "risks") { obj.score = obj.s * obj.k; obj.eier = uname; obj.kategori = obj.kategori || "Annet"; obj.status = "Åpen"; }
      if (coll === "projects") { obj.status = "Grønn"; obj.fase = 0; obj.prognose = obj.styringsramme; obj.region = "–"; obj.type = "Bygg"; obj.navn = (obj.navn || "Nytt prosjekt") + " (DEMO)"; }
      addOp({ t: "add", kind: coll, obj });
      return json(obj, 201);
    }
    if (method === "POST" && coll === "projects" && P[2] === "phase") {
      const pj = JSON.parse(d.blobs[d.idx[user]["projects/" + id]].b).prosjekt;
      if (body.beslutning === "Godkjent") addOp({ t: "patch", kind: "projects", id: +id, body: { fase: Math.min(5, (pj.fase || 0) + 1) } });
      return json({ ok: true, demo: true });
    }
    if (method === "POST" && coll === "scenario") {
      const years = {};
      (body.prosjekter || []).forEach(pid => Object.entries(d.budget[pid] || {}).forEach(([y, v]) => years[y] = (years[y] || 0) + v / 1e6));
      Object.keys(years).forEach(y => years[y] = Math.round(years[y] * 10) / 10);
      const ramme = body.arsramme_MNOK || 2000, over = {};
      Object.entries(years).forEach(([y, v]) => { if (v > ramme) over[y] = Math.round((v - ramme) * 10) / 10; });
      return json({ aar: years, ramme, over_ramme: over, usikkerhet: null });
    }
    if (method === "POST" && (coll === "actionplans")) return json({ ok: true, demo: true, merknad: "Tiltaksplaner lagres ikke i demoen" });
    return json({ feil: "Denne handlingen er ikke tilgjengelig i demoen (krever server)." }, 501);
  }
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input.url;
    const u = new URL(url, location.href);
    const i = u.pathname.indexOf("/api/");
    if (i < 0) return realFetch(input, init);
    const d = await DATA;
    const hdr = (init && init.headers) || {};
    const user = String(hdr["X-Demo-User"] || 2);
    const method = ((init && init.method) || "GET").toUpperCase();
    let path = u.pathname.slice(i + 5) + u.search;
    if (method !== "GET") { let body = {}; try { body = JSON.parse((init && init.body) || "{}"); } catch (e) {} return handleWrite(d, user, method, path, body); }
    const map = d.idx[user]; if (!map) return json({ feil: "Ukjent demo-bruker" }, 401);
    let q = null;
    if (path.startsWith("lessons?")) { q = (u.searchParams.get("q") || "").toLowerCase(); path = "lessons?q="; }
    if (path.startsWith("historikk/lookup") && !map[path]) return json({ feil: "Ingen treff i demoen. Prøv PP-2019-0042 eller OM-2022-0007." }, 404);
    const h = map[path];
    if (!h) return json({ feil: "Ikke tilgjengelig i demoen" }, 404);
    const b = d.blobs[h];
    let text = b.b;
    if (b.s === 200 && b.ct.includes("application/json")) {
      let j = JSON.parse(text); j = applyOps(j);
      if (q !== null && Array.isArray(j)) j = j.filter(o => JSON.stringify(o).toLowerCase().includes(q));
      text = JSON.stringify(j);
    }
    return new Response(text, { status: b.s, headers: { "Content-Type": b.ct } });
  };
  document.addEventListener("DOMContentLoaded", () => {
    const r = document.getElementById("demoreset");
    if (r) r.onclick = () => { localStorage.removeItem(KEY); localStorage.removeItem(KEY + ".id"); localStorage.removeItem("pepUser"); location.hash = "#/"; location.reload(); };
  });
})();
