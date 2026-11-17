/* =========================================================
   DATOS: copia de seguridad completa
   Exportar guarda el .json en la carpeta DESCARGAS del teléfono
   (plugin nativo con MediaStore) y, si no se puede, va probando
   alternativas hasta que el archivo quede en manos del usuario.
   ========================================================= */
const Datos = (() => {

  function nombreArchivo() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return 'plots-and-dots-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
           + '-' + p(d.getHours()) + p(d.getMinutes()) + '.json';
  }

  const nativo = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = n => (window.Capacitor && window.Capacitor.Plugins) ? window.Capacitor.Plugins[n] : null;

  const pl = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

  function textoResumen() {
    const r = Store.resumen();
    return `${pl(r.listas, 'lista', 'listas')} (${pl(r.tareas, 'tarea', 'tareas')}) · `
         + `${pl(r.proyectos, 'proyecto', 'proyectos')} (${pl(r.secciones, 'sección', 'secciones')}, `
         + `${pl(r.tareasProyecto, 'tarea', 'tareas')}) · `
         + `${pl(r.habitos, 'hábito', 'hábitos')} (${pl(r.marcas, 'marca', 'marcas')}) · ajustes`;
  }

  function descargarWeb(json, nombre) {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch (e) { return false; }
  }

  function avisoGuardado(nombre, donde, uri) {
    const share = plugin('Share');
    UI.modal({
      titulo: '↗ Copia guardada', centrado: true,
      html: `<p style="margin:0 0 10px;color:var(--ink-soft);font-size:13.5px">
          <b>${U.esc(nombre)}</b><br>en la carpeta <b>${U.esc(donde)}</b> del teléfono.</p>
        <p style="margin:0;color:var(--ink-faint);font-size:12px">Incluye ${U.esc(textoResumen())}.</p>`,
      acciones: [
        { txt: 'Listo', clase: 'btn' },
        ...(share && uri ? [{ txt: 'Enviar copia', clase: 'btn primary', fn: async () => {
            try { await share.share({ title: nombre, url: uri, dialogTitle: 'Enviar copia de seguridad' }); }
            catch (e) { /* cancelado */ }
          } }] : [])
      ]
    });
  }

  async function exportar() {
    const json = Store.exportJSON();
    const nombre = nombreArchivo();

    if (nativo()) {
      // 1) carpeta Descargas de verdad (MediaStore en Android 10+)
      const desc = plugin('Descargas');
      if (desc && desc.guardar) {
        try {
          const r = await desc.guardar({ filename: nombre, data: json, mime: 'application/json' });
          avisoGuardado(nombre, 'Descargas', r && r.uri);
          return true;
        } catch (e) { console.warn('Descargas no disponible', e); }
      }
      // 2) Documentos + compartir
      const fs = plugin('Filesystem');
      if (fs) {
        for (const dir of ['DOCUMENTS', 'EXTERNAL_STORAGE', 'CACHE']) {
          try {
            const r = await fs.writeFile({ path: nombre, data: json, directory: dir, encoding: 'utf8', recursive: true });
            avisoGuardado(nombre, dir === 'DOCUMENTS' ? 'Documentos' : 'Archivos de la app', r && r.uri);
            return true;
          } catch (e) { /* siguiente */ }
        }
      }
    }

    // 3) dentro de un artefacto publicado, la descarga pasa por el visor
    if (window.claude && typeof window.claude.use === 'function') {
      try {
        const dl = await window.claude.use('downloads');
        if (dl && dl.save) { await dl.save({ filename: nombre, data: json }); return true; }
      } catch (e) { console.warn('descarga del visor no disponible', e); }
    }

    // 4) navegador: va a la carpeta de descargas del sistema
    if (descargarWeb(json, nombre)) { U.toast('Descargando ' + nombre); return true; }

    // 5) último recurso: copiar o compartir el texto
    UI.modal({
      titulo: '↗ Exportar datos',
      html: `<p style="margin:-6px 0 12px;color:var(--ink-soft);font-size:13px">
          No se pudo guardar el archivo aquí. Copia o comparte este texto y guárdalo.</p>
        <div class="field"><textarea id="bk" style="min-height:150px;font-size:11px">${U.esc(json)}</textarea></div>`,
      autofocus: false,
      acciones: [
        { txt: 'Copiar', clase: 'btn', fn: async ov => {
            try { await navigator.clipboard.writeText(json); U.toast('Copiado'); }
            catch (e) { ov.querySelector('#bk').select(); U.toast('Selecciona y copia'); return false; }
          } },
        { txt: 'Compartir', clase: 'btn primary', fn: () => U.compartir(json, nombre) }
      ]
    });
    return false;
  }

  return { exportar, nombreArchivo, textoResumen };
})();
