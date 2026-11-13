// Test del motore di calcolo. Esecuzione: node tests/calc.test.js
// Estrae il blocco <script id="calc-engine"> da src/index.html e lo valuta in isolamento.
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "..", "src", "index.html"), "utf8");
const m = html.match(/<script id="calc-engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error("blocco calc-engine non trovato");
const mod = { exports: {} };
new Function("module", m[1])(mod);
const Calc = mod.exports;

let passed = 0;
const near = (a, b, tol, msg) => { assert.ok(Math.abs(a - b) <= tol, `${msg}: atteso ${b}, ottenuto ${a}`); passed++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); passed++; };
const ok = (c, msg) => { assert.ok(c, msg); passed++; };

// --- geometria di base
near(Calc.dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5, 1e-12, "distanza euclidea");
eq(Calc.centroid([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 3 }]), { x: 1, y: 1 }, "centroide");
const es = Calc.extremeSpread([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 6, y: 8 }]);
near(es.d, 10, 1e-12, "extreme spread"); eq([es.i, es.j], [0, 2], "indici ES");
near(Calc.meanRadius([{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }], { x: 0, y: 0 }), 1, 1e-12, "raggio medio");

// --- scala: 200 px = 10 mm → 20 px/mm; 1 in = 25.4 mm
near(Calc.scale({ x: 0, y: 0 }, { x: 200, y: 0 }, 10, "mm"), 20, 1e-12, "scala mm");
near(Calc.scale({ x: 0, y: 0 }, { x: 254, y: 0 }, 1, "in"), 10, 1e-12, "scala pollici");
eq(Calc.scale({ x: 0, y: 0 }, { x: 0, y: 0 }, 10, "mm"), null, "scala degenere");

// --- conversioni angolari di riferimento
// 1 MOA a 100 yd = 1.0472 in (valore noto)
const D100yd = 100 * 914.4;
near(Calc.fromRad(Calc.angleOfSize(1.04720 * 25.4, D100yd), "MOA"), 1, 1e-4, "1 MOA = 1.047\" @100yd");
// 1 in @100 yd = 1 IPHY = 0.955 MOA
near(Calc.fromRad(Calc.angleOfSize(25.4, D100yd), "IPHY"), 1, 1e-6, "1 IPHY");
near(Calc.fromRad(Calc.angleOfSize(25.4, D100yd), "MOA"), 0.95493, 1e-4, "1\" @100yd = 0.955 MOA");
// 1 MIL a 100 m = 100 mm
near(Calc.fromRad(Calc.angleOfSize(100, 100000), "MIL"), 1, 1e-6, "1 MIL = 10 cm @100 m");
// 1 MIL = 3.43775 MOA
near(Calc.fromRad(0.001, "MOA"), 3.43775, 1e-5, "1 mrad in MOA");

// --- analisi completa
// scala 10 px/mm; 4 colpi su un quadrato di lato 20 mm centrato su (1000,1000) px
const shots = [{ x: 900, y: 900 }, { x: 1100, y: 900 }, { x: 1100, y: 1100 }, { x: 900, y: 1100 }];
// punto di mira 30 mm SOPRA e 10 mm a DESTRA del centro → gruppo basso e a sinistra
const poa = { x: 1100, y: 700 };
const ctx = { pxPerMm: 10, distMm: 100000, caliberMm: 7.62, clickValue: 0.1, clickUnit: "MIL" };
const r = Calc.analyze(shots, poa, ctx);
near(r.mm.es, Math.hypot(20, 20), 1e-9, "ES mm (diagonale)");
near(r.mm.esEdge, Math.hypot(20, 20) + 7.62, 1e-9, "bordo-bordo = c-c + calibro");
near(r.mm.mr, Math.hypot(10, 10), 1e-9, "MR mm");
near(r.mm.w, 20, 1e-9, "larghezza"); near(r.mm.h, 20, 1e-9, "altezza");
near(r.offset.dx, -10, 1e-9, "offset X (sinistra)");
near(r.offset.dy, -30, 1e-9, "offset Y (basso)");
// 30 mm a 100 m = 0.3 mil → 3 click SU; 10 mm = 0.1 mil → 1 click DESTRA
eq(r.correction.vClicks, 3, "click verticali"); eq(r.correction.vDir, "SU", "direzione verticale");
eq(r.correction.hClicks, 1, "click orizzontali"); eq(r.correction.hDir, "DESTRA", "direzione orizzontale");

// stesso scenario in MOA 1/4 a 100 yd: 30 mm = 1.181 in → 1.128 MOA → 4.51 → 5 click
const r2 = Calc.analyze(shots, poa, { ...ctx, distMm: D100yd, clickValue: 0.25, clickUnit: "MOA" });
near(r2.correction.vAng, Math.atan(30 / D100yd) * 180 / Math.PI * 60, 1e-9, "angolo verticale MOA");
eq(r2.correction.vClicks, 5, "click MOA verticali");

// gruppo in alto a destra → correzione GIÙ / SINISTRA
const r3 = Calc.analyze([{ x: 120, y: 80 }], { x: 100, y: 100 }, ctx);
eq([r3.correction.vDir, r3.correction.hDir], ["GIÙ", "SINISTRA"], "direzioni opposte");

// senza calibrazione: solo pixel
const r4 = Calc.analyze(shots, poa, { ...ctx, pxPerMm: null });
eq(r4.mm, undefined, "nessun mm senza scala"); near(r4.px.es, Math.hypot(200, 200), 1e-9, "ES in px");

// correzione per singolo punto (usata nella tabella punti): 20 mm a destra, 50 mm in basso a 100 m, 0,1 MIL
const c1 = Calc.correction(20, -50, ctx);
eq([c1.vClicks, c1.vDir, c1.hClicks, c1.hDir], [5, "SU", 2, "SINISTRA"], "correzione singolo punto");
eq(Calc.correction(1, 1, { ...ctx, distMm: 0 }), null, "correzione senza distanza");
eq(Calc.correction(1, 1, { ...ctx, clickValue: 0 }), null, "correzione senza valore click");
// coerenza: la correzione del gruppo coincide con quella calcolata sul centroide
const cg = Calc.correction(r.offset.dx, r.offset.dy, ctx);
eq(cg, r.correction, "correzione gruppo = correzione del centroide");

// ---------- v0.8.0: statistiche di dispersione, flyer, direzione ----------
near(Math.exp(Calc.lgamma(5)), 24, 1e-9, "Γ(5) = 24");
near(Math.exp(Calc.lgamma(4.5)), 11.631728396567448, 1e-9, "Γ(4,5)");
near(Calc.sigmaCorrection(5), 0.5 * 11.631728396567448 / 6, 1e-12, "fattore di correzione n=5");
near(Calc.sigmaCorrection(2000), 1, 2e-4, "fattore di correzione → 1 per n grande");
const sq = [{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }];
const d4 = Calc.dispersion(sq);
near(d4.sx, Math.sqrt(400 / 3), 1e-12, "σx campionaria");
near(d4.rsd, Math.sqrt(800 / 3), 1e-12, "SD radiale √(σx²+σy²)");
near(d4.sdRadii, 0, 1e-12, "SD delle distanze (tutte uguali) = 0");
near(d4.sigma, Math.sqrt(400 / 3) / Calc.sigmaCorrection(4), 1e-12, "σ stimato corretto");
near(d4.cep / d4.sigma, 1.1774100225154747, 1e-12, "CEP = 1,1774 σ");
near(d4.r95 / d4.sigma, 2.4477468306808166, 1e-12, "R95 = 2,4477 σ");
near(d4.r99 / d4.sigma, 3.0348542587702925, 1e-12, "R99 = 3,0349 σ");
eq(Calc.dispersion([{ x: 0, y: 0 }]), null, "dispersione con 1 colpo");
const ra = Calc.analyze(shots, poa, ctx);
near(ra.mm.fom, 20, 1e-9, "FOM = (H + V) / 2");
near(ra.mm.cep, Calc.dispersion(shots).cep / 10, 1e-12, "CEP in mm");
// flyer: 5 colpi raccolti + 1 lontano
const grp = [{ x: 0, y: 0 }, { x: 3, y: 1 }, { x: 1, y: 4 }, { x: -2, y: 2 }, { x: 2, y: -2 }, { x: 25, y: 20 }];
const fl = Calc.flyers(grp, 2);
eq(fl.map(f => f.flagged), [false, false, false, false, false, true], "solo il colpo lontano è flyer");
eq(Calc.flyers(grp.slice(0, 4), 2), null, "flyer: servono almeno 5 colpi");
// con la regola «2 SD su tutti i colpi» lo stesso flyer non scatterebbe se i colpi fossero 5: verifica del limite (n−1)/√n
const five = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 100, y: 100 }];
const cc5 = Calc.centroid(five), r5 = five.map(p => Calc.dist(p, cc5)), m5 = r5.reduce((a, b) => a + b) / 5;
ok((r5[4] - m5) / Calc.sampleSD(r5) < 2, "regola 2 SD non leave-one-out: non scatta con 5 colpi");
eq(Calc.flyers(five, 2)[4].flagged, true, "leave-one-out: scatta con 5 colpi");
// direzione bussola
eq(Calc.compass(0, 1).deg, 0, "N = 0°"); eq(Calc.compass(1, 0).label, "E", "E = 90°");
near(Calc.compass(-1, -1).deg, 225, 1e-9, "SO = 225°"); eq(Calc.compass(-1, -1).label, "SO", "sigla SO");
eq(Calc.compass(Math.sin(76 * Math.PI / 180), Math.cos(76 * Math.PI / 180)).label, "ENE", "76° = ENE");
eq(Calc.compass(0, 0), null, "nessuna direzione per distanza nulla");

// ---------- v0.9.0: orologio e asse principale ----------
eq([0, 30, 90, 180, 270, 345, 359, 14].map(Calc.clockHour), [12, 1, 3, 6, 9, 12, 12, 12], "ore dell'orologio");
eq(Calc.clockHour(60), 2, "60° = ore 2");
// gruppo allungato in verticale (Y verso l'alto) → asse 0° (ore 12–6)
const vert = [{ x: 0, y: -10 }, { x: 1, y: -5 }, { x: -1, y: 0 }, { x: 1, y: 5 }, { x: 0, y: 10 }];
const pa = Calc.principalAxis(vert);
ok(pa.bearing < 10 || pa.bearing > 170, "asse verticale ≈ 0°");
ok(pa.ratio > 5, "allungamento marcato");
// allungato lungo la diagonale verso ore 1–2 (45°: alto a destra)
const diag = [-10, -5, 0, 5, 10].map((t, i) => ({ x: t + [0.5, -0.5, 0, 0.5, -0.5][i], y: t }));
near(Calc.principalAxis(diag).bearing, 45, 4, "asse diagonale ≈ 45°");
// orizzontale → 90° (ore 3–9)
near(Calc.principalAxis([-10, -4, 0, 4, 10].map((t, i) => ({ x: t, y: [0.5, -0.5, 0, 0.5, -0.5][i] }))).bearing, 90, 2, "asse orizzontale ≈ 90°");
near(Calc.principalAxis(sq).ratio, 1, 1e-12, "quadrato: rapporto 1");

// ---------- v0.10.0: ellisse di concentrazione e forma ----------
// punti sugli assi: varianza x = 2·100/(4) ... (n−1 = 3)
const cross = [{ x: -10, y: 0 }, { x: 10, y: 0 }, { x: 0, y: -4 }, { x: 0, y: 4 }];
const el = Calc.ellipse(cross, 0.95);
near(el.k, 2.4477468306808166, 1e-12, "k χ²₂ 95%");
near(el.a, el.k * Math.sqrt(200 / 3), 1e-9, "semiasse maggiore = k·√λ1");
near(el.b, el.k * Math.sqrt(32 / 3), 1e-9, "semiasse minore = k·√λ2");
near(el.bearing, 90, 1e-9, "asse orizzontale = 90° dalla verticale");
near(el.ratio, Math.sqrt(200 / 32), 1e-9, "rapporto d'aspetto = a/b");
near(Calc.ellipse(cross, 0.5).k, Math.sqrt(2 * Math.LN2), 1e-12, "k 50% = fattore CEP");
eq(Calc.ellipse(cross.slice(0, 2)), null, "ellisse: servono 3 fori");
eq([0, 10, 30, 60, 90, 120, 160].map(Calc.axisWords).map(w => w.split(" ")[0]),
  ["verticale", "verticale", "diagonale", "diagonale", "orizzontale", "diagonale", "verticale"], "descrizione dell'asse");
// analyze (coordinate immagine, Y verso il basso): gruppo allungato verso alto-destra deve dare ~45°
const imgDiag = [-10, -5, 0, 5, 10].map((t, i) => ({ x: 500 + t * 10 + [5, -5, 0, 5, -5][i], y: 500 - t * 10 }));
const rd = Calc.analyze(imgDiag, null, { ...ctx, ellipseP: 0.95 });
near(rd.shape.bearing, 45, 4, "analyze: asse ↗ in coordinate immagine ≈ 45°");
near(rd.mm.ellA, rd.px.ellA / 10, 1e-12, "semiasse in mm");

console.log(`OK — ${passed} verifiche superate`);
