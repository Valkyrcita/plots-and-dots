/* =========================================================
   Utilidades: fechas, columnas de tiempo, UI helpers
   ========================================================= */
const U = (() => {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MESES_C = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

  const pad = n => String(n).padStart(2, '0');

  function hoyISO() { return toISO(new Date()); }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromISO(s) {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

  function startOfWeek(d, inicioSemana) {
    const x = new Date(d); x.setHours(0, 0, 0, 0);
    const diff = (x.getDay() - (inicioSemana ?? 1) + 7) % 7;
    x.setDate(x.getDate() - diff);
    return x;
  }

  /* "Jueves 10/09" */
  function fechaCorta(iso) {
    const d = fromISO(iso); if (!d) return '';
    return DIAS[d.getDay()] + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
  }
  /* "12 Ene" */
  function fechaMini(iso) {
    const d = fromISO(iso); if (!d) return '—';
    return pad(d.getDate()) + ' ' + MESES_C[d.getMonth()];
  }
  function rangoTexto(ini, fin) {
    if (!ini && !fin) return 'Elegir rango de fechas';
    return fechaMini(ini) + ' → ' + fechaMini(fin);
  }
  function hora12(hhmm) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + pad(m) + ' ' + ap;
  }

  /* =======================================================
     COLUMNAS DEL ORGANIGRAMA
     unidad: 'hora' | 'dia' | 'semana' | 'mes' | 'fecha'
     devuelve [{ key, label, grupo, inicio:Date, fin:Date, finde:bool }]
     ======================================================= */
  function generarColumnas(fechaInicio, fechaFin, unidad, inicioSemana) {
    const ini = fromISO(fechaInicio), fin = fromISO(fechaFin);
    const cols = [];
    if (!ini || !fin || fin < ini) return cols;
    const LIMITE = 1200; // tope de seguridad

    if (unidad === 'mes') {
      let c = new Date(ini.getFullYear(), ini.getMonth(), 1);
      while (c <= fin && cols.length < LIMITE) {
        const last = new Date(c.getFullYear(), c.getMonth() + 1, 0);
        cols.push({ key: 'm' + toISO(c), label: MESES_C[c.getMonth()], grupo: String(c.getFullYear()),
                    inicio: new Date(c), fin: last });
        c = addMonths(c, 1);
      }
      return cols;
    }

    if (unidad === 'semana') {
      let c = startOfWeek(ini, inicioSemana);
      let mesActual = -1, n = 0;
      while (c <= fin && cols.length < LIMITE) {
        const finSem = addDays(c, 6);
        // la semana pertenece al mes donde cae el centro de su parte visible
        const desde = c < ini ? ini : c;
        const hasta = finSem > fin ? fin : finSem;
        const ref = new Date((desde.getTime() + hasta.getTime()) / 2);
        if (ref.getMonth() !== mesActual) { mesActual = ref.getMonth(); n = 0; }
        n++;
        cols.push({ key: 'w' + toISO(c), label: String(n), grupo: MESES[ref.getMonth()],
                    grupoKey: ref.getFullYear() + '-' + ref.getMonth(),
                    inicio: new Date(c), fin: finSem });
        c = addDays(c, 7);
      }
      return cols;
    }

    if (unidad === 'hora') {
      let c = new Date(ini); c.setHours(0, 0, 0, 0);
      const limite = new Date(fin); limite.setHours(23, 59, 59, 999);
      while (c <= limite && cols.length < LIMITE) {
        const h = c.getHours();
        cols.push({
          key: 'h' + toISO(c) + 'T' + pad(h), label: pad(h),
          grupo: pad(c.getDate()) + ' ' + MESES_C[c.getMonth()],
          grupoKey: toISO(c),
          inicio: new Date(c), fin: new Date(c.getTime() + 3599999),
          finde: c.getDay() === 0 || c.getDay() === 6
        });
        c = new Date(c.getTime() + 3600000);
      }
      return cols;
    }

    // 'dia' (mes arriba / nº de día abajo) y 'fecha' (dd/MM abajo)
    let c = new Date(ini); c.setHours(0, 0, 0, 0);
    while (c <= fin && cols.length < LIMITE) {
      cols.push({
        key: 'd' + toISO(c),
        label: unidad === 'fecha' ? pad(c.getDate()) + '/' + pad(c.getMonth() + 1) : String(c.getDate()),
        grupo: MESES[c.getMonth()] + (unidad === 'fecha' ? ' ' + c.getFullYear() : ''),
        grupoKey: c.getFullYear() + '-' + c.getMonth(),
        inicio: new Date(c), fin: new Date(c.getFullYear(), c.getMonth(), c.getDate(), 23, 59, 59),
        finde: c.getDay() === 0 || c.getDay() === 6
      });
      c = addDays(c, 1);
    }
    return cols;
  }

  /* agrupa columnas para la cabecera de nivel 1 */
  function agruparColumnas(cols) {
    const grupos = [];
    cols.forEach((c, i) => {
      const k = c.grupoKey || c.grupo;
      const last = grupos[grupos.length - 1];
      if (last && last.key === k) last.span++;
      else grupos.push({ key: k, label: c.grupo, span: 1, desde: i });
    });
    return grupos;
  }

  /* índice de columna donde cae una fecha+hora concreta */
  function indiceDeFecha(cols, fechaISO, horaHHMM) {
    if (!fechaISO) return -1;
    const d = fromISO(fechaISO);
    if (!d) return -1;
    if (horaHHMM) { const [h, m] = horaHHMM.split(':').map(Number); d.setHours(h || 0, m || 0, 0, 0); }
    else d.setHours(12, 0, 0, 0);
    for (let i = 0; i < cols.length; i++) {
      if (d >= cols[i].inicio && d <= cols[i].fin) return i;
    }
    return -1;
  }


  /* ---------- gesto toque vs. scroll ----------
     Evita que al desplazar la lista con el dedo se marquen tareas sin querer.
     opts: { tap, hold, msHold } */
  function bindTap(el, opts) {
    let t0 = null, x0 = 0, y0 = 0, movido = false, disparado = false, activo = false, pid = null;
    const UMBRAL = 10;
    const limpiar = () => { clearTimeout(t0); t0 = null; };

    el.addEventListener('pointerdown', e => {
      activo = true; pid = e.pointerId;
      movido = false; disparado = false; x0 = e.clientX; y0 = e.clientY;
      if (opts.hold) t0 = setTimeout(() => {
        if (!activo) return;
        disparado = true; haptic('MEDIUM'); opts.hold(e);
      }, opts.msHold || 450);
    });
    el.addEventListener('pointermove', e => {
      if (!activo) return;
      if (Math.abs(e.clientX - x0) > UMBRAL || Math.abs(e.clientY - y0) > UMBRAL) { movido = true; limpiar(); }
    });
    el.addEventListener('pointercancel', () => { activo = false; movido = true; limpiar(); });
    el.addEventListener('pointerup', e => {
      limpiar();
      // solo cuenta si el gesto empezó y terminó en este mismo elemento
      const valido = activo && e.pointerId === pid;
      activo = false;
      if (!valido || movido || disparado) return;
      if (opts.tap) opts.tap(e);
    });
  }

  /* Igual que bindTap pero con un solo oyente para todos los hijos:
     con cientos de tareas evita crear miles de listeners. */
  function bindTapDelegado(cont, selector, opts) {
    let el = null, t0 = null, x0 = 0, y0 = 0, movido = false, disparado = false, pid = null;
    const limpiar = () => { clearTimeout(t0); t0 = null; };

    cont.addEventListener('pointerdown', e => {
      const o = e.target.closest(selector);
      if (!o || !cont.contains(o)) { el = null; return; }
      el = o; pid = e.pointerId; movido = false; disparado = false;
      x0 = e.clientX; y0 = e.clientY;
      if (opts.hold) t0 = setTimeout(() => {
        if (!el) return;
        disparado = true; haptic('MEDIUM'); opts.hold(el);
      }, opts.msHold || 450);
    });
    cont.addEventListener('pointermove', e => {
      if (!el) return;
      if (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10) { movido = true; limpiar(); }
    });
    cont.addEventListener('pointercancel', () => { el = null; limpiar(); });
    cont.addEventListener('pointerup', e => {
      limpiar();
      const o = el; el = null;
      if (!o || e.pointerId !== pid || movido || disparado) return;
      if (e.target.closest(selector) !== o) return;      // se soltó en otro sitio
      if (opts.tap) opts.tap(o);
    });
  }

  /* retrasa una función: para el buscador, que no redibuje en cada tecla */
  function retardar(fn, ms) {
    let t = null;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms || 180);
    };
  }

  /* ---------- UI helpers ---------- */
  let toastTimer = null;
  function toast(msg) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2300);
  }

  function haptic(style) {
    const s = Store.state().ajustes;
    if (!s || !s.haptics) return;
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.Haptics) {
      try { cap.Plugins.Haptics.impact({ style: style || 'LIGHT' }); } catch (e) {}
    } else if (navigator.vibrate) navigator.vibrate(8);
  }

  async function compartir(texto, titulo) {
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.Share) {
      try { await cap.Plugins.Share.share({ title: titulo || 'Plots & Dots', text: texto, dialogTitle: 'Compartir' }); return true; }
      catch (e) { if (String(e).includes('cancel')) return false; }
    }
    if (navigator.share) {
      try { await navigator.share({ title: titulo || 'Plots & Dots', text: texto }); return true; } catch (e) { return false; }
    }
    try { await navigator.clipboard.writeText(texto); toast('Copiado al portapapeles'); return true; }
    catch (e) { toast('No se pudo compartir'); return false; }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function confirmar(mensaje, onOk) {
    if (!Store.state().ajustes.confirmarBorrado) { onOk(); return; }
    UI.modal({
      titulo: '¿Seguro?',
      html: `<p style="color:var(--ink-soft);margin:0 0 4px">${esc(mensaje)}</p>`,
      centrado: true,
      acciones: [
        { txt: 'Cancelar', clase: 'btn', cerrar: true },
        { txt: 'Eliminar', clase: 'btn danger', cerrar: true, fn: onOk }
      ]
    });
  }

  return { bindTap, bindTapDelegado, retardar, MESES, MESES_C, DIAS, pad, hoyISO, toISO, fromISO, addDays, addMonths, sameDay, startOfWeek,
           fechaCorta, fechaMini, rangoTexto, hora12, generarColumnas, agruparColumnas, indiceDeFecha,
           toast, haptic, compartir, esc, confirmar };
})();
