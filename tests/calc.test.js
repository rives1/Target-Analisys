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

console.log(`OK — ${passed} verifiche superate`);
