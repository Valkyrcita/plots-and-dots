/* =========================================================
   AJUSTES - barra guardar/descartar fija al cambiar algo
   ========================================================= */
const Ajustes = (() => {
  const S = () => Store.state();
  let borrador = null, screenEl = null;

  const sw = (k, lbl, sub) => `
    <div class="setting"><span class="lbl">${lbl}${sub ? `<small>${sub}</small>` : ''}</span>
      <div class="switch${borrador[k] ? ' on' : ''}" data-sw="${k}"><i></i></div></div>`;

  const sel = (k, lbl, opts, sub) => `
    <div class="setting"><span class="lbl">${lbl}${sub ? `<small>${sub}</small>` : ''}</span>
      <select data-sel="${k}">${opts.map(([v, t]) =>
        `<option value="${v}"${String(borrador[k]) === String(v) ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;

  function cuerpo() {
    const sucio = JSON.stringify(borrador) !== JSON.stringify(S().ajustes);
    return `
      <div class="save-bar${sucio ? '' : ' hidden'}" id="save-bar">
        <button class="btn ghost" id="descartar">Descartar</button>
        <button class="btn primary" id="guardar">Guardar cambios</button>
      </div>

      <div class="setting-group">
        <h3>Apariencia</h3>
        ${sel('vistaInicial', 'Vista al abrir', [['listas', 'Listas'], ['proyectos', 'Proyectos'], ['habitos', 'Hábitos']])}
        ${sel('tema', 'Tema', [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']], 'El organigrama se adapta solo')}
        ${sw('resaltarHoy', 'Resaltar el día de hoy', 'Marca la columna actual en el organigrama')}
        ${sel('modoLigero', 'Modo ligero', [['auto', 'Automático'], ['si', 'Siempre'], ['no', 'Nunca']],
              'Menos sombras y animaciones: va más fluido en teléfonos lentos')}
      </div>

      <div class="setting-group">
        <h3>Listas</h3>
        <div class="setting"><span class="lbl">Título del resumen<small>Encabezado del mensaje</small></span></div>
        <div class="field" style="margin:0 0 14px"><input data-txt="tituloResumen" value="${U.esc(borrador.tituloResumen)}"></div>
        ${sw('filtrarPorRango', 'Filtrar por el rango de fechas', 'Oculta tareas con fecha fuera del rango')}
        ${sw('mostrarCompletadas', 'Mostrar tareas completadas', 'Tachadas con ✅')}
      </div>

      <div class="setting-group">
        <h3>Proyectos</h3>
        ${sel('unidadDefecto', 'Unidad por defecto', [['hora', 'Hora'], ['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['fecha', 'Fecha exacta']])}
        ${sel('inicioSemana', 'La semana empieza en', [[1, 'Lunes'], [0, 'Domingo']])}
        <div class="setting"><span class="lbl">Color por defecto<small>Para tareas planificadas</small></span></div>
        <div style="padding:0 0 14px">${UI.colorPicker(borrador.colorDefecto)}</div>
      </div>

      <div class="setting-group">
        <h3>General</h3>
        ${sw('confirmarBorrado', 'Confirmar antes de borrar')}
        ${sw('haptics', 'Vibración al interactuar')}
      </div>

      <div class="setting-group">
        <h3>Datos</h3>
        <div class="setting"><span class="lbl">Copia de seguridad<small>Exportar guarda un .json en Descargas</small></span></div>
        <p style="font-size:12px;color:var(--ink-faint);margin:0 0 12px">Incluye ${U.esc(Datos.textoResumen())}.</p>
        <div style="display:flex;gap:10px;padding:0 0 16px;flex-wrap:wrap">
          <button class="btn sm" id="exportar">↗ Exportar</button>
          <button class="btn sm" id="importar">↙ Importar</button>
          <button class="btn sm danger" id="borrar-todo">Borrar todo</button>
        </div>
        <input type="file" id="file-import" accept="application/json,.json" class="hidden">
      </div>

      <p style="text-align:center;color:var(--ink-faint);font-size:12px;padding-bottom:20px">
        Plots &amp; Dots v${App.VERSION}</p>`;
  }

  function pintar() {
    screenEl.querySelector('.screen-body').innerHTML = cuerpo();
    bind();
  }

  function marcar() {
    const sucio = JSON.stringify(borrador) !== JSON.stringify(S().ajustes);
    const bar = screenEl.querySelector('#save-bar');
    if (bar) bar.classList.toggle('hidden', !sucio);
  }

  function bind() {
    const sc = screenEl;
    sc.querySelectorAll('[data-sw]').forEach(el => el.onclick = () => {
      const k = el.dataset.sw;
      borrador[k] = !borrador[k];
      el.classList.toggle('on', borrador[k]);
      marcar();
    });
    sc.querySelectorAll('[data-sel]').forEach(el => el.onchange = () => {
      const k = el.dataset.sel;
      borrador[k] = k === 'inicioSemana' ? Number(el.value) : el.value;
      if (k === 'tema') UI.aplicarTema(el.value);
      if (k === 'modoLigero') UI.aplicarPerf(el.value);
      marcar();
    });
    sc.querySelectorAll('[data-txt]').forEach(el => el.oninput = () => {
      borrador[el.dataset.txt] = el.value; marcar();
    });
    UI.bindPicker(sc, 'color', v => { borrador.colorDefecto = v; marcar(); });

    const g = sc.querySelector('#guardar');
    if (g) g.onclick = () => {
      S().ajustes = JSON.parse(JSON.stringify(borrador));
      Store.save(); UI.aplicarTema(); UI.aplicarPerf(); App.render(); pintar(); U.toast('Ajustes guardados');
    };
    const d = sc.querySelector('#descartar');
    if (d) d.onclick = () => {
      borrador = JSON.parse(JSON.stringify(S().ajustes));
      UI.aplicarTema(); UI.aplicarPerf(); pintar();
    };

    sc.querySelector('#exportar').onclick = () => Datos.exportar();

    sc.querySelector('#importar').onclick = () => {
      const input = sc.querySelector('#file-import');
      input.value = '';
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (!f) return;
        const fr = new FileReader();
        fr.onload = async () => {
          try {
            await Store.importJSON(String(fr.result));
            borrador = JSON.parse(JSON.stringify(S().ajustes));
            UI.aplicarTema(); App.render(); pintar(); U.toast('Datos importados');
          } catch (e) { U.toast('El archivo no es un backup válido'); }
        };
        fr.readAsText(f);
      };
      UI.modal({
        titulo: '↙ Importar datos',
        html: `<p style="margin:-6px 0 14px;color:var(--ink-soft);font-size:13.5px">
            Elige el archivo <b>.json</b> que exportaste antes (está en <b>Descargas</b>).
            Se reemplazarán listas, proyectos, hábitos y ajustes actuales.</p>
          <div class="field"><label>O pega el contenido</label>
            <textarea id="imp" style="min-height:120px;font-size:11px" placeholder='{"version":1,...}'></textarea></div>`,
        autofocus: false,
        acciones: [
          { txt: 'Elegir archivo', clase: 'btn primary', fn: () => { input.click(); } },
          { txt: 'Usar el texto', clase: 'btn', fn: async ov => {
              const v = ov.querySelector('#imp').value.trim();
              if (!v) { U.toast('Pega el backup o elige un archivo'); return false; }
              try {
                await Store.importJSON(v);
                borrador = JSON.parse(JSON.stringify(S().ajustes));
                UI.aplicarTema(); App.render(); pintar(); U.toast('Datos importados');
              } catch (e) { U.toast('JSON inválido'); return false; }
            } }
        ]
      });
    };

    sc.querySelector('#borrar-todo').onclick = () => {
      UI.modal({
        titulo: 'Borrar todo',
        centrado: true,
        html: '<p style="margin:0;color:var(--ink-soft)">Se eliminarán listas, proyectos y ajustes. No se puede deshacer.</p>',
        acciones: [
          { txt: 'Cancelar', clase: 'btn' },
          { txt: 'Borrar', clase: 'btn danger', fn: async () => {
              await Store.replace(Store.defaults());
              borrador = JSON.parse(JSON.stringify(S().ajustes));
              UI.aplicarTema(); App.render(); pintar(); U.toast('Todo borrado');
            } }
        ]
      });
    };
  }

  function abrir() {
    borrador = JSON.parse(JSON.stringify(S().ajustes));
    const s = UI.screen({
      titulo: 'Ajustes',
      html: '<div></div>',
      onBack: cerrar => {
        if (JSON.stringify(borrador) === JSON.stringify(S().ajustes)) return true;
        UI.modal({
          titulo: 'Cambios sin guardar', centrado: true,
          html: '<p style="margin:0;color:var(--ink-soft)">Tienes ajustes sin guardar.</p>',
          acciones: [
            { txt: 'Descartar', clase: 'btn', fn: () => { UI.aplicarTema(); cerrar(); } },
            { txt: 'Guardar', clase: 'btn primary', fn: () => {
                S().ajustes = JSON.parse(JSON.stringify(borrador));
                Store.save(); UI.aplicarTema(); App.render(); cerrar();
              } }
          ]
        });
        return false;
      },
      onMount: sc => { screenEl = sc; pintar(); },
      onClose: () => { screenEl = null; UI.aplicarTema(); }
    });
    return s;
  }

  return { abrir };
})();
