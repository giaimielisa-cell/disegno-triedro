// Sezione Esploratore: scelta del solido, schede dei metodi di
// rappresentazione, comandi di visualizzazione e rotazione libera.

const Esploratore = (function () {
  'use strict';

  const stato = {
    solidoId: 'composto-l',
    inclinato: false,
    scheda: 'ortogonali',
    assonometria: { tipo: 'libera', yaw: Geo.deg2rad(35), pitch: Geo.deg2rad(25) },
    prospettiva: { tipo: 'centrale', distanza: 140, altezza: 45, alfa: 45, x: 0 },
    sezione: {
      attiva: false, tipo: 'orizzontale', posizione: 50, inclinazione: 30,
      effettuata: false, invertito: false, veraForma: false
    },
    confronto: false,
    mostraNelloStretto: 'a',
    vistaSingola: 'prospetto',
    posizione: { allontanamento: 30, quota: 0, distanzaPL: 30 },
    opzioni: {
      spigoliNascosti: true,
      etichette: false,
      triedro: false,
      griglia: false,
      richiami: true,
      piani: false,
      resa: 'wireframe',
      lineeDiFuga: true,
      inquadraFughe: true
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
      pulsantiAsso: document.querySelectorAll('[data-asso]'),
      selettoreVista: document.getElementById('selettore-vista'),
      schema: document.getElementById('schema-disposizione'),
      pulsantiProsp: document.querySelectorAll('[data-prosp]'),
      pulsantiSez: document.querySelectorAll('[data-sez]'),
      cursoreAlfa: document.getElementById('cursore-alfa'),
      cursoreInclinazione: document.getElementById('cursore-inclinazione')
    };

    riempiElencoSolidi();
    collegaComandi();
    abilitaRotazione(el.telaA, el.svgA, () => schedaDelRiquadro('a'));
    abilitaRotazione(el.telaB, el.svgB, () => schedaDelRiquadro('b'));
    abilitaTrascinamentoProspettiva(el.svgA, () => schedaDelRiquadro('a'));
    abilitaTrascinamentoProspettiva(el.svgB, () => schedaDelRiquadro('b'));
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
    collega('opz-triedro', 'triedro');
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

    ['distanza', 'altezza', 'alfa'].forEach(nome => {
      const cursore = document.getElementById('pv-' + nome);
      const valore = document.getElementById('val-pv-' + nome);
      cursore.addEventListener('input', () => {
        stato.prospettiva[nome] = Number(cursore.value);
        valore.textContent = cursore.value;
        aggiorna();
      });
    });

    el.pulsantiProsp.forEach(b => b.addEventListener('click', () => {
      stato.prospettiva.tipo = b.dataset.prosp;
      aggiorna();
    }));

    document.getElementById('opz-fughe').addEventListener('change', e => {
      stato.opzioni.lineeDiFuga = e.target.checked;
      aggiorna();
    });

    document.getElementById('opz-inquadra-fughe').addEventListener('change', e => {
      stato.opzioni.inquadraFughe = e.target.checked;
      aggiorna();
    });


    el.pulsantiAsso.forEach(b => b.addEventListener('click', () => {
      stato.assonometria.tipo = b.dataset.asso;
      aggiorna();
    }));

    el.pulsantiSez.forEach(b => b.addEventListener('click', () => {
      stato.sezione.tipo = b.dataset.sez;
      if (!stato.sezione.attiva) {
        stato.sezione.attiva = true;
        document.getElementById('sez-attiva').checked = true;
      }
      aggiorna();
    }));

    [['sez-attiva', 'attiva'], ['sez-effettuata', 'effettuata'],
     ['sez-invertito', 'invertito'], ['sez-vera-forma', 'veraForma']].forEach(([id, chiave]) => {
      document.getElementById(id).addEventListener('change', e => {
        stato.sezione[chiave] = e.target.checked;
        aggiorna();
      });
    });

    [['sez-posizione', 'posizione'], ['sez-inclinazione', 'inclinazione']].forEach(([id, chiave]) => {
      const cursore = document.getElementById(id);
      const valore = document.getElementById('val-' + id);
      cursore.addEventListener('input', () => {
        stato.sezione[chiave] = Number(cursore.value);
        valore.textContent = cursore.value;
        aggiorna();
      });
    });

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

  function alfaCorrente() {
    return stato.prospettiva.tipo === 'centrale' ? 0 : stato.prospettiva.alfa;
  }

  function vistaProspettica() {
    const p = stato.prospettiva;
    return Geo.vistaProspettica({ x: p.x, distanza: p.distanza, altezza: p.altezza, tipo: p.tipo });
  }

  // Quale metodo mostra un riquadro: senza confronto solo il riquadro A, con
  // il confronto A = proiezioni ortogonali e B = assonometria.
  function schedaDelRiquadro(riquadro) {
    if (riquadro === 'a') return stato.scheda;
    if (!stato.confronto) return null;
    return stato.scheda === 'assonometria' ? 'ortogonali' : 'assonometria';
  }

  function abilitaRotazione(tela, svg, schedaDi) {
    let trascinando = false, ultimoX = 0, ultimoY = 0;

    svg.addEventListener('pointerdown', e => {
      const scheda = schedaDi();
      if (scheda !== 'assonometria' && scheda !== 'sezioni') return;
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

  // Trascinamento della linea d'orizzonte, del punto principale e dei punti
  // di fuga direttamente nel disegno prospettico.
  function abilitaTrascinamentoProspettiva(svg, schedaDi) {
    let elementoTrascinato = null;

    function coordinateNelDisegno(e) {
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const punto = svg.createSVGPoint();
      punto.x = e.clientX;
      punto.y = e.clientY;
      return punto.matrixTransform(ctm.inverse());
    }

    svg.addEventListener('pointerdown', e => {
      if (schedaDi() !== 'prospettiva') return;
      const nodo = e.target.closest('[data-punto]');
      if (!nodo) return;
      elementoTrascinato = nodo.dataset.punto;
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    svg.addEventListener('pointermove', e => {
      if (!elementoTrascinato) return;
      const p = coordinateNelDisegno(e);
      if (!p) return;
      e.preventDefault();
      const prospettiva = stato.prospettiva;
      if (elementoTrascinato === 'orizzonte') {
        prospettiva.altezza = Math.max(0, Math.min(160, Math.round(-p.y)));
      } else if (elementoTrascinato === 'punto-principale') {
        prospettiva.x = Math.max(-400, Math.min(400, Math.round(p.x)));
        prospettiva.xImpostato = true;
      } else {
        // spostando un punto di fuga cambia l'angolo di rotazione del solido;
        // l'altro punto di fuga si sposta di conseguenza
        const scarto = p.x - prospettiva.x;
        const alfa = elementoTrascinato === 'F1'
          ? Geo.rad2deg(Math.atan2(prospettiva.distanza, scarto))
          : Geo.rad2deg(Math.atan2(-scarto, prospettiva.distanza));
        prospettiva.alfa = Math.max(5, Math.min(85, Math.round(alfa)));
        if (prospettiva.tipo !== 'accidentale') prospettiva.tipo = 'accidentale';
      }
      sincronizzaComandiProspettiva();
      aggiorna();
    });

    const fine = e => {
      if (!elementoTrascinato) return;
      elementoTrascinato = null;
      if (svg.hasPointerCapture && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    };
    svg.addEventListener('pointerup', fine);
    svg.addEventListener('pointercancel', fine);
  }

  function sincronizzaComandiProspettiva() {
    const p = stato.prospettiva;
    ['distanza', 'altezza', 'alfa'].forEach(nome => {
      document.getElementById('pv-' + nome).value = p[nome];
      document.getElementById('val-pv-' + nome).textContent = p[nome];
    });
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
    el.pulsantiProsp.forEach(b => b.classList.toggle('attivo', b.dataset.prosp === stato.prospettiva.tipo));
    el.cursoreAlfa.hidden = stato.prospettiva.tipo === 'centrale';
    el.pulsantiSez.forEach(b => b.classList.toggle('attivo', b.dataset.sez === stato.sezione.tipo));
    el.cursoreInclinazione.hidden = stato.sezione.tipo !== 'inclinato';

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
    tela.classList.toggle('trascinabile', scheda === 'assonometria' || scheda === 'sezioni');
    const opzioni = Object.assign({}, stato.opzioni, {
      posizione: stato.posizione,
      sezione: stato.sezione
    });
    const conSezione = stato.sezione.attiva ? ' · con piano di sezione' : '';

    if (scheda === 'ortogonali') {
      if (vistaSingolaAttiva) opzioni.vistaSingola = stato.vistaSingola;
      didascalia.textContent = 'Proiezioni ortogonali — metodo europeo (primo diedro) · ' + solido.nome + conSezione;
      Disegno.disegnaProiezioniOrtogonali(svg, solido, opzioni);
    } else if (scheda === 'assonometria' || scheda === 'sezioni') {
      const vista = vistaAssonometrica();
      const etichetta = vista.tipo === 'libera' ? 'rotazione libera' : 'assonometria ' + vista.tipo;
      didascalia.textContent = scheda === 'sezioni'
        ? 'Sezione in assonometria · ' + solido.nome
        : 'Assonometria (' + etichetta + ') · ' + solido.nome + conSezione;
      Disegno.disegnaAssonometria(svg, solido, vista, opzioni);
    } else if (scheda === 'prospettiva') {
      const vista = vistaProspettica();
      opzioni.alfa = alfaCorrente();
      didascalia.textContent = 'Prospettiva ' + stato.prospettiva.tipo + ' · ' + solido.nome + conSezione;
      Disegno.disegnaProspettiva(svg, solido, vista, opzioni);
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
