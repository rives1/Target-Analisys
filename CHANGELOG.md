# Changelog

## [1.9.0] - 2026-11-17
### Aggiunto
- **Heatmap della densità** (Parametri di tiro, spenta all'avvio, salvata nella sessione): densità della **normale
  bivariata** stimata dai fori inclusi (covarianza piena, divisore n−1), colore del gruppo entro ±3,5 σ; anche nella
  Result Card e nel report. Scelta concordata al posto di una densità a nucleo (con 5–10 colpi dipende dalla banda).
- **Coordinate polari** (vista grafici): angolo (0° in alto, senso orario) e distanza dal centro gruppo, anelli del modello
  (raggio medio, CEP, R95) e lo stesso grafico «srotolato». Nessuna diagnosi automatica (scelta concordata).
- **Densità 3D** (vista grafici): superficie della stessa normale bivariata, proiezione ortografica ruotabile con il
  trascinamento, doppio clic per la vista iniziale.
- **Confronto visivo tra rosate** (vista grafici): gruppi della sessione e dello storico **sovrapposti** o **affiancati**
  alla stessa scala, origine nel **punto di mira** o nel **centro gruppo**, in **mm** o in **MOA/MIL** (ogni gruppo con la
  sua distanza); cerchio del raggio medio e centro. I riepiloghi dello storico salvano ora le coordinate dei fori
  (`pts`, mm rispetto alla mira o al centro): i gruppi importati prima della 1.9.0 non sono disegnabili.
- **Reticolo e holdover** (vista grafici): reticoli generici MIL a tacche, MIL-DOT, MOA a tacche o passo personalizzato;
  primo o secondo piano focale (SFP: lettura = necessario × ingrandimento / ingrandimento di taratura); correzioni dalla
  dope card o dal gruppo attivo, meno i click già impostati sulle torrette; tacca da usare disegnata sul reticolo (dalla
  parte opposta alla correzione), tabella con istruzione a parole, **PNG**. Nessun reticolo commerciale e nessuna
  estrapolazione balistica (scelte concordate).
- **Bersaglio di autoverifica** (sezione Dati): **PDF A4 a 300 dpi** con codice SA-xxxx, riquadro 150 × 150 mm, croce
  della mira, 5 o 10 fori del calibro attuale (max 12 mm) a posizioni generate dal codice e righello di 100 mm; la
  **verifica** del gruppo attivo abbina i fori misurati a quelli veri e riporta rapporto di scala, errore per foro (RMS e
  massimo), spostamento della mira, rotazione residua, ES e raggio medio veri e misurati, con giudizio indicativo.
- Motore: `covariance`, `bvnDensity`, `prng`, `testTarget`, `matchPoints`, `verifyTarget`, `holdover`.
- Help tecnico: «Densità: heatmap e superficie 3D», «Reticolo e holdover», «Bersaglio di autoverifica», voci dei grafici
  polare e confronto visivo; guida rapida aggiornata; tutto tradotto in inglese tranne l'help.
- Test: +32 verifiche del motore (210), 4 test UI nuovi (37), tra cui il test end-to-end del bersaglio di prova
  (disegno → foto → scala sul righello → snap → verifica).

## [1.8.0] - 2026-11-17
### Aggiunto
- **Salto dalle righe** (profondità di seduta) nei dati di ricarica, con unità pollici/mm; nella card, nel testo, nel CSV
  dei gruppi e copiato nel nuovo gruppo.
- **Precisione e ricarica** (vista grafici, al posto di «Carica e precisione»): variabile **carica** (a parità di palla e
  polvere) o **salto dalle righe** (a parità di palla, polvere e carica), metrica **CEP** o **raggio medio atteso**
  (σ·√(π/2)), livelli combinati con intervallo χ² e criterio prudente. Scelta concordata al posto del «nodo di
  precisione» richiesto: con gruppi piccoli non è dimostrabile (help tecnico).
- **Report PDF** (📑 accanto alla Result Card, stessa scelta gruppo attivo / tutti): pagine A4 a 150 dpi con intestazione,
  foto ritagliata con i punti, per ogni gruppo misure con IC, forma, convex hull, correzione, dope, punteggio,
  probabilità di colpire, ricarica e note, grafici e tabella dei fori; poi confronto tra gruppi, dope card e precisione e
  ricarica se ci sono dati. Scrittore PDF interno (`makePdf`, JPEG per pagina, xref verificata dai test); palette chiara
  anche con il tema scuro. Testo non selezionabile (scelta concordata: file diretto invece della stampa del browser).
- **Glossario contestuale**: nei risultati le etichette (group size, raggio medio, H/V-spread, FOM, SD, CEP, R95/R99,
  asse, rapporto, ellisse, scostamento, convex hull, punteggio, dope, IC) sono link con spiegazione al passaggio del mouse;
  il clic apre l'help tecnico sulla voce del glossario e la evidenzia. Voci nuove: convex hull, dope, salto dalle righe.
- **Convex hull** (`Calc.convexHull`, `Calc.polygonAreaPerim`): area (mm²) e perimetro nei risultati, nel testo, nel
  report e nel CSV dei gruppi; disegno sull'immagine e nel grafico a dispersione (Parametri di tiro, spento all'avvio,
  salvato nella sessione). Voronoi non realizzato (scelta concordata: con 5–10 colpi non dà indicazioni affidabili).
- Help tecnico: sezioni «Convex hull» e «Report PDF», «Carica, seduta e precisione»; guida rapida aggiornata.
- Test: +8 verifiche del motore (178), 4 test UI nuovi (33): convex hull, seduta, glossario, report PDF.

## [1.7.0] - 2026-11-17
### Aggiunto
- **Click di alzo e brandeggio per foro**: colonne «Alzo» e «Brand.» nella tabella dei punti (+ = in alto / a destra).
  Un nuovo foro riprende i click del precedente (il primo foro di un nuovo gruppo gli ultimi usati); correggendo un foro
  si aggiornano anche i successivi che avevano lo stesso valore. Salvati nella sessione, nel CSV dei fori e annullabili.
- **Distanza per gruppo**: il campo «Distanza di tiro · gruppo attivo» vale per il gruppo attivo; un nuovo gruppo parte
  dalla distanza del gruppo attivo. Le sessioni precedenti usano per tutti i gruppi la distanza della sessione.
- **Dope** del gruppo nei risultati (se ci sono click impostati): click da impostare per colpire la mira = click
  impostati + correzione di ogni foro (angolo esatto), mediati, con intervallo t di Student. Avviso se i click cambiano
  durante il gruppo. Anche nel testo copiato, nella Result Card e nel CSV dei gruppi.
- **Dope card** nella vista grafici: una riga per gruppo con dope (sessione + storico), ordinata per distanza, filtrata per
  munizione (palla · polvere · carica); click nell'unità della sessione, MIL, MOA, condizioni; grafico alzo/distanza;
  **CSV** e **PNG** da stampare. Solo le distanze tirate: nessuna interpolazione (servirebbe un modello balistico).
- **Carica e precisione** nella vista grafici: CEP angolare per carica di polvere (a parità di palla e polvere), gruppi
  della stessa carica combinati (varianza pesata per i gradi di libertà) con intervallo χ²; una carica è indicata come
  migliore solo se il suo intervallo non si sovrappone a quello di nessun'altra. Scelta concordata al posto del «nodo
  armonico» richiesto: con gruppi piccoli i «nodi» non sono dimostrabili (help tecnico).
- **Snap al centro del foro** (🧲, tasto M, attivo all'apertura, scelta ricordata): il foro cliccato si aggancia al
  centroide della macchia vicino al clic (`Calc.snapHole`: sfondo dal bordo della finestra, soglia a metà, regione
  connessa, controlli di contrasto, area e forma rispetto al calibro). Alt+clic = senza snap (fori sovrapposti). Il
  suggerimento sotto la barra dice se il foro è stato agganciato.
- **Cerchio del calibro** sotto il cursore (e nella lente) in modalità «Foro»: verifica visiva immediata della scala.
- Motore: `Calc.toRad`, `Calc.dope`, `Calc.milToClicks`, `Calc.pooledSigma`, `Calc.snapHole` (+29 verifiche, 170).
- Help tecnico: sezioni «Click impostati e dope card», «Carica e precisione», «Snap al centro del foro».
- Test UI: 5 nuovi (29): click e propagazione, distanza per gruppo, dope card, carica e precisione, snap e cerchio del calibro.
### Modificato
- **Sezioni del pannello**: all'apertura è aperta solo «Calibrazione scala»; al primo punto inserito su una foto (scala,
  mira o foro) si aprono «Gruppi» e «Risultati» (una volta per foto; anche caricando una sessione con punti).
- Colonne nuove nel CSV dei fori (click impostati) e dei gruppi (dope in click e MIL, con intervallo).
### Corretto
- CSV in italiano: dalla 1.6.0 i numeri con la virgola decimale venivano messi tra virgolette (la virgola era trattata
  come separatore anche in italiano). Ora le virgolette servono solo per il separatore della lingua scelta.

## [1.6.0] - 2026-11-17
### Aggiunto
- **Lingua dell'interfaccia**: selettore «Italiano / English» in alto nel pannello; predefinito italiano, scelta ricordata
  nel browser. Il cambio è immediato, senza ricaricare la pagina e senza perdere il lavoro. In inglese sono tradotti
  interfaccia, suggerimenti, messaggi, risultati, tabella punti, vista grafici e confronto, Result Card, testo copiato,
  CSV, nomi dei file esportati, contenuto dello ZIP e guida rapida. L'**help tecnico resta in italiano** (scelta
  concordata), con un avviso in inglese; i suoi esempi calcolati restano in formato italiano.
  - Numeri e date seguono la lingua: in inglese punto decimale, date `gg/mm/aaaa` (en-GB), CSV con separatore `,` e punto
    decimale (formato di Excel in inglese); in italiano invariati (`;` e virgola).
  - Sigle della bussola in inglese (W al posto di O), direzioni della correzione UP/DOWN/LEFT/RIGHT (nella tabella
    punti UP, DOWN, L, R).
  - I nomi automatici dei gruppi («Gruppo 2» / «Group 2») seguono la lingua; quelli scritti dall'utente no.
- Test: 4 nuovi test dell'interfaccia (24): stato delle sezioni all'apertura, copia dei dati nel nuovo gruppo, percorso
  completo in inglese (nessun testo senza traduzione, nessuna parola italiana nei pannelli, CSV e ZIP in inglese, help in
  italiano, lingua ricordata dopo la riapertura), cambio di lingua a lavoro aperto.
- `tests/i18n.test.js` (eseguito con `npm run test:calc`): ogni testo del codice passato a `_t`/`_T` deve avere la
  traduzione inglese con gli stessi segnaposto.
### Modificato
- **Sezioni del pannello comprimibili** (clic sul titolo). All'apertura dell'app sono **chiuse** Orientamento e
  prospettiva, Parametri di tiro, Risultati, Zone di punteggio e Probabilità di colpire; aperte Calibrazione scala, Gruppi,
  Ricarica e condizioni, Punti del gruppo attivo e Dati.
- **Nuovo gruppo**: copia **tutti** i dati di ricarica e condizioni del gruppo attivo, compresi colpi sparati,
  scaldacanna e note (prima solo munizione e condizioni).

## [1.5.0] - 2026-11-16
### Aggiunto
- **Salvataggio automatico** nel browser (IndexedDB) 1,2 s dopo ogni modifica e quando la pagina viene nascosta: sessione
  + foto originale (come file binario, una sola copia per foto). Alla riapertura, se c'è un lavoro non salvato su file,
  un avviso propone **Ripristina / Ignora** (ignorato, resta disponibile finché non inizi un nuovo lavoro). Indicatore
  «Salvato automaticamente alle hh:mm» sotto il titolo. Se IndexedDB non è disponibile l'app lo segnala e continua.
  localStorage scartato: ~5 MB in tutto, meno di una foto.
- **Zone di punteggio** (nuova sezione): bersagli ISSF 10 m carabina e pistola ad aria, 50 m carabina, 25 m precisione /
  50 m pistola, 300 m carabina (diametri dal regolamento tecnico ISSF) e personalizzato (⌀ del 10, passo, 10 interno).
  Anelli disegnati attorno al punto di mira di ogni gruppo, nella vista e nella Result Card.
  - **Punteggio per foro** con la regola dei bersagli di carta: vale l'anello toccato dal **bordo** del foro (calibro
    impostato); `*` = 10 interno (carabina ad aria: punto asportato del tutto); `≈` = «sulla linea» entro l'incertezza di
    posizione. Totale, massimo, media e 10 interni per gruppo nei risultati, nella tabella punti (colonna «Punti»), nella
    card, nel testo e nei CSV (fori: Punti, 10 interno, Sulla linea; gruppi: Bersaglio, Punteggio, Massimo, Media, 10 interni).
    Contano tutti i fori, anche quelli esclusi dalle statistiche.
- **Archivio delle sessioni** (sezione Dati): ogni «Salva sessione» archivia anche la sessione nel browser (stessa
  sessione = stessa voce); «＋ Aggiungi sessioni» importa sessioni salvate in precedenza; «Svuota archivio».
- **🗜 Esporta archivio (ZIP)**: un unico file con una cartella per sessione (`sessione.json` senza foto incorporata,
  foto originale, `fori.csv`, `gruppi.csv`), più `riepilogo_gruppi.csv` con tutti i gruppi di tutte le sessioni e
  `LEGGIMI.txt`. Scrittore ZIP interno (metodo «store», CRC-32, nomi UTF-8), nessuna libreria.
- Help tecnico: sezione «Zone di punteggio e punteggio» (tabella ISSF, regola, formula) e voci nel glossario; guida
  rapida aggiornata.
- Test: 15 nuovi test del calcolo (141: diametri ISSF di tutti i bersagli, limiti di linea, 10 interno) e 3 nuovi test
  dell'interfaccia (20: anelli e punteggio contro un calcolo indipendente, autosave e ripristino, archivio e ZIP letto
  da un lettore indipendente con verifica dei CRC).
### Modificato
- La sessione JSON contiene `sessionId`. I CSV sono generati da una «sorgente» (sessione aperta o salvata), così lo ZIP
  calcola i CSV anche delle sessioni archiviate.

## [1.4.0] - 2026-11-16
### Aggiunto
- **Help tecnico** (pulsante «📘 Help tecnico» nella sezione Dati, accanto ai CSV, o tasto `H`): vista a schermo intero
  con indice laterale che spiega **significato, formula e uso** di ogni termine dell'app, non il suo utilizzo:
  - glossario A–Z (c-c, bordo-bordo, CEP, χ², click, ES, ellisse, FOM, flyer, H/V-spread, IC, IPHY/SMOA, MIL, MOA, MR,
    POA, R95/R99, rapporto d'aspetto, Rayleigh, SD, σ, t di Student; SEP spiegato come non usato: è il CEP in 3D);
  - unità angolari e formule esatte; mira, centro gruppo, correzione e suo IC; dimensioni (ES, MR, H/V-spread, FOM);
    statistiche (SD, σ con correzione per piccoli campioni, CEP/R95/R99 dal modello di Rayleigh); intervalli di
    confidenza con tabella dell'ampiezza in funzione del numero di colpi; forma ed ellisse; flyer; probabilità di colpire;
  - come leggere i grafici (dispersione, istogramma, orologio dal punto di mira e dal centro gruppo, confronto e
    andamento con media mobile);
  - qualità della misura (incertezza della scala, DPI, rotazione, omografia, griglia);
  - «Dalla lettura alla correzione»: procedura in 6 passi e tabella forme del gruppo → cause tipicamente indicate → cosa
    fare, presentate come indicazioni e non come diagnosi;
  - 4 esempi svolti (gruppo di 5 colpi, flyer, probabilità di colpire, conversioni) i cui numeri sono **calcolati dal
    motore dell'app** all'apertura, quindi sempre coerenti con i risultati;
  - 5 schemi SVG che seguono il tema chiaro/scuro.
- Test dell'interfaccia (17 in totale): apertura, indice, tasti, esempi compilati e coerenza delle frasi di commento
  con i valori calcolati.

## [1.3.0] - 2026-11-16
### Aggiunto
- **Probabilità di colpire** un bersaglio noto (sezione del pannello, gruppo attivo): cerchio (diametro) o rettangolo
  (larghezza × altezza) in mm, cm o pollici, alla distanza del gruppo o a un'altra distanza.
  - Risultato: probabilità per colpo, «colpi a segno su 100» e intervallo di confidenza (livello dei parametri, default 95%),
    in due casi affiancati: **con la correzione applicata** (gruppo sul centro del bersaglio, salvo lo scostamento residuo
    dell'arrotondamento al click) e **con la taratura attuale** (bersaglio sul punto di mira, con lo scostamento misurato).
  - Calcolo esatto nel modello normale circolare di CEP/R95/R99: cerchio con la distribuzione χ² non centrale a 2 gradi
    di libertà (1 − Q₁ di Marcum), rettangolo come prodotto delle probabilità per asse.
  - Intervallo con **simulazione parametrica** (4000 estrazioni di σ dalla distribuzione χ² e del centro gruppo da quella
    normale/t, seme fisso): stesso modello degli altri intervalli. Il bootstrap classico (ricampionamento dei fori) è stato
    scartato perché con 3–10 colpi dà intervalli troppo stretti. Copertura verificata con simulazioni: ≈ 95% con la
    correzione applicata; con la taratura attuale e uno scostamento piccolo può scendere fino a ~83% con 3 colpi
    (segnalato nell'app).
  - A un'altra distanza la dispersione angolare è supposta costante (esatto nel modello, ottimista nella realtà per vento e
    velocità: segnalato come limite superiore); la «taratura attuale» non è calcolata perché dipende dalla balistica.
  - Anche nella Result Card del gruppo attivo e nel testo copiato; parametri salvati nella sessione.
  - Percentuali estreme scritte «< 0,1%» / «> 99,9%», mai 0% o 100%.
- **Preset 10 × 10 mm e 30 × 30 mm** del rettangolo di riferimento della correzione prospettica (con un riferimento così
  piccolo la scala è poco precisa: l'app lo segnala).
- Funzioni `Calc`: `erfc` (errore ≈ 10⁻¹³), `normcdf`, `hitCircle`, `hitRect`, `rng` (generatore con seme),
  `hitProbability`; 19 nuovi test del calcolo (126 in totale: confronti con integrazione numerica, Rayleigh, Marcum,
  scala con la distanza, copertura simulata dell'intervallo) e 1 nuovo test dell'interfaccia (16 in totale).

## [1.2.0] - 2026-11-16
### Aggiunto
- **Correzione prospettica a 4 punti** (omografia) per le foto scattate di sbieco: strumento **⬚ Prospettiva** (tasto `6`,
  anche nella sezione «Orientamento e prospettiva»). Si scelgono le dimensioni reali di un rettangolo visibile nella foto
  (A4/A3 verticale o orizzontale, oppure larghezza × altezza libere in mm) e si cliccano i suoi 4 angoli in qualsiasi ordine
  (`Backspace` toglie l'ultimo, `Esc` annulla). La foto viene ricampionata (interpolazione bilineare) in una foto
  «appiattita» in cui il rettangolo è un rettangolo esatto:
  - tutti i punti già inseriti vengono riportati sulla foto appiattita; rotazione e raddrizzamento restano disponibili;
  - **scala automatica** dal rettangolo (px/mm della foto appiattita), con incertezza stimata dal lato più corto;
    una scala manuale a 2 punti, se inserita dopo, ha la precedenza;
  - risoluzione = risoluzione media della foto dentro il rettangolo; estensione = tutta la foto, limitata a un lato
    del rettangolo per parte e a 36 milioni di pixel;
  - avviso se il rapporto dei lati nella foto fa pensare a larghezza e altezza invertite;
  - «Rimuovi correzione» riporta foto e punti all'originale; la correzione è nella storia undo/redo e nella sessione.
- **Export CSV** per fogli di calcolo (sezione Dati): **CSV fori** (una riga per foro di tutti i gruppi: escluso, flyer,
  coordinate dal punto di mira, distanze da mira e centro, direzione, click, coordinate in pixel) e **CSV gruppi** (una riga
  per gruppo: group size, raggio medio, H/V-spread, FOM, SD, CEP/R95/R99 in mm, MOA e MIL, forma, centro gruppo,
  correzione e tutti i dati di ricarica). Formato italiano: separatore `;`, virgola decimale, UTF-8 con BOM, righe CRLF,
  testi con `;` o virgolette racchiusi tra virgolette (RFC 4180).
- **Icona** nella scheda del browser (mirino con rosata): SVG incorporato più PNG 32 px per i browser senza icone SVG;
  anche nella pagina iniziale di GitHub Pages.
- Funzioni `Calc`: `solveLinear`, `invertH`, `homography` (con normalizzazione di Hartley), `applyH`, `polyArea`,
  `orderQuad`, `rectify`; 17 nuovi test del calcolo (107 in totale) con una «fotocamera» sintetica a prospettiva nota.
- 4 nuovi test dell'interfaccia (15 in totale): icona, CSV (formato, numeri, virgolette), correzione prospettica su una foto
  sintetica di sbieco (fori in mm entro 1 mm, foto ricampionata, scala automatica, undo/redo, rimozione), sessione con
  prospettiva, `Esc` e `Backspace`.
### Modificato
- Sessione JSON: campo `persp`; formato `3` solo se c'è la correzione prospettica (altrimenti 2 se la foto è ruotata, 1 se no),
  così le versioni precedenti non mostrano punti nel posto sbagliato.
- Lo storico importato usa la scala del rettangolo per le sessioni con correzione prospettica e senza scala manuale.

## [1.1.0] - 2026-11-15
### Aggiunto
- **Rotazione della foto** (sezione «Orientamento immagine» e strumento 📐 **Raddrizza**, tasto `5`):
  - *Raddrizza con 2 punti*: si cliccano due punti su una linea del bersaglio (bordo, riga della griglia); la foto ruota
    in modo che la linea diventi orizzontale o verticale (la più vicina). `Esc` annulla.
  - campo **Rotazione** in gradi (+ = orario) per la regolazione fine; pulsanti **⟲ 90° / ⟳ 90°** per le foto girate; **Azzera**.
  - Ruotano anche i punti già inseriti (scala, mire, fori): le distanze non cambiano, mentre tutte le direzioni
    (correzione SU/GIÙ/DX/SX, H/V-spread, FOM, bussola, orologio, asse dell'ellisse, griglia angolare) si riferiscono
    all'alto del bersaglio raddrizzato. La rotazione è nella storia undo/redo, nella sessione, nel testo e nella Result Card.
- **Ingrandimento della lente regolabile**: ×2, ×3, ×4, ×6, ×8, ×12 dal menu accanto a «Lente» o con `Shift`+rotella
  sull'immagine mentre la lente è visibile; la scelta è ricordata nel browser.
- **Umidità relativa (%) e pressione atmosferica (hPa)** nei dati di ricarica e condizioni: ereditate dai nuovi gruppi,
  riportate nella Result Card e nel testo (riga «Meteo»). Sono annotazioni: nessun calcolo le usa.
- **Vista a schermo intero «Grafici e confronto tra gruppi»**: i grafici del gruppo attivo e il confronto tra gruppi
  (tabella, andamento nel tempo, storico) non sono più nel pannello destro ma in una vista dedicata, aperta dal pulsante
  📊 fisso in fondo al pannello o con il tasto `A`; selettore del gruppo attivo in alto; `Esc` o «← Torna all'analisi» per tornare.
  Mentre la vista è aperta le scorciatoie dell'immagine sono disattivate.
- **Test dell'interfaccia** `tests/ui.test.js` (Playwright, 11 scenari: caricamento senza rete, inserimento punti col mouse,
  trascinamento e undo/redo, rotazione e raddrizzamento, lente, umidità/pressione, vista grafici, sessione ruotata,
  Result Card, griglia e tema) e `package.json` (`npm test`, `npm run test:calc`, `npm run test:ui`).
- **GitHub Actions**: workflow pronto in `docs/ci/test.yml` (test del calcolo e dell'interfaccia a ogni push e pull request).
  Va copiato a mano in `.github/workflows/` (gli strumenti remoti di Claude non possono scrivere in quella cartella).
### Modificato
- Sessione JSON: campo `rotation` (gradi). Il formato resta `1` se la foto non è ruotata (leggibile dalle versioni
  precedenti) e diventa `2` se è ruotata (le versioni precedenti la rifiutano invece di mostrare i punti nel posto sbagliato).
- Collaudo: Safari collaudato dall'utente con esito positivo.

## [1.0.0] - 2026-11-13
Prima versione ufficiale. Raccoglie tutte le funzioni sviluppate dalla 0.1.0 alla 0.12.0 (vedi sotto).
### Pulizia del codice
- Rinominate due variabili globali che nascondevano oggetti del browser: `history` → `undoStack` (pila undo/redo)
  e `Storage` → `FileStore` (salvataggio dei file). Nessun cambiamento di comportamento.
- Analisi statica (ESLint: variabili non usate, non definite, ridichiarate): nessun problema residuo.
- Intestazione del file con versione, licenza e indirizzo del progetto; guida rapida in app aggiornata
  (gruppi, ricarica, flyer, confronto, ipotesi statistiche, privacy).
- README riscritto come guida utente; criteri di accettazione della specifica verificati.
- `feature-request.md` (appunti personali) tolto dal repository e aggiunto a `.gitignore`; il file locale resta.
### Verifiche di rilascio
- 90 test del motore di calcolo superati.
- Regressione completa nel browser (Chrome headless): calibrazione, punti, drag, undo/redo, lente, griglia, gruppi,
  ricarica, flyer ed esclusione, forma ed ellisse, grafici e tooltip, confronto e storico, intervalli di confidenza,
  avvisi di qualità, tema scuro, pannello ridimensionabile, salvataggio e ricaricamento della sessione, Result Card,
  «Salva con nome»: nessun errore, nessuna richiesta di rete.

## [0.12.0] - 2026-11-13
### Aggiunto
- **Qualità della calibrazione** (nel riquadro della scala, nel testo e nella Result Card):
  scala anche in DPI equivalenti; incertezza di scala stimata (±1 px per punto → √2 / lunghezza del segmento),
  avviso se supera l'1% (segmento < ~141 px); inquadratura reale della foto con avviso se fuori da 2 cm – 3 m
  (tipico errore di valore o di unità mm/cm/in); diametro del foro in pixel con avviso se < 8 px.
- **Numero minimo di colpi**: avviso per gruppo sotto i 3 colpi (statistiche non significative) e sotto i 5 (poco significative),
  nei risultati, nel testo e nella Result Card.
- **Intervalli di confidenza** (livello 90/95/99%, default 95%):
  - σ del modello circolare normale con la distribuzione χ² (ν = 2(n−1)) e, da σ, CEP, R95, R99 e raggio medio atteso (σ·√(π/2));
  - posizione del centro gruppo per asse con la t di Student (n−1 gradi di libertà) e, da questa, **intervallo dei click
    di correzione** (es. «verticale 4–6 SU»), con avviso se su un asse l'intervallo comprende lo zero.
  Gli intervalli sono asimmetrici e sono quindi scritti «min–max», non «±». Il group size (ES) non ha un intervallo esatto
  e non viene stimato.
- Funzioni `Calc`: `chi2cdfEven`, `chi2inv`, `ibeta`, `tcdf`, `tinv`, `confidence`, `correctionCI`.
  16 nuovi test (90 in totale), tra cui quantili χ² e t confrontati con le tavole e una simulazione Monte Carlo
  (4000 gruppi da 5 colpi) che verifica la copertura effettiva del 95% degli intervalli di σ e del centro gruppo.

## [0.11.0] - 2026-11-13
### Aggiunto
- Sezione **Confronto tra gruppi** (da 2 gruppi con fori):
  - **Tabella affiancata** di tutti i gruppi in ordine di data (data dei dati di ricarica): n, ES, raggio medio, FOM, CEP
    in MIL o MOA; valore migliore di ogni colonna evidenziato; gruppo attivo in grassetto;
  - **Δ rispetto al gruppo precedente** (valore e %) sulla metrica scelta, più una frase di sintesi per il gruppo attivo;
  - **Andamento nel tempo**: grafico della metrica scelta per gruppo con la **media mobile** sugli ultimi N gruppi (N regolabile, default 3);
  - **Metrica** selezionabile (Group size di default, Raggio medio, FOM, CEP) e unità MIL/MOA.
- **Storico**: «Importa sessioni nello storico» aggiunge i gruppi di altre sessioni salvate (.json, anche più file insieme)
  come riepiloghi in sola lettura, ciascuno calcolato con la propria scala e distanza; duplicati ignorati; rimozione singola
  o «Svuota storico». Lo storico viene salvato nella sessione (solo riepiloghi, non immagini).
- Il testo copiato include la tabella di confronto.

## [0.10.0] - 2026-11-13
### Aggiunto
- **Forma e orientamento del gruppo** (pannello Risultati, Result Card, testo; da 3 fori, avviso sotto i 5):
  - **Asse maggiore**: gradi dalla verticale in senso orario (0° = verticale, 90° = orizzontale, come bussola e orologio),
    con ore dell'orologio e descrizione (verticale / orizzontale / diagonale ↗ ↖);
  - **Rapporto d'aspetto** = asse maggiore / asse minore dell'ellisse (√ del rapporto tra le varianze principali); < 1,3 «circa circolare»;
  - **Ellisse di dispersione** (di concentrazione): covarianza campionaria dei fori scalata con k = √χ²₂(p) = √(−2 ln(1−p));
    percentuale 50/90/95/99% (default 95%), attivabile; disegnata sull'immagine (per ogni gruppo), nel grafico a dispersione
    (con l'asse maggiore) e nella Result Card. Semiassi in mm nei risultati.
- Orologio «dal centro gruppo»: indica anche l'angolo dell'asse e la sua descrizione.
- `Calc.ellipse`, `Calc.axisWords`; `analyze` restituisce `shape` e `ellA/ellB`. 10 nuovi test (74 in totale).

## [0.9.0] - 2026-11-13
### Aggiunto
- Sezione **Grafici · gruppo attivo** nel pannello destro (canvas, nessuna libreria, si aggiornano in tempo reale, anche durante
  il trascinamento dei fori; tooltip al passaggio del mouse; tema chiaro e scuro):
  - **Dispersione** senza immagine: fori in mm rispetto al centro gruppo (assi con la stessa scala), cerchio del raggio medio,
    cerchio CEP tratteggiato, centro gruppo, punto di mira (o freccia verso di esso se fuori scala), esclusi tratteggiati, flyer ⚠;
  - **Istogramma delle distanze dal centro gruppo** (fori inclusi): fasce contigue di larghezza «tonda» (circa √n + 1 fasce),
    linee del raggio medio e del CEP;
  - **Orologio**: direzione di ogni colpo a ore (spicchi proporzionali al numero di colpi). Riferimento selezionabile:
    *dal punto di mira* (freccia e frase «i colpi tendono a ore N») o *dal centro gruppo* (asse di allungamento del gruppo,
    es. «ore 12–6», con il rapporto tra gli assi).
- **Pannello destro ridimensionabile**: trascinando la linea verticale di separazione (o frecce ←/→ quando è selezionata);
  doppio clic per tornare alla larghezza predefinita; la larghezza è ricordata dal browser.
- `Calc.clockHour`, `Calc.principalAxis` + 7 test (64 in totale).

## [0.8.0] - 2026-11-13
### Aggiunto
- Nuove metriche per gruppo (pannello Risultati, Result Card, testo copiato), in mm, MOA e MIL:
  - **H-spread / V-spread**: dispersione orizzontale e verticale (c-c);
  - **FOM** (Figure of Merit) = (H-spread + V-spread) / 2;
  - **SD delle distanze dal centro** (deviazione standard campionaria delle distanze dei fori dal centroide);
  - **SD radiale √(σx²+σy²)** (radial standard deviation dei software balistici);
  - **CEP, R95, R99**: raggi *previsti* che contengono il 50/95/99% dei colpi, modello circolare normale (Rayleigh):
    σ = √((σx²+σy²)/2) corretto per pochi colpi (fattore c con ν = 2(n−1)), CEP = 1,1774σ, R95 = 2,4477σ, R99 = 3,0349σ.
  Avviso di scarsa affidabilità sotto i 5 colpi.
- **Flyer**: riconoscimento automatico con criterio *leave-one-out* (ogni foro confrontato con centro e distanze degli
  altri fori; flyer se supera la distanza media di più di k SD, k = 2 regolabile in «Soglia flyer»; da 5 fori in su).
  Evidenziati con ⚠ e anello arancione. Ogni foro si può **escludere dal gruppo** (casella «Escl.» nella tabella o tasto `X`):
  i fori esclusi restano visibili (tratteggiati) ma non entrano in statistiche, centro gruppo e correzione. Undo/redo e sessione inclusi.
- Tabella punti: colonne **Da mira** e **Da centro** (distanza in mm) e **Direzione** dal centro gruppo
  (gradi in senso orario da «in alto» + sigla cardinale a 16 settori, es. «76° ENE»). Le stesse colonne nella Result Card
  del gruppo attivo (pannello di testo allargato).
- 24 nuovi test (57 in totale): Γ, fattore di correzione, σx, SD radiale, CEP/R95/R99, FOM, flyer, direzioni.
### Nota tecnica
- La regola «> 2 SD dalla media» calcolata su tutti i colpi non può scattare con 5 colpi o meno: lo scarto massimo
  possibile è (n−1)/√n (1,79 con n = 5). Per questo si usa il confronto leave-one-out.

## [0.7.0] - 2026-11-13
### Aggiunto
- **Ricarica e condizioni** (per gruppo): data, bossolo, polvere + carica in grani, palla (il calibro resta nei parametri),
  innesco, meteo, temperatura (°C), vento (velocità m/s · km/h · mph e direzione a ore), colpi sparati totali (flyer inclusi;
  il pannello mostra quanti sono esclusi dal gruppo), colpi scaldacanna, note.
  Salvati nella sessione, con undo/redo; un nuovo gruppo eredita munizione e condizioni dal gruppo attivo
  (non colpi sparati, scaldacanna e note). Riportati nella Result Card (gruppo attivo: sezione «Ricarica e condizioni»;
  tutti i gruppi: per ogni gruppo) e nel testo copiato. Le note vanno a capo automaticamente nella card.
- **Griglia angolare** opzionale in MIL o MOA (pulsante ▦ Griglia, tasto `G`, passo regolabile, default 0,1 MIL; 0,25 MOA
  passando a MOA), centrata sul punto di mira del gruppo attivo (o sul centro gruppo), posizioni esatte `D·tan(i·passo)`,
  linee marcate ogni unità intera, etichette, legenda. Richiede scala calibrata e distanza. Compare anche nella Result Card.
- **Tema scuro** opzionale (pulsante 🌙/☀️ nell'intestazione, tasto `T`); di default segue il tema del sistema,
  la scelta è ricordata dal browser. La Result Card resta su sfondo bianco (stampabile).
### Compatibilità
- Le sessioni salvate con versioni precedenti si aprono senza dati di ricarica (campi vuoti).

## [0.6.1] - 2026-11-13
### Aggiunto
- Pubblicazione su **GitHub Pages** (modalità «Deploy from a branch», `main` / root): https://rives1.github.io/Target-Analisys/
  - `index.html` nella radice del repo: reindirizza a `src/index.html` (funziona sia online sia aprendo la cartella in locale);
  - `.nojekyll`: GitHub pubblica i file così come sono, senza elaborazione Jekyll.
  Prerequisito una tantum: Settings → Pages → Source «Deploy from a branch», branch `main`, cartella `/ (root)`.

## [0.6.0] - 2026-11-13
### Cambiato
- Nome dei file salvati con data e ora in coda nel formato `AAAA-MM-GG--hh-mm` (es. `2026-10-01--22-33`), ora locale:
  Result Card `<immagine>_<gruppo>_card_2026-10-01--22-33.png`, sessione `<immagine>_2026-10-01--22-33.json`,
  testo `risultati_2026-10-01--22-33.txt`.
- Pulsante «Esporta Result Card (PNG)» e selettore «Gruppo attivo / Tutti i gruppi» spostati in cima al pannello destro,
  sotto il titolo Shoot Analyzer.
### Aggiunto
- Sezione «Punti del gruppo attivo»: indica quale gruppo è attivo (pallino colore, nome, numero di colpi).

## [0.5.0] - 2026-11-13
### Aggiunto
- Calibro: combo con i calibri più diffusi (carabina, pistola/revolver, aria compressa) e diametro nominale della palla in mm;
  inserimento manuale sempre possibile: se il valore non corrisponde a un calibro dell'elenco la combo passa a «Personalizzato».
  La scelta è salvata nella sessione e il nome del calibro compare nella Result Card e nel testo esportato.
- Result Card del gruppo attivo: tabella punti dal «Centro gruppo» in giù (X, Y in mm dal punto di mira, Click ↕ / ↔),
  presente quando la scala è calibrata e il punto di mira è impostato.
### Cambiato
- Calibro predefinito: **7,82 mm (.308")** invece di 7,62 mm. 7,62 mm è il diametro dell'anima tra i pieni;
  la palla di una .308 Win / 7,62×51 misura .308" = 7,82 mm, ed è questa che fa il foro.
### Corretto
- Intestazioni delle colonne numeriche della tabella punti allineate a destra come i valori (prima erano a sinistra).

## [0.4.0] - 2026-11-13
### Aggiunto
- Tabella «Punti del gruppo attivo»: colonne **Click ↕** e **Click ↔** con i click necessari a portare ogni foro sul punto
  di mira (in base a distanza di tiro e valore click; il valore angolare esatto è nel tooltip).
- Riga evidenziata **⊕ Centro gruppo** con coordinate e click del centroide: è la correzione da applicare alle torrette
  (i valori del singolo foro includono la dispersione casuale; la nota sotto la tabella lo ricorda).
- `Calc.correction(dx, dy, ctx)`: calcolo della correzione riutilizzabile per qualsiasi punto; `analyze` la usa per il centroide.
- 4 nuovi test (33 in totale).
### Collaudo
- Firefox: verificato dall'utente con la v0.3.0.

## [0.3.0] - 2026-11-13
### Cambiato
- **Revisione 2 della specifica**: l'applicazione è il solo file `src/index.html`, multipiattaforma.
  Eliminati il requisito `.exe` Windows x64, il wrapper Python/pywebview (ex Fase 4) e la build PyInstaller (ex Fase 5).
- `specifiche_target_analyzer.md` aggiornato di conseguenza (incluse la correzione della formula MOA e la rimozione della nota per l'AI).
- Salvataggio file: dialog nativo «Salva con nome» tramite File System Access API (Edge/Chrome), con ripiego sul download
  (Firefox/Safari). Se l'utente annulla, nessun messaggio di conferma.
- Result Card generata con `canvas.toBlob` invece di un data URL.
- Nome dei file salvati con data/ora locale (prima UTC).
### Rimosso
- Codice di aggancio a `window.pywebview`.

## [0.2.0] - 2026-11-13
### Aggiunto
- Lente di ingrandimento (×4 rispetto alla vista, mirino ciano con centro libero): visibile al passaggio del mouse
  nelle modalità Scala/Mira/Foro (attivabile/disattivabile con 🔍 o tasto `L`) e sempre attiva durante il trascinamento
  di un punto, centrata esattamente sul punto trascinato. Nella lente i fori sono disegnati solo come contorno sottile.
- Result Card: selettore «Gruppo attivo» (default) / «Tutti i gruppi»; la versione multi-gruppo mostra la rosata
  completa e un riepilogo compatto per ogni gruppo.
- Licenza MIT.

## [0.1.0] - 2026-11-13
### Aggiunto
- `src/index.html` autocontenuto: layout a due colonne (65/35), canvas con zoom (rotella, centrato sul cursore) e pan.
- Caricamento immagine da pulsante e drag & drop (JPG/PNG/WebP/BMP).
- Calibrazione scala a due punti (mm, cm, pollici).
- Gruppi multipli per immagine, ciascuno con nome, colore, punto di mira e fori.
- Punti trascinabili, eliminazione con tasto destro / Canc / tabella, "Elimina ultimo", "Elimina tutto".
- Undo/Redo a snapshot (300 livelli), scorciatoie da tastiera.
- Motore di calcolo: centroide, extreme spread c-c e bordo-bordo (con calibro), raggio medio, larghezza×altezza,
  angoli esatti (MOA, MIL, IPHY), scostamento dal punto di mira, correzione in click per asse.
- Salvataggio/caricamento sessione JSON (immagine incorporata opzionale).
- Result Card PNG del gruppo attivo e copia risultati in testo.
- Content-Security-Policy che blocca qualsiasi connessione di rete.
- Test automatici del motore di calcolo (`node tests/calc.test.js`, 29 verifiche).
