# Regole del progetto

Questo repository è pubblico ed è pubblicato con GitHub Pages:
https://giaimielisa-cell.github.io/disegno-triedro/

## Come si lavora

- **Sito statico**: solo HTML, CSS e JavaScript. Nessun passaggio di build.
- **Nessuna risorsa esterna, senza eccezioni**: né librerie, né caratteri, né
  immagini prese altrove. Il sito deve aprirsi e funzionare anche senza
  collegamento a internet. Per il testo si usano solo caratteri **a bastoni
  già presenti sul computer** (la variabile `--bastoni` in cima al foglio di
  stile): niente Google Fonts.
- **`index.html`** nella cartella principale, e solo percorsi relativi (deve
  funzionare su GitHub Pages).
- Commit piccoli e frequenti, con messaggi in italiano che spiegano cosa è
  cambiato.
- Usa sempre `git` da riga di comando, mai `gh` (non è installata). Prima di
  ogni `git push` chiedi conferma.
- Spiega ogni azione con parole semplici: l'utente non è un programmatore.
- Repository pubblico: niente dati personali reali di studenti (nomi, foto,
  voti, ecc.).
- Per provare le modifiche in locale serve un piccolo server (il sito non
  funziona aperto come file). Non ci sono Python né Node su questa macchina:
  si usa un server PowerShell sulla porta 8123 e si apre
  `http://localhost:8123/index.html`.

## Com'è fatta l'applicazione

Il solido è definito una volta sola (vertici + facce, in `js/solidi.js`) e
**tutte le viste nascono da quegli stessi dati**, cambiando solo la proiezione.
Chi modifica il codice non deve mai disegnare una vista "a mano": deve
cambiare la proiezione.

- `js/geometria.js` — proiezioni, spigoli nascosti, punti di fuga.
- `js/solidi.js` — i solidi e l'ordine dei vertici.
- `js/sezione.js` — taglio del solido, vera forma, ribaltamenti.
- `js/disegno.js` — tutto ciò che finisce sul foglio.
- `js/esploratore.js`, `js/palestra.js` — le due sezioni; `js/app.js` le avvia.
- `js/accessibilita.js` — dimensione del testo, interlinea, spaziatura,
  lettura ad alta voce.

## Convenzioni di disegno da non cambiare

Sono costate parecchie correzioni: vanno rispettate in **tutti** i metodi.

- **Metodo europeo, primo triedro.** Il solido sta nell'ottante con x, y, z
  tutte positive: il P.O. è il piano z = 0, il P.V. il piano y = 0, il P.L. il
  piano x = 0.
- **L'osservatore guarda da y positivo**, quindi sul foglio l'asse x va verso
  **sinistra**. Di conseguenza: prospetto in alto a sinistra, pianta sotto,
  vista da sinistra a destra; in assonometria il P.V. cade sempre a sinistra e
  il P.L. a destra, senza correzioni.
- **Prospettiva**: punto di vista → quadro → oggetto (l'oggetto sta oltre il
  quadro).
- **Ribaltamento con archi di circonferenza**, non con la retta a 45°.
- **Fra parentesi solo gli elementi ribaltati**; `≡` per i punti che cadono
  nello stesso posto. Le etichette non devono sovrapporsi né al disegno né fra
  loro.
- **Ordine delle lettere dei vertici**: si parte dalla faccia inferiore e si
  sale di quota in quota, girando in senso antiorario come si vede in pianta e
  cominciando dal vertice davanti a sinistra. Nel cubo: A B C D sotto, E F G H
  sopra, con E sopra ad A. L'ordine sta nell'array dei vertici, quindi vale
  automaticamente in ogni vista.
- **Linee di richiamo**: sottili e continue. Spigoli nascosti tratteggiati.
- La **superficie sezionata** si distingue per colore nella resa ombreggiata e
  resta tratteggiata a 45°.

## Grafica

Colori e caratteri stanno tutti nelle variabili in cima a `css/stile.css`:
si cambia lì, non nelle singole regole.

- Fondo carta `#FAF6EE` per l'involucro; **area di disegno e barre dei
  selettori restano bianche**.
- Accento `#8C5A63` per i comandi. Un colore per sezione (Esploratore
  `#3E6068`, Palestra `#A24E36`) e uno per metodo (proiezioni `#5C7A8A`,
  assonometria `#7C8B6E`, prospettiva `#A98A3E`, sezioni `#B8794F`).
- I colori del **disegno tecnico** restano quelli della tavola: l'accento non
  entra nel disegno.
- Le card degli esercizi hanno il bordo a tratto di matita, con almeno 14px di
  margine attorno.

## Accessibilità: non toglierla

- **Dimensione del testo, interlinea e spaziatura** sono tre comandi
  indipendenti: uno studente può volerne uno solo.
- **Lettura ad alta voce** delle consegne della Palestra: spenta di norma, è
  l'unico suono dell'applicazione.
- Le scelte restano memorizzate nel browser dello studente.
