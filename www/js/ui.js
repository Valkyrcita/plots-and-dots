/* =========================================================
   UI: hojas inferiores, modales, pantallas completas, tema
   ========================================================= */
const UI = (() => {

  /* teléfono modesto: pocos núcleos o poca RAM -> modo ligero */
  function equipoLento() {
    const n = navigator.hardwareConcurrency || 4;
    const m = navigator.deviceMemory || 4;
    return n <= 4 || m <= 3;
  }

  function aplicarPerf(modo) {
    const v = modo || (Store.state().ajustes.modoLigero || 'auto');
    const bajo = v === 'si' || (v === 'auto' && equipoLento());
    document.documentElement.setAttribute('data-perf', bajo ? 'bajo' : 'alto');
    return bajo;
  }

  function aplicarTema(modo) {
    const html = document.documentElement;
    let t = modo || Store.state().ajustes.tema || 'auto';
    if (t === 'auto') {
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
    }
    html.setAttribute('data-theme', t === 'oscuro' ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'oscuro' ? '#1b1725' : '#efe9f7');
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.StatusBar) {
      try {
        cap.Plugins.StatusBar.setStyle({ style: t === 'oscuro' ? 'DARK' : 'LIGHT' });
        cap.Plugins.StatusBar.setBackgroundColor({ color: t === 'oscuro' ? '#1b1725' : '#efe9f7' });
      } catch (e) {}
    }
  }

  /* ---- hoja inferior genérica ----
     opts: { titulo, html, acciones:[{txt,clase,fn,cerrar}], centrado, onMount } */
  function modal(opts) {
    const ov = document.createElement('div');
    ov.className = 'overlay' + (opts.centrado ? ' center' : '');
    ov.innerHTML = `
      <div class="sheet${opts.centrado ? ' centered' : ''}">
        ${opts.centrado ? '' : '<div class="sheet-grip"></div>'}
        ${opts.titulo ? `<h2>${U.esc(opts.titulo)}</h2>` : ''}
        <div class="sheet-content">${opts.html || ''}</div>
        <div class="sheet-actions"></div>
      </div>`;
    const cerrar = () => { ov.style.animation = 'fade .15s ease reverse'; setTimeout(() => ov.remove(), 130); };
    ov.addEventListener('click', e => { if (e.target === ov) cerrar(); });

    const acciones = ov.querySelector('.sheet-actions');
    (opts.acciones || []).forEach(a => {
      const b = document.createElement('button');
      b.className = a.clase || 'btn';
      b.textContent = a.txt;
      b.onclick = () => {
        if (a.fn && a.fn(ov) === false) return;
        if (a.cerrar !== false) cerrar();
      };
      acciones.appendChild(b);
    });
    if (!acciones.children.length) acciones.remove();

    document.body.appendChild(ov);
    if (opts.onMount) opts.onMount(ov, cerrar);
    const f = ov.querySelector('input,textarea,select');
    if (f && opts.autofocus !== false) setTimeout(() => f.focus(), 120);
    return { el: ov, cerrar };
  }

  /* ---- pantalla completa ---- */
  function screen(opts) {
    const sc = document.createElement('div');
    sc.className = 'screen' + (opts.clase ? ' ' + opts.clase : '');
    sc.innerHTML = `
      <div class="screen-head">
        <button class="icon-btn back">←</button>
        <h2>${U.esc(opts.titulo || '')}</h2>
        <div class="head-actions"></div>
      </div>
      ${opts.fijoBajoHead || ''}
      <div class="screen-body${opts.flush ? ' flush' : ''}">${opts.html || ''}</div>`;
    const cerrar = () => { sc.remove(); if (opts.onClose) opts.onClose(); };
    sc.querySelector('.back').onclick = () => { if (opts.onBack) { if (opts.onBack(cerrar) === false) return; } cerrar(); };
    const ha = sc.querySelector('.head-actions');
    (opts.acciones || []).forEach(a => {
      const b = document.createElement('button');
      b.className = a.clase || 'icon-btn';
      b.innerHTML = a.txt;
      b.onclick = () => a.fn(sc, cerrar);
      ha.appendChild(b);
    });
    document.body.appendChild(sc);
    if (opts.onMount) opts.onMount(sc, cerrar);
    return { el: sc, cerrar };
  }

  const EMOJIS = ['💼','📓','🏰','🫟','🏠','🛒','🎯','💡','🧪','🎨','🎵','📚','🧹','🏋️','🍳','✈️','💊','💰','🐾','🌱','📞','🎁','⚡','🌙','🔮','📌','🧩','☕'];
  const COLORES = ['#bcd8a8','#a8d8c8','#a7c6e8','#b9a9e6','#f2b9b2','#e8c07d','#d8a8c8','#8fbfa8'];

  function emojiPicker(sel) {
    return `<div class="emoji-grid">${EMOJIS.map(e =>
      `<button type="button" class="emoji-opt${e === sel ? ' sel' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>`;
  }
  function colorPicker(sel) {
    return `<div class="color-grid">${COLORES.map(c =>
      `<button type="button" class="color-opt${c === sel ? ' sel' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>`;
  }
  function bindPicker(root, attr, cb) {
    root.querySelectorAll(`[data-${attr}]`).forEach(b => {
      b.onclick = () => {
        root.querySelectorAll(`[data-${attr}]`).forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        cb(b.dataset[attr]);
      };
    });
  }

  return { aplicarTema, aplicarPerf, equipoLento, modal, screen, emojiPicker, colorPicker, bindPicker, EMOJIS, COLORES };
})();
