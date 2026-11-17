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
  assert.match(csvF.split("\r\n")[0], /;Punti;10 interno;Sulla linea$/);
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
test("sezioni comprimibili: stato all'apertura dell'app", async page => {
  await page.reload(); await page.waitForFunction(() => window.__SA && window.__SA.state);
  const st = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#side details")].map(d => [d.id, d.open])));
  for (const id of ["sec-params", "sec-orient", "sec-results", "sec-score", "sec-hit"]) assert.strictEqual(st[id], false, `${id} chiusa all'avvio`);
  for (const id of ["sec-calib", "sec-groups", "sec-load", "sec-points", "sec-data"]) assert.strictEqual(st[id], true, `${id} aperta all'avvio`);
  assert.strictEqual(st["sec-guide"], false, "guida rapida chiusa");
  ok2(await page.isHidden("#shotDist"), "campo nascosto con la sezione chiusa");
  await page.click("#sec-params > summary");
  ok2(await page.isVisible("#shotDist"), "la sezione si apre col clic sul titolo");
  await page.click("#sec-groups > summary");
  ok2(await page.isHidden("#bAddGroup"), "anche le sezioni aperte si chiudono");
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
  const s1 = await S(page);
  assert.strictEqual(s1.g.name, "Group 1", "nome automatico del gruppo in inglese");
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
      assert.deepStrictEqual(page.problems, [], "errori o richieste di rete");
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
