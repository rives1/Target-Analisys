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
  assert.ok(await page.isVisible("#anaView"), "tasto A");
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
  assert.match(dl.suggestedFilename(), /^bersaglio_Gruppo_1_card_\d{4}-\d\d-\d\d--\d\d-\d\d\.png$/);
  await page.click("#bAddGroup"); await clickAt(page, { x: 300, y: 400 });
  for (const q of [{ x: 330, y: 380 }, { x: 345, y: 395 }]) await clickAt(page, q);
  await page.selectOption("#cardScope", "all");
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.click("#bCardPng")]);
  assert.match(dl2.suggestedFilename(), /tutti_i_gruppi_card_/);
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
  assert.match(f.name, /^bersaglio_fori_\d{4}-\d\d-\d\d--\d\d-\d\d\.csv$/);
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
  // preset 10 × 10 e 30 × 30 mm del rettangolo di riferimento
  await page.selectOption("#perspPreset", "10x10");
  assert.deepStrictEqual([await page.inputValue("#perspW"), await page.inputValue("#perspH")], ["10", "10"]);
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
  assert.match(dl.suggestedFilename(), /^shoot-analyzer_archivio_\d{4}-\d\d-\d\d--\d\d-\d\d\.zip$/);
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
  await page.selectOption("#ld-windDir", "9"); await page.dispatchEvent("#ld-windDir", "change");
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
  assert.strictEqual((await page.textContent("#bLoad")).trim(), "📂 Load photo");
  assert.strictEqual(await page.getAttribute("#bUndo", "title"), "Undo (Ctrl+Z)");
  // lavoro completo in inglese
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  await page.selectOption("#scoreTarget", "issf50r"); await page.dispatchEvent("#scoreTarget", "change");
  await setField(page, "#ld-charge", "42.5"); await setField(page, "#ld-notes", "test note"); await setField(page, "#ld-humidity", "55");
  await page.selectOption("#ld-windDir", "3"); await page.dispatchEvent("#ld-windDir", "change");
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
  assert.match(f.name, /^bersaglio_shots_\d{4}-\d\d-\d\d--\d\d-\d\d\.csv$/);
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
  assert.match(dl.suggestedFilename(), /^shoot-analyzer_archive_/);
  const Z = readZip(require("fs").readFileSync(await dl.path()));
  const names = Object.keys(Z);
  ok2(names.includes("README.txt") && names.includes("groups_summary.csv"), "file alla radice in inglese");
  ok2(names.some(n => /\/session\.json$/.test(n)) && names.some(n => /\/shots\.csv$/.test(n)) && names.some(n => /\/groups\.csv$/.test(n)), "file di sessione in inglese");
  ok2(/CSV in English format/.test(Z["README.txt"].toString("utf8")), "LEGGIMI in inglese");
  // report PDF in inglese (le chiavi del report passano dal dizionario)
  const [pdf] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bPdf")]);
  assert.match(pdf.suggestedFilename(), /_report_.*\.pdf$/);
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
  ok2(/Raggio medio/.test(await page.innerText("#results")), "risultati in italiano");
  await page.selectOption("#langSel", "en");
  const res = await page.innerText("#results");
  ok2(/Mean radius/.test(res) && !/Raggio medio/.test(res), "risultati ridisegnati in inglese");
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
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
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
  assert.match(f.name, /^dope_card_\d{4}-\d\d-\d\d--\d\d-\d\d\.csv$/);
  ok2(!/"-?\d+,\d+"/.test(f.text), "in italiano i numeri con la virgola decimale non hanno virgolette");
  const C = parseCsv(f.text.slice(1));
  assert.strictEqual(C.length, 3, "CSV: intestazione + 2 righe " + JSON.stringify(C)); assert.strictEqual(C[0][0], "Distanza (m)");
  near(parseFloat(C[2][1].replace(",", ".")), exp[1], 0.006, "CSV: click di alzo a 200 m");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#bDopePng")]);
  assert.match(dl.suggestedFilename(), /^dope_card_.*\.png$/);
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
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
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
function checkPdf(buf) {
  const t = buf.toString("latin1");
  assert.ok(t.startsWith("%PDF-1.4\n"), "intestazione PDF");
  assert.ok(/%%EOF\n$/.test(t), "fine del file");
  const sx = +t.match(/startxref\n(\d+)\n%%EOF/)[1];
  assert.ok(t.slice(sx).startsWith("xref\n"), "startxref punta alla tabella xref");
  const m = t.slice(sx).match(/^xref\n0 (\d+)\n/), n = +m[1];
  const lines = t.slice(sx + m[0].length).split("\n").slice(0, n);
  lines.slice(1).forEach((l, i) => { const off = +l.slice(0, 10); assert.ok(t.startsWith(`${i + 1} 0 obj`, off), `offset dell'oggetto ${i + 1}`); });
  const pages = (t.match(/\/Type \/Page /g) || []).length;
  assert.strictEqual((t.match(/\/Filter \/DCTDecode/g) || []).length, pages, "un'immagine JPEG per pagina");
  assert.ok(t.includes(`/Count ${pages}`), "conteggio delle pagine");
  return pages;
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
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
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
  assert.match(d1.suggestedFilename(), /^bersaglio_report_\d{4}-\d\d-\d\d--\d\d-\d\d\.pdf$/);
  const b1 = require("fs").readFileSync(await d1.path());
  const p1 = checkPdf(b1);
  ok2(p1 >= 1 && p1 <= 3, `gruppo attivo: ${p1} pagine`);
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
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
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
  assert.match(dl.suggestedFilename(), /^reticolo_.*\.png$/);
  ok2(require("fs").statSync(await dl.path()).size > 5000, "PNG non vuoto");
});

test("bersaglio di autoverifica: PDF, foto del bersaglio stampato, misura e verifica", async page => {
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await page.selectOption("#ttN", "5");
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click("#bTtPdf")]);
  const code = +(await page.inputValue("#ttCode"));
  ok2(code >= 1000 && code <= 9999, "codice nuovo");
  assert.strictEqual(dl.suggestedFilename(), `bersaglio_prova_SA-${code}.pdf`);
  const buf = require("fs").readFileSync(await dl.path());
  assert.strictEqual(checkPdf(buf), 1, "una pagina");
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
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
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
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
  await page.selectOption("#corPair", "ladder"); C = await page.evaluate(() => window.__SA.corData());
  assert.strictEqual(C.pts.filter(p => p.x >= 44 && p.x <= 44.81 && p.x !== 44.5 && p.x !== 45).length >= 5, true, "un punto per foro con la sua carica");
  ok2(/non indica «nodi»/.test(await page.textContent("#corBody")), "nessun nodo automatico");
});

test("cono di dispersione: σ angolare, distanze entro 2×, mappa e 3D ruotabile", async page => {
  await loadTarget(page);
  await setupGroup(page, POA, SHOTS);
  await setField(page, "#shotDist", 100);
  await key(page, "a"); await page.waitForFunction(() => window.__SA.anaOpen());
  let C = await page.evaluate(() => window.__SA.coneData());
  const sig = await page.evaluate(() => { const S = window.__SA, g = S.state.groups[0], d = S.Calc.dispersion(g.shots); return d.sigma / S.calcContext().pxPerMm / 100; });
  near(C.sigma, sig, 1e-9, "σ in MIL = σ mm / distanza in m");
  assert.deepStrictEqual(C.dists, [50, 100, 150, 200], "distanze automatiche: ½, 1, 1½, 2 volte");
  await setField(page, "#coneDists", "100; 300; 150");
  C = await page.evaluate(() => window.__SA.coneData());
  assert.deepStrictEqual(C.dists, [100, 150], "oltre 2× esclusa"); assert.deepStrictEqual(C.dropped, [300]);
  ok2(/Distanze escluse/.test(await page.textContent("#coneBody")), "avviso");
  const t = await page.textContent("#coneBody"), R95 = 2 * Math.sqrt(-2 * Math.log(0.05)) * sig * 150;
  ok2(t.includes(R95.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })), "R95 a 150 m proporzionale alla distanza");
  ok2((await page.evaluate(() => window.__SA.CH.hits.conemap.length)) === 10, "5 fori × 2 distanze");
  await page.locator("#chCone3d").scrollIntoViewIfNeeded();
  const b = await page.locator("#chCone3d").boundingBox(), az0 = await page.evaluate(() => window.__SA.VIEWCONE.az);
  await page.mouse.move(b.x + 100, b.y + 100); await page.mouse.down(); await page.mouse.move(b.x + 180, b.y + 100, { steps: 3 }); await page.mouse.up();
  ok2(await page.evaluate(() => window.__SA.VIEWCONE.az) !== az0, "trascinando il cono ruota");
  await page.selectOption("#coneSrc", "load");
  ok2(await page.evaluate(() => window.__SA.coneData().rows.length) >= 1, "gruppi della munizione");
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
      console.log("  ✗ " + t.name + "\n      " + String(e && e.stack || e).split("\n").slice(0, 4).join("\n      "));
    }
    await context.close();
  }
  await browser.close();
  if (failed) { console.log(`\n${failed} test UI falliti su ${tests.length}`); process.exit(1); }
  console.log(`\nOK — ${tests.length} test UI superati`);
})().catch(e => { console.error(e); process.exit(1); });
