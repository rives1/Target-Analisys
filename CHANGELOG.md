# Changelog

## [1.24.0] - 2026-11-24
### Aggiunto
- **Analisi di sensibilità delle conclusioni** (pannello nella pagina «📊 Grafici del gruppo», card «Robustezza delle
  conclusioni» nei Risultati in Modalità Esperto, sezione nel report PDF): le osservazioni non cambiano, si cambia
  un'ipotesi alla volta rispetto al caso base. Modello: σ senza correzione per pochi colpi (ML), normale ellittica
  (`Calc.ellipseRadius` per CEP/R95, `Calc.hitProbCov` quasi-Monte Carlo deterministico), empirico
  (`Calc.spatialMedian`, `Calc.radialQuantile`; CEP da 5 colpi, R95 da 20, probabilità da 10). Marcatura e scala:
  varianza di marcatura tolta (u, 2u), scala ± 2 incertezze. Campione: un foro alla volta, esclusi rimessi, flyer tolti.
  Livello di confidenza 90/99% per i confronti. Conclusioni: correzione in click, CEP e classe GQI, probabilità di
  colpire (cerchio/rettangolo), confronto con ciascun altro gruppo (test F in angolo). Giudizio robusta / abbastanza
  robusta / dipende dalle ipotesi con soglie dichiarate, scenario e famiglia che pesano di più, tabella degli scenari
  con i valori fuori soglia evidenziati, grafico a tornado (CEP, probabilità, click di alzo e brandeggio).
- **Variabilità dentro e tra i gruppi** (pannello nella pagina «📈 Confronto tra gruppi», card nei Risultati, sezione
  nel report): modello a effetti casuali 2D (`Calc.hierFit`, REML con profilo in forma chiusa su σ_w²), angoli dalla
  mira di ogni gruppo al netto dei click impostati foro per foro; σ_w, σ_b, quota tra gruppi (ICC), σ_tot, CEP di una
  rosata e su più rosate, GQI con σ_w e con σ_tot, test σ_b = 0 (½χ²₀ + ½χ²₁); intervalli di σ_b e ICC dal profilo
  della verosimiglianza (copertura ≈ 95% verificata in simulazione, corretti anche con σ_b stimato a zero), di σ_w e
  σ_tot da bootstrap parametrico a seme fisso (`Calc.hierBoot`). Giudizio, z dei centri, avvisi per munizioni, armi
  o distanze diverse, scelta dei gruppi con caselle, unità MIL/MOA, grafico dei centri con CEP interni, dei centri e
  complessivo.
- Help tecnico: sezioni «Analisi di sensibilità» e «Variabilità dentro e tra i gruppi».
### Corretto
- `Calc.ellipseRadius` esatta anche per ellissi degeneri (2 colpi) o molto allungate (integrazione a una variabile).

## [1.23.0] - 2026-11-24
### Aggiunto
- **Velocità per foro** («Velocità per foro (cronografo)» in «Punti del gruppo attivo»): colonna V0 nella tabella dei
  punti, nell'unità della velocità del gruppo (salvata in m/s, quindi resta giusta cambiando m/s ↔ fps); Invio passa al
  foro successivo (anche nella colonna Carica). Sotto la tabella n, media, SD (n − 1) ed ES, con «Usa come V0/SD del
  gruppo» (un solo passo di Ctrl+Z). I fori esclusi restano nelle statistiche della velocità (l'esclusione riguarda il
  punto d'impatto). Sulla foto la velocità accanto al numero del foro e «V media» nell'etichetta del group size (opzione
  «Velocità dei colpi sulla foto» in Disegni sulla foto); «V media» anche nella riga del gruppo nei Risultati e nel
  pannello in tempo reale; riga «Velocità per foro» nei dati di ricarica (report, Result Card), colonna V0 nella tabella
  dei fori del report, colonne «Velocità del foro» e «Unità velocità» in fondo al CSV dei fori.
- **Tour guidato** (🎓 nel titolo del pannello): 5 passi (foto e raddrizzamento, scala, mira e colpi, correzione,
  salvataggio) con il comando evidenziato e la pagina oscurata ma utilizzabile; ←/→ cambiano passo, Esc chiude. Al
  primo avvio un piccolo invito, una volta sola (ricordato nel browser; sparisce anche caricando una foto).
- **Provenienza dei file esportati** (Dati): autore (nel browser) e filigrana visibile facoltativa (riga in basso con
  app, autore, data, foto e inizio dell'impronta). Sempre: metadati iTXt nei PNG (Result Card, dope card, reticolo:
  Software, Author, Creation Time, Source, ShootAnalyzer:PhotoSHA256), Author e impronta nelle Info del report PDF e del
  bersaglio di prova, righe «Impronta della foto (SHA-256)» e «Autore» nella calibrazione del report, `author` e
  `image.sha256` nella sessione. L'impronta è quella della foto di lavoro (il file della sessione ZIP).
  `Calc.sha256` (FIPS 180-4, senza crypto.subtle), verificata con i vettori ufficiali e con Node.
- **Spazio di archiviazione locale** (Dati): «Verifica e misura» (spazio di foto e sessioni, stima del browser, sessioni
  e foto leggibili, foto decodificabili e delle dimensioni attese, foto orfane), «Ripara» (solo foto orfane/illeggibili e
  voci illeggibili), elenco delle sessioni archiviate con dimensione ed eliminazione singola, eliminazione delle sessioni
  più vecchie di N giorni, «Ottimizza le foto» (JPEG 0,9 alla stessa risoluzione, tenuto solo se risparmia ≥ 20%; i punti
  restano validi, si perdono EXIF e impronta originale).
### Modificato
- **Scala**: dopo il secondo punto il campo «Distanza nota tra i 2 punti» si evidenzia (contorno arancio pulsante,
  etichetta in grassetto, sezione aperta, fuoco nel campo) finché non lo si conferma o se ne esce.
- Guida rapida: 🎓 nel paragrafo «Pannello».
- Test UI: l'invito al tour è dato per visto (`addInitScript`), tranne nel test del tour.

## [1.22.0] - 2026-11-21
### Aggiunto
- **Modalità Esperto / Base** (menu in cima al pannello, ricordata nel browser, predefinita Esperto): in Base i Risultati
  mostrano solo group size (valore e angolo), correzione (con dope) e punteggio; nascosti raggio medio, CEP/R95/R99,
  forma, stabilità, vento, GQI/TQI, baseline, incertezza di misura, diagnostica, le sezioni «Indice di qualità» e
  «Probabilità di colpire», il GQI in cima al pannello e la pagina «Confronto tra gruppi» (pulsante e tasto C). La
  ricerca ignora le sezioni nascoste. Report, CSV, Result Card e testo restano completi.
- **Stima guidata del BC** (`Calc.estimateBC`, pulsante 🧮 accanto al coefficiente balistico): correzioni di alzo
  osservate a due distanze (MIL o MOA, con incertezza; precompilabili dalla Dope Card della stessa munizione), V0 fissa;
  BC ai minimi quadrati pesati con nuovo azzeramento a ogni prova, BC per singola distanza, sensibilità, incertezza
  (allargata col fattore di Birge se le distanze sono incoerenti), attendibilità, avvisi su zona transonica e distanze
  vicine all'azzeramento, confronto col BC inserito; «Usa questo BC» lo scrive nel gruppo (annullabile).
- Help tecnico: sezione «Stima del BC».
### Modificato
- **Pulsante ⊟** in cima al pannello: ora comprime/espande tutti i blocchi visibili del pannello (non più i gruppi).
- **CSV**: tipi distinti nel nome, `ShAn-CSVShots-…` e `ShAn-CSVGroups-…`.
- **Guida rapida e scorciatoie** riscritta per flusso di lavoro (9 passi, pannello, scorciatoie per categoria), senza le
  novità per versione; tolte dai dizionari EN/RU le voci della guida precedente.

## [1.21.0] - 2026-11-21
### Aggiunto
- **Dati di arma e munizione per gruppo** (Ricarica e condizioni): riquadro «Arma» (nome, altezza dell'ottica con
  unità mm/cm/in, distanza di azzeramento m/yd) e in «Munizione» coefficiente balistico con modello G1/G7, velocità
  iniziale (m/s o fps) e sua SD. Copiati nei nuovi gruppi, salvati nei profili di ricarica (il nome del profilo resta
  nel gruppo finché i dati coincidono), nel riepilogo testuale e nel report («Arma», «Balistica»), nel CSV dei gruppi
  (11 colonne in fondo, compreso il profilo) e nelle differenze tra configurazioni.
- **Due pagine** al posto della vista unica: «📊 Grafici del gruppo» (tasto A: grafici del gruppo attivo, ruota degli
  errori, reticolo) e «📈 Confronto tra gruppi» (tasto C: confronto e storico, dope card, calcolatore balistico, carica,
  correlazioni, confronto visivo, Monte Carlo). Due pulsanti in fondo al pannello, passaggio dall'una all'altra con il
  pulsante in alto o con A/C; si disegna solo la pagina aperta.
- **Calcolatore balistico semplificato** (`Calc.trajectory`): massa puntiforme, RK4, tabelle Cd(Mach) G1/G7 standard,
  densità dell'aria da temperatura/pressione/umidità (ICAO dove mancano), vento laterale e frontale dal quadrante,
  azzeramento con altezza dell'ottica. Caduta, deriva, correzioni in MIL e click, velocità, tempo di volo e Mach a una
  distanza scelta; tabella e grafico di confronto con la dope card misurata (Δ e ⚠ fuori dall'IC). Verificato contro le
  tabelle di Applied Ballistics (G1 e G7, entro 0,02 MIL fino a 1000 m) e la formula di Didion per la deriva.
- **Simulazione Monte Carlo** (`Calc.velocitySpread`): dispersione angolare intrinseca dai gruppi della munizione
  (σ combinata meno la parte della velocità alle distanze tirate) + V0 normale con la SD del cronografo; group size
  atteso per distanza (totale, solo angolo, solo velocità), σ verticale e rosata simulata alla distanza scelta.
- **Ruota degli errori per pistola** (`Calc.errorWheel`), dichiarata indicativa: 8 settori della «pie chart» NRA attorno al
  punto di mira, zona centrale = CEP del gruppo, destrorso/mancino (specchiata), settori con flyer in rosso; sovrapposta
  alla foto (casella in «Disegni sulla foto») e come grafico interattivo nella pagina del gruppo (clic = descrizione).
- **Pulsante ⊟** in cima al pannello: chiude tutti i gruppi nei Risultati, di nuovo per riaprirli.
- Help tecnico: sezioni «Calcolatore balistico», «Monte Carlo della velocità», «Ruota degli errori (pistola)».
### Modificato
- **Nomi dei file**: `ShAn-<tipo>-<arma>-<profilo di ricarica>-AAAAMMGG-hhmm.<est>` con i dati del gruppo attivo
  (Result Card di un gruppo: quel gruppo); campo vuoto = spazio tra i due «-»; caratteri non ammessi da Windows → spazi.
  Tipi: Session (ZIP e JSON), SessionDB (archivio), ResCar, PDFReport, CSV (fori e gruppi), Profiles, ResTxt,
  DopeCard (CSV e PNG), Reticle, TestTarget. Archivio, profili e bersaglio di autoverifica senza arma né profilo. Le
  cartelle dentro lo ZIP d'archivio mantengono il formato di data precedente.
- **ZIP come salvataggio principale**: `Ctrl+S` salva la sessione ZIP; nel blocco Dati il riquadro «Sessione» è il primo
  e «Salva sessione ZIP» è il pulsante blu (la Result Card non più).
- Reticolo e holdover nella pagina del gruppo; la scelta della munizione della dope resta nella pagina del confronto.
### Rimosso
- **Cono di dispersione** (pannello, report, preferenze, help): codice commentato con le istruzioni per reintrodurlo.
### Decisioni
- Il **manuale non viene più aggiornato** a ogni versione finché l'utente non lo chiede (resta quello della 1.20).
### Test
- calc: 818 verifiche (50 nuove: tabelle Cd, atmosfera, traiettorie contro AB, deriva di Didion, vento contrario, aria
  rarefatta, Monte Carlo, ruota). UI: 84 scenari (3 nuovi; il test del cono sostituito da quello della rimozione).

## [1.20.0] - 2026-11-20
### Aggiunto
- **Ricerca nelle impostazioni** (`#findBar`, fissa in cima al pannello destro; tasto `/`): cerca tra titoli di
  sezione e di riquadro, etichette, pulsanti, voci dei menu e suggerimenti (title, aria-label, segnaposto del campo
  collegato), senza maiuscole né accenti, anche nelle sezioni chiuse o nascoste dal layout; non cerca nei valori
  calcolati (risultati, tabelle, elenchi). Tutte le occorrenze in giallo tenue, la corrente in arancio, portata in
  vista con la sua sezione aperta; contatore «n / N», posizione «sezione › riquadro» e testo del suggerimento se la
  parola è solo lì. Invio/↓ successiva, Maiusc+Invio/↑ precedente (circolare), Esc azzera, secondo Esc esce. Le voci
  non applicabili in quel momento (riquadri nascosti) non contano; una sezione nascosta dal layout viene mostrata
  finché contiene l'occorrenza corrente, senza toccare il layout salvato. La ricerca si ricalcola a ogni passo e al
  cambio di lingua.
### Modificato
- **Riquadri con titolo** (come «Gestione immagine») in Calibrazione scala (scala a 2 punti, riferimento di
  controllo, scala sulla foto), Parametri di tiro (distanza/calibro/mirino, misura e statistica, disegni sulla
  foto), Ricarica e condizioni (profili, munizione, condizioni, serie e note), Indice di qualità (compattezza,
  centratura, presentazione), Zone di punteggio (bersaglio, posizione, anelli personalizzati), Probabilità di colpire
  e Dati (Result Card e report, sessione, testo/tabelle/help, archivio, autoverifica). Id dei comandi invariati; il
  livello degli intervalli di confidenza è passato accanto alla marcatura; i lucchetti di scala e riferimento sono
  ciascuno nel proprio riquadro. Le sezioni con una sola funzione (Gruppi, Risultati, Punti, Revisione, Note) restano
  com'erano.
- Casella «Scala sulla foto» → «Disegna sulla foto» (il titolo del riquadro dice già «Scala sulla foto»).
- **File di contesto ridotto**: un solo `docs/context/CONTEXT_v1.20.0.md` con la situazione attuale (niente storia
  delle versioni; decisioni vigenti in forma compatta).
### Test
- 81 scenari UI (2 nuovi: riquadri e comandi al loro posto, ancora funzionanti e tradotti; ricerca con occorrenze,
  navigazione circolare, sezione chiusa aperta, sezione nascosta mostrata e ri-nascosta, suggerimenti, accenti,
  voci non applicabili, niente risultati, inglese).

## [1.19.0] - 2026-11-20
### Aggiunto
- **Lingua russa** dell'interfaccia (menu «Русский»): dizionario `I18N.RU` con le stesse 1695 chiavi dell'inglese
  (interfaccia, risultati, grafici, guida rapida, testo copiato, Result Card, report PDF, CSV); `I18N.locale()` →
  `ru-RU` (virgola decimale, spazio delle migliaia, CSV con `;`); bussola С/В/Ю/З; nomi automatici «Группа N»;
  avviso dell'help in russo. Help tecnico e manuale restano in italiano (scelta dell'utente). Una chiave senza
  traduzione russa ricade sull'inglese e viene segnalata (`I18N.missing`).
- **Unità di lunghezza localizzate** (`uL()`, `UNIT_RU`): in russo мм, см, м, пикс., дюйм, ярд, гПа, м/с, км/ч nei
  valori composti dal codice (risultati, grafici, report, righello, scala sulla foto); MOA e MIL restano latini come
  sulle torrette (scelta dell'utente).
- **Font incorporati nel report PDF**: «SA Report Sans» Regular/Bold, sottoinsiemi di Liberation Sans 2.1.5
  (391 caratteri: latino, cirillico, greco, simboli; metriche identiche a Helvetica) in `<script id="pdf-fonts">`,
  scritti come Type0/CIDFontType2 Identity-H con ToUnicode (testo selezionabile e cercabile). Usati sempre in russo
  e, in italiano/inglese, solo se il testo contiene caratteri che WinAnsi non ha (il report viene ricostruito);
  altrimenti restano Helvetica/WinAnsi senza font incorporati. Licenza SIL OFL 1.1 in `fonts/OFL.txt`, generatore
  in `tools/pdf-fonts.py`. Nei font incorporati ⌀ diventa Ø.
### Corretto
- Il menu dei coefficienti della distorsione non cambiava lingua finché non si ricaricava la pagina.
- Report PDF: le etichette «Group size (c-c)», «Convex hull» e «H-spread / V-spread» non erano tradotte.
### Test
- `tests/i18n.test.js`: anche il dizionario russo (chiavi, segnaposto, tag e attributi tecnici invariati).
- 79 scenari UI (2 nuovi: interfaccia russa con unità, bussola, nomi, vista grafici e testi mancanti; report PDF con
  font incorporati solo quando servono e testo russo estratto tramite ToUnicode).

## [1.18.0] - 2026-11-20
### Aggiunto
- **Riepilogo della sessione in cima al pannello** (`#qiTop`, `refreshQiTop`): GQI della sessione e, se il TQI è
  acceso e calcolabile, TQI affiancato; solo punteggio, giudizio e barra delle classi (con l'IC del GQI). Nascosto con
  il GQI spento o senza gruppi validi. Un clic apre i Risultati sulla card completa. Scorre con il pannello.
- **Gruppi richiudibili nei Risultati**: clic sul titolo o ▾/▸; da chiuso resta una riga con group size, raggio medio e
  GQI. Stato per gruppo finché resta la stessa foto/sessione (`resCollapsed`, non nella storia né nel file); gruppi
  nuovi aperti.
### Cambiato
- **Result Card PNG, report PDF** e il menu «Gruppo attivo / Tutti i gruppi» spostati dalla cima del pannello alla
  sezione **Dati** (sottotitoli «Result Card e report», «Sessione ed esportazioni»).
- «Orientamento e prospettiva» → **«Gestione immagine»**, con quattro riquadri titolati (rotazione, ritaglio,
  distorsione dell'obiettivo, correzione prospettica).
- **Scala sulla foto attiva per default**, con il solo righello (le sessioni salvate mantengono la loro scelta).
- **Marcatori delle note più grandi**: pillola alta 24 px (prima 15), testo 13 px, ombra; presa su tutta la pillola
  + 5 px (prima un cerchio di 11 px dal centro); trascinando una nota su una zona la presa mantiene lo scarto, la
  nota non salta più sotto il cursore.
- Manuale d'uso 1.18 (77 pagine). Test: 77 scenari UI (4 nuovi), 768 verifiche del motore.
### Corretto
- Traduzioni inglesi mancanti di tre motivi «GQI non disponibile» (scala, distanza, centratura/pesi non validi).

## [1.17.0] - 2026-11-19
### Aggiunto
- **Baseline persistente**: rosata di riferimento scelta con ☆ dal confronto (sessione o storico) o dai risultati del
  gruppo; conservata nel browser (`localStorage` `shootAnalyzer.baseline`, metriche in `shootAnalyzer.baselineMetrics`)
  e copiata nella sessione (`baseline`). All'apertura di una sessione: adottata se il browser non ne ha una,
  altrimenti proposta («Usa questa»), mai sostituita in silenzio. Card «Rispetto alla baseline» per ogni gruppo:
  metriche scelte (group size, raggio medio, CEP, FOM, σ per asse, GQI) in angolo con Δ e Δ%, distanza e colpi dei
  due gruppi in evidenza, avvisi per distanza diversa, numero di colpi diverso (il group size cresce con n),
  condizioni diverse e registrate da una sola parte; test F bilaterale delle σ (s² angolari, ν = 2(n−1)).
  Riquadro della baseline e stella sulla riga nel confronto; linea tratteggiata ★ nell'andamento.
- **Coda di revisione** (sezione «Colpi da rivedere», ⚑ nella barra con il numero da rivedere, tasto `V`, `,`/`.`):
  fori difficili ◐, quasi sovrapposti (centri a meno di ½ calibro, servono scala e calibro) e possibili flyer
  (Mahalanobis, con p). Etichette distinte «marcatura» / «statistico». Selezionando un colpo: gruppo attivo,
  gruppo reso visibile, foro selezionato e centrato con ingrandimento (foro ≈ 90 px). Azioni: conferma, rimanda,
  correggi (snap, ◐), escludi/rimetti, elimina. Stato per foro `shot.review = {st, sig}` nella storia e nella
  sessione; se le ragioni cambiano il colpo torna da rivedere. Confermare un flyer non lo esclude.
- **Collegamento parametri ↔ immagine**: hover o fuoco su distanza della scala, riferimento, calibro, distanza di
  tiro, valore del click, marcatura e prospettiva evidenziano sulla foto punti A/B, foro reale del calibro su ogni
  foro, cerchio di 1 MIL/MOA, segmenti di un click, cerchi di incertezza al 95%, rettangolo; riga di spiegazione.
- **Selezione di un periodo** nell'andamento (trascinamento, menu «Periodo da… a…», doppio clic per annullare):
  selezione contro tutto ciò che la precede, con gruppi, colpi, date, media della metrica, σ combinato in angolo
  (ν-pesato, IC χ²) e test F; righe evidenziate nella tabella; nessun dato modificato.
- **Origine del dato** (⌖ sulle card ES, raggio medio, correzione, GQI e sulle righe bordo-bordo, H/V-spread, FOM,
  CEP, R95, R99, SD, SD radiale, convex hull): coppia dell'ES, estremi, centro con raggi, cerchi del modello e di
  riferimento, freccia di correzione, fori esclusi barrati; barra di spiegazione, `Esc` per chiudere.
### Cambiato
- **Barra principale solo a icone**, raggruppate, con tooltip «Nome: funzione (tasto)» e `aria-label`; i pulsanti del
  pannello mantengono il testo.
- Manuale d'uso 1.17 (76 pagine): barra a icone, campi collegati alla foto, ⌖, coda di revisione, baseline, periodo.
- Test: 768 verifiche del motore, 73 scenari UI (7 nuovi, con verifiche indipendenti di sovrapposizioni, coppia
  dell'ES, Δ in MIL, σ combinato e test F).

## [1.16.0] - 2026-11-19
### Aggiunto
- **Indice di qualità** (specifica «Sistema di valutazione qualitativa delle rosate»), criterio dell'app relativo a
  riferimenti scelti dall'utente, non uno standard statistico:
  - **GQI** = 100·exp[−ln(1,25)·(MR/MR_rif)²] (80 con MR = MR_rif), MR angolare = raggio medio atteso σ̂·√(π/2) del
    modello circolare normale con σ̂ corretto per pochi colpi (scelta concordata: il raggio medio misurato dal
    centroide è basso di √((n−1)/n), −18% con 3 colpi); il misurato resta mostrato. Classi Ottimo/Buono/Discreto/
    Scarso/Insufficiente sul valore non arrotondato (`Calc.QI_CLASSES`). Attendibilità separata: intervallo dal χ² del
    raggio medio, GQI_low = f(MR_high).
  - **AQI** (centratura angolare sulla mira) e **TQI** = p·GQI + (1−p)·AQI, facoltativo, pesi 70/30 modificabili.
  - **Sessione**: MR aggregato Σnᵢ·MRᵢ/Σnᵢ (in angolo, anche a distanze diverse), GQI di sessione dal MR aggregato,
    TQI di sessione sui soli gruppi con mira, gruppi esclusi con il motivo; intervallo dal σ combinato.
  - **Ripetibilità tra gruppi** (indicatore separato): dispersione dei centri rispetto alla mira, click tolti, contro
    quella attesa per caso, test F.
  - Sezione «Indice di qualità (GQI / TQI)» con riferimenti in MOA o MRAD, pesi, decimali, intervalli, classi;
    validazione dei riferimenti.
  - Card GQI/TQI nei risultati, card della sessione in fondo, colonne GQI/TQI nel confronto (storico ricalcolato
    con le impostazioni attuali, valutazione originale «orig.» conservata), report PDF, testo, CSV dei gruppi
    (GQI, GQI_Class, MR_Reference, MR_Reference_Unit, MR_GQI, AQI, D_Reference, TQI, TQI_Class,
    TQI_Weight_Precision, Quality_Index_Version), sessione JSON (parametri + istantanea `quality` con versione
    GQI-TQI/1, riferimenti, pesi, soglie e valori usati). Help tecnico e glossario.
### Cambiato
- Manuale d'uso 1.16 (68 pagine): sezione «L'indice di qualità» nel capitolo 8.
- Test: 768 verifiche del motore (i 16 test della specifica più simulazioni), 66 scenari UI.

## [1.15.0] - 2026-11-19
### Aggiunto
- **Blocco selettivo**: mira, scala (A e B insieme), riferimento di controllo e singoli fori si bloccano (🔒 nella
  tabella dei punti, pulsanti nella Calibrazione, 🔒 nella barra, tasto `K`). Un elemento bloccato non si trascina
  (si sposta la vista), non si elimina (Canc, tasto destro, ✕, «Elimina ultimo», «Tutto») e non si rifà con un nuovo
  clic della stessa modalità; selezionato mostra un lucchetto. Rotazione, prospettiva, distorsione e ritaglio lo
  trasformano comunque. Salvato nella sessione e nella storia (annullabile).
- **Gruppi nascosti** (👁 nell'elenco Gruppi): solo vista principale, lente e dettaglio; calcoli, confronto, Result
  Card e report invariati. Salvato nella sessione; un punto aggiunto al gruppo lo rende di nuovo visibile.
- **Scala sulla foto** (Calibrazione): righello graduato (lunghezza automatica o scelta, mm o pollici, angolo a scelta)
  e/o cornice con tacche e dimensioni reali dei lati; facoltativa in Result Card e report, riferita all'area ritagliata
  con le dimensioni della foto intera.
- **Alone di incertezza** dei fori (Parametri di tiro): cerchio al 95% R = u·√(−2·ln 0,05) ≈ 2,45·u con l'incertezza
  di marcatura del foro (a mano, snap, ×3 se difficile); solo grafico (`Calc.haloRadius`).
- **Note sull'immagine** (sezione nuova, strumento ✎ / tasto `N`): legate a un foro (seguono il foro; se il foro viene
  eliminato restano sulla zona) o a una zona (seguono le trasformazioni della foto); marcatori «N1, N2…» spostati dal
  punto; nel report PDF (marcatori sulla foto e sezione con i testi) se «Includi nel report PDF» è attivo.
- **Differenze tra le configurazioni** nella vista grafici: per le righe del confronto selezionate (colonna Δ) solo i
  parametri con valori diversi (componenti, distanza, condizioni, impostazioni di analisi), evidenziati allo stesso modo;
  in grigio quelli non registrati in qualche riga (`Calc.differingKeys`). Anche nel report. Le impostazioni di analisi
  sono salvate nei riepiloghi dello storico.
- **Righello libero** (📏, tasto `R`): distanza tra due punti in mm, pollici, MOA e MRAD (2·atan(L/2D) alla distanza del
  gruppo attivo) e orientamento, senza creare fori né cambiare la scala (`Calc.measureLine`).
- **Linea tratteggiata** dal primo punto della scala (e del riferimento) al cursore, con angolo dall'orizzontale e
  scarto dall'asse più vicino (verde sotto 0,5°).
- **Campo dello zoom** nella barra (percentuale, −/+, tasti `−`/`+`).
- **Finestra di dettaglio** (🔎, tasto `D`): ingrandimento fisso attorno a un punto (🎯 per sceglierlo), spostabile dalla
  barra, ridimensionabile, trascinamento e rotella all'interno; posizione, dimensioni e ingrandimento ricordati nel
  browser; l'area osservata è riquadrata sulla vista.
- **Eliminazione del riferimento di controllo** (✕ nella Calibrazione, Canc o tasto destro su un estremo); gli estremi
  ora si possono trascinare.
### Cambiato
- Colori dei gruppi senza giallo né toni chiari (contrasto ≥ 3,9:1 su bianco e beige); le sessioni salvate con i colori
  precedenti vengono rimappate all'apertura.
- Eliminare la scala non elimina più anche il riferimento di controllo.
- Manuale d'uso aggiornato alla 1.15 (`docs/manuale/Manuale_Shoot_Analyzer_v1.15.pdf`, 66 pagine): nuovo capitolo 14
  «Misurare, annotare e proteggere il lavoro», schermate rifatte con i nuovi colori.
- Test: 707 verifiche del motore, 63 scenari UI (8 nuovi, anche in inglese).
### Corretto
- La rotazione della foto non ruotava il riferimento di controllo (restava nella posizione precedente).

## [1.14.0] - 2026-11-18
### Aggiunto
- **Stabilità colpo dopo colpo** (`Calc.stability`): group size, raggio medio e centro dei primi k colpi nell'ordine di
  sparo; fascia del group size atteso per caso (2000 sequenze simulate con il σ della serie); test globale «il gruppo
  si apre» sulla frazione ES_k/ES_n con correzione per i confronti multipli (falsi allarmi ≈ 5%) e colpo dell'apertura;
  spostamento del punto d'impatto (regressione di x e y sul numero del colpo, Bonferroni). Grafici a gradini e
  traiettoria del centro nella vista grafici, scheda «Stabilità» nei risultati (da 5 colpi).
- **Ordine di sparo** modificabile con ↑/↓ nella tabella dei punti (annullabile, salvato nella sessione).
- **Report PDF con testo vero**: testo e tabelle in Helvetica/Helvetica-Bold (WinAnsi, metriche AFM, nessun font
  incorporato), selezionabili e cercabili, contenuti compressi, segnalibri, metadati (Titolo, Soggetto, Parole chiave,
  ShootAnalyzerCalibration, ShootAnalyzerModel, lingua). Nuove sezioni: Calibrazione (metodo, punti, distanza nota,
  px/mm e mm/px, incertezza e semaforo, inquadratura, verifiche, rotazione, prospettiva, distorsione, marcatura),
  Colpi analizzati (marcati, inclusi, esclusi, flyer, marcatura), Modello statistico e incertezza (σ con IC e gradi di
  libertà, coefficienti, metodi degli intervalli, test dei flyer, diagnostica, incertezza di misura, stabilità).
  Tutti i grafici: polare, densità 3D, QQ-plot, stabilità, centro colpo dopo colpo, correlazioni, cono, confronto
  visivo, reticolo.
### Cambiato
- Rettangolo di riferimento della prospettiva: il preset «Quadrato 10 × 10 mm» diventa «Quadrato 100 × 100 mm»; le
  sessioni con il vecchio preset tengono le misure e passano a «Personalizzato».
- Manuale d'uso aggiornato alla 1.14 (`docs/manuale/Manuale_Shoot_Analyzer_v1.14.pdf`, 58 pagine).
- Test: 678 verifiche del motore, 54 scenari UI (testo del PDF estratto e controllato).

## [1.13.1] - 2026-11-18
### Aggiunto
- **Manuale d'uso** in PDF (`docs/manuale/Manuale_Shoot_Analyzer_v1.13.pdf`, 52 pagine, italiano): flusso di lavoro,
  ogni sezione e campo, relazioni tra dati inseriti, risultati e grafici, lettura di ogni grafico con esempi, problemi
  frequenti e glossario; schermate dell'app reale. Sorgente e script per rigenerarlo in `docs/manuale/` (`build.sh`).
### Corretto
- La croce estesa dello strumento Mira non seguiva il cursore con la lente spenta (mancava il ridisegno al movimento).
- Test UI della croce eseguito con la lente spenta.

## [1.13.0] - 2026-11-18
### Aggiunto
- **Profili di ricarica** (Ricarica e condizioni): nome + bossolo, polvere, carica, palla, salto dalle righe, innesco e
  calibro; scelta da menu (compila il gruppo attivo e imposta il calibro), salvataggio con nome automatico, eliminazione,
  esporta/importa JSON; salvati nel browser.
- **Croce estesa** del cursore con lo strumento Mira: prolungamenti tratteggiati fino ai bordi della foto, staccati dal
  cursore.
- **Ritaglio della foto** (Orientamento) definitivo: rettangolo trascinato, rotazione/prospettiva/distorsione incorporate,
  scala invariata (1 px = 1 px), punti traslati; scala dalla prospettiva convertita in 2 punti; «Annulla ritaglio» fino
  alla foto successiva.
- **Risultati a card** (Group size, Raggio medio, Correzione, Forma, Punteggio, Vento) con «Dettagli» espandibili che
  restano aperti; titoli collegati al glossario; densità compatta = solo valori principali, dettagliata = tutto aperto.
- **Quadrante del vento** cliccabile (anche da tastiera) al posto del menu delle ore, con componenti laterale e frontale
  (`Calc.windComponents`); card «Vento» con lo scostamento orizzontale misurato (nessun calcolo di deriva).
- **Sessione ZIP**: un file con manifest, sessione JSON, foto originale, CSV e LEGGIMI; «Carica sessione», storico del
  confronto, archivio e trascinamento accettano gli ZIP (anche d'archivio e ricompressi deflate).
### Cambiato
- «Carica sessione JSON» → «Carica sessione» (.zip o .json). Help tecnico: sezione «Ritaglio, profili di ricarica e file
  ZIP»; guida rapida e traduzioni.
- Test: 655 verifiche del motore, 53 scenari UI.

## [1.12.0] - 2026-11-18
### Aggiunto
- **Etichette senza sovrapposizioni** sull'immagine: numeri dei fori, group size, scala e nomi dei gruppi scelgono tra 8
  posizioni attorno all'ancora (a tre distanze, con linea guida se allontanate) evitando fori, mira, centro, estremi della
  scala e le altre etichette.
- **Pannello in tempo reale** sull'immagine (gruppo attivo): fori, group size e raggio medio in mm e nell'unità dei
  click, avviso «meno di 5 colpi – statistiche indicative»; chiudibile, interruttore in Parametri di tiro.
- **Tooltip sul foro**: numero, distanza dalla mira (mm e angolo), direzione a ore e in gradi, click impostati, punti.
- **Doppio clic su un foro**: apre «Punti del gruppo attivo», scorre alla riga e la evidenzia.
- **Freccia di correzione** sulla foto (centro gruppo → centro previsto dopo i click arrotondati, con crocetta) e
  **correzione virtuale** (fori spostati in trasparenza; solo visualizzazione, non salvata). Nuova funzione pura
  `Calc.afterCorrection`.
- **Semaforo della calibrazione** con barra: verde ≤ ±0,5%, giallo ≤ ±1% o fori sotto 8 px, rosso oltre o con un
  controllo di scala in allarme.
- **Colonna «Effetto ES / RM»** nella tabella punti: group size e raggio medio con il foro − senza (per i fori esclusi:
  rimettendoli), rosso/verde in tempo reale, con l'avvertenza sulla selezione a posteriori. Funzione `Calc.influence`.
- **Densità delle informazioni** Compatta / Standard / Dettagliata e **layout del pannello** (⚙: ordine e visibilità delle
  sezioni), salvati nel browser.
### Cambiato
- Help tecnico: sezione «Correzione sulla foto e correzione virtuale», semaforo in «Qualità della misura», colonna Effetto
  in «Flyer ed esclusione»; guida rapida e traduzioni.
- Test: 642 verifiche del motore, 50 scenari UI.

## [1.11.0] - 2026-11-18
### Aggiunto
- **Verifica incrociata della scala**: diametro di ogni foro misurato nella foto (macchia scura senza vincolo di area,
  diametro equivalente), mediana confrontata con il calibro, allarme fuori da 70–130%; **riferimento di controllo**
  («📏»: due punti a distanza nota, es. un anello) con allarme se la differenza supera l'incertezza (k = 2). Il riferimento
  segue prospettiva, distorsione, annulla e sessione.
- **Incertezza di misura** nei risultati (simulazione): marcatura per foro (1,5 px a mano, 0,5 px con lo snap, ×3 sui
  fori segnati come difficili ◐), mira e scala → intervalli di ES, raggio medio, scostamento, σ e σ/CEP combinati con
  l'incertezza statistica. I fori ricordano se sono stati agganciati dallo snap.
- **Diagnostica del modello**: QQ-plot Rayleigh nella vista grafici e tre test con p-value per simulazione dal modello
  (adattamento Anderson–Darling, anisotropia/stringing, due centri da 8 colpi); avviso nei risultati se p < 5%, con nota
  sulla bassa potenza sotto 10 colpi.
- **ES equivalente** a 5 e 10 colpi: ES · E_m / E_n con la tabella E[ES_n]/σ (n = 2–50) calcolata per simulazione.
- **Zoom del reticolo**: rotella, trascinamento, doppio clic e pulsanti ＋ － ⟲.
### Cambiato
- **Flyer**: test di Mahalanobis leave-one-out con p-value F (previsione di Hotelling) e correzione di Bonferroni, da 5
  colpi; il criterio radiale k·SD (falsi flyer in oltre il 90% dei gruppi normali, verificato per simulazione) e il campo
  «Soglia flyer» sono stati tolti (scelta concordata).
- Help tecnico: sezioni «Verifica incrociata della scala», «Incertezza di misura», «Diagnostica del modello»,
  «ES equivalente», flyer riscritto; guida rapida e traduzioni.
- Test: 624 verifiche del motore, 47 scenari UI.

## [1.10.0] - 2026-11-18
### Aggiunto
- **Etichetta del group size** (ES centro-centro in mm e nell'unità dei click) sopra ogni gruppo, sull'immagine e nella
  Result Card; interruttore in Parametri di tiro, attiva di default.
- **Sagome** in «Zone di punteggio»: IPSC e IPSC Mini (A/C/D, fattore di potenza minor/major), IDPA (−0/−1/−3, punti
  persi, mancato = 5), silhouette metalliche pollo/maiale/tacchino/montone (pieno formato, 1/2, 1/5; ingombro IHMSA),
  zona vitale (ellisse a misura, taglie indicative 22/27/29 cm). Regola del bordo del foro per IPSC/IDPA, centro del foro
  per silhouette e zona vitale. Contorni non quotati nelle fonti ricostruiti e dichiarati approssimati (scelta concordata).
  Sagoma centrata sulla mira, **spostabile e ruotabile** per gruppo (campi numerici o «✥ Sposta col mouse», Shift = ruota).
- **Probabilità di colpire su una sagoma**: per zona, «a segno» e punti attesi per colpo, con IC (densità normale
  integrata su un raster delle zone).
- **Punteggio decimale ISSF** (fino a 10,9), nella tabella, nei totali, nel CSV e nella Result Card.
- **Correlazioni ricarica e condizioni** (vista grafici): alzo necessario vs carica e temperatura, brandeggio necessario vs
  vento trasversale, V-spread vs carica e temperatura; regressione con pendenza, IC t, p-value, R²; stessa munizione e
  distanza, anche con lo storico. **Ladder/OCW**: colonna «Carica» per foro (opzionale) e grafico per foro con media e
  IC per carica; nessun «nodo» automatico (scelta concordata).
- **Cono di dispersione** (vista grafici): σ angolare del gruppo attivo o combinata dei gruppi della munizione; mappa
  d'impatto a distanze scelte (fori e cerchi CEP/R95 alla stessa scala) e cono 3D ruotabile con colpi simulati e piani
  di sezione; distanze limitate a 2 volte la più lunga tirata (scelta concordata).
- **Correzione della distorsione dell'obiettivo** (Orientamento e prospettiva): modello radiale di Brown-Conrady (k1, k2),
  calibrazione cliccando punti lungo linee dritte (metodo «plumb line»), applicata prima di prospettiva e scala con i punti
  riportati; coefficienti scrivibili a mano e salvabili per fotocamera. Sessioni con distorsione: formato 4.
- Motore: `decimalScore`, sagome (`ipscShape`, `idpaShape`, `silShape`, `vitalShape`, `shapeZone`, `shapeRaster`,
  `rasterProbs`, `hitShapeProbability`), `linReg`, `crossWind`, `distortPoint`, `undistortPoint`, `fitLens`.
### Cambiato
- Grafici del gruppo nella vista a schermo intero: 3 per riga (2 o 1 su schermi stretti).
- CSV fori: colonna «Carica del foro (gr)».
- Help tecnico: sezioni «Sagome e punteggio decimale», «Correlazioni e ladder», «Cono di dispersione», «Distorsione
  dell'obiettivo»; guida rapida e traduzioni inglesi aggiornate.
- Test: 541 verifiche del motore, 42 scenari UI.

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
