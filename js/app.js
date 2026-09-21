// Avvio dell'applicazione e passaggio tra le sezioni principali.

(function () {
  'use strict';

  function mostraSezione(nome) {
    document.getElementById('sezione-esploratore').hidden = nome !== 'esploratore';
    document.getElementById('sezione-palestra').hidden = nome !== 'palestra';
    document.querySelectorAll('.menu-principale button').forEach(b => {
      b.classList.toggle('attivo', b.dataset.sezione === nome);
    });
  }

  document.querySelectorAll('.menu-principale button').forEach(b => {
    b.addEventListener('click', () => mostraSezione(b.dataset.sezione));
  });

  Esploratore.avvia();
})();
