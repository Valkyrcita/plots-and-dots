/* =========================================================
   VISTA LISTAS - resumen plegable estilo mensaje
   ========================================================= */
const Listas = (() => {
  let filtro = 'todas';     // todas | pendientes | completadas
  let busqueda = '';
  const colapsadas = new Set();

  const S = () => Store.state();

  /* ---------- datos ---------- */
  function crearLista(nombre, emoji) {
    const l = { id: Store.uid('lst'), tipo: 'lista', nombre, emoji: emoji || '📌', tareas: [], orden: S().listas.length };
    S().listas.push(l); Store.save(); return l;
  }
  function crearTarea(listaId, datos) {
    const l = S().listas.find(x => x.id === listaId); if (!l) return;
    l.tareas.push(Object.assign({
      id: Store.uid('tsk'), listaId, titulo: '', completada: false,
      fechaEspecifica: '', prioridad: '', descripcion: '', creada: U.hoyISO()
    }, datos));
    Store.save();
  }
  function toggleTarea(listaId, tareaId) {
    const l = S().listas.find(x => x.id === listaId); if (!l) return;
    const t = l.tareas.find(x => x.id === tareaId); if (!t) return;
    t.completada = !t.completada;
    t.completadaEn = t.completada ? U.hoyISO() : null;
    Store.save(); U.haptic('LIGHT');
  }

  /* ---------- filtros ---------- */
  function enRango(t) {
    const a = S().ajustes, r = S().rango;
    if (!a.filtrarPorRango || !r.inicio || !r.fin) return true;
    if (!t.fechaEspecifica) return true;          // sin fecha => siempre visible
    return t.fechaEspecifica >= r.inicio && t.fechaEspecifica <= r.fin;
  }
  function visible(t) {
    if (!enRango(t)) return false;
    if (filtro === 'pendientes' && t.completada) return false;
    if (filtro === 'completadas' && !t.completada) return false;
    if (!S().ajustes.mostrarCompletadas && t.completada && filtro !== 'completadas') return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!(t.titulo + ' ' + (t.descripcion || '')).toLowerCase().includes(q)) return false;
    }
    return true;
  }

  /* ---------- texto para compartir (formato WhatsApp) ---------- */
  function textoResumen() {
    const s = S();
    let out = '*' + s.ajustes.tituloResumen + '*\n';
    if (s.rango.inicio && s.rango.fin) out += '> ' + U.rangoTexto(s.rango.inicio, s.rango.fin) + '\n';
    s.listas.forEach(l => {
      const ts = l.tareas.filter(visible);
      if (!ts.length) return;
      out += '\n*' + l.emoji + ' ' + l.nombre + '*\n';
      ts.forEach(t => {
        const fecha = t.fechaEspecifica ? ' - *' + U.fechaCorta(t.fechaEspecifica) + '*' : '';
        out += t.completada ? `- ~✅${t.titulo}~\n` : `- ${t.titulo}${fecha}\n`;
      });
    });
    return out.trimEnd();
  }

  /* ---------- render ----------
     La barra de herramientas se dibuja una vez; al filtrar o buscar solo
     se redibuja el resumen, así el buscador no pierde el foco ni se
     reconstruye toda la pantalla en cada tecla. */
  function render(cont) {
    const s = S();
    cont.innerHTML = `
      <div class="toolbar">
        <div class="search"><span>🔍</span>
          <input id="lst-search" type="search" placeholder="Buscar tarea..." value="${U.esc(busqueda)}"></div>
        <button class="icon-btn" id="lst-share" title="Compartir">📤</button>
      </div>
      <div class="toolbar" style="margin-top:-4px">
        ${['todas','pendientes','completadas'].map(f =>
          `<button class="chip${filtro === f ? ' active' : ''}" data-filtro="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}
      </div>
      <div id="lst-body"></div>`;

    const body = cont.querySelector('#lst-body');
    pintarCuerpo(body);
    bindToolbar(cont, body);

    // un solo oyente para todas las tareas de todas las listas
    U.bindTapDelegado(body, '.tarea[data-tarea]', {
      tap: li => { toggleTarea(li.dataset.lista, li.dataset.tarea); actualizarTarea(body, li); },
      hold: li => formTarea(li.dataset.lista, li.dataset.tarea)
    });
    body.addEventListener('click', e => {
      const t = e.target.closest('[data-toggle]');
      if (t) { e.stopPropagation(); plegar(body, t.dataset.toggle); return; }
      const a = e.target.closest('[data-abrir]');
      if (a) { abrirLista(a.dataset.abrir); return; }
      const add = e.target.closest('[data-add]');
      if (add) formTarea(add.dataset.add);
    });
  }

  function pintarCuerpo(body) {
    const s = S();
    if (!s.listas.length) {
      body.innerHTML = `<div class="empty"><span class="big">🗒️</span>
        <h3>Todavía no hay listas</h3>
        <p>Toca el botón + y crea tu primera lista.</p>
        <button class="btn primary" id="lst-nueva">Nueva Lista</button></div>`;
      const n = body.querySelector('#lst-nueva'); if (n) n.onclick = () => formLista();
      return;
    }
    let html = `<div class="resumen">
      <div class="resumen-head">
        <div class="resumen-title">${U.esc(s.ajustes.tituloResumen)}</div>
        <button class="rango-btn" id="lst-rango">📅 ${U.esc(U.rangoTexto(s.rango.inicio, s.rango.fin))}</button>
      </div>`;
    s.listas.forEach(l => {
      const ts = l.tareas.filter(visible);
      const pend = l.tareas.filter(t => !t.completada).length;
      const col = colapsadas.has(l.id);
      html += `
        <div class="lista-block${col ? ' collapsed' : ''}" data-lista="${l.id}">
          <div class="lista-head">
            <span class="emoji">${l.emoji}</span>
            <span class="nombre" data-abrir="${l.id}">${U.esc(l.nombre)}</span>
            <span class="count">${pend} pend.</span>
            <button class="caret" data-toggle="${l.id}">▼</button>
          </div>
          <ul class="tareas">
            ${ts.map(t => tareaHTML(l, t)).join('') ||
              `<li class="tarea" style="color:var(--ink-faint);font-size:13px">Sin tareas que mostrar</li>`}
            <li><button class="add-tarea" data-add="${l.id}">+ Agregar tarea a esta lista</button></li>
          </ul>
        </div>`;
    });
    html += `</div><p class="swipe-hint">Toca una tarea para completarla · toca el nombre de la lista para editarla</p>`;
    body.innerHTML = html;
    const r = body.querySelector('#lst-rango'); if (r) r.onclick = formRango;
  }

  function plegar(body, id) {
    colapsadas.has(id) ? colapsadas.delete(id) : colapsadas.add(id);
    const bl = body.querySelector(`.lista-block[data-lista="${id}"]`);
    if (bl) bl.classList.toggle('collapsed');
  }

  /* al marcar, se toca solo esa tarea y el contador de su lista */
  function actualizarTarea(body, li) {
    const l = S().listas.find(x => x.id === li.dataset.lista); if (!l) return;
    const t = l.tareas.find(x => x.id === li.dataset.tarea); if (!t) return;
    if (!visible(t)) { pintarCuerpo(body); return; }    // ha salido del filtro: hay que redibujar
    li.classList.toggle('done', t.completada);
    const b = li.querySelector('.bullet'); if (b) b.textContent = t.completada ? '✅' : '-';
    const bl = body.querySelector(`.lista-block[data-lista="${l.id}"] .count`);
    if (bl) bl.textContent = l.tareas.filter(x => !x.completada).length + ' pend.';
    refrescarScreen(l.id);
  }

  function tareaHTML(l, t) {
    const fecha = t.fechaEspecifica ? ` <span class="fecha">- ${U.fechaCorta(t.fechaEspecifica)}</span>` : '';
    const prio = t.prioridad ? `<span class="prio prio-${t.prioridad}"></span>` : '';
    const desc = t.descripcion ? `<small class="desc">${U.esc(t.descripcion)}</small>` : '';
    return `<li class="tarea${t.completada ? ' done' : ''}" data-tarea="${t.id}" data-lista="${l.id}">
      <span class="bullet">${t.completada ? '✅' : '-'}</span>${prio}
      <span class="txt">${U.esc(t.titulo)}${fecha}${desc}</span>
    </li>`;
  }

  function bindToolbar(cont, body) {
    const sb = cont.querySelector('#lst-search');
    if (sb) {
      const buscar = U.retardar(() => { busqueda = sb.value; pintarCuerpo(body); }, 220);
      sb.addEventListener('input', buscar);
    }
    cont.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => {
      filtro = b.dataset.filtro;
      cont.querySelectorAll('[data-filtro]').forEach(x => x.classList.toggle('active', x === b));
      pintarCuerpo(body);
    });
    const sh = cont.querySelector('#lst-share');
    if (sh) sh.onclick = () => U.compartir(textoResumen(), 'TO DO LIST');
  }

  /* ---------- formularios ---------- */
  function formRango() {
    const r = S().rango;
    UI.modal({
      titulo: 'Rango de fechas',
      html: `<div class="field-row">
          <div class="field"><label>Desde</label><input type="date" id="r-ini" value="${r.inicio || ''}"></div>
          <div class="field"><label>Hasta</label><input type="date" id="r-fin" value="${r.fin || ''}"></div>
        </div>
        <p style="font-size:12.5px;color:var(--ink-faint);margin:0">Las tareas con fecha fuera del rango se ocultan. Las que no tienen fecha siempre se ven.</p>`,
      acciones: [
        { txt: 'Quitar rango', clase: 'btn ghost', fn: () => { S().rango = { inicio: null, fin: null }; Store.save(); App.render(); } },
        { txt: 'Guardar', clase: 'btn primary', fn: ov => {
            const i = ov.querySelector('#r-ini').value, f = ov.querySelector('#r-fin').value;
            if (i && f && f < i) { U.toast('La fecha final es anterior a la inicial'); return false; }
            S().rango = { inicio: i || null, fin: f || null }; Store.save(); App.render();
          } }
      ]
    });
  }

  function formLista(id) {
    const l = id ? S().listas.find(x => x.id === id) : null;
    let emoji = l ? l.emoji : '📌';
    UI.modal({
      titulo: l ? 'Editar lista' : 'Nueva Lista',
      html: `<div class="field"><label>Nombre</label>
          <input id="l-nombre" placeholder="Trabajo, Estudios, Hogwarts..." value="${l ? U.esc(l.nombre) : ''}"></div>
        <div class="field"><label>Emoji</label>${UI.emojiPicker(emoji)}</div>`,
      onMount: ov => UI.bindPicker(ov, 'emoji', v => emoji = v),
      acciones: [
        ...(l ? [{ txt: 'Eliminar', clase: 'btn danger', fn: () => {
            U.confirmar('Se borrará la lista "' + l.nombre + '" y todas sus tareas.', () => {
              S().listas = S().listas.filter(x => x.id !== l.id); Store.save();
              document.querySelectorAll('.screen').forEach(s => s.remove());
              App.render(); U.toast('Lista eliminada');
            });
          } }] : []),
        { txt: l ? 'Guardar' : 'Crear', clase: 'btn primary', fn: ov => {
            const n = ov.querySelector('#l-nombre').value.trim();
            if (!n) { U.toast('Ponle un nombre a la lista'); return false; }
            if (l) { l.nombre = n; l.emoji = emoji; Store.save(); }
            else crearLista(n, emoji);
            App.render();
            if (l && screenRef && screenRef.listaId === l.id && document.body.contains(screenRef.el)) {
              const el = screenRef.el; screenRef = null; abrirLista(l.id, el);
            }
          } }
      ]
    });
  }

  function formTarea(listaId, tareaId) {
    const l = S().listas.find(x => x.id === listaId); if (!l) return;
    const t = tareaId ? l.tareas.find(x => x.id === tareaId) : null;
    UI.modal({
      titulo: t ? 'Editar tarea' : 'Nueva tarea · ' + l.emoji + ' ' + l.nombre,
      html: `
        <div class="field"><label>Título</label>
          <input id="t-tit" placeholder="¿Qué hay que hacer?" value="${t ? U.esc(t.titulo) : ''}"></div>
        <div class="field-row">
          <div class="field"><label>Fecha específica (opcional)</label>
            <input type="date" id="t-fecha" value="${t ? (t.fechaEspecifica || '') : ''}"></div>
          <div class="field"><label>Prioridad</label>
            <select id="t-prio">
              <option value="">—</option>
              ${['baja','media','alta'].map(p => `<option value="${p}"${t && t.prioridad === p ? ' selected' : ''}>${p}</option>`).join('')}
            </select></div>
        </div>
        <div class="field"><label>Descripción (opcional)</label>
          <textarea id="t-desc">${t ? U.esc(t.descripcion || '') : ''}</textarea></div>`,
      acciones: [
        ...(t ? [{ txt: 'Eliminar', clase: 'btn danger', fn: () => {
            U.confirmar('Eliminar "' + t.titulo + '"', () => {
              l.tareas = l.tareas.filter(x => x.id !== t.id); Store.save(); App.render(); refrescarScreen(l.id);
            });
          } }] : []),
        { txt: t ? 'Guardar' : 'Agregar', clase: 'btn primary', fn: ov => {
            const tit = ov.querySelector('#t-tit').value.trim();
            if (!tit) { U.toast('Escribe el título'); return false; }
            const datos = {
              titulo: tit,
              fechaEspecifica: ov.querySelector('#t-fecha').value || '',
              prioridad: ov.querySelector('#t-prio').value,
              descripcion: ov.querySelector('#t-desc').value.trim()
            };
            if (t) Object.assign(t, datos); else crearTarea(l.id, datos);
            Store.save(); App.render(); refrescarScreen(l.id);
          } }
      ]
    });
  }

  /* ---------- pantalla de una lista ---------- */
  let screenRef = null;
  function refrescarScreen(listaId) {
    if (screenRef && screenRef.listaId === listaId && document.body.contains(screenRef.el)) {
      screenRef.el.querySelector('.screen-body').innerHTML = cuerpoLista(listaId);
      bindCuerpo(screenRef.el, listaId);
    }
  }
  function cuerpoLista(id) {
    const l = S().listas.find(x => x.id === id); if (!l) return '';
    const pend = l.tareas.filter(t => !t.completada);
    const comp = l.tareas.filter(t => t.completada);
    const bloque = (titulo, arr) => !arr.length ? '' :
      `<h3 style="font-size:13px;color:var(--ink-faint);margin:18px 0 8px;letter-spacing:.5px">${titulo} (${arr.length})</h3>
       <div class="resumen" style="padding:10px"><ul class="tareas">${arr.map(t => tareaHTML(l, t)).join('')}</ul></div>`;
    return `
      ${bloque('PENDIENTES', pend)}
      ${bloque('COMPLETADAS', comp)}
      ${!l.tareas.length ? '<div class="empty"><span class="big">✨</span><p>Lista vacía. Agrega la primera tarea.</p></div>' : ''}
      <button class="btn primary block" style="margin-top:18px" data-add="${l.id}">+ Agregar tarea</button>
      ${comp.length ? `<button class="btn ghost block" style="margin-top:8px" id="limpiar">Borrar completadas</button>` : ''}`;
  }
  function bindCuerpo(sc, id) {
    const l = S().listas.find(x => x.id === id); if (!l) return;
    sc.querySelectorAll('[data-add]').forEach(b => b.onclick = () => formTarea(id));
    const lim = sc.querySelector('#limpiar');
    if (lim) lim.onclick = () => U.confirmar('Se borrarán las tareas completadas de esta lista.', () => {
      l.tareas = l.tareas.filter(t => !t.completada); Store.save(); App.render(); refrescarScreen(id);
    });
    sc.querySelectorAll('.tarea[data-tarea]').forEach(li => U.bindTap(li, {
      tap: () => { toggleTarea(id, li.dataset.tarea); App.render(); refrescarScreen(id); },
      hold: () => formTarea(id, li.dataset.tarea)
    }));
  }

  function abrirLista(id, reusar) {
    const l = S().listas.find(x => x.id === id); if (!l) return;
    if (reusar) reusar.remove();
    const s = UI.screen({
      titulo: l.emoji + '  ' + l.nombre,
      html: cuerpoLista(id),
      acciones: [
        { txt: '✏️', fn: () => formLista(id) },
        { txt: '📤', fn: () => {
            const ts = l.tareas.filter(visible);
            let txt = '*' + l.emoji + ' ' + l.nombre + '*\n' + ts.map(t =>
              t.completada ? `- ~✅${t.titulo}~` : `- ${t.titulo}${t.fechaEspecifica ? ' - *' + U.fechaCorta(t.fechaEspecifica) + '*' : ''}`).join('\n');
            U.compartir(txt, l.nombre);
          } }
      ],
      onMount: sc => bindCuerpo(sc, id),
      onClose: () => { screenRef = null; App.render(); }
    });
    screenRef = { el: s.el, listaId: id };
  }

  return { render, formLista, formTarea, abrirLista, textoResumen, visible };
})();
