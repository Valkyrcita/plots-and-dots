/* Datos de prueba para Plots & Dots */
window.SEED_PLOTS_DOTS = function () {
  const S = Store.state();
  const hoy = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  const menos = n => { const d = new Date(hoy); d.setDate(d.getDate() - n); return iso(d); };

  /* ---- LISTAS ---- */
  const mkLista = (nombre, emoji, tareas) => {
    const l = { id: Store.uid('lst'), tipo: 'lista', nombre, emoji, tareas: [] };
    tareas.forEach(t => l.tareas.push(Object.assign({
      id: Store.uid('tsk'), listaId: l.id, titulo: '', completada: false,
      fechaEspecifica: '', prioridad: '', descripcion: '', creada: menos(5)
    }, t)));
    S.listas.push(l);
  };
  mkLista('Trabajo', '💼', [
    { titulo: 'Preparar promoción de paquetes con precios', completada: true },
    { titulo: 'Escribir a informático Varona', completada: true },
    { titulo: 'Identidad de Negocio de Impresión 3D', prioridad: 'alta' },
    { titulo: 'Catálogo de expertos del IPK', descripcion: 'Pedir las fotos antes' }
  ]);
  mkLista('Estudios', '📓', [{ titulo: 'Estudiar francés', prioridad: 'media' }]);
  mkLista('Hogwarts', '🏰', [
    { titulo: 'Revisar retos especiales de Huff y Sly' },
    { titulo: 'Revisar e inaugurar bot de TIMOS', completada: true }
  ]);
  mkLista('Extras', '🫟', [
    { titulo: 'Regalo de cumpleaños para mi hermana' },
    { titulo: 'Regalo de cumpleaños de amanda', fechaEspecifica: menos(-8) }
  ]);
  S.rango = { inicio: menos(3), fin: menos(-25) };

  /* ---- PROYECTO ---- */
  const p = { id: Store.uid('prj'), tipo: 'proyecto', nombre: 'Identidad Visual — Tesis',
              fechaInicio: '2027-01-01', fechaFin: '2027-06-30', unidadTiempo: 'semana', creado: menos(30) };
  S.proyectos.push(p);
  const s1 = { id: Store.uid('sec'), proyectoId: p.id, titulo: 'Primera Predefensa', orden: 0, colapsada: false };
  const s2 = { id: Store.uid('sec'), proyectoId: p.id, titulo: 'Segunda Predefensa', orden: 1, colapsada: false };
  const s3 = { id: Store.uid('sec'), proyectoId: p.id, titulo: 'Entrega', orden: 2, colapsada: false };
  S.secciones.push(s1, s2, s3);
  const P = (sec, titulo, i, f, color, orden, hecha) => ({
    id: Store.uid('tp'), seccionId: sec, titulo, tipo: 'planificada', color: color || '#bcd8a8',
    planInicio: i, planFin: f, orden, completada: !!hecha
  });
  const F = (sec, titulo, fecha, hora, orden) => ({
    id: Store.uid('tp'), seccionId: sec, titulo, tipo: 'fija', fechaFija: fecha, horaFija: hora,
    duracionMinutos: 120, orden, completada: false
  });
  S.tareasProyecto.push(
    P(s1.id, 'Definiciones estratégicas', '2027-01-01', '2027-01-24', null, 0, true),
    P(s1.id, 'Definición del Discurso visual', '2027-01-18', '2027-02-14', null, 1, true),
    P(s1.id, 'Elaboración de premisas conceptuales', '2027-02-08', '2027-03-07', null, 2),
    P(s1.id, 'Desarrollo de alternativas y variantes', '2027-03-01', '2027-03-28', '#a8d8c8', 3),
    F(s1.id, 'Primera Predefensa', '2027-02-18', '09:00', 4),
    P(s2.id, 'Depuración del concepto óptimo', '2027-04-05', '2027-04-25', null, 0),
    P(s2.id, 'Diseño de la identidad', '2027-04-19', '2027-05-23', '#a7c6e8', 1),
    P(s2.id, 'Diseño de aplicaciones y soportes', '2027-05-10', '2027-06-06', '#b9a9e6', 2),
    F(s2.id, 'Segunda Predefensa', '2027-04-08', '10:00', 3),
    P(s3.id, 'Confección del Manual de Identidad', '2027-05-24', '2027-06-20', '#e8c07d', 0),
    P(s3.id, 'Elaboración del Libro de Tesis', '2027-06-01', '2027-06-27', '#f2b9b2', 1),
    F(s3.id, 'Entrega Final', '2027-06-14', '12:00', 2),
    F(s3.id, 'Defensa del Trabajo de Diploma', '2027-06-25', '10:00', 3)
  );

  /* ---- HÁBITOS ---- */
  const mkHab = (nombre, emoji, color, niveles) => {
    const h = { id: Store.uid('hab'), tipo: 'habito', nombre, emoji, color, niveles,
                creado: menos(300), orden: S.habitos.length, archivado: false };
    S.habitos.push(h); S.registros[h.id] = {}; return h;
  };
  const leer = mkHab('Leer', '📚', '#e8c07d', [
    { id: 'n1', etiqueta: 'Menos de 30 min', color: '#f6e7c4' },
    { id: 'n2', etiqueta: '1 hora', color: '#e8c07d' },
    { id: 'n3', etiqueta: 'Más de una hora', color: '#c99a3f' }
  ]);
  const ejercicio = mkHab('Ejercicio', '🏋️', '#a7c6e8', [
    { id: 'n1', etiqueta: 'Caminar', color: '#cfe3f5' },
    { id: 'n2', etiqueta: 'Pesas', color: '#7ba7d4' },
    { id: 'n3', etiqueta: 'Béisbol', color: '#2f5f99' }
  ]);
  const crochet = mkHab('Crochet', '🧶', '#f2b9b2', [{ id: 'n1', etiqueta: 'Hecho', color: '#f2b9b2' }]);
  const frances = mkHab('Francés', '📓', '#a8d8c8', [
    { id: 'n1', etiqueta: 'Repaso rápido', color: '#cfeae0' },
    { id: 'n2', etiqueta: 'Clase completa', color: '#6fae9b' }
  ]);

  /* historial pseudoaleatorio pero estable de los últimos 300 días */
  let semilla = 7;
  const rnd = () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648;
  const llenar = (h, prob) => {
    for (let i = 0; i < 300; i++) {
      if (rnd() < prob) {
        const n = h.niveles[Math.floor(rnd() * h.niveles.length)];
        S.registros[h.id][menos(i)] = n.id;
      }
    }
  };
  llenar(leer, 0.62); llenar(ejercicio, 0.45); llenar(crochet, 0.3); llenar(frances, 0.55);
  // racha reciente garantizada para ver el 🔥
  for (let i = 0; i < 6; i++) S.registros[leer.id][menos(i)] = 'n2';
  delete S.registros[crochet.id][menos(0)];

  Store.save();
};
