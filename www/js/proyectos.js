/* =========================================================
   VISTA PROYECTOS - tarjetas y CRUD
   ========================================================= */
const Proyectos = (() => {
  let busqueda = '';
  let filtro = 'todos';   // todos | activos | terminados
  const S = () => Store.state();

  const secciones = pid => S().secciones.filter(s => s.proyectoId === pid).sort((a, b) => a.orden - b.orden);
  const tareasDe = sid => S().tareasProyecto.filter(t => t.seccionId === sid).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  function tareasProyecto(pid) {
    const ids = secciones(pid).map(s => s.id);
    return S().tareasProyecto.filter(t => ids.includes(t.seccionId));
  }
  function progreso(pid) {
    const ts = tareasProyecto(pid);
    if (!ts.length) return { pct: 0, hechas: 0, total: 0 };
    const hechas = ts.filter(t => t.completada).length;
    return { pct: Math.round(hechas * 100 / ts.length), hechas, total: ts.length };
  }

  function crearProyecto(d) {
    const p = Object.assign({
      id: Store.uid('prj'), tipo: 'proyecto', nombre: '', fechaInicio: U.hoyISO(),
      fechaFin: U.toISO(U.addMonths(new Date(), 3)), unidadTiempo: S().ajustes.unidadDefecto,
      creado: U.hoyISO()
    }, d);
    S().proyectos.push(p);
    // sección inicial para que nunca haya tareas huérfanas
    S().secciones.push({ id: Store.uid('sec'), proyectoId: p.id, titulo: 'General', orden: 0, colapsada: false });
    Store.save();
    return p;
  }

  function eliminarProyecto(id) {
    const sids = secciones(id).map(s => s.id);
    S().tareasProyecto = S().tareasProyecto.filter(t => !sids.includes(t.seccionId));
    S().secciones = S().secciones.filter(s => s.proyectoId !== id);
    S().proyectos = S().proyectos.filter(p => p.id !== id);
    Store.save();
  }

  /* ---------- render tarjetas ---------- */
  function render(cont) {
    const ps = S().proyectos.filter(p => {
      if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
      const pr = progreso(p.id);
      if (filtro === 'terminados') return pr.total > 0 && pr.pct === 100;
      if (filtro === 'activos') return pr.pct < 100;
      return true;
    });

    let html = `
      <div class="toolbar">
        <div class="search"><span>🔍</span>
          <input id="prj-search" type="search" placeholder="Buscar proyecto..." value="${U.esc(busqueda)}"></div>
      </div>
      <div class="toolbar" style="margin-top:-4px">
        ${[['todos','Todos'],['activos','Activos'],['terminados','Terminados']].map(([k, l]) =>
          `<button class="chip${filtro === k ? ' active' : ''}" data-pf="${k}">${l}</button>`).join('')}
      </div>`;

    if (!ps.length) {
      html += `<div class="empty"><span class="big">📊</span>
        <h3>${S().proyectos.length ? 'Nada con ese filtro' : 'Sin proyectos todavía'}</h3>
        <p>Un proyecto tiene secciones, tareas y un organigrama tipo Gantt.</p>
        <button class="btn primary" id="prj-nuevo">Nuevo Proyecto</button></div>`;
    } else {
      ps.forEach(p => {
        const pr = progreso(p.id);
        html += `<div class="proyecto-card" data-prj="${p.id}">
          <h3>${U.esc(p.nombre)}</h3>
          <div class="proyecto-meta">${U.fechaMini(p.fechaInicio)} — ${U.fechaMini(p.fechaFin)} · por ${p.unidadTiempo}</div>
          <div class="progress-wrap">
            <div class="progress"><i style="width:${pr.pct}%"></i></div>
            <div class="progress-pct">${pr.pct}%</div>
          </div>
          <div class="proyecto-meta" style="margin-top:-8px;margin-bottom:12px">${pr.hechas} de ${pr.total} tareas completadas</div>
          <div class="card-actions">
            <button class="btn primary sm" data-gantt="${p.id}">Organigrama</button>
            <button class="btn sm" data-edit="${p.id}">Editar</button>
          </div>
        </div>`;
      });
    }

    cont.innerHTML = html;

    const sb = cont.querySelector('#prj-search');
    if (sb) sb.oninput = e => {
      busqueda = e.target.value; const pos = e.target.selectionStart;
      App.render();
      const n = document.querySelector('#prj-search'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
    };
    cont.querySelectorAll('[data-pf]').forEach(b => b.onclick = () => { filtro = b.dataset.pf; App.render(); });
    const nb = cont.querySelector('#prj-nuevo'); if (nb) nb.onclick = () => formProyecto();
    cont.querySelectorAll('[data-gantt]').forEach(b => b.onclick = () => Gantt.abrir(b.dataset.gantt));
    cont.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => formProyecto(b.dataset.edit));
  }

  /* ---------- formulario ---------- */
  function formProyecto(id, alCrear) {
    const p = id ? S().proyectos.find(x => x.id === id) : null;
    const hoy = U.hoyISO();
    UI.modal({
      titulo: p ? 'Editar proyecto' : 'Nuevo Proyecto',
      html: `
        <div class="field"><label>Nombre del proyecto</label>
          <input id="p-nom" placeholder="Tesis, Identidad visual, Mudanza..." value="${p ? U.esc(p.nombre) : ''}"></div>
        <div class="field-row">
          <div class="field"><label>Fecha inicio</label>
            <input type="date" id="p-ini" value="${p ? p.fechaInicio : hoy}"></div>
          <div class="field"><label>Fecha fin</label>
            <input type="date" id="p-fin" value="${p ? p.fechaFin : U.toISO(U.addMonths(new Date(), 3))}"></div>
        </div>
        <div class="field"><label>Unidad de tiempo del organigrama</label>
          <select id="p-uni">
            ${[['hora','Hora'],['dia','Día'],['semana','Semana'],['mes','Mes'],['fecha','Fecha exacta (15/01, 16/01...)']]
              .map(([k, l]) => `<option value="${k}"${(p ? p.unidadTiempo : S().ajustes.unidadDefecto) === k ? ' selected' : ''}>${l}</option>`).join('')}
          </select></div>`,
      acciones: [
        ...(p ? [{ txt: 'Eliminar', clase: 'btn danger', fn: () => {
            U.confirmar('Se borrará el proyecto "' + p.nombre + '" con sus secciones y tareas.', () => {
              eliminarProyecto(p.id);
              document.querySelectorAll('.screen').forEach(s => s.remove());
              App.render(); U.toast('Proyecto eliminado');
            });
          } }] : []),
        { txt: p ? 'Guardar' : 'Crear', clase: 'btn primary', fn: ov => {
            const nom = ov.querySelector('#p-nom').value.trim();
            const ini = ov.querySelector('#p-ini').value;
            const fin = ov.querySelector('#p-fin').value;
            const uni = ov.querySelector('#p-uni').value;
            if (!nom) { U.toast('Ponle un nombre'); return false; }
            if (!ini || !fin) { U.toast('Faltan las fechas'); return false; }
            if (fin < ini) { U.toast('La fecha fin es anterior al inicio'); return false; }
            const cols = U.generarColumnas(ini, fin, uni, S().ajustes.inicioSemana);
            if (!cols.length) { U.toast('Ese rango no genera columnas'); return false; }
            if (uni === 'hora' && cols.length >= 1200) U.toast('Rango muy largo para horas: se recortó');
            if (p) {
              Object.assign(p, { nombre: nom, fechaInicio: ini, fechaFin: fin, unidadTiempo: uni });
              Store.save(); App.render(); Gantt.refrescar(p.id);
            } else {
              const np = crearProyecto({ nombre: nom, fechaInicio: ini, fechaFin: fin, unidadTiempo: uni });
              App.render();
              if (alCrear !== false) Gantt.abrir(np.id);
            }
          } }
      ]
    });
  }

  return { render, formProyecto, crearProyecto, eliminarProyecto, secciones, tareasDe, tareasProyecto, progreso };
})();
