/* =========================================================
   ORGANIGRAMA / GANTT
   ---------------------------------------------------------
   Rendimiento: cada fila NO tiene una casilla por columna.
   Tiene una sola "pista" con la rejilla dibujada por CSS y una
   barra absoluta por tarea. Así una vista de 1200 columnas usa
   unos pocos cientos de nodos y el scroll no redibuja nada.

   Modelo: la planificación se guarda como FECHAS (planInicio /
   planFin); los índices de columna se recalculan a partir de ellas,
   así el pintado sobrevive a un cambio de unidad de tiempo.
   ========================================================= */
const Gantt = (() => {
  const S = () => Store.state();
  const CELL_W = 24;                 // ancho de columna, igual que en el CSS
  let ref = null;                    // { el, proyectoId, cols, idx }

  /* ---------- modelo ---------- */
  function columnas(p) {
    return U.generarColumnas(p.fechaInicio, p.fechaFin, p.unidadTiempo, S().ajustes.inicioSemana);
  }
  function proyectoDeTarea(t) {
    const sec = S().secciones.find(s => s.id === t.seccionId);
    return sec ? sec.proyectoId : null;
  }

  /* primera columna cuyo final es >= fecha (binaria: las columnas van en orden) */
  function buscarCol(cols, fecha) {
    let lo = 0, hi = cols.length - 1, r = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (cols[m].fin >= fecha) { r = m; hi = m - 1; } else lo = m + 1;
    }
    return r;
  }

  function indicesDe(t, cols) {
    if (!cols || !cols.length) return null;
    if (t.tipo === 'fija') {
      const i = U.indiceDeFecha(cols, t.fechaFija, t.horaFija);
      if (i < 0) return null;
      let fin = i;
      if (t.duracionMinutos) {
        const base = U.fromISO(t.fechaFija);
        if (t.horaFija) { const [h, m] = t.horaFija.split(':').map(Number); base.setHours(h, m, 0, 0); }
        const end = new Date(base.getTime() + t.duracionMinutos * 60000);
        while (fin + 1 < cols.length && end > cols[fin + 1].inicio) fin++;
      }
      return { ini: i, fin: Math.max(i, fin) };
    }
    if (!t.planInicio || !t.planFin) return null;
    const a = U.fromISO(t.planInicio); a.setHours(0, 0, 0, 0);
    const b = U.fromISO(t.planFin); b.setHours(23, 59, 59, 999);
    if (t.planHoraInicio) { const [h, m] = t.planHoraInicio.split(':').map(Number); a.setHours(h, m, 0, 0); }
    if (t.planHoraFin) { const [h, m] = t.planHoraFin.split(':').map(Number); b.setHours(h, m, 59, 999); }
    const ini = buscarCol(cols, a);
    if (ini < 0 || cols[ini].inicio > b) return null;
    let fin = ini;
    while (fin + 1 < cols.length && cols[fin + 1].inicio <= b) fin++;
    return { ini, fin };
  }

  /* caché por tarea: no se recalcula en cada dibujado */
  function idxDe(t) {
    if (!ref) return null;
    if (!ref.idx) ref.idx = new Map();
    if (!ref.idx.has(t.id)) ref.idx.set(t.id, indicesDe(t, ref.cols));
    return ref.idx.get(t.id);
  }
  function olvidar(id) { if (ref && ref.idx) { if (id) ref.idx.delete(id); else ref.idx = new Map(); } }

  function guardarPintado(t, cols, i0, i1) {
    const a = Math.min(i0, i1), b = Math.max(i0, i1);
    const p = S().proyectos.find(x => x.id === proyectoDeTarea(t));
    t.planInicio = U.toISO(cols[a].inicio);
    t.planFin = U.toISO(cols[b].fin);
    if (p && p.unidadTiempo === 'hora') {
      t.planHoraInicio = U.pad(cols[a].inicio.getHours()) + ':00';
      t.planHoraFin = U.pad(cols[b].fin.getHours()) + ':59';
    } else { t.planHoraInicio = null; t.planHoraFin = null; }
    t.inicioIndice = a; t.finIndice = b;
    olvidar(t.id); Store.save();
  }

  function limpiarPintado(t) {
    t.planInicio = null; t.planFin = null; t.planHoraInicio = null; t.planHoraFin = null;
    t.inicioIndice = null; t.finIndice = null;
    olvidar(t.id); Store.save();
  }

  /* ---------- dibujado ---------- */
  function anchoNombre() { return S().ajustes.anchoTareas === 'amplio' ? 230 : 148; }

  function barraHTML(t) {
    const idx = idxDe(t);
    if (!idx) return '';
    const left = idx.ini * CELL_W;
    const w = (idx.fin - idx.ini + 1) * CELL_W;
    if (t.tipo === 'fija') {
      return `<i class="barra fija" data-t="${t.id}" style="left:${left}px;width:${w}px"
              title="Fija: ${U.esc(U.fechaCorta(t.fechaFija))} ${U.esc(U.hora12(t.horaFija))}">📌</i>`;
    }
    const c = U.esc(t.color || S().ajustes.colorDefecto);
    return `<i class="barra" data-t="${t.id}" style="left:${left}px;width:${w}px;background:${c}"></i>`;
  }

  function filaHTML(t, ancho) {
    const fuera = t.tipo === 'fija' && !idxDe(t);
    return `<tr data-row="${t.id}">
      <td class="g-name${t.completada ? ' done' : ''}" data-name="${t.id}">
        <span class="drag">⣿</span><span class="t">${U.esc(t.titulo)}</span>${t.tipo === 'fija' ? '<span class="pin">📌</span>' : ''}${fuera ? '<span class="pin" title="Su fecha está fuera del periodo">⚠️</span>' : ''}
      </td>
      <td class="g-track" data-t="${t.id}" style="width:${ancho}px;min-width:${ancho}px">${barraHTML(t)}</td>
    </tr>`;
  }

  function tablaHTML(p, cols) {   // p se usa también para la unidad
    if (!cols.length) return '<div class="empty"><p>Revisa las fechas del proyecto.</p></div>';
    const n = cols.length, ancho = n * CELL_W;
    const grupos = U.agruparColumnas(cols);
    const hoy = new Date();
    const colHoy = S().ajustes.resaltarHoy ? cols.findIndex(c => hoy >= c.inicio && hoy <= c.fin) : -1;

    let h = `<table class="gantt-table"><thead>
      <tr><th class="g-corner g-corner-1"><span style="font-size:10.5px;opacity:.7">TAREAS</span></th>
      <th class="g-months" style="width:${ancho}px;min-width:${ancho}px">`;
    grupos.forEach(g => {
      h += `<span style="left:${g.desde * CELL_W}px;width:${g.span * CELL_W}px">${U.esc(g.label)}</span>`;
    });
    h += `</th></tr><tr><th class="g-corner g-corner-2"></th>
      <th class="g-units" style="width:${ancho}px;min-width:${ancho}px">`;
    // en rangos muy largos (o con etiquetas anchas) se rotulan de N en N:
    // ni se leerían todas ni tiene sentido crear miles de nodos
    const paso = Math.max(1, Math.ceil(n / 400), p.unidadTiempo === 'fecha' ? 3 : 1);
    for (let i = 0; i < n; i += paso) {
      const hoyAqui = colHoy >= i && colHoy < i + paso;
      h += `<span class="${hoyAqui ? 'today' : ''}" style="left:${i * CELL_W}px;width:${paso * CELL_W}px">${U.esc(cols[i].label)}</span>`;
    }
    h += '</th></tr></thead><tbody>';

    Proyectos.secciones(p.id).forEach(sec => {
      h += `<tr class="g-section${sec.colapsada ? ' collapsed' : ''}" data-sec="${sec.id}">
        <td colspan="2"><span style="position:sticky;left:12px;display:inline-block">
          <span class="caret">▼</span>${U.esc(sec.titulo)}</span></td></tr>`;
      if (sec.colapsada) return;
      Proyectos.tareasDe(sec.id).forEach(t => { h += filaHTML(t, ancho); });
    });
    return h + '</tbody></table>';
  }

  /* rejilla, fines de semana y línea de hoy: puro CSS, sin nodos */
  function estiloRejilla(p, cols) {
    const e = { '--cell': CELL_W + 'px' };
    const unidad = p.unidadTiempo;
    if ((unidad === 'dia' || unidad === 'fecha') && cols.length) {
      const d0 = cols[0].inicio.getDay();                 // 0 = domingo
      e['--finde1'] = ((6 - d0 + 7) % 7) * CELL_W + 'px'; // sábado
      e['--finde2'] = ((7 - d0) % 7) * CELL_W + 'px';     // domingo
      e['--semana'] = (7 * CELL_W) + 'px';
      e['--finde-on'] = '1';
    } else { e['--finde-on'] = '0'; }
    const hoy = new Date();
    const i = S().ajustes.resaltarHoy ? cols.findIndex(c => hoy >= c.inicio && hoy <= c.fin) : -1;
    e['--hoy-x'] = i >= 0 ? (i * CELL_W) + 'px' : '-999px';
    return Object.entries(e).map(([k, v]) => `${k}:${v}`).join(';');
  }

  function cuerpo(p) {
    return `
      <div class="gantt-controls">
        ${[['hora','Hora'],['dia','Día'],['semana','Semana'],['mes','Mes'],['fecha','Fecha exacta']].map(([k, l]) =>
          `<button class="neu-chip${p.unidadTiempo === k ? ' active' : ''}" data-uni="${k}">${l}</button>`).join('')}
        <button class="neu-chip" data-ancho="1">↔ ${S().ajustes.anchoTareas === 'amplio' ? 'Amplio' : 'Compacto'}</button>
        <button class="neu-chip" data-fechas="1">📅 ${U.fechaMini(p.fechaInicio)} — ${U.fechaMini(p.fechaFin)}</button>
      </div>
      <div class="gantt-wrap" style="--col-nombre:${anchoNombre()}px">
        <div class="gantt-scroll"></div></div>
      <div class="gantt-legend">
        <span><i style="background:${S().ajustes.colorDefecto}"></i> Planificado</span>
        <span><i style="background:var(--gantt-fija)"></i> Fija 📌</span>
        <span><i style="background:var(--neu-cell)"></i> Libre</span>
      </div>
      <div class="gantt-foot">
        <button class="btn sm menta" data-add-tarea="1">+ Tarea planificada</button>
        <button class="btn sm" data-add-fija="1">📌 Tarea fija</button>
        <button class="btn sm" data-add-sec="1">+ Sección</button>
      </div>
      <p class="swipe-hint" style="padding:0 16px 24px">Arrastra sobre la fila para pintar · mantén pulsado el nombre para mover la tarea</p>`;
  }

  function pintarTabla(p) {
    if (!ref || !ref.el) return;
    const scroller = ref.el.querySelector('.gantt-scroll');
    if (!scroller) return;
    const cols = ref.cols || (ref.cols = columnas(p));
    scroller.innerHTML = tablaHTML(p, cols);
    const tabla = scroller.querySelector('.gantt-table');
    if (tabla) tabla.setAttribute('style', estiloRejilla(p, cols));
    bindTabla(scroller, p, cols);
  }

  function refrescar(pid) {
    if (!ref || ref.proyectoId !== pid || !document.body.contains(ref.el)) return;
    const p = S().proyectos.find(x => x.id === pid); if (!p) return;
    const viejo = ref.el.querySelector('.gantt-scroll');
    const x = viejo ? viejo.scrollLeft : 0, y = viejo ? viejo.scrollTop : 0;
    ref.cols = columnas(p); olvidar();
    ref.el.querySelector('.screen-body').innerHTML = cuerpo(p);
    ref.el.querySelector('h2').textContent = p.nombre;
    bind(ref.el, p);
    pintarTabla(p);
    const nuevo = ref.el.querySelector('.gantt-scroll');
    if (nuevo) { nuevo.scrollLeft = x; nuevo.scrollTop = y; }
  }

  /* solo la barra de una tarea: lo más barato posible */
  function repintarFila(p, tareaId) {
    if (!ref || !ref.el) return;
    const t = S().tareasProyecto.find(x => x.id === tareaId);
    const pista = ref.el.querySelector(`.g-track[data-t="${tareaId}"]`);
    if (!t || !pista) { refrescar(p.id); return; }
    olvidar(t.id);
    pista.innerHTML = barraHTML(t);
  }

  /* ---------- interacción ---------- */
  function bind(sc, p) {
    sc.querySelectorAll('[data-uni]').forEach(b => b.onclick = () => {
      p.unidadTiempo = b.dataset.uni; Store.save(); refrescar(p.id);
    });
    const ab = sc.querySelector('[data-ancho]');
    if (ab) ab.onclick = () => {
      S().ajustes.anchoTareas = S().ajustes.anchoTareas === 'amplio' ? 'compacto' : 'amplio';
      Store.save(); refrescar(p.id);
    };
    const fb = sc.querySelector('[data-fechas]');
    if (fb) fb.onclick = () => Proyectos.formProyecto(p.id);
    const addT = sc.querySelector('[data-add-tarea]');
    if (addT) addT.onclick = () => formTarea(p.id, null, 'planificada');
    const addF = sc.querySelector('[data-add-fija]');
    if (addF) addF.onclick = () => formTarea(p.id, null, 'fija');
    const addS = sc.querySelector('[data-add-sec]');
    if (addS) addS.onclick = () => formSeccion(p.id);
  }

  function bindTabla(scroller, p, cols) {
    scroller.querySelectorAll('[data-name]').forEach(td => bindNombre(td, p, scroller));
    scroller.querySelectorAll('.g-section').forEach(tr => U.bindTap(tr, {
      tap: () => {
        const sec = S().secciones.find(x => x.id === tr.dataset.sec); if (!sec) return;
        sec.colapsada = !sec.colapsada; Store.save(); pintarTabla(p);
      },
      hold: () => formSeccion(p.id, tr.dataset.sec),
      msHold: 500
    }));
    bindPintado(scroller, p, cols);
  }

  function bindNombre(td, p, scroller) {
    let hold = null, dragging = false, startY = 0, activo = false;
    const id = td.dataset.name;
    const limpiar = () => {
      clearTimeout(hold); hold = null;
      scroller.querySelectorAll('tr').forEach(r => r.style.outline = '');
      if (dragging) document.body.style.userSelect = '';
      dragging = false;
    };
    td.addEventListener('pointerdown', e => {
      activo = true; startY = e.clientY;
      try { td.setPointerCapture(e.pointerId); } catch (err) {}
      hold = setTimeout(() => {
        if (!activo) return;
        dragging = true; U.haptic('MEDIUM');
        td.closest('tr').style.opacity = '.5';
        document.body.style.userSelect = 'none';
      }, 400);
    });
    td.addEventListener('pointermove', e => {
      if (!activo) return;
      if (!dragging) { if (Math.abs(e.clientY - startY) > 8) { clearTimeout(hold); hold = null; } return; }
      e.preventDefault();
      const cont = scroller;
      const r = cont.getBoundingClientRect();
      if (e.clientY < r.top + 46) cont.scrollTop -= 12;
      else if (e.clientY > r.bottom - 46) cont.scrollTop += 12;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const fila = el && el.closest('tr[data-row], tr.g-section');
      scroller.querySelectorAll('tr').forEach(r2 => r2.style.outline = '');
      if (fila) fila.style.outline = '2px dashed var(--accent)';
    });
    const soltar = e => {
      try { if (td.hasPointerCapture && td.hasPointerCapture(e.pointerId)) td.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!activo) { limpiar(); return; }
      activo = false;
      const eraDrag = dragging;
      const el = eraDrag ? document.elementFromPoint(e.clientX, e.clientY) : null;
      const fila = el && el.closest('tr[data-row], tr.g-section');
      td.closest('tr').style.opacity = '';
      limpiar();
      if (eraDrag) { if (fila) moverTarea(id, fila, p); return; }
      formTarea(p.id, id);
    };
    td.addEventListener('pointerup', soltar);
    td.addEventListener('pointercancel', () => { activo = false; td.closest('tr').style.opacity = ''; limpiar(); });
  }

  function moverTarea(id, filaDestino, p) {
    const t = S().tareasProyecto.find(x => x.id === id); if (!t) return;
    if (filaDestino.classList.contains('g-section')) {
      if (filaDestino.dataset.sec === t.seccionId) return;
      t.seccionId = filaDestino.dataset.sec; t.orden = -1;
    } else {
      const destino = S().tareasProyecto.find(x => x.id === filaDestino.dataset.row);
      if (!destino || destino.id === t.id) return;
      t.seccionId = destino.seccionId;
      t.orden = (destino.orden || 0) + 0.5;
    }
    Proyectos.secciones(p.id).forEach(sec => Proyectos.tareasDe(sec.id).forEach((x, i) => x.orden = i));
    Store.save(); pintarTabla(p); U.haptic('LIGHT');
  }

  /* pintar arrastrando sobre la pista: solo se mueve UNA barra de previsualización */
  function bindPintado(scroller, p, cols) {
    const tabla = scroller.querySelector('.gantt-table');
    if (!tabla) return;
    let g = null;   // { t, pista, i0, i1, prev, x0, y0 }

    const colDe = (pista, clientX) => {
      const r = pista.getBoundingClientRect();
      return Math.max(0, Math.min(cols.length - 1, Math.floor((clientX - r.left) / CELL_W)));
    };
    const dibujarPrev = () => {
      const a = Math.min(g.i0, g.i1), b = Math.max(g.i0, g.i1);
      g.prev.style.left = (a * CELL_W) + 'px';
      g.prev.style.width = ((b - a + 1) * CELL_W) + 'px';
    };
    const cancelar = () => { if (g && g.prev) g.prev.remove(); g = null; };

    tabla.addEventListener('dragstart', e => e.preventDefault());

    tabla.addEventListener('pointerdown', e => {
      const pista = e.target.closest('.g-track'); if (!pista) return;
      const t = S().tareasProyecto.find(x => x.id === pista.dataset.t); if (!t) return;
      if (e.cancelable) e.preventDefault();
      if (t.tipo === 'fija') { U.toast('Es una tarea fija: cambia su fecha en el formulario'); return; }
      const barra = e.target.closest('.barra');
      if (barra) { popupBarra(t, colDe(pista, e.clientX), p, cols); return; }
      const i = colDe(pista, e.clientX);
      const prev = document.createElement('i');
      prev.className = 'barra previa';
      prev.style.background = t.color || S().ajustes.colorDefecto;
      pista.appendChild(prev);
      g = { t, pista, i0: i, i1: i, prev, x0: e.clientX, y0: e.clientY };
      dibujarPrev();
      try { pista.setPointerCapture(e.pointerId); } catch (err) {}
      U.haptic('LIGHT');
    });

    tabla.addEventListener('pointermove', e => {
      if (!g) return;
      const dx = Math.abs(e.clientX - g.x0), dy = Math.abs(e.clientY - g.y0);
      if (dy > 14 && dy > dx) { cancelar(); return; }   // es un scroll vertical, no pintura
      e.preventDefault();
      const i = colDe(g.pista, e.clientX);
      if (i !== g.i1) { g.i1 = i; dibujarPrev(); }
    }, { passive: false });

    const fin = () => {
      if (!g) return;
      const t = g.t, i0 = g.i0, i1 = g.i1;
      cancelar();
      guardarPintado(t, cols, i0, i1);
      repintarFila(p, t.id);
    };
    tabla.addEventListener('pointerup', fin);
    tabla.addEventListener('pointercancel', cancelar);
  }

  function popupBarra(t, i, p, cols) {
    const idx = idxDe(t);
    const rango = idx ? `${U.esc(cols[idx.ini].grupo)} ${cols[idx.ini].label} → ${U.esc(cols[idx.fin].grupo)} ${cols[idx.fin].label}` : '—';
    UI.modal({
      titulo: t.titulo, centrado: true,
      html: `<p style="margin:0 0 6px;color:var(--ink-soft);font-size:13.5px">📍 ${rango}</p>
             <p style="margin:0;color:var(--ink-faint);font-size:12.5px">${U.fechaMini(t.planInicio)} — ${U.fechaMini(t.planFin)}</p>`,
      acciones: [
        { txt: 'Recortar aquí', clase: 'btn', fn: () => {
            if (!idx) return;
            if (i === idx.ini && i === idx.fin) limpiarPintado(t);
            else if (i === idx.ini) guardarPintado(t, cols, i + 1, idx.fin);
            else guardarPintado(t, cols, idx.ini, i - 1);
            repintarFila(p, t.id);
          } },
        { txt: 'Borrar pintado', clase: 'btn danger', fn: () => { limpiarPintado(t); repintarFila(p, t.id); } },
        { txt: 'Editar', clase: 'btn primary', fn: () => formTarea(p.id, t.id) }
      ]
    });
  }

  /* ---------- formularios ---------- */
  function formSeccion(pid, sid) {
    const sec = sid ? S().secciones.find(s => s.id === sid) : null;
    UI.modal({
      titulo: sec ? 'Editar sección' : 'Nueva sección',
      html: `<div class="field"><label>Título</label>
        <input id="s-tit" placeholder="Primera Predefensa, Entrega..." value="${sec ? U.esc(sec.titulo) : ''}"></div>`,
      acciones: [
        ...(sec ? [{ txt: 'Eliminar', clase: 'btn danger', fn: () => {
            U.confirmar('Se borrará la sección y sus tareas.', () => {
              S().tareasProyecto = S().tareasProyecto.filter(t => t.seccionId !== sec.id);
              S().secciones = S().secciones.filter(s => s.id !== sec.id);
              Store.save(); refrescar(pid); App.render();
            });
          } }] : []),
        { txt: sec ? 'Guardar' : 'Crear', clase: 'btn primary', fn: ov => {
            const v = ov.querySelector('#s-tit').value.trim();
            if (!v) { U.toast('Escribe un título'); return false; }
            if (sec) sec.titulo = v;
            else S().secciones.push({ id: Store.uid('sec'), proyectoId: pid, titulo: v,
                                      orden: Proyectos.secciones(pid).length, colapsada: false });
            Store.save(); refrescar(pid);
          } }
      ]
    });
  }

  function formTarea(pid, tid, tipoNuevo) {
    const t = tid ? S().tareasProyecto.find(x => x.id === tid) : null;
    const tipo = t ? t.tipo : (tipoNuevo || 'planificada');
    const secs = Proyectos.secciones(pid);
    if (!secs.length) { U.toast('Crea una sección primero'); return; }
    let color = t ? (t.color || S().ajustes.colorDefecto) : S().ajustes.colorDefecto;

    const campoFija = `
      <div class="field-row">
        <div class="field"><label>Fecha exacta</label>
          <input type="date" id="t-ff" value="${t ? (t.fechaFija || '') : ''}"></div>
        <div class="field"><label>Hora</label>
          <input type="time" id="t-hf" value="${t ? (t.horaFija || '09:00') : '09:00'}"></div>
      </div>
      <div class="field"><label>Duración (minutos)</label>
        <input type="number" id="t-dur" min="0" step="15" value="${t ? (t.duracionMinutos || 60) : 60}"></div>`;

    const campoPlan = `
      <div class="field"><label>Color</label>${UI.colorPicker(color)}</div>
      <p style="font-size:12.5px;color:var(--ink-faint);margin:0 0 4px">Después pinta su fila en el organigrama arrastrando.</p>`;

    UI.modal({
      titulo: t ? 'Editar tarea' : (tipo === 'fija' ? '📌 Nueva tarea fija' : 'Nueva tarea planificada'),
      html: `
        <div class="field"><label>Título</label>
          <input id="t-tit" placeholder="${tipo === 'fija' ? 'Reunión con cliente, Entrega Final...' : 'Diseño de la identidad...'}" value="${t ? U.esc(t.titulo) : ''}"></div>
        <div class="field"><label>Sección</label>
          <select id="t-sec">${secs.map(s =>
            `<option value="${s.id}"${t && t.seccionId === s.id ? ' selected' : ''}>${U.esc(s.titulo)}</option>`).join('')}</select></div>
        ${tipo === 'fija' ? campoFija : campoPlan}
        <div class="setting" style="border:0"><span class="lbl">Completada</span>
          <div class="switch${t && t.completada ? ' on' : ''}" id="t-done"><i></i></div></div>`,
      onMount: ov => {
        UI.bindPicker(ov, 'color', v => color = v);
        const sw = ov.querySelector('#t-done');
        sw.onclick = () => sw.classList.toggle('on');
      },
      acciones: [
        ...(t ? [{ txt: 'Eliminar', clase: 'btn danger', fn: () => {
            U.confirmar('Eliminar "' + t.titulo + '"', () => {
              S().tareasProyecto = S().tareasProyecto.filter(x => x.id !== t.id);
              Store.save(); olvidar(t.id); refrescar(pid); App.render();
            });
          } }] : []),
        { txt: t ? 'Guardar' : 'Crear', clase: 'btn primary', fn: ov => {
            const tit = ov.querySelector('#t-tit').value.trim();
            if (!tit) { U.toast('Escribe el título'); return false; }
            const base = {
              titulo: tit,
              seccionId: ov.querySelector('#t-sec').value,
              completada: ov.querySelector('#t-done').classList.contains('on')
            };
            if (tipo === 'fija') {
              const ff = ov.querySelector('#t-ff').value;
              if (!ff) { U.toast('La tarea fija necesita fecha'); return false; }
              Object.assign(base, {
                tipo: 'fija', fechaFija: ff, horaFija: ov.querySelector('#t-hf').value || '09:00',
                duracionMinutos: parseInt(ov.querySelector('#t-dur').value || '60', 10), color: null
              });
              const pr = S().proyectos.find(x => x.id === pid);
              if (ff < pr.fechaInicio || ff > pr.fechaFin) U.toast('Ojo: esa fecha queda fuera del periodo del proyecto');
            } else {
              Object.assign(base, { tipo: 'planificada', color });
            }
            if (t) { Object.assign(t, base); olvidar(t.id); }
            else S().tareasProyecto.push(Object.assign({
              id: Store.uid('tp'), planInicio: null, planFin: null,
              orden: Proyectos.tareasDe(base.seccionId).length
            }, base));
            Store.save(); refrescar(pid); App.render();
          } }
      ]
    });
  }

  /* ---------- abrir ---------- */
  function abrir(pid) {
    const p = S().proyectos.find(x => x.id === pid); if (!p) return;
    UI.screen({
      titulo: p.nombre,
      clase: 'gantt-screen',
      flush: true,
      html: cuerpo(p),
      acciones: [
        { txt: '⚙️', fn: () => Proyectos.formProyecto(p.id) },
        { txt: '📤', fn: () => U.compartir(resumenTexto(p), p.nombre) }
      ],
      onMount: sc => {
        ref = { el: sc, proyectoId: pid, cols: columnas(p), idx: new Map() };
        bind(sc, p);
        pintarTabla(p);
      },
      onClose: () => { ref = null; App.render(); }
    });
  }

  function resumenTexto(p) {
    const cols = columnas(p);
    const pr = Proyectos.progreso(p.id);
    let out = `*${p.nombre}*\n> ${U.fechaMini(p.fechaInicio)} — ${U.fechaMini(p.fechaFin)} · ${pr.pct}% completado\n`;
    Proyectos.secciones(p.id).forEach(sec => {
      const ts = Proyectos.tareasDe(sec.id);
      if (!ts.length) return;
      out += `\n*${sec.titulo}*\n`;
      ts.forEach(t => {
        let extra = '';
        if (t.tipo === 'fija') extra = ` - *📌 ${U.fechaCorta(t.fechaFija)} ${U.hora12(t.horaFija)}*`;
        else if (indicesDe(t, cols)) extra = ` - _${U.fechaMini(t.planInicio)} a ${U.fechaMini(t.planFin)}_`;
        out += t.completada ? `- ~✅${t.titulo}~\n` : `- ${t.titulo}${extra}\n`;
      });
    });
    return out.trimEnd();
  }

  return { abrir, refrescar, formTarea, formSeccion, indicesDe, columnas, resumenTexto };
})();
