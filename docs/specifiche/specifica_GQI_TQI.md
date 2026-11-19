# SPECIFICA DI SVILUPPO — SISTEMA DI VALUTAZIONE QUALITATIVA DELLE ROSATE

**Progetto:** Shoot Analyzer / Target-Analisys  
**Funzionalità:** Group Quality Index (GQI), Target Quality Index (TQI) e valutazione complessiva della sessione  
**Tipo di intervento:** Nuova funzionalità di analisi statistica e visualizzazione UI/UX  
**Priorità:** Alta

---

## 1. Obiettivo

Implementare in Shoot Analyzer un sistema che permetta di esprimere la qualità di una rosata mediante un unico indice numerico, compreso tra 0 e 100, accompagnato da una classificazione qualitativa.

Il sistema deve funzionare sia per un singolo gruppo di colpi sia per l'insieme dei gruppi appartenenti a una sessione.

La valutazione deve essere:

- Oggettiva rispetto ai parametri e ai riferimenti dichiarati.
- Riproducibile e matematicamente deterministica.
- Indipendente dalla distanza di tiro, utilizzando misure angolari.
- Personalizzabile attraverso valori di riferimento.
- Confrontabile tra gruppi e sessioni che utilizzano gli stessi criteri.
- Integrata nell'interfaccia esistente senza comprometterne la leggibilità.
- Compatibile con i dati delle sessioni già archiviate.

Non modificare gli algoritmi statistici esistenti se non strettamente necessario. Riutilizzare, quando possibile, le funzioni già presenti nel progetto.

## 2. Indici da implementare

Implementare due indicatori distinti:

**GQI — Group Quality Index**

Valuta esclusivamente la precisione, intesa come compattezza geometrica della rosata.

Non considera la posizione della rosata rispetto al punto di mira.

È l'indicatore predefinito.

**TQI — Target Quality Index**

Valuta sia la compattezza sia la centratura della rosata rispetto al punto di mira.

È un indicatore facoltativo, attivabile dall'utente.

Entrambi gli indicatori devono utilizzare una scala da 0 a 100.

## 3. Calcolo del Group Quality Index (GQI)

Utilizzare il Mean Radius (MR) come parametro principale.

Il Mean Radius corrisponde alla distanza media dei colpi dal centro geometrico della rosata.

Per un gruppo costituito da N colpi:

MR = (1/N) × Σ distanza(Pi, C)

Dove:

- Pi rappresenta la posizione del colpo i.
- C rappresenta il centroide dei colpi.
- N rappresenta il numero dei colpi validi.

Escludere dai calcoli i colpi che l'utente ha esplicitamente escluso dalle statistiche.

Il Mean Radius deve essere convertito in un'unità angolare, preferibilmente MOA o MRAD, utilizzando la distanza di tiro.

### 3.1 Formula GQI

Utilizzare la formula:

GQI = 100 × exp[-ln(1,25) × (MR / MR_ref)²]

Dove:

- MR è il Mean Radius angolare misurato.
- MR_ref è il Mean Radius angolare di riferimento configurato dall'utente.
- exp indica la funzione esponenziale.
- ln indica il logaritmo naturale.

La costante ln(1,25), pari a circa 0,22314355, permette di ottenere GQI = 80 quando MR coincide con MR_ref.

Il punteggio deve essere compreso tra 0 e 100.

Valori più elevati rappresentano rosate più compatte rispetto al riferimento selezionato.

**Nota:** la formula costituisce un criterio di valutazione specifico dell'applicazione e non deve essere presentata come standard statistico ufficiale.

### 3.2 Valore di riferimento

Prevedere un parametro configurabile denominato:

**Reference Mean Radius**

Valore iniziale proposto: 0,50 MOA.

Questo valore è esclusivamente un'impostazione iniziale modificabile, non un riferimento universale.

L'utente deve poter inserire il valore in MOA oppure MRAD.

Internamente, il software deve convertire i valori in un'unità angolare comune prima del calcolo.

Il riferimento deve essere strettamente maggiore di zero.

Non devono essere accettati valori nulli, negativi o non numerici.

## 4. Classificazione qualitativa

Associare automaticamente al punteggio GQI o TQI un giudizio testuale.

| Punteggio | Classificazione |
|---|---|
| 90–100 | Ottimo |
| 75–89 | Buono |
| 60–74 | Discreto |
| 40–59 | Scarso |
| 0–39 | Insufficiente |

Per evitare ambiguità dovute all'arrotondamento, utilizzare il punteggio non arrotondato per determinare la classe:

- GQI ≥ 90: Ottimo
- GQI ≥ 75 e inferiore a 90: Buono
- GQI ≥ 60 e inferiore a 75: Discreto
- GQI ≥ 40 e inferiore a 60: Scarso
- GQI inferiore a 40: Insufficiente

L'interfaccia può mostrare il punteggio arrotondato all'intero più vicino.

Le soglie devono essere memorizzate in una struttura configurabile, per consentire eventuali modifiche future senza alterare il motore di calcolo.

## 5. Calcolo del Target Quality Index (TQI)

Il TQI deve combinare precisione e accuratezza.

Utilizzare due componenti:

- GQI: indice di compattezza.
- AQI: Accuracy Quality Index, indice di centratura.

### 5.1 Calcolo dell'AQI

Calcolare la distanza angolare D tra il centro geometrico della rosata e il punto di mira.

Utilizzare la formula:

AQI = 100 × exp[-ln(1,25) × (D / D_ref)²]

Dove:

- D rappresenta la distanza angolare del centro della rosata dal punto di mira.
- D_ref rappresenta la distanza angolare di riferimento configurabile.

Valore iniziale suggerito per D_ref: 0,50 MOA.

L'AQI assume valori compresi tra 0 e 100.

Se il centro della rosata coincide con il punto di mira, AQI = 100.

Se il punto di mira non è stato definito, AQI e TQI devono risultare non disponibili, senza sostituire automaticamente il centro dell'immagine o altri riferimenti.

### 5.2 Formula TQI

TQI = (0,70 × GQI) + (0,30 × AQI)

Pesi iniziali:

- Precisione: 70%.
- Accuratezza: 30%.

Prevedere la possibilità di modificare i pesi nelle impostazioni.

La somma dei pesi deve essere sempre pari al 100%.

Il TQI deve utilizzare la stessa classificazione qualitativa del GQI.

## 6. Valutazione complessiva della sessione

Il sistema deve calcolare un GQI complessivo considerando tutti i gruppi validi appartenenti alla sessione.

### 6.1 Normalizzazione delle misure

Prima dell'aggregazione, convertire il Mean Radius di ciascun gruppo nella stessa unità angolare.

È possibile aggregare gruppi effettuati a distanze differenti, purché ogni gruppo disponga di una distanza di tiro valida e le misure siano correttamente convertite.

Non aggregare direttamente misure lineari espresse in millimetri quando le distanze di tiro sono differenti.

### 6.2 Mean Radius aggregato

Calcolare:

MR_session = Σ(Ng × MRg) / ΣNg

Dove:

- Ng rappresenta il numero di colpi validi del gruppo g.
- MRg rappresenta il Mean Radius angolare del gruppo g.
- La sommatoria comprende tutti i gruppi validi della sessione.

Il valore rappresenta la dispersione media interna ai gruppi, ponderata per il numero di colpi.

Non deve essere calcolato rispetto a un unico centroide globale, perché questo includerebbe anche gli spostamenti dei centri delle diverse rosate.

### 6.3 GQI complessivo

Applicare la formula:

GQI_session = 100 × exp[-ln(1,25) × (MR_session / MR_ref)²]

Utilizzare il medesimo valore di riferimento adottato per i singoli gruppi.

Il sistema deve visualizzare:

- GQI complessivo.
- Classificazione qualitativa.
- Mean Radius aggregato.
- Numero di gruppi considerati.
- Numero totale di colpi validi.

Il GQI della sessione non deve essere calcolato come media aritmetica dei GQI dei singoli gruppi.

### 6.4 Ripetibilità tra gruppi

La formula precedente misura la compattezza interna delle rosate, non la stabilità dei loro centri.

Non interpretare il GQI_session come misura completa della ripetibilità.

Prevedere, come possibile estensione separata, un indicatore di ripetibilità basato sulla dispersione dei centri dei gruppi.

Non incorporare automaticamente questo indicatore nel GQI.

## 7. TQI complessivo della sessione

Se la modalità TQI è attiva, calcolare anche una componente di centratura aggregata.

Per ogni gruppo determinare la distanza angolare Dg tra il centro della rosata e il relativo punto di mira.

Calcolare:

D_session = Σ(Ng × Dg) / ΣNg

Successivamente:

AQI_session = 100 × exp[-ln(1,25) × (D_session / D_ref)²]

Infine:

TQI_session = 0,70 × GQI_session + 0,30 × AQI_session

Utilizzare i pesi effettivamente configurati.

Includere nel TQI complessivo soltanto gruppi per i quali siano disponibili sia la dispersione sia la centratura.

Per evitare confronti incoerenti, GQI_session e AQI_session utilizzati per costruire il TQI devono essere calcolati sullo stesso insieme di gruppi.

Se uno o più gruppi non dispongono del punto di mira, segnalarlo esplicitamente.

Visualizzare quanti gruppi sono stati esclusi dal calcolo del TQI e per quale motivo.

## 8. Attendibilità statistica

Il punteggio GQI deve essere distinto dalla sua attendibilità statistica.

Una rosata di tre colpi e una rosata di trenta colpi possono ottenere lo stesso punteggio, ma forniscono quantità differenti di informazione sulla dispersione.

Non applicare penalizzazioni arbitrarie al GQI esclusivamente in funzione del numero dei colpi.

### 8.1 Indicatore di attendibilità

Quando tecnicamente possibile, calcolare un intervallo di confidenza per il Mean Radius.

Preferire il riutilizzo degli algoritmi statistici già implementati in Shoot Analyzer, verificandone la compatibilità con questa metrica.

In alternativa, valutare un metodo bootstrap adeguato, esplicitandone le ipotesi e i limiti, soprattutto con campioni piccoli.

L'interfaccia deve distinguere:

- Qualità della rosata: GQI.
- Solidità statistica della valutazione: indicatore separato.

Non definire un campione statisticamente affidabile unicamente sulla base di una soglia fissa di colpi.

### 8.2 Intervalli del punteggio

Se è disponibile un intervallo di confidenza valido per MR, calcolare anche il corrispondente intervallo per GQI applicando la trasformazione monotona.

Dato un intervallo [MR_low, MR_high]:

GQI_low = f(MR_high)

GQI_high = f(MR_low)

Dove f è la funzione utilizzata per calcolare il GQI.

Presentare l'intervallo come misura dell'incertezza del punteggio, specificando livello di confidenza e metodologia.

## 9. Interfaccia utente

Integrare gli indicatori nell'interfaccia esistente, evitando di creare nuove sezioni ridondanti.

### 9.1 Visualizzazione del singolo gruppo

Mostrare, preferibilmente vicino alle statistiche principali:

**GQI: 92/100 — Ottimo**

In aggiunta, fornire:

- Mean Radius misurato.
- Mean Radius di riferimento.
- Numero di colpi considerati.
- Eventuale attendibilità statistica.

Il giudizio deve essere comprensibile anche senza ricorrere esclusivamente al colore.

### 9.2 Visualizzazione della sessione

Nella sezione dedicata al riepilogo della sessione mostrare:

**Session GQI: 85/100 — Buono**

Accompagnare il risultato con:

- Mean Radius aggregato.
- Numero totale di colpi.
- Numero di gruppi validi.
- Riferimento utilizzato.

Non confondere l'indice del gruppo selezionato con quello dell'intera sessione.

### 9.3 Elementi grafici

Utilizzare un indicatore compatto, ad esempio una barra graduata o un elemento circolare.

Il punteggio numerico deve avere maggiore evidenza della rappresentazione grafica.

Evitare animazioni non necessarie.

In presenza di spazio ridotto, mantenere visibili almeno valore e classificazione testuale.

### 9.4 Informazioni contestuali

Aggiungere un tooltip o pannello informativo che spieghi:

- Il significato dell'indice.
- La statistica utilizzata.
- Il riferimento configurato.
- La formula di calcolo.
- La differenza tra precisione, accuratezza e attendibilità statistica.

Specificare chiaramente che il giudizio è relativo al riferimento scelto dall'utente.

## 10. Impostazioni

Aggiungere alle impostazioni dell'applicazione una sezione denominata:

**Quality Index Settings**

Parametri configurabili:

| Parametro | Default |
|---|---|
| GQI abilitato | Sì |
| TQI abilitato | No |
| MR di riferimento | 0,50 MOA |
| Distanza di centratura di riferimento | 0,50 MOA |
| Peso della precisione | 70% |
| Peso dell'accuratezza | 30% |
| Visualizzazione punteggio | Intero 0–100 |
| Intervalli di confidenza | Se disponibili |
| Classificazione qualitativa | Cinque classi |

Le impostazioni devono essere persistenti attraverso il sistema di salvataggio già presente.

Utilizzare le convenzioni esistenti per lingua, separatore decimale e unità di misura.

## 11. Persistenza e compatibilità

Il sistema deve mantenere compatibilità con i dati delle versioni precedenti.

I vecchi gruppi e le vecchie sessioni devono poter essere valutati automaticamente quando contengono tutti i dati necessari.

Memorizzare o rendere ricostruibili:

- Versione dell'algoritmo GQI/TQI.
- MR_ref.
- D_ref.
- Pesi del TQI.
- Soglie di classificazione.
- Valori effettivamente utilizzati nei calcoli.

Evitare di salvare esclusivamente il punteggio numerico senza i parametri che lo hanno generato.

Se un parametro di riferimento viene modificato, aggiornare i risultati nella vista corrente, ma non alterare silenziosamente la valutazione storica già archiviata.

Distinguere, ove necessario, la valutazione originale da una nuova valutazione applicata con parametri aggiornati.

## 12. Esportazione

Includere GQI e, se abilitato, TQI negli strumenti di esportazione esistenti.

### PDF

Aggiungere:

- Punteggio numerico.
- Giudizio qualitativo.
- Riferimento utilizzato.
- Numero di colpi validi.
- Eventuale intervallo di confidenza.
- Versione della formula.

### CSV

Prevedere colonne dedicate:

- GQI
- GQI_Class
- MR_Reference
- AQI
- TQI
- TQI_Class
- Quality_Index_Version

Per i valori non disponibili utilizzare una rappresentazione coerente con il formato di esportazione.

### JSON

Integrare le informazioni nel modello dati esistente, rispettando il versionamento e la compatibilità delle importazioni precedenti.

## 13. Gestione dei casi particolari

Il software deve gestire correttamente le seguenti condizioni.

**Nessun colpo valido**

Non calcolare il GQI. Visualizzare un valore non disponibile.

**Un solo colpo valido**

Non assegnare GQI = 100. Il Mean Radius sarebbe matematicamente nullo, ma un singolo colpo non consente di valutare la compattezza di un gruppo.

**Due o più colpi validi**

Consentire il calcolo del GQI, segnalando separatamente l'eventuale limitata informazione statistica.

**MR uguale a zero con almeno due colpi**

Il GQI può essere pari a 100, ma la visualizzazione deve restare coerente con la risoluzione e l'incertezza delle misurazioni.

**Distanza di tiro mancante o non valida**

Non calcolare l'indice angolare. Segnalare il dato richiesto.

**MR_ref nullo o negativo**

Bloccare il calcolo e mostrare un messaggio di validazione.

**Punto di mira mancante**

Consentire il GQI ma non il TQI.

**Gruppi esclusi**

Rispettare le stesse regole di inclusione ed esclusione utilizzate dalle statistiche esistenti.

**Sessione con gruppi non validi**

Calcolare l'indice sui soli gruppi validi e indicare chiaramente il numero di quelli esclusi.

**Gruppi a distanze diverse**

Utilizzare misure angolari normalizzate.

**Punteggi molto vicini a zero**

Conservare la precisione numerica interna. Arrotondare soltanto per la visualizzazione.

## 14. Architettura e implementazione

Prima di modificare il codice, esaminare l'architettura corrente di Shoot Analyzer.

Individuare:

- Funzioni esistenti per il Mean Radius.
- Modello dati dei gruppi.
- Modello dati delle sessioni.
- Sistema di gestione delle impostazioni.
- Componenti UI per le statistiche.
- Funzioni di esportazione.
- Suite di test esistente.

Implementare i nuovi calcoli attraverso funzioni pure e indipendenti dall'interfaccia, riutilizzabili sia per le singole rosate sia per le sessioni.

Evitare duplicazioni del calcolo del Mean Radius.

Non introdurre nuove librerie esterne se la funzionalità può essere realizzata con le dipendenze già presenti.

Mantenere le caratteristiche di funzionamento locale e offline dell'applicazione.

Non alterare i risultati statistici esistenti.

## 15. Test obbligatori

Creare test automatici per verificare le seguenti condizioni.

### Test GQI

1. MR = 0 con almeno due colpi validi → GQI = 100.
2. MR = MR_ref → GQI = 80.
3. MR inferiore a MR_ref → GQI maggiore di 80.
4. MR superiore a MR_ref → GQI inferiore a 80.
5. Aumentando MR a riferimento costante, GQI deve diminuire.
6. Modificando unità da MOA a MRAD senza cambiare il valore fisico, GQI deve rimanere invariato.
7. Il punteggio deve sempre rimanere nell'intervallo [0,100].

### Test TQI

8. GQI = 100 e AQI = 100 → TQI = 100.
9. Con pesi 70/30, GQI = 80 e AQI = 100 → TQI = 86.
10. Il cambiamento dei pesi deve modificare correttamente TQI.
11. Senza punto di mira, TQI non deve essere calcolato.

### Test sessione

12. Il Mean Radius aggregato deve essere ponderato per il numero dei colpi.
13. Il GQI della sessione deve derivare dal MR aggregato e non dalla media dei punteggi.
14. Gruppi con distanze differenti devono essere normalizzati prima dell'aggregazione.
15. I colpi esclusi devono essere ignorati correttamente.
16. Per il TQI devono essere utilizzati insiemi coerenti di gruppi.

### Test compatibilità

17. Le sessioni precedenti devono continuare a caricarsi.
18. Le esportazioni devono includere correttamente i nuovi campi.
19. Le impostazioni salvate devono essere ripristinate.
20. La nuova funzionalità non deve alterare le misure o le statistiche preesistenti.

Utilizzare una tolleranza numerica adeguata nei test che coinvolgono funzioni esponenziali e conversioni angolari.

## 16. Criteri di accettazione

La funzionalità sarà considerata completata quando:

- Ogni rosata valida mostra il proprio GQI.
- Ogni sessione con almeno un gruppo valido mostra il GQI complessivo.
- I punteggi sono coerenti con le formule definite.
- I giudizi qualitativi sono assegnati correttamente.
- I riferimenti possono essere configurati.
- Il TQI può essere abilitato o disabilitato.
- I calcoli rispettano i colpi esclusi.
- I valori rimangono coerenti cambiando unità di misura.
- Le informazioni sono disponibili nelle esportazioni previste.
- Le sessioni storiche rimangono compatibili.
- L'interfaccia distingue il punteggio dalla sua attendibilità.
- Tutti i test automatici pertinenti risultano superati.

## 17. Indicazioni finali per l'IA sviluppatrice

Implementare questa funzionalità seguendo le convenzioni architetturali, grafiche e di codifica già presenti nel repository Shoot Analyzer.

Prima di intervenire, verificare se alcune parti della funzionalità siano già implementate e riutilizzarle.

Non modificare funzionalità esistenti non correlate alla richiesta.

Non presentare GQI e TQI come standard scientifici ufficiali: sono indicatori sintetici relativi a soglie di riferimento configurabili.

Privilegiare chiarezza, correttezza matematica, facilità di manutenzione e compatibilità con le sessioni esistenti.

Aggiornare documentazione, changelog e test secondo le convenzioni del progetto.

Il risultato finale deve consentire all'utente di comprendere immediatamente quanto una rosata sia compatta rispetto a un riferimento scelto, quanto sia centrata quando viene abilitato il TQI e quanto siano solide le informazioni statistiche disponibili.

**Risultato atteso:** un indicatore numerico e qualitativo semplice da leggere, ma basato su calcoli trasparenti, verificabili e coerenti con il sistema statistico di Shoot Analyzer.