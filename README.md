# Shoot Analyzer

Analisi della dispersione dei colpi da una foto del bersaglio: group size, raggio medio, statistiche, forma del gruppo,
correzione in click del mirino, confronto tra gruppi e sessioni.

**Italiano e inglese** (selettore in alto nel pannello; l'help tecnico è solo in italiano).
**Un unico file HTML**: nessuna installazione, nessuna dipendenza, funziona su Windows, macOS e Linux.
**100% offline**: la pagina non effettua connessioni di rete; immagini e dati restano sul tuo dispositivo.

**Versione 1.17.0** · **Online: https://rives1.github.io/Target-Analisys/**

## Come usarla

Il **manuale d'uso** completo, con schermate ed esempi, è in [`docs/manuale/Manuale_Shoot_Analyzer_v1.17.pdf`](docs/manuale/Manuale_Shoot_Analyzer_v1.17.pdf).

- **Online**: apri https://rives1.github.io/Target-Analisys/
- **Offline**: scarica `src/index.html` e aprilo con doppio clic. Il file è l'intera applicazione: si può copiare su una chiavetta o inviare per email.

| Browser | Stato |
|---|---|
| Edge / Chrome (Windows, macOS, Linux) | riferimento, collaudato · salvataggio con «Salva con nome» |
| Firefox | collaudato · i file salvati vanno nella cartella Download |
| Safari | collaudato · i file salvati vanno nella cartella Download |

### In breve

1. **Carica la foto** (pulsante o trascinamento). Se è storta, **📐 Raddrizza**: clicca due punti su una linea del bersaglio. Se è di sbieco, **⬚ Prospettiva**: clicca i 4 angoli di un rettangolo di dimensioni note (es. il foglio A4): la foto viene appiattita e la scala è già impostata.
2. **Scala**: clicca due punti a distanza nota, il più lontani possibile, e inserisci il valore.
3. **Mira**: clicca il punto mirato. **Foro**: clicca il centro di ogni foro (la lente 🔍 aiuta; con **🧲 Snap** il punto si aggancia al centro del foro). Nella tabella dei punti puoi segnare i **click di alzo e brandeggio** impostati per ogni foro.
4. Imposta distanza di tiro (ogni gruppo ha la sua), calibro (elenco o valore libero) e valore del click del mirino.
5. Leggi risultati e correzione; apri **📊 Grafici e confronto tra gruppi** (in fondo al pannello) per i grafici e il confronto; esporta la **Result Card** (PNG) o copia i risultati come testo; salva la sessione (JSON).

Più rosate sulla stessa foto: **＋ Nuovo gruppo** (copia distanza e tutti i dati di ricarica e condizioni del gruppo attivo). Per confrontare sessioni diverse nel tempo: **Importa sessioni nello storico**.

### Funzioni

- **Misure**: group size centro-centro e bordo-bordo, raggio medio, H-spread, V-spread, FOM, in mm, pollici, MOA e MIL.
- **Statistiche** (modello normale circolare): SD delle distanze dal centro, SD radiale √(σx²+σy²), CEP, R95, R99, con **intervalli di confidenza** (90/95/99%).
- **Forma del gruppo**: angolo dell'asse maggiore, rapporto d'aspetto, **ellisse di dispersione** (50–99%).
- **Probabilità di colpire** un cerchio o un rettangolo, anche a un'altra distanza: probabilità per colpo e «colpi su 100» con intervallo di confidenza, con la correzione applicata e con la taratura attuale.
- **Correzione**: click per asse dal centro gruppo al punto di mira, con intervallo di confidenza; click anche per ogni foro nella tabella punti.
- **Flyer**: segnalati automaticamente (⚠, da 5 fori) con il test di Mahalanobis leave-one-out (criterio ellittico, F di Hotelling, Bonferroni) ed escludibili dal calcolo.
- **Verifica incrociata della scala**: diametro mediano dei fori contro il calibro e riferimento di controllo di lunghezza nota.
- **Incertezza di misura** per simulazione (marcatura per foro, fori «difficili», errore di scala) accanto agli IC statistici; **diagnostica del modello** (QQ-plot Rayleigh, test di adattamento, stringing e due centri); **ES equivalente** a 5 e 10 colpi.
- **Tabella punti**: coordinate, distanza da mira e da centro, direzione (gradi e sigla cardinale), click.
- **Ricarica e condizioni** per gruppo: data, bossolo, polvere e carica, palla, innesco, meteo, temperatura, umidità, pressione, vento, colpi sparati, scaldacanna, note.
- **Orientamento**: rotazione della foto (raddrizza con 2 punti, angolo libero, ±90°); punti e direzioni seguono il bersaglio raddrizzato.
- **Correzione prospettica** a 4 punti (omografia) per le foto di sbieco, con scala automatica dal rettangolo di riferimento.
- **Grafici** (vista a schermo intero): dispersione senza immagine, istogramma delle distanze dal centro, orologio delle direzioni.
- **Confronto tra gruppi**: tabella affiancata, differenza rispetto al precedente, andamento nel tempo con media mobile, storico da altre sessioni.
- **Qualità dei dati**: incertezza della scala, inquadratura improbabile (errori di unità), risoluzione del foro, avviso sotto i 3 e i 5 colpi.
- **Zone di punteggio** ISSF (10 m aria, 50 m carabina, 25/50 m pistola, 300 m) o personalizzate attorno al punto di mira, con **punteggio per foro** (bordo del foro, 10 interni, colpi sulla linea).
- **Salvataggio automatico** nel browser con ripristino alla riapertura; **archivio** delle sessioni esportabile in un unico **ZIP** (JSON, foto, CSV, riepilogo).
- **Help tecnico** integrato: significato e formula di ogni termine, lettura dei grafici, guida alla correzione ed esempi svolti calcolati dall'app.
- **Export**: Result Card PNG, testo, **CSV fori** e **CSV gruppi** per Excel/LibreOffice (in italiano `;` e virgola decimale, in inglese `,` e punto), sessione JSON.
- **Lingua**: italiano (predefinito) o inglese, scelta ricordata; in inglese anche testo copiato, Result Card, CSV (`,` e punto decimale) e ZIP.
- **Pannello a sezioni comprimibili**: all'apertura è aperta solo Calibrazione scala; Gruppi e Risultati si aprono da sole al primo punto inserito.
- **Click di alzo e brandeggio per foro** (ripresi dal foro precedente) e **dope card**: click da impostare per distanza, dai gruppi della sessione e dello storico, filtrati per munizione; CSV e PNG da stampare. Solo le distanze tirate (niente interpolazione senza modello balistico).
- **Precisione e ricarica**: CEP o raggio medio angolare per **carica di polvere** o per **salto dalle righe** (profondità di seduta), con gruppi combinati e intervallo di confidenza; un livello è indicato come migliore solo se il suo intervallo non si sovrappone agli altri (nessun «nodo» dichiarato su gruppi piccoli).
- **Report PDF** A4 (pulsante accanto alla Result Card): foto, calibrazione, colpi analizzati, misure con IC, modello statistico, grafici, tabella dei fori, ricarica e note, confronto, dope card, precisione, correlazioni, cono, reticolo; testo vero, generato offline, senza librerie.
- **Convex hull** dei fori (sull'immagine e nel grafico, area e perimetro nei risultati e nei CSV).
- **Glossario contestuale**: nei risultati i termini (CEP, FOM, σ…) mostrano una spiegazione breve e con un clic aprono la voce dell'help tecnico.
- **Snap al centro del foro** (riconoscimento della macchia vicino al clic, con controlli di plausibilità) e **cerchio del calibro** sul cursore per verificare la scala.
- **Densità**: heatmap della normale bivariata sull'immagine e superficie 3D ruotabile; **coordinate polari** dei fori (senza diagnosi automatiche).
- **Confronto visivo tra rosate**: gruppi della sessione e dello storico sovrapposti o affiancati, sulla mira o sul centro gruppo, in mm o in MOA/MIL.
- **Reticolo e holdover**: reticoli generici (MIL, MIL-DOT, MOA, passo personalizzato), FFP/SFP, tacca da usare per ogni distanza della dope card tenendo conto dei click sulle torrette; PNG.
- **Etichetta del group size** accanto a ogni gruppo sull'immagine e nella Result Card.
- **Sagome**: IPSC (A/C/D, minor/major), IDPA (punti persi), silhouette metalliche (pieno formato, 1/2, 1/5), zona vitale; spostabili e ruotabili sulla foto, usate per punteggio e probabilità di colpire. **Punteggio decimale ISSF** (fino a 10,9).
- **Correlazioni ricarica/condizioni**: alzo vs carica e temperatura, brandeggio vs vento trasversale, V-spread vs carica e temperatura (regressione con IC della pendenza); **ladder/OCW** con carica per singolo foro, senza «nodi» automatici.
- **Cono di dispersione**: lo stesso gruppo a distanze diverse (mappa 2D e cono 3D con piani di sezione), angolo costante, entro 2 volte la distanza tirata.
- **Distorsione dell'obiettivo**: correzione radiale k1/k2 calibrata cliccando linee dritte; coefficienti salvabili per fotocamera.
- **Bersaglio di autoverifica**: PDF A4 a 300 dpi con fori a posizioni note (codice SA-xxxx) da stampare, fotografare e misurare; la verifica riporta scala, errore per foro, mira e rotazione.
- **Lettura immediata** (1.12): etichette dei fori senza sovrapposizioni, pannello dei valori in tempo reale sull'immagine, tooltip sul foro, doppio clic per aprirne la riga, colonna «Effetto ES / RM» dei fori, semaforo della calibrazione.
- **Correzione sulla foto**: freccia dal centro gruppo al punto previsto dopo i click e correzione virtuale (fori spostati in trasparenza, solo visualizzazione).
- **Personalizzazione**: densità Compatta / Standard / Dettagliata e layout del pannello (ordine e sezioni nascoste) salvati nel browser.
- **Profili di ricarica** salvabili (componenti e calibro) da scegliere con un menu; **quadrante del vento** con componenti laterale e frontale.
- **Ritaglio** definitivo della foto (scala invariata) e **croce estesa** del cursore per la mira.
- **Risultati a card** con dettagli espandibili.
- **Sessione ZIP**: foto e misure in un unico file, da riaprire o importare nel confronto e nell'archivio.
- **Stabilità colpo dopo colpo**: group size progressivo con la fascia attesa per caso, colpo da cui il gruppo si apre, spostamento del punto d'impatto; ordine di sparo modificabile.
- **Report PDF con testo vero** (selezionabile), con calibrazione, colpi analizzati ed esclusi, modello statistico e incertezze, e tutti i grafici.
- **Baseline persistente** (1.17): una rosata di riferimento (☆) ricordata dal browser e salvata nella sessione; per ogni gruppo le differenze in angolo delle metriche scelte, con distanza, numero di colpi e condizioni sempre in evidenza e il test F sulla dispersione.
- **Coda dei colpi da rivedere** (⚑, tasto `V`): fori difficili, quasi sovrapposti (centri a meno di mezzo calibro) e possibili flyer, centrati e ingranditi sulla foto, con conferma, rimando o correzione; «marcatura» e «statistico» distinti.
- **Origine del dato** (⌖ accanto ai risultati): fori, estremi, centro e cerchi del modello usati per ES, H/V-spread, raggio medio, CEP/R95/R99, GQI e correzione, evidenziati sulla foto.
- **Parametri collegati alla foto**: passando su scala, calibro, distanza, click, marcatura e prospettiva l'elemento corrispondente si illumina sull'immagine (es. il foro reale del calibro su ogni foro).
- **Periodo nell'andamento**: trascinando sul grafico si confronta una serie di gruppi consecutivi con tutti i precedenti (σ combinato in angolo con IC e test F), senza modificare i dati.
- **Barra principale a icone** con tooltip (nome, funzione, tasto) e nome accessibile.
- **Indice di qualità** (1.16): GQI 0–100 con classe (compattezza rispetto a un raggio medio di riferimento scelto dall'utente, in angolo, con l'intervallo come attendibilità), TQI facoltativo con la centratura, GQI/TQI della sessione e ripetibilità dei centri tra i gruppi; anche in confronto, report, CSV e sessione. È un criterio dell'app, non uno standard.
- **Blocco degli elementi** (1.15): mira, scala, riferimento di controllo e singoli fori bloccabili (🔒, tasto `K`): non si trascinano e non si eliminano per errore; selezionati mostrano un lucchetto.
- **Gruppi nascosti** (👁 nell'elenco Gruppi): fori, mira e disegni del gruppo tolti dalla vista principale, calcoli ed export invariati.
- **Scala sulla foto**: righello graduato e/o cornice con le dimensioni reali dei lati della foto, in scala con il bersaglio, anche in Result Card e report.
- **Alone di incertezza** dei fori: cerchio al 95% per l'incertezza di marcatura di ogni foro (a mano, snap, difficile), solo grafico.
- **Note sull'immagine** numerate (N1, N2…) legate a un foro o a una zona, facoltative nel report PDF.
- **Differenze tra configurazioni** nel confronto: solo i parametri che cambiano (componenti, distanza, condizioni, impostazioni di analisi) tra le righe scelte.
- **Righello libero** (📏, tasto `R`): distanza tra due punti in mm, pollici, MOA e MRAD con orientamento, senza toccare fori e scala; **linea tratteggiata** con angolo e scarto dall'asse mentre si fissano scala e riferimento.
- **Finestra di dettaglio** (🔎, tasto `D`): ingrandimento fisso di una zona, spostabile e ridimensionabile; **campo dello zoom** con −/+ per chi non ha la rotella.
- **Strumenti**: griglia angolare MIL/MOA, lente di ingrandimento (×2–×12), undo/redo, tema chiaro/scuro, pannello ridimensionabile.

### Mouse e tastiera

Trascina un punto per spostarlo · tasto destro su un punto = elimina · `Alt`+clic = foro sopra un punto esistente ·
rotella = zoom · `Shift`+rotella = ingrandimento della lente · trascina lo sfondo o tasto centrale = pan.
`1`–`6` strumenti (`5` = raddrizza, `6` = prospettiva, `Esc` annulla) · `Ctrl+Z` / `Ctrl+Y` undo/redo · `Canc` elimina il punto selezionato · `Backspace` elimina l'ultimo ·
`X` escludi/includi il foro selezionato · `F` adatta · `L` lente · `G` griglia · `T` tema · `A` grafici e confronto · `H` help tecnico · `Ctrl+S` salva · `Ctrl+O` apri foto ·
`R` righello · `N` nota · `D` finestra di dettaglio · `K` blocca/sblocca l'elemento selezionato · `+` / `−` zoom.

### Limiti

- La correzione prospettica richiede un rettangolo reale di dimensioni note nella foto e un bersaglio piano: non corregge un foglio piegato o ondulato. La distorsione dell'obiettivo (dalla 1.10.0) è corretta solo nella componente radiale (k1, k2), calibrata da linee dritte cliccate dall'utente.
- Sagome: contorni IPSC Mini, zona C IPSC, collo/spalle/zona −1 IDPA e silhouette metalliche ricostruiti dai disegni (approssimati, dichiarato nell'app); taglie della zona vitale indicative.
- Cono di dispersione: modello ad angolo costante, limitato a 2 volte la distanza più lunga tirata; niente balistica.
- Con meno di 5 colpi le statistiche (CEP, ellisse, rapporto d'aspetto, flyer) sono indicative; gli intervalli di confidenza lo mostrano.
- Il group size (ES) non ha un intervallo di confidenza esatto e non viene stimato.
- Freccia e correzione virtuale valgono alla distanza del gruppo e mostrano solo lo spostamento del centro: il gruppo successivo avrà comunque un centro casuale. La colonna «Effetto ES / RM» descrive il gruppo, non è un criterio di esclusione.
- Densità, layout del pannello e profili di ricarica sono salvati nel browser (localStorage), non nella sessione.
- Il ritaglio è definitivo: dopo il caricamento di un'altra foto non si annulla più; conservalo salvando la sessione con la foto (ZIP o JSON con immagine). Le foto JPEG ritagliate sono ricodificate al 95%.
- La stabilità colpo dopo colpo presuppone che l'ordine dei fori sia quello di sparo; con 5–8 colpi i test vedono solo effetti forti.
- Report PDF: font standard senza simboli come σ, √, ≈ (scritti a parole); foto e grafici sono immagini JPEG.
- La card «Vento» non calcola la deriva (serve un calcolatore balistico): mostra vento inserito, componenti e scostamento misurato.
- Il test dei flyer sbaglia in circa il 5% dei gruppi ma con pochi colpi ha poca potenza: segnala solo colpi molto lontani (a 8 σ: 22% con 5 colpi, 98% con 10). I test della diagnostica hanno poca potenza sotto 10 colpi.
- Salvataggio automatico e archivio stanno nel browser (IndexedDB): si perdono cancellando i dati del sito e non passano da un browser o PC all'altro. «Salva sessione» resta il salvataggio vero. Da `file://` IndexedDB funziona in Chrome ed Edge; negli altri browser, se non è disponibile, l'app lo segnala.
- L'alone di incertezza usa l'incertezza di marcatura impostata (non misura i bordi del foro): un foro strappato va segnato come «difficile» (◐) perché l'alone si allarghi.
- Le differenze tra configurazioni confrontano i dati registrati: le voci di storico importate prima della 1.15 non hanno le impostazioni di analisi (risultano «non registrate»: reimportare le sessioni).
- Il punteggio è stimato dalla foto: per i colpi «sulla linea» (≈) decide il calibro di controllo; il punteggio decimale dei bersagli elettronici non è calcolato.

## Calcoli

| Grandezza | Definizione |
|---|---|
| Fattore di scala | `S = d_px / d_reale` (px/mm) |
| Centroide | media delle coordinate dei fori |
| Group size (c-c) | massima distanza tra due fori qualsiasi (centro-centro) |
| Bordo-bordo esterno | c-c + calibro |
| Raggio medio | media delle distanze dei fori dal centroide |
| Angolo di una dimensione | `2·atan(s / 2D)` (esatto) |
| Angolo di uno scostamento | `atan(o / D)` (esatto) |
| MOA / MIL / IPHY | `rad·(180/π)·60` / `rad·1000` / `tan(rad)·3600` |
| Click | `round(angolo_scostamento / valore_click)`, per asse |
| H-spread, V-spread | estensione orizzontale e verticale del gruppo (c-c) |
| FOM | (H-spread + V-spread) / 2 |
| SD distanze dal centro | deviazione standard campionaria delle distanze dal centroide |
| SD radiale | √(σx² + σy²), σ campionarie per asse |
| CEP / R95 / R99 | σ̂·√(−2 ln(1−p)) con σ̂ = √((σx²+σy²)/2) / c(ν=2(n−1)): 1,1774 / 2,4477 / 3,0349 σ̂ |
| Flyer | leave-one-out Mahalanobis: (m − 2)/(2(m − 1)) · m/(m + 1) · d² ~ F(2, m − 2), m = n − 1; flyer se p < 5%/n, n ≥ 5 |
| Direzione | atan2(dx, dy) in gradi, 0° = alto, senso orario, 16 settori (N, NNE, … NNO) |
| IC di σ | [σ̂·√(ν/χ²_{ν,1−α/2}), σ̂·√(ν/χ²_{ν,α/2})], σ̂² = (σx²+σy²)/2, ν = 2(n−1); CEP/R95/R99 e raggio medio atteso (σ·√(π/2)) in proporzione |
| IC del centro gruppo | per asse ± t_{n−1,1−α/2}·s/√n, tradotto in click di correzione |
| Incertezza di scala | √2 / lunghezza del segmento di calibrazione in px (±1 px per punto) |
| Ore dell'orologio | round(direzione / 30°), 0 → 12 |
| Asse maggiore | autovettore maggiore della matrice di covarianza campionaria dei fori; angolo dalla verticale, senso orario, 0–180° |
| Rapporto d'aspetto | √(λ1/λ2) = asse maggiore / asse minore dell'ellisse |
| Correzione prospettica | omografia H dai 4 angoli cliccati al rettangolo wMm × hMm (sistema 8×8, normalizzazione di Hartley); foto ricampionata con interpolazione bilineare; k = √(area del quadrilatero in px / (wMm·hMm)) px/mm |
| Probabilità di colpire un cerchio | 1 − Q₁(d/σ, R/σ) (χ² non centrale a 2 g.d.l.): d = distanza centro colpi – centro bersaglio, R = raggio |
| Probabilità di colpire un rettangolo | [Φ((W/2−dx)/σ) − Φ((−W/2−dx)/σ)] · [Φ((H/2−dy)/σ) − Φ((−H/2−dy)/σ)] |
| IC della probabilità | percentili di 4000 simulazioni: σ² = ν·s²/χ²_ν, centro ± (σ/√n)·N(0,1) per asse |
| Ellisse di dispersione p | semiassi k·√λ1, k·√λ2 con k = √(−2 ln(1−p)) (χ² con 2 gradi di libertà): 1,1774 (50%), 2,1460 (90%), 2,4477 (95%), 3,0349 (99%) |

Riferimenti: 1 MOA = 1,047" a 100 yd; 1 MIL = 10 cm a 100 m.
La correzione indica dove spostare il punto d'impatto (gruppo basso → click SU).

> Nota: la formula `size(in) / dist(yd) × 100` riportata nella specifica originale restituisce i *pollici a 100 yarde* (IPHY/SMOA), non i MOA veri. Il programma calcola entrambi correttamente.

## Sviluppo

```
src/index.html                  l'applicazione (HTML + CSS + JS in un unico file)
tests/calc.test.js              test del motore di calcolo  →  npm run test:calc
tests/ui.test.js                test dell'interfaccia (Playwright)  →  npm run test:ui
tests/i18n.test.js              traduzioni inglesi complete (incluso in npm run test:calc)
package.json                    script di test (npm test = entrambi)
.github/workflows/test.yml      GitHub Actions: tutti i test a ogni push (copia di riferimento in docs/ci/)
index.html, .nojekyll           pagina iniziale di GitHub Pages (reindirizza a src/index.html)
docs/context/                   file di contesto per versione (per riprendere lo sviluppo)
specifiche_target_analyzer.md   specifica di progetto (revisione 2)
CHANGELOG.md                    storia delle versioni
```

Il motore di calcolo (`<script id="calc-engine">`) è puro e testato con Node.js senza dipendenze (678 verifiche, inclusi
confronti con le tavole statistiche e una simulazione Monte Carlo della copertura degli intervalli di confidenza).
`tests/i18n.test.js` controlla che ogni testo del codice abbia la traduzione inglese con gli stessi segnaposto
(eseguito da `npm run test:calc`).
L'interfaccia è collaudata end-to-end con Playwright (54 scenari, pagina aperta da `file://`, nessuna richiesta di rete ammessa).
L'applicazione non usa Node: serve solo per i test.

```
npm install                       # una volta: installa Playwright
npx playwright install chromium   # una volta: scarica il browser di test
npm test                          # calcolo + interfaccia
```

Su Windows si può evitare il download del browser usando Edge: `set PW_CHANNEL=msedge && npm run test:ui`
(PowerShell: `$env:PW_CHANNEL="msedge"; npm run test:ui`).

Pubblicazione: ogni push su `main` aggiorna GitHub Pages ed esegue tutti i test con GitHub Actions
(`.github/workflows/test.yml`, risultato nella scheda *Actions*). `docs/ci/test.yml` ne è la copia di riferimento:
gli strumenti remoti di Claude non possono scrivere in `.github/workflows/`, quindi una modifica al workflow va
ricopiata a mano da `docs/ci/`.

## Licenza

MIT © 2026 Rives, vedi [LICENSE](LICENSE).
