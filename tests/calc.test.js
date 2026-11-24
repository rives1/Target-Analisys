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

// ---------- v0.12.0: distribuzioni e intervalli di confidenza ----------
// quantili di riferimento (tavole statistiche)
near(Calc.chi2inv(0.025, 8), 2.1797307, 1e-6, "χ²(8) 2,5%");
near(Calc.chi2inv(0.975, 8), 17.5345461, 1e-6, "χ²(8) 97,5%");
near(Calc.chi2inv(0.95, 2), 5.9914645, 1e-6, "χ²(2) 95% = −2 ln 0,05");
near(Calc.tinv(0.975, 4), 2.7764451, 1e-6, "t(4) 97,5%");
near(Calc.tinv(0.975, 9), 2.2621572, 1e-6, "t(9) 97,5%");
near(Calc.tinv(0.975, 1), 12.7062047, 1e-5, "t(1) 97,5%");
near(Calc.tinv(0.025, 4), -2.7764451, 1e-6, "t simmetrica");
// IC su dati noti: quadrato ±10 (n = 4, ν = 6)
const ci4 = Calc.confidence(sq, 0.95), s2 = 400 / 3;
near(ci4.sigma.lo, Math.sqrt(6 * s2 / Calc.chi2inv(0.975, 6)), 1e-9, "IC σ inferiore");
near(ci4.sigma.hi, Math.sqrt(6 * s2 / Calc.chi2inv(0.025, 6)), 1e-9, "IC σ superiore");
near(ci4.cep.hi / ci4.sigma.hi, 1.1774100225154747, 1e-12, "IC CEP = K·IC σ");
near(ci4.center.hx, Calc.tinv(0.975, 3) * Math.sqrt(s2) / 2, 1e-9, "IC centro: t·s/√n");
// copertura simulata (Monte Carlo, generatore con seme): l'IC 95% di σ deve contenere il σ vero ~95% delle volte
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
let hitS = 0, hitC = 0; const TR = 4000;
for (let i = 0; i < TR; i++) {
  const pts = Array.from({ length: 5 }, () => ({ x: gauss() * 3, y: gauss() * 3 }));
  const c = Calc.confidence(pts, 0.95), m = Calc.centroid(pts);
  if (c.sigma.lo <= 3 && 3 <= c.sigma.hi) hitS++;
  if (Math.abs(m.x) <= c.center.hx) hitC++;
}
ok(Math.abs(hitS / TR - 0.95) < 0.015, `copertura IC σ ≈ 95% (simulata ${(hitS / TR * 100).toFixed(1)}%)`);
ok(Math.abs(hitC / TR - 0.95) < 0.015, `copertura IC centro ≈ 95% (simulata ${(hitC / TR * 100).toFixed(1)}%)`);
// intervallo dei click: gruppo 50 mm in basso ± 10 mm a 100 m, click 0,1 MIL → 4–6 SU
const cci = Calc.correctionCI(0, -50, 3, 10, ctx);
eq([cci.v.lo, cci.v.hi], [4, 6], "IC click verticali");
eq([cci.h.lo, cci.h.hi], [0, 0], "IC click orizzontali (±3 mm = 0)");
const cross0 = Calc.correctionCI(5, 0, 20, 0, ctx);
ok(cross0.h.lo < 0 && cross0.h.hi > 0, "IC che comprende lo zero");

// --- correzione prospettica (omografia da 4 punti)
// «fotocamera» sintetica: omografia nota dal piano del bersaglio (mm) ai pixel della foto, con forte prospettiva
const Htrue = [9.2, 1.1, 610, -0.6, 7.4, 420, 0.00055, 0.00031, 1];
const rectMm = [{ x: 0, y: 0 }, { x: 297, y: 0 }, { x: 297, y: 210 }, { x: 0, y: 210 }];
const srcPx = rectMm.map(p => Calc.applyH(Htrue, p));
const Hs = Calc.homography(rectMm, srcPx);
ok(Hs && Hs.every((v, i) => Math.abs(v - Htrue[i]) <= 1e-9 * Math.max(1, Math.abs(Htrue[i]))), "omografia ricostruita da 4 punti");
const Hinv = Calc.invertH(Htrue), pt = { x: 123.4, y: 56.7 }, back = Calc.applyH(Hinv, Calc.applyH(Htrue, pt));
near(Math.hypot(back.x - pt.x, back.y - pt.y), 0, 1e-9, "inversa dell'omografia");
// ordine degli angoli: cliccati in ordine sparso → [alto-sx, alto-dx, basso-dx, basso-sx]
const shuffled = [srcPx[2], srcPx[0], srcPx[3], srcPx[1]];
eq(Calc.orderQuad(shuffled), srcPx, "ordine degli angoli");
eq(Calc.orderQuad([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 100 }]), null, "quadrilatero concavo rifiutato");
eq(Calc.orderQuad([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 1 }, { x: 300, y: 0 }]), null, "punti quasi allineati rifiutati");
// rettifica: i fori misurati sulla foto rettificata tornano alle coordinate reali in mm
const R = Calc.rectify(srcPx, 297, 210, 6000, 4000);
ok(R && R.k > 0 && R.W > 0 && R.Hpx > 0, "rettifica calcolata");
const toMmR = p => { const q = Calc.applyH(R.H, Calc.applyH(Htrue, p)); return { x: (q.x - R.ox) / R.k, y: (q.y - R.oy) / R.k }; };
for (const h of [{ x: 100, y: 50 }, { x: 250.5, y: 190.2 }, { x: 10, y: 205 }]) {
  const m = toMmR(h);
  near(Math.hypot(m.x - h.x, m.y - h.y), 0, 1e-6, `foro (${h.x}; ${h.y}) mm dopo la rettifica`);
}
const hA = toMmR({ x: 140, y: 100 }), hB = toMmR({ x: 152, y: 109 });
near(Math.hypot(hB.x - hA.x, hB.y - hA.y), 15, 1e-6, "distanza tra due fori conservata (15 mm)");
near(R.k, Math.sqrt(Math.abs(Calc.polyArea(srcPx)) / (297 * 210)), 1e-9, "risoluzione = risoluzione media nel rettangolo");
// caso senza prospettiva: rettangolo ripreso di fronte a 5 px/mm → k = 5 e solo traslazione
const flat = rectMm.map(p => ({ x: 200 + p.x * 5, y: 100 + p.y * 5 }));
const Rf = Calc.rectify(flat, 297, 210, 2000, 1400);
near(Rf.k, 5, 1e-9, "foto frontale: k invariato");
const fq = Calc.applyH(Rf.H, { x: 700, y: 600 });
near(Math.hypot(fq.x - (700 - 200 + Rf.ox), fq.y - (600 - 100 + Rf.oy)), 0, 1e-6, "foto frontale: solo traslazione");
ok(Math.abs(Rf.ox - 200) < 1e-6 && Math.abs(Rf.oy - 100) < 1e-6 && Rf.W === 2000 && Rf.Hpx === 1400, "foto frontale: stessa estensione della foto");
// limite di pixel: la risoluzione si riduce per stare sotto maxPx
const Rs = Calc.rectify(srcPx, 297, 210, 6000, 4000, { maxPx: 1e6 });
ok(Rs.reduced && Rs.W * Rs.Hpx <= 1.01e6 + Rs.W + Rs.Hpx, "limite di pixel rispettato");
// angoli della foto oltre l'orizzonte: estensione limitata al margine, rettifica comunque valida
const Rh = Calc.rectify(srcPx, 297, 210, 60000, 40000);
ok(Rh && Rh.W <= Math.ceil(3 * 297 * Rh.k) + 1 && Rh.Hpx <= Math.ceil(3 * 210 * Rh.k) + 1, "estensione limitata se la foto supera l'orizzonte");
eq(Calc.rectify(srcPx, 0, 210, 6000, 4000), null, "dimensioni non valide");

// --- probabilità di colpire un bersaglio
near(Calc.normcdf(1.959964), 0.975, 2e-7, "Φ(1,96) = 0,975");
near(Calc.normcdf(0), 0.5, 1e-9, "Φ(0) = 0,5");
near(Calc.normcdf(-1), 0.158655254, 2e-7, "Φ(−1)");
// cerchio centrato: distribuzione di Rayleigh, P = 1 − e^(−R²/2σ²); al raggio CEP la probabilità è 50%
near(Calc.hitCircle(0, 2, 1), 1 - Math.exp(-2), 1e-12, "cerchio centrato (Rayleigh)");
near(Calc.hitCircle(0, Math.sqrt(2 * Math.LN2), 1), 0.5, 1e-12, "raggio CEP = 50%");
// cerchio spostato: confronto con integrazione numerica 2D (griglia fine, regola del punto medio)
const integ = (d, R, sg) => { const N = 1200, h = 2 * R / N; let acc = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const x = -R + (i + 0.5) * h, y = -R + (j + 0.5) * h;
    if (x * x + y * y <= R * R) acc += Math.exp(-((x - d) ** 2 + y * y) / (2 * sg * sg)); }
  return acc * h * h / (2 * Math.PI * sg * sg); };
for (const [d, R, sg] of [[1, 1, 1], [2.5, 1.5, 1], [0.7, 3, 1.3], [6, 2, 1]])
  near(Calc.hitCircle(d, R, sg), integ(d, R, sg), 2e-4, `cerchio spostato d=${d} R=${R} σ=${sg}`);
near(Calc.hitCircle(1, 1, 1), 0.2671202, 2e-6, "1 − Q₁(1,1) di Marcum (Q₁(1,1) = 0,7328798)");
near(Calc.hitCircle(60, 2, 1), 0, 1e-12, "bersaglio lontanissimo dal gruppo");
// rettangolo: prodotto per asse
near(Calc.hitRect(0, 0, 2, 4, 1), (2 * Calc.normcdf(1) - 1) * (2 * Calc.normcdf(2) - 1), 1e-12, "rettangolo centrato");
near(Calc.hitRect(1, 0, 2, 2, 1), (Calc.normcdf(0) - Calc.normcdf(-2)) * (2 * Calc.normcdf(1) - 1), 1e-12, "rettangolo spostato");
// distanza: a distanza doppia con bersaglio doppio la probabilità non cambia (dispersione angolare costante)
const hp = o => Calc.hitProbability({ n: 5, s2: 4, sigma: 2.1, dx: 1, dy: -0.5, shape: "circle", R: 3, level: 0.95, sims: 2000, ...o });
const h1 = hp({}), h2 = hp({ s2: 16, sigma: 4.2, dx: 2, dy: -1, R: 6 });
near(h2.p, h1.p, 1e-12, "scala con la distanza: stima"); near(h2.lo, h1.lo, 1e-12, "scala con la distanza: IC");
eq(hp({}), hp({}), "simulazione riproducibile (seme fisso)");
ok(h1.lo <= h1.p && h1.p <= h1.hi && h1.lo < h1.hi, "stima dentro l'intervallo");
eq(Calc.hitProbability({ n: 1, s2: 0, sigma: 0, dx: 0, dy: 0, shape: "circle", R: 1 }), null, "servono almeno 2 colpi");
// copertura simulata nel caso «con correzione applicata»: lo scostamento vero dopo la correzione è μ − x̄
{
  const gg = Calc.rng(99); let hit = 0; const TT = 400;
  for (let t = 0; t < TT; t++) {
    const pts = Array.from({ length: 5 }, () => ({ x: gg.gauss() * 2, y: gg.gauss() * 2 }));
    const d = Calc.dispersion(pts), c = Calc.centroid(pts);
    const r = Calc.hitProbability({ n: 5, s2: (d.sx ** 2 + d.sy ** 2) / 2, sigma: d.sigma, dx: 0, dy: 0, shape: "circle", R: 3, level: 0.95, sims: 800, seed: t + 1 });
    const truth = Calc.hitCircle(Math.hypot(c.x, c.y), 3, 2);
    if (truth >= r.lo && truth <= r.hi) hit++;
  }
  ok(Math.abs(hit / TT - 0.95) < 0.035, `copertura IC probabilità ≈ 95% (simulata ${(hit / TT * 100).toFixed(1)}%)`);
}

// --- zone di punteggio ISSF (diametri dal regolamento tecnico) e valore del colpo (bordo del foro)
const T = Calc.SCORE_TARGETS;
eq(Calc.ringDiameters(T.issf10ar).map(v => +v.toFixed(1)), [0.5, 5.5, 10.5, 15.5, 20.5, 25.5, 30.5, 35.5, 40.5, 45.5], "anelli carabina ad aria 10 m");
eq(Calc.ringDiameters(T.issf10ap).map(v => +v.toFixed(1)), [11.5, 27.5, 43.5, 59.5, 75.5, 91.5, 107.5, 123.5, 139.5, 155.5], "anelli pistola ad aria 10 m");
eq(Calc.ringDiameters(T.issf50r).map(v => +v.toFixed(1)), [10.4, 26.4, 42.4, 58.4, 74.4, 90.4, 106.4, 122.4, 138.4, 154.4], "anelli carabina 50 m");
eq(Calc.ringDiameters(T.issf25p), [50, 100, 150, 200, 250, 300, 350, 400, 450, 500], "anelli pistola 25/50 m");
eq(Calc.ringDiameters(T.issf300r), [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], "anelli carabina 300 m");
// carabina ad aria, piombino 4,5 mm: 10 se il bordo tocca il punto (d ≤ 2,25 + 0,25 = 2,5 mm), 10 interno se lo asporta (d ≤ 2,0 mm)
eq(Calc.shotScore(2.5, 4.5, T.issf10ar).value, 10, "10 al limite del punto");
eq(Calc.shotScore(2.51, 4.5, T.issf10ar).value, 9, "9 appena fuori dal punto");
ok(Calc.shotScore(2.0, 4.5, T.issf10ar).inner && !Calc.shotScore(2.01, 4.5, T.issf10ar).inner, "10 interno: punto asportato del tutto");
eq(Calc.shotScore(25.0, 4.5, T.issf10ar).value, 1, "1 (bordo a 22,75 mm ≤ 22,75)");
eq(Calc.shotScore(25.01, 4.5, T.issf10ar).value, 0, "fuori bersaglio");
// pistola 25 m, .22 LR (5,66 mm): il 9 arriva a 50 mm di raggio, cioè centro del foro a 52,83 mm
eq(Calc.shotScore(52.83, 5.66, T.issf25p).value, 9, "linea del 9 toccata");
eq(Calc.shotScore(52.84, 5.66, T.issf25p).value, 8, "linea del 9 non toccata");
ok(Calc.shotScore(15.33, 5.66, T.issf25p).inner, "10 interno pistola (bordo a 12,5 mm)");
near(Calc.shotScore(52.0, 5.66, T.issf25p).margin, 0.83, 1e-9, "distanza dalla linea più vicina");
eq(Calc.shotScore(0, 7.82, { d10: 20, step: 10 }).inner, false, "bersaglio personalizzato senza 10 interno");

// --- 1.7.0: dope card (click impostati + correzione), σ combinata per carica, snap al centro del foro
{
  near(Calc.toRad(Calc.fromRad(0.0123, "MOA"), "MOA"), 0.0123, 1e-15, "toRad inverso di fromRad (MOA)");
  near(Calc.toRad(Calc.fromRad(0.0123, "IPHY"), "IPHY"), 0.0123, 1e-15, "toRad inverso di fromRad (IPHY)");
  // 100 m, 10 px/mm, click 0,1 MIL: torretta a +20 click (2 MIL); fori 10 mm SOTTO la mira (0,1 MIL) → servono 21 click
  const ctx = { pxPerMm: 10, distMm: 100000, clickValue: 0.1, clickUnit: "MIL", ciLevel: 0.95 };
  const poa = { x: 0, y: 0 };
  const S = [{ x: -50, y: 100, dv: 20, dh: 0 }, { x: 50, y: 100, dv: 20, dh: 0 }, { x: 0, y: 80, dv: 20, dh: 0 }, { x: 0, y: 120, dv: 20, dh: 0 }];
  const d = Calc.dope(S, poa, ctx);
  near(d.v.mil, 2 + Math.atan(10 / 100000) * 1000, 1e-9, "dope alzo = impostato + scostamento (esatto)");
  near(Calc.milToClicks(d.v.mil, 0.1, "MIL"), 21, 1e-3, "dope alzo in click");
  near(d.h.mil, 0, 1e-12, "dope brandeggio: gruppo centrato");
  eq(d.dialVaries, false, "click uguali per tutti i fori");
  // intervallo: t(0,975; 3)·sd/√4 con sd delle altezze (2 mm → 0,02 MIL a 100 m, quasi esatto)
  const sdV = Calc.sampleSD(S.map(q => Math.atan((poa.y - q.y) / 10 / 100000) * 1000));
  near(d.v.ci, Calc.tinv(0.975, 3) * sdV / 2, 1e-12, "IC della dope (t di Student)");
  // torretta cambiata a metà gruppo: i fori si spostano ma la dope resta la stessa (ogni foro corretto col suo click)
  const S2 = [{ x: 0, y: 100, dv: 20 }, { x: 0, y: 0, dv: 21 }];   // con 21 click il secondo è sulla mira
  const d2 = Calc.dope(S2, poa, ctx);
  near(d2.v.mil, 2.1, 1e-6, "dope con click diversi tra i fori");
  near(d2.v.sd, 0, 1e-6, "nessuna dispersione dopo la compensazione dei click");
  eq(d2.dialVaries, true, "segnala click diversi tra i fori");
  // brandeggio: foro 20 mm a DESTRA con torretta a 0 → servono −2 click (a sinistra)
  near(Calc.milToClicks(Calc.dope([{ x: 200, y: 0 }], poa, ctx).h.mil, 0.1, "MIL"), -2, 1e-3, "dope brandeggio negativo = a sinistra");
  eq(Calc.dope([{ x: 200, y: 0 }], poa, ctx).v.ci, null, "un solo foro: nessun intervallo");
  eq(Calc.dope(S, null, ctx), null, "senza mira niente dope");
  // MOA: 1 click 1/4 MOA, 4 click = 1 MOA
  near(Calc.milToClicks(Calc.toRad(1, "MOA") * 1000, 0.25, "MOA"), 4, 1e-9, "MIL → click MOA");

  // σ combinata: un solo gruppo = stessa stima e stesso intervallo del gruppo
  const G = [{ x: 0, y: 0 }, { x: 3, y: 1 }, { x: -1, y: 2 }, { x: 1, y: -3 }, { x: 2, y: 2 }];
  const dg = Calc.dispersion(G), cg = Calc.confidence(G, 0.95), s2 = (dg.sx ** 2 + dg.sy ** 2) / 2;
  const P1 = Calc.pooledSigma([{ s2, nu: 8 }], 0.95);
  near(P1.sigma, dg.sigma, 1e-12, "pooled con 1 gruppo = σ del gruppo");
  near(P1.cepLo, cg.cep.lo, 1e-12, "pooled: IC CEP basso come il gruppo"); near(P1.cepHi, cg.cep.hi, 1e-12, "pooled: IC CEP alto come il gruppo");
  // due gruppi uguali: stessa s², ν doppio → intervallo più stretto
  const P2 = Calc.pooledSigma([{ s2, nu: 8 }, { s2, nu: 8 }], 0.95);
  near(P2.s2, s2, 1e-12, "pooled: media pesata delle varianze");
  ok(P2.cepHi - P2.cepLo < P1.cepHi - P1.cepLo, "più gruppi → intervallo più stretto");
  near(Calc.pooledSigma([{ s2: 1, nu: 2 }, { s2: 4, nu: 6 }]).s2, (2 + 24) / 8, 1e-12, "pooled: pesi = gradi di libertà");
  eq(Calc.pooledSigma([]), null, "pooled senza dati");

  // snap: disco scuro di raggio 10 px centrato in (40,3; 37,8) su fondo chiaro, finestra 80×80
  const W = 80, H = 80, mk = (cx, cy, r, fg, bgv) => { const L = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {   // copertura del pixel per sotto-campionamento 4×4
      let c = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) c += Math.hypot(x + (a + 0.5) / 4 - cx, y + (b + 0.5) / 4 - cy) <= r ? 1 : 0;
      L[y * W + x] = bgv + (fg - bgv) * c / 16; }
    return L; };
  const exp = Math.PI * 100;
  const sn = Calc.snapHole(mk(40.3, 37.8, 10, 30, 220), W, H, 45, 33, { rSearch: 9, expArea: exp });
  ok(sn && Math.abs(sn.x - 40.3) < 0.3 && Math.abs(sn.y - 37.8) < 0.3, `snap al centro del disco (${sn && sn.x.toFixed(2)}, ${sn && sn.y.toFixed(2)})`);
  eq(sn.dark, true, "foro scuro su fondo chiaro");
  const sl = Calc.snapHole(mk(40, 40, 10, 240, 25), W, H, 36, 44, { rSearch: 9, expArea: exp });
  ok(sl && !sl.dark && Math.abs(sl.x - 40) < 0.3 && Math.abs(sl.y - 40) < 0.3, "foro chiaro su visuel nero");
  eq(Calc.snapHole(mk(40, 40, 10, 200, 210), W, H, 40, 40, { rSearch: 9, expArea: exp }), null, "contrasto troppo basso: nessuno snap");
  eq(Calc.snapHole(mk(40, 40, 22, 30, 220), W, H, 40, 40, { rSearch: 9, expArea: exp }), null, "macchia troppo grande (es. due fori o visuel): nessuno snap");
  eq(Calc.snapHole(mk(40, 40, 3, 30, 220), W, H, 40, 40, { rSearch: 9, expArea: exp }), null, "macchia troppo piccola: nessuno snap");
  eq(Calc.snapHole(mk(20, 20, 10, 30, 220), W, H, 60, 60, { rSearch: 9, expArea: exp }), null, "nessun foro entro il raggio di ricerca");
  // linea scura che attraversa la finestra (riga della griglia): tocca il bordo → rifiutata
  const Ln = new Float32Array(W * H).fill(220); for (let y = 0; y < H; y++) for (let x = 38; x < 42; x++) Ln[y * W + x] = 30;
  eq(Calc.snapHole(Ln, W, H, 40, 40, { rSearch: 9, expArea: exp }), null, "linea della griglia: nessuno snap");
}

// --- 1.8.0: convex hull
{
  const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 5 }, { x: 5, y: 0 }, { x: 3, y: 7 }];
  const h = Calc.convexHull(sq);
  eq(h.length, 4, "hull del quadrato: 4 vertici (interni e allineati esclusi)");
  const ap = Calc.polygonAreaPerim(h);
  near(ap.area, 100, 1e-12, "area del quadrato"); near(ap.perim, 40, 1e-12, "perimetro del quadrato");
  eq(Calc.convexHull([{ x: 0, y: 0 }, { x: 1, y: 1 }]).length, 2, "meno di 3 punti: restituiti tali e quali");
  eq(Calc.convexHull([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }]).length, 2, "punti coincidenti e allineati: nessun poligono");
  // triangolo 3-4-5 in px, scala 2 px/mm → area 6/4 mm², perimetro 12/2 mm
  const r = Calc.analyze([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }], null, { pxPerMm: 2, distMm: 100000 });
  near(r.mm.hullArea, 1.5, 1e-12, "area del hull in mm² (scala al quadrato)"); near(r.mm.hullPerim, 6, 1e-12, "perimetro del hull in mm");
  eq(Calc.analyze([{ x: 0, y: 0 }, { x: 4, y: 0 }], null, { pxPerMm: 2 }).hull, undefined, "con 2 fori nessun hull");
}

// --- 1.9.0: densità normale bivariata, bersaglio di prova, abbinamento dei punti
{
  const P = [{ x: 0, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 3 }, { x: 3, y: 4 }, { x: 2, y: 2 }];
  const C = Calc.covariance(P);
  near(C.cx, 2, 1e-12, "covarianza: centro x"); near(C.sxx, 2.5, 1e-12, "varianza x (n−1)"); near(C.sxy, 0.75, 1e-12, "covarianza xy");
  const f = Calc.bvnDensity(C);
  // integrale numerico della densità ≈ 1 (griglia fine su ±8σ)
  let I = 0; const h = 0.05; for (let x = -12; x <= 16; x += h) for (let y = -12; y <= 16; y += h) I += f(x, y) * h * h;
  near(I, 1, 1e-3, "la densità integra a 1");
  near(f(C.cx, C.cy), f.peak, 1e-15, "massimo al centro");
  near(f(C.cx, C.cy), 1 / (2 * Math.PI * Math.sqrt(C.sxx * C.syy - C.sxy ** 2)), 1e-15, "valore al centro = 1/(2π√|Σ|)");
  eq(Calc.bvnDensity(Calc.covariance([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])), null, "fori allineati: covarianza singolare");
  eq(Calc.covariance(P.slice(0, 2)), null, "meno di 3 fori");
  // bersaglio di prova: deterministico, fori separati e nel riquadro
  const T1 = Calc.testTarget(4321), T2 = Calc.testTarget(4321), T3 = Calc.testTarget(4322);
  eq(JSON.stringify(T1.pts), JSON.stringify(T2.pts), "stesso codice, stessi fori");
  ok(JSON.stringify(T1.pts) !== JSON.stringify(T3.pts), "codice diverso, fori diversi");
  eq(T1.pts.length, 5, "5 fori");
  ok(T1.pts.every((p, i) => T1.pts.every((q, j) => i === j || Calc.dist(p, q) >= 15)), "fori separati di almeno 15 mm");
  let fails = 0;
  for (let c = 1000; c <= 9999; c += 7) for (const n of [5, 10]) { const T = Calc.testTarget(c, n); if (T.pts.length !== n || T.pts.some(p => Math.hypot(p.x, p.y) > 70 || Math.hypot(p.x, p.y) < 12)) fails++; }
  eq(fails, 0, "tutti i codici producono 5 e 10 fori validi");
  ok(T1.pts.every(p => Math.hypot(p.x, p.y) <= 70), "fori entro 70 mm dalla mira");
  // abbinamento: permutazione nota con piccolo rumore
  const B = [T1.pts[3], T1.pts[0], T1.pts[4], T1.pts[1], T1.pts[2]].map(p => ({ x: p.x + 0.3, y: p.y - 0.2 }));
  eq(JSON.stringify(Calc.matchPoints(T1.pts, B)), JSON.stringify([1, 3, 4, 0, 2]), "abbinamento ottimo");
  eq(Calc.matchPoints([{ x: 0, y: 0 }], []), null, "insiemi di dimensione diversa");
  // verifica del bersaglio: misura esatta, poi scala +2% e rotazione di 3° attorno al centro gruppo
  const V0 = Calc.verifyTarget(T1.pts, B.map(p => ({ x: p.x - 0.3, y: p.y + 0.2 })));
  near(V0.rms, 0, 1e-9, "misura esatta: RMS 0"); near(V0.scale, 1, 1e-12, "misura esatta: scala 1"); near(V0.rotDeg, 0, 1e-9, "misura esatta: rotazione 0");
  const cT = Calc.centroid(T1.pts), th = 3 * Math.PI / 180;
  const M2 = T1.pts.map(p => { const x = (p.x - cT.x) * 1.02, y = (p.y - cT.y) * 1.02; return { x: cT.x + x * Math.cos(th) - y * Math.sin(th), y: cT.y + x * Math.sin(th) + y * Math.cos(th) }; });
  const V2 = Calc.verifyTarget(T1.pts, M2.slice().reverse());
  near(V2.scale, 1.02, 1e-9, "scala +2% riconosciuta"); near(V2.rotDeg, 3, 1e-9, "rotazione di 3° riconosciuta (antioraria)");
  near(V2.shift.x, 0, 1e-9, "centro gruppo invariato"); near(V2.es.m / V2.es.t, 1.02, 1e-9, "ES scala con la foto");
  const V3 = Calc.verifyTarget([{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 1, y: 0 }, { x: 11, y: 0 }]);
  near(V3.rms, 1, 1e-12, "traslazione di 1 mm: RMS 1"); near(V3.shift.x, 1, 1e-12, "spostamento della mira"); near(V3.scale, 1, 1e-12, "la traslazione non cambia la scala");
  // holdover: FFP = nominale; SFP a metà ingrandimento = metà lettura; segni delle tacche opposti
  const H1 = Calc.holdover(2, -0.5, { unit: "MIL", plane: "FFP" });
  near(H1.v, 2, 1e-12, "FFP: 2 MIL"); near(H1.markY, -2, 1e-12, "serve alzo: tacca sotto"); near(H1.markX, 0.5, 1e-12, "serve sinistra: tacca a destra");
  const H2 = Calc.holdover(2, 0, { unit: "MIL", plane: "SFP", calibMag: 10, mag: 5 });
  near(H2.v, 1, 1e-12, "SFP a 5× tarato a 10×: lettura 1 MIL"); near(H2.factor, 0.5, 1e-12, "fattore SFP");
  near(Calc.holdover(1, 0, { unit: "MOA" }).v, 3.43774677, 1e-6, "1 MIL = 3,4377 MOA");
}

// ---------------- 1.10.0: sagome, decimale, regressione, distorsione ----------------
{
  // punteggio decimale ISSF (50 m carabina: 10 ⌀ 10,4, passo 16 sul diametro, foro 5,6 mm)
  const t50 = Calc.SCORE_TARGETS.issf50r;
  near(Calc.decimalScore(4.8, 5.6, t50), 10.4, 1e-9, "50 m: 10,4 entro 4,8 mm"); near(Calc.decimalScore(4.81, 5.6, t50), 10.3, 1e-9, "oltre 4,8 mm: 10,3");
  near(Calc.decimalScore(5.6, 5.6, t50), 10.3, 1e-9, "10,3 entro 5,6 mm"); near(Calc.decimalScore(0, 5.6, t50), 10.9, 1e-9, "centro: 10,9");
  near(Calc.decimalScore(8.0, 5.6, t50), 10.0, 1e-9, "bordo del 10: 10,0"); near(Calc.decimalScore(8.01, 5.6, t50), 9.9, 1e-9, "appena fuori: 9,9");
  eq(Calc.decimalScore(500, 5.6, t50), 0, "fuori bersaglio: 0");
  for (let d = 0; d < 90; d += 0.37) eq(Math.floor(Calc.decimalScore(d, 5.6, t50)), Calc.shotScore(d, 5.6, t50).value, `parte intera = punteggio intero (d ${d.toFixed(2)})`);
  const tAR = Calc.SCORE_TARGETS.issf10ar;
  near(Calc.decimalScore(0.25, 4.5, tAR), 10.9, 1e-9, "aria 10 m: 10,9 entro 0,25 mm"); near(Calc.decimalScore(0.26, 4.5, tAR), 10.8, 1e-9, "aria 10 m: 10,8");
  // IPSC: zone e regola del bordo
  const I = Calc.ipscShape();
  near(I.bbox.x1 - I.bbox.x0, 450, 1e-9, "IPSC largo 45 cm"); near(I.bbox.y1 - I.bbox.y0, 570, 1e-9, "IPSC alto 57 cm");
  eq(Calc.shapeZone(I, { x: 0, y: 0 }), 0, "centro della zona A"); eq(Calc.shapeZone(I, { x: 0, y: -200 }), 1, "sotto la A: C");
  eq(Calc.shapeZone(I, { x: 0, y: -300 }), 2, "in basso: D"); eq(Calc.shapeZone(I, { x: 0, y: -400 }), -1, "sotto la sagoma: mancato");
  eq(Calc.shapeZone(I, { x: 78, y: 0 }), 1, "3 mm fuori dalla A: C"); eq(Calc.shapeZone(I, { x: 78, y: 0 }, 4.5), 0, "foro da 9 mm che tocca la linea: A");
  near(Calc.ipscShape(true).bbox.x1 - Calc.ipscShape(true).bbox.x0, 300, 1e-9, "Mini largo 30 cm");
  // IDPA: cerchi −0 quotati
  const P = Calc.idpaShape();
  eq(P.zones[Calc.shapeZone(P, { x: 0, y: 0 })].label, "−0", "centro del corpo: −0");
  eq(P.zones[Calc.shapeZone(P, { x: 0, y: 106 })].label, "−1", "appena fuori dal cerchio da 8\": −1");
  eq(P.zones[Calc.shapeZone(P, { x: 0, y: 12 * 25.4 })].label, "−0", "centro della testa: −0");
  eq(P.zones[Calc.shapeZone(P, { x: 8 * 25.4, y: -10 * 25.4 })].label, "−3", "bordo del corpo: −3");
  // silhouette: ingombro IHMSA in scala
  for (const [a, h, w] of [["chicken", 11.10, 13.25], ["pig", 14.25, 22.25], ["turkey", 23, 19], ["ram", 26.7, 32.25]]) for (const sc of [1, 0.5, 0.2]) {
    const S = Calc.silShape(a, sc); near(S.bbox.x1 - S.bbox.x0, w * 25.4 * sc, 1e-6, `${a} ${sc}: larghezza`); near(S.bbox.y1 - S.bbox.y0, h * 25.4 * sc, 1e-6, `${a} ${sc}: altezza`);
    eq(Calc.shapeZone(S, { x: 0, y: 0 }), 0, `${a}: baricentro sulla piastra`); }
  // integrazione sul raster: cerchio (zona vitale) contro la formula di Rice; ellisse contro Monte Carlo
  const Vt = Calc.vitalShape(200, 200), RV = Calc.shapeRaster(Vt, 1, 0);
  near(Calc.rasterProbs(RV, 0, 0, 50)[0], Calc.hitCircle(0, 100, 50), 2e-3, "cerchio centrato"); near(Calc.rasterProbs(RV, 60, -20, 40)[0], Calc.hitCircle(Math.hypot(60, 20), 100, 40), 2e-3, "cerchio decentrato");
  near(Calc.rasterProbs(Calc.shapeRaster(Calc.vitalShape(300, 300), 0.5, 0), 0, 0, 50)[0], Calc.hitCircle(0, 75, 50), 2e-3, "sagoma riportata a un'altra distanza (×0,5)");
  near(Calc.rasterProbs(RV, 0, 0, 1e-6)[0], 1, 1e-9, "σ ≈ 0 al centro"); near(Calc.rasterProbs(RV, 500, 0, 1)[0], 0, 1e-12, "lontanissimo: 0");
  const RI = Calc.shapeRaster(I, 1, 0), PI = Calc.rasterProbs(RI, 0, 0, 80), sum = PI.reduce((a, b) => a + b, 0);
  ok(PI[0] > PI[1] && sum < 1 && sum > 0.95, "IPSC: A più probabile, totale < 1");
  near(Calc.rasterProbs(Calc.shapeRaster(I, 1, 0), 0, 0, 1e4).reduce((a, b) => a + b, 0), (45 * 57 - 4 * 15 * 19 / 2) * 100 / (2 * Math.PI * 1e8), 2e-7, "σ enorme: densità × area della sagoma (1995 cm²)");
  const HP = Calc.hitShapeProbability({ n: 10, s2: 2500, sigma: 50, R: RV, dx: 0, dy: 0 });
  ok(HP.any.lo <= HP.any.p && HP.any.p <= HP.any.hi && HP.any.hi - HP.any.lo > 0.05, "IC della probabilità sulla sagoma");
  // regressione lineare: valori noti
  const R1 = Calc.linReg([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
  near(R1.b, 1.99, 1e-9, "pendenza"); near(R1.a, 0.05, 1e-9, "intercetta"); near(R1.r2, 0.998, 1e-3, "R²");
  near(R1.se, Math.sqrt(0.107 / 3 / 10), 1e-6, "errore standard della pendenza (SSE 0,107, 3 g.d.l.)");
  ok(R1.lo > 0 && R1.p < 0.001, "pendenza significativa");
  const R0 = Calc.linReg([1, 2, 3, 4], [1, 3, 1, 3]); ok(R0.lo < 0 && R0.hi > 0, "nessuna relazione: IC comprende 0");
  eq(Calc.linReg([1, 1, 1], [1, 2, 3]), null, "x tutti uguali"); eq(Calc.linReg([1, 2], [1, 2]), null, "meno di 3 punti");
  near(Calc.crossWind(3.6, "km/h", 3), 1, 1e-12, "3,6 km/h da ore 3 = 1 m/s da destra"); near(Calc.crossWind(5, "m/s", 9), -5, 1e-12, "da ore 9: da sinistra");
  near(Calc.crossWind(5, "m/s", 12), 0, 1e-12, "da ore 12: nessuna componente trasversale"); near(Calc.crossWind(10, "mph", 3), 4.4704, 1e-9, "mph");
  // distorsione: andata e ritorno, stima da linee
  const L = { k1: -0.12, k2: 0.03, cx: 2000, cy: 1500, rn: 2500 };
  for (const q of [{ x: 0, y: 0 }, { x: 3999, y: 2999 }, { x: 2100, y: 1400 }]) { const r = Calc.undistortPoint(Calc.distortPoint(q, L), L); near(Math.hypot(r.x - q.x, r.y - q.y), 0, 1e-6, "andata e ritorno"); }
  const d0 = Calc.distortPoint({ x: 4000, y: 1500 }, L); ok(d0.x < 4000, "barilotto: i bordi rientrano");
  const lines = [];
  for (const y of [300, 900, 2700]) { const l = []; for (let x = 200; x <= 3800; x += 400) l.push(Calc.distortPoint({ x, y }, L)); lines.push(l); }
  { const l = []; for (let y = 200; y <= 2800; y += 300) l.push(Calc.distortPoint({ x: 400, y }, L)); lines.push(l); }
  const F2 = Calc.fitLens(lines, 4000, 3000, true);
  near(F2.k1, -0.12, 1e-4, "k1 stimato"); near(F2.k2, 0.03, 1e-4, "k2 stimato"); ok(F2.rmsBefore > 10 && F2.rmsAfter < 0.01, "linee di nuovo dritte");
  const F1 = Calc.fitLens(lines.map(l => l.map(q => Calc.undistortPoint(q, L))), 4000, 3000, false);
  near(F1.k1, 0, 1e-4, "foto senza distorsione: k1 ≈ 0");
  near(Calc.lineSS([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }]), 2 / 3, 1e-12, "minimi quadrati totali");
}

// ---------------- 1.11.0: Mahalanobis, ES equivalente, diagnostica, incertezza di misura ----------------
{
  const g = Calc.rng(11);
  // p-value del test F uniformi nel modello, anche con gruppo molto allungato (σx = 4σy)
  const ps = [];
  for (let k = 0; k < 3000; k++) ps.push(Calc.flyersMahal([...Array(8)].map(() => ({ x: 4 * g.gauss(), y: g.gauss() })))[3].p);
  ps.sort((a, b) => a - b);
  for (const q of [0.05, 0.25, 0.5, 0.75]) near(ps[Math.floor(q * ps.length)], q, 0.03, `p-value uniforme (quantile ${q})`);
  // estremità di un gruppo allungato: flyer per il criterio euclideo, non per Mahalanobis; un colpo fuori asse sì
  const L = [{ x: -40, y: 0.5 }, { x: -20, y: -1 }, { x: -5, y: 0.8 }, { x: 5, y: -0.6 }, { x: 15, y: 1 }, { x: 25, y: -0.4 }, { x: 60, y: 0.3 }];
  ok(Calc.flyers(L, 2)[6].flagged, "euclideo: falso flyer all'estremità");
  ok(!Calc.flyersMahal(L)[6].flagged, "Mahalanobis: estremità lungo l'asse non è flyer");
  const L2 = L.slice(0, 6).concat([{ x: 0, y: 12 }]);
  ok(Calc.flyersMahal(L2)[6].flagged && Calc.flyersMahal(L2)[6].p < 0.05 / 7, "colpo fuori dall'asse: flyer");
  eq(Calc.flyersMahal(L.slice(0, 4)), null, "meno di 5 colpi");
  { const ps5 = []; for (let k = 0; k < 3000; k++) ps5.push(Calc.flyersMahal([...Array(5)].map(() => ({ x: g.gauss(), y: 2 * g.gauss() })))[0].p);
    ps5.sort((a, b) => a - b); near(ps5[Math.floor(0.1 * ps5.length)], 0.1, 0.03, "5 colpi (ν = 2): p-value uniforme"); }
  // coda di F(2, ν): confronto con integrazione numerica della densità
  { const nu = 5, x = 3.7; let I = 0; const f = t => Math.pow(1 + 2 * t / nu, -nu / 2 - 1); for (let t = x, h = 1e-3; t < 4000; t += h) I += h * (f(t) + f(t + h)) / 2;
    near(I, Math.pow(1 + 2 * x / nu, -nu / 2), 1e-4, "coda di F(2, ν) in forma chiusa"); }
  // ES equivalente
  near(Calc.esFactor(2), Math.sqrt(Math.PI), 1e-3, "n = 2: √π");
  for (const n of [3, 5, 10]) { let m = 0; const N = 40000; for (let k = 0; k < N; k++) m += Calc.extremeSpread([...Array(n)].map(() => ({ x: g.gauss(), y: g.gauss() }))).d; near(m / N, Calc.esFactor(n), 0.015, `E[ES_${n}]/σ della tabella`); }
  near(Calc.esEquivalent(Calc.esFactor(10), 10, 5), Calc.esFactor(5), 1e-12, "ES medio a 10 → ES medio a 5");
  ok(Calc.esEquivalent(30, 10, 5) < 30 && Calc.esEquivalent(30, 3, 5) > 30, "più colpi → ES più grande");
  eq(Calc.esEquivalent(30, 1, 5), null, "n = 1");
  for (let n = 3; n <= 50; n++) ok(Calc.ES_E[n] > Calc.ES_E[n - 1], `tabella crescente (${n})`);
  // diagnostica: modello giusto → p non piccoli in media; due centri e stringing riconosciuti
  let small = 0;
  for (let k = 0; k < 40; k++) { const D = Calc.modelDiagnostics([...Array(10)].map(() => ({ x: g.gauss(), y: g.gauss() })), { sims: 300, seed: k }); if (D.gof.p < 0.05) small++; }
  ok(small <= 6, `test di adattamento: pochi falsi allarmi nel modello (${small}/40)`);
  const two = [...Array(6)].map(() => ({ x: 0.3 * g.gauss() - 3, y: 0.3 * g.gauss() })).concat([...Array(6)].map(() => ({ x: 0.3 * g.gauss() + 3, y: 0.3 * g.gauss() })));
  const D2 = Calc.modelDiagnostics(two, { sims: 500 }); ok(D2.two.p < 0.01, "due centri distinti"); eq(D2.two.split.length, 6, "divisione 6 + 6");
  ok(Calc.modelDiagnostics([...Array(10)].map(() => ({ x: 0.2 * g.gauss(), y: 3 * g.gauss() })), { sims: 500 }).aniso.p < 0.01, "stringing verticale");
  eq(Calc.modelDiagnostics([...Array(7)].map(() => ({ x: g.gauss(), y: g.gauss() }))).two, null, "due centri solo da 8 colpi");
  eq(Calc.modelDiagnostics([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 1, y: 3 }]), null, "meno di 5 colpi");
  const Dq = Calc.modelDiagnostics([...Array(6)].map((_, i) => ({ x: Math.cos(i), y: Math.sin(2 * i) })));
  ok(Dq.qq.every((v, i) => i === 0 || (v.q > Dq.qq[i - 1].q && v.r >= Dq.qq[i - 1].r)), "QQ ordinato");
  // invarianza: stesso p dopo rotazione, traslazione e scala
  const P = [...Array(9)].map(() => ({ x: g.gauss(), y: 2 * g.gauss() })), T = P.map(p => ({ x: 100 + 7 * (p.x * 0.6 - p.y * 0.8), y: -50 + 7 * (p.x * 0.8 + p.y * 0.6) }));
  const A1 = Calc.modelDiagnostics(P), A2 = Calc.modelDiagnostics(T);
  near(A1.aniso.ratio, A2.aniso.ratio, 1e-9, "rapporto degli assi invariante"); near(A1.gof.A, A2.gof.A, 1e-9, "Anderson–Darling invariante"); eq(A1.two.p, A2.two.p, "due centri invariante");
  // incertezza di misura: senza errori intervallo nullo; con errore di scala ES scala con k
  const Q = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 10, y: 30 }, { x: 25, y: 12 }, { x: 5, y: 8 }];
  const M0 = Calc.measurementMC({ pts: Q, u: Q.map(() => 0), k: 0.5, uK: 0, poa: { x: 0, y: -40 }, uPoa: 0 });
  const E0 = Calc.extremeSpread(Q).d * 0.5;
  near(M0.es.lo, E0, 1e-9, "senza errori: ES esatto"); near(M0.es.hi, E0, 1e-9, "senza errori: intervallo nullo");
  near(M0.off.lo, Math.hypot(16, 50) * 0.5, 1e-9, "scostamento dalla mira");
  const M1 = Calc.measurementMC({ pts: Q, u: Q.map(() => 0), k: 0.5, uK: 0.01, level: 0.95 });
  near(M1.es.hi / E0 - 1, 1.96 * 0.01, 0.004, "errore di scala 1%: ES ±2% (95%)");
  const M2 = Calc.measurementMC({ pts: Q, u: Q.map(() => 1), k: 0.5, uK: 0 });
  ok(M2.es.lo < E0 && M2.es.hi > E0 && M2.mr.hi > M2.mr.lo, "marcatura ±1 px: intervallo attorno al valore");
  ok(M2.sigmaComb.hi > M2.sigma.hi && M2.sigmaComb.lo < M2.sigma.lo, "combinato più largo di quello di misura");
  // diametro del foro: disco di raggio 10 px su sfondo chiaro, senza vincolo di area
  { const w = 101, h = 101, lum = new Uint8Array(w * h).fill(220); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x + 0.5 - 50.5, y + 0.5 - 50.5) <= 10) lum[y * w + x] = 20;
    const D = Calc.holeDiameter(lum, w, h, 52, 49, { rSearch: 30 }); near(D.d, 20, 0.6, "diametro del disco"); near(D.x, 50.5, 0.05, "centro"); }
}

/* ---------------- 1.12.0: correzione applicata e influenza dei fori ---------------- */
{
  const C = { distMm: 100000, clickValue: 0.1, clickUnit: "MIL" };
  // 23 mm a destra, 7 mm in basso a 100 m: 0,23 MIL → 2 click (resta ≈ 3 mm a destra), 0,07 MIL → 1 click (finisce ≈ 3 mm sopra)
  const off = { dx: 23, dy: -7 }, cr = Calc.correction(off.dx, off.dy, C), a = Calc.afterCorrection(off, cr, C);
  eq([cr.hClicks, cr.vClicks], [2, 1], "click arrotondati");
  near(a.dx, 23 - 100000 * Math.tan(0.0002), 1e-6, "residuo orizzontale (stesso segno)");
  near(a.dy, -100000 * Math.tan(Math.atan(7 / 100000) - 0.0001), 1e-9, "residuo verticale: supera la mira (segno opposto)"); ok(a.dy > 2.9, "il gruppo basso va 3 mm sopra la mira");
  ok(Math.abs(a.dx) <= 5 + 1e-9 && Math.abs(a.dy) <= 5 + 1e-9, "entro mezzo click per asse");
  const z = Calc.afterCorrection({ dx: 30, dy: 0 }, Calc.correction(30, 0, C), C);
  near(z.dx, 0, 1e-6, "multiplo esatto del click: sulla mira"); eq(z.dy, 0, "asse senza scostamento");
  const M = Calc.afterCorrection({ dx: -12, dy: 9 }, Calc.correction(-12, 9, { ...C, clickValue: 0.25, clickUnit: "MOA", distMm: 91440 }), { distMm: 91440 });
  ok(Math.abs(M.dx) <= 91440 * Math.tan(0.125 * Math.PI / 10800) + 1e-9 && Math.abs(M.dy) <= 91440 * Math.tan(0.125 * Math.PI / 10800) + 1e-9, "MOA: entro mezzo click");
  eq(Calc.afterCorrection(null, cr, C), null, "senza scostamento: null");
  // influenza: effetto = valore con il foro − valore senza
  const P = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 40, y: 5 }];
  const I = Calc.influence(P, P.map(() => false)), es = q => Calc.extremeSpread(q).d, mr = q => Calc.meanRadius(q, Calc.centroid(q));
  near(I[4].es, es(P) - es(P.slice(0, 4)), 1e-12, "ES: foro lontano"); near(I[4].mr, mr(P) - mr(P.slice(0, 4)), 1e-12, "RM: foro lontano");
  ok(I[4].es > 0 && I[4].mr > 0, "il foro lontano allarga entrambi");
  ok(I.every(v => v.es >= 0), "l'effetto sull'ES non è mai negativo");
  eq(I[1].es, 0, "foro interno all'ES: effetto nullo");
  const X = Calc.influence(P, [false, false, false, false, true]);
  near(X[4].es, I[4].es, 1e-12, "foro escluso: effetto se lo si rimette");
  near(X[0].es, es(P.slice(0, 4)) - es(P.slice(1, 4)), 1e-12, "con il lontano escluso, gli altri si valutano tra loro");
  const inner = Calc.influence([...P.slice(0, 4), { x: 5, y: 5 }], P.map(() => false));
  ok(inner[4].mr < 0 && inner[4].es === 0, "foro al centro: stringe il raggio medio");
  eq(Calc.influence(P.slice(0, 2), [false, false]), [null, null], "senza il foro resterebbe un solo foro: null");
}

/* ---------------- 1.13.0: componenti del vento ---------------- */
{
  const W = (v, h) => Calc.windComponents(v, h);
  near(W(10, 3).cross, 10, 1e-12, "ore 3: tutto laterale da destra"); near(W(10, 3).head, 0, 1e-12, "ore 3: niente frontale");
  near(W(10, 9).cross, -10, 1e-12, "ore 9: da sinistra"); near(W(10, 12).head, 10, 1e-12, "ore 12: contro"); near(W(10, 6).head, -10, 1e-12, "ore 6: in coda");
  near(W(8, 2).cross, 8 * Math.sqrt(3) / 2, 1e-12, "ore 2: sin 60°"); near(W(8, 2).head, 4, 1e-12, "ore 2: cos 60°");
  near(Math.hypot(W(7, 5).cross, W(7, 5).head), 7, 1e-12, "modulo conservato");
  near(W("4.5", "3").cross, 4.5, 1e-12, "valori come testo (dal modulo)");
  eq(W("", 3), null, "senza velocità"); eq(W(5, ""), null, "senza direzione"); eq(W(5, 13), null, "ora fuori scala");
  near(W(5, 3).cross, Calc.crossWind(5, "m/s", 3), 1e-12, "coerente con crossWind in m/s");
}

/* ---------------- 1.14.0: stabilità colpo dopo colpo ---------------- */
{
  let sd = 4242; const u = () => (sd = (sd * 16807) % 2147483647) / 2147483647, gs = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  eq(Calc.stability([{ x: 0, y: 0 }, { x: 1, y: 1 }]), null, "meno di 3 colpi: null");
  const P3 = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 8 }], S3 = Calc.stability(P3, { sims: 300 });
  eq(S3.steps.map(s => s.es), [5, 8], "ES progressivo (3-4-5 e poi 8)");
  near(S3.steps[0].c.x, 1.5, 1e-12, "centro dei primi 2"); eq(S3.open, null, "sotto 5 colpi niente test"); eq(S3.drift, null, "né deriva");
  const P = Array.from({ length: 12 }, () => ({ x: 10 * gs(), y: 10 * gs() })), S = Calc.stability(P, { sims: 800 });
  P.slice(1).forEach((_, i) => near(S.steps[i].es, Calc.extremeSpread(P.slice(0, i + 2)).d, 1e-12, "ES dei primi " + (i + 2)));
  near(S.steps[11 - 1].mr, Calc.meanRadius(P, Calc.centroid(P)), 1e-12, "raggio medio finale");
  ok(S.band.every((b, i) => b.lo <= b.med && b.med <= b.hi && (i === 0 || b.med >= S.band[i - 1].med - 1e-9)), "fascia ordinata e mediana crescente");
  near(S.band[3].med / S.sigma, 3.0, 0.15, "mediana di ES_5 / sigma (circa 3, media tabellata 3,07)");
  eq(JSON.stringify(Calc.stability(P, { sims: 800 })), JSON.stringify(S), "riproducibile (seme fisso)");
  // falsi positivi sotto l'ipotesi nulla (colpi tutti uguali in distribuzione): circa il 5%
  let fo = 0, fd = 0; const R = 160;
  for (let r = 0; r < R; r++) { const Q = Array.from({ length: 8 }, () => ({ x: gs(), y: gs() })), T = Calc.stability(Q, { sims: 400, seed: r + 7 }); if (T.open.p < 0.05) fo++; if (Math.min(T.drift.x.p, T.drift.y.p) < 0.05) fd++; }
  ok(fo / R < 0.12 && fd / R < 0.12, `falsi allarmi: apertura ${fo}/${R}, deriva ${fd}/${R}`);
  // apertura netta: 6 colpi stretti, poi 3 larghi
  const O = [...Array.from({ length: 6 }, () => ({ x: 2 * gs(), y: 2 * gs() })), { x: 40, y: -30 }, { x: -45, y: 25 }, { x: 30, y: 45 }], SO = Calc.stability(O, { sims: 1000 });
  ok(SO.open.p < 0.05 && SO.open.from === 7, "si apre dal 7° colpo: " + JSON.stringify(SO.open));
  // deriva: 1 unità a colpo verso destra con sigma 1
  const Dr = Array.from({ length: 12 }, (_, i) => ({ x: i + gs(), y: gs() })), SD = Calc.stability(Dr, { sims: 200 });
  ok(SD.drift.x.p < 0.01 && Math.abs(SD.drift.x.slope - 1) < 0.35, "deriva orizzontale rilevata: " + JSON.stringify(SD.drift.x));
}

// --- 1.15.0: righello libero, alone di incertezza, passo del righello, differenze tra configurazioni
{
  // 3-4-5: 500 px a 10 px/mm = 50 mm; orientamento atan(400/300) = 53,13° (y della foto verso il basso)
  const M = Calc.measureLine({ x: 100, y: 500 }, { x: 400, y: 100 }, { pxPerMm: 10, distMm: 100000 });
  near(M.px, 500, 1e-12, "righello: px"); near(M.mm, 50, 1e-12, "righello: mm"); near(M.inch, 50 / 25.4, 1e-12, "righello: pollici");
  near(M.deg, Math.atan2(4, 3) * 180 / Math.PI, 1e-9, "righello: orientamento"); near(M.axisDev, 90 - 53.130102354, 1e-6, "righello: scarto dall'asse");
  near(M.MIL, 2 * Math.atan(50 / 200000) * 1000, 1e-9, "righello: MRAD esatti"); near(M.MOA, M.MIL / 1000 * 180 / Math.PI * 60, 1e-9, "righello: MOA");
  near(Calc.measureLine({ x: 0, y: 0 }, { x: 1000, y: 0 }, { pxPerMm: 10, distMm: 100000 }).MIL, 1, 1e-6, "righello: 100 mm a 100 m ≈ 1 MIL");
  near(Calc.measureLine({ x: 0, y: 0 }, { x: 1000, y: 0 }, { pxPerMm: 10, distMm: 91440 }).MOA, 3.759, 0.001, "righello: 100 mm a 100 yd in MOA");
  near(Calc.measureLine({ x: 50, y: 0 }, { x: 0, y: 0 }).deg, 0, 1e-12, "verso opposto: 0° (non 180°)");
  near(Calc.measureLine({ x: 0, y: 0 }, { x: 0, y: 80 }).deg, 90, 1e-12, "verticale: 90°");
  near(Calc.measureLine({ x: 0, y: 0 }, { x: 100, y: 1 }).deg, -Math.atan(0.01) * 180 / Math.PI, 1e-9, "scende verso destra: angolo negativo");
  near(Calc.measureLine({ x: 100, y: 1 }, { x: 0, y: 0 }).deg, -Math.atan(0.01) * 180 / Math.PI, 1e-9, "stesso valore nel verso opposto");
  near(Calc.measureLine({ x: 0, y: 100 }, { x: 1, y: 0 }).axisDev, Math.atan(0.01) * 180 / Math.PI, 1e-9, "quasi verticale: scarto da 90°");
  near(Calc.measureLine({ x: 0, y: 0 }, { x: 100, y: 1 }).axisDev, Math.atan(0.01) * 180 / Math.PI, 1e-9, "scarto piccolo anche scendendo");
  const U = Calc.measureLine({ x: 0, y: 0 }, { x: 30, y: 40 }); eq([U.mm, U.MOA], [null, null], "senza scala solo pixel");
  eq(Calc.measureLine({ x: 0, y: 0 }, { x: 30, y: 40 }, { pxPerMm: 2 }).MOA, null, "senza distanza niente angoli");
  // alone: R = u·√(−2 ln(1−p)); 95% → 2,4477·u; copertura simulata
  near(Calc.haloRadius(1, 0.95), 2.447747, 1e-6, "alone 95%"); near(Calc.haloRadius(2, 1 - Math.exp(-2)), 4, 1e-12, "alone 86,5% = 2·u (u = 2)");
  eq(Calc.haloRadius(0), 0, "alone nullo senza incertezza");
  { const rnd = Calc.prng(15), gs = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd()); let inside = 0; const N = 20000, R = Calc.haloRadius(1.5);
    for (let i = 0; i < N; i++) if (Math.hypot(1.5 * gs(), 1.5 * gs()) <= R) inside++;
    near(inside / N, 0.95, 0.008, "copertura simulata dell'alone al 95%"); }
  // passo «tondo» del righello
  eq(Calc.niceLength(37), { len: 20, div: 4 }, "passo 37 → 20"); eq(Calc.niceLength(100), { len: 100, div: 10 }, "passo 100");
  eq(Calc.niceLength(7.9), { len: 5, div: 5 }, "passo 7,9 → 5"); eq(Calc.niceLength(0.3).len, 0.2, "passo 0,3 → 0,2"); eq(Calc.niceLength(0), null, "passo nullo");
  // differenze: valori registrati diversi = diff; uguali ma mancanti altrove = partial; normalizzazione
  const D = Calc.differingKeys([{ a: "42,0", b: "Lapua", c: "", d: 100, e: " RS62 " }, { a: "42.0", b: "lapua", c: "CCI", d: 200, e: "rs62" }, { a: "42.5", b: "Lapua", c: "CCI", d: 100 }], ["a", "b", "c", "d", "e"]);
  eq(D, { diff: ["a", "d"], partial: ["c", "e"] }, "differenze tra configurazioni: " + JSON.stringify(D));
  eq(Calc.differingKeys([{ a: 1 }, { a: 1 }], ["a"]), { diff: [], partial: [] }, "configurazioni uguali: niente righe");
  eq(Calc.differingKeys([{ a: "1,5" }, { a: "1.5" }], ["a"]).diff, [], "virgola decimale = punto");
}

// --- 1.16.0: indici di qualità GQI / AQI / TQI e ripetibilità tra gruppi (test 1–16 della specifica)
{
  const MOA = v => v / Calc.fromRad(1, "MOA"), MILr = v => v / Calc.fromRad(1, "MIL");
  const ref = MOA(0.5), set = { mrRef: ref, dRef: MOA(0.5), wP: 0.7 };
  // 1. MR = 0 con 2 colpi → 100; 2. MR = ref → 80; 3/4. sotto/sopra; 5. monotona; 7. in [0, 100]
  const same = Calc.groupQuality([{ x: 10, y: 10 }, { x: 10, y: 10 }], null, { pxPerMm: 4, distMm: 100000 }, set);
  near(same.gqi, 100, 1e-12, "GQI 1: MR = 0 con due colpi = 100"); eq(same.ok, true, "GQI 1: calcolato");
  near(Calc.qiScore(ref, ref), 80, 1e-9, "GQI 2: MR = MR_ref → 80");
  ok(Calc.qiScore(ref * 0.7, ref) > 80, "GQI 3: MR < ref → > 80"); ok(Calc.qiScore(ref * 1.3, ref) < 80, "GQI 4: MR > ref → < 80");
  let prev = 101, mono = true, inside = true;
  for (let x = 0; x <= 20 * ref; x += ref / 50) { const g = Calc.qiScore(x, ref); if (!(g < prev) && x > 0) mono = false; if (!(g >= 0 && g <= 100)) inside = false; prev = g; }
  ok(mono, "GQI 5: decrescente al crescere di MR"); ok(inside, "GQI 7: sempre in [0, 100]");
  ok(Calc.qiScore(1e6 * ref, ref) === 0 || Calc.qiScore(1e6 * ref, ref) >= 0, "GQI 7: valori enormi ≥ 0");
  near(Calc.qiScore(2 * ref, ref), 100 * Math.pow(0.8, 4), 1e-9, "GQI: 2×ref = 100·0,8⁴ = 40,96");
  // 6. stesso valore fisico in MOA o MRAD → stesso GQI
  const mr = MOA(0.37), refMil = MILr(Calc.fromRad(ref, "MIL"));
  near(Calc.qiScore(mr, refMil), Calc.qiScore(mr, ref), 1e-9, "GQI 6: riferimento in MIL = in MOA");
  near(Calc.qiScore(MILr(Calc.fromRad(mr, "MIL")), ref), Calc.qiScore(mr, ref), 1e-9, "GQI 6: misura in MIL = in MOA");
  // riferimenti non validi, casi particolari
  for (const bad of [0, -1, NaN, Infinity, "0.5", null]) eq(Calc.qiScore(mr, bad), null, "riferimento non valido: " + bad);
  eq(Calc.groupQuality([{ x: 1, y: 1 }, { x: 2, y: 2 }], null, { pxPerMm: 4, distMm: 1e5 }, { mrRef: 0 }).reason, "ref", "MR_ref nullo: bloccato");
  eq(Calc.groupQuality([], null, { pxPerMm: 4, distMm: 1e5 }, set).reason, "none", "nessun colpo");
  const one = Calc.groupQuality([{ x: 1, y: 1 }], { x: 0, y: 0 }, { pxPerMm: 4, distMm: 1e5 }, set);
  eq([one.reason, one.gqi], ["one", undefined], "un colpo: nessun GQI (non 100)");
  eq(Calc.groupQuality([{ x: 1, y: 1 }, { x: 5, y: 5 }], null, { pxPerMm: 4, distMm: 0 }, set).reason, "dist", "distanza mancante");
  eq(Calc.groupQuality([{ x: 1, y: 1 }, { x: 5, y: 5 }], null, { distMm: 1e5 }, set).reason, "scale", "scala mancante");
  eq(Calc.qiClass(null), null, "classe di un punteggio mancante");
  // MR usato = σ̂·√(π/2) (corretto per n); misurato = media delle distanze dal centroide; atan esatto
  const P5 = [{ x: 0, y: 0 }, { x: 40, y: 8 }, { x: 12, y: 36 }, { x: -20, y: 16 }, { x: 8, y: -24 }], ctx = { pxPerMm: 4, distMm: 100000, ciLevel: 0.95 };
  const Q = Calc.groupQuality(P5, { x: 30, y: -30 }, ctx, set), d5 = Calc.dispersion(P5), c5 = Calc.centroid(P5);
  near(Q.mr, Math.atan(d5.sigma / 4 * Math.sqrt(Math.PI / 2) / 100000), 1e-15, "MR del GQI = σ̂·√(π/2) angolare");
  near(Q.mrMeas, Math.atan(Calc.meanRadius(P5, c5) / 4 / 100000), 1e-15, "MR misurato");
  near(Q.gqi, Calc.qiScore(Q.mr, ref), 1e-12, "GQI dal MR corretto");
  // IC: [f(MR_hi), f(MR_lo)] e contiene il punteggio
  near(Q.gqiCi.lo, Calc.qiScore(Q.mrCi.hi, ref), 1e-12, "IC: GQI_low = f(MR_high)"); near(Q.gqiCi.hi, Calc.qiScore(Q.mrCi.lo, ref), 1e-12, "IC: GQI_high = f(MR_low)");
  ok(Q.gqiCi.lo <= Q.gqi && Q.gqi <= Q.gqiCi.hi, "IC del GQI contiene il punteggio");
  near(Q.mrCi.lo, Math.atan(Calc.confidence(P5, 0.95).mrExp.lo / 4 / 1e5), 1e-15, "IC del MR riusa confidence()");
  // il MR corretto non è distorto: simulazione con n = 3 (il misurato è basso di √(2/3))
  { const rnd = Calc.prng(77), gs = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd()); let sc = 0, sm = 0; const N = 6000;
    for (let i = 0; i < N; i++) { const pts = [0, 1, 2].map(() => ({ x: 40 * gs(), y: 40 * gs() })), q = Calc.groupQuality(pts, null, { pxPerMm: 1, distMm: 1e5 }, set); sc += q.mr; sm += q.mrMeas; }
    const vero = Math.atan(40 * Math.sqrt(Math.PI / 2) / 1e5);
    near(sc / N / vero, 1, 0.03, "MR corretto non distorto con 3 colpi"); near(sm / N / vero, Math.sqrt(2 / 3), 0.03, "MR misurato basso di √(2/3) con 3 colpi"); }
  // classi sul valore non arrotondato
  const cls = s => Calc.qiClass(s).label;
  eq([cls(100), cls(90), cls(89.999), cls(75), cls(74.6), cls(60), cls(59.9), cls(40), cls(39.99), cls(0)],
    ["Ottimo", "Ottimo", "Buono", "Buono", "Discreto", "Discreto", "Scarso", "Scarso", "Insufficiente", "Insufficiente"], "classi con soglie non arrotondate");
  // 8–11. TQI
  near(Calc.qiTqi(100, 100, 0.7), 100, 1e-12, "TQI 8: 100 e 100 → 100"); near(Calc.qiTqi(80, 100, 0.7), 86, 1e-12, "TQI 9: 80/100 con 70/30 → 86");
  near(Calc.qiTqi(80, 100, 0.5), 90, 1e-12, "TQI 10: pesi 50/50 → 90"); near(Calc.qiTqi(80, 100, 1), 80, 1e-12, "TQI 10: solo precisione");
  eq(Calc.qiTqi(80, 100, 1.2), null, "pesi fuori da 0–100%");
  const noPoa = Calc.groupQuality(P5, null, ctx, set); eq([noPoa.ok, noPoa.tqi, noPoa.aqi, noPoa.tqiReason], [true, null, null, "poa"], "TQI 11: senza mira niente TQI (il GQI sì)");
  near(Q.d, Math.atan(Math.hypot(c5.x - 30, c5.y + 30) / 4 / 1e5), 1e-15, "AQI: distanza angolare centro-mira");
  near(Q.tqi, 0.7 * Q.gqi + 0.3 * Calc.qiScore(Q.d, set.dRef), 1e-12, "TQI del gruppo");
  near(Calc.groupQuality(P5, c5, ctx, set).aqi, 100, 1e-9, "centro sulla mira → AQI = 100");
  // 12–16. sessione
  const mk = (n, mr, d = null, s2 = mr * mr * 0.6, ok = true) => ({ ok, n, mr, d, s2, nu: 2 * (n - 1), reason: ok ? undefined : "one" });
  const L = [mk(5, MOA(0.4), MOA(0.3)), mk(10, MOA(0.6), MOA(0.2)), mk(3, MOA(1.0)), { ok: false, n: 1, reason: "one" }];
  const S = Calc.sessionQuality(L, set);
  near(S.gqi.mr, (5 * MOA(0.4) + 10 * MOA(0.6) + 3 * MOA(1.0)) / 18, 1e-15, "sessione 12: MR ponderato per i colpi");
  near(S.gqi.gqi, Calc.qiScore(S.gqi.mr, ref), 1e-12, "sessione 13: GQI dal MR aggregato");
  ok(Math.abs(S.gqi.gqi - [0.4, 0.6, 1.0].map(m => Calc.qiScore(MOA(m), ref)).reduce((a, b) => a + b) / 3) > 1, "sessione 13: diverso dalla media dei punteggi");
  eq([S.gqi.k, S.gqi.n, S.excluded], [3, 18, { one: 1 }], "gruppi validi, colpi e esclusi");
  eq([S.tqi.k, S.tqi.n, S.tqi.noPoa], [2, 15, 1], "sessione 16: TQI sui soli gruppi con mira");
  near(S.tqi.mr, (5 * MOA(0.4) + 10 * MOA(0.6)) / 15, 1e-15, "sessione 16: GQI del TQI sullo stesso insieme");
  near(S.tqi.d, (5 * MOA(0.3) + 10 * MOA(0.2)) / 15, 1e-15, "sessione: D ponderato");
  near(S.tqi.tqi, 0.7 * Calc.qiScore(S.tqi.mr, ref) + 0.3 * Calc.qiScore(S.tqi.d, set.dRef), 1e-12, "TQI della sessione");
  ok(S.gqi.gqiCi.lo <= S.gqi.gqiCi.hi, "IC del GQI di sessione");
  eq(Calc.sessionQuality([{ ok: false, n: 0, reason: "none" }], set).gqi, null, "sessione senza gruppi validi");
  // 14. distanze diverse: stesso gruppo angolare a 100 e 200 m → stesso MR e GQI; i mm non si mescolano
  const at = (Dm, sc) => Calc.groupQuality(P5.map(p => ({ x: p.x * sc, y: p.y * sc })), null, { pxPerMm: 4, distMm: Dm }, set);
  const g100 = at(100000, 1), g200 = at(200000, 2);
  near(g200.mr / g100.mr, 1, 1e-6, "sessione 14: stesso angolo a 100 e 200 m"); near(g200.gqi, g100.gqi, 1e-4, "stesso GQI a distanze diverse");
  near(Calc.sessionQuality([g100, g200], set).gqi.mr, g100.mr, 1e-9, "aggregazione angolare tra distanze");
  // ripetibilità: centri entro il rumore → p alta; centri spostati → p piccola
  { const rnd = Calc.prng(5), gs = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const sig = MOA(0.5), grp = (shift) => { const n = 10, c = { x: shift.x + sig * gs() / Math.sqrt(n), y: shift.y + sig * gs() / Math.sqrt(n) }; return { cx: c.x, cy: c.y, n, s2: sig * sig, nu: 18 }; };
    let fa = 0; for (let i = 0; i < 400; i++) { const r = Calc.centerRepeatability([0, 1, 2, 3].map(() => grp({ x: 0, y: 0 }))); if (r.p < 0.05) fa++; }
    near(fa / 400, 0.05, 0.03, "ripetibilità: falsi allarmi ≈ 5% senza spostamenti");
    const R = Calc.centerRepeatability([{ x: 0, y: 0 }, { x: MOA(1.5), y: 0 }, { x: 0, y: MOA(1.5) }, { x: MOA(-1.5), y: 0 }].map(grp));
    ok(R.p < 0.01 && R.sigmaB > R.sigmaE, "ripetibilità: spostamenti di 1,5 MOA rilevati");
    ok(R.sigmaCci.lo < R.sigmaC && R.sigmaC < R.sigmaCci.hi * 1.2, "IC di σ dei centri"); }
  eq(Calc.centerRepeatability([{ cx: 0, cy: 0, n: 5, s2: 1, nu: 8 }]), null, "ripetibilità con un solo gruppo");
  near(Calc.fcdf(1, 4, 1e6), Calc.chi2cdfEven ? 1 - Math.exp(-2) * (1 + 2) : 0.594, 1e-3, "F(4, ∞) = χ²₄/4");
  eq(Calc.QI_VERSION, "GQI-TQI/1", "versione dell'algoritmo");
}


/* ---------------- 1.21.0: calcolatore balistico, Monte Carlo della velocità, ruota degli errori ---------------- */
{
  // tabelle standard: valori noti (Applied Ballistics, ABDOC130: a Mach 3 G1 ≈ 0,51, G7 ≈ 0,24)
  near(Calc.cdOf("G1", 3), 0.5133, 1e-4, "Cd G1 a Mach 3"); near(Calc.cdOf("G7", 3), 0.2424, 1e-4, "Cd G7 a Mach 3");
  near(Calc.cdOf("G7", 0), 0.1198, 1e-9, "Cd G7 a Mach 0"); near(Calc.cdOf("G1", 9), Calc.cdOf("G1", 5), 1e-12, "oltre la tabella: ultimo valore");
  // atmosfera standard ICAO
  const A0 = Calc.atmosphere();
  near(A0.rho, 1.225, 1e-3, "ρ ICAO"); near(A0.c, 340.29, 0.05, "velocità del suono a 15 °C"); eq(A0.std, ["temp", "pressure", "humidity"], "valori standard usati");
  const A1 = Calc.atmosphere({ tempC: 30, pressHPa: 950, rh: 80 });
  ok(A1.rho < Calc.atmosphere({ tempC: 30, pressHPa: 950, rh: 0 }).rho, "l'umidità riduce la densità"); near(A1.rho, 91605 / (287.058 * 303.15) + 3395 / (461.495 * 303.15), 2e-3, "ρ a 30 °C, 950 hPa, UR 80% (vapore 33,9 hPa)");
  // traiettoria contro le tabelle di Applied Ballistics (ABDOC118, 175 SMK a 2550 fps, livello del mare, azzeramento 100 m):
  // un solo parametro geometrico (altezza ottica ≈ 70 mm, non dichiarata nel documento) allinea sia G1 sia G7 su tutta la tabella
  const AB = { G7: [0.243, { 200: 0.61, 300: 1.56, 400: 2.72, 500: 4.05, 600: 5.6, 700: 7.38, 800: 9.46, 900: 11.9, 1000: 14.74 }],
    G1: [0.475, { 200: 0.61, 300: 1.57, 400: 2.73, 500: 4.08, 600: 5.64, 700: 7.43, 800: 9.49, 900: 11.86, 1000: 14.56, 1200: 20.99, 1500: 33.26 }] };
  for (const [model, [bc, ref]] of Object.entries(AB)) {
    const T = Calc.trajectory({ v0: 2550 * 0.3048, bc, model, sightH: 0.07, zero: 100, dists: Object.keys(ref).map(Number) });
    for (const r of T.rows) near(r.vMil, ref[r.x], Math.max(0.03, ref[r.x] * 0.004), `${model} BC ${bc}: alzo a ${r.x} m (AB ${ref[r.x]} MIL)`);
  }
  const Z = Calc.trajectory({ v0: 800, bc: 0.5, model: "G1", sightH: 0.04, zero: 100, dists: [100] });
  near(Z.rows[0].drop, 0, 1e-6, "alla distanza di azzeramento la palla è sulla linea di mira");
  // deriva del vento: formula di Didion (tempo di ritardo) = vento × (t − x / V0), esatta per il modello a massa puntiforme
  const W = Calc.trajectory({ v0: 800, bc: 0.5, model: "G1", sightH: 0.04, zero: 100, dists: [300, 600, 900], wind: { cross: 4, head: 0 } });
  for (const r of W.rows) near(r.drift, -4 * (r.t - r.x / 800), Math.abs(r.drift) * 0.01, `deriva a ${r.x} m = vento × ritardo (vento da destra → a sinistra)`);
  ok(W.rows.every(r => r.hMil > 0), "correzione di brandeggio verso destra");
  const Nw = Calc.trajectory({ v0: 800, bc: 0.5, model: "G1", sightH: 0.04, zero: 100, dists: [600] }), Hw = Calc.trajectory({ v0: 800, bc: 0.5, model: "G1", sightH: 0.04, zero: 100, dists: [600], wind: { cross: 0, head: 5 } });
  ok(Hw.rows[0].vMil > Nw.rows[0].vMil, "vento contrario: più alzo");
  ok(Calc.trajectory({ v0: 800, bc: 0.5, model: "G1", sightH: 0.04, zero: 100, dists: [600], atm: Calc.atmosphere({ tempC: 15, pressHPa: 800 }) }).rows[0].vMil < Nw.rows[0].vMil, "aria rarefatta: meno alzo");
  eq(Calc.trajectory({ v0: 0, bc: 0.5, model: "G1", sightH: 0.04, zero: 100, dists: [100] }), null, "dati mancanti → null");
  // Monte Carlo: senza SD la parte della velocità è nulla; con SD cresce con la distanza; la sola parte angolare resta costante
  const o = { v0: 800, bc: 0.45, model: "G1", sightH: 0.04, zero: 100 };
  const M0 = Calc.velocitySpread(o, [100, 500, 1000], 0.1, 0);
  ok(M0.rows.every(r => r.sigVel === 0 && r.esVel === 0), "SD nulla: nessun effetto della velocità");
  const M = Calc.velocitySpread(o, [100, 300, 600, 1000], 0.1, 8);
  ok(M.rows.every((r, i) => i === 0 || r.sigVel > M.rows[i - 1].sigVel), "la parte della velocità cresce con la distanza (in angolo)");
  ok(M.rows.every(r => Math.abs(r.esAng / M.rows[0].esAng - 1) < 0.15), "la parte angolare è costante in angolo");
  const th = Calc.zeroAngle({ ...o, atm: Calc.atmosphere() }), dv = d => Math.abs(Calc.trajectory({ ...o, v0: 808, theta: th, dists: [d] }).rows[0].vMil - Calc.trajectory({ ...o, v0: 792, theta: th, dists: [d] }).rows[0].vMil) / 2;
  near(M.rows[3].sigVel, dv(1000), dv(1000) * 0.12, "σ verticale della velocità ≈ derivata × SD");
  ok(M.rows.every(r => Math.abs(r.sigV ** 2 - (0.1 ** 2 + r.sigVel ** 2)) < 0.15 * r.sigV ** 2), "varianze verticali sommate");
  near(Calc.velocitySpread(o, [600], 0.1, 8).rows[0].esTot, Calc.velocitySpread(o, [600], 0.1, 8).rows[0].esTot, 0, "seme fisso: risultato ripetibile");
  // ruota degli errori: settori di 45° centrati sulle ore; zona centrale; specchio per il mancino
  const C0 = { x: 0, y: 0 }, at = (deg, r = 10) => ({ x: r * Math.sin(deg * Math.PI / 180), y: -r * Math.cos(deg * Math.PI / 180) });   // y immagine in basso
  const pts = [0, 45, 90, 135, 180, 225, 270, 315].map((d, i) => ({ id: i, ...at(d) })).concat([{ id: 9, x: 1, y: 1 }]);
  const R = Calc.errorWheel(pts, C0, 3, "R");
  eq(R.sectors.map(s => s.n), [1, 1, 1, 1, 1, 1, 1, 1], "un colpo per settore"); eq(R.inner, 1, "uno nella zona centrale");
  eq(R.sectors.map(s => s.key), ["high", "heel", "thumb", "grip", "dip", "jerk", "finger", "recoil"], "ordine dei settori");
  const lowLeft = Calc.errorWheel([{ id: 1, ...at(225) }, { id: 2, ...at(230) }], C0, 3, "R"), lowLeftL = Calc.errorWheel([{ id: 1, ...at(225) }, { id: 2, ...at(230) }], C0, 3, "L");
  eq(lowLeft.sectors.find(s => s.n).key, "jerk", "destrorso: basso a sinistra = strappo"); eq(lowLeftL.sectors.find(s => s.n).key, "grip", "mancino: specchiato");
  eq(Calc.errorWheel([{ id: 1, ...at(22.4) }], C0, 3).sectors[0].n, 1, "confine del settore delle ore 12"); eq(Calc.errorWheel([{ id: 1, ...at(22.6) }], C0, 3).sectors[1].n, 1, "oltre: ore 1–2");
  // 1.22: stima del BC — dati sintetici dal modello stesso: il BC deve tornare; con le tabelle AB (G7 0,243) a 600 e 1000 m
  const ob = { v0: 2550 * 0.3048, model: "G7", sightH: 0.07, zero: 100, atm: Calc.atmosphere() };
  const syn = Calc.trajectory({ ...ob, bc: 0.31, dists: [500, 900] });
  const E1 = Calc.estimateBC(ob, syn.rows.map(r => ({ d: r.x, mil: r.vMil, sig: 0.05 })));
  near(E1.bc, 0.31, 0.002, "BC ricostruito dai dati sintetici"); ok(E1.chi2 < 1e-3, "residui nulli");
  ok(E1.rows.every(r => Math.abs(r.bcAlone - 0.31) < 0.003), "BC per distanza coerente"); ok(E1.rows.every(r => r.sens < 0), "più BC → meno alzo");
  const E2 = Calc.estimateBC(ob, [{ d: 600, mil: 5.6, sig: 0.05 }, { d: 1000, mil: 14.74, sig: 0.05 }]);
  near(E2.bc, 0.243, 0.004, "BC dalle tabelle AB (G7 0,243)"); ok(E2.relSig < 0.02, "a 600–1000 m il BC è ben determinato");
  const E3 = Calc.estimateBC(ob, [{ d: 150, mil: 0.3, sig: 0.05 }, { d: 200, mil: 0.61, sig: 0.05 }]);
  ok(E3.relSig > 0.1, "a 150–200 m il BC è poco determinato");
  const E4 = Calc.estimateBC(ob, [{ d: 600, mil: 5.6 * 1.05, sig: 0.05 }, { d: 1000, mil: 14.74, sig: 0.05 }]);
  ok(E4.chi2 > 4 && Math.abs(E4.rows[0].bcAlone - E4.rows[1].bcAlone) > 0.01, "osservazioni incoerenti → χ² alto, BC per distanza diversi");
  near(E4.relSig, E4.relSigRaw * Math.sqrt(E4.chi2), 1e-9, "incertezza allargata col fattore di Birge"); eq(E2.birge, 1, "dati coerenti: nessun allargamento");
  eq(Calc.estimateBC({ ...ob, v0: 0 }, [{ d: 600, mil: 5.6, sig: 0.05 }]), null, "senza V0 → null");
}

// --- SHA-256 (1.23.0): vettori FIPS 180-2 e confronto con il modulo crypto di Node su lunghezze ai bordi del blocco
{
  const crypto = require("crypto"), te = s => new TextEncoder().encode(s);
  eq(Calc.sha256(te("")), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "SHA-256 vuoto");
  eq(Calc.sha256(te("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "SHA-256 abc");
  eq(Calc.sha256(te("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")), "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1", "SHA-256 448 bit");
  eq(Calc.sha256(new Uint8Array(1000000).fill(97)), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0", "SHA-256 un milione di «a»");
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) & 255;
  for (const n of [1, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000, 70001]) {
    const u = Uint8Array.from({ length: n }, rnd);
    eq(Calc.sha256(u), crypto.createHash("sha256").update(u).digest("hex"), `SHA-256 di ${n} byte = crypto di Node`);
  }
}

// --- 1.24.0: modelli alternativi e modello gerarchico
{
  const g = Calc.rng(11);
  near(Calc.ellipseRadius({ sxx: 4, syy: 4, sxy: 0 }, 0.5), 2 * Math.sqrt(2 * Math.LN2), 1e-9, "ellisse circolare = CEP");
  near(Calc.ellipseRadius({ sxx: 1, syy: 1, sxy: 0 }, 0.95), Math.sqrt(-2 * Math.log(0.05)), 1e-9, "ellisse circolare = R95");
  for (const C of [{ sxx: 9, syy: 1, sxy: 0 }, { sxx: 2, syy: 1, sxy: 0.8 }]) {
    const r = Calc.ellipseRadius(C, 0.5), a = Math.sqrt(C.sxx), b = C.sxy / a, c = Math.sqrt(C.syy - b * b); let h = 0; const N = 200000;
    for (let i = 0; i < N; i++) { const z1 = g.gauss(), z2 = g.gauss(), x = a * z1, y = b * z1 + c * z2; if (x * x + y * y <= r * r) h++; }
    near(h / N, 0.5, 0.004, "CEP ellittico: metà dei colpi simulati");
  }
  near(Calc.ellipseRadius(Calc.covFull([{ x: 0, y: 0 }, { x: 3, y: 4 }]), 0.5), 0.6744897501960817 * Math.sqrt(12.5), 1e-4, "ellisse degenere (2 colpi): normale su una retta");
  near(Calc.ellipseRadius({ sxx: 100, syy: 1e-3, sxy: 0 }, 0.5), 6.7449, 2e-3, "ellisse molto allungata");
  near(Calc.hitProbCov({ dx: 1, dy: 0, C: { sxx: 1, syy: 1, sxy: 0 }, shape: "circle", R: 2 }), Calc.hitCircle(1, 2, 1), 0.003, "probabilità con covarianza = cerchio esatto");
  near(Calc.hitProbCov({ dx: 0.5, dy: -0.3, C: { sxx: 1, syy: 1, sxy: 0 }, shape: "rect", W: 3, H: 2 }), Calc.hitRect(0.5, -0.3, 3, 2, 1), 0.003, "probabilità con covarianza = rettangolo esatto");
  eq(Calc.hitProbCov({ dx: 0, dy: 0, C: { sxx: 2, syy: 1, sxy: 0.3 }, shape: "circle", R: 1 }), Calc.hitProbCov({ dx: 0, dy: 0, C: { sxx: 2, syy: 1, sxy: 0.3 }, shape: "circle", R: 1 }), "quasi-Monte Carlo deterministico");
  const m = Calc.spatialMedian([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 50, y: 50 }]);
  ok(m.x < 1.1 && m.y < 1.1, "mediana spaziale robusta a un punto lontano");
  near(Calc.radialQuantile([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }], { x: 0, y: 0 }, 0.5), 2.5, 1e-12, "quantile delle distanze");
  // REML bilanciato con stima interna = ANOVA dei momenti
  const sim = (k, n, sw, sb, seed) => { const r = Calc.rng(seed); return Array.from({ length: k }, () => { const bx = sb * r.gauss(), by = sb * r.gauss(); return { pts: Array.from({ length: n }, () => ({ x: bx + sw * r.gauss(), y: by + sw * r.gauss() })) }; }); };
  const G = sim(6, 5, 1, 1.5, 21), F = Calc.hierFit(G), k = 6, n = 5, N = 30;
  const ms = G.map(q => Calc.centroid(q.pts)), M = Calc.centroid(ms);
  const SSW = G.reduce((a, q, i) => a + q.pts.reduce((b, p) => b + (p.x - ms[i].x) ** 2 + (p.y - ms[i].y) ** 2, 0), 0), MSW = SSW / (2 * (N - k));
  const MSB = n * ms.reduce((a, c) => a + (c.x - M.x) ** 2 + (c.y - M.y) ** 2, 0) / (2 * (k - 1));
  near(F.sw * F.sw, MSW, 1e-6 * MSW, "REML bilanciato: σ_w² = ANOVA"); near(F.sb * F.sb, (MSB - MSW) / n, 1e-5 * MSW, "REML bilanciato: σ_b² = ANOVA");
  ok(F.p < 0.01 && F.ci.sb.lo > 0, "spostamento dei centri rilevato");
  const F0 = Calc.hierFit([{ pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: -1, y: 1 }] }, { pts: [{ x: 0.1, y: 0.6 }, { x: 1.1, y: -0.4 }, { x: -0.9, y: 1.6 }] }]);
  ok(F0.sb === 0 && F0.p === 1 && F0.ci.t.lo === 0 && F0.ci.t.hi > 0, "centri vicini: σ_b = 0, p = 1, intervallo da 0");
  eq(Calc.hierFit([{ pts: [{ x: 0, y: 0 }] }, { pts: [{ x: 1, y: 0 }] }]), null, "nessun colpo oltre i centri → null");
  let cov = 0; const R = 300;
  for (let i = 0; i < R; i++) { const f = Calc.hierFit(sim(5, 5, 1, 0.7, 500 + i)); if (f.ci.t.lo <= 0.49 && 0.49 <= f.ci.t.hi) cov++; }
  ok(cov / R > 0.91 && cov / R < 0.99, "copertura dell'intervallo di profilo ≈ 95%: " + cov / R);
  const B = Calc.hierBoot(F, 200);
  ok(B.B === 200 && B.sw.lo < F.sw && F.sw < B.sw.hi && B.stot.lo < F.stot && F.stot < B.stot.hi, "bootstrap: intervalli attorno alla stima");
  eq(Calc.hierBoot(F, 50).sw, Calc.hierBoot(F, 50).sw, "bootstrap a seme fisso");
}

// --- 1.25.0: quote della cartuccia (report ricetta): coerenza e posizioni nel disegno
{
  const Q = { shoulder: 39.47, caseLen: 48.51, cbto: 55.76, coal: 71.76, neck: 7.40 };
  eq(Calc.cartridgeCheck(Q), [], "quote coerenti: nessun avviso");
  const L0 = Calc.cartridgeLayout(Q);
  eq(L0.pos, { shoulder: 39.47, caseLen: 48.51, cbto: 55.76, coal: 71.76 }, "quote inserite: posizioni uguali ai valori");
  ok(L0.consistent && Object.values(L0.known).every(Boolean), "tutte note e coerenti");
  eq(Calc.cartridgeCheck({ caseLen: 48.51, cbto: 45 }), [{ code: "order", a: "caseLen", b: "cbto" }], "CBTO minore della lunghezza del bossolo");
  eq(Calc.cartridgeCheck({ cbto: 55, coal: 55 }), [{ code: "order", a: "cbto", b: "coal" }], "quote uguali: incoerenti");
  eq(Calc.cartridgeCheck({ shoulder: 50, coal: 40 }), [{ code: "order", a: "shoulder", b: "coal" }], "confronto anche tra quote non vicine");
  eq(Calc.cartridgeCheck({ neck: 74 }), [{ code: "range", k: "neck" }], "colletto oltre 20 mm: è un diametro");
  eq(Calc.cartridgeCheck({ coal: 720 }), [{ code: "range", k: "coal" }], "lunghezza oltre 200 mm");
  eq(Calc.cartridgeCheck({ cbto: null, coal: NaN, neck: 0 }), [], "valori assenti, non numerici o nulli ignorati");
  ok(Calc.cartridgeLayout({ ...Q, neck: 74 }).consistent, "il colletto fuori scala non blocca le quote longitudinali");
  // quote mancanti: interpolate con i rapporti della cartuccia tipo, o proporzionali all'ultima nota
  const P1 = Calc.cartridgeLayout({ caseLen: 51.18, cbto: 57.4, coal: 78.1 }).pos;
  near(P1.shoulder, 39.47 / 48.51 * 51.18, 1e-9, "spalla interpolata tra fondello e bossolo");
  const P2 = Calc.cartridgeLayout({ cbto: 55 }).pos;
  near(P2.coal, 71.76 / 55.76 * 55, 1e-9, "COAL proporzionale al CBTO"); near(P2.caseLen, 48.51 / 55.76 * 55, 1e-9, "bossolo proporzionale al CBTO");
  const P3 = Calc.cartridgeLayout({ shoulder: 30, coal: 80 }).pos;
  near(P3.caseLen, 30 + (48.51 - 39.47) / (71.76 - 39.47) * 50, 1e-9, "bossolo interpolato tra spalla e COAL");
  eq(Calc.cartridgeLayout({}).pos, { shoulder: 39.47, caseLen: 48.51, cbto: 55.76, coal: 71.76 }, "nessuna quota: cartuccia tipo");
  const P4 = Calc.cartridgeLayout({ caseLen: 48.51, cbto: 45 });
  ok(!P4.consistent && !Object.values(P4.known).some(Boolean), "quote incoerenti: nessuna quota usata");
  eq(P4.pos, Calc.cartridgeLayout({}).pos, "quote incoerenti: cartuccia tipo");
  // proprietà: qualunque sottoinsieme di quote coerenti dà posizioni strettamente crescenti
  const r = Calc.rng(125), K = ["shoulder", "caseLen", "cbto", "coal"];
  let mono = true;
  for (let i = 0; i < 400; i++) {
    const v = [20 + 40 * r.u()]; for (let j = 1; j < 4; j++) v.push(v[j - 1] + 0.2 + 25 * r.u());
    const q = {}; K.forEach((k, j) => { if (r.u() < 0.5) q[k] = v[j]; });
    const P = Calc.cartridgeLayout(q).pos;
    if (!(0 < P.shoulder && P.shoulder < P.caseLen && P.caseLen < P.cbto && P.cbto < P.coal) || K.some(k => q[k] != null && P[k] !== q[k])) mono = false;
  }
  ok(mono, "posizioni crescenti e quote note rispettate su 400 casi casuali");
}

console.log(`OK — ${passed} verifiche superate`);
