/*
 * Controllo statico delle traduzioni (Node, senza dipendenze): ogni testo passato a _t("…") o a _T`…` nel codice
 * dell'app deve avere la sua voce nel dizionario inglese (I18N.EN in src/index.html) e, dalla 1.19.0, in quello russo
 * (I18N.RU), con gli stessi segnaposto {0}, {1}…; i due dizionari hanno le stesse chiavi e gli stessi tag HTML.
 * I testi statici dell'HTML e le chiavi dinamiche (_t(variabile)) sono controllati dal test UI «lingua inglese»
 * (I18N.missing deve restare vuoto).
 *
 *   node tests/i18n.test.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "..", "src", "index.html"), "utf8");
const dictText = html.match(/\/\*EN-DICT\*\/([\s\S]*?)\/\*END-EN-DICT\*\//);
assert.ok(dictText, "dizionario inglese non trovato (marcatori /*EN-DICT*/ … /*END-EN-DICT*/)");
const EN = JSON.parse(dictText[1]);
const ruText = html.match(/\/\*RU-DICT\*\/([\s\S]*?)\/\*END-RU-DICT\*\//);
assert.ok(ruText, "dizionario russo non trovato (marcatori /*RU-DICT*/ … /*END-RU-DICT*/)");
const RU = JSON.parse(ruText[1]);
const app = html.match(/<script id="app-main">([\s\S]*?)<\/script>/)[1];

/** Valore «cotto» di una stringa JS tra virgolette (gli escape usati nel codice: \" \' \\ \n). */
const cook = s => s.replace(/\\(["'\\`n$])/g, (m, c) => c === "n" ? "\n" : c);

/** Chiave di un template _T`…`: testo con {0}, {1}… al posto delle espressioni ${…} (anche annidate). */
function templateKey(src, start) {   // start = indice del primo carattere dopo il backtick
  let key = "", i = start, n = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") { key += cook(src.slice(i, i + 2)); i += 2; continue; }
    if (c === "`") return { key, end: i + 1 };
    if (c === "$" && src[i + 1] === "{") {   // salta l'espressione bilanciando graffe, stringhe e template annidati
      let depth = 1; i += 2;
      while (depth > 0 && i < src.length) {
        const d = src[i];
        if (d === "{") depth++;
        else if (d === "}") depth--;
        else if (d === "`") { i = templateKey(src, i + 1).end; continue; }
        else if (d === '"' || d === "'") { const q = d; i++; while (src[i] !== q) i += src[i] === "\\" ? 2 : 1; }
        i++;
      }
      key += `{${n++}}`;
      continue;
    }
    key += c; i++;
  }
  throw new Error("template non chiuso");
}

const keys = new Map();   // chiave → riga
const lineOf = i => app.slice(0, i).split("\n").length;
for (const m of app.matchAll(/\b_t\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g)) keys.set(cook(m[1]), lineOf(m.index));
for (const m of app.matchAll(/\b_T`/g)) keys.set(templateKey(app, m.index + 3).key, lineOf(m.index));

let fail = 0, checked = 0;
const ph = s => (s.match(/\{\d+\}/g) || []).sort().join(",");
for (const [k, line] of keys) {
  checked++;
  if (!(k in EN)) { fail++; console.log(`  ✗ senza traduzione (riga ${line} di app-main): ${JSON.stringify(k).slice(0, 120)}`); continue; }
  if (ph(k) !== ph(EN[k])) { fail++; console.log(`  ✗ segnaposto diversi: ${JSON.stringify(k).slice(0, 80)} → ${JSON.stringify(EN[k]).slice(0, 80)}`); }
}
for (const [k, v] of Object.entries(EN)) if (typeof v !== "string" || !v.trim()) { fail++; console.log(`  ✗ traduzione vuota: ${k}`); }
// russo: stesse chiavi dell'inglese, segnaposto, tag e attributi tecnici (class, style, id, data-*) invariati
const tagSig = s => (s.match(/<[^>]+>/g) || []).map(x => x.replace(/\s(title|aria-label|placeholder)="[^"]*"/g, "").replace(/="[^"]*"/g, '=""')).join("");
const techAttr = s => JSON.stringify([...s.matchAll(/\b(class|style|id|data-[\w-]+|value|for|type)="([^"]*)"/g)].map(m => m[1] + "=" + m[2]));
for (const k of Object.keys(EN)) {
  const v = RU[k];
  if (typeof v !== "string" || !v.trim()) { fail++; console.log(`  ✗ senza traduzione russa: ${JSON.stringify(k).slice(0, 100)}`); continue; }
  if (ph(k) !== ph(v)) { fail++; console.log(`  ✗ segnaposto diversi (ru): ${JSON.stringify(k).slice(0, 80)}`); }
  if (tagSig(k) !== tagSig(v) || techAttr(k) !== techAttr(v)) { fail++; console.log(`  ✗ tag HTML diversi (ru): ${JSON.stringify(k).slice(0, 80)}`); }
}
for (const k of Object.keys(RU)) if (!(k in EN)) { fail++; console.log(`  ✗ voce russa senza voce inglese: ${JSON.stringify(k).slice(0, 100)}`); }
if (fail) { console.log(`\n${fail} problemi di traduzione su ${checked} testi`); process.exit(1); }
console.log(`OK — ${checked} testi del codice tradotti (${Object.keys(EN).length} voci nei dizionari inglese e russo)`);
