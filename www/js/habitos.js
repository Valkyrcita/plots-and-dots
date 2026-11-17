/* =========================================================
   VISTA HÁBITOS
   - tarjetas con marcado diario
   - niveles de cumplimiento configurables por hábito
   - tracker anual 31 columnas x 12 filas
   ========================================================= */
const Habitos = (() => {
  const S = () => Store.state();
  let busqueda = '';
  let filtro = 'todos';     // todos | pendientes | hechos (de hoy)

  const registros = hid => (S().registros[hid] = S().registros[hid] || {});
  const nivelDe = (h, fecha) => {
    const r = S().registros[h.id];
    if (!r || !r[fecha]) return null;
    return h.niveles.find(n => n.id === r[fecha]) || h.niveles[0] || null;
  };
  const hecho = (h, fecha) => !!(S().registros[h.id] && S().registros[h.id][fecha]);

  /* ---------- datos ---------- */
  function crearHabito(d) {
    const h = Object.assign({
      id: Store.uid('hab'), tipo: 'habito', nombre: '', emoji: '🌱',
      color: '#a8d8c8', niveles: [{ id: 'n1', etiqueta: 'Hecho', color: '#a8d8c8' }],
      creado: U.hoyISO(), orden: S().habitos.length, archivado: false
    }, d);
    S().habitos.push(h); Store.save(); return h;
  }

  function marcar(hid, fecha, nivelId) {
    const r = registros(hid);
    if (nivelId === null) delete r[fecha];
    else r[fecha] = nivelId;
    Store.save(); U.haptic('LIGHT');
  }

  /* un nivel => alterna; varios => abre selector */
  function togglear(h, fecha, despues) {
    if (h.niveles.length <= 1) {
      marcar(h.id, fecha, hecho(h, fecha) ? null : (h.niveles[0] ? h.niveles[0].id : 'n1'));
      if (despues) despues();
      return;
    }
    const actual = S().registros[h.id] ? S().registros[h.id][fecha] : null;
    UI.modal({
      titulo: h.emoji + ' ' + h.nombre,
      html: `<p style="margin:-6px 0 12px;color:var(--ink-faint);font-size:12.5px">${U.fechaCorta(fecha)}</p>
        <div class="choice-grid">
          ${h.niveles.map(n => `<button class="choice" data-nivel="${n.id}" style="${actual === n.id ? 'box-shadow:var(--clay-press)' : ''}">
              <span class="ic" style="background:${n.color};font-size:16px">${actual === n.id ? '✓' : ''}</span>
              <span><strong>${U.esc(n.etiqueta)}</strong></span></button>`).join('')}
        </div>`,
      autofocus: false,
      acciones: actual ? [{ txt: 'Quitar marca', clase: 'btn ghost', fn: () => { marcar(h.id, fecha, null); if (despues) despues(); } }] : [],
      onMount: (ov, cerrar) => {
        ov.querySelectorAll('[data-nivel]').forEach(b => b.onclick = () => {
          marcar(h.id, fecha, b.dataset.nivel); cerrar(); if (despues) despues();
        });
      }
    });
  }

  /* ---------- rachas y conteos ---------- */
  function racha(h) {
    let n = 0;
    const d = new Date();
    if (!hecho(h, U.toISO(d))) d.setDate(d.getDate() - 1);   // hoy todavía cuenta como vivo
    while (hecho(h, U.toISO(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function rachaMaxima(h) {
    const fechas = Object.keys(S().registros[h.id] || {}).sort();
    let max = 0, act = 0, prev = null;
    fechas.forEach(f => {
      if (prev && U.toISO(U.addDays(U.fromISO(prev), 1)) === f) act++;
      else act = 1;
      prev = f; if (act > max) max = act;
    });
    return max;
  }
  function conteoAnio(h, anio) {
    return Object.keys(S().registros[h.id] || {}).filter(f => f.startsWith(anio + '-')).length;
  }
  function conteoRango(h, ini, fin) {
    return Object.keys(S().registros[h.id] || {}).filter(f => (!ini || f >= ini) && (!fin || f <= fin)).length;
  }

  /* ---------- tracker anual ----------
     'vertical'  = como un bullet journal: 12 columnas (meses) x 31 filas (días)
     'horizontal'= 31 columnas (días) x 12 filas (meses), más compacto
     ------------------------------------ */
  function celdaInfo(h, anio, m, d) {
    const dias = new Date(anio, m + 1, 0).getDate();
    if (d > dias) return { off: true };
    const f = anio + '-' + U.pad(m + 1) + '-' + U.pad(d);
    const nid = (S().registros[h.id] || {})[f];
    const n = nid ? (h.niveles.find(x => x.id === nid) || h.niveles[0]) : null;
    return { f, n };
  }

  function totalMes(h, anio, m) {
    const pre = anio + '-' + U.pad(m + 1);
    return Object.keys(S().registros[h.id] || {}).filter(f => f.startsWith(pre)).length;
  }

  function trackerHTML(h, anio, opts) {
    opts = opts || {};
    const orient = opts.orientacion || S().ajustes.trackerOrientacion || 'vertical';
    const mini = !!opts.mini;
    const hoy = U.hoyISO();
    const cel = (c) => c.off
      ? '<span class="tk-c off"></span>'
      : `<span class="tk-c${c.n ? ' on' : ''}${c.f === hoy ? ' hoy' : ''}"${c.n ? ` style="background:${U.esc(c.n.color)}"` : ''}`
        + ` data-f="${c.f}" title="${c.f}${c.n ? ' · ' + U.esc(c.n.etiqueta) : ''}"></span>`;

    let out;
    if (orient === 'vertical') {
      out = `<div class="tracker v${mini ? ' mini' : ''}">`;
      out += '<span class="tk-corner"></span>';
      for (let m = 0; m < 12; m++) out += `<span class="tk-mes">${U.MESES_C[m][0]}</span>`;
      for (let d = 1; d <= 31; d++) {
        out += `<span class="tk-num">${d}</span>`;
        for (let m = 0; m < 12; m++) out += cel(celdaInfo(h, anio, m, d));
      }
      out += '<span class="tk-tot">Σ</span>';
      for (let m = 0; m < 12; m++) out += `<span class="tk-tot">${totalMes(h, anio, m) || ''}</span>`;
      out += '</div>';
    } else {
      out = `<div class="tracker hz${mini ? ' mini' : ''}">`;
      out += '<span class="tk-mes"></span>';
      for (let d = 1; d <= 31; d++) out += `<span class="tk-num">${mini ? (d === 1 || d % 5 === 0 ? d : '') : d}</span>`;
      out += '<span class="tk-tot">Σ</span>';
      for (let m = 0; m < 12; m++) {
        out += `<span class="tk-mes">${U.MESES_C[m]}</span>`;
        for (let d = 1; d <= 31; d++) out += cel(celdaInfo(h, anio, m, d));
        out += `<span class="tk-tot">${totalMes(h, anio, m) || ''}</span>`;
      }
      out += '</div>';
    }

    out += `<div class="tk-leyenda">${h.niveles.map(n =>
      `<span><i style="background:${n.color}"></i>${U.esc(n.etiqueta)}</span>`).join('')}</div>`;
    return out;
  }

  /* ---------- vista principal ---------- */
  function render(cont) {
    const hoy = U.hoyISO();
    const hs = S().habitos.filter(h => {
      if (h.archivado) return false;
      if (busqueda && !h.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
      if (filtro === 'pendientes' && hecho(h, hoy)) return false;
      if (filtro === 'hechos' && !hecho(h, hoy)) return false;
      return true;
    });

    const total = S().habitos.filter(h => !h.archivado).length;
    const hechosHoy = S().habitos.filter(h => !h.archivado && hecho(h, hoy)).length;

    let html = `
      <div class="toolbar">
        <div class="search"><span>🔍</span>
          <input id="hab-search" type="search" placeholder="Buscar hábito..." value="${U.esc(busqueda)}"></div>
      </div>
      <div class="toolbar" style="margin-top:-4px">
        ${[['todos','Todos'],['pendientes','Pendientes'],['hechos','Hechos hoy']].map(([k, l]) =>
          `<button class="chip${filtro === k ? ' active' : ''}" data-hf="${k}">${l}</button>`).join('')}
      </div>`;

    if (total) {
      const pct = Math.round(hechosHoy * 100 / total);
      html += `<div class="hoy-card">
        <div><strong>Hoy</strong><small>${U.fechaCorta(hoy)}</small></div>
        <div class="progress" style="max-width:120px"><i style="width:${pct}%"></i></div>
        <div class="progress-pct">${hechosHoy}/${total}</div>
      </div>`;
    }

    if (!hs.length) {
      html += `<div class="empty"><span class="big">🌱</span>
        <h3>${total ? 'Nada con ese filtro' : 'Sin hábitos todavía'}</h3>
        <p>Ejercicio, crochet, leer... con los niveles de cumplimiento que tú decidas.</p>
        <button class="btn primary" id="hab-nuevo">Nuevo Hábito</button></div>`;
      cont.innerHTML = html; bindTop(cont);
      const n = cont.querySelector('#hab-nuevo'); if (n) n.onclick = () => formHabito();
      return;
    }

    html += '<div class="hab-grid">';
    hs.forEach(h => {
      const n = nivelDe(h, hoy);
      const r = racha(h);
      html += `<div class="hab-card" data-hab="${h.id}">
        <div class="hab-top">
          <span class="hab-emoji" style="background:${h.color}">${h.emoji}</span>
          <button class="hab-check${n ? ' on' : ''}" data-check="${h.id}"
            style="${n ? `background:${n.color};border-color:${n.color}` : ''}">${n ? '✓' : ''}</button>
        </div>
        <div class="hab-nombre">${U.esc(h.nombre)}</div>
        <div class="hab-meta">${n ? U.esc(n.etiqueta) : 'Sin marcar hoy'}${r ? ' · 🔥 ' + r : ''}</div>
        <div class="hab-semana">${semanaHTML(h)}</div>
      </div>`;
    });
    html += '</div><p class="swipe-hint">Toca ✓ para marcar hoy · toca la tarjeta para ver el tracker anual</p>';

    cont.innerHTML = html;
    bindTop(cont);
    cont.querySelectorAll('[data-check]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const h = S().habitos.find(x => x.id === b.dataset.check);
      togglear(h, hoy, () => App.render());
    });
    cont.querySelectorAll('[data-hab]').forEach(c => c.onclick = () => detalle(c.dataset.hab));
  }

  function semanaHTML(h) {
    let out = '';
    for (let i = 6; i >= 0; i--) {
      const f = U.toISO(U.addDays(new Date(), -i));
      const n = nivelDe(h, f);
      out += `<i${n ? ` style="background:${n.color}"` : ''} class="${n ? 'on' : ''}"></i>`;
    }
    return out;
  }

  function bindTop(cont) {
    const sb = cont.querySelector('#hab-search');
    if (sb) sb.oninput = e => {
      busqueda = e.target.value; const p = e.target.selectionStart;
      App.render();
      const n = document.querySelector('#hab-search'); if (n) { n.focus(); n.setSelectionRange(p, p); }
    };
    cont.querySelectorAll('[data-hf]').forEach(b => b.onclick = () => { filtro = b.dataset.hf; App.render(); });
  }

  /* ---------- detalle con tracker ---------- */
  let det = null;
  function cuerpoDetalle(h, anio) {
    const c = conteoAnio(h, anio);
    const diasAnio = ((anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0) ? 366 : 365;
    return `
      <div class="stat-grid">
        <div class="stat-card"><div class="n">${c}</div><div class="l">DÍAS EN ${anio}</div></div>
        <div class="stat-card"><div class="n">${Math.round(c * 100 / diasAnio)}%</div><div class="l">DEL AÑO</div></div>
        <div class="stat-card"><div class="n">🔥 ${racha(h)}</div><div class="l">RACHA ACTUAL</div></div>
        <div class="stat-card"><div class="n">${rachaMaxima(h)}</div><div class="l">RACHA MÁXIMA</div></div>
      </div>
      <div class="tracker-wrap">
        <div class="tracker-head">
          <button class="icon-btn sm" data-anio="-1">‹</button>
          <strong>${anio}</strong>
          <button class="icon-btn sm" data-anio="1">›</button>
          <button class="icon-btn sm" data-orient="1" title="Girar el tracker">⟳</button>
        </div>
        ${trackerHTML(h, anio)}
      </div>
      <button class="btn primary block" style="margin-top:16px" data-hoy="1">Marcar hoy</button>
      <p class="swipe-hint">Toca cualquier cuadradito para marcar ese día</p>`;
  }

  function detalle(hid) {
    const h = S().habitos.find(x => x.id === hid); if (!h) return;
    let anio = new Date().getFullYear();
    const s = UI.screen({
      titulo: h.emoji + '  ' + h.nombre,
      html: cuerpoDetalle(h, anio),
      acciones: [
        { txt: '✏️', fn: () => formHabito(hid) },
        { txt: '📤', fn: () => U.compartir(resumenTexto(h, anio), h.nombre) }
      ],
      onMount: sc => bindDetalle(sc),
      onClose: () => { det = null; App.render(); }
    });
    det = { el: s.el, hid };

    function repintar() {
      s.el.querySelector('.screen-body').innerHTML = cuerpoDetalle(h, anio);
      bindDetalle(s.el);
    }
    function bindDetalle(sc) {
      sc.querySelectorAll('[data-anio]').forEach(b => b.onclick = () => { anio += Number(b.dataset.anio); repintar(); });
      sc.querySelector('[data-orient]').onclick = () => {
        S().ajustes.trackerOrientacion = (S().ajustes.trackerOrientacion || 'vertical') === 'vertical' ? 'horizontal' : 'vertical';
        Store.save(); repintar();
      };
      sc.querySelector('[data-hoy]').onclick = () => togglear(h, U.hoyISO(), repintar);
      sc.querySelectorAll('.tk-c[data-f]').forEach(c => c.onclick = () => togglear(h, c.dataset.f, repintar));
    }
  }

  function resumenTexto(h, anio) {
    let out = `*${h.emoji} ${h.nombre}*\n> ${conteoAnio(h, anio)} días en ${anio} · racha 🔥 ${racha(h)}\n`;
    for (let m = 0; m < 12; m++) {
      const n = Object.keys(S().registros[h.id] || {}).filter(f => f.startsWith(anio + '-' + U.pad(m + 1))).length;
      if (n) out += `- ${U.MESES[m]}: ${n} días\n`;
    }
    return out.trimEnd();
  }

  /* ---------- formulario ---------- */
  function formHabito(hid) {
    const h = hid ? S().habitos.find(x => x.id === hid) : null;
    let emoji = h ? h.emoji : '🌱';
    let color = h ? h.color : '#a8d8c8';
    let niveles = h ? JSON.parse(JSON.stringify(h.niveles)) : [{ id: 'n1', etiqueta: 'Hecho', color: '#a8d8c8' }];

    const nivelesHTML = () => niveles.map((n, i) => `
      <div class="nivel-row" data-i="${i}">
        <input class="nv-txt" value="${U.esc(n.etiqueta)}" placeholder="Ej: menos de 30 min">
        <button type="button" class="nv-color" style="background:${n.color}" data-ci="${i}"></button>
        ${niveles.length > 1 ? `<button type="button" class="icon-btn sm nv-del" data-di="${i}">✕</button>` : ''}
      </div>`).join('');

    UI.modal({
      titulo: h ? 'Editar hábito' : 'Nuevo Hábito',
      html: `
        <div class="field"><label>Nombre</label>
          <input id="h-nom" placeholder="Leer, crochet, ejercicio..." value="${h ? U.esc(h.nombre) : ''}"></div>
        <div class="field"><label>Emoji</label>${UI.emojiPicker(emoji)}</div>
        <div class="field"><label>Color de la tarjeta</label>${UI.colorPicker(color)}</div>
        <div class="field"><label>Niveles de cumplimiento</label>
          <div id="niveles">${nivelesHTML()}</div>
          <button type="button" class="add-tarea" id="add-nivel" style="margin-top:8px">+ Agregar nivel</button>
          <p style="font-size:12px;color:var(--ink-faint);margin:8px 0 0">Con un solo nivel, el hábito se marca con un toque. Con varios, eliges cómo lo cumpliste.</p>
        </div>`,
      onMount: (ov) => {
        UI.bindPicker(ov, 'emoji', v => emoji = v);
        UI.bindPicker(ov, 'color', v => color = v);
        const cont = ov.querySelector('#niveles');
        const repintar = () => { cont.innerHTML = nivelesHTML(); bindNiveles(); };
        const leer = () => cont.querySelectorAll('.nivel-row').forEach((r, i) => {
          niveles[i].etiqueta = r.querySelector('.nv-txt').value;
        });
        function bindNiveles() {
          cont.querySelectorAll('.nv-txt').forEach(i => i.oninput = () => leer());
          cont.querySelectorAll('.nv-del').forEach(b => b.onclick = () => {
            leer(); niveles.splice(+b.dataset.di, 1); repintar();
          });
          cont.querySelectorAll('.nv-color').forEach(b => b.onclick = () => {
            leer();
            const i = +b.dataset.ci;
            const act = UI.COLORES.indexOf(niveles[i].color);
            niveles[i].color = UI.COLORES[(act + 1) % UI.COLORES.length];
            repintar();
          });
        }
        bindNiveles();
        ov.querySelector('#add-nivel').onclick = () => {
          leer();
          niveles.push({ id: 'n' + (Date.now().toString(36)), etiqueta: '',
                         color: UI.COLORES[niveles.length % UI.COLORES.length] });
          repintar();
        };
      },
      acciones: [
        ...(h ? [{ txt: 'Eliminar', clase: 'btn danger', fn: () => {
            U.confirmar('Se borrará "' + h.nombre + '" y todo su historial.', () => {
              S().habitos = S().habitos.filter(x => x.id !== h.id);
              delete S().registros[h.id];
              Store.save();
              document.querySelectorAll('.screen').forEach(s => s.remove());
              App.render(); U.toast('Hábito eliminado');
            });
          } }] : []),
        { txt: h ? 'Guardar' : 'Crear', clase: 'btn primary', fn: ov => {
            const nom = ov.querySelector('#h-nom').value.trim();
            if (!nom) { U.toast('Ponle un nombre'); return false; }
            ov.querySelectorAll('.nivel-row').forEach((r, i) => niveles[i].etiqueta = r.querySelector('.nv-txt').value.trim());
            niveles = niveles.filter(n => n.etiqueta);
            if (!niveles.length) niveles = [{ id: 'n1', etiqueta: 'Hecho', color }];
            if (h) {
              Object.assign(h, { nombre: nom, emoji, color, niveles });
              // los registros con niveles borrados pasan al primero
              const ids = niveles.map(n => n.id);
              const reg = S().registros[h.id] || {};
              Object.keys(reg).forEach(f => { if (!ids.includes(reg[f])) reg[f] = niveles[0].id; });
            } else {
              crearHabito({ nombre: nom, emoji, color, niveles });
            }
            Store.save(); App.render();
            const d = det && S().habitos.find(x => x.id === det.hid);
            if (d) { det.el.remove(); det = null; detalle(d.id); }
          } }
      ]
    });
  }

  return { render, formHabito, crearHabito, detalle, trackerHTML, racha, rachaMaxima,
           conteoAnio, conteoRango, hecho, nivelDe, marcar };
})();
