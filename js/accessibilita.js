// Aiuti alla lettura. Sono tre cose indipendenti fra loro, perché ciascuno
// prenda solo quella che gli serve:
//   - alto contrasto (fondo nero, testo giallo);
//   - dimensione del testo, interlinea e spaziatura fra le lettere;
//   - lettura ad alta voce delle consegne della Palestra.
// Le scelte restano memorizzate in questo browser, così allo studente non
// tocca rifarle ogni volta.

(function () {
  'use strict';

  const CHIAVE = 'triedro-leggibilita';

  const PREDEFINITE = {
    contrasto: false,
    dimensione: 15,
    interlinea: 1.4,
    spaziatura: 0,
    voce: false
  };

  let stato = Object.assign({}, PREDEFINITE);

  const el = {};

  function leggiMemoria() {
    try {
      const salvato = window.localStorage.getItem(CHIAVE);
      if (salvato) stato = Object.assign({}, PREDEFINITE, JSON.parse(salvato));
    } catch (e) {
      // se il browser non permette la memoria locale si parte dai valori normali
    }
  }

  function scriviMemoria() {
    try {
      window.localStorage.setItem(CHIAVE, JSON.stringify(stato));
    } catch (e) { /* niente memoria: le scelte valgono per questa visita */ }
  }

  function numeroItaliano(n, decimali) {
    return n.toFixed(decimali).replace('.', ',');
  }

  // --- Lettura ad alta voce ---

  const vocePossibile = 'speechSynthesis' in window;
  let ultimaConsegna = '';

  function zittisci() {
    if (vocePossibile) window.speechSynthesis.cancel();
  }

  function leggi(testo) {
    if (!vocePossibile || !stato.voce || !testo) return;
    zittisci();
    const frase = new window.SpeechSynthesisUtterance(testo);
    frase.lang = 'it-IT';
    frase.rate = 0.95;
    window.speechSynthesis.speak(frase);
  }

  // La consegna cambia quando la Palestra passa a un nuovo esercizio: si resta
  // in ascolto del testo, senza toccare il funzionamento della Palestra.
  function seguiLeConsegne() {
    const domanda = document.getElementById('domanda');
    if (!domanda || !window.MutationObserver) return;
    const osservatore = new window.MutationObserver(() => {
      const testo = domanda.textContent.trim();
      if (!testo || testo === ultimaConsegna) return;
      ultimaConsegna = testo;
      leggi(testo);
    });
    osservatore.observe(domanda, { childList: true, characterData: true, subtree: true });
  }

  // --- Applicazione delle scelte ---

  function applica() {
    const radice = document.documentElement;
    radice.style.setProperty('--testo-base', stato.dimensione + 'px');
    radice.style.setProperty('--interlinea', String(stato.interlinea));
    radice.style.setProperty('--spaziatura', stato.spaziatura + 'px');
    document.body.classList.toggle('alto-contrasto', stato.contrasto);

    if (el.contrasto) el.contrasto.checked = stato.contrasto;
    if (el.voce) el.voce.checked = stato.voce;
    if (el.dimensione) {
      el.dimensione.value = stato.dimensione;
      el.valDimensione.textContent = stato.dimensione;
    }
    if (el.interlinea) {
      el.interlinea.value = stato.interlinea;
      el.valInterlinea.textContent = numeroItaliano(stato.interlinea, 1);
    }
    if (el.spaziatura) {
      el.spaziatura.value = stato.spaziatura;
      el.valSpaziatura.textContent = numeroItaliano(stato.spaziatura, 1).replace(',0', '');
    }
    if (!stato.voce) zittisci();
  }

  function cambia(chiave, valore) {
    stato[chiave] = valore;
    applica();
    scriviMemoria();
  }

  function apriPannello(aperto) {
    el.pannello.hidden = !aperto;
    el.apri.setAttribute('aria-expanded', aperto ? 'true' : 'false');
  }

  function avvia() {
    el.apri = document.getElementById('apri-leggibilita');
    el.chiudi = document.getElementById('chiudi-leggibilita');
    el.pannello = document.getElementById('pannello-leggibilita');
    el.contrasto = document.getElementById('opz-contrasto');
    el.voce = document.getElementById('opz-voce');
    el.notaVoce = document.getElementById('nota-voce');
    el.dimensione = document.getElementById('acc-dimensione');
    el.interlinea = document.getElementById('acc-interlinea');
    el.spaziatura = document.getElementById('acc-spaziatura');
    el.valDimensione = document.getElementById('val-acc-dimensione');
    el.valInterlinea = document.getElementById('val-acc-interlinea');
    el.valSpaziatura = document.getElementById('val-acc-spaziatura');
    el.azzera = document.getElementById('azzera-leggibilita');
    if (!el.apri || !el.pannello) return;

    leggiMemoria();

    el.apri.addEventListener('click', () => apriPannello(el.pannello.hidden));
    el.chiudi.addEventListener('click', () => apriPannello(false));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !el.pannello.hidden) apriPannello(false);
    });

    el.contrasto.addEventListener('change', e => cambia('contrasto', e.target.checked));
    el.dimensione.addEventListener('input', e => cambia('dimensione', Number(e.target.value)));
    el.interlinea.addEventListener('input', e => cambia('interlinea', Number(e.target.value)));
    el.spaziatura.addEventListener('input', e => cambia('spaziatura', Number(e.target.value)));

    if (vocePossibile) {
      el.voce.addEventListener('change', e => {
        cambia('voce', e.target.checked);
        // dando il consenso si sente subito la consegna già a schermo
        if (e.target.checked) {
          const domanda = document.getElementById('domanda');
          if (domanda) leggi(domanda.textContent.trim());
        }
      });
      seguiLeConsegne();
    } else {
      el.voce.disabled = true;
      stato.voce = false;
      el.notaVoce.textContent = 'Questo browser non sa leggere ad alta voce.';
    }

    el.azzera.addEventListener('click', () => {
      stato = Object.assign({}, PREDEFINITE);
      applica();
      scriviMemoria();
    });

    applica();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', avvia);
  } else {
    avvia();
  }
})();
