/* =========================================================
   Plots & Dots - arranque y navegación
   ========================================================= */
const App = (() => {
  const VERSION='0.4.1';
  let vista = 'listas';     // listas | proyectos | habitos

  function render() {
    const cont = document.getElementById('view');
    if (!cont) return;
    document.querySelectorAll('[data-vista]').forEach(b =>
      b.classList.toggle('active', b.dataset.vista === vista));
    if (vista === 'listas') Listas.render(cont);
    else if (vista === 'proyectos') Proyectos.render(cont);
    else Habitos.render(cont);
  }

  function menuNuevo() {
    UI.modal({
      titulo: '¿Qué quieres crear?',
      html: `<div class="choice-grid">
        <button class="choice" data-nuevo="lista">
          <span class="ic" style="background:var(--clay-menta)">🗒️</span>
          <span><strong>Nueva Lista</strong><small>Tareas sueltas, rápidas, con check</small></span>
        </button>
        <button class="choice" data-nuevo="proyecto">
          <span class="ic" style="background:var(--clay-azul)">📊</span>
          <span><strong>Nuevo Proyecto</strong><small>Secciones, fechas y organigrama</small></span>
        </button>
        <button class="choice" data-nuevo="habito">
          <span class="ic" style="background:var(--clay-rosa)">🌱</span>
          <span><strong>Nuevo Hábito</strong><small>Marcado diario y tracker anual</small></span>
        </button>
      </div>`,
      autofocus: false,
      onMount: (ov, cerrar) => {
        ov.querySelector('[data-nuevo="lista"]').onclick = () => { cerrar(); vista = 'listas'; Listas.formLista(); };
        ov.querySelector('[data-nuevo="proyecto"]').onclick = () => { cerrar(); vista = 'proyectos'; Proyectos.formProyecto(); };
        ov.querySelector('[data-nuevo="habito"]').onclick = () => { cerrar(); vista = 'habitos'; Habitos.formHabito(); };
      }
    });
  }

  async function init() {
    await Store.load();
    vista = Store.state().ajustes.vistaInicial || 'listas';
    UI.aplicarTema();
    UI.aplicarPerf();

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => { if (Store.state().ajustes.tema === 'auto') UI.aplicarTema(); });
    }

    document.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => {
      vista = b.dataset.vista; U.haptic('LIGHT'); render();
    });
    document.getElementById('fab').onclick = menuNuevo;
    document.getElementById('btn-ajustes').onclick = () => Ajustes.abrir();
    document.getElementById('btn-stats').onclick = () => Stats.abrir();

    // botón atrás de Android: cierra modales / pantallas antes de salir
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.App) {
      cap.Plugins.App.addListener('backButton', () => {
        const ov = document.querySelector('.overlay');
        if (ov) { ov.remove(); return; }
        const sc = document.querySelectorAll('.screen');
        if (sc.length) { sc[sc.length - 1].querySelector('.back').click(); return; }
        cap.Plugins.App.exitApp();
      });
      cap.Plugins.App.addListener('pause', () => Store.persist());
    }
    window.addEventListener('beforeunload', () => Store.persist());
    document.addEventListener('visibilitychange', () => { if (document.hidden) Store.persist(); });

    render();
    document.getElementById('splash').classList.add('hidden');
  }

  return { init, render, menuNuevo, VERSION, get vista() { return vista; }, set vista(v) { vista = v; } };
})();

document.addEventListener('DOMContentLoaded', App.init);
