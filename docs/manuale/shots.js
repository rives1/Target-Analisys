// Genera le schermate del manuale con l'app reale (Playwright + Chrome): node docs/manuale/shots.js [filtro]
// Uso completo: docs/manuale/build.sh
const { chromium } = require("playwright");
const path = require("path");
const { pathToFileURL } = require("url");
const fs = require("fs");
const OUT = path.join(__dirname, "img") + path.sep;
const APP = pathToFileURL(path.join(__dirname, "..", "..", "src", "index.html")).href;
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
let page;
const want = n => !only || only.test(n);
async function shotEl(sel, name, opts = {}) { if (!want(name)) return; const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await page.waitForTimeout(opts.wait || 150); await l.screenshot({ path: OUT + name + ".png" }); }
async function shotPage(name, clip) { if (!want(name)) return; await page.waitForTimeout(200); await page.screenshot({ path: OUT + name + ".png", ...(clip ? { clip } : {}) }); }
const ev = (f, a) => page.evaluate(f, a);
async function key(k) { await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press(k); }
async function scr(p) { return ev(p => { const s = window.__SA.toScreen(p), r = document.getElementById("canvas").getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y }; }, p); }

// ---------- foto sintetica realistica: 320 × 240 mm a 5 px/mm ----------
function makeTarget() {
  const W = 1600, H = 1200, K = 5;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  // carta con luce non uniforme
  const gr = g.createRadialGradient(W * 0.45, H * 0.4, 100, W / 2, H / 2, W * 0.75); gr.addColorStop(0, "#f6f3ea"); gr.addColorStop(1, "#d9d4c6");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.035})`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
  // griglia stampata ogni 10 mm
  g.strokeStyle = "rgba(60,90,140,.18)"; g.lineWidth = 1;
  for (let x = 100; x <= 1500; x += 10 * K) { g.beginPath(); g.moveTo(x + .5, 100); g.lineTo(x + .5, 1000); g.stroke(); }
  for (let y = 100; y <= 1000; y += 10 * K) { g.beginPath(); g.moveTo(100, y + .5); g.lineTo(1500, y + .5); g.stroke(); }
  // tre visuel con anelli ogni 10 mm, nero fino a 30 mm di raggio
  const V = [[400, 450], [800, 450], [1200, 450]];
  for (const [cx, cy] of V) {
    g.fillStyle = "#1b1b1b"; g.beginPath(); g.arc(cx, cy, 25 * K, 0, 7); g.fill();
    for (let r = 10; r <= 40; r += 10) { g.strokeStyle = r <= 20 ? "#cfcfcf" : "#222"; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r * K, 0, 7); g.stroke(); }
    g.strokeStyle = r => 0; g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 25, cy); g.lineTo(cx + 25, cy); g.moveTo(cx, cy - 25); g.lineTo(cx, cy + 25); g.stroke();
  }
  // righello da 200 mm in basso
  g.fillStyle = "#222"; g.font = "bold 26px Arial";
  g.fillRect(300, 1080, 1000, 3);
  for (let mm = 0; mm <= 200; mm += 5) { const x = 300 + mm * K, h = mm % 50 === 0 ? 40 : mm % 10 === 0 ? 24 : 12; g.fillRect(x - 1, 1080 - h, 3, h); if (mm % 50 === 0) g.fillText(String(mm), x - 14, 1130); }
  g.fillText("mm", 1320, 1130);
  g.font = "bold 34px Arial"; g.fillText("100 m · .308 Win", 110, 80);
  return { c, V, K };
}

const GROUPS = [
  { name: "Gruppo 1 · 44,0 gr", v: 0, off: [21, 9], sd: 3.2, n: 5, charge: "44.0", temp: "14" },
  { name: "Gruppo 2 · 44,5 gr", v: 1, off: [18, 12], sd: 2.3, n: 5, charge: "44.5", temp: "15" },
  { name: "Gruppo 3 · 45,0 gr", v: 2, off: [20, 18], sd: 3.6, n: 5, charge: "45.0", temp: "16" },
];

(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true });
  page = await ctx.newPage();
  page.on("pageerror", e => console.log("ERR", e.message));
  await page.goto(APP);
  await page.waitForFunction(() => window.__SA);
  await ev(() => { window.showSaveFilePicker = undefined; localStorage.clear(); });
  if (want("00_vuota")) await shotPage("00_vuota");
  // foto
  const dataUrl = await page.evaluate(`(${makeTarget.toString()})().c.toDataURL("image/jpeg", 0.92)`);
  await page.setInputFiles("#fImg", { name: "bersaglio_100m.jpg", mimeType: "image/jpeg", buffer: Buffer.from(dataUrl.split(",")[1], "base64") });
  await page.waitForFunction(() => window.__SA.state.image);
  await key("l");
  await page.waitForTimeout(300);
  await shotPage("01_foto_caricata");
  // calibrazione sul righello: 0 e 200 mm
  await ev(() => document.querySelectorAll("#side details").forEach(d => { d.open = d.id === "sec-calib"; }));
  await key("2");
  const a = await scr({ x: 300, y: 1060 }); await page.mouse.click(a.x, a.y);
  const bpt = await scr({ x: 1200, y: 1060 }); await page.mouse.move(bpt.x - 40, bpt.y); await page.waitForTimeout(150);
  await shotPage("02_scala_primo_punto");
  await page.mouse.click(bpt.x, bpt.y);
  await ev(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input")); e.dispatchEvent(new Event("change")); }; set("calDist", "180"); set("calUnit", "mm"); });
  await page.waitForTimeout(200);
  await shotEl("#sec-calib", "03_sezione_scala");
  // parametri
  await ev(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input")); e.dispatchEvent(new Event("change")); };
    set("shotDist", "100"); set("clickVal", "0.1"); set("clickUnit", "MIL");
    const sel = document.getElementById("caliberPreset"); const o = [...sel.options].find(o => /\.308/.test(o.textContent)); if (o) { sel.value = o.value; sel.dispatchEvent(new Event("change")); document.getElementById("caliber").dispatchEvent(new Event("input")); } });
  // gruppi con mira e fori
  await ev(({ GROUPS }) => {
    const S = window.__SA, st = S.state; let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const V = [[400, 450], [800, 450], [1200, 450]], K = 5, cols = ["#2563eb", "#db2777", "#16a34a"];
    st.groups = GROUPS.map((G, i) => { const [cx, cy] = V[G.v];
      const shots = Array.from({ length: G.n }, (_, k) => ({ id: 1000 + i * 100 + k, x: cx + (G.off[0] + G.sd * gauss()) * K, y: cy - (G.off[1] + G.sd * gauss()) * K, dv: 0, dh: 0 }));
      return { id: 10 + i, name: G.name, color: cols[i], dist: 100, poa: { x: cx, y: cy }, shots,
        load: { date: "2026-11-15", case: "Lapua (3ª ricarica)", powder: "Vihtavuori N140", charge: G.charge, bullet: "Sierra MatchKing 168 gr", jump: "0.020", jumpUnit: "in", primer: "CCI BR2",
          weather: "Sereno", temp: G.temp, humidity: "60", pressure: "1015", wind: "3", windUnit: "m/s", windDir: "3", shotsTotal: "5", foulers: "2", notes: "" } }; });
    st.activeGroupId = 11; S.commit();
  }, { GROUPS });
  // disegno dei fori sulla foto (fori veri nella foto)
  await ev(async () => {
    const S = window.__SA, st = S.state, c = document.createElement("canvas"); c.width = st.image.w; c.height = st.image.h; const g = c.getContext("2d");
    g.drawImage(st.image.bitmap, 0, 0);
    for (const gr of st.groups) for (const s of gr.shots) {
      const d = g.getImageData(Math.round(s.x), Math.round(s.y), 1, 1).data, dark = d[0] < 100;
      g.fillStyle = dark ? "#e8e4da" : "#262626"; g.beginPath(); g.arc(s.x, s.y, 19, 0, 7); g.fill();
      g.strokeStyle = dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.35)"; g.lineWidth = 3; g.beginPath(); g.arc(s.x, s.y, 21, 0, 7); g.stroke();
    }
    const groups = JSON.parse(JSON.stringify(st.groups)), calib = JSON.parse(JSON.stringify(st.calib)), act = st.activeGroupId;
    await S.setImage("bersaglio_100m.jpg", c.toDataURL("image/jpeg", 0.92));
    st.groups = groups; st.calib = calib; st.activeGroupId = act; S.commit(); S.fitView();
  });
  await key("1"); await page.mouse.move(1430, 890);
  await ev(() => { document.querySelectorAll("#side details").forEach(d => { d.open = ["sec-results"].includes(d.id); }); });
  await page.waitForTimeout(700);
  await shotPage("04_panoramica");
  // zoom sul gruppo 2
  const zoomTo = async (cx, cy, z) => ev(({ cx, cy, z }) => { const S = window.__SA, v = S.state.view, cv = document.getElementById("canvas"), r = cv.getBoundingClientRect();
    v.scale = z; v.ox = r.width / 2 - cx * z; v.oy = r.height / 2 - cy * z; document.getElementById("canvas").dispatchEvent(new Event("pointerleave")); }, { cx, cy, z });
  await zoomTo(850, 400, 1.05); await page.waitForTimeout(300);
  // mira: croce estesa
  await key("3");
  const m = await scr({ x: 805, y: 455 }); await page.mouse.move(m.x, m.y); await page.waitForTimeout(250);
  await shotPage("05_mira_croce", { x: 0, y: 0, width: 905, height: 900 });
  // fori: tooltip e pannello live
  await key("1");
  const sh = await ev(() => window.__SA.state.groups[1].shots[2]); const hs = await scr(sh);
  await page.mouse.move(hs.x, hs.y); await page.waitForTimeout(300);
  await shotPage("06_tooltip_live", { x: 0, y: 0, width: 905, height: 900 });
  await page.mouse.move(5, 890);
  // correzione virtuale
  await ev(() => window.__SA.toggleVirtCorr(true)); await page.waitForTimeout(300);
  await ev(() => { const t = document.getElementById("toast"); t.classList.remove("show"); });
  await shotPage("07_correzione_virtuale", { x: 0, y: 0, width: 905, height: 900 });
  await ev(() => window.__SA.toggleVirtCorr(false));
  // ellisse, hull, heatmap, griglia
  await ev(() => { document.getElementById("hullOn").checked = true; document.getElementById("hullOn").dispatchEvent(new Event("change")); });
  await ev(() => { window.__SA.state.activeGroupId = 10; window.__SA.commit(); }); await zoomTo(505, 405, 2.4); await page.waitForTimeout(300);
  await shotPage("08_ellisse_hull", { x: 0, y: 100, width: 905, height: 700 });
  await ev(() => { const h = document.getElementById("heatOn"); h.checked = true; h.dispatchEvent(new Event("change")); });
  await page.waitForTimeout(400); await shotPage("09_heatmap", { x: 0, y: 100, width: 905, height: 700 });
  await ev(() => { const h = document.getElementById("heatOn"); h.checked = false; h.dispatchEvent(new Event("change")); const k = document.getElementById("hullOn"); k.checked = false; k.dispatchEvent(new Event("change")); });
  await ev(() => { window.__SA.state.activeGroupId = 11; window.__SA.commit(); });
  await page.click("#bGrid"); await zoomTo(810, 420, 1.6); await page.waitForTimeout(300);
  await shotPage("10_griglia", { x: 0, y: 0, width: 905, height: 900 }); await page.click("#bGrid");
  // sezioni del pannello: finestra alta, niente piede e toast sopra le sezioni
  await page.setViewportSize({ width: 1440, height: 2600 });
  await ev(() => { document.getElementById("sideFoot").style.display = "none"; document.getElementById("toast").style.visibility = "hidden"; });
  const openOnly = async id => { await ev(id => document.querySelectorAll("#side details").forEach(d => { d.open = d.id === id; }), id); await page.waitForTimeout(250); };
  await openOnly("sec-params"); await shotEl("#sec-params", "11_parametri");
  await openOnly("sec-groups"); await shotEl("#sec-groups", "12_gruppi");
  await openOnly("sec-load"); await page.fill("#ldProfName", ""); await page.click("#bProfSave"); await page.waitForTimeout(200); await shotEl("#sec-load", "13_ricarica");
  await openOnly("sec-results"); await shotEl("#results .res", "14_risultati");
  await ev(() => document.querySelectorAll('#results .rc-more').forEach((d, i) => { if (i < 3) d.open = true; })); await shotEl('#results .res', "15_risultati_dettagli");
  await openOnly("sec-points"); await ev(() => document.documentElement.style.setProperty("--side-w", "760px")); await page.waitForTimeout(200);
  await shotEl("#sec-points", "16_tabella_punti"); await ev(() => document.documentElement.style.removeProperty("--side-w"));
  await openOnly("sec-orient"); await shotEl("#sec-orient", "17_orientamento");
  await openOnly("sec-data"); await shotEl("#sec-data", "18_dati");
  // punteggio
  await openOnly("sec-score");
  await ev(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input")); e.dispatchEvent(new Event("change")); }; set("scoreTarget", "custom"); set("scoreD10", "20"); set("scoreStep", "10"); });
  await page.waitForTimeout(300); await shotEl("#sec-score", "19_punteggio");
  await zoomTo(860, 420, 1.5); await page.waitForTimeout(300); await shotPage("20_anelli", { x: 0, y: 0, width: 905, height: 900 });
  await ev(() => { const e = document.getElementById("scoreTarget"); e.value = "none"; e.dispatchEvent(new Event("input")); e.dispatchEvent(new Event("change")); });
  // probabilità
  await openOnly("sec-hit"); await shotEl("#sec-hit", "21_probabilita");
  // calibrazione qualità
  await openOnly("sec-calib"); await shotEl("#calStatus", "22_semaforo");
  // ritaglio
  await page.setViewportSize({ width: 1440, height: 900 });
  await ev(() => { document.getElementById("sideFoot").style.display = ""; document.getElementById("toast").style.visibility = ""; });
  await openOnly("sec-orient"); await page.click("#bCrop"); await zoomTo(800, 600, 0.55); await page.waitForTimeout(200);
  const c1 = await scr({ x: 150, y: 150 }), c2 = await scr({ x: 1450, y: 1150 });
  await page.mouse.move(c1.x, c1.y); await page.mouse.down(); await page.mouse.move(c2.x, c2.y, { steps: 5 }); await page.mouse.up();
  await shotPage("23_ritaglio", { x: 0, y: 0, width: 905, height: 900 }); await key("Escape");
  // densità compatta e layout
  await openOnly("sec-results"); await page.selectOption("#densSel", "compact"); await shotEl("#results .res", "24_compatta"); await page.selectOption("#densSel", "standard");
  await page.click("#bLayout"); await shotEl("#layoutPop", "25_layout"); await page.click("#bLayClose");
  // Result Card
  if (want("26_result_card")) { await ev(() => { document.getElementById("cardScope").value = "all"; });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#bCardPng")]); fs.copyFileSync(await dl.path(), OUT + "26_result_card.png"); }
  // storico per confronto, dope e cono: sessioni a 200 e 300 m
  await ev(async () => {
    const S = window.__SA, base = S.buildSession(false), files = [];
    const mk = (dist, dv, k, date, shift) => { const s = JSON.parse(JSON.stringify(base)); s.savedAt = date + "T10:00:00Z"; s.sessionId = "x" + dist + date;
      s.groups = s.groups.slice(0, 2).map((g, i) => ({ ...g, id: g.id + dist + i, dist, name: `${dist} m · ${g.name.split("·")[1].trim()}`,
        shots: g.shots.map(p => ({ ...p, x: g.poa.x + (p.x - g.poa.x) * k + shift, y: g.poa.y + (p.y - g.poa.y) * k + shift * 0.4, dv: dv, dh: 1 })), load: { ...g.load, date } }));
      return new File([JSON.stringify(s)], `s${dist}.json`, { type: "application/json" }); };
    files.push(mk(200, 6, 1.6, "2026-10-20", 10), mk(300, 14, 2.4, "2026-10-28", 20), mk(100, 0, 1.1, "2026-10-05", 4));
    await S.importHistory(files);
  });
  // vista grafici
  await key("a"); await page.waitForFunction(() => window.__SA.anaOpen()); await page.waitForTimeout(800);
  await ev(() => { document.getElementById("toast").classList.remove("show"); }); await page.waitForTimeout(300);
  await shotPage("30_vista_grafici");
  for (const [sel, n] of [["#chScatter", "31_dispersione"], ["#chHist", "32_istogramma"], ["#chClock", "33_orologio"], ["#chPolar", "34_polare"], ["#ch3d", "35_densita3d"], ["#chQQ", "36_qq"]])
    await shotEl(`#charts > div:has(${sel})`, n).catch(async () => shotEl(sel, n));
  await ev(() => { document.querySelector(".ana-head").style.position = "static"; });
  await shotEl("#cmpBox", "37_confronto", { wait: 400 });
  await shotEl("#dopeBox", "38_dope", { wait: 400 });
  await shotEl("#chgBox", "39_carica", { wait: 400 });
  await shotEl("#corBox", "40_correlazioni", { wait: 400 });
  await shotEl("#coneBox", "41_cono", { wait: 400 });
  await shotEl("#visBox", "42_confronto_visivo", { wait: 400 });
  await shotEl("#holdBox", "43_reticolo", { wait: 400 });
  await key("Escape");
  // help
  await key("h"); await page.waitForTimeout(400); await shotPage("44_help"); await key("Escape");
  await b.close();
  console.log("ok");
})();
