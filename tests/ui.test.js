/*
 * Test end-to-end dell'interfaccia (Playwright, Chromium headless).
 *
 *   npm install                       (una volta: installa Playwright)
 *   npx playwright install chromium   (una volta: scarica il browser di test)
 *   npm run test:ui
 *
 * In alternativa al download si può usare un browser già installato:
 *   PW_CHANNEL=msedge npm run test:ui        (Windows: Edge)
 *   PW_CHANNEL=chrome npm run test:ui        (Google Chrome)
 *   CHROME_PATH=/percorso/chrome npm run test:ui
 *
 * Ogni test apre una pagina nuova (stato pulito). La pagina è caricata da file:// come la usa l'utente;
 * il bersaglio di prova è generato al volo su un <canvas> (nessun file binario nel repository).
 */
"use strict";
const path = require("path");
const assert = require("assert");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const APP_URL = pathToFileURL(path.join(__dirname, "..", "src", "index.html")).href;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);

/* ------------------------------ helper ------------------------------ */
async function openApp(context) {
  const page = await context.newPage();
  page.problems = [];
  page.on("pageerror", e => page.problems.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") page.problems.push("console: " + m.text()); });
  page.on("request", r => { if (!/^(file|data|blob):/.test(r.url())) page.problems.push("rete: " + r.url()); });
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__SA && window.__SA.state);
  await expandAll(page);
  return page;
}
/** Dalla 1.6.0 alcune sezioni del pannello partono chiuse: i test le aprono tutte (i comandi devono essere visibili). */
const expandAll = page => page.evaluate(() => document.querySelectorAll("#side details").forEach(d => { d.open = true; }));
/** Bersaglio sintetico 800×600: griglia ogni 20 px (= 5 mm con la scala dei test), bordo nero. */
async function loadTarget(page, name = "bersaglio.png") {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 800; c.height = 600;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 800, 600);
    g.strokeStyle = "#bbb"; g.lineWidth = 1;
    for (let x = 0; x <= 800; x += 20) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 600); g.stroke(); }
    for (let y = 0; y <= 600; y += 20) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(800, y + 0.5); g.stroke(); }
    g.strokeStyle = "#000"; g.lineWidth = 6; g.strokeRect(3, 3, 794, 594);
    return c.toDataURL("image/png");
  });
  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
  await page.setInputFiles("#fImg", { name, mimeType: "image/png", buffer });
  await page.waitForFunction(() => window.__SA.state.image && window.__SA.state.image.w === 800);
}
/** Coordinate pagina di un punto in coordinate mondo (pixel immagine). */
async function screenOf(page, p) {
  return page.evaluate(p => { const s = window.__SA.toScreen(p), r = document.getElementById("canvas").getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y }; }, p);
}
async function clickAt(page, p) { const s = await screenOf(page, p); await page.mouse.click(s.x, s.y); }
async function key(page, k) { await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press(k); }
async function setField(page, sel, value) { await page.fill(sel, String(value)); await page.dispatchEvent(sel, "input"); await page.dispatchEvent(sel, "change"); }
/** Scala 4 px/mm (200 px = 50 mm), mira e fori del gruppo attivo, tutto inserito col mouse. */
async function setupGroup(page, poa, shots) {
  const st = await page.evaluate(() => window.__SA.state.mode);
  if (st !== "calib") await key(page, "2");
  await clickAt(page, { x: 100, y: 500 }); await clickAt(page, { x: 300, y: 500 });
  await setField(page, "#calDist", 50); await page.selectOption("#calUnit", "mm");
  await key(page, "3"); await clickAt(page, poa);
  for (const s of shots) await clickAt(page, s);
}
const S = page => page.evaluate(() => {
  const { state, Calc } = window.__SA;
  const g = state.groups.find(x => x.id === state.activeGroupId);
  return JSON.parse(JSON.stringify({ rot: state.rot, mode: state.mode, calib: state.calib, g, ngroups: state.groups.length, loupeZoom: state.loupeZoom,
    ctxPx: Calc.scale(state.calib.p1, state.calib.p2, parseFloat(document.getElementById("calDist").value), document.getElementById("calUnit").value) }));
});
const analyzeActive = page => page.evaluate(() => {
  const { state, Calc } = window.__SA, g = state.groups.find(x => x.id === state.activeGroupId);
  const p = { pxPerMm: Calc.scale(state.calib.p1, state.calib.p2, parseFloat(document.getElementById("calDist").value), "mm"),
    distMm: 100000, caliberMm: 7.82, clickValue: 0.1, clickUnit: "MIL" };
  return JSON.parse(JSON.stringify(Calc.analyze(g.shots.filter(s => !s.excluded), g.poa, p)));
});
const SHOTS = [{ x: 420, y: 230 }, { x: 440, y: 250 }, { x: 410, y: 260 }, { x: 435, y: 225 }, { x: 425, y: 245 }];
const POA = { x: 300, y: 240 };   // il gruppo è ~125 px (≈ 31 mm) a destra della mira, quasi alla stessa altezza

/* ------------------------------ test ------------------------------ */
test("caricamento della foto, nessuna connessione di rete", async page => {
  await loadTarget(page);
  const s = await S(page);
  assert.strictEqual(s.mode, "calib");
  assert.strictEqual(s.rot, 0);
  assert.match(await page.textContent("#ver"), /^v\d+\.\d+\.\d+$/);
});

test("scala, mira e fori inseriti con il mouse", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  const s = await S(page);
  near(s.ctxPx, 4, 0.05, "px/mm");
  assert.strictEqual(s.g.shots.length, 5);
  for (let i = 0; i < 5; i++) { near(s.g.shots[i].x, SHOTS[i].x, 1, "x foro"); near(s.g.shots[i].y, SHOTS[i].y, 1, "y foro"); }
  const r = await analyzeActive(page);
  assert.strictEqual(r.correction.hDir, "SINISTRA");   // gruppo a destra → correzione a sinistra
  assert.match(await page.textContent("#results"), /Group size/);
});

test("trascinamento di un foro, annulla e ripristina", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  const a = await screenOf(page, SHOTS[0]);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(a.x + 15, a.y + 10, { steps: 5 }); await page.mouse.move(a.x + 30, a.y + 20, { steps: 5 }); await page.mouse.up();
  const moved = (await S(page)).g.shots[0];
  assert.ok(moved.x > SHOTS[0].x + 5, "il foro non si è spostato");
  await key(page, "Control+z");
  near((await S(page)).g.shots[0].x, SHOTS[0].x, 1, "undo");
  await key(page, "Control+y");
  near((await S(page)).g.shots[0].x, moved.x, 1e-6, "redo");
});

test("rotazione di 90°: punti, distanze e direzione della correzione", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  const r0 = await analyzeActive(page), s0 = await S(page);
  await page.click("#bRotR");
  const s1 = await S(page), r1 = await analyzeActive(page);
  assert.strictEqual(s1.rot, 90);
  near(r1.mm.es, r0.mm.es, 1e-6, "il group size non cambia ruotando");
  near(s1.ctxPx, s0.ctxPx, 1e-9, "la scala non cambia ruotando");
  // ruotando di 90° in senso orario, «a destra» diventa «in basso»: la correzione passa da SINISTRA a SU
  assert.strictEqual(r1.correction.vDir, "SU");
  near(r1.correction.vClicks, r0.correction.hClicks, 0, "click verticali dopo la rotazione");
  near(r1.correction.hClicks, r0.correction.vClicks, 0, "click orizzontali dopo la rotazione");
  assert.match(await page.textContent("#rotStatus"), /90,00° in senso orario/);
  await key(page, "Control+z");
  const s2 = await S(page);
  assert.strictEqual(s2.rot, 0);
  near(s2.g.shots[0].x, s0.g.shots[0].x, 1e-9, "undo della rotazione");
  // campo numerico
  await setField(page, "#rotDeg", -12.5);
  assert.strictEqual((await S(page)).rot, -12.5);
  await page.click("#bRot0");
  assert.strictEqual((await S(page)).rot, 0);
  near((await S(page)).g.shots[2].y, s0.g.shots[2].y, 1e-9, "azzera riporta i punti al loro posto");
});

test("raddrizza con 2 punti su una linea quasi orizzontale", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await key(page, "5");
  assert.strictEqual((await S(page)).mode, "align");
  const p1 = { x: 100, y: 100 }, p2 = { x: 700, y: 130 };   // pendenza +2,86° (verso il basso a destra)
  const a = await screenOf(page, p1), b = await screenOf(page, p2);
  await page.mouse.click(a.x, a.y); await page.mouse.click(b.x, b.y);
  const s = await S(page);
  near(s.rot, -Math.atan2(30, 600) * 180 / Math.PI, 0.3, "angolo di raddrizzamento");
  assert.strictEqual(s.mode, "shot", "dopo «Raddrizza» si torna alla modalità precedente");
  // con la foto raddrizzata i due punti cliccati sono alla stessa altezza
  const q = await page.evaluate(([p1, p2]) => [window.__SA.imgToWorld(p1), window.__SA.imgToWorld(p2)], [p1, p2]);
  near(q[0].y, q[1].y, 3, "linea raddrizzata");
  // Esc annulla lo strumento a metà
  await key(page, "5"); await page.mouse.click(a.x, a.y); await key(page, "Escape");
  assert.strictEqual((await S(page)).mode, "shot");
});

test("lente: ingrandimento dal menu, Shift+rotella, scelta ricordata", async page => {
  await loadTarget(page);
  await page.selectOption("#loupeZoom", "8");
  assert.strictEqual((await S(page)).loupeZoom, 8);
  await key(page, "4");
  const c = await screenOf(page, { x: 400, y: 300 });
  await page.mouse.move(c.x, c.y); await page.mouse.move(c.x + 2, c.y + 2);
  await page.keyboard.down("Shift"); await page.mouse.wheel(0, -120); await page.keyboard.up("Shift");
  assert.strictEqual((await S(page)).loupeZoom, 12, "Shift+rotella in su = più ingrandimento");
  const scale0 = await page.evaluate(() => window.__SA.state.view.scale);
  await page.mouse.wheel(0, -120);
  assert.ok(await page.evaluate(() => window.__SA.state.view.scale) > scale0, "la rotella senza Shift resta lo zoom");
  await page.reload(); await page.waitForFunction(() => window.__SA); await expandAll(page);
  assert.strictEqual((await S(page)).loupeZoom, 12, "ingrandimento ricordato dopo il ricaricamento");
  assert.strictEqual(await page.inputValue("#loupeZoom"), "12");
});

test("umidità e pressione nei dati di ricarica", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#ld-humidity", 55); await setField(page, "#ld-pressure", 1013.2);
  const g = (await S(page)).g;
  assert.strictEqual(g.load.humidity, "55"); assert.strictEqual(g.load.pressure, "1013.2");
  const txt = await page.evaluate(() => window.__SA.resultText());
  assert.match(txt, /UR 55%/); assert.match(txt, /1013,2 hPa/);
  await page.click("#bAddGroup");
  const g2 = (await S(page)).g;
  assert.strictEqual(g2.load.humidity, "55", "il nuovo gruppo eredita l'umidità");
  assert.strictEqual(g2.load.pressure, "1013.2", "il nuovo gruppo eredita la pressione");
});

test("vista a schermo intero: grafici e confronto tra gruppi", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await page.click("#bAddGroup");   // passa in modalità «mira» per il nuovo gruppo
  await clickAt(page, { x: 300, y: 400 });
  for (const s of [{ x: 330, y: 380 }, { x: 345, y: 395 }, { x: 320, y: 410 }]) await clickAt(page, s);
  assert.ok(await page.isHidden("#anaView"));
  await page.click("#bAnalysis");
  assert.ok(await page.isVisible("#anaView"));
  assert.ok(await page.evaluate(() => document.getElementById("chScatter").width > 0), "grafico a dispersione disegnato");
  assert.ok(await page.isHidden("#cmpBox"), "1.21.0: il confronto è in un'altra pagina");
  await page.click("#bAnaSwitch");
  assert.ok(await page.isVisible("#cmpBox") && await page.isHidden("#chartsBox"), "pagina del confronto");
  assert.ok(await page.evaluate(() => document.getElementById("chTrend").width > 0), "andamento disegnato");
  assert.strictEqual(await page.locator("#cmpBody table.cmp tbody tr").count(), 2);
  // le scorciatoie dell'immagine sono disattivate mentre la vista è aperta
  await key(page, "1");
  assert.strictEqual((await S(page)).mode, "shot");
  // cambio del gruppo attivo dal selettore
  const first = await page.evaluate(() => String(window.__SA.state.groups[0].id));
  await page.selectOption("#anaGroup", first);
  assert.strictEqual(await page.evaluate(() => String(window.__SA.state.activeGroupId)), first);
  assert.match(await page.textContent("#anaGroupName"), /Gruppo 1/);
  await page.keyboard.press("Escape");
  assert.ok(await page.isHidden("#anaView"));
  await key(page, "a");
  assert.ok(await page.isVisible("#anaView") && await page.isVisible("#chartsBox"), "tasto A");
  await key(page, "c");
  assert.ok(await page.isVisible("#cmpBox") && await page.isHidden("#chartsBox"), "tasto C dentro la vista");
  await page.click("#bAnaClose");
  assert.ok(await page.isHidden("#anaView"));
  // il pulsante resta visibile in fondo al pannello anche scorrendo
  await page.evaluate(() => document.getElementById("sideScroll").scrollTo(0, 99999));
  assert.ok(await page.isVisible("#bAnalysis"));
});

test("sessione con foto ruotata: salvataggio e ricaricamento", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  assert.strictEqual(await page.evaluate(() => window.__SA.buildSession().format), 1, "senza rotazione resta il formato 1");
  await setField(page, "#rotDeg", 30);
  const sess = await page.evaluate(() => JSON.stringify(window.__SA.buildSession()));
  const o = JSON.parse(sess);
  assert.strictEqual(o.format, 2); assert.strictEqual(o.rotation, 30);
  const before = await S(page);
  await page.reload(); await page.waitForFunction(() => window.__SA); await expandAll(page);
  await page.evaluate(t => window.__SA.loadSessionText(t), sess);
  const after = await S(page);
  assert.strictEqual(after.rot, 30);
  assert.deepStrictEqual(after.g.shots, before.g.shots);
  assert.strictEqual(await page.inputValue("#rotDeg"), "30");
});

test("Result Card PNG e testo con foto ruotata", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#rotDeg", 7.5);
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });   // download diretto, senza dialog
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#bCardPng")]);
  assert.match(dl.suggestedFilename(), /^ShAn-ResCar- - -\d{8}-\d{4}\.png$/);
  await page.click("#bAddGroup"); await clickAt(page, { x: 300, y: 400 });
  for (const q of [{ x: 330, y: 380 }, { x: 345, y: 395 }]) await clickAt(page, q);
  await page.selectOption("#cardScope", "all");
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.click("#bCardPng")]);
  assert.match(dl2.suggestedFilename(), /^ShAn-ResCar-/);
  assert.match(await page.evaluate(() => window.__SA.resultText()), /Foto ruotata di 7,50° in senso orario/);
});

test("griglia angolare e tema scuro", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#rotDeg", 15);
  await key(page, "g");
  assert.ok(await page.evaluate(() => document.getElementById("gridOn").checked));
  await key(page, "t");
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  await key(page, "t");
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.theme), "light");
});

test("icona della scheda (SVG e PNG incorporati)", async page => {
  const icons = await page.evaluate(async () => {
    const out = [];
    for (const l of document.querySelectorAll('link[rel="icon"]')) {
      const img = new Image(); img.src = l.href; await img.decode();
      out.push({ type: l.type, w: img.naturalWidth, data: l.href.startsWith("data:") });
    }
    return out;
  });
  assert.deepStrictEqual(icons.map(i => i.type), ["image/svg+xml", "image/png"]);
  assert.ok(icons.every(i => i.data && i.w > 0), "icone incorporate e leggibili");
});

/** Legge un CSV «italiano» (; e virgolette RFC 4180) in righe di celle. */
function parseCsv(t, sep = ";") {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\r" && t[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += ch;
  }
  return rows;
}
const csvNumber = c => parseFloat(c.replace(",", "."));
async function download(page, sel) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click(sel)]);
  const fs = require("fs");
  return { name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), "utf8") };
}

test("export CSV dei fori e dei gruppi (; e virgola decimale)", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  await setField(page, "#ld-humidity", 55); await setField(page, "#ld-charge", "42.5");
  await page.fill("#ld-notes", 'prova; "nuova" carica'); await page.dispatchEvent("#ld-notes", "change");
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const f = await download(page, "#bCsvShots");
  assert.match(f.name, /^ShAn-CSVShots- - -\d{8}-\d{4}\.csv$/);
  assert.ok(f.text.startsWith("\uFEFF"), "BOM UTF-8");
  assert.ok(f.text.includes("\r\n") && !/[^\r]\n/.test(f.text), "righe CRLF");
  const R = parseCsv(f.text.slice(1));
  assert.strictEqual(R.length, 6, "intestazione + 5 fori");
  assert.ok(R.every(r => r.length === R[0].length), "stesso numero di colonne su ogni riga");
  const col = name => R[0].indexOf(name);
  const s0 = (await S(page)).g.shots[0];
  near(csvNumber(R[1][col("X dal punto di mira (mm)")]), (s0.x - POA.x) / 4, 0.05, "X del foro 1 in mm");
  assert.match(R[1][col("X dal punto di mira (mm)")], /^-?\d+,\d{3}$/, "virgola decimale");
  assert.strictEqual(R[1][col("Verso orizzontale")], "SINISTRA");
  assert.strictEqual(R[1][col("Escluso")], "no");
  const g = await download(page, "#bCsvGroups");
  const G = parseCsv(g.text.slice(1));
  assert.strictEqual(G.length, 2, "intestazione + 1 gruppo");
  assert.strictEqual(G[1].length, G[0].length);
  const gc = name => G[1][G[0].indexOf(name)];
  const r = await analyzeActive(page);
  near(csvNumber(gc("Group size c-c (mm)")), r.mm.es, 0.001, "group size nel CSV");
  assert.strictEqual(gc("Umidità (%)"), "55");
  assert.strictEqual(gc("Carica (gr)"), "42,5", "numero dei dati di ricarica con la virgola");
  assert.strictEqual(gc("Note"), 'prova; "nuova" carica', "testo con ; e virgolette");
  assert.match(g.text, /"prova; ""nuova"" carica"/, "virgolette raddoppiate (RFC 4180)");
});

/* Foto sintetica DI SBIECO: un foglio 297 × 210 mm con griglia ogni 10 mm e 3 fori neri (⌀ 8 mm) proiettato con
   un'omografia nota (angoli del foglio nella foto: PHOTO_CORNERS). */
const PHOTO_CORNERS = [{ x: 150, y: 120 }, { x: 780, y: 190 }, { x: 700, y: 610 }, { x: 170, y: 560 }];
const HOLES_MM = [{ x: 120, y: 80 }, { x: 150, y: 95 }, { x: 130, y: 120 }];
async function loadSkewedTarget(page) {
  const dataUrl = await page.evaluate(([corners, holes]) => {
    const { Calc } = window.__SA, W = 900, H = 700;
    const Hm = Calc.homography(corners, [{ x: 0, y: 0 }, { x: 297, y: 0 }, { x: 297, y: 210 }, { x: 0, y: 210 }]);   // foto → mm
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"), im = g.createImageData(W, H), D = im.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const m = Calc.applyH(Hm, { x: x + 0.5, y: y + 0.5 }), o = (y * W + x) * 4;
      let v = 90;   // sfondo
      if (m.x >= 0 && m.x <= 297 && m.y >= 0 && m.y <= 210) {
        v = 250;
        if (Math.abs(m.x - Math.round(m.x / 10) * 10) < 0.35 || Math.abs(m.y - Math.round(m.y / 10) * 10) < 0.35) v = 170;
        if (holes.some(h => Math.hypot(m.x - h.x, m.y - h.y) < 4)) v = 10;
      }
      D[o] = D[o + 1] = D[o + 2] = v; D[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return c.toDataURL("image/png");
  }, [PHOTO_CORNERS, HOLES_MM]);
  await page.setInputFiles("#fImg", { name: "sbieco.png", mimeType: "image/png", buffer: Buffer.from(dataUrl.split(",")[1], "base64") });
  await page.waitForFunction(() => window.__SA.state.image && window.__SA.state.image.w === 900);
}
const holesInPhoto = page => page.evaluate(([corners, holes]) => {
  const { Calc } = window.__SA, Hp = Calc.homography([{ x: 0, y: 0 }, { x: 297, y: 0 }, { x: 297, y: 210 }, { x: 0, y: 210 }], corners);
  return holes.map(h => Calc.applyH(Hp, h));
}, [PHOTO_CORNERS, HOLES_MM]);
const waitBase = page => page.waitForFunction(() => !window.__SA.state.busy && window.__SA.state.base && window.__SA.state.baseKey !== "orig");

test("correzione prospettica a 4 punti: foto appiattita, fori in mm, scala automatica", async page => {
  await loadSkewedTarget(page);
  // fori inseriti PRIMA della correzione, sulla foto storta
  await key(page, "4");
  const hp = await holesInPhoto(page);
  for (const h of hp) await clickAt(page, h);
  await page.selectOption("#perspPreset", "297x210");
  await key(page, "6");
  assert.strictEqual((await S(page)).mode, "persp");
  for (const i of [2, 0, 3, 1]) await clickAt(page, PHOTO_CORNERS[i]);   // ordine sparso
  await waitBase(page);
  const info = await page.evaluate(() => {
    const { state, perspR, calcContext } = window.__SA, R = perspR();
    return { R: { k: R.k, ox: R.ox, oy: R.oy, W: R.W, H: R.Hpx }, base: { w: state.base.w, h: state.base.h }, mode: state.mode,
      shots: state.groups[0].shots.map(s => ({ x: s.x, y: s.y })), px: calcContext().pxPerMm, persp: state.persp, rot: state.rot };
  });
  assert.strictEqual(info.mode, "shot", "torna alla modalità precedente");
  assert.deepStrictEqual(info.base, { w: info.R.W, h: info.R.H }, "la foto rettificata è la foto di lavoro");
  near(info.px, info.R.k, 1e-12, "scala automatica dal rettangolo");
  info.shots.forEach((s, i) => {
    const mm = { x: (s.x - info.R.ox) / info.R.k, y: (s.y - info.R.oy) / info.R.k };
    near(Math.hypot(mm.x - HOLES_MM[i].x, mm.y - HOLES_MM[i].y), 0, 1.0, `foro ${i + 1} in mm dopo la correzione`);
  });
  // il centro di ogni foro nella foto rettificata è nero (ricampionamento corretto)
  const dark = await page.evaluate(holes => {
    const { state, perspR } = window.__SA, R = perspR(), c = document.createElement("canvas");
    c.width = state.base.w; c.height = state.base.h; const g = c.getContext("2d"); g.drawImage(state.base.bitmap, 0, 0);
    return holes.map(h => g.getImageData(Math.round(R.ox + h.x * R.k), Math.round(R.oy + h.y * R.k), 1, 1).data[0]);
  }, HOLES_MM);
  assert.ok(dark.every(v => v < 60), `centri dei fori scuri nella foto rettificata (${dark})`);
  // group size misurato = distanza reale massima tra i fori (± errore di clic)
  const trueES = Math.max(...HOLES_MM.flatMap((a, i) => HOLES_MM.slice(i + 1).map(b => Math.hypot(a.x - b.x, a.y - b.y))));
  const esMm = await page.evaluate(() => { const { state, Calc, calcContext } = window.__SA; return Calc.extremeSpread(state.groups[0].shots).d / calcContext().pxPerMm; });
  near(esMm, trueES, 1.0, "group size in mm sulla foto appiattita");
  assert.match(await page.textContent("#perspStatus"), /297,0 × 210,0 mm/);
  assert.match(await page.textContent("#calStatus"), /Scala dal rettangolo/);
  // undo / redo / rimozione
  await key(page, "Control+z");
  await page.waitForFunction(() => !window.__SA.state.busy && window.__SA.state.baseKey === "orig");
  const back = (await S(page)).g.shots;
  back.forEach((s, i) => near(Math.hypot(s.x - hp[i].x, s.y - hp[i].y), 0, 1.5, `undo: foro ${i + 1} sulla foto originale`));
  await key(page, "Control+y");
  await waitBase(page);
  await page.click("#bPerspOff");
  await page.waitForFunction(() => !window.__SA.state.busy && window.__SA.state.baseKey === "orig");
  const off = (await S(page)).g.shots;
  off.forEach((s, i) => near(Math.hypot(s.x - back[i].x, s.y - back[i].y), 0, 1e-6, `rimozione: foro ${i + 1} di nuovo sulla foto originale`));
  assert.ok(await page.isDisabled("#bPerspOff"));
});

test("prospettiva: sessione salvata e ricaricata, Esc e Backspace", async page => {
  await loadSkewedTarget(page);
  await page.selectOption("#perspPreset", "297x210");
  // Esc annulla a metà, Backspace toglie l'ultimo angolo
  await key(page, "6"); await clickAt(page, PHOTO_CORNERS[0]); await clickAt(page, PHOTO_CORNERS[1]);
  await key(page, "Backspace");
  assert.strictEqual(await page.evaluate(() => window.__SA.state.perspPts.length), 1);
  await key(page, "Escape");
  assert.strictEqual(await page.evaluate(() => window.__SA.state.persp), null);
  await key(page, "6");
  for (const c of PHOTO_CORNERS) await clickAt(page, c);
  await waitBase(page);
  await key(page, "3"); await clickAt(page, { x: 300, y: 200 });
  const sess = await page.evaluate(() => JSON.stringify(window.__SA.buildSession()));
  const o = JSON.parse(sess);
  assert.strictEqual(o.format, 3); assert.strictEqual(o.persp.wMm, 297);
  const before = await S(page);
  await page.reload(); await page.waitForFunction(() => window.__SA); await expandAll(page);
  await page.evaluate(t => window.__SA.loadSessionText(t), sess);
  await waitBase(page);
  const after = await S(page);
  assert.deepStrictEqual(after.g.poa, before.g.poa);
  near(await page.evaluate(() => window.__SA.calcContext().pxPerMm), await page.evaluate(() => window.__SA.perspR().k), 1e-12, "scala dopo il ricaricamento");
});

test("probabilità di colpire: cerchio, rettangolo, altra distanza, testo e sessione", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  await page.selectOption("#hitShape", "circle"); await setField(page, "#hitD", 2); await page.selectOption("#hitUnit", "cm");   // ⌀ 20 mm con σ ≈ 3,4 mm: probabilità intermedie
  const h = await page.evaluate(() => { const { state, hitInfo, calcContext } = window.__SA; return hitInfo(state.groups[0], calcContext()); });
  // controllo indipendente della stima «con correzione»: residuo dell'arrotondamento al click e probabilità del cerchio
  const r = await analyzeActive(page);
  const resX = Math.sign(r.offset.dx) * 100000 * Math.tan(Math.atan(Math.abs(r.offset.dx) / 100000) - r.correction.hClicks * 0.0001);
  near(h.rx, resX, 1e-6, "residuo orizzontale dell'arrotondamento al click (mm)");
  const pExp = await page.evaluate(([rx, ry, s]) => window.__SA.Calc.hitCircle(Math.hypot(rx, ry), 10, s), [h.rx, h.ry, r.mm.sigma]);
  near(h.corr.p, pExp, 1e-12, "probabilità con correzione = cerchio ⌀ 20 mm spostato del residuo");
  ok2(h.now && h.now.p < h.corr.p, "con la taratura attuale (gruppo a ~31 mm) la probabilità è minore");
  ok2(h.corr.lo <= h.corr.p && h.corr.p <= h.corr.hi, "stima dentro l'intervallo");
  const cells = await page.$$eval("#hitOut table.hit tbody tr", trs => trs.map(tr => [...tr.cells].map(td => td.textContent.trim())));
  assert.strictEqual(cells[1][1], String(Math.round(h.corr.p * 100)), "colpi su 100");
  assert.match(cells[0][1], /^([<>] )?\d+(,\d)?%$/);
  // a 200 m: probabilità minore, taratura attuale non calcolabile
  await setField(page, "#hitDist", 200);
  const h2 = await page.evaluate(() => { const { state, hitInfo, calcContext } = window.__SA; return hitInfo(state.groups[0], calcContext()); });
  ok2(!h2.sameDist && h2.now === null && h2.corr.p < h.corr.p, "a 200 m: probabilità minore, «taratura attuale» non calcolata");
  assert.match(await page.textContent("#hitOut"), /limite superiore/);
  // rettangolo
  await page.selectOption("#hitShape", "rect");
  ok2(await page.isVisible("#hitW") && await page.isHidden("#hitD"), "campi del rettangolo");
  await setField(page, "#hitW", 10); await setField(page, "#hitH", 10);
  const h3 = await page.evaluate(() => { const { state, hitInfo, calcContext } = window.__SA; return hitInfo(state.groups[0], calcContext()); });
  assert.strictEqual(h3.shape, "rect");
  assert.match(await page.evaluate(() => window.__SA.resultText()), /Prob\. di colpire: rettangolo 10,0 × 10,0 cm a 200 m: ([<>] )?\d/);
  // parametri nella sessione
  const sess = await page.evaluate(() => JSON.stringify(window.__SA.buildSession()));
  await page.reload(); await page.waitForFunction(() => window.__SA); await expandAll(page);
  await page.evaluate(t => window.__SA.loadSessionText(t), sess);
  assert.strictEqual(await page.inputValue("#hitShape"), "rect");
  assert.strictEqual(await page.inputValue("#hitDist"), "200");
  // preset 100 × 100 e 30 × 30 mm del rettangolo di riferimento (il 10 × 10 della 1.13 diventa «Personalizzato»)
  await page.selectOption("#perspPreset", "100x100");
  assert.deepStrictEqual([await page.inputValue("#perspW"), await page.inputValue("#perspH")], ["100", "100"]);
  await page.evaluate(() => window.__SA.setParams({ perspW: 10, perspH: 10, perspPreset: "10x10" }));
  assert.deepStrictEqual([await page.inputValue("#perspPreset"), await page.inputValue("#perspW")], ["custom", "10"], "vecchio preset 10 × 10");
  await page.selectOption("#perspPreset", "30x30");
  assert.deepStrictEqual([await page.inputValue("#perspW"), await page.inputValue("#perspH")], ["30", "30"]);
});
const ok2 = (c, msg) => assert.ok(c, msg);

test("help tecnico: apertura, indice, esempi calcolati e coerenti col testo", async page => {
  assert.ok(await page.isHidden("#helpView"));
  await page.click("#bHelp");
  assert.ok(await page.isVisible("#helpView"));
  // tutti i valori degli esempi sono compilati
  const empty = await page.$$eval("#helpView [data-ex]", els => els.filter(e => !e.textContent || e.textContent === "?").map(e => e.dataset.ex));
  assert.deepStrictEqual(empty, [], "segnaposto non compilati");
  assert.strictEqual(await page.locator("#helpIcTable tr").count(), 4);
  // le frasi di commento degli esempi sono vere con i dati usati
  const E = await page.evaluate(() => { const e = window.__SA.helpExamples(), r = e._r;
    return { corr: r.correction, cci: r.correctionCI, fly: e._flyFlag, hit: e._hit, es: r.mm.es, mr: r.mm.mr, ic: e._ic, ratio: r.shape.ratio }; });
  assert.strictEqual(E.corr.hDir, "SINISTRA"); assert.strictEqual(E.corr.hClicks, 3); assert.strictEqual(E.corr.vClicks, 0);
  ok2(E.cci.h.hi < 0 && E.cci.v.lo <= 0 && E.cci.v.hi >= 0, "IC orizzontale esclude lo 0, verticale lo contiene");
  ok2(E.fly, "il sesto colpo è l'unico flyer");
  ok2(E.hit.h100c.p > E.hit.h300c.p && E.hit.h100n.p < E.hit.h300c.p, "ordine delle probabilità come nel testo");
  ok2(E.ic[0].hi > 2 && E.ic.every((x, i) => i === 0 || x.hi < E.ic[i - 1].hi), "con 3 colpi più del doppio; l'IC si stringe con n");
  // le voci dell'indice portano alla sezione
  await page.click('.help-toc a[data-to="h-esempi"]');
  await page.waitForTimeout(100);
  const top = await page.evaluate(() => document.getElementById("h-esempi").getBoundingClientRect().top);
  ok2(top >= 0 && top < 120, `sezione «Esempi svolti» in cima alla vista (${top})`);
  // le scorciatoie dell'immagine sono disattivate; Esc chiude; H riapre
  await page.keyboard.press("4");
  assert.notStrictEqual((await S(page)).mode, "shot");
  await page.keyboard.press("Escape");
  assert.ok(await page.isHidden("#helpView"));
  await key(page, "h");
  assert.ok(await page.isVisible("#helpView"), "tasto H");
  await page.click("#bHelpClose");
  assert.ok(await page.isHidden("#helpView"));
  // SEP: spiegato come non usato
  assert.match(await page.textContent("#h-glossario"), /SEP.*tridimensionale.*Non è usato/s);
});

test("zone di punteggio ISSF: anelli, punteggio per foro, totale, CSV e sessione", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#caliber", 4.5);
  const at = await screenOf(page, { x: POA.x + 155.5 / 2 * 4, y: POA.y });   // anello 1 della pistola ad aria (r = 77,75 mm, 4 px/mm)
  const px = () => page.evaluate(([x, y]) => { const c = document.getElementById("canvas"), r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    return [...c.getContext("2d").getImageData(Math.round((x - r.left) * d), Math.round((y - r.top) * d), 1, 1).data]; }, [at.x, at.y]);
  const before = await px();
  await page.selectOption("#scoreTarget", "issf10ap");
  await page.waitForTimeout(100);
  const after = await px();
  ok2(after.some((v, i) => Math.abs(v - before[i]) > 40), `anello disegnato sull'immagine (${before} → ${after})`);
  // punteggio confrontato con un calcolo indipendente (distanze in mm dal punto di mira, bordo del foro)
  const st = await S(page);
  const exp = await page.evaluate(([shots, poa]) => shots.map(sh => window.__SA.Calc.shotScore(Math.hypot(sh.x - poa.x, sh.y - poa.y) / 4, 4.5, window.__SA.Calc.SCORE_TARGETS.issf10ap).value), [st.g.shots, st.g.poa]);
  const si = await page.evaluate(() => { const x = window.__SA.scoreHere(window.__SA.state.groups[0]); return { total: x.total, max: x.max, vals: [...x.byId.values()].map(v => v.value) }; });
  assert.deepStrictEqual(si.vals, exp); assert.strictEqual(si.total, exp.reduce((a, b) => a + b, 0)); assert.strictEqual(si.max, 50);
  assert.match(await page.textContent("#points thead"), /Punti/);
  assert.match(await page.textContent("#results"), new RegExp(`Punteggio.*${si.total} / 50`));
  assert.match(await page.evaluate(() => window.__SA.resultText()), /Punteggio \(ISSF 10 m pistola ad aria\): \d+ \/ 50/);
  const csvF = await page.evaluate(() => window.__SA.csvShots()), csvG = await page.evaluate(() => window.__SA.csvGroups());
  assert.match(csvF.split("\r\n")[0], /;Punti;10 interno;Sulla linea;Alzo impostato \(click\);Brandeggio impostato \(click\);Carica del foro \(gr\)$/);
  assert.match(csvG, new RegExp(`;ISSF 10 m pistola ad aria;${si.total};50;`));
  // bersaglio personalizzato
  await page.selectOption("#scoreTarget", "custom");
  ok2(await page.isVisible("#scoreD10"), "campi del bersaglio personalizzato");
  await setField(page, "#scoreD10", 20); await setField(page, "#scoreStep", 20);
  const sc2 = await page.evaluate(() => window.__SA.scoreHere(window.__SA.state.groups[0]).t.name);
  assert.match(sc2, /personalizzato/);
  // nella sessione
  const sess = await page.evaluate(() => JSON.stringify(window.__SA.buildSession()));
  await page.reload(); await page.waitForFunction(() => window.__SA); await expandAll(page);
  await page.evaluate(t => window.__SA.loadSessionText(t), sess);
  assert.strictEqual(await page.inputValue("#scoreTarget"), "custom");
  assert.strictEqual(await page.inputValue("#scoreD10"), "20");
});

test("salvataggio automatico (IndexedDB): proposta di ripristino, Ripristina, Ignora", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await page.waitForFunction(() => /Salvato automaticamente/.test(document.getElementById("autosaveInfo").textContent), null, { timeout: 5000 });
  const before = await S(page);
  await page.reload(); await page.waitForFunction(() => window.__SA); await expandAll(page);
  await page.waitForSelector("#restoreBar:not([hidden])");
  assert.match(await page.textContent("#restoreText"), /bersaglio\.png, 1 gruppo, 5 fori/);
  await page.click("#bRestore");
  await page.waitForFunction(() => window.__SA.state.image && window.__SA.state.groups[0].shots.length === 5);
  const after = await S(page);
  assert.deepStrictEqual(after.g.shots, before.g.shots); assert.deepStrictEqual(after.calib, before.calib);
  // dopo il ripristino il lavoro resta «non salvato»: al prossimo avvio la proposta ricompare; Ignora la chiude
  await page.waitForTimeout(1500);
  await page.reload(); await page.waitForFunction(() => window.__SA); await expandAll(page);
  await page.waitForSelector("#restoreBar:not([hidden])");
  await page.click("#bRestoreIgnore");
  ok2(await page.isHidden("#restoreBar") && !(await page.evaluate(() => window.__SA.state.image)), "Ignora: nessun ripristino");
  // con la sessione salvata su file, al riavvio non c'è niente da ripristinare
  await page.reload(); await page.waitForFunction(() => window.__SA); await expandAll(page);
  await page.waitForSelector("#restoreBar:not([hidden])");
  await page.click("#bRestore");
  await page.waitForFunction(() => window.__SA.state.image);
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await Promise.all([page.waitForEvent("download"), page.click("#bSave")]);
  await page.waitForFunction(() => /sessione salvata su file/.test(document.getElementById("autosaveInfo").textContent), null, { timeout: 5000 });
  await page.reload(); await page.waitForFunction(() => window.__SA); await expandAll(page);
  await page.waitForTimeout(500);
  ok2(await page.isHidden("#restoreBar"), "nessuna proposta dopo il salvataggio su file");
});

/** Lettore ZIP minimo per il test (indipendente dallo scrittore dell'app): directory centrale + CRC con zlib. */
function readZip(buf) {
  const zlib = require("zlib");
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  assert.ok(e >= 0, "fine della directory centrale");
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = {};
  for (let i = 0; i < n; i++) {
    assert.strictEqual(buf.readUInt32LE(p), 0x02014b50);
    const crc = buf.readUInt32LE(p + 16), size = buf.readUInt32LE(p + 24), nl = buf.readUInt16LE(p + 28), off = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString("utf8");
    assert.strictEqual(buf.readUInt32LE(off), 0x04034b50);
    const lnl = buf.readUInt16LE(off + 26), lex = buf.readUInt16LE(off + 28), data = buf.slice(off + 30 + lnl + lex, off + 30 + lnl + lex + size);
    if (zlib.crc32) assert.strictEqual(zlib.crc32(data) >>> 0, crc, `CRC di ${name}`);
    out[name] = data; p += 46 + nl;
  }
  return out;
}

test("archivio delle sessioni ed esportazione ZIP", async page => {
  page.on("dialog", d => d.accept());
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  for (const nm of ["primo.png", "secondo bersaglio.png"]) {
    await loadTarget(page, nm);
    await setupGroup(page, POA, nm === "primo.png" ? SHOTS : SHOTS.slice(0, 3));
    await Promise.all([page.waitForEvent("download"), page.click("#bSave")]);
    await page.waitForFunction(n => new RegExp(`${n} session[ei] archiviat`).test(document.getElementById("archiveInfo").textContent), nm === "primo.png" ? 1 : 2, { timeout: 5000 });
  }
  // risalvare la stessa sessione aggiorna la voce, non ne crea un'altra
  await Promise.all([page.waitForEvent("download"), page.click("#bSave")]);
  await page.waitForTimeout(400);
  assert.match(await page.textContent("#archiveInfo"), /^2 sessioni archiviate · 8 fori/);
  // una sessione salvata in precedenza (con foto incorporata) aggiunta da file
  const old = await page.evaluate(() => { const s = window.__SA.buildSession(true); s.sessionId = undefined; s.savedAt = "2026-01-02T10:00:00.000Z"; return JSON.stringify(s); });
  await page.setInputFiles("#fArch", { name: "vecchia.json", mimeType: "application/json", buffer: Buffer.from(old) });
  await page.waitForFunction(() => /^3 sessioni/.test(document.getElementById("archiveInfo").textContent), null, { timeout: 5000 });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bZip")]);
  assert.match(dl.suggestedFilename(), /^ShAn-SessionDB- - -\d{8}-\d{4}\.zip$/);
  const Z = readZip(require("fs").readFileSync(await dl.path()));
  const names = Object.keys(Z);
  ok2(names.includes("LEGGIMI.txt") && names.includes("riepilogo_gruppi.csv"), "file alla radice");
  const dirs = [...new Set(names.filter(n => n.includes("/")).map(n => n.split("/")[0]))];
  assert.strictEqual(dirs.length, 3, "una cartella per sessione");
  ok2(/^001_.*_2026-01-02--\d\d-\d\d$/.test(dirs[0]), `ordine per data: la sessione del 2/1/2026 è la prima (${dirs[0]})`);
  for (const d of dirs) for (const f of ["sessione.json", "foto.png", "fori.csv", "gruppi.csv"]) ok2(Z[`${d}/${f}`], `${d}/${f}`);
  const js = JSON.parse(Z[`${dirs[1]}/sessione.json`].toString("utf8"));
  ok2(js.app === "ShootAnalyzer" && js.image.dataUrl === null && js.image.file === "foto.png", "sessione senza foto incorporata, con riferimento al file");
  ok2(Z[`${dirs[1]}/foto.png`].slice(1, 4).toString() === "PNG", "foto originale PNG");
  const rie = Z["riepilogo_gruppi.csv"].toString("utf8").replace(/^﻿/, "").trim().split("\r\n");
  assert.strictEqual(rie.length, 4, "intestazione + 3 gruppi");
  ok2(rie[0].startsWith("Sessione;Salvata il;Immagine;Gruppo;"), "colonne del riepilogo");
  // svuota archivio
  await page.click("#bArchClear");
  await page.waitForFunction(() => /^Archivio vuoto/.test(document.getElementById("archiveInfo").textContent), null, { timeout: 5000 });
  ok2(await page.isDisabled("#bZip"), "ZIP disattivato con archivio vuoto");
});


/* ------------------------------ 1.6.0 ------------------------------ */
test("sezioni: all'apertura solo «Calibrazione scala» aperta; Gruppi e Risultati si aprono al primo punto", async page => {
  await page.reload(); await page.waitForFunction(() => window.__SA && window.__SA.state);
  const st = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#side details")].map(d => [d.id, d.open])));
  const s0 = await st();
  for (const [id, open] of Object.entries(s0)) assert.strictEqual(open, id === "sec-calib", `${id} ${id === "sec-calib" ? "aperta" : "chiusa"} all'avvio`);
  ok2(await page.isHidden("#shotDist"), "campo nascosto con la sezione chiusa");
  await page.click("#sec-params > summary");
  ok2(await page.isVisible("#shotDist"), "la sezione si apre col clic sul titolo");
  await page.click("#sec-calib > summary");
  ok2(await page.isHidden("#calDist"), "anche la sezione aperta si chiude");
  ok2(await page.evaluate(() => document.getElementById("bSnap").classList.contains("on")), "snap attivo all'apertura");
  // primo punto sulla foto (scala): si aprono Gruppi e Risultati, il resto non cambia
  await loadTarget(page);
  await clickAt(page, { x: 100, y: 500 });
  const s1 = await st();
  ok2(s1["sec-groups"] && s1["sec-results"], "Gruppi e Risultati aperte al primo punto");
  ok2(!s1["sec-hit"] && !s1["sec-score"] && !s1["sec-points"] && !s1["sec-load"], "le altre restano come prima");
  // richiuse dall'utente, non si riaprono a ogni punto
  await page.click("#sec-results > summary");
  await clickAt(page, { x: 300, y: 500 });
  assert.strictEqual((await st())["sec-results"], false, "non si riapre a ogni clic");
  // nuova foto: alla prima mira si riaprono
  await loadTarget(page, "secondo.png");
  await key(page, "3"); await clickAt(page, POA);
  assert.strictEqual((await st())["sec-results"], true, "nuova foto: di nuovo aperte al primo punto");
});
test("nuovo gruppo: copia tutti i dati di ricarica e condizioni del gruppo attivo", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  const vals = { "#ld-date": "2026-11-17", "#ld-case": "Lapua 3x", "#ld-powder": "N140", "#ld-charge": "44.5", "#ld-bullet": "SMK 168",
    "#ld-primer": "CCI BR2", "#ld-temp": "12", "#ld-wind": "3", "#ld-shotsTotal": "7", "#ld-foulers": "2", "#ld-notes": "nota di prova" };
  for (const [sel, v] of Object.entries(vals)) await setField(page, sel, v);
  await page.click('#windDial g[data-h="9"]');
  const g1 = (await S(page)).g;
  await page.click("#bAddGroup");
  const s2 = await S(page);
  assert.strictEqual(s2.ngroups, 2);
  assert.notStrictEqual(s2.g.id, g1.id);
  assert.deepStrictEqual(s2.g.load, g1.load, "tutti i campi copiati, anche colpi, scaldacanna e note");
  assert.strictEqual(s2.g.load.notes, "nota di prova"); assert.strictEqual(s2.g.load.shotsTotal, "7"); assert.strictEqual(s2.g.load.foulers, "2");
  assert.strictEqual(await page.inputValue("#ld-notes"), "nota di prova", "il form mostra i dati copiati");
  // copia, non riferimento: cambiare il nuovo gruppo non tocca il primo
  await setField(page, "#ld-notes", "solo nel secondo");
  const all = await page.evaluate(() => window.__SA.state.groups.map(g => g.load.notes));
  assert.deepStrictEqual(all, ["nota di prova", "solo nel secondo"]);
});

const ITALIAN = /\b(il|lo|della|delle|dei|degli|del|gruppo|gruppi|[Cc]olpi|[Cc]olpo|[Ff]ori|[Ff]oro|non|sono|con|che|[Nn]essun[ao]?|[Cc]licca|[Cc]arica|[Ss]alva|[Ss]essione|[Pp]unteggio|Gruppo|Punti|Mira|mira|ore \d|Raggio|Distanza|Bersaglio|bersaglio da)\b/;
test("lingua inglese: interfaccia, risultati, esportazioni, help in italiano, scelta ricordata", async page => {
  page.on("dialog", d => d.accept());
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  assert.strictEqual(await page.inputValue("#langSel"), "it", "italiano predefinito");
  await page.selectOption("#langSel", "en");
  assert.strictEqual(await page.evaluate(() => document.documentElement.lang), "en");
  assert.strictEqual((await page.textContent("#sec-results > summary")).trim(), "Results");
  assert.strictEqual(await page.getAttribute("#bLoad", "aria-label"), "Load photo");   // dalla 1.17.0 la barra principale ha solo icone
  assert.strictEqual(await page.getAttribute("#bLoad", "title"), "Load photo (Ctrl+O)");
  assert.strictEqual(await page.getAttribute("#bUndo", "title"), "Undo (Ctrl+Z)");
  // lavoro completo in inglese
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  await page.selectOption("#scoreTarget", "issf50r"); await page.dispatchEvent("#scoreTarget", "change");
  await setField(page, "#ld-charge", "42.5"); await setField(page, "#ld-notes", "test note"); await setField(page, "#ld-humidity", "55");
  await page.click('#windDial g[data-h="3"]');
  await setDialCell(page, 0, "dv", 5);   // click impostati → riga della dope nei risultati
  const s1 = await S(page);
  assert.strictEqual(s1.g.name, "Group 1", "nome automatico del gruppo in inglese");
  ok2(/Dope at 100 m: elevation/.test(await page.textContent("#results")), "dope in inglese");
  const side = await page.innerText("#sideScroll");
  ok2(/Group size \(c-c\)/.test(side) && /Score/.test(side) && /Probability per shot/.test(side), "risultati in inglese");
  assert.ok(!ITALIAN.test(side.replace(/bersaglio\.png/g, "")), "nessun testo italiano nel pannello: " + (side.match(ITALIAN) || [""])[0]);
  ok2(/\b\d+\.\d+ mm\b/.test(side), "punto decimale nei numeri");
  const txt = await page.evaluate(() => window.__SA.resultText());
  ok2(/Mean radius:/.test(txt) && /Hit probability:/.test(txt) && /Score \(ISSF 50 m rifle\)/.test(txt), "testo copiato in inglese");
  assert.ok(!ITALIAN.test(txt.replace(/bersaglio\.png/g, "")), "nessun italiano nel testo: " + (txt.match(ITALIAN) || [""])[0]);
  // secondo gruppo, vista grafici e confronto
  await page.click("#bAddGroup");
  assert.strictEqual((await S(page)).g.name, "Group 2");
  await clickAt(page, { x: 300, y: 400 });
  await key(page, "4"); for (const p of [{ x: 330, y: 380 }, { x: 350, y: 395 }, { x: 320, y: 410 }]) await clickAt(page, p);
  await key(page, "a");
  await page.waitForFunction(() => window.__SA.anaOpen());
  const ana = await page.textContent("#anaView");
  ok2(/Group comparison/.test(ana) && /Trend over time/.test(ana), "vista grafici in inglese");
  assert.ok(!ITALIAN.test(ana.replace(/bersaglio\.png/g, "")), "nessun italiano nella vista grafici: " + (ana.match(ITALIAN) || [""])[0]);
  await key(page, "Escape");
  // Result Card (testo disegnato sul canvas: le chiavi passano comunque dal dizionario)
  await Promise.all([page.waitForEvent("download"), page.click("#bCardPng")]);
  // CSV in formato inglese: virgola come separatore, punto decimale
  const f = await download(page, "#bCsvShots");
  assert.match(f.name, /^ShAn-CSVShots- - -\d{8}-\d{4}\.csv$/);
  const R = parseCsv(f.text.slice(1), ",");
  ok2(R.length === 9 && R.every(r => r.length === R[0].length), "8 fori + intestazione, colonne allineate");
  const col = n => R[0].indexOf(n);
  ok2(col("X from the point of aim (mm)") >= 0 && col("Points") >= 0, "intestazioni in inglese");
  assert.match(R[1][col("X from the point of aim (mm)")], /^-?\d+\.\d{3}$/, "punto decimale");
  assert.strictEqual(R[1][col("Horizontal direction")], "LEFT");
  assert.strictEqual(R[1][col("Excluded")], "no");
  const g = await download(page, "#bCsvGroups");
  const G = parseCsv(g.text.slice(1), ",");
  assert.strictEqual(G[1][G[0].indexOf("Charge (gr)")], "42.5");
  assert.strictEqual(G[1][G[0].indexOf("Notes")], "test note");
  // sessione, archivio e ZIP con nomi in inglese
  await Promise.all([page.waitForEvent("download"), page.click("#bSave")]);
  await page.waitForFunction(() => /^1 session archived/.test(document.getElementById("archiveInfo").textContent), null, { timeout: 5000 });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bZip")]);
  assert.match(dl.suggestedFilename(), /^ShAn-SessionDB-/);
  const Z = readZip(require("fs").readFileSync(await dl.path()));
  const names = Object.keys(Z);
  ok2(names.includes("README.txt") && names.includes("groups_summary.csv"), "file alla radice in inglese");
  ok2(names.some(n => /\/session\.json$/.test(n)) && names.some(n => /\/shots\.csv$/.test(n)) && names.some(n => /\/groups\.csv$/.test(n)), "file di sessione in inglese");
  ok2(/CSV in English format/.test(Z["README.txt"].toString("utf8")), "LEGGIMI in inglese");
  // report PDF in inglese (le chiavi del report passano dal dizionario)
  const [pdf] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bPdf")]);
  assert.match(pdf.suggestedFilename(), /^ShAn-PDFReport-.*\.pdf$/);
  // help tecnico: resta in italiano, con avviso
  await key(page, "h");
  await page.waitForFunction(() => window.__SA.helpOpen());
  ok2(await page.isVisible("#helpLangNote"), "avviso: help solo in italiano");
  ok2(/Glossario A–Z/.test(await page.innerText("#helpView .help-body")), "corpo dell'help in italiano");
  assert.strictEqual((await page.textContent("#bHelpClose")).trim(), "← Back to analysis");
  assert.match(await page.textContent('#helpView [data-ex="c5"]'), /^\d,\d+$/, "esempi dell'help con la virgola decimale (italiano)");
  await key(page, "Escape");
  // nessuna chiave senza traduzione incontrata in tutto il percorso
  assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.I18N.missing]), [], "testi senza traduzione");
  // la scelta resta dopo la riapertura (anche la barra di ripristino è in inglese)
  await page.evaluate(() => window.__SA.doAutosave());
  await page.evaluate(() => { const s = window.__SA.state; s.groups[0].shots.push({ id: 999, x: 1, y: 1 }); window.__SA.commit(); });
  await page.evaluate(() => window.__SA.doAutosave());
  await page.reload(); await page.waitForFunction(() => window.__SA && window.__SA.state);
  assert.strictEqual(await page.inputValue("#langSel"), "en", "lingua ricordata");
  assert.strictEqual((await page.textContent("#sec-results > summary")).trim(), "Results");
  await page.waitForSelector("#restoreBar:not([hidden])", { timeout: 5000 });
  assert.match(await page.textContent("#restoreText"), /Unsaved work found/);
  await page.click("#bRestoreIgnore");
  // ritorno all'italiano senza ricaricare
  await page.selectOption("#langSel", "it");
  assert.strictEqual((await page.textContent("#sec-results > summary")).trim(), "Risultati");
  assert.strictEqual(await page.getAttribute("#bUndo", "title"), "Annulla (Ctrl+Z)");
  assert.strictEqual(await page.evaluate(() => localStorage.getItem("shootAnalyzer.lang")), "it");
});

test("cambio lingua a lavoro aperto: pannelli e menu ridisegnati", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  ok2(/Raggio medio/i.test(await page.innerText("#results")), "risultati in italiano");
  await page.selectOption("#langSel", "en");
  const res = await page.innerText("#results");
  ok2(/Mean radius/i.test(res) && !/Raggio medio/i.test(res), "risultati ridisegnati in inglese");
  ok2(/From aim/.test(await page.innerText("#points")), "tabella punti in inglese");
  assert.strictEqual(await page.textContent('#ld-windDir option[value="12"]'), "12 o'clock (headwind)");
  assert.match(await page.textContent('#caliberPreset optgroup[label="Rifle"] option'), /\.17 HMR/);
  assert.strictEqual((await S(page)).g.name, "Group 1", "nome automatico del gruppo tradotto");
  const dir = await page.evaluate(() => [...document.querySelectorAll("#points td")].map(td => td.textContent).find(t => /°/.test(t)));
  ok2(dir && !/O/.test(dir.replace(/[^A-Z]/g, "")), "sigle della bussola in inglese (W, non O): " + dir);
  await page.selectOption("#langSel", "it");
  ok2(/Raggio medio/.test(await page.innerText("#results")), "di nuovo in italiano");
  assert.strictEqual((await S(page)).g.name, "Gruppo 1");
});


/* ------------------------------ 1.7.0 ------------------------------ */
/** Click di un foro nella tabella dei punti (colonna «Alzo» o «Brand.»). */
async function setDialCell(page, n, key, v) {
  const sel = `#points input[data-dial="${key}"]`;
  const h = (await page.$$(sel))[n];
  await h.fill(String(v)); await h.dispatchEvent("change");
}
test("click di alzo e brandeggio: ripresi dal foro precedente, correzione propagata, dope", async page => {
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS.slice(0, 1));
  await setField(page, "#shotDist", 100); await setField(page, "#clickVal", 0.1); await page.selectOption("#clickUnit", "MIL");
  await setDialCell(page, 0, "dv", 20); await setDialCell(page, 0, "dh", -3);
  for (const p of SHOTS.slice(1)) await clickAt(page, p);
  let g = (await S(page)).g;
  assert.deepStrictEqual(g.shots.map(q => [q.dv, q.dh]), [[20, -3], [20, -3], [20, -3], [20, -3], [20, -3]], "i nuovi fori riprendono i click del precedente");
  // correzione del 3° foro: i successivi con lo stesso valore lo seguono, i precedenti no
  await setDialCell(page, 2, "dv", 22);
  g = (await S(page)).g;
  assert.deepStrictEqual(g.shots.map(q => q.dv), [20, 20, 22, 22, 22]);
  await key(page, "Control+z");
  assert.deepStrictEqual((await S(page)).g.shots.map(q => q.dv), [20, 20, 20, 20, 20], "annullabile");
  await key(page, "Control+y");
  g = (await S(page)).g;
  // dope attesa calcolata qui (indipendente): media di [click·0,1 − arctan(y/D)·1000] in MIL, y in mm (+ = alto)
  const k = 1 / (await S(page)).ctxPx, D = 100000;
  const v = g.shots.reduce((a, q) => a + (q.dv * 0.1 - Math.atan((g.poa.y - q.y) * k / D) * 1000), 0) / 5;
  const h = g.shots.reduce((a, q) => a + (q.dh * 0.1 - Math.atan((q.x - g.poa.x) * k / D) * 1000), 0) / 5;
  const res = await page.textContent("#results");
  const m = res.match(/Dope a 100 m: alzo ([+−-]?[\d,]+) click \(([+−-]?[\d,]+) MIL[^)]*\) · brandeggio ([+−-]?[\d,]+) click \(([+−-]?[\d,]+) MIL/);
  ok2(m, "riga della dope nei risultati: " + res.slice(res.indexOf("Dope"), res.indexOf("Dope") + 120));
  const it = t => parseFloat(t.replace(",", ".").replace("−", "-"));
  near(it(m[2]), v, 0.006, "dope alzo (MIL)"); near(it(m[1]), v / 0.1, 0.06, "dope alzo (click)");
  near(it(m[4]), h, 0.006, "dope brandeggio (MIL)");
  ok2(/Click diversi tra i fori/.test(res), "avviso: click cambiati durante il gruppo");
  // colonne nella tabella, nel testo e nei CSV
  const txt = await page.evaluate(() => window.__SA.resultText());
  ok2(/Dope: +alzo/.test(txt), "dope nel testo copiato");
  const f = await download(page, "#bCsvShots");
  const R = parseCsv(f.text.slice(1));
  assert.deepStrictEqual(R.slice(1).map(r => r[R[0].indexOf("Alzo impostato (click)")]), ["20", "20", "22", "22", "22"]);
  assert.strictEqual(R[1][R[0].indexOf("Brandeggio impostato (click)")], "-3");
  const gcsv = parseCsv((await download(page, "#bCsvGroups")).text.slice(1));
  near(it(gcsv[1][gcsv[0].indexOf("Dope alzo (MIL)")]), v, 0.001, "dope nel CSV dei gruppi");
  // il nuovo gruppo parte dai click dell'ultimo foro
  await page.click("#bAddGroup"); await key(page, "3"); await clickAt(page, { x: 300, y: 400 }); await clickAt(page, { x: 330, y: 380 });
  const ng = (await S(page)).g;
  assert.deepStrictEqual([ng.shots[0].dv, ng.shots[0].dh], [22, -3], "primo foro di un nuovo gruppo: ultimi click usati");
  // la sessione salva e ricarica i click
  const sess = await page.evaluate(() => JSON.stringify(window.__SA.buildSession(false)));
  await page.evaluate(t => window.__SA.loadSessionText(t), sess);
  assert.deepStrictEqual((await page.evaluate(() => window.__SA.state.groups[0].shots.map(q => q.dv))), [20, 20, 22, 22, 22]);
});

test("distanza per gruppo: copiata nel nuovo gruppo, nei calcoli e nella sessione", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  const g1 = (await S(page)).g;
  assert.strictEqual(g1.dist, 100);
  await page.click("#bAddGroup");
  assert.strictEqual((await S(page)).g.dist, 100, "il nuovo gruppo parte dalla distanza del gruppo attivo");
  await key(page, "3"); await clickAt(page, { x: 300, y: 400 });
  for (const p of [{ x: 330, y: 380 }, { x: 350, y: 395 }, { x: 320, y: 410 }]) await clickAt(page, p);
  await setField(page, "#shotDist", 200);
  const st = await page.evaluate(() => window.__SA.state.groups.map(g => g.dist));
  assert.deepStrictEqual(st, [100, 200]);
  // tornando al primo gruppo il campo mostra la sua distanza
  await page.click("#groups .g:first-child .dot");
  assert.strictEqual(await page.inputValue("#shotDist"), "100");
  ok2(/· 100 m/.test(await page.textContent("#groups")) && /· 200 m/.test(await page.textContent("#groups")), "distanze nell'elenco dei gruppi");
  // angoli del secondo gruppo calcolati a 200 m
  const a = await page.evaluate(() => { const { state, Calc, calcContext } = window.__SA, g = state.groups[1], r = Calc.analyze(g.shots, g.poa, calcContext(g));
    return { mm: r.mm.es, moa: r.ang.es.MOA }; });
  near(a.moa, 2 * Math.atan(a.mm / 2 / 200000) * 180 / Math.PI * 60, 1e-9, "group size angolare a 200 m");
  ok2(/diversa per gruppo/.test(await page.evaluate(() => window.__SA.resultText())), "testo: distanza diversa per gruppo");
  // sessione: distanze salvate; una sessione senza distanze per gruppo (< 1.7.0) usa quella della sessione
  const s = await page.evaluate(() => window.__SA.buildSession(false));
  assert.deepStrictEqual(s.groups.map(g => g.dist), [100, 200]);
  s.groups.forEach(g => delete g.dist); s.params.shotDist = 50;
  await page.evaluate(t => window.__SA.loadSessionText(t), JSON.stringify(s));
  assert.deepStrictEqual(await page.evaluate(() => window.__SA.state.groups.map(g => g.dist)), [50, 50], "sessioni precedenti: distanza della sessione");
});

test("dope card: righe per distanza, filtro munizione, CSV e PNG", async page => {
  page.on("dialog", d => d.accept());
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100); await setField(page, "#clickVal", 0.1); await page.selectOption("#clickUnit", "MIL");
  await setField(page, "#ld-bullet", "SMK 168"); await setField(page, "#ld-powder", "N140"); await setField(page, "#ld-charge", "44.5");
  for (let i = 0; i < 5; i++) await setDialCell(page, i, "dv", 10);
  // secondo gruppo a 200 m con alzo 25 click (copia munizione e distanza, poi la cambiamo)
  await page.click("#bAddGroup"); await setField(page, "#shotDist", 200);
  await key(page, "3"); await clickAt(page, { x: 300, y: 400 });
  for (const p of [{ x: 300, y: 380 }, { x: 310, y: 395 }, { x: 290, y: 410 }]) await clickAt(page, p);
  for (let i = 0; i < 3; i++) await setDialCell(page, i, "dv", 25);
  // terzo gruppo con un'altra carica: non deve finire nella dope della prima munizione
  await page.click("#bAddGroup"); await setField(page, "#ld-charge", "45.0"); await setField(page, "#shotDist", 300);
  await key(page, "3"); await clickAt(page, { x: 600, y: 400 });
  for (const p of [{ x: 600, y: 380 }, { x: 610, y: 395 }]) await clickAt(page, p);
  await page.click("#groups .g:first-child .dot");   // gruppo attivo = prima munizione
  await key(page, "c"); await page.waitForFunction(() => window.__SA.anaOpen());
  assert.strictEqual(await page.inputValue("#dopeLoad"), "SMK 168 · N140 · 44.5 gr", "munizione del gruppo attivo");
  const rows = await page.$$eval("#dopeBody tbody tr", trs => trs.map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent.trim())));
  assert.strictEqual(rows.length, 2, "due distanze per questa munizione");
  assert.deepStrictEqual(rows.map(r => r[0]), ["100 m", "200 m"], "ordinate per distanza");
  // valori attesi calcolati dallo stato
  const exp = await page.evaluate(() => { const { state, Calc, calcContext } = window.__SA;
    return state.groups.slice(0, 2).map(g => { const d = Calc.dope(g.shots, g.poa, calcContext(g)); return d.v.mil / 0.1; }); });
  rows.forEach((r, i) => near(parseFloat(r[1].replace(",", ".").replace("+", "")), exp[i], 0.051, "click di alzo in tabella"));
  await page.selectOption("#dopeLoad", "*");
  assert.strictEqual((await page.$$("#dopeBody tbody tr")).length, 3, "«tutte le munizioni»: anche la terza");
  assert.strictEqual(await page.inputValue("#dopeLoad"), "*", "la scelta dell'utente resta");
  await page.selectOption("#dopeLoad", "SMK 168 · N140 · 44.5 gr");
  const f = await download(page, "#bDopeCsv");
  assert.match(f.name, /^ShAn-DopeCard- - -\d{8}-\d{4}\.csv$/);
  ok2(!/"-?\d+,\d+"/.test(f.text), "in italiano i numeri con la virgola decimale non hanno virgolette");
  const C = parseCsv(f.text.slice(1));
  assert.strictEqual(C.length, 3, "CSV: intestazione + 2 righe " + JSON.stringify(C)); assert.strictEqual(C[0][0], "Distanza (m)");
  near(parseFloat(C[2][1].replace(",", ".")), exp[1], 0.006, "CSV: click di alzo a 200 m");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#bDopePng")]);
  assert.match(dl.suggestedFilename(), /^ShAn-DopeCard-.*\.png$/);
  ok2(require("fs").statSync(await dl.path()).size > 3000, "PNG non vuoto");
  ok2(await page.isVisible("#chDope"), "grafico della dope");
});

test("carica e precisione: CEP per carica con gruppi combinati e intervallo", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  await setField(page, "#ld-bullet", "SMK 168"); await setField(page, "#ld-powder", "N140"); await setField(page, "#ld-charge", "42");
  const add = async (charge, base) => {
    await page.click("#bAddGroup"); await setField(page, "#ld-charge", charge);
    await key(page, "3"); await clickAt(page, base);
    for (const d of [[20, -15], [35, 0], [25, 12], [40, -5]]) await clickAt(page, { x: base.x + d[0], y: base.y + d[1] });
  };
  await add("42.0", { x: 200, y: 100 });
  await add("43.0", { x: 560, y: 120 });
  await key(page, "c"); await page.waitForFunction(() => window.__SA.anaOpen());
  const L = await page.evaluate(() => JSON.parse(JSON.stringify(window.__SA.chargeLevels())));
  assert.deepStrictEqual(L.levels.map(x => [x.charge, x.groups.length]), [[42, 2], [43, 1]], "42 e 42.0 sono la stessa carica; 2 gruppi combinati");
  // σ combinata = media delle s² pesata per ν (verifica indipendente)
  const lv = L.levels[0];
  near(lv.pool.s2, (lv.groups[0].nu * lv.groups[0].s2 + lv.groups[1].nu * lv.groups[1].s2) / (lv.groups[0].nu + lv.groups[1].nu), 1e-12, "s² combinata");
  const rows = await page.$$eval("#chgBody tbody tr", trs => trs.map(tr => tr.textContent));
  assert.strictEqual(rows.length, 2);
  ok2(/non si può dire/.test(await page.textContent("#chgBody")), "intervalli sovrapposti: nessuna carica dichiarata migliore");
  ok2(!/nodo armonico\b(?!»)/.test(await page.textContent("#chgBody")) || /Non è la ricerca di un «nodo armonico»/.test(await page.textContent("#chgBody")), "nessun «nodo» dichiarato");
  ok2(await page.isVisible("#chCharge"), "grafico carica-CEP");
});

/** Foto con fori rotondi scuri (⌀ 7,82 mm a 4 px/mm ≈ 31 px) su carta chiara con griglia. */
async function loadHoles(page) {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 800; c.height = 600;
    const g = c.getContext("2d");
    g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, 800, 600);
    g.strokeStyle = "#bbb"; g.lineWidth = 1;
    for (let x = 0; x <= 800; x += 20) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 600); g.stroke(); }
    for (let y = 0; y <= 600; y += 20) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(800, y + 0.5); g.stroke(); }
    g.fillStyle = "#1a1a1a";
    for (const [x, y] of [[430.4, 233.7], [520.2, 330.6], [610.8, 150.3]]) { g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); }
    return c.toDataURL("image/png");
  });
  await page.setInputFiles("#fImg", { name: "fori.png", mimeType: "image/png", buffer: Buffer.from(dataUrl.split(",")[1], "base64") });
  await page.waitForFunction(() => window.__SA.state.image && window.__SA.state.image.w === 800);
}
test("snap al centro del foro, Alt+clic senza snap, tasto M, cerchio del calibro", async page => {
  await loadHoles(page);
  await key(page, "2"); await clickAt(page, { x: 100, y: 500 }); await clickAt(page, { x: 300, y: 500 });
  await setField(page, "#calDist", 50); await page.selectOption("#calUnit", "mm");
  await page.selectOption("#caliberUnit", "mm"); await setField(page, "#caliber", 7);
  await key(page, "3"); await clickAt(page, { x: 300, y: 240 });
  // clic a 5–6 px dal centro: il foro si aggancia al centro della macchia
  await clickAt(page, { x: 434, y: 229 });
  let g = (await S(page)).g;
  near(g.shots[0].x, 430.4, 0.5, "x agganciata"); near(g.shots[0].y, 233.7, 0.5, "y agganciata");
  ok2(/agganciato al centro/.test(await page.textContent("#hint")), "il suggerimento lo dice");
  // Alt+clic: nessuno snap (fori sovrapposti)
  const s2 = await screenOf(page, { x: 524, y: 326 });
  await page.keyboard.down("Alt"); await page.mouse.click(s2.x, s2.y); await page.keyboard.up("Alt");
  g = (await S(page)).g;
  near(g.shots[1].x, 524, 1, "Alt+clic: x dove cliccato"); near(g.shots[1].y, 326, 1, "Alt+clic: y dove cliccato");
  // clic su carta vuota (solo griglia): resta dove si è cliccato
  await clickAt(page, { x: 250, y: 410 });
  g = (await S(page)).g;
  near(g.shots[2].x, 250, 1, "nessun foro: x invariata");
  ok2(/non agganciato/.test(await page.textContent("#hint")), "suggerimento: non agganciato");
  // tasto M: snap spento e scelta ricordata
  await key(page, "m");
  assert.strictEqual(await page.evaluate(() => localStorage.getItem("shootAnalyzer.snap")), "0");
  await clickAt(page, { x: 614, y: 146 });
  g = (await S(page)).g;
  near(g.shots[3].x, 614, 1, "snap spento: dove cliccato");
  await key(page, "m");
  // cerchio del calibro sotto il cursore: ⌀ = calibro alla scala della vista
  const p = await screenOf(page, { x: 600, y: 300 });
  await page.mouse.move(p.x, p.y);
  const r = await page.evaluate(() => ({ r: window.__SA.caliberCursorR(), sc: window.__SA.state.view.scale }));
  near(r.r, 7 / 2 * 4 * r.sc, 0.05, "raggio del cerchio del calibro");
  await key(page, "1");
  assert.strictEqual(await page.evaluate(() => window.__SA.caliberCursorR()), 0, "solo in modalità «Foro»");
});


/* ------------------------------ 1.8.0 ------------------------------ */
/** Controlla la struttura di un PDF: intestazione, xref coerente (ogni offset punta al suo oggetto), pagine e immagini. */
function checkPdf(buf, jpegPerPage = false) {
  const t = buf.toString("latin1");
  assert.ok(t.startsWith("%PDF-1.4\n"), "intestazione PDF");
  assert.ok(/%%EOF\n$/.test(t), "fine del file");
  const sx = +t.match(/startxref\n(\d+)\n%%EOF/)[1];
  assert.ok(t.slice(sx).startsWith("xref\n"), "startxref punta alla tabella xref");
  const m = t.slice(sx).match(/^xref\n0 (\d+)\n/), n = +m[1];
  const lines = t.slice(sx + m[0].length).split("\n").slice(0, n);
  lines.slice(1).forEach((l, i) => { const off = +l.slice(0, 10); assert.ok(t.startsWith(`${i + 1} 0 obj`, off), `offset dell'oggetto ${i + 1}`); });
  const pages = (t.match(/\/Type \/Page /g) || []).length;
  if (jpegPerPage) assert.strictEqual((t.match(/\/Filter \/DCTDecode/g) || []).length, pages, "un'immagine JPEG per pagina");
  assert.ok(t.includes(`/Count ${pages}`), "conteggio delle pagine");
  return pages;
}
/** Testo del PDF (dalla 1.14.0): flussi FlateDecode decompressi, stringhe dei Tj decodificate in cp1252, una riga per Tj. */
function pdfText(buf) {
  const zlib = require("zlib"), t = buf.toString("latin1"), out = [];
  const cp = [0x20ac, 0, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0, 0x17d, 0, 0, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0, 0x17e, 0x178];
  const re = /<< \/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g; let m;
  while ((m = re.exec(t))) {
    const start = m.index + m[0].length, data = buf.subarray(start, start + +m[1]);
    const s = zlib.inflateSync(data).toString("latin1");
    for (const mm of s.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)) {
      const raw = mm[1].replace(/\\([0-7]{3}|.)/g, (_, e) => /^[0-7]{3}$/.test(e) ? String.fromCharCode(parseInt(e, 8)) : e);
      out.push([...raw].map(ch => { const c = ch.charCodeAt(0); return c >= 128 && c < 160 ? String.fromCharCode(cp[c - 128] || 63) : ch; }).join(""));
    }
  }
  return out.join("\n");
}
test("convex hull: area e perimetro nei risultati, sull'immagine, nei CSV", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  const exp = await page.evaluate(() => { const { state, Calc, calcContext } = window.__SA, g = state.groups[0];
    const k = 1 / calcContext(g).pxPerMm, h = Calc.convexHull(g.shots), ap = Calc.polygonAreaPerim(h);
    return { area: ap.area * k * k, perim: ap.perim * k, n: h.length }; });
  // verifica indipendente dell'area: fori del test, formula del laccio sul poligono atteso
  ok2(exp.n >= 3 && exp.n <= 5, "vertici del poligono");
  const res = await page.textContent("#results");
  const m = res.match(/Convex hull\s*([\d.]+) mm² · perimetro ([\d,]+) mm/);
  ok2(m, "riga del convex hull nei risultati");
  near(parseFloat(m[1].replace(".", "")), exp.area, 0.6, "area (mm²)"); near(parseFloat(m[2].replace(",", ".")), exp.perim, 0.06, "perimetro (mm)");
  assert.strictEqual(await page.isChecked("#hullOn"), false, "disegno spento all'avvio");
  await page.check("#hullOn"); await page.dispatchEvent("#hullOn", "change");
  const ses = await page.evaluate(() => window.__SA.buildSession(false));
  assert.strictEqual(ses.params.hullOn, true, "scelta salvata nella sessione");
  ok2(/Convex hull: +[\d.]+ mm²/.test(await page.evaluate(() => window.__SA.resultText())), "nel testo copiato");
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const G = parseCsv((await download(page, "#bCsvGroups")).text.slice(1));
  near(parseFloat(G[1][G[0].indexOf("Convex hull area (mm²)")].replace(",", ".")), exp.area, 0.06, "CSV: area");
});

test("precisione e seduta: salto dalle righe nei dati, livelli combinati, raggio medio", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  await setField(page, "#ld-bullet", "SMK 168"); await setField(page, "#ld-powder", "N140"); await setField(page, "#ld-charge", "44.5");
  await setField(page, "#ld-jump", "0.020");
  assert.strictEqual(await page.inputValue("#ld-jumpUnit"), "in", "unità predefinita: pollici");
  const add = async (jump, unit, base) => {
    await page.click("#bAddGroup"); await setField(page, "#ld-jump", jump);
    if (unit) { await page.selectOption("#ld-jumpUnit", unit); await page.dispatchEvent("#ld-jumpUnit", "change"); }
    await key(page, "3"); await clickAt(page, base);
    for (const d of [[20, -15], [35, 0], [25, 12], [40, -5]]) await clickAt(page, { x: base.x + d[0], y: base.y + d[1] });
  };
  await add("0.508", "mm", { x: 200, y: 100 });   // 0,508 mm = 0,020 in: stesso livello
  await add("0.040", "in", { x: 560, y: 120 });
  assert.strictEqual((await S(page)).g.load.jump, "0.040", "il nuovo gruppo copia il salto e lo si corregge");
  await key(page, "c"); await page.waitForFunction(() => window.__SA.anaOpen());
  await page.selectOption("#chgVar", "jump"); await page.selectOption("#chgMetric", "mr");
  const L = await page.evaluate(() => JSON.parse(JSON.stringify(window.__SA.chargeLevels())));
  assert.strictEqual(L.v, "jump"); assert.strictEqual(L.metric, "mr");
  assert.deepStrictEqual(L.levels.map(x => [+(x.x / 25.4).toFixed(3), x.groups.length]), [[0.02, 2], [0.04, 1]], "0,020 in e 0,508 mm combinati");
  const lv = L.levels[0];
  near(lv.pool.val, lv.pool.sigma * Math.sqrt(Math.PI / 2), 1e-12, "raggio medio atteso = σ·√(π/2)");
  const body = await page.textContent("#chgBody");
  ok2(/0,020 in/.test(body) && /0,040 in/.test(body) && /Raggio medio atteso/.test(body), "tabella per salto dalle righe");
  ok2(/non si può dire/.test(body), "verdetto prudente");
  assert.strictEqual(await page.inputValue("#chgLoad"), "SMK 168 · N140 · 44.5 gr", "seduta: munizione con la carica");
  // il salto è nel testo copiato e nella sessione
  await key(page, "Escape");
  ok2(/Salto dalle righe: *0,040 in/.test(await page.evaluate(() => window.__SA.resultText())), "salto nel testo copiato");
});

test("termini dei risultati collegati al glossario dell'help tecnico", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  const links = await page.$$eval("#results [data-gl]", a => a.map(x => [x.textContent.trim(), x.dataset.gl]));
  const has = (t, id) => links.some(([a, b]) => a.startsWith(t) && b === id);
  ok2(has("CEP (50%)", "gl-cep") && has("FOM", "gl-fom") && has("Raggio medio", "gl-mr") && has("Asse maggiore", "gl-asse"), "link dei termini principali");
  ok2(links.some(([, b]) => b === "gl-ic"), "anche gli intervalli di confidenza");
  const title = await page.getAttribute('#results a[data-gl="gl-cep"]', "title");
  ok2(/50% dei colpi/.test(title) && /clic: spiegazione/.test(title), "spiegazione breve al passaggio del mouse");
  await page.click('#results a[data-gl="gl-cep"]');
  await page.waitForFunction(() => window.__SA.helpOpen());
  ok2(await page.evaluate(() => document.getElementById("gl-cep").classList.contains("hl")), "voce del glossario evidenziata");
  const vis = await page.evaluate(() => { const r = document.getElementById("gl-cep").getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
  ok2(vis, "voce del glossario visibile");
  await key(page, "Escape");
  // ogni destinazione esiste nell'help
  const missing = await page.evaluate(() => [...document.querySelectorAll("#results [data-gl]")].map(a => a.dataset.gl).filter(id => !document.getElementById(id)));
  assert.deepStrictEqual(missing, [], "destinazioni esistenti");
});

test("report PDF: file valido, una o più pagine, nome e contenuto", async page => {
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100); await setField(page, "#ld-charge", "44.5"); await setField(page, "#ld-notes", "nota per il report");
  const [d1] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bPdf")]);
  assert.match(d1.suggestedFilename(), /^ShAn-PDFReport- - -\d{8}-\d{4}\.pdf$/);
  const b1 = require("fs").readFileSync(await d1.path());
  const p1 = checkPdf(b1);
  ok2(p1 >= 2 && p1 <= 5, `gruppo attivo: ${p1} pagine`);
  // testo vero (1.14.0): sezioni, metadati della calibrazione, colpi, modello statistico; font standard; Info
  const T1 = pdfText(b1), s1 = b1.toString("latin1");
  for (const w of ["Calibrazione", "Metodo", "2 punti: A", "Incertezza della scala", "COLPI ANALIZZATI", "5 marcati · 5 analizzati · 0 esclusi", "MODELLO STATISTICO E INCERTEZZA",
    "normale circolare bivariata", "Test dei flyer", "Diagnostica del modello", "Incertezza di misura", "Stabilità colpo dopo colpo", "Livello di confidenza", "nota per il report", "Group size (c-c)"])
    ok2(T1.includes(w), "testo nel PDF: " + w);
  ok2(/sigma per asse/.test(T1) && !/[σ√]/.test(T1), "simboli fuori da WinAnsi sostituiti");
  ok2(/\/BaseFont \/Helvetica \/Encoding \/WinAnsiEncoding/.test(s1) && /\/BaseFont \/Helvetica-Bold/.test(s1), "font standard");
  ok2(/\/ShootAnalyzerCalibration <FEFF/.test(s1) && /\/Subject <FEFF/.test(s1) && /\/Lang <FEFF/.test(s1), "metadati Info e lingua");
  ok2((s1.match(/\/Filter \/DCTDecode/g) || []).length >= 4, "foto e grafici come immagini");
  ok2(/\/Outlines \d+ 0 R/.test(s1), "segnalibri");
  // tutti i gruppi, con confronto e dope card: più pagine
  await page.click("#bAddGroup"); await key(page, "3"); await clickAt(page, { x: 300, y: 400 });
  for (const q of [{ x: 330, y: 380 }, { x: 350, y: 395 }, { x: 320, y: 410 }]) await clickAt(page, q);
  await page.selectOption("#cardScope", "all");
  const theme0 = await page.evaluate(() => document.documentElement.dataset.theme);
  await key(page, "t");   // tema cambiato: il report usa comunque la palette chiara e poi ripristina il tema
  const theme1 = await page.evaluate(() => document.documentElement.dataset.theme);
  assert.notStrictEqual(theme1, theme0);
  const [d2] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bPdf")]);
  const p2 = checkPdf(require("fs").readFileSync(await d2.path()));
  ok2(p2 > p1, `tutti i gruppi: ${p2} pagine`);
  const T2 = pdfText(require("fs").readFileSync(await d2.path()));
  ok2(T2.includes("Confronto tra gruppi") && T2.includes("Gruppo 2"), "sezioni d'insieme e secondo gruppo");
  assert.match(await page.textContent("#toast"), /Report PDF salvato/);
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.theme), theme1, "tema ripristinato dopo il report");
});

/* ------------------------------ 1.9.0 ------------------------------ */
const canvasSig = page => page.evaluate(() => { const c = document.getElementById("canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; return h; });
test("heatmap di densità, grafico polare e densità 3D ruotabile", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  const s0 = await canvasSig(page);
  await page.check("#heatOn"); await page.waitForTimeout(100);
  ok2(await canvasSig(page) !== s0, "la heatmap cambia l'immagine");
  ok2(await page.evaluate(() => { const S = window.__SA; return !!S.heatImage(S.state.groups[0]); }), "immagine della densità");
  ok2(await page.evaluate(() => window.__SA.buildSession().params.heatOn === true), "scelta salvata nella sessione");
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
  assert.strictEqual(await page.evaluate(() => window.__SA.CH.hits.polar.length), 10, "polare: 5 fori nel cerchio + 5 nello srotolato");
  // angolo del primo foro: dal centro gruppo, 0° = in alto, senso orario
  const exp = await page.evaluate(() => { const { state, Calc } = window.__SA, g = state.groups[0], c = Calc.centroid(g.shots), s = g.shots[0];
    return ((Math.atan2(s.x - c.x, c.y - s.y) * 180 / Math.PI) + 360) % 360; });
  const tip = await page.evaluate(() => window.__SA.CH.hits.polar[0].tip);
  ok2(tip.includes(`${Math.round(exp)}°`), `angolo nel tooltip: ${tip} vs ${exp}`);
  ok2(/R95/.test(await page.textContent("#chPolarNote")), "legenda del polare");
  await page.locator("#ch3d").scrollIntoViewIfNeeded();
  const box = await page.locator("#ch3d").boundingBox();
  const az0 = await page.evaluate(() => window.__SA.VIEW3D.az);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 4 }); await page.mouse.up();
  ok2(await page.evaluate(() => window.__SA.VIEW3D.az) !== az0, "trascinando la superficie ruota");
  await page.dblclick("#ch3d");
  assert.strictEqual(await page.evaluate(() => window.__SA.VIEW3D.az), az0, "doppio clic: vista iniziale");
});

test("confronto visivo tra rosate: sovrapposte, affiancate, origine e unità", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  await page.click("#bAddGroup"); await key(page, "3"); await clickAt(page, { x: 300, y: 400 });
  for (const q of [{ x: 330, y: 380 }, { x: 350, y: 395 }, { x: 320, y: 410 }]) await clickAt(page, q);
  await key(page, "c"); await page.waitForFunction(() => window.__SA.anaOpen());
  assert.strictEqual((await page.$$("#visList input[type=checkbox]")).length, 2, "un gruppo per riga");
  assert.strictEqual(await page.evaluate(() => window.__SA.CH.hits.vis.length), 5 + 1 + 3 + 1, "fori e centri di entrambi");
  // origine = mira, mm: il primo foro è 120 px = 30 mm a destra e 2,5 mm sopra la mira
  let V = await page.evaluate(() => window.__SA.visData());
  near(V.groups[0].P[0].x, 30, 0.01, "x in mm dalla mira"); near(V.groups[0].P[0].y, 2.5, 0.01, "y in mm dalla mira");
  const h0 = await page.evaluate(() => document.getElementById("chVis").height);
  await page.selectOption("#visLayout", "side");
  ok2(await page.evaluate(() => document.getElementById("chVis").height) !== h0, "affiancate: un riquadro per gruppo");
  await page.selectOption("#visRef", "c"); await page.selectOption("#visUnit", "MOA");
  V = await page.evaluate(() => window.__SA.visData());
  const c = await page.evaluate(() => { const { state, Calc } = window.__SA, g = state.groups[0], k = 4, c = Calc.centroid(g.shots), s = g.shots[0];
    return Calc.fromRad(Math.atan((s.x - c.x) / k / 100000), "MOA"); });
  near(V.groups[0].P[0].x, c, 1e-6, "MOA dal centro gruppo con la distanza del gruppo");
  near(V.groups[0].c.x, 0, 1e-9, "centro gruppo nell'origine");
  await page.uncheck("#visList input[type=checkbox] >> nth=1");
  assert.strictEqual(await page.evaluate(() => window.__SA.CH.hits.vis.length), 6, "deselezionato: solo il primo gruppo");
  ok2(await page.evaluate(() => window.__SA.buildSession().params.visRef === "c"), "scelte nella sessione");
});

test("reticolo e holdover: tacche, torrette, SFP, MOA, direzione e PNG", async page => {
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100); await setField(page, "#clickVal", 0.1); await page.selectOption("#clickUnit", "MIL");
  for (let i = 0; i < 5; i++) await setDialCell(page, i, "dv", 10);
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
  await page.selectOption("#rtSrc", "active");
  const d = await page.evaluate(() => { const { state, Calc, calcContext } = window.__SA, g = state.groups[0], r = Calc.dope(g.shots, g.poa, calcContext(g)); return { v: r.v.mil, h: r.h.mil }; });
  const cells = async () => (await page.$$eval("#rtBody tbody tr td", tds => tds.map(t => t.textContent.trim()))).map(t => parseFloat(t.replace(",", ".").replace("+", "")));
  let r = await cells();
  near(r[1], d.v, 0.006, "alzo necessario = dope"); near(r[3], Math.abs(d.v), 0.006, "tacca verticale FFP = nominale");
  near(r[2], d.h, 0.006, "brandeggio = dope");
  // mira 31 mm a sinistra del gruppo: serve correggere a sinistra → tacca a destra; alzo + → tacca sotto
  const hit = await page.evaluate(() => { const c = document.getElementById("chReticle"), h = window.__SA.CH.hits.reticle[0]; return { x: h.x, y: h.y, cx: c.clientWidth / 2, cy: c.clientHeight / 2 }; });
  ok2(d.v > 0 ? hit.y > hit.cy : hit.y < hit.cy, "alzo: tacca dalla parte opposta");
  ok2(d.h < 0 ? hit.x > hit.cx : hit.x < hit.cx, "brandeggio: tacca dalla parte opposta");
  await setField(page, "#rtDialV", 5);
  r = await cells(); near(r[1], d.v - 0.5, 0.006, "5 click già sulla torretta: 0,5 MIL in meno");
  await page.selectOption("#rtPlane", "SFP"); await setField(page, "#rtCal", 10); await setField(page, "#rtMag", 5);
  ok2(await page.isVisible("#rtCal"), "campi SFP visibili");
  r = await cells(); near(r[3], Math.abs(d.v - 0.5) * 0.5, 0.006, "SFP a metà ingrandimento: lettura dimezzata");
  await page.selectOption("#rtPlane", "FFP"); await page.selectOption("#rtType", "moahash");
  r = await cells(); near(r[3], Math.abs(d.v - 0.5) * 3.43775, 0.01, "reticolo MOA: tacca in MOA");
  ok2(!(await page.isVisible("#rtStep")), "campi del personalizzato nascosti");
  await page.selectOption("#rtType", "custom"); ok2(await page.isVisible("#rtStep"), "personalizzato: passo visibile");
  await page.uncheck("#rtWind"); r = await cells(); near(r[2], 0, 1e-9, "senza brandeggio");
  ok2(/sotto il centro|sopra il centro/.test(await page.textContent("#rtBody")), "istruzione a parole");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#bRtPng")]);
  assert.match(dl.suggestedFilename(), /^ShAn-Reticle-.*\.png$/);
  ok2(require("fs").statSync(await dl.path()).size > 5000, "PNG non vuoto");
});

test("bersaglio di autoverifica: PDF, foto del bersaglio stampato, misura e verifica", async page => {
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await page.selectOption("#ttN", "5");
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bTtPdf")]);
  const code = +(await page.inputValue("#ttCode"));
  ok2(code >= 1000 && code <= 9999, "codice nuovo");
  assert.match(dl.suggestedFilename(), /^ShAn-TestTarget- - -\d{8}-\d{4}\.pdf$/);
  const buf = require("fs").readFileSync(await dl.path());
  assert.strictEqual(checkPdf(buf, true), 1, "una pagina");
  ok2(buf.toString("latin1").includes("/Width 2480 /Height 3508"), "A4 a 300 dpi");
  // «foto» del bersaglio stampato: lo stesso disegno a 100 dpi
  const DPI = 100, k = DPI / 25.4;
  const dataUrl = await page.evaluate(([c, d]) => window.__SA.testTargetCanvas(c, 5, 7.62, d).toDataURL("image/png"), [code, DPI]);
  await page.setInputFiles("#fImg", { name: "prova.png", mimeType: "image/png", buffer: Buffer.from(dataUrl.split(",")[1], "base64") });
  await page.waitForFunction(() => window.__SA.state.image && window.__SA.state.image.w === 827);
  await page.selectOption("#caliberUnit", "mm"); await setField(page, "#caliber", 7.62);
  await key(page, "2"); await clickAt(page, { x: 55 * k, y: 222 * k }); await clickAt(page, { x: 155 * k, y: 222 * k });
  await setField(page, "#calDist", 100); await page.selectOption("#calUnit", "mm");
  const C = await page.evaluate(() => window.__SA.TT_C);
  await key(page, "3"); await clickAt(page, { x: C.x * k, y: C.y * k });
  const T = await page.evaluate(c => window.__SA.Calc.testTarget(c, 5).pts, code);
  for (const q of [...T].reverse()) await clickAt(page, { x: (C.x + q.x) * k + 2, y: (C.y - q.y) * k - 2 });   // clic un po' fuori centro: lo snap li riporta
  await page.click("#bTtCheck");
  const txt = await page.textContent("#ttResult");
  ok2(/Misura coerente/.test(txt), "verifica superata: " + txt.slice(0, 300));
  const rows = await page.$$eval("#ttResult table.tt:first-of-type tr td.x", tds => tds.map(t => t.textContent));
  near(parseFloat(rows[0].replace(",", ".")), 1, 0.01, "rapporto di scala ≈ 1");
  ok2(parseFloat(rows[1].replace(",", ".")) < 0.5, "RMS < 0,5 mm");
  // codice sbagliato: le posizioni non tornano
  await page.fill("#ttCode", String(code === 9999 ? 1000 : code + 1)); await page.click("#bTtCheck");
  ok2(/da rivedere/.test(await page.textContent("#ttResult")), "codice diverso: misura da rivedere");
  await page.fill("#ttCode", "12"); await page.click("#bTtCheck");
  ok2(/Inserisci il codice/.test(await page.textContent("#ttResult")), "codice non valido");
});

/* ------------------------------ 1.10.0 ------------------------------ */
const SI = page => page.evaluate(() => { const S = window.__SA, g = S.state.groups.find(x => x.id === S.state.activeGroupId);
  const si = S.scoreInfo(g, S.calcContext(), S.targetSpec(S.params())); return si && { total: si.total, max: si.max, kind: si.kind, cells: g.shots.map(q => { const v = si.byId.get(q.id); return v.label != null ? v.label : v.value; }) }; });
test("etichetta del group size sull'immagine e grafici 3 per riga", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  ok2(await page.isChecked("#esLabelOn"), "attiva di default");
  const s1 = await canvasSig(page);
  await page.uncheck("#esLabelOn"); await page.waitForTimeout(100);
  ok2(await canvasSig(page) !== s1, "l'etichetta compare e scompare");
  ok2(await page.evaluate(() => window.__SA.buildSession().params.esLabelOn === false), "scelta nella sessione");
  await page.check("#esLabelOn");
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById("charts")).gridTemplateColumns.split(" ").length), 3, "3 grafici per riga");
});

test("sagome: IPSC con spostamento e rotazione, IDPA, silhouette, zona vitale, decimale ISSF, probabilità", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await page.selectOption("#caliberUnit", "mm"); await setField(page, "#caliber", 9);
  await expandAll(page);
  await page.selectOption("#scoreTarget", "ipsc");
  ok2(await page.isVisible("#ipscPF") && !(await page.isVisible("#scoreDec")), "opzioni IPSC, niente decimale");
  let r = await SI(page);
  assert.deepStrictEqual(r.cells, ["A", "A", "A", "A", "A"], "gruppo 30 mm a destra: tutto A"); assert.strictEqual(r.total, 25);
  // bersaglio spostato 60 mm a sinistra: i fori (30–35 mm) sono a 90–95 mm dal centro → C (A larga ±75 mm + raggio del foro)
  await setField(page, "#tgtDx", -60);
  r = await SI(page); assert.deepStrictEqual(r.cells, ["C", "C", "C", "C", "C"], "zona C"); assert.strictEqual(r.total, 15, "minor: C = 3");
  await page.selectOption("#ipscPF", "major"); r = await SI(page); assert.strictEqual(r.total, 20, "major: C = 4");
  ok2(/20 \/ 25 punti · A 0 · C 5/.test(await page.textContent("#results")), "riepilogo nei risultati");
  // trascinamento col mouse: sposta; Shift+trascina: ruota; annulla
  await page.click("#bTgtMove");
  assert.strictEqual(await page.evaluate(() => window.__SA.state.mode), "tgt");
  const a = await screenOf(page, { x: 200, y: 400 });
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + 60, a.y, { steps: 4 }); await page.mouse.up();
  const t1 = await page.evaluate(() => window.__SA.tgtOf(window.__SA.state.groups[0]));
  ok2(t1.dx > -60, "trascinato a destra: " + t1.dx);
  await page.keyboard.down("Shift"); await page.mouse.move(a.x + 200, a.y); await page.mouse.down(); await page.mouse.move(a.x + 200, a.y + 80, { steps: 4 }); await page.mouse.up(); await page.keyboard.up("Shift");
  ok2(Math.abs((await page.evaluate(() => window.__SA.tgtOf(window.__SA.state.groups[0]))).rot) > 1, "Shift+trascina ruota");
  await page.keyboard.press("Control+z");
  near((await page.evaluate(() => window.__SA.tgtOf(window.__SA.state.groups[0]))).rot, 0, 1e-9, "annulla la rotazione");
  await key(page, "Escape");
  ok2(await page.evaluate(() => window.__SA.state.mode !== "tgt"), "Esc esce dallo strumento");
  ok2(await page.evaluate(() => JSON.stringify(window.__SA.buildSession().groups[0].tgt).includes("dx")), "posizione nella sessione");
  // probabilità sulla sagoma: righe per zona e punti attesi; A + C + D = a segno
  await page.selectOption("#hitShape", "target");
  await page.waitForFunction(() => /Zona A/.test(document.getElementById("hitOut").textContent));
  const ht = await page.textContent("#hitOut");
  ok2(/Zona C/.test(ht) && /Zona D/.test(ht) && /A segno/.test(ht) && /Punti attesi per colpo/.test(ht), "tabella della sagoma: " + ht.slice(0, 200));
  await page.click("#bTgtReset");
  // IDPA: punti persi
  await page.selectOption("#scoreTarget", "idpa");
  r = await SI(page); assert.strictEqual(r.kind, "idpa"); assert.deepStrictEqual(r.cells, ["−0", "−0", "−0", "−0", "−0"], "−0 attorno al centro (cerchio da 8\")");
  await setField(page, "#tgtDy", 600); r = await SI(page);
  assert.deepStrictEqual(r.cells, ["M", "M", "M", "M", "M"], "sagoma spostata 60 cm in alto: mancati"); assert.strictEqual(r.total, 25, "5 punti persi per mancato");
  await page.click("#bTgtReset");
  // silhouette e zona vitale: colpito/mancato
  await page.selectOption("#scoreTarget", "sil-chicken"); await page.selectOption("#silScale", "0.2");
  ok2(await page.isVisible("#silScale"), "scala visibile");
  r = await SI(page); assert.strictEqual(r.kind, "sil"); ok2(r.cells.every(c => c === "✗"), "pollo 1/5 (≈ 6,7 × 5,6 cm): 30 mm a destra = mancato");
  await page.selectOption("#scoreTarget", "vital"); await page.selectOption("#vitalPreset", "large");
  assert.strictEqual(await page.inputValue("#vitalW"), "29");
  r = await SI(page); ok2(r.cells.every(c => c === "✓"), "zona vitale ⌀ 29 cm: colpiti");
  await setField(page, "#vitalW", 5); await setField(page, "#vitalH", 5);
  assert.strictEqual(await page.inputValue("#vitalPreset"), "custom", "misura scritta a mano: personalizzata");
  r = await SI(page); ok2(r.cells.every(c => c === "✗"), "⌀ 5 cm: mancati");
  // decimale ISSF
  await page.selectOption("#scoreTarget", "issf25p"); await page.check("#scoreDec");
  r = await SI(page);
  const exp = await page.evaluate(() => { const S = window.__SA, g = S.state.groups[0], cc = S.calcContext(), t = S.Calc.SCORE_TARGETS.issf25p;
    return g.shots.map(q => S.Calc.decimalScore(S.Calc.dist(q, g.poa) / cc.pxPerMm, cc.caliberMm, t)); });
  assert.deepStrictEqual(r.cells, exp, "valori decimali per foro");
  near(r.total, exp.reduce((a, b) => a + b, 0), 1e-6, "totale decimale"); near(r.max, 54.5, 1e-9, "massimo 10,9 × 5");
  ok2(/\d,\d/.test(await page.textContent("#points")), "decimali nella tabella dei punti");
});

test("correlazioni ricarica/condizioni e ladder con carica per foro", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100); await setField(page, "#clickVal", 0.1); await page.selectOption("#clickUnit", "MIL");
  // 4 gruppi della stessa munizione con carica crescente: il gruppo sale di 2 mm ogni 0,5 gr
  await page.evaluate(() => { const S = window.__SA, st = S.state, g0 = st.groups[0];
    g0.load = { ...g0.load, bullet: "SMK 168", powder: "N140", charge: "43,5", temp: "10" };
    for (let i = 1; i < 4; i++) { const g = JSON.parse(JSON.stringify(g0)); g.id = 500 + i; g.name = "C" + i; g.load.charge = String(43.5 + 0.5 * i).replace(".", ","); g.load.temp = String(10 + 5 * i);
      g.poa = { ...g0.poa }; g.shots = g0.shots.map((q, j) => ({ ...q, id: 600 + i * 10 + j, y: q.y - 8 * i })); st.groups.push(g); }
    S.commit(); });
  await key(page, "c"); await page.waitForFunction(() => window.__SA.anaOpen());
  let C = await page.evaluate(() => window.__SA.corData());
  assert.strictEqual(C.pts.length, 4, "4 gruppi");
  const exp = await page.evaluate(() => { const S = window.__SA, cc = S.calcContext(); const ys = S.state.groups.map(g => S.Calc.dope(g.shots, g.poa, { ...cc, distMm: 100000 }).v.mil);
    return S.Calc.linReg([43.5, 44, 44.5, 45], ys); });
  near(C.reg.b, exp.b, 1e-9, "pendenza come il calcolo indipendente"); near(C.reg.b, -0.04, 1e-3, "2 mm a 100 m ogni 0,5 gr = −0,04 MIL/gr");
  ok2(/Pendenza/.test(await page.textContent("#corBody")), "riepilogo");
  await page.selectOption("#corPair", "vtemp"); C = await page.evaluate(() => window.__SA.corData());
  assert.strictEqual(C.reg, null, "temperatura: munizione completa (carica compresa), un gruppo per munizione");
  await page.selectOption("#corLoad", "*"); C = await page.evaluate(() => window.__SA.corData());
  near(C.reg.b, -0.004, 1e-4, "alzo ↔ temperatura (5 °C ogni gruppo)");
  await page.selectOption("#corPair", "vscharge"); C = await page.evaluate(() => window.__SA.corData());
  near(C.reg.b, 0, 1e-9, "V-spread uguale: pendenza 0"); ok2(/comprende lo zero/.test(await page.textContent("#corBody")), "nessuna relazione");
  // ladder: un gruppo, carica scritta per foro
  await key(page, "Escape"); await page.waitForFunction(() => !window.__SA.anaOpen());
  await page.check("#chPerShot");
  for (let i = 0; i < 5; i++) {
    const sel = `#points input[data-dial="ch"] >> nth=${i}`;
    await page.fill(sel, String(44 + 0.2 * i)); await page.dispatchEvent(sel, "change");
  }
  const chs = await page.evaluate(() => window.__SA.state.groups.find(g => g.id === window.__SA.state.activeGroupId).shots.map(q => q.ch));
  assert.deepStrictEqual(chs.map(v => Math.round(v * 10) / 10), [44, 44.2, 44.4, 44.6, 44.8], "carica per foro salvata");
  await key(page, "c"); await page.waitForFunction(() => window.__SA.anaOpen());
  await page.selectOption("#corPair", "ladder"); C = await page.evaluate(() => window.__SA.corData());
  assert.strictEqual(C.pts.filter(p => p.x >= 44 && p.x <= 44.81 && p.x !== 44.5 && p.x !== 45).length >= 5, true, "un punto per foro con la sua carica");
  ok2(/non indica «nodi»/.test(await page.textContent("#corBody")), "nessun nodo automatico");
});

test("1.21.0: cono di dispersione rimosso (codice commentato)", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await key(page, "c"); await page.waitForFunction(() => window.__SA.anaOpen());
  assert.strictEqual(await page.locator("#coneBox, #chCone3d, #chConeMap").count(), 0, "nessun pannello del cono");
  assert.strictEqual(await page.evaluate(() => typeof window.__SA.coneData), "undefined");
  ok2(!/Cono di dispersione/.test(await page.textContent("#anaView")), "nessun titolo");
});

test("distorsione dell'obiettivo: calibrazione da linee, punti riportati, sessione e annulla", async page => {
  // foto sintetica con barilotto noto: righe dritte deformate e un «foro» nero in una posizione ideale nota
  const K1 = -0.08, W0 = 1200, H0 = 900;
  const dataUrl = await page.evaluate(([K1, W, H]) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const L = { k1: K1, k2: 0, cx: W / 2, cy: H / 2, rn: Math.hypot(W / 2, H / 2) }, D = q => window.__SA.Calc.distortPoint(q, L);
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.strokeStyle = "#000"; g.lineWidth = 3;
    for (const y of [80, 820]) { g.beginPath(); for (let x = 40; x <= W - 40; x += 10) { const p = D({ x, y }); x === 40 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y); } g.stroke(); }
    for (const x of [80, 1120]) { g.beginPath(); for (let y = 40; y <= H - 40; y += 10) { const p = D({ x, y }); y === 40 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y); } g.stroke(); }
    return c.toDataURL("image/png"); }, [K1, W0, H0]);
  await page.setInputFiles("#fImg", { name: "lens.png", mimeType: "image/png", buffer: Buffer.from(dataUrl.split(",")[1], "base64") });
  await page.waitForFunction(() => window.__SA.state.image && window.__SA.state.image.w === 1200);
  const Lp = { k1: K1, k2: 0, cx: W0 / 2, cy: H0 / 2, rn: Math.hypot(W0 / 2, H0 / 2) };
  const dist = q => { const dx = q.x - Lp.cx, dy = q.y - Lp.cy, r2 = (dx * dx + dy * dy) / (Lp.rn * Lp.rn), f = 1 + Lp.k1 * r2; return { x: Lp.cx + dx * f, y: Lp.cy + dy * f }; };
  // scala e un foro messi PRIMA della correzione (sulle posizioni distorte)
  await key(page, "2"); await clickAt(page, dist({ x: 100, y: 820 })); await clickAt(page, dist({ x: 1100, y: 820 }));
  await setField(page, "#calDist", 1000); await page.selectOption("#calUnit", "mm");
  await key(page, "4"); await clickAt(page, dist({ x: 1050, y: 150 }));
  await page.click("#bLens");
  assert.strictEqual(await page.evaluate(() => window.__SA.state.mode), "lens");
  const lines = [[...Array(7)].map((_, i) => ({ x: 100 + i * 160, y: 80 })), [...Array(7)].map((_, i) => ({ x: 100 + i * 160, y: 820 })), [...Array(6)].map((_, i) => ({ x: 80, y: 60 + i * 150 }))];
  for (const l of lines) { for (const q of l) await clickAt(page, dist(q)); await page.keyboard.press("Enter"); }
  ok2(/Linee: 3/.test(await page.textContent("#lensLinesInfo")), "linee contate");
  await page.click("#bLensFit");
  await page.waitForFunction(() => window.__SA.state.lens && window.__SA.state.baseKey.startsWith("lens:"), null, { timeout: 30000 });
  const L = await page.evaluate(() => window.__SA.state.lens);
  near(L.k1, K1, 0.01, "k1 stimato dai clic"); ok2(/k1 \+ k2|solo k1/.test(await page.textContent("#lensInfo")), "riepilogo della stima");
  // il foro e la scala sono riportati sulla foto corretta: vicini alle posizioni ideali
  const st = await page.evaluate(() => ({ s: window.__SA.state.groups[0].shots[0], c: window.__SA.state.calib }));
  near(Math.hypot(st.s.x - 1050, st.s.y - 150), 0, 3, "foro riportato nella posizione senza distorsione");
  near(Math.hypot(st.c.p2.x - st.c.p1.x, st.c.p2.y - st.c.p1.y), 1000, 4, "segmento di scala raddrizzato: 1000 px");
  ok2(/Correzione attiva/.test(await page.textContent("#lensStatus")), "stato");
  const sess = await page.evaluate(() => window.__SA.buildSession(false));
  assert.strictEqual(sess.format, 4); near(sess.lens.k1, L.k1, 1e-12, "coefficienti nella sessione");
  // annulla: si torna alla foto originale e ai punti distorti
  await page.keyboard.press("Control+z");
  await page.waitForFunction(() => !window.__SA.state.lens);
  const s0 = await page.evaluate(() => window.__SA.state.groups[0].shots[0]), d0 = dist({ x: 1050, y: 150 });
  near(Math.hypot(s0.x - d0.x, s0.y - d0.y), 0, 3, "annulla: foro di nuovo sulla foto originale");
  // coefficienti scritti a mano e rimozione
  await setField(page, "#lensK1", K1); await page.click("#bLensApply");
  await page.waitForFunction(() => window.__SA.state.lens);
  await page.click("#bLensOff"); await page.waitForFunction(() => !window.__SA.state.lens);
  near(Math.hypot((await page.evaluate(() => window.__SA.state.groups[0].shots[0])).x - d0.x, 0), 0, 3, "rimossa: punti sulla foto originale");
});

/* ------------------------------ 1.11.0 ------------------------------ */
/** Foto con fori neri di diametro dPx nelle posizioni date (sfondo bianco). */
async function loadHolesImg(page, holes, dPx) {
  const dataUrl = await page.evaluate(([holes, dPx]) => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 800, 600); g.fillStyle = "#111"; for (const h of holes) { g.beginPath(); g.arc(h.x, h.y, dPx / 2, 0, Math.PI * 2); g.fill(); }
    return c.toDataURL("image/png"); }, [holes, dPx]);
  await page.setInputFiles("#fImg", { name: "fori.png", mimeType: "image/png", buffer: Buffer.from(dataUrl.split(",")[1], "base64") });
  await page.waitForFunction(() => window.__SA.state.image && window.__SA.state.image.name === "fori.png");
}
const HOLES = [{ x: 420, y: 230 }, { x: 470, y: 260 }, { x: 405, y: 290 }, { x: 455, y: 205 }, { x: 430, y: 330 }];
test("verifica incrociata della scala: diametro dei fori e riferimento di controllo", async page => {
  await loadHolesImg(page, HOLES, 30);   // 30 px a 4 px/mm = 7,5 mm
  await expandAll(page);
  await page.selectOption("#caliberUnit", "mm"); await setField(page, "#caliber", 7.62);
  await setupGroup(page, POA, HOLES.map(h => ({ x: h.x + 3, y: h.y - 2 })));
  let H = await page.evaluate(() => window.__SA.holeScaleCheck(window.__SA.calcContext()));
  assert.strictEqual(H.n, 5); near(H.mm, 7.5, 0.4, "diametro mediano misurato"); ok2(!H.bad, "coerente");
  ok2(/Fori misurati: ⌀ mediano/.test(await page.textContent("#calStatus")), "riga di controllo");
  ok2(await page.evaluate(() => window.__SA.state.groups[0].shots.every(s => s.snap)), "fori agganciati dallo snap: marcati");
  // distanza nota scritta in cm invece che in mm: la scala è 10× più piccola → i fori misurano il 10% del calibro... qui 1000%
  await page.selectOption("#calUnit", "cm");
  H = await page.evaluate(() => window.__SA.holeScaleCheck(window.__SA.calcContext()));
  ok2(H.bad && H.ratio > 5, "unità sbagliata: allarme (" + H.ratio + ")");
  ok2(/scala o calibro probabilmente sbagliati/.test(await page.textContent("#calStatus")), "avviso visibile");
  await page.selectOption("#calUnit", "mm");
  // riferimento di controllo: 200 px = 50 mm con la scala di 4 px/mm
  await page.click("#bRef"); assert.strictEqual(await page.evaluate(() => window.__SA.state.mode), "ref");
  await clickAt(page, { x: 150, y: 450 }); await clickAt(page, { x: 350, y: 450 });
  ok2(await page.evaluate(() => window.__SA.state.mode !== "ref"), "finito dopo 2 punti");
  await setField(page, "#refLen", 50);
  let R = await page.evaluate(() => { const S = window.__SA, cc = S.calcContext(); return S.refScaleCheck(cc, S.calibQuality(cc)); });
  near(R.meas, 50, 0.01, "misurato con la scala"); ok2(!R.bad, "coerente");
  await setField(page, "#refLen", 45);
  R = await page.evaluate(() => { const S = window.__SA, cc = S.calcContext(); return S.refScaleCheck(cc, S.calibQuality(cc)); });
  ok2(R.bad && Math.abs(R.diff - 50 / 45 + 1) < 1e-6, "11% di differenza: allarme");
  ok2(/Riferimento di controllo: misurato/.test(await page.textContent("#calStatus")), "riga del riferimento");
  ok2(await page.evaluate(() => !!window.__SA.buildSession().calib.r2), "riferimento nella sessione");
  await key(page, "Control+z");
  ok2(await page.evaluate(() => !window.__SA.state.calib.r2), "annulla il secondo punto del riferimento");
});

test("incertezza di misura, foro difficile, ES equivalente", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  const r = await page.textContent("#results");
  ok2(/Incertezza di misura \(95%\): ES/.test(r), "blocco nei risultati");
  ok2(/ES equivalente/.test(r) && /10 colpi/.test(r) && !/5 colpi \d/.test(r), "5 colpi: solo l'equivalente a 10");
  const e = await page.evaluate(() => { const S = window.__SA, a = analyzeA(); function analyzeA() { const g = S.state.groups[0], cc = S.calcContext(); return S.Calc.analyze(g.shots, g.poa, cc); } return S.Calc.esEquivalent(a.mm.es, 5, 10); });
  ok2(r.includes(e.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })), "valore dell'ES equivalente");
  const M0 = await page.evaluate(() => { const S = window.__SA, g = S.state.groups[0]; return S.measInfo(g, S.calcContext()); });
  ok2(M0.es.hi > M0.es.lo, "intervallo non nullo");
  await page.click("#points button[data-hard] >> nth=0");
  ok2(await page.evaluate(() => window.__SA.state.groups[0].shots[0].hard === true), "foro difficile");
  const M1 = await page.evaluate(() => { const S = window.__SA, g = S.state.groups[0]; return S.measInfo(g, S.calcContext()); });
  near(M1.u[0], 4.5, 1e-9, "a mano 1,5 px × 3"); near(M1.u[1], 1.5, 1e-9, "gli altri 1,5 px");
  ok2(await page.evaluate(() => window.__SA.buildSession().groups[0].shots[0].hard === true), "nella sessione");
  await setField(page, "#markHand", 0); await setField(page, "#markSnap", 0);
  const M2 = await page.evaluate(() => { const S = window.__SA, g = S.state.groups[0]; return S.measInfo(g, S.calcContext()); });
  ok2(M2.es.hi - M2.es.lo < M1.es.hi - M1.es.lo, "senza marcatura resta solo la scala: intervallo più stretto");
});

test("flyer con Mahalanobis: niente falsi flyer alle estremità di un gruppo allungato", async page => {
  await loadTarget(page);
  const line = [{ x: 260, y: 300 }, { x: 330, y: 298 }, { x: 380, y: 303 }, { x: 420, y: 299 }, { x: 460, y: 302 }, { x: 500, y: 300 }, { x: 640, y: 301 }];
  await setupGroup(page, { x: 400, y: 400 }, line);
  let T = await page.evaluate(() => window.__SA.flyerTest(window.__SA.state.groups[0].shots, 2));
  ok2(T.every(f => f.method === "mahal") && !T.some(f => f.flagged), "estremità lungo l'asse: nessun flyer");
  ok2(await page.evaluate(() => window.__SA.Calc.flyers(window.__SA.state.groups[0].shots, 2)[6].flagged), "il criterio euclideo l'avrebbe segnalato");
  ok2(/test di Mahalanobis/.test(await page.textContent("#points")), "nota sotto la tabella");
  await clickAt(page, { x: 420, y: 340 });   // colpo fuori dall'asse
  T = await page.evaluate(() => window.__SA.flyerTest(window.__SA.state.groups[0].shots, 2));
  ok2(T[7].flagged, "colpo fuori asse: flyer");
  const tip = await page.getAttribute("#points .flyer", "title");
  ok2(/Mahalanobis/.test(tip), "tooltip: " + tip);
});

test("diagnostica del modello: due centri, QQ-plot e avviso", async page => {
  await loadTarget(page);
  const A = [{ x: 380, y: 250 }, { x: 396, y: 262 }, { x: 370, y: 270 }, { x: 394, y: 238 }, { x: 378, y: 284 }],
    B = A.map(p => ({ x: p.x + 220, y: p.y + 4 }));
  await setupGroup(page, { x: 300, y: 400 }, [...A, ...B]);
  await page.waitForFunction(() => { const S = window.__SA, D = S.diagInfo(S.state.groups[0]); return D && D !== "pending"; }, null, { timeout: 15000 });
  const D = await page.evaluate(() => { const S = window.__SA, D = S.diagInfo(S.state.groups[0]); return { two: D.two.p, an: D.aniso.p, n: D.qq.length }; });
  ok2(D.two < 0.05, "due centri: p " + D.two); assert.strictEqual(D.n, 10);
  await page.waitForFunction(() => /Modello circolare normale poco adatto/.test(document.getElementById("results").textContent));
  ok2(/due centri distinti/.test(await page.textContent("#results")), "avviso con il motivo");
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
  assert.strictEqual(await page.evaluate(() => window.__SA.CH.hits.qq.length), 10, "QQ-plot: un punto per foro");
  ok2(/Rayleigh/.test(await page.textContent("#chQQNote")), "nota del QQ-plot");
});

test("reticolo: zoom con rotella, pulsanti, trascinamento e doppio clic", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100); await setField(page, "#clickVal", 0.1); await page.selectOption("#clickUnit", "MIL");
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
  await page.selectOption("#rtSrc", "active");
  await page.locator("#chReticle").scrollIntoViewIfNeeded();
  const b = await page.locator("#chReticle").boundingBox();
  await page.mouse.move(b.x + b.width * 0.7, b.y + b.height / 2); await page.mouse.wheel(0, -300); await page.waitForTimeout(100);
  const v1 = await page.evaluate(() => ({ ...window.__SA.RT_VIEW }));
  ok2(v1.zoom > 1 && v1.cx > 0, "rotella: ingrandisce verso il cursore");
  await page.mouse.down(); await page.mouse.move(b.x + b.width * 0.5, b.y + b.height / 2, { steps: 3 }); await page.mouse.up();
  ok2(await page.evaluate(() => window.__SA.RT_VIEW.cx) > v1.cx, "trascinando si sposta la vista");
  await page.click("#bRtIn"); near(await page.evaluate(() => window.__SA.RT_VIEW.zoom), v1.zoom * 1.5, 1e-9, "pulsante +");
  await page.dblclick("#chReticle"); assert.deepStrictEqual(await page.evaluate(() => ({ ...window.__SA.RT_VIEW })), { zoom: 1, cx: 0, cy: 0 }, "doppio clic: vista intera");
  await page.click("#bRtOut"); assert.strictEqual(await page.evaluate(() => window.__SA.RT_VIEW.zoom), 1, "non si riduce sotto la vista intera");
});

test("etichette senza sovrapposizioni, pannello in tempo reale, tooltip e doppio clic sul foro", async page => {
  // etichette: 6 fori quasi sovrapposti con mira e centro vicini → nessun rettangolo si sovrappone
  const L = await page.evaluate(() => {
    const g = document.createElement("canvas").getContext("2d"), LL = new window.__SA.LabelLayout(g);
    const P = [[100, 100], [108, 102], [104, 110], [96, 106], [112, 96], [100, 92]];
    P.forEach(([x, y], i) => { LL.block(x, y, 6); LL.add(String(i + 1), "#000", 11, { x, y, r: 8 }, 2); });
    LL.block(104, 101, 8); LL.add("ES 12,3 mm · 0,12 MIL", "#000", 12, { x: 104, y: 80, r: 0, pref: "top" }, 1);
    LL.draw();
    const R = LL.rects, ov = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
    let n = 0; for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) if (ov(R[i], R[j])) n++;
    const onHole = R.filter(r => P.some(([x, y]) => x > r.x + 1 && x < r.x + r.w - 1 && y > r.y + 1 && y < r.y + r.h - 1)).length;
    return { n, count: R.length, onHole };
  });
  assert.strictEqual(L.count, 7); assert.strictEqual(L.n, 0, "etichette sovrapposte"); assert.strictEqual(L.onHole, 0, "etichetta sopra il centro di un foro");
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS.slice(0, 3));
  await page.waitForSelector("#livePanel:not([hidden])");
  let lp = await page.textContent("#livePanel");
  ok2(/meno di 5 colpi – statistiche indicative/.test(lp), "avviso con 3 colpi: " + lp);
  for (const s of SHOTS.slice(3)) await clickAt(page, s);
  lp = await page.textContent("#livePanel");
  const r = await analyzeActive(page);
  ok2(!/meno di 5/.test(lp), "nessun avviso con 5 colpi");
  ok2(lp.includes(r.mm.es.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })), "ES aggiornato: " + lp);
  ok2(/Fori\s*5/.test(lp), "numero di fori: " + lp);
  await page.click("#bLiveClose"); ok2(await page.isHidden("#livePanel"), "si chiude");
  ok2(!(await page.isChecked("#livePanelOn")), "e la scelta resta in Visualizzazione");
  await page.check("#livePanelOn"); ok2(await page.isVisible("#livePanel"), "si riapre");
  // tooltip
  await key(page, "1");
  const s2 = await screenOf(page, SHOTS[1]); await page.mouse.move(s2.x, s2.y);
  await page.waitForSelector("#holeTip:not([hidden])");
  const tip = await page.textContent("#holeTip");
  ok2(/Foro 2/.test(tip) && /mm dalla mira/.test(tip) && /ore \d+/.test(tip) && /alzo \+?0/.test(tip), "tooltip: " + tip);
  await page.mouse.move(s2.x + 120, s2.y + 120); ok2(await page.isHidden("#holeTip"), "lontano dal foro sparisce");
  // doppio clic → riga della tabella
  await page.evaluate(() => { document.getElementById("sec-points").open = false; });
  const s4 = await screenOf(page, SHOTS[3]); await page.mouse.dblclick(s4.x, s4.y);
  ok2(await page.evaluate(() => document.getElementById("sec-points").open), "sezione aperta");
  await page.waitForSelector("#points tr.flash.sel");
  ok2(/Foro 4/.test(await page.textContent("#points tr.flash")), "riga del foro 4 evidenziata");
  assert.strictEqual((await S(page)).g.shots.length, 5, "il doppio clic non aggiunge fori");
});

test("freccia di correzione sulla foto e correzione virtuale", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100); await setField(page, "#clickVal", 0.1); await page.selectOption("#clickUnit", "MIL");
  const C = await page.evaluate(() => { const S = window.__SA, g = S.state.groups[0], cc = S.calcContext(), r = S.Calc.analyze(g.shots, g.poa, cc);
    return { pc: S.correctedCenter(g, cc, r), poa: g.poa, k: cc.pxPerMm }; });
  // dopo i click arrotondati il centro resta entro mezzo click (0,05 MIL a 100 m = 5 mm) dalla mira su ogni asse
  ok2(Math.abs(C.pc.res.dx) <= 5.0001 && Math.abs(C.pc.res.dy) <= 5.0001, "residuo entro mezzo click: " + JSON.stringify(C.pc.res));
  near(C.pc.x, C.poa.x + C.pc.res.dx * C.k, 1e-6, "x del centro previsto");
  const s0 = await canvasSig(page);
  await page.uncheck("#corrArrowOn"); await page.waitForTimeout(100);
  const s1 = await canvasSig(page); ok2(s1 !== s0, "la freccia si toglie");
  await page.check("#corrArrowOn"); await page.waitForTimeout(100);
  const before = JSON.stringify((await S(page)).g.shots), res0 = await page.textContent("#results");
  await page.click("#results button[data-vcorr]"); await page.waitForTimeout(100);
  ok2(await page.evaluate(() => window.__SA.state.virtCorr === true), "attiva");
  ok2(await canvasSig(page) !== s0, "fori spostati disegnati");
  ok2(/Correzione virtuale attiva/.test(await page.textContent("#livePanel")), "segnalata nel pannello");
  assert.strictEqual(JSON.stringify((await S(page)).g.shots), before, "i dati non cambiano");
  ok2(await page.evaluate(() => window.__SA.buildSession().params.virtCorr === undefined), "non salvata nella sessione");
  await page.click("#results button[data-vcorr]"); await page.waitForTimeout(100);
  ok2(await page.evaluate(() => !window.__SA.state.virtCorr), "si toglie");
  assert.strictEqual(await page.textContent("#results"), res0, "risultati invariati");
});

test("semaforo della calibrazione, densità, layout del pannello ed effetto dei fori", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, [...SHOTS, { x: 520, y: 330 }]);
  // 200 px di scala → ±0,71%: giallo
  ok2(await page.isVisible("#calStatus .calsem.s-y"), "semaforo giallo con 200 px");
  ok2(/Qualità della calibrazione/.test(await page.textContent("#calStatus")), "testo");
  await key(page, "2"); await clickAt(page, { x: 20, y: 580 }); await clickAt(page, { x: 780, y: 580 }); await setField(page, "#calDist", 190);
  ok2(await page.isVisible("#calStatus .calsem.s-g"), "verde con 760 px");
  // effetto dei fori: il colpo lontano allarga (rosso) ES e raggio medio
  const cells = await page.$$eval("#points tr[data-ref]", trs => trs.filter(tr => /Foro/.test(tr.textContent)).map(tr => tr.querySelector(".inf-w, .inf-b, .inf-0") ? [...tr.querySelectorAll("span[class^=inf]")].map(s => s.className) : null));
  assert.deepStrictEqual(cells[5], ["inf-w", "inf-w"], "il colpo lontano peggiora ES e RM");
  ok2(cells.slice(0, 5).every(c => c && c[0] !== "inf-b"), "togliere un foro non può stringere l'ES");
  await page.check("#points input[data-ex] >> nth=5");
  const ex = await page.$$eval("#points tr.excl span[class^=inf]", s => s.map(x => x.className));
  assert.deepStrictEqual(ex, ["inf-w", "inf-w"], "escluso: rimetterlo peggiorerebbe");
  ok2(/Effetto ES \/ RM/.test(await page.textContent("#points thead")), "colonna");
  // densità
  await page.selectOption("#densSel", "compact");
  ok2(await page.evaluate(() => getComputedStyle(document.querySelector("#results .rc-more")).display === "none"), "compatta: dettagli delle card nascosti");
  await page.selectOption("#densSel", "detail");
  ok2(await page.evaluate(() => [...document.querySelectorAll("#results details.meas")].every(d => d.open)), "dettagliata: riquadri aperti");
  // layout
  await page.click("#bLayout"); ok2(await page.isVisible("#layoutPop"), "pannello layout");
  const ord0 = await page.evaluate(() => window.__SA.getLayout().map(x => x.id));
  await page.click('#layoutPop button[data-lm="sec-points"][data-d="-1"]');
  const ord1 = await page.evaluate(() => window.__SA.getLayout().map(x => x.id)), i0 = ord0.indexOf("sec-points");
  assert.strictEqual(ord1[i0 - 1], "sec-points", "sezione spostata in su");
  await page.uncheck('#layoutPop input[data-lv="sec-load"]');
  ok2(await page.isHidden("#sec-load"), "sezione nascosta");
  await page.reload(); await page.waitForFunction(() => window.__SA && window.__SA.state);
  assert.strictEqual(await page.inputValue("#densSel"), "detail", "densità ricordata");
  assert.deepStrictEqual(await page.evaluate(() => window.__SA.getLayout().map(x => x.id)), ord1, "ordine ricordato");
  ok2(await page.isHidden("#sec-load"), "visibilità ricordata");
  await page.click("#bLayout"); await page.click("#bLayReset");
  assert.deepStrictEqual(await page.evaluate(() => window.__SA.getLayout().map(x => x.id)), ord0, "layout ripristinato");
  ok2(await page.isVisible("#sec-load >> xpath=..") , "sezione di nuovo visibile");
  await page.selectOption("#densSel", "standard");
});

test("croce estesa della mira, quadrante del vento e profili di ricarica", async page => {
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  // croce: con lo strumento Mira l'immagine cambia rispetto a Scala con il cursore nello stesso punto
  await key(page, "l");   // lente spenta: la croce deve seguire il cursore anche senza lente (correzione 1.13.1)
  const h = await screenOf(page, { x: 200, y: 400 });
  await key(page, "2"); await page.mouse.move(h.x, h.y); await page.waitForTimeout(80); const a = await canvasSig(page);
  await key(page, "3"); await page.mouse.move(h.x + 1, h.y); await page.mouse.move(h.x, h.y); await page.waitForTimeout(80); const b = await canvasSig(page);
  ok2(a !== b, "linee della croce disegnate");
  const px = await page.evaluate(({ x, y }) => { const c = document.getElementById("canvas"), r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1, g = c.getContext("2d");
    let best = 0;
    for (const dy of [-1, 0, 1]) { const row = g.getImageData(Math.round((x - r.left + 40) * d), Math.floor((y - r.top) * d) + dy, Math.round(200 * d), 1).data; let dark = 0;
      for (let i = 0; i < row.length; i += 4) if (row[i] < 170 && row[i + 1] < 170 && row[i + 2] < 170) dark++; best = Math.max(best, dark); }
    return best; }, h);
  ok2(px > 20, "tratteggio scuro lungo l'orizzontale: " + px);
  // quadrante del vento
  await page.evaluate(() => { document.getElementById("sec-load").open = true; });
  await setField(page, "#ld-wind", 10); await page.selectOption("#ld-windUnit", "km/h");
  await page.click('#windDial g[data-h="3"]');
  assert.strictEqual((await S(page)).g.load.windDir, "3");
  ok2(/laterale 10,0 km\/h da destra/.test(await page.textContent("#windInfo")) && /frontale 0/.test(await page.textContent("#windInfo")), await page.textContent("#windInfo"));
  await page.click('#windDial g[data-h="3"]'); assert.strictEqual((await S(page)).g.load.windDir, "", "secondo clic: tolta");
  await page.focus('#windDial g[data-h="12"]'); await page.keyboard.press("Enter");
  assert.strictEqual((await S(page)).g.load.windDir, "12", "da tastiera");
  ok2(/frontale 10,0 km\/h/.test(await page.textContent("#windInfo")), "vento contro");
  ok2(/Vento/.test(await page.textContent("#results")) && /Componente frontale/.test(await page.textContent("#results")), "card del vento");
  const W = await page.evaluate(() => window.__SA.Calc.windComponents(4, 2));
  near(W.cross, 4 * Math.sin(Math.PI / 3), 1e-12, "laterale"); near(W.head, 2, 1e-12, "frontale");
  // profili
  await setField(page, "#ld-case", "Lapua"); await setField(page, "#ld-powder", "N140"); await setField(page, "#ld-charge", "44.5");
  await setField(page, "#ld-bullet", "SMK 168"); await setField(page, "#ld-primer", "CCI BR2");
  await page.selectOption("#caliberPreset", { index: 1 }); const cal = await page.inputValue("#caliber");
  await page.click("#bProfSave");
  let P = await page.evaluate(() => window.__SA.getProfiles());
  assert.strictEqual(P.length, 1); ok2(/SMK 168 · N140 44,5 gr/.test(P[0].name), "nome automatico: " + P[0].name);
  assert.strictEqual(await page.inputValue("#ldProfile"), P[0].name, "profilo riconosciuto come quello in uso");
  await setField(page, "#ld-powder", "Varget"); await setField(page, "#caliber", 9);
  assert.strictEqual(await page.inputValue("#ldProfile"), "", "dati cambiati: nessun profilo");
  await page.selectOption("#ldProfile", P[0].name);
  const L = (await S(page)).g.load;
  ok2(L.powder === "N140" && L.case === "Lapua" && L.primer === "CCI BR2" && L.charge === "44.5", "dati applicati al gruppo: " + JSON.stringify(L));
  assert.strictEqual(await page.inputValue("#caliber"), cal, "calibro dal profilo");
  ok2(L.windDir === "12", "condizioni del giorno non toccate");
  await page.fill("#ldProfName", "Gara"); await page.click("#bProfSave");
  const ex = await download(page, "#bProfExp");
  ok2(/\.json$/.test(ex.name) && JSON.parse(ex.text).profiles.length === 2, "esportati");
  await page.evaluate(n => window.__SA.deleteProfile(n), P[0].name);
  assert.strictEqual((await page.evaluate(() => window.__SA.getProfiles())).length, 1, "eliminato");
  assert.strictEqual(await page.evaluate(t => window.__SA.importProfilesText(t), ex.text), 2, "reimportati");
  assert.strictEqual((await page.evaluate(() => window.__SA.getProfiles())).length, 2, "uniti per nome");
  assert.strictEqual(await page.evaluate(() => window.__SA.importProfilesText("{}")), 0, "file non valido");
});

test("ritaglio definitivo: rettangolo, punti spostati, misure invariate, annulla", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await page.evaluate(() => window.__SA.setRotation(4));
  const r0 = await analyzeActive(page), s0 = await S(page);
  await page.evaluate(() => { document.getElementById("sec-orient").open = true; });
  await page.click("#bCrop"); assert.strictEqual((await S(page)).mode, "crop");
  const drag = async (p, q) => { const a = await screenOf(page, p), b = await screenOf(page, q); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up(); };
  await drag({ x: 330, y: 200 }, { x: 500, y: 300 });   // taglia fuori la mira
  ok2(/restano fuori/.test(await page.textContent("#cropStatus")), "avviso: mira fuori");
  ok2(!(await page.evaluate(() => window.__SA.applyCrop())), "rifiutato"); assert.strictEqual((await S(page)).g.shots[0].x, s0.g.shots[0].x);
  await drag({ x: 250, y: 150 }, { x: 520, y: 330 });
  const rect = await page.evaluate(() => window.__SA.state.cropRect);
  ok2(/punti di scala\/controllo restano fuori/.test(await page.textContent("#cropStatus")), "scala fuori: consentito con nota");
  await key(page, "Enter"); await page.waitForFunction(() => !!window.__SA.state.cropUndo);
  const s1 = await S(page), r1 = await analyzeActive(page);
  assert.deepStrictEqual([await page.evaluate(() => window.__SA.state.image.w), await page.evaluate(() => window.__SA.state.image.h)], [rect.w, rect.h], "nuova foto");
  assert.strictEqual(s1.rot, 0, "rotazione incorporata");
  near(s1.g.shots[2].x, s0.g.shots[2].x - rect.x, 1e-9, "foro spostato"); near(s1.g.poa.y, s0.g.poa.y - rect.y, 1e-9, "mira spostata");
  near(s1.ctxPx, s0.ctxPx, 1e-12, "scala invariata"); near(r1.mm.es, r0.mm.es, 1e-9, "group size invariato");
  near(r1.correction.hAng, r0.correction.hAng, 1e-9, "correzione invariata"); assert.strictEqual(r1.correction.hClicks, r0.correction.hClicks);
  ok2(await page.isDisabled("#bUndo"), "la storia riparte dalla foto ritagliata");
  const ses = await page.evaluate(() => window.__SA.buildSession(true));
  ok2(ses.image.w === rect.w && /^data:image\/png/.test(ses.image.dataUrl), "sessione con la foto ritagliata");
  await page.click("#bCropUndo"); await page.waitForFunction(() => !window.__SA.state.cropUndo);
  const s2 = await S(page);
  assert.strictEqual(await page.evaluate(() => window.__SA.state.image.w), 800, "foto originale");
  near(s2.rot, 4, 1e-9, "rotazione ripristinata"); near(s2.g.shots[2].x, s0.g.shots[2].x, 1e-9, "punti ripristinati");
  // scala solo dalla prospettiva: diventa una scala a 2 punti equivalente
  await page.evaluate(() => { const S = window.__SA; S.state.calib = { p1: null, p2: null }; S.setRotation(0); });
  await setField(page, "#perspW", 150); await setField(page, "#perspH", 100);
  await page.evaluate(() => window.__SA.applyPersp([{ x: 100, y: 100 }, { x: 700, y: 110 }, { x: 690, y: 520 }, { x: 110, y: 500 }]));
  await page.waitForFunction(() => !window.__SA.state.busy && window.__SA.state.persp);
  const k0 = await page.evaluate(() => window.__SA.calcContext().pxPerMm);
  const B = await page.evaluate(() => { const S = window.__SA; return { b: S.state.base.w, h: S.state.base.h }; });
  await page.evaluate(B => { const S = window.__SA; S.state.cropRect = { x: 5, y: 5, w: B.b - 10, h: B.h - 10 }; }, B);
  await page.evaluate(() => { const S = window.__SA, g = S.state.groups[0]; g.poa = { x: 50, y: 50 }; g.shots = [{ id: 900, x: 60, y: 60 }]; });
  ok2(await page.evaluate(() => window.__SA.applyCrop()), "ritaglio con prospettiva");
  near(await page.evaluate(() => window.__SA.calcContext().pxPerMm), k0, 1e-9, "scala dal rettangolo conservata");
  ok2(await page.evaluate(() => !window.__SA.state.persp && !!window.__SA.state.calib.p2), "prospettiva incorporata, scala a 2 punti");
});

test("risultati a card e file ZIP di sessione: salva, riapri, storico, ZIP compresso", async page => {
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  await page.waitForFunction(() => { const S = window.__SA, D = S.diagInfo(S.state.groups[0]); return D && D !== "pending"; });
  const keys = await page.$$eval("#results .rcard", a => a.map(e => e.dataset.key));
  assert.deepStrictEqual(keys, ["gqi", "es", "mr", "corr", "shape", "stab", "sgqi"], "card (GQI dalla 1.16, stabilità da 5 colpi, GQI della sessione)");
  ok2(/3 click SINISTRA/.test(await page.textContent('#results .rcard[data-key="corr"] .rc-main')), "correzione in evidenza");
  ok2(!(await page.isVisible('#results .rcard[data-key="mr"] .rc-more table')), "dettagli chiusi");
  await page.click('#results .rcard[data-key="mr"] .rc-more > summary');
  await clickAt(page, { x: 430, y: 255 });
  ok2(await page.isVisible('#results .rcard[data-key="mr"] .rc-more table'), "dettagli ancora aperti dopo l'aggiornamento");
  ok2(/R99/.test(await page.textContent('#results .rcard[data-key="mr"]')), "R99 nei dettagli");
  await page.click('#results .rc-t a.gl >> nth=0'); ok2(await page.evaluate(() => window.__SA.helpOpen()), "titolo collegato al glossario"); await key(page, "Escape");
  // ZIP di sessione
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#bSaveZip")]);
  ok2(/\.zip$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const fs = require("fs"), zbuf = fs.readFileSync(await dl.path());
  const names = await page.evaluate(async b64 => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return [...(await window.__SA.readZip(new Blob([u]))).keys()]; }, zbuf.toString("base64"));
  assert.deepStrictEqual(names, ["manifest.json", "sessione.json", "foto.png", "fori.csv", "gruppi.csv", "LEGGIMI.txt"]);
  const g0 = (await S(page)).g;
  // riapertura in una pagina nuova (senza foto caricata)
  const p2 = await openApp(page.context());
  await p2.setInputFiles("#fJson", { name: "sessione.zip", mimeType: "application/zip", buffer: zbuf });
  await p2.waitForFunction(() => window.__SA.state.image && window.__SA.state.groups[0].shots.length === 6);
  const g1 = await p2.evaluate(() => JSON.parse(JSON.stringify(window.__SA.state.groups[0])));
  assert.deepStrictEqual(g1.shots.map(s => [s.x, s.y]), g0.shots.map(s => [s.x, s.y]), "fori riaperti");
  assert.strictEqual(await p2.evaluate(() => window.__SA.state.image.w), 800, "foto riaperta");
  // storico del confronto da ZIP e ZIP ricompresso (deflate)
  await p2.setInputFiles("#fHist", [{ name: "a.zip", mimeType: "application/zip", buffer: zbuf }, { name: "b.zip", mimeType: "application/zip", buffer: deflateZip(zbuf) }]);
  await p2.waitForFunction(() => window.__SA.cmpState.history.length >= 1);
  ok2(/1 gruppi aggiunti|1 groups added/.test(await p2.textContent("#toast")), await p2.textContent("#toast"));   // stessa sessione due volte: un solo gruppo
  const dz = await p2.evaluate(async b64 => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const L = await window.__SA.sessionsFromZip(new Blob([u])); return L.map(s => [s.groups[0].shots.length, /^data:image\/png/.test(s.image.dataUrl)]); }, deflateZip(zbuf).toString("base64"));
  assert.deepStrictEqual(dz, [[6, true]], "ZIP compresso letto con la foto");
  for (const p of page.context().pages()) if (p !== page) { assert.deepStrictEqual(p.problems, [], "errori nella seconda pagina"); await p.close(); }
});
/** Ricomprime uno ZIP «store» con deflate (come la cartella compressa di Windows), con un piccolo scrittore ZIP in Node. */
function deflateZip(buf) {
  const zlib = require("zlib"), out = [], cen = []; let off = 0;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let e = buf.length - 22; while (dv.getUint32(e, true) !== 0x06054b50) e--;
  let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
  for (let k = 0; k < n; k++) {
    const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), lo = dv.getUint32(p + 42, true);
    const name = buf.subarray(p + 46, p + 46 + nl), start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    const data = zlib.deflateRawSync(buf.subarray(start, start + size));
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(size, 22); h.writeUInt16LE(nl, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(size, 24); c.writeUInt16LE(nl, 28); c.writeUInt32LE(off, 42);
    out.push(h, name, data); cen.push(c, name); off += 30 + nl + data.length; p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  const cd = Buffer.concat(cen), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(n, 8); end.writeUInt16LE(n, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...out, cd, end]);
}

test("stabilità colpo dopo colpo e ordine di sparo", async page => {
  await loadTarget(page);
  const PTS = [{ x: 304, y: 270 }, { x: 345, y: 230 }, { x: 270, y: 250 }, { x: 330, y: 290 }, { x: 290, y: 205 }, { x: 470, y: 120 }, { x: 140, y: 380 }];
  await setupGroup(page, POA, PTS);
  const S0 = await page.evaluate(() => window.__SA.stabInfo(window.__SA.state.groups[0]));
  assert.strictEqual(S0.steps.length, 6, "dal 2° al 7° colpo");
  const es = await page.evaluate(() => { const C = window.__SA.Calc, P = window.__SA.state.groups[0].shots; return P.slice(1).map((_, i) => C.extremeSpread(P.slice(0, i + 2)).d); });
  S0.steps.forEach((s, i) => near(s.es, es[i], 1e-9, "ES progressivo " + (i + 2)));
  ok2(S0.open && S0.open.from === 6 && S0.open.p < 0.05, "si apre dal 6° colpo: " + JSON.stringify(S0.open));
  ok2(/si apre dal colpo 6/.test(await page.textContent('#results .rcard[data-key="stab"]')), "card dei risultati");
  // grafici
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
  await page.waitForTimeout(300);
  ok2(await page.isVisible("#chStab") && await page.isVisible("#chStabC"), "grafici visibili");
  ok2(/Il gruppo si apre dal colpo 6/.test(await page.textContent("#chStabNote")), "nota del grafico");
  ok2(/Distanza massima dal centro finale/.test(await page.textContent("#chStabCNote")), "nota della traiettoria");
  ok2(await page.evaluate(() => window.__SA.CH.hits.stab.length === 6 && window.__SA.CH.hits.stabc.length === 6), "punti con tooltip");
  await key(page, "Escape");
  // riordino: il colpo largo spostato all'inizio → nessuna apertura tardiva
  await page.evaluate(() => { document.getElementById("sec-points").open = true; });
  const id6 = (await S(page)).g.shots[5].id;
  for (let i = 0; i < 5; i++) await page.click(`#points button[data-mv*='"id":${id6}'][data-d="-1"]`);
  const g1 = (await S(page)).g;
  assert.strictEqual(g1.shots[0].id, id6, "foro spostato al primo posto");
  ok2(await page.isDisabled(`#points button[data-mv*='"id":${id6}'][data-d="-1"]`), "primo: ↑ disattivato");
  const S1 = await page.evaluate(() => window.__SA.stabInfo(window.__SA.state.groups[0]));
  ok2(!(S1.open.p < 0.05) || S1.open.from !== 6, "con l'ordine cambiato la diagnosi cambia");
  near(S1.steps[S1.steps.length - 1].es, S0.steps[S0.steps.length - 1].es, 1e-9, "il group size finale non dipende dall'ordine");
  await page.evaluate(() => window.__SA.undo());
  ok2((await S(page)).g.shots[0].id !== id6, "lo spostamento si annulla con Annulla");
  const ses = await page.evaluate(() => window.__SA.buildSession());
  ok2(Array.isArray(ses.groups[0].shots), "ordine salvato nella sessione (ordine dell'array)");
});

/* ------------------------------ 1.15.0 ------------------------------ */
/** Pixel della vista principale (coordinate mondo) → [r, g, b]. */
const pixelAt = (page, p) => page.evaluate(p => { const { toScreen } = window.__SA, s = toScreen(p), c = document.getElementById("canvas"), d = window.devicePixelRatio || 1;
  return [...c.getContext("2d").getImageData(Math.round(s.x * d), Math.round(s.y * d), 1, 1).data].slice(0, 3); }, p);
const redraw = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

test("1.15.0: colori dei gruppi senza giallo, linea elastica della scala, campo dello zoom", async page => {
  // palette: nessun colore chiaro (contrasto ≥ 3,5:1 sul beige), i vecchi colori delle sessioni vengono rimappati
  const pal = await page.evaluate(() => { const { GROUP_COLORS, fixColor } = window.__SA;
    const L = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const beige = L("#efe4c8"); return { min: Math.min(...GROUP_COLORS.map(c => (beige + 0.05) / (L(c) + 0.05))), amber: fixColor("#f59e0b"), keep: fixColor("#2563eb"), n: new Set(GROUP_COLORS).size }; });
  ok2(pal.min >= 3.5, "contrasto minimo sul beige " + pal.min); assert.strictEqual(pal.amber, "#c2410c"); assert.strictEqual(pal.keep, "#2563eb"); assert.strictEqual(pal.n, 8);
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  const ses = await page.evaluate(() => { const s = window.__SA.buildSession(true); s.groups[0].color = "#f59e0b"; return JSON.stringify(s); });
  await page.evaluate(t => window.__SA.loadSessionText(t), ses);
  assert.strictEqual((await S(page)).g.color, "#c2410c", "giallo di una sessione 1.14 rimappato");
  // linea elastica: dopo il primo punto della scala, tratteggio verde fino al cursore
  await page.click("#bClear").catch(() => {});
  await page.evaluate(() => { window.__SA.state.calib = { p1: null, p2: null }; window.__SA.commit(); });
  await key(page, "2"); await clickAt(page, { x: 100, y: 100 });
  const far = await screenOf(page, { x: 400, y: 220 }); await page.mouse.move(far.x, far.y, { steps: 3 }); await redraw(page);
  let green = 0;
  for (let t = 0.1; t < 0.9; t += 0.02) { const [r, g, b] = await pixelAt(page, { x: 100 + 300 * t, y: 100 + 120 * t }); if (g > 120 && r < 90 && b < 110) green++; }
  ok2(green >= 8, "linea tratteggiata verde tra il primo punto e il cursore: " + green);
  await clickAt(page, { x: 300, y: 100 });
  ok2((await S(page)).calib.p2, "secondo punto inserito");
  // zoom senza rotella: campo, pulsanti, tasti
  await page.fill("#zoomPct", "250"); await page.press("#zoomPct", "Enter");
  near(await page.evaluate(() => window.__SA.state.view.scale), 2.5, 1e-9, "zoom dal campo");
  assert.strictEqual(await page.inputValue("#zoomPct"), "250");
  await page.click("#bZoomIn"); near(await page.evaluate(() => window.__SA.state.view.scale), 3, 1e-9, "zoom +");
  await page.click("#bZoomOut"); await page.click("#bZoomOut"); near(await page.evaluate(() => window.__SA.state.view.scale), 1.5, 1e-9, "zoom − due volte (300 → 200 → 150%)");
  await key(page, "-"); near(await page.evaluate(() => window.__SA.state.view.scale), 1, 1e-9, "tasto −");
  await key(page, "+"); near(await page.evaluate(() => window.__SA.state.view.scale), 1.5, 1e-9, "tasto +");
});

test("1.15.0: blocco di fori, mira, scala e riferimento", async page => {
  page.on("dialog", d => d.accept());
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await clickAt(page, SHOTS[0]);   // in modalità Foro il clic su un foro lo seleziona
  await key(page, "k");
  let s = await S(page);
  ok2(s.g.shots[0].lock, "foro 1 bloccato con K");
  // trascinamento: il foro resta dove era (si sposta la vista)
  const a = await screenOf(page, SHOTS[0]);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + 30, a.y + 20, { steps: 6 }); await page.mouse.up();
  s = await S(page); near(s.g.shots[0].x, SHOTS[0].x, 1, "foro bloccato non trascinato");
  // Canc, tasto destro, ✕ della tabella
  await key(page, "Delete"); assert.strictEqual((await S(page)).g.shots.length, 5, "Canc ignorato");
  const b = await screenOf(page, s.g.shots[0]); await page.mouse.click(b.x, b.y, { button: "right" });
  assert.strictEqual((await S(page)).g.shots.length, 5, "tasto destro ignorato");
  ok2(await page.isDisabled(`#points button[data-del*='"id":${s.g.shots[0].id}']`), "✕ della tabella disattivato");
  ok2(await page.$(`#points button.lockbtn.on[data-lock*='"id":${s.g.shots[0].id}']`), "lucchetto chiuso nella tabella");
  // «Elimina ultimo» con l'ultimo foro bloccato
  await page.click(`#points button[data-lock*='"id":${s.g.shots[4].id}']`);
  await page.click("#bDelLast"); assert.strictEqual((await S(page)).g.shots.length, 5, "ultimo bloccato: niente eliminazione");
  // mira bloccata: un nuovo clic in modalità Mira non la sposta
  await page.evaluate(() => { const { state, setLock } = window.__SA; setLock({ kind: "poa", gid: state.activeGroupId }, true); });
  await key(page, "3"); await clickAt(page, { x: 250, y: 300 });
  s = await S(page); near(s.g.poa.x, POA.x, 1e-3, "mira bloccata"); ok2(s.g.poa.lock, "lock della mira");
  // scala bloccata: un nuovo clic in modalità Scala non la rifà; il pulsante mostra lo stato
  await page.click("#bCalLock"); ok2((await S(page)).calib.lock, "scala bloccata");
  assert.match(await page.textContent("#bCalLock"), /🔒/);
  await key(page, "2"); await clickAt(page, { x: 600, y: 400 });
  near((await S(page)).calib.p1.x, 100, 1e-3, "scala bloccata: il primo punto resta");
  // riferimento di controllo: si trascina se libero, non se bloccato
  await page.click("#bRef"); await clickAt(page, { x: 100, y: 400 }); await clickAt(page, { x: 300, y: 400 });
  const r = await screenOf(page, { x: 300, y: 400 });
  await page.mouse.move(r.x, r.y); await page.mouse.down(); await page.mouse.move(r.x + 20, r.y, { steps: 5 }); await page.mouse.up();
  ok2((await S(page)).calib.r2.x > 303, "riferimento trascinato (dalla 1.15.0)");
  await page.click("#bRefLock"); ok2((await S(page)).calib.refLock, "riferimento bloccato");
  ok2(await page.isDisabled("#bRefDel"), "✕ del riferimento disattivato se bloccato");
  // la rotazione trasforma anche gli elementi bloccati (seguono la foto) e il riferimento di controllo (correzione 1.15.0)
  const before = await S(page);
  await page.click("#bRotR");
  const after = await S(page);
  ok2(Math.abs(after.g.shots[0].x - before.g.shots[0].x) > 5, "foro bloccato ruotato con la foto");
  near(Math.hypot(after.calib.r2.x - after.calib.r1.x, after.calib.r2.y - after.calib.r1.y), Math.hypot(before.calib.r2.x - before.calib.r1.x, before.calib.r2.y - before.calib.r1.y), 1e-6, "riferimento ruotato rigidamente");
  ok2(Math.abs(after.calib.r1.y - before.calib.r1.y) > 5, "il riferimento ha seguito la rotazione");
  await key(page, "Control+z");
  // sessione: i blocchi restano
  await page.evaluate(t => window.__SA.loadSessionText(t), JSON.stringify(await page.evaluate(() => window.__SA.buildSession(true))));
  s = await S(page); ok2(s.g.shots[0].lock && s.g.shots[4].lock && s.g.poa.lock && s.calib.lock && s.calib.refLock, "blocchi salvati nella sessione");
  // «Tutto»: restano gli elementi bloccati
  await page.click("#bClear");
  s = await S(page);
  assert.strictEqual(s.g.shots.length, 2, "restano i 2 fori bloccati"); ok2(s.g.poa && s.calib.p1 && s.calib.r1, "restano mira, scala e riferimento bloccati");
  // sblocco: il foro torna eliminabile
  await page.evaluate(() => { const { state, toggleLock } = window.__SA, g = state.groups[0]; toggleLock({ kind: "shot", gid: g.id, id: g.shots[0].id }); });
  await page.evaluate(() => { const { state, deleteRef } = window.__SA, g = state.groups[0]; deleteRef({ kind: "shot", gid: g.id, id: g.shots[0].id }); });
  assert.strictEqual((await S(page)).g.shots.length, 1, "sbloccato ed eliminato");
});

test("1.15.0: gruppi nascosti, eliminazione del riferimento di controllo", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await page.click("#bAddGroup"); await key(page, "3"); await clickAt(page, { x: 600, y: 400 }); await clickAt(page, { x: 640, y: 420 }); await clickAt(page, { x: 650, y: 380 });
  const g1 = await page.evaluate(() => window.__SA.state.groups[0].id);
  const px0 = await pixelAt(page, SHOTS[0]);
  await page.click(`#groups button[data-eye="${g1}"]`);
  ok2(await page.evaluate(id => window.__SA.state.hiddenGroups.has(id), g1), "gruppo 1 nascosto");
  await redraw(page);
  const px1 = await pixelAt(page, SHOTS[0]);
  ok2(px1.join() !== px0.join(), "il foro del gruppo nascosto non è più disegnato");
  const sp = await screenOf(page, SHOTS[0]);
  assert.strictEqual(await page.evaluate(p => { const r = document.getElementById("canvas").getBoundingClientRect(); return window.__SA.hitTest(p.x - r.left, p.y - r.top); }, sp), null, "i suoi punti non si prendono");
  ok2(await page.$(`#groups .g.hiddeng`), "riga del gruppo segnata come nascosta");
  // calcoli, confronto e sessione: invariati / conservati
  const rows = await page.evaluate(() => window.__SA.compareRows().length); assert.strictEqual(rows, 2, "il gruppo nascosto resta nel confronto");
  const ses = await page.evaluate(() => window.__SA.buildSession(true)); assert.deepStrictEqual(ses.hiddenGroups, [g1]);
  await page.evaluate(t => window.__SA.loadSessionText(t), JSON.stringify(ses));
  ok2(await page.evaluate(id => window.__SA.state.hiddenGroups.has(id), g1), "nascosto anche dopo la riapertura");
  // un foro aggiunto al gruppo nascosto lo rende visibile
  await page.evaluate(id => { window.__SA.state.activeGroupId = id; window.__SA.commit(); }, g1);
  await key(page, "4"); await clickAt(page, { x: 430, y: 270 });
  ok2(!(await page.evaluate(id => window.__SA.state.hiddenGroups.has(id), g1)), "di nuovo visibile dopo un nuovo foro");
  // riferimento di controllo: ✕ lo elimina (anche Canc sul punto selezionato); la scala resta
  await page.click("#bRef"); await clickAt(page, { x: 100, y: 300 }); await clickAt(page, { x: 300, y: 300 }); await setField(page, "#refLen", 50);
  ok2((await S(page)).calib.r2, "riferimento inserito");
  await page.click("#bRefDel");
  let c = (await S(page)).calib; ok2(!c.r1 && !c.r2 && c.p1 && c.p2, "riferimento eliminato, scala intatta");
  await page.click("#bRef"); await clickAt(page, { x: 100, y: 300 }); await clickAt(page, { x: 300, y: 300 });
  await key(page, "1"); await clickAt(page, { x: 300, y: 300 }); await key(page, "Delete");
  c = (await S(page)).calib; ok2(!c.r1 && c.p1, "riferimento eliminato con Canc");
  await key(page, "Control+z"); ok2((await S(page)).calib.r1, "annulla lo ripristina");
});

test("1.15.0: scala sulla foto e alone di incertezza dei fori", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  const full = await page.evaluate(() => window.__SA.photoSizeMm());
  near(full.w, 200, 0.5, "larghezza reale della foto (800 px a 4 px/mm)"); near(full.h, 150, 0.5, "altezza reale");
  await page.check("#smOn"); await page.dispatchEvent("#smOn", "change");
  assert.match(await page.textContent("#smInfo"), /200 mm × 150 mm/);
  // righello in basso a sinistra: 50 mm (auto: ~1/3 di 150 mm → 50) = 200 px; barre nere e bianche alternate
  await page.selectOption("#smKind", "ruler"); await redraw(page);
  const sc = await page.evaluate(() => window.__SA.state.view.scale), m = 18 / sc, bh = 7 / sc;
  const y = 600 - m - bh - 18 / sc + bh / 2, dark = (await pixelAt(page, { x: m + 10, y })).reduce((a, b) => a + b) < 150, light = (await pixelAt(page, { x: m + 30, y })).reduce((a, b) => a + b) > 600;
  ok2(dark && light, "primo segmento nero, secondo bianco");
  ok2((await pixelAt(page, { x: m + 200 + 6 / sc, y })).reduce((a, b) => a + b) > 600, "il righello finisce a 50 mm (200 px)");
  // cornice: tacche lungo il lato alto
  const tick = { x: 80, y: 10.5 / sc };   // tacca dei 20 mm: 12 px schermo verso l'interno dal lato alto
  await page.uncheck("#smOn"); await page.dispatchEvent("#smOn", "change"); await redraw(page); const t0 = await pixelAt(page, tick);
  await page.check("#smOn"); await page.dispatchEvent("#smOn", "change");
  await page.selectOption("#smKind", "frame"); await redraw(page);
  const t1 = await pixelAt(page, tick);
  ok2(t0.reduce((a, b) => a + b) - t1.reduce((a, b) => a + b) > 150, "tacca dei 20 mm sul lato alto: " + t0 + " → " + t1);
  // export: la Result Card e il report non danno errori con la scala attiva
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const [d] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bCardPng")]);
  ok2(require("fs").statSync(await d.path()).size > 10000, "Result Card salvata");
  // alone: con 1,5 px a mano il raggio al 95% è 3,67 px della foto; con lo zoom 4× si vede attorno al centro
  await setField(page, "#zoomPct", "400"); await page.press("#zoomPct", "Enter");
  await page.evaluate(p => { const { state, toScreen } = window.__SA, s = toScreen(p), c = document.getElementById("canvas"); state.view.ox += c.clientWidth / 2 - s.x; state.view.oy += c.clientHeight / 2 - s.y; }, SHOTS[2]);
  await page.selectOption("#smKind", "both"); await page.uncheck("#smOn"); await page.dispatchEvent("#smOn", "change");
  await redraw(page);
  const off = await pixelAt(page, { x: SHOTS[2].x + 3, y: SHOTS[2].y });
  await page.check("#haloOn"); await page.dispatchEvent("#haloOn", "change"); await redraw(page);
  const on = await pixelAt(page, { x: SHOTS[2].x + 3, y: SHOTS[2].y }), out = await pixelAt(page, { x: SHOTS[2].x + 5, y: SHOTS[2].y });
  ok2(on.join() !== off.join(), "alone entro 3,67 px dal centro");
  near(await page.evaluate(() => window.__SA.Calc.haloRadius(1.5)), 3.6716, 1e-3, "raggio a mano");
  ok2(out.join() !== on.join(), "fuori dall'alone il colore cambia");
  const shotsBefore = (await S(page)).g.shots; await page.uncheck("#haloOn"); await page.dispatchEvent("#haloOn", "change");
  assert.deepStrictEqual((await S(page)).g.shots, shotsBefore, "l'alone non cambia le coordinate");
});

test("1.15.0: note sull'immagine legate a un foro o a una zona, nel report", async page => {
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await key(page, "n"); await clickAt(page, SHOTS[1]);
  let st = await page.evaluate(() => JSON.parse(JSON.stringify(window.__SA.state.notes)));
  assert.strictEqual(st.length, 1); ok2(st[0].sid != null && st[0].x == null, "nota legata al foro 2");
  await page.fill("#notesList textarea", "foro strappato in basso"); await page.dispatchEvent("#notesList textarea", "change");
  await clickAt(page, { x: 600, y: 120 });   // zona
  st = await page.evaluate(() => JSON.parse(JSON.stringify(window.__SA.state.notes)));
  assert.strictEqual(st.length, 2); near(st[1].x, 600, 1e-3, "nota sulla zona"); assert.strictEqual(st[0].text, "foro strappato in basso");
  await page.fill(`#notesList textarea[data-ntext="${st[1].id}"]`, "luce radente da sinistra"); await page.dispatchEvent(`#notesList textarea[data-ntext="${st[1].id}"]`, "change");
  assert.match(await page.textContent("#notesList"), /Foro 2 · Gruppo 1/);
  // il marcatore segue il foro: trascina il foro 2
  await key(page, "Escape"); await key(page, "1");
  const m0 = await page.evaluate(() => { const { noteMarkers, toScreen, state } = window.__SA; return noteMarkers(toScreen, state.view.scale, window.__SA.calcContext())[0]; });
  const a = await screenOf(page, SHOTS[1]);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + 20, a.y + 10, { steps: 5 }); await page.mouse.up();
  const m1 = await page.evaluate(() => { const { noteMarkers, toScreen, state } = window.__SA; return noteMarkers(toScreen, state.view.scale, window.__SA.calcContext())[0]; });
  near(m1.x - m0.x, 20, 1.5, "il marcatore segue il foro (x)"); near(m1.y - m0.y, 10, 1.5, "(y)");
  // clic sul marcatore = selezione della nota
  const mk = await page.evaluate(m => { const r = document.getElementById("canvas").getBoundingClientRect(); return { x: r.left + m.x, y: r.top + m.y }; }, m1);
  await page.mouse.click(mk.x, mk.y);
  assert.deepStrictEqual(await page.evaluate(() => window.__SA.state.selected), { kind: "note", id: st[0].id }, "nota selezionata dal marcatore");
  // rotazione: la nota sulla zona segue la foto
  await page.click("#bRotR");
  const z = await page.evaluate(() => window.__SA.state.notes[1]); ok2(Math.abs(z.x - 600) > 5, "nota sulla zona ruotata");
  await key(page, "Control+z");
  // report: sezione e testo; senza la casella niente note
  let [d] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bPdf")]);
  let T = pdfText(require("fs").readFileSync(await d.path()));
  for (const w of ["Note sull'immagine", "foro strappato in basso", "luce radente da sinistra", "N1 · Foro 2 · Gruppo 1"]) ok2(T.includes(w), "nel report: " + w);
  await page.uncheck("#notesReport");
  [d] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bPdf")]);
  T = pdfText(require("fs").readFileSync(await d.path())); ok2(!T.includes("foro strappato"), "note escluse dal report");
  // sessione; eliminando il foro la nota diventa una nota sulla zona
  const ses = await page.evaluate(() => window.__SA.buildSession(true)); assert.strictEqual(ses.notes.length, 2);
  await page.evaluate(t => window.__SA.loadSessionText(t), JSON.stringify(ses));
  assert.strictEqual(await page.evaluate(() => window.__SA.state.notes.length), 2, "note riaperte");
  await page.evaluate(() => { const { state, deleteRef } = window.__SA, g = state.groups[0]; deleteRef({ kind: "shot", gid: g.id, id: state.notes[0].sid }); });
  const n0 = await page.evaluate(() => window.__SA.state.notes[0]);
  ok2(n0.sid == null && isFinite(n0.x), "nota staccata dal foro eliminato, al suo posto");
  await page.click(`#notesList button[data-ndel="${n0.id}"]`);
  assert.strictEqual(await page.evaluate(() => window.__SA.state.notes.length), 1, "nota eliminata");
});

test("1.15.0: righello libero tra due punti", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  const before = await S(page);
  await key(page, "r");
  await clickAt(page, { x: 100, y: 200 }); await clickAt(page, { x: 300, y: 200 });
  const I = await page.evaluate(() => { const i = window.__SA.rulerInfo(); return { mm: i.M.mm, inch: i.M.inch, MIL: i.M.MIL, MOA: i.M.MOA, deg: i.M.deg, text: i.text }; });
  near(I.mm, 50, 1e-3, "50 mm"); near(I.inch, 50 / 25.4, 1e-4, "pollici"); near(I.MIL, 0.5, 1e-4, "0,5 MRAD a 100 m"); near(I.deg, 0, 1e-3, "orizzontale");
  assert.match(await page.textContent("#hint"), /50,00 mm · 1,969 in · 1,72 MOA · 0,50 MRAD · 0,0° · in asse/);
  // nuova misura in diagonale: 3-4-5
  await clickAt(page, { x: 100, y: 400 }); await clickAt(page, { x: 400, y: 0 });
  const J = await page.evaluate(() => window.__SA.rulerInfo().M);
  near(J.mm, 125, 1e-3, "diagonale 125 mm"); near(J.deg, 53.13, 0.01, "53,13° dall'orizzontale");
  const after = await S(page);
  assert.deepStrictEqual(after.g.shots, before.g.shots, "nessun foro creato o spostato"); assert.deepStrictEqual(after.calib, before.calib, "scala invariata");
  assert.strictEqual(await page.evaluate(() => window.__SA.undoStack.idx), await page.evaluate(() => window.__SA.undoStack.idx), "");
  await key(page, "Escape");
  assert.strictEqual(await page.evaluate(() => window.__SA.state.ruler), null, "Esc chiude il righello");
  ok2(!/"ruler"\s*:/.test(JSON.stringify(await page.evaluate(() => window.__SA.buildSession(false)))), "il righello non va nella sessione");   // (smKind: "ruler" è la scala sulla foto, dalla 1.18 predefinita)
});

test("1.15.0: finestra di dettaglio ancorabile", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await key(page, "d");
  ok2(await page.isVisible("#detailWin"), "finestra aperta");
  await page.click("#bDwPick"); await clickAt(page, SHOTS[0]);
  const pt = await page.evaluate(() => ({ ...window.__SA.detail.pt }));
  near(pt.x, SHOTS[0].x, 1, "punto osservato x"); near(pt.y, SHOTS[0].y, 1, "y");
  assert.strictEqual((await S(page)).g.shots.length, 5, "il clic di scelta non aggiunge fori");
  // lo zoom della vista principale non cambia il dettaglio
  await page.fill("#zoomPct", "300"); await page.press("#zoomPct", "Enter");
  assert.deepStrictEqual(await page.evaluate(() => ({ ...window.__SA.detail.pt })), pt, "punto invariato con lo zoom della vista");
  const z0 = await page.evaluate(() => window.__SA.detail.zoom); await page.click("#bDwIn");
  ok2(await page.evaluate(() => window.__SA.detail.zoom) > z0, "ingrandimento del dettaglio");
  // il canvas del dettaglio mostra la foto (bordo nero del foro sintetico? qui: griglia e marcatori) e non è vuoto
  const filled = await page.evaluate(() => { const c = document.getElementById("dwCanvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] > 200) n++; return n; });
  ok2(filled > 100, "dettaglio disegnato");
  // spostamento della finestra dalla barra e posizione ricordata
  const h = await page.$eval("#detailWin .dw-title", e => { const r = e.getBoundingClientRect(); return { x: r.left + 10, y: r.top + r.height / 2 }; });
  const l0 = await page.$eval("#detailWin", e => e.offsetLeft);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 120, h.y - 40, { steps: 5 }); await page.mouse.up();
  const l1 = await page.$eval("#detailWin", e => e.offsetLeft); near(l1, l0 - 120, 2, "finestra spostata");
  // trascinare dentro sposta il punto osservato
  const c = await page.$eval("#dwCanvas", e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x - 40, c.y, { steps: 4 }); await page.mouse.up();
  const zz = await page.evaluate(() => window.__SA.detail.zoom);
  near(await page.evaluate(() => window.__SA.detail.pt.x), pt.x + 40 / zz, 0.5, "punto spostato trascinando nel dettaglio");
  await page.click("#bDwClose"); ok2(!(await page.isVisible("#detailWin")), "chiusa");
  await page.reload(); await page.waitForFunction(() => window.__SA && window.__SA.state);
  await loadTarget(page); await key(page, "d");
  near(await page.$eval("#detailWin", e => e.offsetLeft), l1, 2, "posizione ricordata");
});

test("1.15.0: differenze tra le configurazioni nel confronto", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#ld-bullet", "Lapua Scenar 155"); await setField(page, "#ld-charge", "44.5"); await setField(page, "#ld-temp", "18");
  await page.click("#bAddGroup");   // copia i dati di ricarica
  await setField(page, "#ld-charge", "45"); await setField(page, "#shotDist", 200);
  await key(page, "3"); await clickAt(page, { x: 600, y: 400 }); for (const p of [{ x: 640, y: 420 }, { x: 650, y: 380 }, { x: 630, y: 400 }]) await clickAt(page, p);
  await key(page, "c");
  const box = await page.textContent("#cmpDiff");
  ok2(/Carica/.test(box) && /Distanza/.test(box), "carica e distanza diverse: " + box.slice(0, 200));
  ok2(!/Palla|Temperatura/.test(box), "palla e temperatura uguali: nascoste");
  assert.match(box, /2 parametri diversi/);
  ok2((await page.$$("#cmpDiff tr.ddif")).length === 2, "2 righe evidenziate");
  const D = await page.evaluate(() => { const d = window.__SA.configDiff(); return { diff: d.diff, partial: d.partial }; });
  assert.deepStrictEqual(D.diff, ["charge", "dist"]);
  // togliendo una riga: servono almeno 2 righe
  await page.uncheck("#cmpBody input[data-dk]:nth-of-type(1) >> nth=0");
  assert.match(await page.textContent("#cmpDiff"), /Seleziona almeno 2 righe/);
  await page.check("#cmpBody input[data-dk] >> nth=0");
  // report: la tabella compare con le differenze
  await page.evaluate(() => { window.showSaveFilePicker = undefined; window.__SA.closeAnalysis(); });
  await page.selectOption("#cardScope", "all");
  const [d] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bPdf")]);
  const T = pdfText(require("fs").readFileSync(await d.path()));
  ok2(T.includes("DIFFERENZE TRA LE CONFIGURAZIONI") && T.includes("Componenti · Carica") && T.includes("45 gr") && T.includes("44,5 gr"), "differenze nel report: " + T.slice(T.indexOf("Confronto tra")).replace(/\n/g, " ").slice(0, 1500));
});

test("1.15.0 in inglese: note, blocco, righello, scala sulla foto, differenze senza testi italiani", async page => {
  page.on("dialog", d => d.accept());
  await page.evaluate(() => window.__SA.setLang("en"));
  await expandAll(page);
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#ld-charge", "44.5");
  await page.check("#smOn"); await page.dispatchEvent("#smOn", "change"); await page.check("#haloOn"); await page.dispatchEvent("#haloOn", "change");
  await key(page, "n"); await clickAt(page, SHOTS[1]); await clickAt(page, { x: 600, y: 120 }); await key(page, "Escape");
  await key(page, "1"); await clickAt(page, SHOTS[0]); await key(page, "k"); await page.click("#bCalLock");
  await key(page, "r"); await clickAt(page, { x: 100, y: 200 }); await clickAt(page, { x: 300, y: 200 });
  assert.match(await page.textContent("#hint"), /^Ruler: .*50\.00 mm · 1\.969 in · 1\.72 MOA · 0\.50 MRAD · 0\.0° · on axis/);
  await key(page, "Escape"); await key(page, "d");
  await page.click("#bAddGroup"); await setField(page, "#ld-charge", "45"); await key(page, "3"); await clickAt(page, { x: 600, y: 400 }); await clickAt(page, { x: 640, y: 420 }); await clickAt(page, { x: 650, y: 380 });
  await page.click(`#groups button.eye >> nth=0`);
  const side = await page.textContent("#side");
  ok2(!ITALIAN.test(side.replace(/bersaglio\.png/g, "")), "nessun italiano nel pannello: " + (side.match(ITALIAN) || [""])[0]);
  assert.match(await page.textContent("#notesList"), /Hole 2 · Group 1/);
  await key(page, "c");
  const diff = await page.textContent("#cmpDiff");
  assert.match(diff, /Charge/); ok2(!ITALIAN.test(diff), "differenze in inglese: " + diff);
  await key(page, "Escape");
  assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.I18N.missing]), [], "testi senza traduzione");
});

/* ------------------------------ 1.16.0: indici di qualità ------------------------------ */
const qiIndep = (page, gi = 0) => page.evaluate(gi => {   // calcolo indipendente dal motore puro con le impostazioni lette dal DOM
  const { state, Calc, calcContext } = window.__SA, g = state.groups[gi], v = id => document.getElementById(id).value;
  const toR = (x, u) => x / Calc.fromRad(1, u), cc = calcContext(g);
  const pts = g.shots.filter(s => !s.excluded), c = Calc.centroid(pts), d = Calc.dispersion(pts);
  const mr = Math.atan(d.sigma / cc.pxPerMm * Math.sqrt(Math.PI / 2) / cc.distMm), ref = toR(+v("qiMrRef"), v("qiMrUnit"));
  const gqi = 100 * Math.exp(-Math.log(1.25) * (mr / ref) ** 2);
  const D = g.poa ? Math.atan(Math.hypot(c.x - g.poa.x, c.y - g.poa.y) / cc.pxPerMm / cc.distMm) : null, dref = toR(+v("qiDRef"), v("qiDUnit"));
  const aqi = D == null ? null : 100 * Math.exp(-Math.log(1.25) * (D / dref) ** 2), w = +v("qiWP") / 100;
  return { n: pts.length, mr, gqi, aqi, tqi: aqi == null ? null : w * gqi + (1 - w) * aqi };
}, gi);
const cardNum = (page, key, nth = 0) => page.$$eval(`#results .rcard[data-key="${key}"] .qi-num`, (els, i) => els[i] ? els[i].textContent : null, nth);

test("1.16.0: GQI e TQI del gruppo, impostazioni, unità, colpi esclusi, casi particolari", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  let I = await qiIndep(page);
  assert.strictEqual(await cardNum(page, "gqi"), String(Math.round(I.gqi)), "GQI nella card = calcolo indipendente");
  const cls = I.gqi >= 90 ? "Ottimo" : I.gqi >= 75 ? "Buono" : I.gqi >= 60 ? "Discreto" : I.gqi >= 40 ? "Scarso" : "Insufficiente";
  assert.match(await page.textContent('#results .rcard[data-key="gqi"]'), new RegExp(`— ${cls}`));
  assert.match(await page.textContent('#results .rcard[data-key="gqi"]'), /IC 95% del punteggio: \d+–\d+/, "attendibilità separata dal punteggio");
  // riferimento più largo → punteggio più alto; MR = ref → 80
  const mrMoa = await page.evaluate(m => window.__SA.Calc.fromRad(m, "MOA"), I.mr);
  await setField(page, "#qiMrRef", mrMoa.toFixed(6));
  assert.strictEqual(await cardNum(page, "gqi"), "80", "MR = MR_ref → 80");
  // stesso valore fisico in MRAD → stesso punteggio
  await setField(page, "#qiMrRef", 0.5); const g1 = await cardNum(page, "gqi");
  await page.selectOption("#qiMrUnit", "MIL"); await setField(page, "#qiMrRef", (0.5 / 3437.746770784939 * 1000).toFixed(8));
  assert.strictEqual(await cardNum(page, "gqi"), g1, "MOA → MRAD senza cambiare il valore fisico");
  await page.selectOption("#qiMrUnit", "MOA"); await setField(page, "#qiMrRef", 0.5);
  // un decimale
  await page.selectOption("#qiDec", "1");
  assert.strictEqual(await cardNum(page, "gqi"), I.gqi.toFixed(1).replace(".", ","), "punteggio con un decimale"); await page.selectOption("#qiDec", "0");
  // colpo escluso: il GQI usa solo i fori inclusi
  await clickAt(page, SHOTS[0]); await key(page, "x");
  I = await qiIndep(page); assert.strictEqual(I.n, 4);
  assert.strictEqual(await cardNum(page, "gqi"), String(Math.round(I.gqi)), "GQI senza il foro escluso");
  assert.match(await page.textContent('#results .rcard[data-key="gqi"]'), /4 \(1 esclusi\)/);
  // riferimento non valido: messaggio e calcolo bloccato
  await setField(page, "#qiMrRef", 0);
  ok2(await page.isVisible("#qiValid"), "messaggio di validazione"); assert.match(await page.textContent("#qiValid"), /maggiore di zero/);
  assert.match(await page.textContent('#results .rcard[data-key="gqi"]'), /Non disponibile: riferimento non valido/);
  await setField(page, "#qiMrRef", -2); assert.match(await page.textContent('#results .rcard[data-key="gqi"]'), /Non disponibile/);
  await setField(page, "#qiMrRef", 0.5);
  // TQI: spento di default, poi acceso; 70/30
  ok2(!(await page.$('#results .rcard[data-key="tqi"]')), "TQI spento di default");
  await page.check("#qiTqiOn"); await page.dispatchEvent("#qiTqiOn", "change");
  assert.strictEqual(await cardNum(page, "tqi"), String(Math.round(I.tqi)), "TQI = 0,7·GQI + 0,3·AQI");
  await setField(page, "#qiWP", 50); I = await qiIndep(page);
  assert.strictEqual(await cardNum(page, "tqi"), String(Math.round(I.tqi)), "TQI con pesi 50/50"); assert.strictEqual(await page.textContent("#qiWA"), "50");
  // gruppo senza mira: GQI sì, TQI no; un solo colpo: nessun GQI
  await page.click("#bAddGroup"); await key(page, "4"); await clickAt(page, { x: 600, y: 400 });
  assert.match(await page.textContent("#results .res:nth-of-type(2)"), /GQINon disponibile: un solo colpo valido/);
  await clickAt(page, { x: 630, y: 410 }); await clickAt(page, { x: 615, y: 380 });
  assert.match(await page.textContent("#results .res:nth-of-type(2)"), /TQINon disponibile: manca il punto di mira\. Il GQI resta valido/);
  ok2(await cardNum(page, "gqi", 1), "GQI del gruppo senza mira");
  // le statistiche esistenti non cambiano
  const mr = await page.evaluate(() => { const { state, Calc, calcContext } = window.__SA, g = state.groups[0]; return Calc.analyze(g.shots.filter(s => !s.excluded), g.poa, calcContext(g)).mm.mr; });
  assert.match(await page.textContent('#results .rcard[data-key="mr"]'), new RegExp(mr.toFixed(1).replace(".", ",") + " mm"), "raggio medio esistente invariato");
});

test("1.16.0: GQI e TQI della sessione, ripetibilità, confronto, esportazioni, sessione salvata", async page => {
  page.on("dialog", d => d.accept());
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await page.click("#bAddGroup"); await setField(page, "#shotDist", 200);
  await key(page, "3"); await clickAt(page, { x: 600, y: 400 });
  for (const p of [{ x: 640, y: 420 }, { x: 650, y: 380 }, { x: 630, y: 400 }, { x: 610, y: 430 }]) await clickAt(page, p);
  await page.check("#qiTqiOn"); await page.dispatchEvent("#qiTqiOn", "change");
  const A = await qiIndep(page, 0), B = await qiIndep(page, 1);
  const mrS = (A.n * A.mr + B.n * B.mr) / (A.n + B.n), ref = 0.5 / 3437.746770784939, gS = 100 * Math.exp(-Math.log(1.25) * (mrS / ref) ** 2);
  assert.strictEqual(await cardNum(page, "sgqi"), String(Math.round(gS)), "GQI di sessione dal MR aggregato ponderato (distanze diverse in angolo)");
  ok2(Math.abs(gS - (A.gqi + B.gqi) / 2) > 0.01, "diverso dalla media dei GQI");
  const sess = await page.textContent("#results .res.sess");
  assert.match(sess, /Gruppi validi2 \/ 2/); assert.match(sess, new RegExp(`Colpi validi${A.n + B.n}`));
  ok2(await page.$('#results .rcard[data-key="stqi"] .qi-num'), "TQI di sessione");
  ok2(/Ripetibilità tra gruppi/.test(sess) && /Attesa per caso/.test(sess), "ripetibilità separata");
  // confronto: colonne GQI e TQI
  await key(page, "c");
  const head = await page.textContent("#cmpBody thead"); ok2(/GQI/.test(head) && /TQI/.test(head), "colonne nel confronto");
  await page.waitForTimeout(300);
  const qcells = await page.$$eval("#cmpBody tbody tr", trs => trs.map(tr => { const td = [...tr.children]; return td[td.length - 5].textContent + "|" + td[td.length - 4].textContent; }));
  ok2(qcells.some(c => c.startsWith(String(Math.round(A.gqi)) + "|")), "GQI del gruppo nel confronto: " + qcells);
  await key(page, "Escape");
  // testo, CSV, PDF
  const T = await page.evaluate(() => window.__SA.resultText());
  ok2(/GQI:\s+\d+\/100 — /.test(T) && /GQI della sessione:\s+\d+\/100/.test(T) && /GQI-TQI\/1/.test(T), "testo esportato");
  const csv = await page.evaluate(() => window.__SA.csvGroups());
  const lines = csv.replace(/^﻿/, "").split("\r\n"), H = lines[0].split(";"), V = lines[1].split(";");
  for (const c of ["GQI", "GQI_Class", "MR_Reference", "AQI", "TQI", "TQI_Class", "Quality_Index_Version"]) ok2(H.includes(c), "colonna CSV " + c);
  assert.strictEqual(V[H.indexOf("GQI")], A.gqi.toFixed(2).replace(".", ","), "GQI nel CSV");
  assert.strictEqual(V[H.indexOf("Quality_Index_Version")], "GQI-TQI/1");
  assert.strictEqual(V[H.indexOf("MR_Reference")], "0,500");
  const [d] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.selectOption("#cardScope", "all").then(() => page.click("#bPdf"))]);
  const P = pdfText(require("fs").readFileSync(await d.path()));
  for (const w of ["Indice di qualità", "Indice di qualità della sessione", "GQI-TQI/1", "Intervallo del GQI", "Raggio medio aggregato", "Ripetibilità tra gruppi"]) ok2(P.includes(w), "nel report: " + w);
  // sessione: impostazioni e istantanea salvate, ripristinate alla riapertura
  await setField(page, "#qiMrRef", 0.8); await setField(page, "#qiWP", 60);
  const ses = await page.evaluate(() => window.__SA.buildSession(true));
  ok2(ses.params.qiMrRef === "0.8" && ses.params.qiTqiOn === true, "parametri nella sessione");
  ok2(ses.quality && ses.quality.version === "GQI-TQI/1" && ses.quality.mrRef === 0.8 && ses.quality.wPrecision === 60 && ses.quality.classes.length === 5 && ses.quality.groups.length === 2, "istantanea della valutazione");
  ok2(Math.abs(ses.quality.groups[0].gqi - 100 * Math.exp(-Math.log(1.25) * (A.mr / (0.8 / 3437.746770784939)) ** 2)) < 1e-9, "valore usato nell'istantanea");
  await page.reload(); await page.waitForFunction(() => window.__SA && window.__SA.state); await expandAll(page);
  await page.evaluate(t => window.__SA.loadSessionText(t), JSON.stringify(ses));
  assert.strictEqual(await page.inputValue("#qiMrRef"), "0.8"); assert.strictEqual(await page.inputValue("#qiWP"), "60"); ok2(await page.isChecked("#qiTqiOn"), "TQI ripristinato");
});

test("1.16.0: storico con valutazione originale, sessioni vecchie compatibili, inglese", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  const ses = await page.evaluate(() => window.__SA.buildSession(false));
  // sessione «vecchia» (1.14: senza parametri né istantanea dell'indice): si apre e viene valutata
  const old = JSON.parse(JSON.stringify(ses)); delete old.quality; for (const k of Object.keys(old.params)) if (k.startsWith("qi")) delete old.params[k]; old.appVersion = "1.14.0";
  await page.reload(); await page.waitForFunction(() => window.__SA && window.__SA.state); await expandAll(page);
  await loadTarget(page);
  await page.evaluate(t => window.__SA.loadSessionText(t), JSON.stringify(old));
  ok2(await cardNum(page, "gqi"), "sessione 1.14 valutata con le impostazioni correnti");
  // storico: la sessione salvata con 0,5 MOA entra con la sua valutazione; cambiando il riferimento compare «orig.»
  await page.evaluate(async t => { await window.__SA.importHistory([new File([t], "s.json", { type: "application/json" })]); }, JSON.stringify(ses));
  const h = await page.evaluate(() => window.__SA.cmpState.history.map(x => ({ orig: x.qiOrig, qi: x.qi })));
  ok2(h.length === 1 && h[0].orig && h[0].orig.from === "snapshot" && h[0].qi && h[0].qi.mr > 0, "valutazione originale dall'istantanea");
  await setField(page, "#qiMrRef", 1.0);
  await key(page, "c");
  assert.match(await page.textContent("#cmpBody tbody"), /orig\. \d+/, "storico: originale accanto al ricalcolo");
  ok2(Math.abs(await page.evaluate(() => window.__SA.cmpState.history[0].qiOrig.gqi) - h[0].orig.gqi) < 1e-12, "l'originale non viene riscritto");
  await key(page, "Escape");
  // inglese
  await page.evaluate(() => window.__SA.setLang("en"));
  await page.check("#qiTqiOn"); await page.dispatchEvent("#qiTqiOn", "change");
  const txt = (await page.textContent("#results")) + (await page.textContent("#sec-quality"));
  ok2(!ITALIAN.test(txt), "risultati e impostazioni in inglese: " + (txt.match(ITALIAN) || [""])[0]);
  assert.match(txt, /— (Excellent|Good|Fair|Poor|Insufficient)/);
  await page.evaluate(() => window.__SA.resultText());
  assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.I18N.missing]), [], "testi senza traduzione");
});

/* ------------------------------ 1.17.0 ------------------------------ */
// fori del test: 1–2 sovrapposti (centri a 12 px < mezzo calibro 15,6 px), 3 segnato difficile, 6 lontano (possibile flyer)
const RV_SHOTS = [{ x: 420, y: 240 }, { x: 432, y: 240 }, { x: 380, y: 200 }, { x: 460, y: 280 }, { x: 380, y: 290 }, { x: 590, y: 110 }, { x: 440, y: 300 }, { x: 395, y: 250 }];
test("1.17.0: barra principale solo icone con tooltip e nome accessibile", async page => {
  const B = await page.$$eval("#toolbar button", bs => bs.map(b => ({ id: b.id, t: (b.childNodes[b.childNodes.length - 1] && b.firstChild.nodeType === 3 ? b.firstChild.textContent : [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("")).trim(), title: b.title, aria: b.getAttribute("aria-label") })));
  ok2(B.length >= 20, "pulsanti " + B.length);
  for (const b of B) {
    ok2(b.title && b.title.length > 3, "tooltip di " + b.id);
    ok2(b.aria || /zoom/i.test(b.title), "nome accessibile di " + b.id);
    ok2([...b.t].length <= 3, `solo icona in ${b.id}: «${b.t}»`);
  }
  // le scorciatoie sono nel tooltip
  assert.match(await page.getAttribute("#bReview", "title"), /\(V\)$/);
  assert.match(await page.getAttribute('#toolbar [data-mode="shot"]', "title"), /\(4\)$/);
  // i pulsanti del pannello mantengono il testo
  ok2((await page.textContent("#bAddGroup")).trim().length > 4, "pulsanti del pannello con testo");
});
test("1.17.0: coda di revisione — difficili, sovrapposti, flyer; centratura, conferma, rimando, correzione", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, RV_SHOTS);
  await page.evaluate(() => { const { state, commit } = window.__SA; state.groups[0].shots[2].hard = 1; commit(); });
  // verifica indipendente: sovrapposizioni a rischio = centri a meno di mezzo calibro (7,82 mm × 4 px/mm / 2)
  const exp = await page.evaluate(() => { const { state, flyerMap } = window.__SA, g = state.groups[0], cal = 7.82 * 4 / 2, fl = flyerMap(g);
    return g.shots.map((s, i) => [g.shots.some((t, j) => j !== i && Math.hypot(s.x - t.x, s.y - t.y) < cal) ? "o" : "", s.hard ? "h" : "", fl.get(s.id) && fl.get(s.id).flagged ? "f" : ""].join("")); });
  const items = await page.evaluate(() => window.__SA.reviewItems().map(x => ({ i: x.i, k: x.kinds.join(","), mark: x.mark, stat: x.stat, st: x.st })));
  for (const it of items) { const e = exp[it.i]; ok2(e, "foro " + (it.i + 1) + " non atteso"); assert.strictEqual(it.k.includes("overlap"), e.includes("o")); assert.strictEqual(it.k.includes("hard"), e.includes("h")); assert.strictEqual(it.k.includes("flyer"), e.includes("f")); }
  assert.strictEqual(items.length, exp.filter(Boolean).length, "elementi della coda");
  ok2(items.some(x => x.i === 0 && x.mark && !x.stat) && items.some(x => x.i === 2 && x.k === "hard"), "sovrapposti e difficile = marcatura");
  const fly = items.find(x => x.stat); ok2(fly && fly.i === 5, "flyer statistico sul foro 6");
  assert.strictEqual((await page.textContent("#rvBadge")).trim(), String(items.length), "badge della barra");
  // le etichette distinguono marcatura e statistica
  await page.evaluate(() => { const d = document.getElementById("sec-review"); d.open = true; });
  assert.strictEqual(await page.$$eval("#rvList .rvtag.stat", e => e.length), 1);
  // V apre la coda e centra il primo foro con un ingrandimento che mostra il foro a ~90 px
  await key(page, "v");
  const f = await page.evaluate(() => { const { state, toScreen } = window.__SA, c = document.getElementById("canvas").getBoundingClientRect(), sel = state.selected, g = state.groups[0], s = g.shots.find(x => x.id === sel.id), p = toScreen(s);
    return { sel, dx: p.x - c.width / 2, dy: p.y - c.height / 2, holePx: 7.82 * 4 * state.view.scale, idx: g.shots.indexOf(s) }; });
  assert.strictEqual(f.sel.kind, "shot"); near(f.dx, 0, 1.5, "centratura x"); near(f.dy, 0, 1.5, "centratura y"); near(f.holePx, 90, 1, "foro sullo schermo (px)");
  assert.strictEqual(f.idx, items[0].i);
  // conferma: il colpo esce dalla coda e il successivo viene centrato
  await page.click('#rvList .rv-row.cur button[data-rv="ok"]');
  const a1 = await page.evaluate(() => ({ pend: window.__SA.reviewItems().filter(x => x.st === "pending").length, sel: window.__SA.state.selected.id, rv: window.__SA.state.groups[0].shots.map(s => s.review ? s.review.st : "") }));
  assert.strictEqual(a1.pend, items.length - 1); assert.strictEqual(a1.rv[items[0].i], "ok"); ok2(a1.sel !== undefined, "selezione");
  assert.strictEqual((await page.textContent("#rvBadge")).trim(), String(items.length - 1));
  // la conferma del flyer non lo esclude (statistica ≠ identificazione)
  await page.evaluate(() => { const SA = window.__SA, x = SA.reviewItems().find(y => y.stat); SA.reviewAction(x, "ok", 0); });
  assert.strictEqual(await page.evaluate(() => !!window.__SA.state.groups[0].shots[5].excluded), false, "flyer confermato ma non escluso");
  // rimando: va in fondo alla coda
  await page.evaluate(() => { const SA = window.__SA, L = SA.rvVisible(); SA.reviewAction(L[0], "later", 0); });
  const L2 = await page.evaluate(() => window.__SA.rvVisible().map(x => x.st));
  assert.strictEqual(L2[L2.length - 1], "later");
  // conferma nella storia (annulla) e nella sessione
  await page.evaluate(() => { const SA = window.__SA, x = SA.reviewItems().find(y => y.i === 2); SA.reviewAction(x, "ok", 0); });
  assert.strictEqual(await page.evaluate(() => window.__SA.reviewItems().find(y => y.i === 2).st), "ok");
  const ses = JSON.parse(await page.evaluate(() => JSON.stringify(window.__SA.buildSession(false))));
  ok2(ses.groups[0].shots[2].review && ses.groups[0].shots[2].review.st === "ok", "stato di revisione nella sessione");
  await page.evaluate(() => window.__SA.undo());
  assert.strictEqual(await page.evaluate(() => window.__SA.reviewItems().find(y => y.i === 2).st), "pending", "annulla ripristina lo stato");
  await page.evaluate(() => window.__SA.redo());
  // stesse ragioni → stato mantenuto; ragioni diverse (foro 3 anche sovrapposto) → di nuovo da rivedere
  await page.evaluate(() => { const SA = window.__SA, g = SA.state.groups[0]; SA.toggleHard(g.id, g.shots[2].id); SA.toggleHard(g.id, g.shots[2].id); });
  assert.strictEqual(await page.evaluate(() => window.__SA.reviewItems().find(y => y.i === 2).st), "ok", "stesse ragioni: stato mantenuto");
  await page.evaluate(() => { const { state, commit } = window.__SA, g = state.groups[0]; g.shots[2].x = g.shots[4].x; g.shots[2].y = g.shots[4].y - 10; commit(); });
  assert.strictEqual(await page.evaluate(() => window.__SA.reviewItems().find(y => y.i === 2).st), "pending", "ragioni cambiate: da rivedere");
  // esclusione e cancellazione dalla coda
  await page.evaluate(() => { const SA = window.__SA, x = SA.reviewItems().find(y => y.i === 1); SA.reviewAction(x, "excl", 0); });
  assert.strictEqual(await page.evaluate(() => !!window.__SA.state.groups[0].shots[1].excluded), true);
  const n0 = await page.evaluate(() => window.__SA.state.groups[0].shots.length);
  await page.evaluate(() => { const SA = window.__SA, x = SA.reviewItems().find(y => y.i === 1); SA.reviewAction(x, "del", 0); });
  assert.strictEqual(await page.evaluate(() => window.__SA.state.groups[0].shots.length), n0 - 1);
  // senza scala: niente sovrapposizioni (servono scala e calibro), restano difficili e flyer
  await page.evaluate(() => { const { state, commit } = window.__SA; state.calib = { p1: null, p2: null }; commit(); });
  ok2(await page.evaluate(() => window.__SA.reviewItems().every(x => !x.kinds.includes("overlap"))), "nessuna sovrapposizione senza scala");
});
test("1.17.0: collegamento parametri ↔ immagine (calibro, scala, distanza)", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await key(page, "f"); await redraw(page);
  const before = await page.evaluate(() => window.__SA.state.paramHi);
  assert.strictEqual(before, null);
  // calibro: cerchio della dimensione reale del foro su ogni foro del gruppo attivo
  await page.focus("#caliber"); await redraw(page);
  assert.strictEqual(await page.evaluate(() => window.__SA.state.paramHi), "caliber");
  const sc = await page.evaluate(() => window.__SA.state.view.scale), R = 7.82 / 2 * 4;   // raggio in px della foto, indipendente
  const s0 = SHOTS[3];
  const orange = c => c[0] > 200 && c[1] > 60 && c[1] < 140 && c[2] < 60;
  // cerca il cerchio arancio a distanza R dal centro del foro, a destra del foro (nessun altro foro lì)
  let hit = false;
  for (let d = -1.2; d <= 1.2 && !hit; d += 0.3 / sc) if (orange(await pixelAt(page, { x: s0.x, y: s0.y - R + d }))) hit = true;
  ok2(hit, "cerchio del calibro a r = " + R + " px");
  ok2(!orange(await pixelAt(page, { x: s0.x, y: s0.y - R - 4 })), "niente fuori dal cerchio");
  // scala: i due punti A e B e la distanza nota
  await page.focus("#calDist"); await redraw(page);
  assert.strictEqual(await page.evaluate(() => window.__SA.state.paramHi), "calib");
  ok2(orange(await pixelAt(page, { x: 200, y: 500 })), "segmento A–B evidenziato");
  // distanza: cerchio di 1 MIL al centro del gruppo (diametro 100 mm a 100 m = 400 px)
  await page.focus("#shotDist"); await redraw(page);
  assert.strictEqual(await page.evaluate(() => window.__SA.state.paramHi), "dist");
  const c = await page.evaluate(() => window.__SA.Calc.centroid(window.__SA.state.groups[0].shots));
  const rr = Math.tan(0.001 / 2) * 2 * 100000 / 2 * 4;
  let h2 = false; for (let d = -1.5; d <= 1.5 && !h2; d += 0.5) if (orange(await pixelAt(page, { x: c.x + rr + d, y: c.y }))) h2 = true;
  ok2(h2, "cerchio di 1 MIL r = " + rr);
  await page.evaluate(() => document.activeElement.blur()); await page.mouse.move(5, 5); await redraw(page);
  assert.strictEqual(await page.evaluate(() => window.__SA.state.paramHi), null, "evidenziazione tolta");
});
test("1.17.0: mostra origine del dato — ES, H-spread, raggio medio, esclusi", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await page.evaluate(() => { const { state, commit } = window.__SA; state.groups[0].shots[1].excluded = true; commit(); });
  // ES: coppia più lontana tra i fori inclusi (verifica a forza bruta)
  const inc = SHOTS.map((s, i) => ({ ...s, n: i + 1 })).filter(s => s.n !== 2);
  let best = [0, 0, 0]; for (const a of inc) for (const b of inc) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d > best[0]) best = [d, Math.min(a.n, b.n), Math.max(a.n, b.n)]; }
  await page.click('#results .rcard[data-key="es"] .orgbtn');
  ok2(await page.isVisible("#originBar"), "barra dell'origine");
  const t = await page.textContent("#originText");
  ok2(t.includes(`fori ${best[1]} e ${best[2]}`), "coppia dell'ES: " + t);
  ok2(t.includes(fmtIt(best[0] / 4, 1) + " mm"), "valore dell'ES: " + t);
  ok2(/Esclusi e non usati: foro 2/.test(t), "foro escluso dichiarato");
  // l'evidenziazione è sul segmento tra i due fori
  await redraw(page);
  const A = SHOTS[best[1] - 1], Bp = SHOTS[best[2] - 1], mid = { x: (A.x + Bp.x) / 2, y: (A.y + Bp.y) / 2 };
  const px = await pixelAt(page, mid); ok2(px[0] > 200 && px[2] < 80, "linea della coppia: " + px);
  // H-spread: estremi orizzontali
  const xs = inc.map(s => s.x), lo = inc[xs.indexOf(Math.min(...xs))].n, hi = inc[xs.indexOf(Math.max(...xs))].n;
  await page.evaluate(() => { const b = [...document.querySelectorAll("#results .rcard td")].find(td => /^H-spread/.test(td.textContent)); b.querySelector(".orgbtn").click(); });
  const t2 = await page.textContent("#originText"); ok2(t2.includes(`(${lo})`) && t2.includes(`(${hi})`), "estremi orizzontali: " + t2);
  // raggio medio: tutti i fori inclusi
  await page.click('#results .rcard[data-key="mr"] .orgbtn');
  assert.match(await page.textContent("#originText"), new RegExp(`dei ${inc.length} fori inclusi`));
  // il testo dei risultati non contiene i simboli dei pulsanti
  ok2(!(await page.textContent("#results")).includes("⌖"), "simboli solo dal CSS");
  // Esc toglie l'evidenziazione
  await key(page, "Escape");
  assert.strictEqual(await page.isVisible("#originBar"), false);
});
const fmtIt = (v, d) => v.toFixed(d).replace(".", ",");
test("1.17.0: baseline persistente — card, condizioni, sessione, browser", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  await setField(page, "#ld-weather", "sole");
  // il gruppo 1 diventa la baseline
  await page.click("#results .bstarg");
  const B = await page.evaluate(() => window.__SA.baselineState().baseline);
  ok2(B && B.bid && B.n === 5, "baseline creata");
  ok2(await page.evaluate(() => !!JSON.parse(localStorage.getItem("shootAnalyzer.baseline")).bid), "salvata nel browser");
  // secondo gruppo, più stretto e a 50 m, con meteo diverso
  await page.click("#bAddGroup");
  await clickAt(page, { x: 190, y: 400 });
  for (const s of [{ x: 250, y: 400 }, { x: 268, y: 410 }, { x: 240, y: 386 }]) await clickAt(page, s);
  await setField(page, "#shotDist", 50); await setField(page, "#ld-weather", "pioggia");
  const card = await page.evaluate(() => { const g = window.__SA.state.groups[1]; const c = document.querySelector(`.res[data-gid="${g.id}"] .rcard[data-key="base"]`); return c ? c.textContent : null; });
  ok2(card, "card della baseline nel secondo gruppo");
  ok2(/50 m · 3 colpi/.test(card) && /100 m · 5 colpi/.test(card), "distanza e colpi evidenti: " + card.slice(0, 200));
  ok2(/distanza 50 m contro 100 m/.test(card), "avviso di distanza diversa");
  ok2(/3 colpi contro 5/.test(card), "avviso: il group size dipende dal numero di colpi");
  ok2(/condizioni diverse: Meteo/.test(card), "condizioni diverse (la distanza ha il suo avviso): " + card);
  // differenza ES in MIL calcolata in modo indipendente dalle coordinate
  const es = pts => { let m = 0; for (const a of pts) for (const b of pts) m = Math.max(m, Math.hypot(a.x - b.x, a.y - b.y)); return m; };
  const mil = (px, D) => 2 * Math.atan(px / 4 / 2 / D) * 1000;
  const dEs = mil(es([{ x: 250, y: 400 }, { x: 268, y: 410 }, { x: 240, y: 386 }]), 50000) - mil(es(SHOTS), 100000);
  const shown = await page.evaluate(() => { const g = window.__SA.state.groups[1], row = window.__SA.compareRows().find(r => r.gid === g.id); return window.__SA.baselineCompare(row).mets.find(m => m.k === "es").d; });
  near(shown, dEs, 1e-6, "Δ ES (MIL)");
  // test F di σ: s² angolari dei due gruppi
  const F = await page.evaluate(() => { const SA = window.__SA, g = SA.state.groups[1], row = SA.compareRows().find(r => r.gid === g.id), b = SA.baselineState().baseline, t = SA.sigmaFTest(row, b);
    const c = SA.Calc.fcdf(row.qi.s2 / b.qi.s2, row.qi.nu, b.qi.nu); return { t, p: Math.min(1, 2 * Math.min(c, 1 - c)), nu: [row.qi.nu, b.qi.nu] }; });
  near(F.t.p, F.p, 1e-12, "p del test F"); assert.deepStrictEqual(F.nu, [4, 8], "gradi di libertà 2(n−1)");
  // nella sessione; nuova pagina dello stesso browser: la baseline c'è ancora
  const ses = await page.evaluate(() => JSON.stringify(window.__SA.buildSession(true)));
  assert.strictEqual(JSON.parse(ses).baseline.bid, B.bid);
  await page.reload(); await page.waitForFunction(() => window.__SA && window.__SA.state);
  assert.strictEqual(await page.evaluate(() => window.__SA.baselineState().baseline.bid), B.bid, "baseline ricordata dal browser");
  // browser senza baseline: quella del file viene adottata
  await page.evaluate(() => window.__SA.setBaseline(null, true));
  await page.evaluate(t => window.__SA.loadSessionText(t), ses);
  assert.strictEqual(await page.evaluate(() => window.__SA.baselineState().baseline.bid), B.bid, "adottata dal file");
  // browser con un'altra baseline: quella del file è proposta, non imposta
  await page.evaluate(() => { const SA = window.__SA, r = SA.compareRows().find(x => x.gid === SA.state.groups[1].id); SA.setBaseline(SA.makeBaseline(r), true); });
  const other = await page.evaluate(() => window.__SA.baselineState().baseline.bid);
  await page.evaluate(t => window.__SA.loadSessionText(t), ses);
  assert.strictEqual(await page.evaluate(() => window.__SA.baselineState().baseline.bid), other, "non sostituita");
  await page.evaluate(() => window.__SA.openAnalysis("cmp")); await page.waitForTimeout(150);
  ok2(await page.isVisible("#bBaseFile"), "«Usa questa» proposto");
  await page.click("#bBaseFile");
  assert.strictEqual(await page.evaluate(() => window.__SA.baselineState().baseline.bid), B.bid);
  // stella sulla riga della baseline nel confronto; metriche scelte ricordate
  assert.strictEqual(await page.$$eval("#cmpBody .bstar.on", e => e.length), 1);
  await page.uncheck('#baseBox input[data-bm="gqi"]'); await page.dispatchEvent('#baseBox input[data-bm="gqi"]', "change");
  assert.deepStrictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("shootAnalyzer.baselineMetrics"))), ["es", "mr", "sigma"]);
});
test("1.17.0: selezione di un periodo nell'andamento — σ combinato contro tutto prima", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  const G = [[{ x: 560, y: 400 }, { x: 600, y: 420 }, { x: 540, y: 370 }, { x: 590, y: 360 }], [{ x: 250, y: 400 }, { x: 266, y: 408 }, { x: 240, y: 388 }], [{ x: 650, y: 520 }, { x: 668, y: 532 }, { x: 636, y: 512 }, { x: 660, y: 500 }]];
  for (const pts of G) { await page.click("#bAddGroup"); await clickAt(page, { x: pts[0].x - 60, y: pts[0].y }); for (const s of pts) await clickAt(page, s); }
  await page.evaluate(() => { const { state, commit } = window.__SA; state.groups.forEach((g, i) => { g.load.date = `2026-0${i + 1}-10`; }); commit(); });
  await page.evaluate(() => window.__SA.openAnalysis("cmp")); await page.waitForTimeout(150);
  // trascinamento sul grafico: dagli ultimi due punti
  await page.evaluate(() => document.getElementById("chTrend").scrollIntoView({ block: "center" }));
  const geo = await page.evaluate(() => { const r = document.getElementById("chTrend").getBoundingClientRect(), G = window.__SA.CH.trendGeom; return { x: r.left, y: r.top + r.height / 2, G }; });
  const X = i => geo.x + geo.G.padL + i * geo.G.pw / (geo.G.n - 1);
  await page.mouse.move(X(2) - 3, geo.y); await page.mouse.down(); await page.mouse.move(X(3) - 10, geo.y, { steps: 5 }); await page.mouse.move(X(3), geo.y, { steps: 3 }); await page.mouse.up();
  assert.deepStrictEqual(await page.evaluate(() => window.__SA.cmpState.range), { a: 2, b: 3 });
  // verifica indipendente: σ² combinato = Σ ν s² / Σ ν sulle s² angolari
  const chk = await page.evaluate(() => { const SA = window.__SA, rows = SA.compareRows(), C = SA.rangeCompare(rows);
    const pool = rs => { const nu = rs.reduce((a, r) => a + r.qi.nu, 0); return { nu, s2: rs.reduce((a, r) => a + r.qi.nu * r.qi.s2, 0) / nu }; };
    const A = pool(rows.slice(2, 4)), B = pool(rows.slice(0, 2)), f = A.s2 / B.s2, c = SA.Calc.fcdf(f, A.nu, B.nu);
    return { A, B, s: C.S.P, v: C.Pv.P, F: C.F, p: Math.min(1, 2 * Math.min(c, 1 - c)), n: [C.S.n, C.Pv.n], k: [C.S.k, C.Pv.k] }; });
  near(chk.s.s2, chk.A.s2, chk.A.s2 * 1e-9, "σ² della selezione"); near(chk.v.s2, chk.B.s2, chk.B.s2 * 1e-9, "σ² di prima");
  assert.strictEqual(chk.s.nu, chk.A.nu); near(chk.F.p, chk.p, 1e-12, "p del test F");
  assert.deepStrictEqual(chk.n, [7, 9]); assert.deepStrictEqual(chk.k, [2, 2]);
  const txt = await page.textContent("#cmpRange");
  ok2(/Selezione\s*2\s*7/.test(txt) && /Tutto prima\s*2\s*9/.test(txt), "tabella del periodo: " + txt.slice(0, 300));
  assert.strictEqual(await page.$$eval("#cmpBody tr.inrange", e => e.length), 2);
  // i dati non cambiano; doppio clic = nessuna selezione
  const before = await page.evaluate(() => JSON.stringify(window.__SA.state.groups));
  await page.dblclick("#chTrend");
  assert.strictEqual(await page.evaluate(() => window.__SA.cmpState.range), null);
  assert.strictEqual(await page.evaluate(() => JSON.stringify(window.__SA.state.groups)), before);
  // selezione dai menu, a partire dal primo gruppo: niente «prima»
  await page.selectOption("#rgA", "0"); await page.selectOption("#rgB", "1"); await page.click("#bRgSet");
  assert.match(await page.textContent("#cmpRange"), /Nessun gruppo prima/);
});
test("1.17.0: inglese — coda di revisione, origine, baseline e periodo tradotti", async page => {
  await page.evaluate(() => window.__SA.setLang("en"));
  await loadTarget(page);
  await setupGroup(page, POA, RV_SHOTS);
  await page.evaluate(() => { const { state, commit } = window.__SA; state.groups[0].shots[2].hard = 1; commit(); });
  await page.click("#results .bstarg");
  await page.click("#bAddGroup"); await clickAt(page, { x: 190, y: 400 });
  for (const s of [{ x: 250, y: 400 }, { x: 268, y: 410 }, { x: 240, y: 386 }]) await clickAt(page, s);
  await key(page, "v");
  for (const k of ["es", "mr", "gqi", "corr"]) { await page.evaluate(k => { const SA = window.__SA; SA.state.origin = null; SA.toggleOrigin(SA.state.groups[0].id, k); }, k); ok2(!ITALIAN.test(await page.textContent("#originText")), "origine " + k + ": " + await page.textContent("#originText")); }
  for (const id of ["caliber", "calDist", "shotDist", "markHand", "clickVal"]) { await page.focus("#" + id); await redraw(page); }
  await page.evaluate(() => document.activeElement.blur());
  await page.evaluate(() => window.__SA.openAnalysis("cmp")); await page.waitForTimeout(150);
  await page.evaluate(() => window.__SA.setRange(1, 1));
  const txt = (await page.textContent("#sec-review")) + (await page.textContent("#results")) + (await page.textContent("#baseBox")) + (await page.textContent("#cmpRange"));
  ok2(!ITALIAN.test(txt), "testi in inglese: " + (txt.match(ITALIAN) || [""])[0]);
  assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.I18N.missing]), [], "testi senza traduzione");
});

/* ------------------------------ 1.18.0 ------------------------------ */
test("1.18.0: pannello — riepilogo GQI/TQI in cima, esportazioni in Dati, Gestione immagine, scala sulla foto", async page => {
  // esportazioni nella sezione Dati; in cima niente pulsanti di esportazione
  for (const id of ["#bCardPng", "#bPdf", "#cardScope"]) ok2(await page.$eval(id, (e) => !!e.closest("#sec-data")), id + " in Dati");
  assert.strictEqual(await page.$eval("#side", s => !!s.querySelector(":scope > #exportBar, :scope > .btns#exportBar")), false);
  // sezione rinominata e divisa in riquadri con titolo
  assert.strictEqual((await page.textContent("#sec-orient > summary")).trim(), "Gestione immagine");
  assert.deepStrictEqual(await page.$$eval("#sec-orient .subsec .subsec-h", hs => hs.map(h => h.textContent.trim())),
    ["⟳Rotazione", "✂Ritaglio della foto", "〰Distorsione dell'obiettivo", "⬚Correzione prospettica (foto di sbieco)"]);
  ok2(await page.$eval("#bPersp", b => !!b.closest("#ss-persp")) && await page.$eval("#bCrop", b => !!b.closest("#ss-crop")), "comandi nel loro riquadro");
  // scala sulla foto attiva per default, solo righello
  assert.strictEqual(await page.isChecked("#smOn"), true); assert.strictEqual(await page.inputValue("#smKind"), "ruler");
  // riepilogo: nascosto senza gruppi validi
  assert.strictEqual(await page.isHidden("#qiTop"), true);
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  ok2(await page.isVisible("#qiTop"), "riepilogo visibile");
  assert.strictEqual(await page.$eval("#qiTop", e => e.previousElementSibling && e.nextElementSibling.tagName), "SECTION", "prima delle sezioni");
  // stesso punteggio della card della sessione, solo GQI con il TQI spento
  const top = await page.$$eval("#qiTop .qtb", bs => bs.map(b => ({ k: b.dataset.qt, n: b.querySelector(".qi-num").textContent, bar: !!b.querySelector(".qi-bar"), rows: b.querySelectorAll("tr").length })));
  const card = await page.$eval('#results .rcard[data-key="sgqi"] .qi-num', e => e.textContent);
  assert.deepStrictEqual(top, [{ k: "sgqi", n: card, bar: true, rows: 0 }]);
  // TQI acceso: due riquadri affiancati
  await page.check("#qiTqiOn"); await page.dispatchEvent("#qiTqiOn", "change");
  const top2 = await page.$$eval("#qiTop .qtb", bs => bs.map(b => b.dataset.qt));
  assert.deepStrictEqual(top2, ["sgqi", "stqi"]);
  const [r1, r2] = await page.$$eval("#qiTop .qtb", bs => bs.map(b => b.getBoundingClientRect()).map(r => ({ x: r.x, y: r.y, w: r.width })));
  near(r1.y, r2.y, 0.5, "affiancati"); ok2(r2.x > r1.x + r1.w - 1, "uno accanto all'altro");
  assert.strictEqual(await page.$eval("#qiTop .qtb[data-qt=stqi] .qi-num", e => e.textContent), await page.$eval('#results .rcard[data-key="stqi"] .qi-num', e => e.textContent));
  // gruppo senza mira: TQI non calcolabile → solo GQI
  await page.evaluate(() => { const { state, commit } = window.__SA; state.groups[0].poa = null; commit(); });
  assert.deepStrictEqual(await page.$$eval("#qiTop .qtb", bs => bs.map(b => b.dataset.qt)), ["sgqi"]);
  // clic: sezione Risultati aperta sulla card della sessione
  await page.evaluate(() => { document.getElementById("sec-results").open = false; });
  await page.click("#qiTop .qtb");
  assert.strictEqual(await page.$eval("#sec-results", d => d.open), true);
  // GQI spento nelle impostazioni → niente riepilogo
  await page.uncheck("#qiGqiOn"); await page.dispatchEvent("#qiGqiOn", "change");
  assert.strictEqual(await page.isHidden("#qiTop"), true);
});
test("1.18.0: gruppi richiudibili nei Risultati con la riga dei valori principali", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await page.click("#bAddGroup"); await clickAt(page, { x: 190, y: 400 });
  for (const s of [{ x: 250, y: 400 }, { x: 268, y: 410 }, { x: 240, y: 386 }]) await clickAt(page, s);
  const [g1, g2] = await page.evaluate(() => window.__SA.state.groups.map(g => g.id));
  const sel = id => `#results .res[data-gid="${id}"]`;
  ok2(!(await page.$eval(sel(g1), b => b.classList.contains("collapsed"))), "aperto all'inizio");
  // clic sul titolo: chiuso, resta solo titolo + riga
  await page.click(`${sel(g1)} > h3`);
  const st = await page.$eval(sel(g1), b => ({ c: b.classList.contains("collapsed"), vis: [...b.children].filter(e => getComputedStyle(e).display !== "none").map(e => e.tagName + "." + e.className), sum: b.querySelector(".resg-sum").textContent, aria: b.querySelector(".rtog").getAttribute("aria-expanded") }));
  ok2(st.c && st.aria === "false", "chiuso");
  assert.deepStrictEqual(st.vis, ["H3.", "DIV.resg-sum"]);
  // valori della riga = calcolo indipendente
  let es = 0; for (const a of SHOTS) for (const b of SHOTS) es = Math.max(es, Math.hypot(a.x - b.x, a.y - b.y));
  const c = { x: SHOTS.reduce((a, s) => a + s.x, 0) / SHOTS.length, y: SHOTS.reduce((a, s) => a + s.y, 0) / SHOTS.length }, mr = SHOTS.reduce((a, s) => a + Math.hypot(s.x - c.x, s.y - c.y), 0) / SHOTS.length;
  const gqi = await page.$eval(`${sel(g1)} .rcard[data-key="gqi"] .qi-num`, e => e.textContent);
  assert.strictEqual(st.sum, `group size ${fmtIt(es / 4, 1)} mm · raggio medio ${fmtIt(mr / 4, 1)} mm · GQI ${gqi}`);
  // l'altro gruppo resta aperto; lo stato sopravvive agli aggiornamenti (nuovo foro nel gruppo 2)
  ok2(!(await page.$eval(sel(g2), b => b.classList.contains("collapsed"))), "gruppo 2 aperto");
  await clickAt(page, { x: 258, y: 380 });
  ok2(await page.$eval(sel(g1), b => b.classList.contains("collapsed")), "ancora chiuso dopo l'aggiornamento");
  // la stella della baseline nel titolo non chiude il gruppo
  await page.click(`${sel(g2)} .bstarg`);
  ok2(!(await page.$eval(sel(g2), b => b.classList.contains("collapsed"))), "stella senza chiusura");
  await page.evaluate(() => window.__SA.setBaseline(null, true));
  // riapertura con ▸; nuovo gruppo aperto; nuova foto: tutto riaperto
  await page.click(`${sel(g1)} .rtog`);
  ok2(!(await page.$eval(sel(g1), b => b.classList.contains("collapsed"))), "riaperto");
  await page.click(`${sel(g1)} > h3`);
  await loadTarget(page);
  assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.resCollapsed]), []);
});
test("1.18.0: marcatori delle note più grandi, presi su tutta la pillola, trascinati senza salti", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await key(page, "n"); await clickAt(page, { x: 200, y: 150 });
  await page.fill(".note-row textarea", "zona"); await key(page, "Escape");
  await page.evaluate(() => window.__SA.setMode("pan"));
  const m = await page.evaluate(() => { const SA = window.__SA, M = SA.noteMarkers(SA.toScreen, SA.state.view.scale, SA.calcContext(), true)[0]; return { x: M.x, y: M.y, ax: M.ax, ay: M.ay, n: { ...SA.state.notes[0] } }; });
  // pillola alta 24 px: la presa vale su tutta la pillola + 5 px (prima: cerchio di 11 px dal centro)
  assert.strictEqual(await page.evaluate(() => window.__SA.NOTE_H), 24);
  const hitAt = (dx, dy) => page.evaluate(([x, y]) => { const h = window.__SA.hitTest(x, y); return h && h.kind; }, [m.x + dx, m.y + dy]);
  assert.strictEqual(await hitAt(0, 0), "note"); assert.strictEqual(await hitAt(17, 14), "note", "angolo della pillola + margine"); assert.strictEqual(await hitAt(0, 30), null);
  // disegnata grande: pixel scuro della pillola a 7 px dal centro in verticale (la pillola vecchia era alta 15 px)
  await page.evaluate(() => { window.__SA.state.selected = null; }); await redraw(page);
  const cv = await page.$eval("#canvas", c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top }; });
  const px = await page.evaluate(([x, y]) => { const c = document.getElementById("canvas"), d = c.getContext("2d").getImageData(Math.round(x * devicePixelRatio), Math.round(y * devicePixelRatio), 1, 1).data; return [...d]; }, [m.x - 6, m.y + 8]);
  ok2(px[0] < 90 && px[1] < 100, "pillola scura: " + px);
  // trascinamento dal bordo della pillola: la nota si sposta dello stesso vettore, senza saltare sotto il cursore
  const grabX = cv.x + m.x + 12, grabY = cv.y + m.y + 8;
  await page.mouse.move(grabX, grabY); await page.mouse.down(); await page.mouse.move(grabX + 20, grabY + 10, { steps: 4 }); await page.mouse.move(grabX + 40, grabY + 30, { steps: 4 }); await page.mouse.up();
  const n2 = await page.evaluate(() => ({ ...window.__SA.state.notes[0] })), sc = await page.evaluate(() => window.__SA.state.view.scale);
  near(n2.x - m.n.x, 40 / sc, 0.6, "spostamento x"); near(n2.y - m.n.y, 30 / sc, 0.6, "spostamento y");
  // annulla
  await key(page, "Control+z");
  near(await page.evaluate(() => window.__SA.state.notes[0].x), m.n.x, 1e-9, "annulla");
});
test("1.18.0: inglese — riepilogo, Gestione immagine e gruppi chiusi tradotti", async page => {
  await page.evaluate(() => window.__SA.setLang("en"));
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await page.check("#qiTqiOn"); await page.dispatchEvent("#qiTqiOn", "change");
  await page.click("#results .res > h3");
  assert.strictEqual((await page.textContent("#sec-orient > summary")).trim(), "Image handling");
  const txt = (await page.textContent("#qiTop")) + (await page.textContent("#results .res")) + (await page.textContent("#sec-orient")) + (await page.textContent("#sec-data"));
  ok2(!ITALIAN.test(txt), "testi in inglese: " + (txt.match(ITALIAN) || [""])[0]);
  assert.match(await page.textContent("#results .resg-sum"), /^group size [\d.]+ mm · mean radius [\d.]+ mm · GQI \d+$/);
  assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.I18N.missing]), [], "testi senza traduzione");
});

/* ------------------------------ 1.19.0 ------------------------------ */
/** Testo di un PDF con font incorporati (Identity-H): decodifica <esadecimale> Tj con le ToUnicode dei font. */
function pdfTextU(buf) {
  const zlib = require("zlib"), t = buf.toString("latin1"), maps = {}, out = [];
  // oggetti font Type0 → ToUnicode; le CMap sono stream non compressi
  const fontObj = {};
  for (const m of t.matchAll(/(\d+) 0 obj\n<< \/Type \/Font \/Subtype \/Type0 [^\n]*\/ToUnicode (\d+) 0 R >>/g)) fontObj[m[1]] = m[2];
  const cmapOf = id => { const m = t.match(new RegExp(`\\n${id} 0 obj\\n<< /Length (\\d+) >>\\nstream\\n`)); const s = t.substr(m.index + m[0].length, +m[1]); const M = {};
    for (const x of s.matchAll(/<([0-9A-F]{4})> <([0-9A-F]{4})>/g)) M[x[1]] = String.fromCharCode(parseInt(x[2], 16)); return M; };
  const res = t.match(/\/Font << \/F1 (\d+) 0 R \/F2 (\d+) 0 R >>/);
  maps.F1 = cmapOf(fontObj[res[1]]); maps.F2 = cmapOf(fontObj[res[2]]);
  const re = /<< \/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g; let m;
  while ((m = re.exec(t))) {
    const start = m.index + m[0].length, data = buf.subarray(start, start + +m[1]);
    let s; try { s = zlib.inflateSync(data).toString("latin1"); } catch { continue; }
    let f = "F1";
    for (const x of s.matchAll(/\/(F[12]) [\d.]+ Tf|<([0-9a-f]*)> Tj/g)) {
      if (x[1]) { f = x[1]; continue; }
      out.push(x[2].match(/.{4}/g).map(h => maps[f][h.toUpperCase()] || "?").join(""));
    }
  }
  return out.join("\n");
}
test("1.19.0: lingua russa — interfaccia, unità, numeri, bussola, nomi dei gruppi", async page => {
  // selettore con le tre lingue
  assert.deepStrictEqual(await page.$$eval("#langSel option", o => o.map(x => x.value + ":" + x.textContent)), ["it:Italiano", "en:English", "ru:Русский"]);
  await page.selectOption("#langSel", "ru");
  assert.strictEqual(await page.evaluate(() => document.documentElement.lang), "ru");
  assert.strictEqual(await page.evaluate(() => localStorage.getItem("shootAnalyzer.lang")), "ru");
  assert.strictEqual((await page.textContent("#sec-orient > summary")).trim(), "Обработка изображения");
  assert.strictEqual(await page.getAttribute("#bLoad", "aria-label"), "Загрузить фото");
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  await expandAll(page);
  // nome automatico del gruppo, unità cirilliche, virgola decimale
  assert.strictEqual(await page.evaluate(() => window.__SA.state.groups[0].name), "Группа 1");
  const res = await page.textContent("#results");
  ok2(/\d,\d мм · \d,\d{3}"/.test(res), "group size in мм con la virgola: " + (res.match(/[\d,]+ [мm]м[^·]*·[^"]*"/) || [""])[0]);
  ok2(!/\d mm\b|\d px\b/.test(res), "nessun «mm»/«px» latino nei risultati: " + (res.match(/.{20}\d (mm|px)\b/) || [""])[0]);
  ok2(/MOA/.test(res) && /MIL/.test(res), "MOA e MIL restano latini");
  assert.match(await page.$eval("#caliberPreset option[value='c308']", o => o.textContent), /7,82 мм$/);
  // bussola in cirillico (С, В, Ю, З) nella tabella dei fori
  const dirs = await page.$$eval("#points td", tds => tds.map(t => t.textContent.trim()).filter(t => /^\d+° /.test(t)));
  ok2(dirs.length && dirs.every(d => /^\d+° [СВЮЗ]{1,3}$/.test(d)), "direzioni: " + dirs.join(", "));
  // niente italiano e nessun testo senza traduzione, anche nella vista grafici
  const side = await page.textContent("#side");
  ok2(!ITALIAN.test(side), "pannello senza italiano: " + (side.match(ITALIAN) || [""])[0]);
  await key(page, "a"); await page.waitForTimeout(300);
  const ana = await page.textContent("#anaView");
  ok2(!ITALIAN.test(ana), "vista grafici senza italiano: " + (ana.match(ITALIAN) || [""])[0]);
  await key(page, "Escape");
  assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.I18N.missing]), [], "testi senza traduzione");
  // help tecnico in italiano con l'avviso in russo
  await key(page, "h");
  assert.strictEqual((await page.textContent("#helpLangNote")).trim(), "Техническая справка доступна только на итальянском языке.");
  await key(page, "Escape");
  // ritorno all'italiano: tutto come prima
  await page.selectOption("#langSel", "it");
  assert.strictEqual(await page.evaluate(() => window.__SA.state.groups[0].name), "Gruppo 1");
  ok2(/\d,\d mm · /.test(await page.textContent("#results")), "mm in italiano");
  // il russo è ricordato dal browser
  await page.selectOption("#langSel", "ru"); await page.reload(); await page.waitForFunction(() => window.__SA && window.__SA.state);
  assert.strictEqual(await page.inputValue("#langSel"), "ru");
});
test("1.19.0: report PDF — font incorporati solo quando servono, testo russo estraibile", async page => {
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  const getPdf = async () => { const [d] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bPdf")]); return require("fs").readFileSync(await d.path()); };
  // italiano: font standard, nessun font incorporato
  const b0 = await getPdf(), s0 = b0.toString("latin1");
  ok2(/\/BaseFont \/Helvetica /.test(s0) && !/FontFile2/.test(s0), "italiano: Helvetica, nessun font incorporato");
  // italiano con una nota in cirillico: font incorporati, la nota resta leggibile
  await setField(page, "#ld-notes", "ветер порывами");
  const b1 = await getPdf(), s1 = b1.toString("latin1");
  ok2(/\/FontFile2/.test(s1) && /SAAAAA\+SAReportSans-Regular/.test(s1) && /\/Encoding \/Identity-H/.test(s1), "font incorporati");
  const T1 = pdfTextU(b1);
  ok2(T1.includes("ветер порывами") && T1.includes("Calibrazione"), "nota russa e testo italiano estraibili");
  // russo: font incorporati, testo vero in russo, nessun «?»
  await setField(page, "#ld-notes", "");
  await page.selectOption("#langSel", "ru");
  const b2 = await getPdf(), T2 = pdfTextU(b2);
  checkPdf(b2);
  for (const w of ["Калибровка", "ПРОАНАЛИЗИРОВАННЫЕ ВЫСТРЕЛЫ", "Средний радиус", "Размер группы (c-c)", "мм"]) ok2(T2.includes(w), "nel PDF russo: " + w);
  ok2(!/\?/.test(T2.replace(/\?\)/g, "")), "nessun carattere perso: " + (T2.match(/.{15}\?.{5}/) || [""])[0]);
  ok2(/\/Lang <FEFF00720075002D00520055>/.test(b2.toString("latin1")), "lingua del documento ru-RU");
  // larghezze: metriche della Liberation Sans = Helvetica (stessa impaginazione del latino)
  const w = await page.evaluate(() => { const F = window.__SA.pdfEmbFonts().R, M = F.map; return [65, 97, 48].map(c => M.get(c)[1]); });
  assert.deepStrictEqual(w, [667, 556, 556], "larghezze di A, a, 0 come Helvetica");
});

/* ------------------------------ 1.20.0 ------------------------------ */
test("1.20.0: pannello — sezioni divise in riquadri con titolo, comandi al loro posto e funzionanti", async page => {
  // ogni sezione con più funzioni ha almeno due riquadri, ognuno con un titolo
  for (const id of ["sec-orient", "sec-calib", "sec-params", "sec-load", "sec-quality", "sec-score", "sec-hit", "sec-data"]) {
    const t = await page.$$eval("#" + id + " .subsec", ss => ss.map(s => { const h = s.querySelector(":scope > .subsec-h"); return h ? [...h.childNodes].filter(n => !(n.classList && n.classList.contains("ssi"))).map(n => n.textContent).join("").trim() : ""; }));
    ok2(t.length >= (id === "sec-score" || id === "sec-hit" ? 1 : 2), id + ": riquadri " + t.length);
    ok2(t.every(x => x.length > 2), id + ": titoli " + JSON.stringify(t));
  }
  const where = { calDist: "ss-scale", bCalLock: "ss-scale", bRef: "ss-ref", bRefLock: "ss-ref", smOn: "smBox", shotDist: "ss-shot", clickVal: "ss-shot", markHand: "ss-stat", ciLevel: "ss-stat",
    gridOn: "ss-draw", heatOn: "ss-draw", ldProfile: "ldProfBox", "ld-powder": "ss-ammo", "ld-wind": "ss-cond", "ld-notes": "ss-series", qiMrRef: "ss-gqi", qiWP: "ss-tqi", qiDec: "ss-qiview",
    scoreTarget: "ss-target", tgtDx: "scoreAdj", scoreD10: "scoreCustom", hitShape: "ss-hitt", bCardPng: "ss-export", bSaveZip: "ss-session", embedImg: "ss-session", bCsvShots: "ss-tables",
    bHelp: "ss-tables", bZip: "ss-archive", bTtPdf: "ss-tt" };
  for (const [id, box] of Object.entries(where)) assert.strictEqual(await page.$eval("#" + id, e => { const s = e.closest(".subsec"); return s && s.id; }), box, id);
  // i dati di ricarica divisi in tre griglie si scrivono ancora nel gruppo attivo
  await setField(page, "#ld-powder", "Vihtavuori N140"); await setField(page, "#ld-temp", 18); await setField(page, "#ld-notes", "prova");
  assert.deepStrictEqual(await page.evaluate(() => { const l = window.__SA.state.groups[0].load; return [l.powder, l.temp, l.notes]; }), ["Vihtavuori N140", "18", "prova"]);
  // i riquadri che dipendono dal bersaglio compaiono e spariscono come prima
  assert.strictEqual(await page.isHidden("#scoreAdj"), true); assert.strictEqual(await page.isHidden("#scoreCustom"), true);
  await page.selectOption("#scoreTarget", "custom");
  ok2(await page.isVisible("#scoreAdj") && await page.isVisible("#scoreCustom"), "riquadri del bersaglio personalizzato visibili");
  await page.selectOption("#scoreTarget", "none");
  assert.strictEqual(await page.isHidden("#scoreCustom"), true);
  // titoli tradotti
  for (const [l, re] of [["en", ITALIAN], ["ru", /[A-Za-zÀ-ú]{4,}/]]) {
    await page.evaluate(l => window.__SA.setLang(l), l);
    const hs = await page.$$eval("#side .subsec-h", hs => hs.map(h => h.textContent));
    ok2(hs.every(h => !re.test(h.replace(/Result Card|GQI|TQI|CSV/g, ""))), l + ": " + hs.find(h => re.test(h.replace(/Result Card|GQI|TQI|CSV/g, ""))));
    assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.I18N.missing]), [], l + ": testi senza traduzione");
  }
});

test("1.20.0: ricerca nelle impostazioni — occorrenze, navigazione, sezioni chiuse e nascoste, suggerimenti", async page => {
  // tutto chiuso, «Dati» nascosta dal layout come farebbe ⚙
  await page.evaluate(() => { document.querySelectorAll("#side details").forEach(d => { d.open = false; }); document.getElementById("sec-data").closest("section").hidden = true; });
  // la casella è fissa in cima: resta visibile anche scorrendo il pannello
  await page.evaluate(() => { document.querySelectorAll("#side details").forEach(d => { d.open = true; }); document.getElementById("sideScroll").scrollTop = 99999; });
  const fy = await page.evaluate(() => document.getElementById("findBar").getBoundingClientRect().top - document.getElementById("sideScroll").getBoundingClientRect().top);
  ok2(Math.abs(fy) <= 1, "barra in cima anche scorrendo: " + fy);
  await page.evaluate(() => { document.querySelectorAll("#side details").forEach(d => { d.open = false; }); document.getElementById("sideScroll").scrollTop = 0; });
  // «/» porta il fuoco nella casella
  await key(page, "/");
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), "findIn");
  const state = () => page.evaluate(() => {
    const F = window.__SA.find, h = F.hits[F.i];
    return { n: F.hits.length, i: F.i, pos: document.getElementById("findPos").textContent, where: document.getElementById("findWhere").textContent,
      cur: h ? (h.el.id || h.el.htmlFor || h.el.textContent.trim().slice(0, 30)) : null,
      marks: [document.querySelectorAll("#side .find-hit").length, document.querySelectorAll("#side .find-cur").length] };
  });
  const run = async q => { await page.fill("#findIn", q); await page.press("#findIn", "Enter"); return state(); };
  // «calibro»: più occorrenze, tutte evidenziate, la prima corrente e visibile, la sua sezione aperta
  let st = await run("calibro");
  ok2(st.n >= 4, "occorrenze di «calibro»: " + st.n);
  assert.strictEqual(st.i, 0); assert.strictEqual(st.pos, "1 / " + st.n);
  assert.deepStrictEqual(st.marks, [st.n - 1, 1]);
  const ids = await page.evaluate(() => window.__SA.find.hits.map(h => h.el.htmlFor || h.el.id));
  ok2(ids.includes("caliber"), "etichetta del campo calibro tra le occorrenze: " + ids);
  const vis = async () => page.evaluate(() => {
    const F = window.__SA.find, e = F.hits[F.i].el, r = e.getBoundingClientRect(), sc = document.getElementById("sideScroll").getBoundingClientRect(), fb = document.getElementById("findBar").getBoundingClientRect();
    const d = e.closest("details");
    return r.height > 0 && r.top >= fb.bottom - 2 && r.bottom <= sc.bottom + 2 && (!d || d.open || e.tagName === "SUMMARY");
  });
  ok2(await vis(), "occorrenza corrente visibile, sezione aperta");
  // Invio avanza, Maiusc+Invio e ↑ tornano indietro, si riparte dall'inizio dopo l'ultima
  await page.press("#findIn", "Enter"); assert.strictEqual((await state()).i, 1); ok2(await vis(), "seconda visibile");
  await page.press("#findIn", "ArrowDown"); assert.strictEqual((await state()).i, 2);
  await page.press("#findIn", "Shift+Enter"); assert.strictEqual((await state()).i, 1);
  await page.press("#findIn", "ArrowUp"); await page.press("#findIn", "ArrowUp");
  st = await state(); assert.strictEqual(st.i, st.n - 1, "da prima a ultima"); ok2(await vis(), "ultima visibile");
  await page.click("#bFindNext"); assert.strictEqual((await state()).i, 0, "dopo l'ultima, la prima");
  await page.click("#bFindPrev"); assert.strictEqual((await state()).i, st.n - 1);
  // trovata solo nel suggerimento: è indicato, con sezione › riquadro
  st = await run("barilotto");
  assert.strictEqual(st.n, 1); assert.strictEqual(st.cur, "lensK1");
  ok2(/Gestione immagine › Distorsione dell'obiettivo/.test(st.where) && /nel suggerimento: «.*barilotto/.test(st.where), st.where);
  // senza accenti e maiuscole; il segnaposto del campo collegato vale come suggerimento
  st = await run("VELOCITA");
  { const ids = await page.evaluate(() => window.__SA.find.hits.map(h => h.el.htmlFor || h.el.id)); ok2(ids.includes("ld-wind") && ids.includes("ld-v0"), "anche dal segnaposto: " + ids); }
  // sezione nascosta dal layout: mostrata finché serve, il layout non cambia
  st = await run("Esporta archivio");
  assert.strictEqual(st.cur, "bZip"); ok2(await page.isVisible("#bZip"), "comando nella sezione nascosta visibile");
  ok2(/sezione nascosta nel layout/.test(st.where), st.where);
  assert.strictEqual(await page.evaluate(() => document.getElementById("sec-data").closest("section").hidden), true, "layout invariato");
  await page.press("#findIn", "Escape");
  assert.strictEqual(await page.inputValue("#findIn"), ""); assert.strictEqual(await page.isHidden("#bZip"), true, "di nuovo nascosta");
  assert.deepStrictEqual((await state()).marks, [0, 0]);
  await page.press("#findIn", "Escape"); assert.notStrictEqual(await page.evaluate(() => document.activeElement.id), "findIn", "secondo Esc: esce");
  // voci non applicabili ora (riquadri nascosti) non contano; nessuna occorrenza = «nessuna»
  st = await run("fattore di potenza");
  assert.strictEqual(st.n, 0); assert.strictEqual(st.pos, "nessuna"); ok2(await page.$eval("#findPos", e => e.classList.contains("none")), "segnalata");
  await page.evaluate(() => { document.getElementById("sec-score").open = true; });
  await page.selectOption("#scoreTarget", "ipsc"); await page.dispatchEvent("#scoreTarget", "change");
  st = await run("fattore di potenza"); assert.strictEqual(st.n, 1); assert.strictEqual(st.cur, "ipscPF");
  // non cerca nei contenuti calcolati (risultati, tabella dei punti, elenco dei gruppi)
  await page.selectOption("#scoreTarget", "none"); await page.dispatchEvent("#scoreTarget", "change");
  await expandAll(page); await loadTarget(page); await setupGroup(page, POA, SHOTS); await expandAll(page);
  await run("gruppo");
  ok2(await page.evaluate(() => window.__SA.find.hits.every(h => !h.el.closest("#results, #points, #groups, #qiTop"))), "solo impostazioni");
  // in inglese la ricerca segue la lingua (anche la posizione)
  await page.evaluate(() => window.__SA.setLang("en"));
  st = await run("caliber");
  ok2(st.n >= 3 && !ITALIAN.test(st.where), "in inglese: " + st.n + " " + st.where);
  st = await run("zzzz"); assert.strictEqual(st.pos, "none");
  assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.I18N.missing]), []);
});

/* ------------------------------ 1.21.0 ------------------------------ */
test("1.21.0: arma, BC e velocità nel gruppo e nei profili; nomi dei file ShAn; ZIP principale; chiudi tutti i gruppi", async page => {
  page.on("dialog", d => d.accept());
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await expandAll(page);
  // il riquadro «Arma» e i campi della munizione
  assert.strictEqual(await page.$eval("#ld-weapon", e => e.closest(".subsec").id), "ss-weapon");
  for (const id of ["ld-bc", "ld-bcModel", "ld-v0", "ld-v0Unit", "ld-v0sd"]) assert.strictEqual(await page.$eval("#" + id, e => e.closest(".subsec").id), "ss-ammo", id);
  assert.strictEqual(await page.inputValue("#ld-bcModel"), "G1", "modello predefinito"); assert.strictEqual(await page.inputValue("#ld-v0Unit"), "m/s");
  await setField(page, "#ld-weapon", "Tikka T3x"); await setField(page, "#ld-sightH", 45); await setField(page, "#ld-zero", 100);
  await setField(page, "#ld-bc", "0.243"); await page.selectOption("#ld-bcModel", "G7"); await setField(page, "#ld-v0", 800); await setField(page, "#ld-v0sd", 8);
  await page.selectOption("#ld-v0Unit", "fps");
  assert.strictEqual((await page.textContent("#ldV0sdU")).trim(), "fps", "la SD segue l'unità della velocità");
  await page.selectOption("#ld-v0Unit", "m/s");
  const L = await page.evaluate(() => window.__SA.state.groups[0].load);
  assert.deepStrictEqual([L.weapon, L.sightH, L.zero, L.bc, L.bcModel, L.v0, L.v0sd], ["Tikka T3x", "45", "100", "0.243", "G7", "800", "8"]);
  // profilo: contiene arma e balistica; il nome del profilo entra nel nome dei file
  await page.fill("#ldProfName", "Lapua 155"); await page.click("#bProfSave");
  const P = await page.evaluate(() => JSON.parse(localStorage.getItem("shootAnalyzer.loadProfiles")));
  ok2(P.length === 1 && P[0].weapon === "Tikka T3x" && P[0].bc === "0.243" && P[0].bcModel === "G7" && P[0].v0sd === "8", "profilo con arma e balistica");
  assert.strictEqual(await page.evaluate(() => window.__SA.state.groups[0].load.profile), "Lapua 155");
  // Ctrl+S salva lo ZIP con il nome ShAn-Session-<arma>-<profilo>-AAAAMMGG-hhmm
  const [dl] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Control+s")]);
  assert.match(dl.suggestedFilename(), /^ShAn-Session-Tikka T3x-Lapua 155-\d{8}-\d{4}\.zip$/);
  const f = await download(page, "#bCsvGroups");
  assert.match(f.name, /^ShAn-CSVGroups-Tikka T3x-Lapua 155-\d{8}-\d{4}\.csv$/);
  ok2(/Arma/.test(f.text.split("\n")[0]) && f.text.includes("Tikka T3x") && f.text.includes("Lapua 155"), "CSV dei gruppi con arma e profilo");
  // dati cambiati: il profilo non vale più (spazio nel nome); riapplicato torna
  await setField(page, "#ld-powder", "N150");
  assert.strictEqual(await page.evaluate(() => window.__SA.groupProfileName(window.__SA.state.groups[0])), "");
  assert.match(await page.evaluate(() => window.__SA.fileName("PDFReport", "pdf")), /^ShAn-PDFReport-Tikka T3x- -\d{8}-\d{4}\.pdf$/);
  await page.selectOption("#ldProfile", "Lapua 155"); await page.dispatchEvent("#ldProfile", "change");
  if (await page.isVisible("#bProfApply")) await page.click("#bProfApply");
  assert.strictEqual(await page.evaluate(() => window.__SA.groupProfileName(window.__SA.state.groups[0])), "Lapua 155", "profilo riapplicato");
  // caratteri non ammessi da Windows → spazi; nuovo gruppo eredita l'arma
  await setField(page, "#ld-weapon", 'A/B:C*"x"');
  assert.match(await page.evaluate(() => window.__SA.fileName("ResCar", "png")), /^ShAn-ResCar-A B C x- -\d{8}-\d{4}\.png$/);
  await page.click("#bAddGroup");
  assert.strictEqual(await page.evaluate(() => window.__SA.state.groups[1].load.weapon), 'A/B:C*"x"', "il nuovo gruppo copia l'arma");
  // riepilogo testuale e report
  ok2((await page.evaluate(() => window.__SA.loadLines(window.__SA.state.groups[0]).map(r => r.join(": ")).join("\n"))).match(/Balistica: BC 0,243 G7 · V0 800 m\/s · SD 8 m\/s/), "riga balistica");
  // blocco Dati: sessione prima di tutto, ZIP in blu, Result Card no
  assert.strictEqual(await page.$eval("#sec-data .subsec", e => e.id), "ss-session");
  ok2(await page.$eval("#bSaveZip", e => e.classList.contains("primary")) && !(await page.$eval("#bCardPng", e => e.classList.contains("primary"))), "colori dei pulsanti");
  // 1.22: il pulsante in cima al pannello comprime/espande tutti i blocchi
  await page.click("#bSecFold");
  ok2(await page.$$eval("#sideScroll > section:not([hidden]) > details.box", ds => ds.every(d => !d.open)), "tutti i blocchi compressi");
  assert.strictEqual((await page.textContent("#bSecFold")).trim(), "⊞");
  await page.click("#bSecFold");
  ok2(await page.$$eval("#sideScroll > section:not([hidden]) > details.box", ds => ds.every(d => d.open)), "tutti i blocchi espansi");
  assert.strictEqual((await page.textContent("#bSecFold")).trim(), "⊟");
});

test("1.21.0: pagine separate, calcolatore balistico e Monte Carlo nel confronto", async page => {
  page.on("dialog", d => d.accept());
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100); await setField(page, "#clickVal", 0.1); await page.selectOption("#clickUnit", "MIL");
  await expandAll(page);
  for (let i = 0; i < 5; i++) await setDialCell(page, i, "dv", 10);
  await key(page, "c"); await page.waitForFunction(() => window.__SA.anaOpen());
  ok2(/servono.*velocità iniziale, coefficiente balistico/.test(await page.textContent("#balBody")), "dati mancanti indicati");
  ok2(await page.isHidden("#chartsBox") && await page.isHidden("#diagBox") && await page.isHidden("#holdBox"), "pagina del confronto senza i grafici del gruppo");
  await key(page, "Escape");
  await setField(page, "#ld-sightH", 70); await setField(page, "#ld-zero", 100); await setField(page, "#ld-bc", "0.243"); await page.selectOption("#ld-bcModel", "G7");
  await setField(page, "#ld-v0", 777.24); await setField(page, "#ld-v0sd", 6);
  await key(page, "c"); await page.waitForFunction(() => window.__SA.anaOpen());
  await setField(page, "#balDist", 600);
  const t = await page.textContent("#balBody");
  ok2(/Dati di «Gruppo 1»: V0 777 m\/s · BC 0,243 G7/.test(t) && /valori standard ICAO per temperatura, pressione, umidità/.test(t), "dati usati: " + t.slice(0, 200));
  ok2(/A 600 m: caduta .* → alzo \+5,(59|6\d) MIL/.test(t), "stima a 600 m (≈ 5,6 MIL come la tabella AB): " + t);
  assert.strictEqual(await page.locator("#balBody table.cmp tbody tr").count(), 1, "una riga di dope da confrontare");
  ok2(await page.evaluate(() => document.getElementById("chBal").width > 0), "grafico disegnato");
  // vento del gruppo: da ore 3 a 4 m/s → deriva a sinistra, brandeggio a destra
  await key(page, "Escape"); await setField(page, "#ld-wind", 4); await page.click('#windDial g[data-h="3"]');
  await key(page, "c"); await page.waitForFunction(() => window.__SA.anaOpen());
  ok2(/deriva .* a sinistra → brandeggio \+/.test(await page.textContent("#balBody")), "deriva col vento");
  // Monte Carlo
  const mc = await page.evaluate(() => { const D = window.__SA.mcData(); return D.msg ? D.msg : { n: D.sim.rows.length, vel: D.sim.rows.map(r => r.esVel), ang: D.sigAng, pool: D.pool.sigma }; });
  ok2(mc.n === 10 && mc.vel.every((v, i) => i === 0 || v >= mc.vel[i - 1]) && mc.ang > 0 && mc.ang <= mc.pool, "simulazione: " + JSON.stringify(mc));
  await setField(page, "#mcAt", 450);
  assert.strictEqual(await page.locator("#mcBody table.cmp tbody tr").count(), 11, "10 distanze + la rosata");
  assert.strictEqual((await page.textContent("#mcAtLbl")).trim(), "450 m");
  ok2(await page.evaluate(() => document.getElementById("chMC").width > 0 && document.getElementById("chMCRos").width > 0), "grafici Monte Carlo");
  // inglese e russo: nessun testo senza traduzione nelle due pagine
  for (const l of ["en", "ru"]) {
    await page.evaluate(l => window.__SA.setLang(l), l);
    await page.evaluate(() => { window.__SA.openAnalysis("group"); window.__SA.openAnalysis("cmp"); });
    assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.I18N.missing]), [], l);
  }
  await page.evaluate(() => window.__SA.setLang("en"));
  ok2(!ITALIAN.test(await page.textContent("#balBox")) && !ITALIAN.test(await page.textContent("#mcBox")), "pannelli in inglese");
});

test("1.21.0: ruota degli errori (pistola) sulla foto e nella pagina del gruppo", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await expandAll(page);
  const D = await page.evaluate(() => { const W = window.__SA.wheelData(window.__SA.state.groups[0], "poa", "R"); return { n: W.pts.length, inner: W.W.inner, sum: W.W.sectors.reduce((a, s) => a + s.n, 0), keys: W.W.sectors.map(s => s.n) }; });
  assert.strictEqual(D.inner + D.sum, D.n, "ogni colpo in un settore o nella zona centrale");
  const L = await page.evaluate(() => window.__SA.wheelData(window.__SA.state.groups[0], "poa", "L").W.sectors.map(s => s.n));
  assert.deepStrictEqual(L, [D.keys[0], D.keys[7], D.keys[6], D.keys[5], D.keys[4], D.keys[3], D.keys[2], D.keys[1]], "mancino: specchiata");
  // sovrapposta alla foto: cambia il disegno
  const before = await page.evaluate(() => document.getElementById("canvas").toDataURL().length);
  await page.check("#diagOn"); await page.waitForTimeout(200);
  ok2(await page.evaluate(() => document.getElementById("canvas").toDataURL().length) !== before, "ruota disegnata sulla foto");
  // pagina del gruppo: grafico interattivo
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
  ok2(await page.isVisible("#diagBox") && await page.isHidden("#cmpBox"), "ruota nella pagina del gruppo");
  ok2(/euristica/.test(await page.textContent("#diagNote")), "dichiarata indicativa");
  const hit = await page.evaluate(() => { const h = window.__SA.CH.hits.diag.find(h => h.i === 5); const a = (h.a0 + 22.5) * Math.PI / 180; return { x: h.cx + 0.6 * h.R * Math.sin(a), y: h.cy - 0.6 * h.R * Math.cos(a) }; });
  await page.click("#chDiag", { position: hit });
  ok2(/Ore 7–8 · Strappo del grilletto/.test(await page.textContent("#diagInfo")), "clic sul settore delle 7–8: " + await page.textContent("#diagInfo"));
  await page.selectOption("#diagHand2", "L");
  assert.strictEqual(await page.inputValue("#diagHand"), "L", "mano sincronizzata con il pannello");
  ok2(/Ore 4–5 · Strappo del grilletto/.test(await page.textContent("#diagInfo")), "mancino: stessa causa, posizione specchiata");
});

test("1.22.0: Modalità Base, blocchi comprimibili, guida senza novità", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100); await setField(page, "#clickVal", 0.1); await page.selectOption("#clickUnit", "MIL");
  await expandAll(page);
  const keys = () => page.$$eval("#results .res[data-gid] .rcard", cs => cs.map(c => c.dataset.key));
  ok2((await keys()).includes("mr") && (await keys()).includes("gqi"), "Esperto: tutte le card");
  ok2(!/Novità|New in/.test(await page.textContent("#sec-guide")), "guida senza le novità per versione");
  ok2(/1\. Carica la foto/.test(await page.textContent("#sec-guide")) && /Scorciatoie – strumenti/.test(await page.textContent("#sec-guide")), "guida per flusso di lavoro");
  await page.selectOption("#uiModeSel", "basic");
  assert.deepStrictEqual(await keys(), ["es", "corr"], "Base: solo group size e correzione");
  ok2(await page.isHidden("#sec-quality") && await page.isHidden("#sec-hit") && await page.isHidden("#bCompare") && await page.isHidden("#qiTop"), "Base: Qualità, Probabilità, Confronto nascosti");
  ok2(!/raggio medio/.test(await page.textContent("#results .resg-sum")), "riga riassuntiva senza raggio medio");
  await key(page, "c");
  ok2(!(await page.evaluate(() => window.__SA.anaOpen())), "C non apre il confronto in Base");
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
  ok2(await page.isHidden("#bAnaSwitch"), "niente pulsante verso il confronto"); await key(page, "Escape");
  await page.fill("#findIn", "GQI"); await page.dispatchEvent("#findIn", "input"); await page.waitForTimeout(300);
  ok2(await page.evaluate(() => window.__SA.find.hits.every(h => !h.el.closest(".xp-only"))), "la ricerca ignora le sezioni nascoste");
  await page.fill("#findIn", ""); await page.dispatchEvent("#findIn", "input");
  // gli export restano completi
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const f = await download(page, "#bCsvGroups");
  assert.match(f.name, /^ShAn-CSVGroups- - -\d{8}-\d{4}\.csv$/);
  ok2(/CEP/.test(f.text.split("\n")[0]) && /GQI/.test(f.text.split("\n")[0]), "CSV dei gruppi completo anche in Base");
  ok2(await page.evaluate(() => localStorage.getItem("shootAnalyzer.uiMode")) === "basic", "scelta ricordata");
  // ⊟ in Base agisce sui blocchi visibili
  await page.click("#bSecFold");
  ok2(await page.$$eval("#sideScroll > section:not([hidden]) > details.box", ds => ds.filter(d => d.offsetParent).every(d => !d.open)), "blocchi compressi");
  await page.click("#bSecFold");
  await page.selectOption("#uiModeSel", "expert");
  ok2((await keys()).includes("mr") && !(await page.isHidden("#sec-quality")), "di nuovo Esperto");
  for (const l of ["en", "ru"]) { await page.evaluate(l => window.__SA.setLang(l), l); assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.I18N.missing]), [], l); }
});

test("1.22.0: stima guidata del BC", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100); await setField(page, "#clickVal", 0.1); await page.selectOption("#clickUnit", "MIL");
  await expandAll(page);
  await page.click("#bBcWiz");
  ok2(await page.isVisible("#bcWiz"), "finestra aperta");
  ok2(/Mancano .*velocità iniziale, altezza ottica, azzeramento/.test(await page.textContent("#bcWizInfo")) || /Mancano .*velocità iniziale/.test(await page.textContent("#bcWizInfo")), "dati mancanti: " + await page.textContent("#bcWizInfo"));
  await page.click("#bBwClose");
  await setField(page, "#ld-sightH", 70); await setField(page, "#ld-zero", 100); await setField(page, "#ld-bc", "0.243"); await page.selectOption("#ld-bcModel", "G7");
  await setField(page, "#ld-v0", 777.24);
  // correzioni «osservate» sintetiche con BC 0,300 G7 a 500 e 900 m
  const obs = await page.evaluate(() => window.__SA.Calc.trajectory({ v0: 777.24, bc: 0.3, model: "G7", sightH: 0.07, zero: 100, atm: window.__SA.Calc.atmosphere(), dists: [500, 900] }).rows.map(r => +r.vMil.toFixed(2)));
  await page.click("#bBcWiz");
  assert.strictEqual(await page.inputValue("#bwUnit"), "MIL");
  await setField(page, "#bwD1", 500); await setField(page, "#bwC1", obs[0]); await setField(page, "#bwD2", 900); await setField(page, "#bwC2", obs[1]);
  const t = await page.textContent("#bcWizOut");
  ok2(/BC stimato 0,(299|300|301) G7/.test(t) && /inserito 0,243 → \+2\d,\d%/.test(t) && /Attendibilità: buona/.test(t), "stima: " + t.slice(0, 300));
  assert.strictEqual(await page.locator("#bcWizOut table.cmp tbody tr").count(), 2);
  // conversione dell'unità: i valori diventano MOA
  await page.focus("#bwUnit"); await page.selectOption("#bwUnit", "MOA");
  ok2(Math.abs(+(await page.inputValue("#bwC1")) - obs[0] * 3.4377) < 0.02, "correzione convertita in MOA");
  ok2(/BC stimato 0,(299|300|301) G7/.test(await page.textContent("#bcWizOut")), "stessa stima in MOA");
  // distanze corte: poco affidabile
  await page.selectOption("#bwUnit", "MIL");
  await setField(page, "#bwD1", 150); await setField(page, "#bwC1", 0.3); await setField(page, "#bwD2", 200); await setField(page, "#bwC2", 0.6);
  ok2(/poco affidabile/.test(await page.textContent("#bcWizOut")), "distanze corte segnalate");
  await setField(page, "#bwD1", 500); await setField(page, "#bwC1", obs[0]); await setField(page, "#bwD2", 900); await setField(page, "#bwC2", obs[1]);
  for (const l of ["en", "ru"]) { await page.evaluate(l => { window.__SA.setLang(l); window.__SA.bwRun(); }, l); assert.deepStrictEqual(await page.evaluate(() => [...window.__SA.I18N.missing]), [], l); }
  await page.evaluate(() => { window.__SA.setLang("it"); window.__SA.bwRun(); });
  await page.click("#bBwUse");
  assert.strictEqual(await page.evaluate(() => window.__SA.state.groups[0].load.bc), "0.3");
  ok2(/inserito 0,300 → [+−]?0,\d%/.test(await page.textContent("#bcWizOut")), "dopo «Usa» il BC inserito coincide");
  await key(page, "Escape"); ok2(await page.isHidden("#bcWiz"), "Esc chiude");
  await page.keyboard.press("Control+z");
  assert.strictEqual(await page.evaluate(() => window.__SA.state.groups[0].load.bc), "0.243", "annullabile");
  // dalla Dope Card: il gruppo a 100 m con i click
  for (let i = 0; i < 5; i++) await setDialCell(page, i, "dv", 10);
  for (const f of ["D1", "C1", "D2", "C2"]) await page.evaluate(id => { document.getElementById(id).value = ""; }, "bw" + f);
  await page.click("#bBcWiz");
  assert.strictEqual(await page.inputValue("#bwD1"), "100", "distanza presa dalla dope");
  ok2(/vicina all'azzeramento/.test(await page.textContent("#bcWizOut")), "avviso: distanza dell'azzeramento");
});

/* ------------------------------ esecuzione ------------------------------ */
(async () => {
  const opts = { headless: true };
  if (process.env.PW_CHANNEL) opts.channel = process.env.PW_CHANNEL;
  if (process.env.CHROME_PATH) opts.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(opts);
  let failed = 0;
  for (const t of tests) {
    if (process.env.UI_ONLY && !new RegExp(process.env.UI_ONLY).test(t.name)) continue;   // es. UI_ONLY=lingua
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
    const page = await openApp(context);
    try {
      await t.fn(page);
      await page.waitForTimeout(50);   // lascia arrivare eventuali errori asincroni (disegno, toast)
      assert.deepStrictEqual(page.problems, [], "errori o richieste di rete: " + JSON.stringify(page.problems).slice(0, 400));
      console.log("  ✓ " + t.name);
    } catch (e) {
      failed++;
      console.log("  ✗ " + t.name + "\n      " + String(e && e.stack || e).split("\n").slice(0, 9).join("\n      "));
    }
    await context.close();
  }
  await browser.close();
  if (failed) { console.log(`\n${failed} test UI falliti su ${tests.length}`); process.exit(1); }
  console.log(`\nOK — ${tests.length} test UI superati`);
})().catch(e => { console.error(e); process.exit(1); });
