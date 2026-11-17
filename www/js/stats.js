/* =========================================================
   ESTADÍSTICAS por rango de fechas
   ========================================================= */
const Stats = (() => {
  const S = () => Store.state();
  let rango = { inicio: null, fin: null };
  let anioTracker = new Date().getFullYear();

  function dentro(iso) {
    if (!rango.inicio || !rango.fin) return true;
    if (!iso) return true;
    return iso >= rango.inicio && iso <= rango.fin;
  }

  function calcular() {
    const s = S();
    let tHechas = 0, tPend = 0;
    s.listas.forEach(l => l.tareas.forEach(t => {
      if (!dentro(t.fechaEspecifica || t.creada)) return;
      t.completada ? tHechas++ : tPend++;
    }));

    const proyectos = s.proyectos.filter(p =>
      !rango.inicio || !rango.fin || !(p.fechaFin < rango.inicio || p.fechaInicio > rango.fin));

    let pHechas = 0, pPend = 0, fijas = 0;
    const porProyecto = proyectos.map(p => {
      const pr = Proyectos.progreso(p.id);
      pHechas += pr.hechas; pPend += pr.total - pr.hechas;
      fijas += Proyectos.tareasProyecto(p.id).filter(t => t.tipo === 'fija').length;
      return { nombre: p.nombre, pct: pr.pct, hechas: pr.hechas, total: pr.total };
    }).sort((a, b) => b.pct - a.pct);

    const habitos = s.habitos.filter(h => !h.archivado).map(h => ({
      h, dias: Habitos.conteoRango(h, rango.inicio, rango.fin), racha: Habitos.racha(h)
    })).sort((a, b) => b.dias - a.dias);

    const total = tHechas + tPend + pHechas + pPend;
    return {
      proyectos: proyectos.length, listas: s.listas.length,
      hechas: tHechas + pHechas, pendientes: tPend + pPend,
      pct: total ? Math.round((tHechas + pHechas) * 100 / total) : 0,
      fijas, porProyecto, tHechas, tPend, habitos
    };
  }

  function cuerpo() {
    const d = calcular();
    return `
      <button class="rango-btn" id="st-rango" style="width:100%;justify-content:center;margin-bottom:16px">
        📅 ${U.esc(U.rangoTexto(rango.inicio, rango.fin))}</button>
      <div class="stat-grid">
        <div class="stat-card"><div class="n">${d.proyectos}</div><div class="l">PROYECTOS</div></div>
        <div class="stat-card"><div class="n">${d.listas}</div><div class="l">LISTAS</div></div>
        <div class="stat-card"><div class="n" style="color:var(--ok)">${d.hechas}</div><div class="l">COMPLETADAS</div></div>
        <div class="stat-card"><div class="n" style="color:var(--danger)">${d.pendientes}</div><div class="l">PENDIENTES</div></div>
      </div>
      <div class="setting-group" style="padding:18px 16px">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="progress"><i style="width:${d.pct}%"></i></div>
          <div class="progress-pct">${d.pct}%</div>
        </div>
        <div class="proyecto-meta" style="margin-top:10px">Avance global en el rango · ${d.fijas} tareas fijas programadas</div>
      </div>
      <div class="setting-group">
        <h3>Por proyecto</h3>
        ${d.porProyecto.length ? d.porProyecto.map(p => `
          <div class="stat-row">
            <span class="nm">${U.esc(p.nombre)}</span>
            <div class="progress" style="max-width:110px"><i style="width:${p.pct}%"></i></div>
            <span class="progress-pct">${p.pct}%</span>
          </div>`).join('') : '<div class="stat-row"><span class="nm" style="color:var(--ink-faint)">Sin proyectos en el rango</span></div>'}
      </div>
      ${d.habitos.length ? `
      <div class="setting-group">
        <h3>Hábitos · días marcados en el rango</h3>
        ${d.habitos.map(x => `
          <div class="stat-row">
            <span class="hab-emoji sm" style="background:${x.h.color}">${x.h.emoji}</span>
            <span class="nm">${U.esc(x.h.nombre)}</span>
            <span style="color:var(--ink-faint);font-size:12.5px">🔥 ${x.racha}</span>
            <strong>${x.dias}</strong>
          </div>`).join('')}
      </div>
      <div class="setting-group">
        <h3>Trackers anuales</h3>
        <div class="tracker-head" style="justify-content:center;padding:4px 0 10px">
          <button class="icon-btn sm" data-ty="-1">‹</button><strong>${anioTracker}</strong>
          <button class="icon-btn sm" data-ty="1">›</button>
        </div>
        ${d.habitos.map(x => `
          <div style="padding:6px 0 14px">
            <div style="font-weight:800;font-size:13.5px;margin-bottom:8px">${x.h.emoji} ${U.esc(x.h.nombre)}
              <span style="color:var(--ink-faint);font-weight:700">· ${Habitos.conteoAnio(x.h, anioTracker)} días</span></div>
            <div class="tracker-lazy" data-hab="${x.h.id}"></div>
          </div>`).join('')}
      </div>` : ''}

      <div class="setting-group">
        <h3>Listas simples</h3>
        <div class="stat-row"><span class="nm">Tareas completadas</span><strong>${d.tHechas}</strong></div>
        <div class="stat-row"><span class="nm">Tareas pendientes</span><strong>${d.tPend}</strong></div>
      </div>`;
  }

  function abrir() {
    const s = UI.screen({
      titulo: 'Estadísticas',
      html: cuerpo(),
      onMount: sc => bind(sc)
    });
    function bind(sc) {
      sc.querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { anioTracker += Number(b.dataset.ty); recargar(); });
      // los trackers se dibujan solo cuando asoman por la pantalla
      const pendientes = sc.querySelectorAll('.tracker-lazy');
      const dibujar = el => {
        if (el.dataset.listo) return;
        el.dataset.listo = '1';
        const h = S().habitos.find(x => x.id === el.dataset.hab);
        if (h) el.innerHTML = Habitos.trackerHTML(h, anioTracker, { mini: true, orientacion: 'horizontal' });
      };
      if (window.IntersectionObserver && pendientes.length) {
        const io = new IntersectionObserver((entradas, obs) => {
          entradas.forEach(e => { if (e.isIntersecting) { dibujar(e.target); obs.unobserve(e.target); } });
        }, { root: sc.querySelector('.screen-body') || null, rootMargin: '300px' });
        pendientes.forEach(el => io.observe(el));
      } else {
        pendientes.forEach(dibujar);
      }
      sc.querySelector('#st-rango').onclick = () => {
        UI.modal({
          titulo: 'Rango de análisis',
          html: `<div class="field-row">
              <div class="field"><label>Desde</label><input type="date" id="sr-i" value="${rango.inicio || ''}"></div>
              <div class="field"><label>Hasta</label><input type="date" id="sr-f" value="${rango.fin || ''}"></div>
            </div>`,
          acciones: [
            { txt: 'Todo', clase: 'btn ghost', fn: () => { rango = { inicio: null, fin: null }; recargar(); } },
            { txt: 'Aplicar', clase: 'btn primary', fn: ov => {
                rango = { inicio: ov.querySelector('#sr-i').value || null, fin: ov.querySelector('#sr-f').value || null };
                recargar();
              } }
          ]
        });
      };
    }
    function recargar() { s.el.querySelector('.screen-body').innerHTML = cuerpo(); bind(s.el); }
  }

  return { abrir, calcular };
})();
