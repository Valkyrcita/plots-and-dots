/* =========================================================
   Persistencia: @capacitor/preferences con fallback localStorage
   ========================================================= */
const Store = (() => {
  const KEY = 'plots_and_dots_v1';

  function prefs() {
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.Preferences) return cap.Plugins.Preferences;
    return null;
  }

  const defaults = () => ({
    version: 1,
    listas: [],
    habitos: [],
    registros: {},      // { habitoId: { 'YYYY-MM-DD': nivelId } }
    proyectos: [],
    secciones: [],
    tareasProyecto: [],
    rango: { inicio: null, fin: null },   // rango manual de la vista Listas
    ajustes: {
      tema: 'auto',                 // auto | claro | oscuro
      unidadDefecto: 'semana',
      anchoTareas: 'compacto',
      trackerOrientacion: 'vertical',   // vertical (meses arriba) | horizontal
      modoLigero: 'auto',              // auto | si | no   // compacto | amplio (ancho de la 1ª columna)
      colorDefecto: '#bcd8a8',
      inicioSemana: 1,              // 1 = lunes, 0 = domingo
      mostrarCompletadas: true,
      confirmarBorrado: true,
      haptics: true,
      filtrarPorRango: true,
      resaltarHoy: true,
      tituloResumen: '🛑‼️TO DO LIST‼️🛑',
      vistaInicial: 'listas'   // listas | proyectos | habitos
    }
  });

  let data = defaults();
  let saveTimer = null;

  async function load() {
    let raw = null;
    const p = prefs();
    try {
      if (p) {
        const r = await p.get({ key: KEY });
        raw = r && r.value;
      }
      if (!raw) raw = localStorage.getItem(KEY);
    } catch (e) {
      try { raw = localStorage.getItem(KEY); } catch (_) { raw = null; }
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        data = Object.assign(defaults(), parsed);
        data.ajustes = Object.assign(defaults().ajustes, parsed.ajustes || {});
      } catch (e) { console.warn('Datos corruptos, empezando de cero', e); }
    }
    return data;
  }

  async function persist() {
    const raw = JSON.stringify(data);
    try { localStorage.setItem(KEY, raw); } catch (e) { /* cuota */ }
    const p = prefs();
    if (p) { try { await p.set({ key: KEY, value: raw }); } catch (e) { console.warn(e); } }
  }

  function save() {                     // se agrupa la escritura: marcar 10 tareas = 1 guardado
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  }

  function state() { return data; }
  function replace(next) { data = next; return persist(); }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* Copia COMPLETA: listas (con sus tareas), proyectos (con secciones y
     tareas, planificadas y fijas), hábitos (con niveles e historial de
     marcas), el rango de la vista Listas y todos los ajustes. */
  function instantanea() {
    const d = defaults();
    const copia = {};
    Object.keys(d).forEach(k => { copia[k] = data[k] !== undefined ? data[k] : d[k]; });
    // y cualquier campo nuevo que no esté en los valores por defecto
    Object.keys(data).forEach(k => { if (copia[k] === undefined) copia[k] = data[k]; });
    copia.ajustes = Object.assign({}, d.ajustes, data.ajustes || {});
    return copia;
  }

  function resumen() {
    const d = data;
    return {
      listas: d.listas.length,
      tareas: d.listas.reduce((a, l) => a + l.tareas.length, 0),
      proyectos: d.proyectos.length,
      secciones: d.secciones.length,
      tareasProyecto: d.tareasProyecto.length,
      habitos: d.habitos.length,
      marcas: Object.values(d.registros || {}).reduce((a, o) => a + Object.keys(o).length, 0)
    };
  }

  function exportJSON() {
    return JSON.stringify({
      app: 'Plots & Dots',
      formato: 2,
      exportado: new Date().toISOString(),
      resumen: resumen(),
      datos: instantanea()
    }, null, 2);
  }

  async function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') throw new Error('Formato inválido');
    // acepta la copia nueva ({app, formato, datos}) y las antiguas (el objeto pelado)
    const crudo = parsed.datos && typeof parsed.datos === 'object' ? parsed.datos : parsed;
    if (!crudo.listas && !crudo.proyectos && !crudo.habitos) throw new Error('No parece una copia de Plots & Dots');
    const next = Object.assign(defaults(), crudo);
    next.ajustes = Object.assign(defaults().ajustes, crudo.ajustes || {});
    ['listas', 'proyectos', 'secciones', 'tareasProyecto', 'habitos'].forEach(k => {
      if (!Array.isArray(next[k])) next[k] = [];
    });
    if (!next.registros || typeof next.registros !== 'object') next.registros = {};
    await replace(next);
    return next;
  }

  return { load, save, persist, state, replace, uid, exportJSON, importJSON, defaults, resumen };
})();
