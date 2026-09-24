// Avvio dell'applicazione e passaggio tra le sezioni principali.

(function () {
  'use strict';

  function mostraSezione(nome) {
    document.getElementById('sezione-esploratore').hidden = nome !== 'esploratore';
    document.getElementById('sezione-palestra').hidden = nome !== 'palestra';
    document.querySelectorAll('.menu-principale button[data-sezione]').forEach(b => {
      b.classList.toggle('attivo', b.dataset.sezione === nome);
    });
  }

  // nella barra c'è anche il pulsante della leggibilità, che non è una sezione
  document.querySelectorAll('.menu-principale button[data-sezione]').forEach(b => {
    b.addEventListener('click', () => mostraSezione(b.dataset.sezione));
  });

  Esploratore.avvia();
  Palestra.avvia();
})();
