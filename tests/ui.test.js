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
  return page;
}
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
  await page.reload(); await page.waitForFunction(() => window.__SA);
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
  await page.reload(); await page.waitForFunction(() => window.__SA);
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

/* ------------------------------ esecuzione ------------------------------ */
(async () => {
  const opts = { headless: true };
  if (process.env.PW_CHANNEL) opts.channel = process.env.PW_CHANNEL;
  if (process.env.CHROME_PATH) opts.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(opts);
  let failed = 0;
  for (const t of tests) {
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
