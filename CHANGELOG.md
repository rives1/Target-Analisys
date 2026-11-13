# Changelog

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
