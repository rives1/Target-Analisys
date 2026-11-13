# Changelog

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
