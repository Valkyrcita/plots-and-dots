/* =========================================================
   REORDEN - arrastrar para reordenar con pulsación larga
   · mantén pulsado ~0.45 s → el elemento se "levanta" (vibra)
   · sin soltar, arrastra arriba/abajo → se reordena (con auto-scroll en los bordes)
   · si lo sueltas sin moverlo → se llama a alEditar
   Un solo oyente por contenedor; durante el arrastre solo se mueve UN elemento.
   ========================================================= */
const Reorden = (() => {
  const MS = 450;          // pulsación larga
  const UMBRAL = 8;        // si el dedo se mueve más antes de armar, es un scroll normal
  let st = null;           // gesto en curso

  /* contenedor con scroll más cercano (o la página) */
  function scroller(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return document.scrollingElement || document.documentElement;
  }
  function limites(s) {
    if (s === document.scrollingElement || s === document.documentElement) {
      const tb = document.querySelector('.topbar'), dk = document.querySelector('.dock');
      return { top: tb ? tb.getBoundingClientRect().bottom : 0,
               bot: dk ? dk.getBoundingClientRect().top : window.innerHeight };
    }
    const r = s.getBoundingClientRect();
    return { top: r.top, bot: r.bottom };
  }

  function bloquearClick() {            // evita el "click" que llega tras soltar
    const f = e => { e.stopPropagation(); e.preventDefault(); };
    document.addEventListener('click', f, true);
    setTimeout(() => document.removeEventListener('click', f, true), 350);
  }

  function armar() {
    if (!st) return;
    st.armado = true;
    st.it.classList.add('reord-up');
    U.haptic('MEDIUM');
  }

  function empezarMovimiento() {
    st.moviendo = true;
    if (st.o.alEmpezar) st.o.alEmpezar(st.it);
    const r = st.it.getBoundingClientRect();
    st.offY = Math.max(0, Math.min(st.y0 - r.top, r.height));
    st.scr = scroller(st.it);
    st.raf = requestAnimationFrame(tick);
  }

  function tick() {
    if (!st || !st.moviendo) return;
    // auto-scroll cerca de los bordes
    const lim = limites(st.scr), z = 70;
    let v = 0;
    if (st.y < lim.top + z) v = -Math.min(16, Math.ceil((lim.top + z - st.y) / z * 16));
    else if (st.y > lim.bot - z) v = Math.min(16, Math.ceil((st.y - (lim.bot - z)) / z * 16));
    if (v) {
      if (st.scr === document.scrollingElement || st.scr === document.documentElement) window.scrollBy(0, v);
      else st.scr.scrollTop += v;
    }
    actualizar();
    st.raf = requestAnimationFrame(tick);
  }

  function actualizar() {
    const it = st.it, o = st.o;
    it.style.transform = '';
    const deseado = st.y - st.offY;
    const h = it.getBoundingClientRect().height;
    const centro = deseado + h / 2;
    for (let guard = 0; guard < 8; guard++) {          // intercambia con los vecinos si hace falta
      const arr = o.hermanos(it), i = arr.indexOf(it);
      const prev = arr[i - 1], next = arr[i + 1];
      if (prev) { const r = prev.getBoundingClientRect(); if (centro < r.top + r.height / 2) { prev.before(it); continue; } }
      if (next) { const r = next.getBoundingClientRect(); if (centro > r.top + r.height / 2) { next.after(it); continue; } }
      break;
    }
    const natural = it.getBoundingClientRect().top;
    it.style.transform = 'translate3d(0,' + (deseado - natural).toFixed(1) + 'px,0) scale(1.02)';
  }

  function alMover(e) {
    if (!st || e.pointerId !== st.pid) return;
    st.x = e.clientX; st.y = e.clientY;
    const d = Math.hypot(st.x - st.x0, st.y - st.y0);
    if (!st.armado) { if (d > UMBRAL) fin(true); return; }
    if (!st.moviendo && d > 6) empezarMovimiento();
  }
  function alSoltarDedo(e) {
    if (!st || e.pointerId !== st.pid) return;
    fin(e.type === 'pointercancel' && !st.armado);
  }

  function fin(cancelarTodo) {
    const s = st; st = null;
    clearTimeout(s.t); cancelAnimationFrame(s.raf);
    document.removeEventListener('pointermove', alMover, true);
    document.removeEventListener('pointerup', alSoltarDedo, true);
    document.removeEventListener('pointercancel', alSoltarDedo, true);
    s.it.style.transform = '';
    s.it.classList.remove('reord-up');
    if (cancelarTodo || !s.armado) return;
    bloquearClick();
    if (s.moviendo) {
      if (s.o.alTerminar) s.o.alTerminar(s.it);
      s.o.alSoltar(s.it);
    } else if (s.o.alEditar) s.o.alEditar(s.it);
  }

  /* o: { item, hermanos(it)→[...], agarre?, alEmpezar?, alTerminar?, alSoltar(it), alEditar?(it) } */
  function bind(cont, o) {
    cont.addEventListener('pointerdown', e => {
      if (st) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const it = e.target.closest(o.item);
      if (!it || !cont.contains(it)) return;
      if (o.agarre && !e.target.closest(o.agarre)) return;
      st = { o, it, pid: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
             armado: false, moviendo: false, t: setTimeout(armar, MS) };
      document.addEventListener('pointermove', alMover, true);
      document.addEventListener('pointerup', alSoltarDedo, true);
      document.addEventListener('pointercancel', alSoltarDedo, true);
    });
    // una vez "levantado", el dedo no debe desplazar la pantalla
    cont.addEventListener('touchmove', e => { if (st && st.armado && e.cancelable) e.preventDefault(); }, { passive: false });
    cont.addEventListener('contextmenu', e => { if (st) e.preventDefault(); });
  }

  return { bind };
})();
