// Taglio di un solido con un piano: restituisce il solido sezionato (la parte
// che si conserva, chiusa dalla figura di sezione) e i contorni della sezione.
// Il risultato è un solido come gli altri, quindi tutte le viste lo disegnano
// con lo stesso motore.

const Sezione = (function () {
  'use strict';

  const TOL = 1e-6;

  function limiti(solido) {
    const v = solido.vertici;
    return {
      x0: Math.min(...v.map(p => p[0])), x1: Math.max(...v.map(p => p[0])),
      y0: Math.min(...v.map(p => p[1])), y1: Math.max(...v.map(p => p[1])),
      z0: Math.min(...v.map(p => p[2])), z1: Math.max(...v.map(p => p[2]))
    };
  }

  const NORMALI = {
    orizzontale: () => [0, 0, 1],                        // parallelo al P.O.
    verticale: () => [0, -1, 0],                         // parallelo al P.V.
    profilo: () => [-1, 0, 0],                           // parallelo al P.L.
    // perpendicolare al P.V. e inclinato sul P.O.: nel prospetto il piano si
    // vede di taglio, ed è il caso classico degli esercizi. L'inclinazione è
    // orientata in modo che la prima traccia cada a sinistra della pianta.
    inclinato: gradi => {
      const a = Geo.deg2rad(gradi);
      return Geo.normalize([-Math.sin(a), 0, Math.cos(a)]);
    }
  };

  // Il cursore di posizione (0-100) percorre l'intervallo che il piano può
  // occupare su quel solido, qualunque sia la sua dimensione.
  function piano(solido, config) {
    const n = NORMALI[config.tipo](config.inclinazione);
    const valori = solido.vertici.map(v => Geo.dot(n, v));
    const minimo = Math.min(...valori), massimo = Math.max(...valori);
    const d = minimo + (massimo - minimo) * (config.posizione / 100);
    return {
      n: config.invertito ? Geo.scale(n, -1) : n,
      d: config.invertito ? -d : d,
      normaleBase: n,
      quotaBase: d,
      tipo: config.tipo,
      limiti: limiti(solido)
    };
  }

  // Ritaglia un poligono conservando la parte con dot(n, p) <= d e segnala i
  // punti in cui il contorno attraversa il piano.
  function ritagliaFaccia(punti, valore) {
    const risultato = [];
    const attraversamenti = [];
    for (let i = 0; i < punti.length; i++) {
      const A = punti[i], B = punti[(i + 1) % punti.length];
      const va = valore(A), vb = valore(B);
      if (va <= TOL) risultato.push(A);
      if ((va < -TOL && vb > TOL) || (va > TOL && vb < -TOL)) {
        const t = va / (va - vb);
        const P = Geo.add(A, Geo.scale(Geo.sub(B, A), t));
        risultato.push(P);
        attraversamenti.push(P);
      } else if (Math.abs(va) <= TOL) {
        attraversamenti.push(A);
      }
    }
    return { poligono: risultato, attraversamenti: attraversamenti };
  }

  // I punti in cui una faccia incontra il piano formano uno o più segmenti del
  // contorno di sezione.
  function segmentiDellaFaccia(attraversamenti, normaleFaccia, normalePiano) {
    if (attraversamenti.length < 2) return [];
    const direzione = Geo.cross(normaleFaccia, normalePiano);
    if (Geo.length(direzione) < TOL) return [];
    const u = Geo.normalize(direzione);
    const ordinati = attraversamenti.slice().sort((a, b) => Geo.dot(a, u) - Geo.dot(b, u));
    const unici = [];
    for (const p of ordinati) {
      if (!unici.length || Geo.length(Geo.sub(p, unici[unici.length - 1])) > 1e-5) unici.push(p);
    }
    const segmenti = [];
    for (let i = 0; i + 1 < unici.length; i += 2) segmenti.push([unici[i], unici[i + 1]]);
    return segmenti;
  }

  // Unisce i segmenti in contorni chiusi: uno per ogni parte piena incontrata
  // dal piano (per esempio due, se il piano attraversa un foro).
  function chiudiAnelli(segmenti) {
    const disponibili = segmenti.slice();
    const anelli = [];
    const vicini = (a, b) => Geo.length(Geo.sub(a, b)) < 1e-4;

    while (disponibili.length) {
      const primo = disponibili.shift();
      const anello = [primo[0], primo[1]];
      let chiuso = false;
      while (!chiuso) {
        const coda = anello[anello.length - 1];
        let indice = -1, punto = null;
        for (let i = 0; i < disponibili.length; i++) {
          if (vicini(disponibili[i][0], coda)) { indice = i; punto = disponibili[i][1]; break; }
          if (vicini(disponibili[i][1], coda)) { indice = i; punto = disponibili[i][0]; break; }
        }
        if (indice < 0) break;                       // contorno incompleto: lo si lascia aperto
        disponibili.splice(indice, 1);
        if (vicini(punto, anello[0])) { chiuso = true; break; }
        anello.push(punto);
      }
      if (anello.length >= 3) anelli.push(anello);
    }
    return anelli;
  }

  function orientaAnello(anello, normalePiano) {
    const n = Geo.normaleFaccia(anello);
    return Geo.dot(n, normalePiano) < 0 ? anello.slice().reverse() : anello;
  }

  // Taglia il solido: conserva la parte oltre il piano e la chiude con la
  // figura di sezione.
  function taglia(solido, p) {
    const chiave = p.tipo + '/' + p.n.join(',') + '/' + p.d.toFixed(4);
    if (solido._sezione && solido._sezione.chiave === chiave) return solido._sezione.risultato;

    const valore = v => Geo.dot(p.n, v) - p.d;
    const normali = Geo.normaliFacce(solido);
    const facceRitagliate = [];
    let segmenti = [];

    solido.facce.forEach((f, i) => {
      const punti = f.map(k => solido.vertici[k]);
      const r = ritagliaFaccia(punti, valore);
      if (r.poligono.length >= 3) facceRitagliate.push(r.poligono);
      segmenti = segmenti.concat(segmentiDellaFaccia(r.attraversamenti, normali[i], p.n));
    });

    const anelli = chiudiAnelli(segmenti).map(a => orientaAnello(a, p.n));
    anelli.forEach(a => facceRitagliate.push(a));

    const risultato = ricostruisci(solido, facceRitagliate, anelli);
    solido._sezione = { chiave: chiave, risultato: risultato };
    return risultato;
  }

  // Ricompone vertici e facce unificando i punti coincidenti.
  function ricostruisci(solido, facce, anelli) {
    const vertici = [];
    const mappa = new Map();
    function indice(p) {
      const chiave = p.map(c => Math.round(c * 1e4)).join(',');
      if (mappa.has(chiave)) return mappa.get(chiave);
      vertici.push(p.slice());
      mappa.set(chiave, vertici.length - 1);
      return vertici.length - 1;
    }
    const facceIndicizzate = [];
    for (const f of facce) {
      const indici = [];
      for (const p of f) {
        const i = indice(p);
        if (!indici.length || indici[indici.length - 1] !== i) indici.push(i);
      }
      if (indici.length > 2 && indici[0] === indici[indici.length - 1]) indici.pop();
      if (indici.length >= 3) facceIndicizzate.push(indici);
    }
    return {
      solido: {
        id: solido.id, nome: solido.nome, categoria: solido.categoria,
        vertici: vertici, facce: facceIndicizzate, anelli: anelli
      },
      anelli: anelli
    };
  }

  // Vera forma della sezione: il contorno ribaltato sul piano del disegno.
  // La giacitura si ricava dal contorno stesso, così vale anche se il solido
  // è stato nel frattempo spostato o ruotato per una vista.
  function veraForma(anelli) {
    if (!anelli.length) return [];
    const n = Geo.normaleFaccia(anelli[0]);
    const rif = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = Geo.normalize(Geo.cross(rif, n));
    const w = Geo.cross(n, u);
    const origine = anelli[0][0];
    return anelli.map(anello => anello.map(punto => {
      const d = Geo.sub(punto, origine);
      return [Geo.dot(d, u), -Geo.dot(d, w)];
    }));
  }

  // Ribaltamento del piano di sezione sul piano orizzontale, attorno alla
  // propria traccia: ogni punto ruota conservando la distanza dalla cerniera,
  // così la figura arriva sul foglio in vera grandezza e nella posizione che
  // la costruzione le assegna.
  function ribaltamentoSulPO(anelli, centroSolido) {
    if (!anelli.length) return null;
    const n = Geo.normaleFaccia(anelli[0]);
    const orizzontale = Math.abs(n[2]);
    if (orizzontale > 0.999) return null;   // piano parallelo al P.O.: già in vera forma
    const d = Geo.dot(n, anelli[0][0]);
    const u = Geo.normalize(Geo.cross(n, [0, 0, 1]));   // direzione della cerniera
    const denominatore = n[0] * n[0] + n[1] * n[1];
    const k = d / denominatore;
    const p0 = [k * n[0], k * n[1], 0];                  // un punto della cerniera
    const dentroIlPiano = Geo.normalize(Geo.cross(u, n));
    const orizzontalePerp = Geo.normalize(Geo.cross([0, 0, 1], u));

    // il piano ruota verso il lato in cui si trova il solido: la figura arriva
    // oltre la pianta, perché ogni punto conserva la distanza vera dalla
    // cerniera, sempre maggiore di quella che si legge in pianta
    const scarto = Geo.dot(Geo.sub(centroSolido, p0), orizzontalePerp);
    const verso = scarto >= 0 ? 1 : -1;

    const ribaltati = anelli.map(anello => anello.map(P => {
      const v = Geo.sub(P, p0);
      const lungo = Geo.dot(v, u);
      const distanza = Geo.dot(v, dentroIlPiano);
      return Geo.add(Geo.add(p0, Geo.scale(u, lungo)), Geo.scale(orizzontalePerp, distanza * verso));
    }));

    return {
      anelli: ribaltati,
      cerniera: { punto: p0, direzione: u },
      // direzione, perpendicolare alla cerniera, lungo cui i punti si ribaltano
      perpendicolare: Geo.scale(orizzontalePerp, verso)
    };
  }

  // Ribaltamento del piano di sezione sul piano verticale, attorno alla propria
  // seconda traccia tα'', che resta ferma ed è la cerniera. Ruota tutto il
  // piano: oltre alla figura di sezione si ribalta anche la prima traccia, che
  // arriva sul P.V. perpendicolare a tα''.
  function ribaltamentoSulPV(anelli, centroProspetto) {
    if (!anelli.length) return null;
    const n = Geo.normaleFaccia(anelli[0]);
    const denominatore = n[0] * n[0] + n[2] * n[2];
    if (denominatore < 1e-9) return null;   // piano parallelo al P.V.: già in vera forma
    const d = Geo.dot(n, anelli[0][0]);

    const v = Geo.normalize(Geo.cross(n, [0, 1, 0]));   // direzione della cerniera tα''
    const q0 = [d * n[0] / denominatore, 0, d * n[2] / denominatore];
    const dentroIlPiano = Geo.normalize(Geo.cross(v, n));      // nel piano, ⊥ cerniera
    const dentroIlPV = Geo.normalize(Geo.cross(v, [0, 1, 0])); // nel P.V., ⊥ cerniera

    function ribalta(P, verso) {
      const s = Geo.sub(P, q0);
      const lungo = Geo.dot(s, v);
      const distanza = Geo.dot(s, dentroIlPiano);
      return Geo.add(Geo.add(q0, Geo.scale(v, lungo)), Geo.scale(dentroIlPV, distanza * verso));
    }

    // dei due versi possibili si sceglie quello che porta la figura dalla parte
    // più libera, lontano dal prospetto del solido
    const verso = [1, -1].map(s => {
      const punti = anelli[0].map(P => ribalta(P, s));
      const centro = punti.reduce((a, p) => Geo.add(a, p), [0, 0, 0]).map(c => c / punti.length);
      return { s: s, distanza: Math.hypot(centro[0] - centroProspetto[0], centro[2] - centroProspetto[2]) };
    }).sort((a, b) => b.distanza - a.distanza)[0].s;

    // la prima traccia tα' (piano ∩ P.O.) ribaltata insieme al resto del piano
    const denomOriz = n[0] * n[0] + n[1] * n[1];
    let tracciaRibaltata = null;
    if (denomOriz > 1e-9) {
      const u = Geo.normalize(Geo.cross(n, [0, 0, 1]));
      const p0 = [d * n[0] / denomOriz, d * n[1] / denomOriz, 0];
      tracciaRibaltata = {
        a: ribalta(Geo.add(p0, Geo.scale(u, -60)), verso),
        b: ribalta(Geo.add(p0, Geo.scale(u, 60)), verso)
      };
    }

    return {
      anelli: anelli.map(anello => anello.map(P => ribalta(P, verso))),
      cerniera: { punto: q0, direzione: v },
      tracciaRibaltata: tracciaRibaltata
    };
  }

  // Rettangolo che rappresenta il piano di sezione, esteso attorno al solido.
  function rettangoloDelPiano(p, margine) {
    const b = p.limiti;
    const centroSolido = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
    const n = Geo.normalize(p.n);
    // porta il centro sul piano
    const centro = Geo.add(centroSolido, Geo.scale(n, p.d - Geo.dot(n, centroSolido)));
    const rif = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = Geo.normalize(Geo.cross(rif, n));
    const w = Geo.cross(n, u);
    const raggio = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0) * (0.5 + (margine || 0.25));
    return [
      Geo.add(Geo.add(centro, Geo.scale(u, -raggio)), Geo.scale(w, -raggio)),
      Geo.add(Geo.add(centro, Geo.scale(u, raggio)), Geo.scale(w, -raggio)),
      Geo.add(Geo.add(centro, Geo.scale(u, raggio)), Geo.scale(w, raggio)),
      Geo.add(Geo.add(centro, Geo.scale(u, -raggio)), Geo.scale(w, raggio))
    ];
  }

  return { piano, taglia, veraForma, ribaltamentoSulPO, ribaltamentoSulPV, rettangoloDelPiano };
})();
