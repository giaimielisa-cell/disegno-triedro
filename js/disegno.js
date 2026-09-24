// Disegno delle viste in SVG, con le convenzioni del disegno tecnico:
// linea continua grossa per gli spigoli in vista, tratteggio per i nascosti,
// tratto-punto per assi e linee di richiamo.

const Disegno = (function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const LETTERE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function el(nome, attributi) {
    const e = document.createElementNS(NS, nome);
    for (const k in attributi) e.setAttribute(k, attributi[k]);
    return e;
  }

  function svuota(nodo) { while (nodo.firstChild) nodo.removeChild(nodo.firstChild); }

  function linea(x1, y1, x2, y2, classe) {
    return el('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: classe });
  }

  function limiti(solido) {
    const v = solido.vertici;
    return {
      x0: Math.min(...v.map(p => p[0])), x1: Math.max(...v.map(p => p[0])),
      y0: Math.min(...v.map(p => p[1])), y1: Math.max(...v.map(p => p[1])),
      z0: Math.min(...v.map(p => p[2])), z1: Math.max(...v.map(p => p[2]))
    };
  }

  // --- Sezione ---

  // Se la sezione è attiva prepara il solido tagliato e i contorni della
  // figura di sezione; altrimenti restituisce il solido intero.
  function applicaSezione(solido, opzioni) {
    const s = opzioni.sezione;
    if (!s || !s.attiva) return { solido: solido, piano: null, anelli: null };
    const piano = Sezione.piano(solido, s);
    const taglio = Sezione.taglia(solido, piano);
    return {
      solido: s.effettuata ? taglio.solido : solido,
      piano: piano,
      anelli: s.effettuata ? taglio.anelli : null
    };
  }

  function trasformaAnelli(anelli, f) {
    return anelli ? anelli.map(a => a.map(f)) : null;
  }

  // Tratteggio a 45° della figura di sezione, ritagliato sul contorno con la
  // regola pari-dispari (vale anche per sezioni con più contorni o con fori).
  function disegnaTratteggio(gruppo, anelli2D, passo) {
    const dir = [Math.SQRT1_2, -Math.SQRT1_2];      // 45° verso l'alto a destra
    const perp = [-dir[1], dir[0]];
    const proiezioni = [];
    anelli2D.forEach(a => a.forEach(p => proiezioni.push(p[0] * perp[0] + p[1] * perp[1])));
    if (!proiezioni.length) return;
    const minimo = Math.min(...proiezioni), massimo = Math.max(...proiezioni);
    if (massimo - minimo < 1e-6) return;
    const numero = Math.min(240, Math.ceil((massimo - minimo) / passo));
    const passoEffettivo = (massimo - minimo) / Math.max(numero, 1);

    for (let k = 1; k < numero; k++) {
      const t = minimo + k * passoEffettivo;
      const incroci = [];
      for (const anello of anelli2D) {
        for (let i = 0; i < anello.length; i++) {
          const A = anello[i], B = anello[(i + 1) % anello.length];
          const a = A[0] * perp[0] + A[1] * perp[1] - t;
          const b = B[0] * perp[0] + B[1] * perp[1] - t;
          if ((a <= 0 && b > 0) || (a > 0 && b <= 0)) {
            const s = a / (a - b);
            const P = [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s];
            incroci.push(P[0] * dir[0] + P[1] * dir[1]);
          }
        }
      }
      incroci.sort((x, y) => x - y);
      for (let i = 0; i + 1 < incroci.length; i += 2) {
        const p1 = [dir[0] * incroci[i] + perp[0] * t, dir[1] * incroci[i] + perp[1] * t];
        const p2 = [dir[0] * incroci[i + 1] + perp[0] * t, dir[1] * incroci[i + 1] + perp[1] * t];
        gruppo.appendChild(linea(p1[0], p1[1], p2[0], p2[1], 'tratteggio-sezione'));
      }
    }
  }

  function disegnaFiguraDiSezione(gruppo, anelli, vista, off, dimensione) {
    if (!anelli || !anelli.length) return;
    const anelli2D = anelli.map(a => a.map(p => {
      const q = vista.project(p);
      return [q[0] + off[0], q[1] + off[1]];
    }));
    const g = el('g', { class: 'figura-sezione' });
    disegnaTratteggio(g, anelli2D, dimensione * 0.05);
    for (const anello of anelli2D) {
      const punti = anello.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
      g.appendChild(el('polygon', { points: punti, class: 'contorno-sezione' }));
    }
    gruppo.appendChild(g);
  }

  function disegnaPianoSezione(gruppo, piano, vista, off, trasforma) {
    const rettangolo = Sezione.rettangoloDelPiano(piano, 0.3).map(trasforma || (p => p));
    const punti = rettangolo.map(p => {
      const q = vista.project(p);
      return (q[0] + off[0]).toFixed(2) + ',' + (q[1] + off[1]).toFixed(2);
    }).join(' ');
    gruppo.appendChild(el('polygon', { points: punti, class: 'piano-sezione' }));
  }

  // Vera forma della sezione, ribaltata sul piano del disegno e affiancata
  // alla vista.
  function disegnaVeraForma(gruppo, anelli, posizione, dimensione, dimTesto) {
    if (!anelli || !anelli.length) return;
    const forme = Sezione.veraForma(anelli);
    const tutti = [].concat.apply([], forme);
    const x0 = Math.min(...tutti.map(p => p[0])), x1 = Math.max(...tutti.map(p => p[0]));
    const y0 = Math.min(...tutti.map(p => p[1])), y1 = Math.max(...tutti.map(p => p[1]));
    const dx = posizione[0] - x0, dy = posizione[1] - y0;
    const spostate = forme.map(f => f.map(p => [p[0] + dx, p[1] + dy]));

    const g = el('g', { class: 'vera-forma' });
    disegnaTratteggio(g, spostate, dimensione * 0.05);
    for (const forma of spostate) {
      g.appendChild(el('polygon', {
        points: forma.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' '),
        class: 'contorno-sezione'
      }));
    }
    const t = el('text', {
      x: posizione[0], y: posizione[1] - dimTesto * 0.6,
      class: 'titolo-vista', 'font-size': dimTesto
    });
    t.textContent = 'Vera forma della sezione';
    g.appendChild(t);
    gruppo.appendChild(g);
    return { larghezza: x1 - x0, altezza: y1 - y0 };
  }

  // Tracce del piano di sezione α: tα' sul piano orizzontale, tα'' sul piano
  // verticale. Sono le rette in cui il piano incontra i piani di proiezione e
  // sulla linea di terra si incontrano fra loro.
  function disegnaTracce(gruppo, solido, piano, dimensione, dimTesto) {
    const n = Geo.normalize(piano.n);
    const puntoSulPiano = Geo.scale(n, piano.d);
    const collocato = solido.trasforma ? solido.trasforma(puntoSulPiano) : puntoSulPiano;
    const d = Geo.dot(n, collocato);
    const b = limiti(solido);
    const lunghezza = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0) * 1.3;
    const g = el('g', { class: 'tracce-piano' });

    function tracciaSu(assePiano, vista, riquadro, etichetta, versoEtichetta) {
      // retta { dot(n,p) = d } ∩ { assePiano = 0 }
      const versore = assePiano === 'z' ? [0, 0, 1] : [0, 1, 0];
      const direzione = Geo.cross(n, versore);
      if (Geo.length(direzione) < 1e-6) return;      // piano parallelo: nessuna traccia
      const u = Geo.normalize(direzione);
      const denominatore = Geo.dot(n, n) - Math.pow(Geo.dot(n, versore), 2);
      if (Math.abs(denominatore) < 1e-9) return;
      const componente = Geo.sub(n, Geo.scale(versore, Geo.dot(n, versore)));
      const p0 = Geo.scale(componente, d / denominatore);
      const pa = vista.project(Geo.add(p0, Geo.scale(u, -lunghezza)));
      const pc = vista.project(Geo.add(p0, Geo.scale(u, lunghezza)));
      // la traccia si traccia solo sulla vista che le compete
      const tratto = ritagliaSegmento(pa, pc, riquadro);
      if (!tratto) return;
      g.appendChild(linea(tratto[0][0], tratto[0][1], tratto[1][0], tratto[1][1], 'traccia-piano'));
      const piuInAlto = tratto[0][1] < tratto[1][1] ? tratto[0] : tratto[1];
      const piuInBasso = tratto[0][1] < tratto[1][1] ? tratto[1] : tratto[0];
      const estremo = versoEtichetta === 'basso' ? piuInBasso : piuInAlto;
      const t = el('text', {
        x: estremo[0] + dimTesto * 0.35,
        y: estremo[1] + (versoEtichetta === 'basso' ? dimTesto * 0.9 : -dimTesto * 0.35),
        class: 'etichetta-traccia', 'font-size': dimTesto
      });
      t.textContent = etichetta;
      g.appendChild(t);
    }

    // ciascuna traccia resta nella fascia della propria vista e arriva fino
    // alla linea di terra, dove le due si incontrano
    const m = dimensione * 0.25;
    const sinistra = b.x0 - dimensione, destra = b.y1 + dimensione;
    // l'etichetta della prima traccia va in basso, altrimenti finisce
    // sopra quella della linea di terra
    tracciaSu('z', Geo.vistaOrtogonale('pianta'),
      { x0: sinistra, x1: destra, y0: 0, y1: b.y1 + m }, 'tα′', 'basso');
    tracciaSu('y', Geo.vistaOrtogonale('prospetto'),
      { x0: sinistra, x1: destra, y0: -b.z1 - m, y1: 0 }, 'tα″', 'alto');
    gruppo.appendChild(g);
  }

  // Ritaglio di un segmento su un rettangolo (algoritmo di Liang-Barsky).
  function ritagliaSegmento(a, b, r) {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const prove = [[-dx, a[0] - r.x0], [dx, r.x1 - a[0]], [-dy, a[1] - r.y0], [dy, r.y1 - a[1]]];
    for (const [p, q] of prove) {
      if (Math.abs(p) < 1e-9) {
        if (q < 0) return null;
        continue;
      }
      const t = q / p;
      if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
      else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [
      [a[0] + t0 * dx, a[1] + t0 * dy],
      [a[0] + t1 * dx, a[1] + t1 * dy]
    ];
  }

  // Ribaltamento della sezione sul P.O. nelle proiezioni ortogonali: la figura
  // arriva in vera grandezza nella posizione che le assegna la costruzione,
  // legata alla pianta dalle rette perpendicolari alla traccia.
  // Ribaltamento della sezione sul P.V., attorno alla seconda traccia tα'':
  // ruota tutto il piano, quindi arriva sul prospetto anche la prima traccia,
  // perpendicolare alla cerniera. Gli elementi ribaltati si indicano fra
  // parentesi, come vuole la convenzione.
  function disegnaRibaltamento(gruppo, solido, dimensione, dimTesto, opzioni) {
    const anelli = solido.anelli;
    if (!anelli || !anelli.length) return false;
    const b = limiti(solido);
    const centroProspetto = [(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2];
    const r = Sezione.ribaltamentoSulPV(anelli, centroProspetto);
    if (!r) return false;

    const prospetto = Geo.vistaOrtogonale('prospetto');
    const g = el('g', { class: 'ribaltamento-sezione' });

    // la prima traccia ribaltata, perpendicolare alla cerniera
    if (r.tracciaRibaltata) {
      const ta = prospetto.project(r.tracciaRibaltata.a);
      const tb = prospetto.project(r.tracciaRibaltata.b);
      g.appendChild(linea(ta[0], ta[1], tb[0], tb[1], 'traccia-ribaltata'));
      // l'etichetta va all'estremo che cade più lontano dalle viste
      const estremo = Math.hypot(ta[0] - b.x0, ta[1]) > Math.hypot(tb[0] - b.x0, tb[1]) ? ta : tb;
      const et = el('text', {
        x: estremo[0] + dimTesto * 0.35, y: estremo[1] + dimTesto * 0.9,
        class: 'etichetta-traccia', 'font-size': dimTesto
      });
      et.textContent = '(tα′)';
      g.appendChild(et);
    }

    // rette di ribaltamento: ogni punto ruota attorno alla cerniera, quindi nel
    // disegno si sposta lungo la perpendicolare a tα''
    const passo = Math.max(1, Math.ceil(anelli[0].length / 12));
    anelli.forEach((anello, i) => {
      for (let k = 0; k < anello.length; k += passo) {
        const p1 = prospetto.project(anello[k]);
        const p2 = prospetto.project(r.anelli[i][k]);
        g.appendChild(linea(p1[0], p1[1], p2[0], p2[1], 'richiamo'));
      }
    });

    const anelli2D = r.anelli.map(a => a.map(p => prospetto.project(p)));
    disegnaTratteggio(g, anelli2D, dimensione * 0.05);
    for (const anello of anelli2D) {
      g.appendChild(el('polygon', {
        points: anello.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' '),
        class: 'contorno-ribaltato'
      }));
    }

    if (opzioni && opzioni.etichette) {
      etichettaPuntiSezione(g, anelli, r.anelli, prospetto, dimTesto);
    }

    const centroRibaltato = anelli2D[0].reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0])
      .map(c => c / anelli2D[0].length);
    // la didascalia sta sopra la figura ribaltata, dove non incontra le viste
    const titolo = el('text', {
      x: centroRibaltato[0], y: Math.min(...anelli2D[0].map(p => p[1])) - dimTesto * 2.2,
      class: 'titolo-vista', 'font-size': dimTesto, 'text-anchor': 'middle'
    });
    titolo.textContent = 'sezione ribaltata sul P.V. attorno a tα″';
    g.appendChild(titolo);
    gruppo.appendChild(g);
    return true;
  }

  // I punti della sezione si numerano; i loro ribaltati portano lo stesso
  // numero fra parentesi, secondo la convenzione.
  function etichettaPuntiSezione(gruppo, anelli, ribaltati, vista, dimTesto) {
    if (anelli[0].length > 12) return;   // sui solidi curvi sarebbero illeggibili
    const dimensione = dimTesto * 0.9;
    const daEtichettare = [[], []];
    let numero = 1;
    anelli.forEach((anello, i) => {
      anello.forEach((punto, k) => {
        daEtichettare[0].push({ p: vista.project(punto), testo: String(numero) });
        // solo i ribaltati vanno fra parentesi
        daEtichettare[1].push({ p: vista.project(ribaltati[i][k]), testo: '(' + numero + ')' });
        numero++;
      });
    });
    daEtichettare.forEach((gruppoVoci, quale) => {
      const centro = gruppoVoci.reduce((s, v) => [s[0] + v.p[0], s[1] + v.p[1]], [0, 0])
        .map(c => c / (gruppoVoci.length || 1));
      gruppoVoci.forEach(v => { v.centro = centro; });
      // nella vista la sezione si vede di taglio: i numeri starebbero sopra il
      // solido, quindi si scostano perpendicolarmente alla traccia
      if (quale === 0) {
        const primo = gruppoVoci[0].p;
        const ultimo = gruppoVoci[gruppoVoci.length - 1].p;
        let dx = ultimo[0] - primo[0], dy = ultimo[1] - primo[1];
        const d = Math.hypot(dx, dy);
        if (d > 1e-6) {
          const perpendicolare = [-dy / d, dx / d];
          const verso = perpendicolare[1] < 0 ? 1 : -1;   // verso l'alto, fuori dal solido
          gruppoVoci.forEach(v => {
            v.direzione = [perpendicolare[0] * verso, perpendicolare[1] * verso];
          });
        }
      }
      disponiEtichette(gruppoVoci, dimensione)
        .forEach(v => scriviEtichetta(gruppo, v, dimensione));
    });
  }

  // --- Segmenti proiettati di un solido in una vista ---

  function segmentiProiettati(solido, vista) {
    const spigoli = Geo.spigoliDaTracciare(solido, vista);
    const segmenti = Geo.segmentiVisibilita(solido, spigoli, vista);
    return segmenti.map(s => ({
      a: vista.project(s.a),
      b: vista.project(s.b),
      nascosto: s.nascosto
    }));
  }

  function disegnaSpigoli(gruppo, solido, vista, off, opzioni) {
    const segmenti = segmentiProiettati(solido, vista)
      .filter(s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 1e-6);
    // prima i nascosti, poi quelli in vista: dove si sovrappongono prevale la
    // linea continua, come vuole la convenzione del disegno tecnico
    const ordine = [true, false];
    for (const nascosto of ordine) {
      if (nascosto && !opzioni.spigoliNascosti) continue;
      for (const s of segmenti) {
        if (s.nascosto !== nascosto) continue;
        gruppo.appendChild(linea(
          s.a[0] + off[0], s.a[1] + off[1],
          s.b[0] + off[0], s.b[1] + off[1],
          nascosto ? 'spigolo-nascosto' : 'spigolo-visibile'
        ));
      }
    }
  }

  // Resa ombreggiata: facce in una sola tinta tenue, con luminosità diversa
  // secondo l'orientamento rispetto a una luce convenzionale.
  const LUCE = Geo.normalize([-0.35, -0.5, 0.79]);

  function disegnaFacce(gruppo, solido, vista, off) {
    const normali = Geo.normaliFacce(solido);
    const facce = solido.facce.map((f, i) => {
      const punti = f.map(k => solido.vertici[k]);
      const centro = punti.reduce((a, p) => Geo.add(a, p), [0, 0, 0]).map(c => c / punti.length);
      const verso = Geo.versoOsservatore(vista, centro);
      const profondita = vista.puntoDiVista
        ? -Geo.length(Geo.sub(vista.puntoDiVista, centro))
        : Geo.dot(centro, Geo.normalize(vista.viewDir));
      return { indici: f, normale: normali[i], profondita: profondita, davanti: Geo.dot(normali[i], verso) > 0 };
    }).filter(f => f.davanti);
    facce.sort((a, b) => b.profondita - a.profondita);
    for (const f of facce) {
      const luce = Math.max(0, Geo.dot(f.normale, LUCE));
      const tono = Math.round(212 - 62 * luce);
      const punti = f.indici.map(k => {
        const p = vista.project(solido.vertici[k]);
        return (p[0] + off[0]).toFixed(2) + ',' + (p[1] + off[1]).toFixed(2);
      }).join(' ');
      gruppo.appendChild(el('polygon', {
        points: punti,
        fill: 'rgb(' + tono + ',' + tono + ',' + (tono + 6) + ')',
        class: 'faccia'
      }));
    }
  }

  // Notazione del disegno tecnico: A' è la prima proiezione (sul P.O.),
  // A'' la seconda (sul P.V.), A''' la terza (sul P.L.).
  const APICI = { pianta: '′', prospetto: '″', laterale: '‴' };
  const MAX_VERTICI_ETICHETTATI = 16;

  // Dispone le etichette attorno alla figura: prima le scosta dal disegno
  // lungo la direzione che va dal centro al punto, poi le allontana fra loro
  // finché non si sovrappongono più.
  function disponiEtichette(voci, dimensione) {
    const scostamento = dimensione * 1.1;
    voci.forEach(v => {
      // se si conoscono gli spigoli che arrivano nel punto, l'etichetta va
      // dalla parte opposta: è la direzione in cui non c'è disegno
      let dx, dy;
      if (v.direzione) {
        dx = v.direzione[0]; dy = v.direzione[1];
      } else {
        dx = v.p[0] - v.centro[0]; dy = v.p[1] - v.centro[1];
      }
      const d = Math.hypot(dx, dy) || 1;
      v.pos = [v.p[0] + dx / d * scostamento, v.p[1] + dy / d * scostamento];
      v.versoDestra = dx >= 0;
    });

    const larghezza = dimensione * 1.7, altezza = dimensione * 1.2;
    for (let giro = 0; giro < 8; giro++) {
      let spostato = false;
      for (let i = 0; i < voci.length; i++) {
        for (let j = i + 1; j < voci.length; j++) {
          const a = voci[i].pos, b = voci[j].pos;
          let dx = b[0] - a[0], dy = b[1] - a[1];
          if (Math.abs(dx) >= larghezza || Math.abs(dy) >= altezza) continue;
          if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) { dx = 0; dy = 1; }
          const lunghezza = Math.hypot(dx, dy) || 1;
          const spinta = dimensione * 0.45;
          a[0] -= dx / lunghezza * spinta; a[1] -= dy / lunghezza * spinta;
          b[0] += dx / lunghezza * spinta; b[1] += dy / lunghezza * spinta;
          spostato = true;
        }
      }
      if (!spostato) break;
    }
    return voci;
  }

  function scriviEtichetta(gruppo, voce, dimensione, classe) {
    const t = el('text', {
      x: voce.pos[0], y: voce.pos[1],
      class: classe || 'etichetta-vertice',
      'font-size': dimensione,
      'text-anchor': voce.versoDestra ? 'start' : 'end',
      'dominant-baseline': 'middle'
    });
    t.textContent = voce.testo;
    gruppo.appendChild(t);
  }

  // Direzione in cui, attorno a un vertice, non arriva nessuno spigolo:
  // è lì che l'etichetta non copre il disegno.
  function direzioneLibera(solido, topo, indici, vista) {
    let sx = 0, sy = 0, quanti = 0;
    for (const spigolo of topo.spigoli) {
      for (const indice of indici) {
        let altro = null;
        if (spigolo.a === indice) altro = spigolo.b;
        else if (spigolo.b === indice) altro = spigolo.a;
        if (altro === null) continue;
        const p = vista.project(solido.vertici[indice]);
        const q = vista.project(solido.vertici[altro]);
        const dx = q[0] - p[0], dy = q[1] - p[1];
        const d = Math.hypot(dx, dy);
        if (d < 1e-6) continue;
        sx += dx / d; sy += dy / d; quanti++;
      }
    }
    if (!quanti || Math.hypot(sx, sy) < 1e-6) return null;
    return [-sx, -sy];
  }

  function disegnaEtichette(gruppo, solido, vista, off, dimensione) {
    if (solido.vertici.length > MAX_VERTICI_ETICHETTATI) return;
    const apice = APICI[vista.nome] || '';
    const profonditaDi = v => vista.puntoDiVista
      ? Geo.length(Geo.sub(vista.puntoDiVista, v))
      : Geo.dot(v, Geo.normalize(vista.viewDir));
    // i vertici che cadono nello stesso punto della proiezione condividono
    // l'etichetta: davanti quello in vista, tra parentesi quello che sta dietro
    const punti = [];
    for (let i = 0; i < Math.min(solido.vertici.length, LETTERE.length); i++) {
      const v = solido.vertici[i];
      const p = vista.project(v);
      const esistente = punti.find(q => Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < dimensione * 0.15);
      const voce = { lettera: LETTERE[i], profondita: profonditaDi(v), indice: i };
      if (esistente) esistente.vertici.push(voce);
      else punti.push({ p: p, vertici: [voce] });
    }
    const centro = punti.reduce((s, q) => [s[0] + q.p[0], s[1] + q.p[1]], [0, 0])
      .map(c => c / (punti.length || 1));
    const topo = Geo.costruisciTopologia(solido);
    const voci = punti.map(punto => {
      punto.vertici.sort((a, b) => a.profondita - b.profondita);
      // punti che cadono nello stesso posto: si indicano coincidenti con ≡.
      // Le parentesi restano riservate agli elementi ribaltati.
      const testo = punto.vertici.map(v => v.lettera + apice).join('≡');
      return {
        p: [punto.p[0] + off[0], punto.p[1] + off[1]],
        testo: testo,
        centro: centro,
        direzione: direzioneLibera(solido, topo, punto.vertici.map(v => v.indice), vista)
      };
    });
    disponiEtichette(voci, dimensione).forEach(v => scriviEtichetta(gruppo, v, dimensione));
  }

  // --- Proiezioni ortogonali: collocazione nel triedro, richiami, ribaltamento ---

  // Colloca il solido nel primo triedro: appoggiato al piano orizzontale,
  // allontanato dal piano verticale e dal piano laterale. Così le tre viste
  // si dispongono da sole rispetto alla linea di terra e alla sua verticale,
  // alle distanze reali, come nella costruzione di Monge.
  function collocaNelTriedro(solido, posizione) {
    const b0 = limiti(solido);
    const dimensione = Math.max(b0.x1 - b0.x0, b0.y1 - b0.y0, b0.z1 - b0.z0);
    const p = posizione || {};
    const allontanamento = p.allontanamento === undefined ? dimensione * 0.45 : p.allontanamento;
    const distanzaPL = p.distanzaPL === undefined ? dimensione * 0.45 : p.distanzaPL;
    const quota = p.quota === undefined ? 0 : p.quota;

    const chiave = allontanamento + '/' + distanzaPL + '/' + quota;
    if (solido._collocato && solido._collocato.chiave === chiave) return solido._collocato.solido;

    const b = b0;
    const dx = -distanzaPL - b.x1;      // a sinistra del piano laterale
    const dy = allontanamento - b.y0;   // davanti al piano verticale
    const dz = quota - b.z0;            // appoggiato al P.O. o sollevato di "quota"
    const trasla = v => [v[0] + dx, v[1] + dy, v[2] + dz];
    const collocato = {
      id: solido.id,
      nome: solido.nome,
      categoria: solido.categoria,
      vertici: solido.vertici.map(trasla),
      facce: solido.facce,
      anelli: trasformaAnelli(solido.anelli, trasla),
      trasforma: trasla
    };
    solido._collocato = { chiave: chiave, solido: collocato };
    return collocato;
  }

  function valoriDistinti(valori, massimo) {
    const unici = [];
    for (const v of valori) {
      if (!unici.some(u => Math.abs(u - v) < 1e-6)) unici.push(v);
    }
    if (unici.length > massimo) {
      return [Math.min(...unici), Math.max(...unici)];
    }
    return unici;
  }

  // Estensione del foglio: le tre viste stanno a sinistra e sotto l'origine
  // (prospetto e pianta) e a destra in alto (vista laterale).
  function estensione(solido, margine) {
    const b = limiti(solido);
    return {
      sinistra: b.x0 - margine,
      destra: b.y1 + margine,
      alto: -b.z1 - margine,
      basso: b.y1 + margine,
      b: b
    };
  }

  function disegnaLineaDiTerra(gruppo, solido, dimTesto, margine, vistaSingola) {
    const e = estensione(solido, margine);
    const b = e.b;
    // con una sola vista si traccia il solo tratto di L.T. che le compete
    const da = vistaSingola === 'laterale' ? b.y0 - margine : e.sinistra;
    const a = vistaSingola === 'laterale' ? b.y1 + margine : (vistaSingola ? b.x1 + margine : e.destra);
    gruppo.appendChild(linea(da, 0, a, 0, 'linea-terra'));
    if (!vistaSingola) gruppo.appendChild(linea(0, e.alto, 0, e.basso, 'linea-terra'));
    const t = el('text', {
      x: da, y: -dimTesto * 0.9,
      class: 'etichetta-lt', 'font-size': dimTesto
    });
    t.textContent = 'L.T.';
    gruppo.appendChild(t);
  }

  function disegnaRichiami(gruppo, solido, dimTesto, margine) {
    const e = estensione(solido, margine);
    const b = e.b;
    const xs = valoriDistinti(solido.vertici.map(v => v[0]), 8);
    const zs = valoriDistinti(solido.vertici.map(v => v[2]), 8);
    const ys = valoriDistinti(solido.vertici.map(v => v[1]), 8);

    // prospetto -> pianta: richiami verticali
    for (const x of xs) gruppo.appendChild(linea(x, -b.z1 - margine * 0.4, x, b.y1 + margine * 0.4, 'richiamo'));
    // prospetto -> vista laterale: richiami orizzontali
    for (const z of zs) gruppo.appendChild(linea(b.x0 - margine * 0.4, -z, b.y1 + margine * 0.4, -z, 'richiamo'));
    // pianta -> linea di ribaltamento a 45° -> vista laterale
    for (const y of ys) {
      gruppo.appendChild(linea(b.x0 - margine * 0.4, y, y, y, 'richiamo'));
      gruppo.appendChild(linea(y, y, y, -b.z1 - margine * 0.4, 'richiamo'));
    }
    // la linea di ribaltamento passa per l'origine dei tre piani
    const fine = b.y1 + margine * 0.6;
    gruppo.appendChild(linea(0, 0, fine, fine, 'ribaltamento'));
    const testo = el('text', {
      x: fine + dimTesto * 0.3, y: fine + dimTesto * 0.35,
      class: 'nota-disegno', 'font-size': dimTesto * 0.92
    });
    testo.textContent = 'ribaltamento 45°';
    gruppo.appendChild(testo);
  }

  // I tre piani di proiezione ribaltati sul foglio: si incontrano nell'origine
  // e la loro traccia comune è la linea di terra.
  function disegnaPianiProiezione(gruppo, solido, dimTesto, margine) {
    const e = estensione(solido, margine);
    const b = e.b;
    const pad = dimTesto * 0.5;
    const riquadri = [
      { x: e.sinistra, y: e.alto, w: -e.sinistra, h: -e.alto, etichetta: 'P.V.', tx: -pad, ty: e.alto + dimTesto * 1.2 },
      { x: e.sinistra, y: 0, w: -e.sinistra, h: b.y1 + margine, etichetta: 'P.O.', tx: -pad, ty: b.y1 + margine - pad },
      { x: 0, y: e.alto, w: b.y1 + margine, h: -e.alto, etichetta: 'P.L.', tx: b.y1 + margine - pad, ty: e.alto + dimTesto * 1.2 }
    ];
    for (const r of riquadri) {
      gruppo.appendChild(el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, class: 'piano-proiezione' }));
      const t = el('text', {
        x: r.tx, y: r.ty, 'text-anchor': 'end',
        class: 'etichetta-piano', 'font-size': dimTesto
      });
      t.textContent = r.etichetta;
      gruppo.appendChild(t);
    }
  }

  function disegnaProiezioniOrtogonali(svg, solidoOriginale, opzioni) {
    const sezione = applicaSezione(solidoOriginale, opzioni);
    const solido = collocaNelTriedro(sezione.solido, opzioni.posizione);
    const b = limiti(solido);
    const dimensione = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
    const dimTesto = dimensione * 0.1;
    const margine = dimensione * 0.22;
    const g = el('g', {});
    svuota(svg);

    const singola = opzioni.vistaSingola;
    if (!singola) {
      if (opzioni.piani) disegnaPianiProiezione(g, solido, dimTesto, margine);
      if (opzioni.richiami) disegnaRichiami(g, solido, dimTesto, margine);
    }
    disegnaLineaDiTerra(g, solido, dimTesto, margine, singola);

    let viste = ['prospetto', 'pianta', 'laterale'].map(n => Geo.vistaOrtogonale(n));
    if (singola) viste = viste.filter(v => v.nome === singola);

    for (const vista of viste) {
      const gv = el('g', { class: 'vista vista-' + vista.nome });
      if (sezione.piano && !opzioni.sezione.effettuata) {
        disegnaPianoSezione(gv, sezione.piano, vista, [0, 0], solido.trasforma);
      }
      disegnaSpigoli(gv, solido, vista, [0, 0], opzioni);
      disegnaFiguraDiSezione(gv, solido.anelli, vista, [0, 0], dimensione);

      if (opzioni.etichette) disegnaEtichette(gv, solido, vista, [0, 0], dimTesto * 0.85);
      g.appendChild(gv);
      g.appendChild(titoloVista(vista, b, dimTesto, margine));
    }
    if (sezione.piano && !singola) {
      disegnaTracce(g, solido, sezione.piano, dimensione, dimTesto);
    }
    if (solido.anelli && opzioni.sezione.veraForma && !singola) {
      // se il piano è parallelo a un piano di proiezione la sezione è già in
      // vera forma su quella vista e il ribaltamento non serve; altrimenti si
      // ribalta attorno alla traccia del piano sul P.O.
      const dove = vistaInVeraForma(opzioni.sezione.tipo);
      if (dove) {
        const nota = el('text', {
          x: b.x0, y: b.y1 + margine * 1.6, class: 'nota-disegno', 'font-size': dimTesto
        });
        nota.textContent = 'La sezione è già in vera forma ' + dove + '.';
        g.appendChild(nota);
      } else if (!disegnaRibaltamento(g, solido, dimensione, dimTesto, opzioni)) {
        disegnaVeraForma(g, solido.anelli, [b.y1 + margine * 3, -b.z1], dimensione, dimTesto);
      }
    }
    separaEtichette(g);
    svg.appendChild(g);
    adattaViewBox(svg, g, margine);
  }

  // Passata finale su tutto il disegno: le etichette mobili (vertici e punti
  // di sezione) si scostano finché nessuna copre un'altra. I titoli e le sigle
  // delle tracce restano dove sono e fanno da ostacolo.
  function separaEtichette(gruppo) {
    const voci = [];
    gruppo.querySelectorAll('text').forEach(nodo => {
      const dimensione = parseFloat(nodo.getAttribute('font-size')) || 10;
      const ancora = nodo.getAttribute('text-anchor');
      // stima larga della larghezza: meglio scostare un po' troppo che lasciare
      // due scritte appiccicate
      const larghezza = dimensione * 0.75 * Math.max(nodo.textContent.length, 1);
      voci.push({
        nodo: nodo,
        x: parseFloat(nodo.getAttribute('x')) || 0,
        y: parseFloat(nodo.getAttribute('y')) || 0,
        larghezza: larghezza,
        altezza: dimensione,
        ancora: ancora,
        mobile: nodo.getAttribute('class') === 'etichetta-vertice'
      });
    });
    if (!voci.some(v => v.mobile)) return;

    const riquadro = v => {
      const sinistra = v.ancora === 'end' ? v.x - v.larghezza
        : v.ancora === 'middle' ? v.x - v.larghezza / 2 : v.x;
      return { x0: sinistra, x1: sinistra + v.larghezza, y0: v.y - v.altezza * 0.9, y1: v.y + v.altezza * 0.4 };
    };

    for (let giro = 0; giro < 16; giro++) {
      let spostato = false;
      for (let i = 0; i < voci.length; i++) {
        for (let j = i + 1; j < voci.length; j++) {
          const a = voci[i], b = voci[j];
          if (!a.mobile && !b.mobile) continue;
          const ra = riquadro(a), rb = riquadro(b);
          if (ra.x1 <= rb.x0 || rb.x1 <= ra.x0 || ra.y1 <= rb.y0 || rb.y1 <= ra.y0) continue;
          let dx = (ra.x0 + ra.x1) / 2 - (rb.x0 + rb.x1) / 2;
          let dy = (ra.y0 + ra.y1) / 2 - (rb.y0 + rb.y1) / 2;
          if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) { dx = 0; dy = -1; }
          const lunghezza = Math.hypot(dx, dy) || 1;
          const spinta = Math.max(a.altezza, b.altezza) * 0.5;
          const quanti = (a.mobile ? 1 : 0) + (b.mobile ? 1 : 0);
          if (a.mobile) { a.x += dx / lunghezza * spinta / quanti * 2; a.y += dy / lunghezza * spinta / quanti * 2; }
          if (b.mobile) { b.x -= dx / lunghezza * spinta / quanti * 2; b.y -= dy / lunghezza * spinta / quanti * 2; }
          spostato = true;
        }
      }
      if (!spostato) break;
    }
    voci.filter(v => v.mobile).forEach(v => {
      v.nodo.setAttribute('x', v.x.toFixed(2));
      v.nodo.setAttribute('y', v.y.toFixed(2));
    });
  }

  // Un piano parallelo a un piano di proiezione dà la sezione in vera forma
  // sulla vista corrispondente, senza bisogno di ribaltamenti.
  function vistaInVeraForma(tipoPiano) {
    if (tipoPiano === 'orizzontale') return 'nella pianta';
    if (tipoPiano === 'verticale') return 'nel prospetto';
    if (tipoPiano === 'profilo') return 'nella vista laterale';
    return null;
  }

  function titoloVista(vista, b, dimTesto, margine) {
    // il titolo sta sopra la propria vista, tranne la pianta che lo porta sotto
    const posizioni = {
      prospetto: [b.x0, -b.z1 - margine * 0.45],
      laterale: [b.y0, -b.z1 - margine * 0.45],
      pianta: [b.x0, b.y1 + margine * 0.8]
    };
    const p = posizioni[vista.nome];
    const t = el('text', { x: p[0], y: p[1], class: 'titolo-vista', 'font-size': dimTesto });
    t.textContent = vista.etichetta;
    return t;
  }

  // --- Prospettiva ---

  // Colloca il solido dietro il quadro: ruotato di "alfa" attorno all'asse
  // verticale (0° = prospettiva centrale), appoggiato o sollevato secondo la
  // quota, e allontanato dal quadro come nelle proiezioni ortogonali.
  function collocaDietroIlQuadro(solido, posizione, alfaDeg) {
    const p = posizione || {};
    const b0 = limiti(solido);
    const dimensione = Math.max(b0.x1 - b0.x0, b0.y1 - b0.y0, b0.z1 - b0.z0);
    const allontanamento = p.allontanamento === undefined ? dimensione * 0.45 : p.allontanamento;
    const quota = p.quota === undefined ? 0 : p.quota;

    const chiave = allontanamento + '/' + quota + '/' + alfaDeg;
    if (solido._dietroQuadro && solido._dietroQuadro.chiave === chiave) return solido._dietroQuadro.solido;

    const m = Geo.rotZ(Geo.deg2rad(alfaDeg));
    const ruotati = solido.vertici.map(v => Geo.matVec(m, v));
    const minY = Math.min(...ruotati.map(v => v[1]));
    const minZ = Math.min(...ruotati.map(v => v[2]));
    const cx = (Math.min(...ruotati.map(v => v[0])) + Math.max(...ruotati.map(v => v[0]))) / 2;
    const trasforma = v => {
      const r = Geo.matVec(m, v);
      return [r[0] - cx, r[1] - minY + allontanamento, r[2] - minZ + quota];
    };
    const collocato = {
      id: solido.id, nome: solido.nome, categoria: solido.categoria,
      vertici: ruotati.map(v => [v[0] - cx, v[1] - minY + allontanamento, v[2] - minZ + quota]),
      facce: solido.facce,
      anelli: trasformaAnelli(solido.anelli, trasforma),
      trasforma: trasforma
    };
    solido._dietroQuadro = { chiave: chiave, solido: collocato };
    return collocato;
  }

  // Direzioni orizzontali principali del solido: quelle dei suoi spigoli
  // orizzontali, cioè le direzioni che generano i punti di fuga.
  function direzioniDiFuga(alfaDeg) {
    const a = Geo.deg2rad(alfaDeg);
    return [
      { u: [Math.cos(a), Math.sin(a), 0], nome: 'F1' },
      { u: [-Math.sin(a), Math.cos(a), 0], nome: 'F2' }
    ];
  }

  function disegnaProspettiva(svg, solidoOriginale, vista, opzioni) {
    svuota(svg);
    const sezione = applicaSezione(solidoOriginale, opzioni);
    const solido = collocaDietroIlQuadro(sezione.solido, opzioni.posizione, opzioni.alfa);
    const g = el('g', {});
    const b = limiti(solido);
    const dimensione = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);

    const proiettati = solido.vertici.map(v => vista.project(v));
    const estremi = {
      x0: Math.min(...proiettati.map(p => p[0])),
      x1: Math.max(...proiettati.map(p => p[0])),
      y0: Math.min(...proiettati.map(p => p[1])),
      y1: Math.max(...proiettati.map(p => p[1]))
    };
    const fughe = puntiDiFuga(vista, opzioni.alfa);
    const yOrizzonte = -vista.altezza;

    // L'inquadratura comprende il solido, la linea di terra e l'orizzonte;
    // solo su richiesta si allarga fino ai punti di fuga, che possono cadere
    // molto lontano e rimpicciolire troppo il disegno.
    const riquadro = opzioni.riquadroForzato ? Object.assign({}, opzioni.riquadroForzato) : {
      x0: estremi.x0, x1: estremi.x1,
      y0: Math.min(estremi.y0, yOrizzonte), y1: Math.max(estremi.y1, 0)
    };
    if (opzioni.inquadraFughe && !opzioni.riquadroForzato) {
      fughe.filter(f => !f.coincidePP).forEach(f => {
        riquadro.x0 = Math.min(riquadro.x0, f.p[0]);
        riquadro.x1 = Math.max(riquadro.x1, f.p[0]);
      });
      riquadro.x0 = Math.min(riquadro.x0, vista.x);
      riquadro.x1 = Math.max(riquadro.x1, vista.x);
    }
    // i testi si dimensionano sull'inquadratura, non sul solido
    const dimTesto = Math.max(dimensione * 0.05, (riquadro.x1 - riquadro.x0) * 0.028);
    const sinistra = riquadro.x0 - dimTesto;
    const destra = riquadro.x1 + dimTesto;

    if (opzioni.lineeDiFuga) disegnaLineeDiFuga(g, solido, vista, fughe, opzioni);

    // linea di terra (base del quadro) e linea d'orizzonte
    g.appendChild(linea(sinistra, 0, destra, 0, 'linea-terra'));
    etichetta(g, 'L.T.', sinistra, -dimTesto * 0.45, 'etichetta-lt', dimTesto);
    const presa = linea(sinistra, yOrizzonte, destra, yOrizzonte, 'area-presa-orizzonte');
    presa.setAttribute('data-punto', 'orizzonte');
    presa.setAttribute('stroke-width', dimTesto * 2.6);
    g.appendChild(presa);
    g.appendChild(linea(sinistra, yOrizzonte, destra, yOrizzonte, 'linea-orizzonte'));
    // sotto la linea, per non finire sopra l'etichetta di un punto di fuga
    etichetta(g, "linea d'orizzonte", sinistra, yOrizzonte + dimTesto * 1.15, 'etichetta-orizzonte', dimTesto);

    const gv = el('g', { class: 'vista vista-prospettiva' });
    const ombreggiato = opzioni.resa === 'ombreggiato';
    if (ombreggiato) disegnaFacce(gv, solido, vista, [0, 0]);
    if (sezione.piano && !opzioni.sezione.effettuata) {
      disegnaPianoSezione(gv, sezione.piano, vista, [0, 0], solido.trasforma);
    }
    disegnaSpigoli(gv, solido, vista, [0, 0],
      ombreggiato ? Object.assign({}, opzioni, { spigoliNascosti: false }) : opzioni);
    disegnaFiguraDiSezione(gv, solido.anelli, vista, [0, 0], dimensione);
    if (opzioni.etichette) disegnaEtichette(gv, solido, vista, [0, 0], dimTesto * 0.85);
    g.appendChild(gv);

    // punto principale e punti di fuga, con l'area di presa per il dito
    if (opzioni.mostraPunti !== false) {
      puntoTrascinabile(g, [vista.x, yOrizzonte], 'P.P.', 'punto-vista', dimTesto, 'punto-principale');
      fughe.filter(f => !f.coincidePP)
        .forEach(f => puntoTrascinabile(g, f.p, f.etichetta, 'punto-fuga', dimTesto, f.nome));
    }

    svg.appendChild(g);

    // con l'inquadratura imposta il margine non può dipendere dal solido,
    // altrimenti due immagini da confrontare risulterebbero a scale diverse
    const margine = opzioni.riquadroForzato
      ? (riquadro.x1 - riquadro.x0) * 0.06
      : dimTesto * 2.2;
    svg.setAttribute('viewBox', [
      riquadro.x0 - margine, riquadro.y0 - margine,
      Math.max(riquadro.x1 - riquadro.x0 + 2 * margine, 1),
      Math.max(riquadro.y1 - riquadro.y0 + 2 * margine, 1)
    ].join(' '));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    return riquadro;
  }

  function puntiDiFuga(vista, alfaDeg) {
    const fughe = [];
    direzioniDiFuga(alfaDeg).forEach((d, i) => {
      const p = vista.puntoDiFuga(d.u);
      if (!p) return; // direzione parallela al quadro: non ha punto di fuga
      // nella prospettiva centrale la fuga cade nel punto principale
      const coincidePP = Math.abs(p[0] - vista.x) < 1e-6 && Math.abs(p[1] + vista.altezza) < 1e-6;
      fughe.push({ p: p, nome: d.nome, etichetta: i === 0 ? 'F₁' : 'F₂', direzione: d.u, coincidePP: coincidePP });
    });
    return fughe;
  }

  function disegnaLineeDiFuga(gruppo, solido, vista, fughe, opzioni) {
    const topo = Geo.costruisciTopologia(solido);
    const usati = new Map();
    for (const s of topo.spigoli) {
      if (!s.netto) continue;
      const A = solido.vertici[s.a], B = solido.vertici[s.b];
      const dir = Geo.normalize(Geo.sub(B, A));
      if (Math.abs(dir[2]) > 1e-6) continue; // solo gli spigoli orizzontali fuggono
      for (const f of fughe) {
        const allineato = Math.abs(Math.abs(Geo.dot(dir, f.direzione)) - 1) < 1e-4;
        if (!allineato) continue;
        const conteggio = usati.get(f.nome) || 0;
        if (conteggio >= 6) continue;
        usati.set(f.nome, conteggio + 1);
        // si prolunga dallo spigolo fino al suo punto di fuga
        const lontano = Geo.length(Geo.sub(vista.puntoDiVista, A)) > Geo.length(Geo.sub(vista.puntoDiVista, B)) ? A : B;
        const p = vista.project(lontano);
        gruppo.appendChild(linea(p[0], p[1], f.p[0], f.p[1], 'linea-fuga'));
      }
    }
  }

  function puntoTrascinabile(gruppo, p, testo, classe, dimTesto, nome) {
    const g = el('g', { class: 'trascinabile-punto', 'data-punto': nome });
    // area di presa più ampia del punto disegnato, per l'uso con il dito
    g.appendChild(el('circle', { cx: p[0], cy: p[1], r: dimTesto * 1.6, class: 'area-presa' }));
    g.appendChild(el('circle', { cx: p[0], cy: p[1], r: dimTesto * 0.28, class: classe }));
    const t = el('text', { x: p[0] + dimTesto * 0.4, y: p[1] - dimTesto * 0.5, class: 'etichetta-punto', 'font-size': dimTesto });
    t.textContent = testo;
    g.appendChild(t);
    gruppo.appendChild(g);
  }

  function etichetta(gruppo, testo, x, y, classe, dimensione) {
    const t = el('text', { x: x, y: y, class: classe, 'font-size': dimensione });
    t.textContent = testo;
    gruppo.appendChild(t);
  }

  // --- Assonometria ---

  function disegnaAssonometria(svg, solidoOriginale, vista, opzioni) {
    svuota(svg);
    const sezione = applicaSezione(solidoOriginale, opzioni);
    const solido = sezione.solido;
    const g = el('g', {});
    const b = limiti(solido);
    const dimensione = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
    const dimTesto = dimensione * 0.075;

    if (opzioni.griglia) disegnaGrigliaBase(g, solido, vista, dimensione);
    if (opzioni.assi) {
      disegnaAssiRiferimento(g, vista, dimensione, dimTesto,
        { conDati: opzioni.assiConDati, inEvidenza: opzioni.assiInEvidenza });
    }
    const ombreggiato = opzioni.resa === 'ombreggiato';
    if (ombreggiato) disegnaFacce(g, solido, vista, [0, 0]);
    // con le facce campite il solido è opaco: gli spigoli nascosti non si vedono
    const opzioniSpigoli = ombreggiato
      ? Object.assign({}, opzioni, { spigoliNascosti: false })
      : opzioni;
    if (sezione.piano && !opzioni.sezione.effettuata) {
      disegnaPianoSezione(g, sezione.piano, vista, [0, 0], null);
    }
    disegnaSpigoli(g, solido, vista, [0, 0], opzioniSpigoli);
    disegnaFiguraDiSezione(g, sezione.anelli, vista, [0, 0], dimensione);
    if (opzioni.etichette) disegnaEtichette(g, solido, vista, [0, 0], dimTesto);
    if (sezione.anelli && opzioni.sezione.veraForma) {
      disegnaVeraForma(g, sezione.anelli, [b.x1 + dimensione * 0.5, -b.z1], dimensione, dimTesto * 1.1);
    }

    svg.appendChild(g);
    adattaViewBox(svg, g, dimensione * 0.18);
  }

  function disegnaAssiRiferimento(gruppo, vista, dimensione, dimTesto, opzioni) {
    opzioni = opzioni || {};
    const L = dimensione * 0.85;
    const origine = vista.project([0, 0, 0]);
    const assi = [
      { v: [L, 0, 0], nome: 'x' },
      { v: [0, L, 0], nome: 'y' },
      { v: [0, 0, L], nome: 'z' }
    ];
    const classe = opzioni.inEvidenza ? 'asse-errato' : 'asse-riferimento';
    for (const a of assi) {
      const p = vista.project(a.v);
      gruppo.appendChild(linea(origine[0], origine[1], p[0], p[1], classe));
      let testo = a.nome;
      // nei riscontri l'asse porta con sé angolo e coefficiente di riduzione
      if (opzioni.conDati && vista.assi && vista.assi[a.nome]) {
        const dato = vista.assi[a.nome];
        testo += '  ' + dato.angolo.toFixed(0) + '°  k=' + dato.k.toFixed(2).replace('.', ',');
      }
      const t = el('text', {
        x: p[0] + dimTesto * 0.3, y: p[1] - dimTesto * 0.2,
        class: opzioni.inEvidenza ? 'etichetta-asse-errato' : 'etichetta-asse',
        'font-size': dimTesto
      });
      t.textContent = testo;
      gruppo.appendChild(t);
    }
  }

  function disegnaGrigliaBase(gruppo, solido, vista, dimensione) {
    const passo = dimensione / 4;
    const n = 4;
    for (let i = -n; i <= n; i++) {
      const a1 = vista.project([i * passo, -n * passo, 0]);
      const b1 = vista.project([i * passo, n * passo, 0]);
      gruppo.appendChild(linea(a1[0], a1[1], b1[0], b1[1], 'griglia'));
      const a2 = vista.project([-n * passo, i * passo, 0]);
      const b2 = vista.project([n * passo, i * passo, 0]);
      gruppo.appendChild(linea(a2[0], a2[1], b2[0], b2[1], 'griglia'));
    }
  }

  // --- Utilità ---

  // Ingombro calcolato dalla geometria disegnata: serve quando il disegno è
  // costruito mentre la sua sezione è ancora nascosta, caso in cui il browser
  // non sa fornire le dimensioni.
  function misuraGruppo(nodo, acc) {
    acc = acc || { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const punto = (x, y) => {
      if (!isFinite(x) || !isFinite(y)) return;
      acc.x0 = Math.min(acc.x0, x); acc.y0 = Math.min(acc.y0, y);
      acc.x1 = Math.max(acc.x1, x); acc.y1 = Math.max(acc.y1, y);
    };
    for (const figlio of nodo.children) {
      const nome = figlio.tagName;
      const n = a => parseFloat(figlio.getAttribute(a));
      if (nome === 'line') { punto(n('x1'), n('y1')); punto(n('x2'), n('y2')); }
      else if (nome === 'polygon' || nome === 'polyline') {
        (figlio.getAttribute('points') || '').trim().split(/\s+/).forEach(coppia => {
          const [x, y] = coppia.split(',').map(parseFloat);
          punto(x, y);
        });
      } else if (nome === 'rect') {
        punto(n('x'), n('y'));
        punto(n('x') + n('width'), n('y') + n('height'));
      } else if (nome === 'text') {
        punto(n('x'), n('y'));
      } else if (nome === 'g') {
        misuraGruppo(figlio, acc);
      }
    }
    return acc;
  }

  function adattaViewBox(svg, gruppo, margine) {
    let bb;
    try { bb = gruppo.getBBox(); } catch (e) { bb = null; }
    if (!bb || !bb.width || !bb.height) {
      const m = misuraGruppo(gruppo);
      if (!isFinite(m.x0)) return;
      bb = { x: m.x0, y: m.y0, width: m.x1 - m.x0, height: m.y1 - m.y0 };
    }
    const x = bb.x - margine, y = bb.y - margine;
    const w = Math.max(bb.width + 2 * margine, 1), h = Math.max(bb.height + 2 * margine, 1);
    svg.setAttribute('viewBox', x + ' ' + y + ' ' + w + ' ' + h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  // Disegna una figura piana isolata (per esempio la sagoma di una sezione),
  // campita e contornata come nel disegno tecnico.
  function disegnaFiguraPiana(svg, forme, opzioni) {
    svuota(svg);
    opzioni = opzioni || {};
    const g = el('g', {});
    const tutti = [].concat.apply([], forme);
    if (!tutti.length) { svg.appendChild(g); return; }
    const x0 = Math.min(...tutti.map(p => p[0])), x1 = Math.max(...tutti.map(p => p[0]));
    const y0 = Math.min(...tutti.map(p => p[1])), y1 = Math.max(...tutti.map(p => p[1]));
    const dimensione = Math.max(x1 - x0, y1 - y0) || 1;

    if (opzioni.tratteggio !== false) disegnaTratteggio(g, forme, dimensione * 0.07);
    for (const forma of forme) {
      g.appendChild(el('polygon', {
        points: forma.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' '),
        class: 'contorno-sezione'
      }));
    }
    svg.appendChild(g);
    // con "estensione" tutte le figure di una stessa domanda sono disegnate
    // alla medesima scala, così anche le differenze di grandezza si vedono
    if (opzioni.estensione) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const e = opzioni.estensione;
      svg.setAttribute('viewBox', [cx - e, cy - e, 2 * e, 2 * e].join(' '));
    } else {
      const margine = dimensione * 0.15;
      svg.setAttribute('viewBox', [x0 - margine, y0 - margine,
        (x1 - x0) + 2 * margine, (y1 - y0) + 2 * margine].join(' '));
    }
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  return {
    disegnaProiezioniOrtogonali,
    disegnaAssonometria,
    disegnaProspettiva,
    disegnaFiguraPiana,
    collocaDietroIlQuadro,
    puntiDiFuga,
    segmentiProiettati,
    limiti
  };
})();
