// Sezione Esploratore: scelta del solido, schede dei metodi di
// rappresentazione, comandi di visualizzazione e rotazione libera.

const Esploratore = (function () {
  'use strict';

  const stato = {
    solidoId: 'composto-l',
    inclinato: false,
    scheda: 'ortogonali',
    assonometria: { tipo: 'libera', yaw: Geo.deg2rad(35), pitch: Geo.deg2rad(25) },
    confronto: false,
    mostraNelloStretto: 'a',
    vistaSingola: 'prospetto',
    posizione: { allontanamento: 30, quota: 0, distanzaPL: 30 },
    opzioni: {
      spigoliNascosti: true,
      etichette: false,
      assi: false,
      griglia: false,
      richiami: true,
      piani: false,
      resa: 'wireframe'
    }
  };

  const ORIENTAMENTI_EQUIVALENTI = {
    isometrica: { yaw: Geo.deg2rad(45), pitch: Geo.deg2rad(35.26) },
    cavaliera: { yaw: Geo.deg2rad(25), pitch: Geo.deg2rad(20) },
    monometrica: { yaw: Geo.deg2rad(20), pitch: Geo.deg2rad(15) }
  };

  let el = {};
  const schermoStretto = window.matchMedia('(max-width: 860px)');

  function avvia() {
    el = {
      scelta: document.getElementById('scelta-solido'),
      inclinato: document.getElementById('solido-inclinato'),
      schede: document.querySelectorAll('.schede button'),
      telaA: document.getElementById('tela-a'),
      telaB: document.getElementById('tela-b'),
      svgA: document.getElementById('svg-a'),
      svgB: document.getElementById('svg-b'),
      didascaliaA: document.getElementById('didascalia-a'),
      didascaliaB: document.getElementById('didascalia-b'),
      pannello: document.getElementById('pannello'),
      apriPannello: document.getElementById('apri-pannello'),
      chiudiPannello: document.getElementById('chiudi-pannello'),
      letturaAssi: document.getElementById('lettura-assi'),
      notaAssonometria: document.getElementById('nota-assonometria'),
      alternanza: document.getElementById('alternanza'),
      pulsantiAsso: document.querySelectorAll('.pulsanti-tipo button'),
      selettoreVista: document.getElementById('selettore-vista'),
      schema: document.getElementById('schema-disposizione')
    };

    riempiElencoSolidi();
    collegaComandi();
    abilitaRotazione(el.telaA, el.svgA, () => schedaDelRiquadro('a'));
    abilitaRotazione(el.telaB, el.svgB, () => schedaDelRiquadro('b'));
    schermoStretto.addEventListener('change', aggiorna);
    window.addEventListener('resize', ridisegnaDifferito);
    aggiorna();
  }

  function riempiElencoSolidi() {
    const categorie = [];
    Solidi.CATALOGO.forEach(v => { if (!categorie.includes(v.categoria)) categorie.push(v.categoria); });
    categorie.forEach(cat => {
      const gruppo = document.createElement('optgroup');
      gruppo.label = cat;
      Solidi.CATALOGO.filter(v => v.categoria === cat).forEach(v => {
        const o = document.createElement('option');
        o.value = v.id;
        o.textContent = v.nome;
        gruppo.appendChild(o);
      });
      el.scelta.appendChild(gruppo);
    });
    el.scelta.value = stato.solidoId;
  }

  function collegaComandi() {
    el.scelta.addEventListener('change', () => { stato.solidoId = el.scelta.value; aggiorna(); });
    el.inclinato.addEventListener('change', () => { stato.inclinato = el.inclinato.checked; aggiorna(); });

    el.schede.forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      stato.scheda = b.dataset.scheda;
      aggiorna();
    }));

    const collega = (id, chiave) => {
      const input = document.getElementById(id);
      input.addEventListener('change', () => { stato.opzioni[chiave] = input.checked; aggiorna(); });
    };
    collega('opz-nascosti', 'spigoliNascosti');
    collega('opz-etichette', 'etichette');
    collega('opz-assi', 'assi');
    collega('opz-griglia', 'griglia');
    collega('opz-richiami', 'richiami');
    collega('opz-piani', 'piani');

    ['allontanamento', 'quota', 'distanzaPL'].forEach(nome => {
      const cursore = document.getElementById('pos-' + nome);
      const valore = document.getElementById('val-' + nome);
      cursore.addEventListener('input', () => {
        stato.posizione[nome] = Number(cursore.value);
        valore.textContent = cursore.value;
        aggiorna();
      });
    });

    document.getElementById('opz-ombreggiato').addEventListener('change', e => {
      stato.opzioni.resa = e.target.checked ? 'ombreggiato' : 'wireframe';
      aggiorna();
    });

    document.getElementById('opz-confronto').addEventListener('change', e => {
      stato.confronto = e.target.checked;
      aggiorna();
    });

    el.pulsantiAsso.forEach(b => b.addEventListener('click', () => {
      stato.assonometria.tipo = b.dataset.asso;
      aggiorna();
    }));

    el.alternanza.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      stato.mostraNelloStretto = b.dataset.mostra;
      aggiorna();
    }));

    el.selettoreVista.querySelectorAll('.scelta-viste button').forEach(b => b.addEventListener('click', () => {
      stato.vistaSingola = b.dataset.vista;
      aggiorna();
    }));

    el.apriPannello.addEventListener('click', () => el.pannello.classList.add('aperto'));
    el.chiudiPannello.addEventListener('click', () => el.pannello.classList.remove('aperto'));
  }

  function solidoCorrente() {
    return Solidi.ottieni(stato.solidoId, stato.inclinato);
  }

  function vistaAssonometrica() {
    const a = stato.assonometria;
    if (a.tipo === 'libera') return Geo.vistaAssonometricaLibera(a.yaw, a.pitch);
    return Geo.vistaAssonometricaDiretta(Geo.TIPI_ASSONOMETRIA[a.tipo]);
  }

  // Quale metodo mostra un riquadro: senza confronto solo il riquadro A, con
  // il confronto A = proiezioni ortogonali e B = assonometria.
  function schedaDelRiquadro(riquadro) {
    if (!stato.confronto) return riquadro === 'a' ? stato.scheda : null;
    return riquadro === 'a' ? 'ortogonali' : 'assonometria';
  }

  function abilitaRotazione(tela, svg, schedaDi) {
    let trascinando = false, ultimoX = 0, ultimoY = 0;

    svg.addEventListener('pointerdown', e => {
      if (schedaDi() !== 'assonometria') return;
      trascinando = true;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      svg.setPointerCapture(e.pointerId);
      tela.classList.add('in-trascinamento');
      if (stato.assonometria.tipo !== 'libera') {
        const equivalente = ORIENTAMENTI_EQUIVALENTI[stato.assonometria.tipo];
        stato.assonometria.yaw = equivalente.yaw;
        stato.assonometria.pitch = equivalente.pitch;
        stato.assonometria.tipo = 'libera';
        aggiorna();
      }
    });

    svg.addEventListener('pointermove', e => {
      if (!trascinando) return;
      e.preventDefault();
      const dx = e.clientX - ultimoX, dy = e.clientY - ultimoY;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      stato.assonometria.yaw += dx * 0.01;
      stato.assonometria.pitch = Math.max(Geo.deg2rad(-88), Math.min(Geo.deg2rad(88), stato.assonometria.pitch + dy * 0.01));
      aggiorna();
    });

    const fine = e => {
      if (!trascinando) return;
      trascinando = false;
      tela.classList.remove('in-trascinamento');
      if (svg.hasPointerCapture && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    };
    svg.addEventListener('pointerup', fine);
    svg.addEventListener('pointercancel', fine);
  }

  let attesaRidisegno = null;
  function ridisegnaDifferito() {
    clearTimeout(attesaRidisegno);
    attesaRidisegno = setTimeout(aggiorna, 120);
  }

  function aggiorna() {
    const solido = solidoCorrente();

    el.schede.forEach(b => b.classList.toggle('attivo', b.dataset.scheda === stato.scheda));
    el.pulsantiAsso.forEach(b => b.classList.toggle('attivo', b.dataset.asso === stato.assonometria.tipo));

    const stretto = schermoStretto.matches;
    const schedaA = schedaDelRiquadro('a');
    const schedaB = schedaDelRiquadro('b');

    const vistaSingolaAttiva = stretto && (schedaA === 'ortogonali' || schedaB === 'ortogonali');
    el.selettoreVista.hidden = !vistaSingolaAttiva;
    el.selettoreVista.querySelectorAll('.scelta-viste button').forEach(b => b.classList.toggle('attivo', b.dataset.vista === stato.vistaSingola));
    el.schema.querySelectorAll('rect').forEach(r => r.classList.toggle('attiva', r.dataset.riquadro === stato.vistaSingola));

    el.alternanza.hidden = !(stato.confronto && stretto);
    el.alternanza.querySelectorAll('button').forEach(b => b.classList.toggle('attivo', b.dataset.mostra === stato.mostraNelloStretto));

    const mostraA = !stato.confronto || !stretto || stato.mostraNelloStretto === 'a';
    const mostraB = stato.confronto && (!stretto || stato.mostraNelloStretto === 'b');
    el.telaA.classList.toggle('nascosta', !mostraA);
    el.telaB.classList.toggle('nascosta', !mostraB);

    document.querySelectorAll('.pannello fieldset[data-scheda]').forEach(f => {
      const pertinente = f.dataset.scheda === schedaA || f.dataset.scheda === schedaB;
      f.hidden = !pertinente;
    });

    if (mostraA) disegnaRiquadro(el.telaA, el.svgA, el.didascaliaA, schedaA, solido, vistaSingolaAttiva);
    if (mostraB) disegnaRiquadro(el.telaB, el.svgB, el.didascaliaB, schedaB, solido, vistaSingolaAttiva);

    aggiornaLetturaAssi();
  }

  function disegnaRiquadro(tela, svg, didascalia, scheda, solido, vistaSingolaAttiva) {
    tela.classList.toggle('trascinabile', scheda === 'assonometria');
    if (scheda === 'ortogonali') {
      const opzioni = Object.assign({}, stato.opzioni, { posizione: stato.posizione });
      if (vistaSingolaAttiva) opzioni.vistaSingola = stato.vistaSingola;
      didascalia.textContent = 'Proiezioni ortogonali — metodo europeo (primo diedro) · ' + solido.nome;
      Disegno.disegnaProiezioniOrtogonali(svg, solido, opzioni);
    } else if (scheda === 'assonometria') {
      const vista = vistaAssonometrica();
      const etichetta = vista.tipo === 'libera' ? 'rotazione libera' : 'assonometria ' + vista.tipo;
      didascalia.textContent = 'Assonometria (' + etichetta + ') · ' + solido.nome;
      Disegno.disegnaAssonometria(svg, solido, vista, stato.opzioni);
    }
  }

  function aggiornaLetturaAssi() {
    const vista = vistaAssonometrica();
    const righe = ['x', 'y', 'z'].map(nome => {
      const a = vista.assi[nome];
      return '<div><span>asse ' + nome + '</span><span>' +
        a.angolo.toFixed(1).replace('.', ',') + '°  ·  k = ' +
        a.k.toFixed(2).replace('.', ',') + '</span></div>';
    }).join('');
    el.letturaAssi.innerHTML = righe;
    el.notaAssonometria.textContent = vista.nota || '';
  }

  return { avvia, stato };
})();
