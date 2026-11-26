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

  /* tramos pintados de una tarea planificada: lista de {a, b, ha, hb} (fechas ISO y horas opcionales).
     Las tareas guardadas antes de las "casillas sueltas" solo tienen planInicio/planFin: se leen como un tramo. */
  function segsDe(t) {
    if (Array.isArray(t.segmentos) && t.segmentos.length) return t.segmentos;
    if (t.planInicio && t.planFin) return [{ a: t.planInicio, b: t.planFin, ha: t.planHoraInicio || null, hb: t.planHoraFin || null }];
    return [];
  }
  function fechasSeg(sg) {
    const a = U.fromISO(sg.a); a.setHours(0, 0, 0, 0);
    const b = U.fromISO(sg.b); b.setHours(23, 59, 59, 999);
    if (sg.ha) { const [h, m] = sg.ha.split(':').map(Number); a.setHours(h, m, 0, 0); }
    if (sg.hb) { const [h, m] = sg.hb.split(':').map(Number); b.setHours(h, m, 59, 999); }
    return { a, b };
  }
  /* columnas que cubre un tramo (null si queda fuera del periodo) */
  function rangoSeg(sg, cols) {
    const { a, b } = fechasSeg(sg);
    const ini = buscarCol(cols, a);
    if (ini < 0 || cols[ini].inicio > b) return null;
    let fin = ini;
    while (fin + 1 < cols.length && cols[fin + 1].inicio <= b) fin++;
    return { ini, fin };
  }

  /* devuelve SIEMPRE una lista de rangos {ini, fin}: vacía si no hay nada que dibujar */
  function indicesDe(t, cols) {
    if (!cols || !cols.length) return [];
    if (t.tipo === 'fija') {
      const i = U.indiceDeFecha(cols, t.fechaFija, t.horaFija);
      if (i < 0) return [];
      let fin = i;
      if (t.duracionMinutos) {
        const base = U.fromISO(t.fechaFija);
        if (t.horaFija) { const [h, m] = t.horaFija.split(':').map(Number); base.setHours(h, m, 0, 0); }
        const end = new Date(base.getTime() + t.duracionMinutos * 60000);
        while (fin + 1 < cols.length && end > cols[fin + 1].inicio) fin++;
      }
      return [{ ini: i, fin: Math.max(i, fin) }];
    }
    return segsDe(t).map(sg => rangoSeg(sg, cols)).filter(Boolean).sort((x, y) => x.ini - y.ini);
  }

  /* caché por tarea: no se recalcula en cada dibujado */
  function idxDe(t) {
    if (!ref) return null;
    if (!ref.idx) ref.idx = new Map();
    if (!ref.idx.has(t.id)) ref.idx.set(t.id, indicesDe(t, ref.cols));
    return ref.idx.get(t.id);
  }
  function olvidar(id) { if (ref && ref.idx) { if (id) ref.idx.delete(id); else ref.idx = new Map(); } }

  /* guarda los tramos y deja planInicio/planFin como el rango total (para el resumen y para versiones antiguas) */
  function guardarSegs(t, segs) {
    segs = segs.slice().sort((x, y) => fechasSeg(x).a - fechasSeg(y).a);
    t.segmentos = segs;
    if (!segs.length) {
      t.planInicio = t.planFin = t.planHoraInicio = t.planHoraFin = null;
    } else {
      const primero = segs[0];
      const ultimo = segs.reduce((m, x) => (fechasSeg(x).b > fechasSeg(m).b ? x : m), segs[0]);
      t.planInicio = primero.a; t.planHoraInicio = primero.ha || null;
      t.planFin = ultimo.b;     t.planHoraFin = ultimo.hb || null;
    }
    t.inicioIndice = null; t.finIndice = null;
    olvidar(t.id); Store.save();
  }

  /* un toque en una casilla: vacía → se pinta; pintada → se borra (solo esa casilla) */
  function alternarCelda(t, i, cols, p) {
    const hora = p.unidadTiempo === 'hora';
    const celda = c => ({
      a: U.toISO(cols[c].inicio), b: U.toISO(cols[c].fin),
      ha: hora ? U.pad(cols[c].inicio.getHours()) + ':00' : null,
      hb: hora ? U.pad(cols[c].fin.getHours()) + ':59' : null
    });
    const segs = segsDe(t).map(x => Object.assign({}, x));
    const rs = segs.map(sg => ({ sg, r: rangoSeg(sg, cols) }));
    const dentro = rs.find(x => x.r && i >= x.r.ini && i <= x.r.fin);
    let nuevos;
    if (dentro) {                                   // borrar: el tramo se parte en dos (o se acorta)
      const { sg, r } = dentro;
      nuevos = segs.filter(x => x !== sg);
      if (i > r.ini) { const c = celda(i - 1); nuevos.push({ a: sg.a, ha: sg.ha || null, b: c.b, hb: c.hb }); }
      if (i < r.fin) { const c = celda(i + 1); nuevos.push({ a: c.a, ha: c.ha, b: sg.b, hb: sg.hb || null }); }
    } else {                                        // pintar: se une con los tramos vecinos si se tocan
      const izq = rs.find(x => x.r && x.r.fin === i - 1), der = rs.find(x => x.r && x.r.ini === i + 1);
      const c = celda(i);
      const nuevo = { a: izq ? izq.sg.a : c.a, ha: izq ? (izq.sg.ha || null) : c.ha,
                      b: der ? der.sg.b : c.b, hb: der ? (der.sg.hb || null) : c.hb };
      nuevos = segs.filter(x => x !== (izq && izq.sg) && x !== (der && der.sg));
      nuevos.push(nuevo);
    }
    guardarSegs(t, nuevos);
    return !dentro;
  }

  /* ---------- dibujado ---------- */
  function anchoNombre() { return S().ajustes.anchoTareas === 'amplio' ? 230 : 148; }

  function barraHTML(t) {
    const rs = idxDe(t);
    if (!rs || !rs.length) return '';
    if (t.tipo === 'fija') {
      const idx = rs[0];
      return `<i class="barra fija" data-t="${t.id}" style="left:${idx.ini * CELL_W}px;width:${(idx.fin - idx.ini + 1) * CELL_W}px"
              title="Fija: ${U.esc(U.fechaCorta(t.fechaFija))} ${U.esc(U.hora12(t.horaFija))}">📌</i>`;
    }
    const c = U.esc(t.color || S().ajustes.colorDefecto);
    return rs.map(idx => `<i class="barra" data-t="${t.id}" style="left:${idx.ini * CELL_W}px;width:${(idx.fin - idx.ini + 1) * CELL_W}px;background:${c}"></i>`).join('');
  }

  function filaHTML(t, ancho) {
    const fuera = t.tipo === 'fija' && !(idxDe(t) || []).length;
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
      <p class="swipe-hint" style="padding:0 16px 24px">Toca una casilla para pintarla o borrarla · toca el nombre para editar · mantenlo pulsado para mover la tarea</p>`;
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
    const x = viejo ? viejo.scrollLeft : 0;
    const sb = ref.el.querySelector('.screen-body'), y = sb ? sb.scrollTop : 0;
    ref.cols = columnas(p); olvidar();
    sb.innerHTML = cuerpo(p);
    ref.el.querySelector('h2').textContent = p.nombre;
    bind(ref.el, p);
    pintarTabla(p);
    const nuevo = ref.el.querySelector('.gantt-scroll');
    if (nuevo) nuevo.scrollLeft = x;
    sb.scrollTop = y;
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
    bindToque(scroller, p, cols);
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
      const cont = scroller.closest('.screen-body') || scroller;
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

  /* un toque pinta o borra UNA casilla. Se usa "click" (no pointerdown): el navegador no lo
     genera si el dedo se movió (scroll lateral) ni al parar un scroll con inercia, así que
     deslizar nunca pinta nada por error. */
  function bindToque(scroller, p, cols) {
    const tabla = scroller.querySelector('.gantt-table');
    if (!tabla) return;
    tabla.addEventListener('click', e => {
      const pista = e.target.closest('.g-track'); if (!pista) return;
      const t = S().tareasProyecto.find(x => x.id === pista.dataset.t); if (!t) return;
      if (t.tipo === 'fija') { U.toast('Es una tarea fija: cambia su fecha en el formulario'); return; }
      const r = pista.getBoundingClientRect();
      const i = Math.max(0, Math.min(cols.length - 1, Math.floor((e.clientX - r.left) / CELL_W)));
      alternarCelda(t, i, cols, p);
      repintarFila(p, t.id);
      U.haptic('LIGHT');
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
      <p style="font-size:12.5px;color:var(--ink-faint);margin:0 0 4px">Después pinta su fila en el organigrama tocando las casillas.</p>`;

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
        else if (indicesDe(t, cols).length) extra = ` - _${U.fechaMini(t.planInicio)} a ${U.fechaMini(t.planFin)}_`;
        out += t.completada ? `- ~✅${t.titulo}~\n` : `- ${t.titulo}${extra}\n`;
      });
    });
    return out.trimEnd();
  }

  return { abrir, refrescar, formTarea, formSeccion, indicesDe, columnas, resumenTexto };
})();
