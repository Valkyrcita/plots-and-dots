# 🪄 Plots & Dots

App de organización con **tres entidades distintas que nunca se mezclan**:

- **LISTAS** → tareas sueltas, vistas todas juntas como un mensaje resumen plegable.
- **PROYECTOS** → secciones + organigrama tipo Gantt con tareas planificadas y tareas fijas.
- **HÁBITOS** → tarjetas con marcado diario y tracker anual de 31 × 12 cuadraditos.

Web app (HTML/CSS/JS sin dependencias) empaquetada para Android con **Capacitor** y compilada en **GitHub Actions**.

---

## Qué hace

### Vista Listas (por defecto)
- Todas las listas en una sola pantalla, con el formato del mensaje de WhatsApp:
  título en negrita, rango de fechas en cita, bloques `emoji + nombre`, tareas completadas
  tachadas con `~✅ ~` y fechas específicas en cursiva al final.
- Cada lista se pliega/despliega. Tocar el **nombre** entra a editar esa lista sola.
- Tocar una tarea la completa/descompleta; mantener pulsado la edita.
- `+ Agregar tarea a esta lista` al final de cada bloque.
- Rango de fechas **manual** (botón 📅): filtra las tareas con fecha fuera del rango.
  Las tareas sin fecha siempre se ven.
- Búsqueda + filtros Todas / Pendientes / Completadas.
- Botón 📤: comparte el resumen con el **share nativo de Android** (`@capacitor/share`),
  ya formateado para pegar en WhatsApp o Telegram.

### Vista Proyectos
- Tarjetas con nombre, fechas, % completado y barra de progreso.
- Botón **Organigrama**.

### Organigrama (Gantt)
> Cada fila es **una pista con una barra**, no una casilla por columna: la rejilla, los fines de
> semana y la línea de hoy se dibujan con CSS. Por eso una vista de 365 días o de 1200 horas
> apenas crea nodos y el scroll no redibuja nada.

- Tabla con **cabecera de 2 niveles** (meses arriba / unidades abajo) y **primera columna fija**.
- Unidades: **Hora · Día · Semana · Mes · Fecha exacta**. La cabecera se regenera sola.
- **Pintar**: pulsa una casilla vacía y arrastra en horizontal (pointer events, funciona con dedo).
- Tocar una casilla pintada abre un popup: rango, *Recortar aquí*, *Borrar pintado*, *Editar*.
- **Secciones**: fila oscura a todo lo ancho, plegable. Toque = plegar, mantener pulsado = editar.
- **Tareas fijas** 📌: no se pintan, se crean con formulario (fecha + hora + duración),
  se dibujan en negro y avisan *"Es una tarea fija"* si intentas pintarlas.
- **Mover una tarea**: mantén pulsado su **nombre** en la primera columna y arrastra
  a otra fila o a una cabecera de sección (no se mueve desde las casillas pintadas).
- Leyenda abajo: verde = planificado · negro = fijo · gris = libre.
- Chip `↔` para alternar el ancho de la columna de tareas (compacto / amplio).

### Vista Hábitos
- Tarjetas con emoji, color, racha 🔥 y los últimos 7 días en una tira.
- Cabecera "Hoy" con cuántos hábitos llevas marcados.
- **Niveles de cumplimiento configurables por hábito**: Leer puede tener
  *Menos de 30 min / 1 hora / Más de una hora*, cada uno con su color.
  Con un solo nivel, el ✓ alterna de un toque; con varios, se abre el selector.
- Entrar a un hábito muestra el **tracker anual**: 12 columnas (meses) × 31 filas (días),
  como en un bullet journal, coloreado según el nivel de cada día, con el total Σ de cada mes abajo,
  días en el año, % del año, racha actual y racha máxima, y selector de año.
  El botón ⟳ lo gira a 31 × 12 si lo prefieres apaisado.
- Se puede tocar cualquier cuadradito para marcar o corregir un día pasado.

### Estadísticas (📈)
Por rango de fechas: total de proyectos y listas, completadas vs pendientes, % global,
% por proyecto, días marcados por hábito con su racha, y los **trackers anuales en miniatura**
de todos los hábitos con selector de año.

### Ajustes (⚙️)
Vista al abrir, tema (claro / oscuro / automático), título del resumen, filtros, unidad e inicio de semana,
color por defecto, confirmación de borrado y vibración.
Los botones **Guardar / Descartar** aparecen fijos arriba solo cuando hay cambios.

### Copia de seguridad — para no perder nada al cambiar de teléfono
- **↗ Exportar** guarda `plots-and-dots-AAAAMMDD-HHMM.json` en la carpeta **Descargas** del teléfono.
  Lo hace un plugin nativo propio (`android-extra/Descargas.java`) que escribe por **MediaStore**,
  así funciona en Android 10 o superior sin pedir ningún permiso; en Android 9 o anterior escribe
  directamente en `Download/` con el permiso que añade el workflow. Después ofrece *Enviar copia*
  (WhatsApp, Drive, correo). En el navegador cae en la descarga normal.
  Si el plugin no estuviera disponible, prueba Documentos, el almacenamiento de la app y, por último,
  copiar o compartir el texto: nunca se queda sin dar salida al archivo.
- **↙ Importar**: elige el `.json` y restaura **todo**. También acepta el texto pegado y las copias
  del formato anterior.
- **Borrar todo** vacía la app (con confirmación).

La copia es completa y verificada con pruebas de ida y vuelta:

```jsonc
{
  "app": "Plots & Dots", "formato": 2, "exportado": "2026-11-17T20:02:00.000Z",
  "resumen": { "listas": 4, "tareas": 9, "proyectos": 1, "secciones": 3,
               "tareasProyecto": 13, "habitos": 4, "marcas": 576 },
  "datos": {
    "listas":         [ /* nombre, emoji y cada tarea con fecha, prioridad, descripción y estado */ ],
    "proyectos":      [ /* fechas y unidad de tiempo */ ],
    "secciones":      [ /* orden y si están plegadas */ ],
    "tareasProyecto": [ /* planificadas con fechas y color; fijas con fecha, hora y duración */ ],
    "habitos":        [ /* emoji, color y sus niveles con etiqueta y color */ ],
    "registros":      { /* cada día marcado, con el nivel que elegiste */ },
    "rango":          { /* el rango de fechas de la vista Listas */ },
    "ajustes":        { /* los 14 ajustes */ }
  }
}
```

---

## Datos

Se guardan con `@capacitor/preferences` y, como respaldo, en `localStorage`.
Sobreviven al cerrar la app. Clave: `plots_and_dots_v1`.

```
Lista          { id, tipo:'lista', nombre, emoji, tareas[] }
Habito         { id, tipo:'habito', nombre, emoji, color, niveles[], archivado }
Nivel          { id, etiqueta, color }
registros      { habitoId: { 'YYYY-MM-DD': nivelId } }
TareaSimple    { id, listaId, titulo, completada, fechaEspecifica, prioridad, descripcion }
Proyecto       { id, tipo:'proyecto', nombre, fechaInicio, fechaFin, unidadTiempo }
Seccion        { id, proyectoId, titulo, orden, colapsada }
TareaProyecto  { id, seccionId, titulo, tipo:'planificada'|'fija', color, orden, completada,
                 planInicio, planFin, inicioIndice, finIndice,     // planificadas
                 fechaFija, horaFija, duracionMinutos }            // fijas
```

> La planificación se guarda como **fechas** (`planInicio` / `planFin`) y los índices de columna
> se recalculan a partir de ellas. Así el pintado no se pierde al cambiar de semana a día, etc.

---

## Rendimiento

Pensada para teléfonos lentos. Medido con la CPU 6× ralentizada y datos de prueba grandes
(15 listas × 40 tareas, proyecto de un año con 40 tareas, 12 hábitos con 2 años de historial):

| | antes | ahora |
|---|---|---|
| Organigrama por hora | 2270 ms · 49 691 nodos | 86 ms · 943 nodos |
| Organigrama por día | 411 ms · 15 418 nodos | 111 ms · 900 nodos |
| Scroll horizontal del organigrama | 183 ms/frame (100% de saltos) | 16,7 ms/frame (0 saltos) |
| Marcar una tarea con 600 en pantalla | 73 ms | 11 ms |
| Buscar (por tecla) | 168 ms | 0 ms (se agrupa y repinta en ~19 ms) |
| Estadísticas con 12 trackers | 136 ms · 5588 nodos | 20 ms · 380 nodos |

Qué se hizo:
- **Barras en vez de casillas** en el organigrama (ver arriba).
- **Un solo oyente** para todas las tareas de todas las listas, en vez de cuatro por tarea.
- **Actualización puntual**: marcar una tarea toca esa línea y su contador, no toda la pantalla;
  pintar una tarea repinta solo su barra.
- **Buscador con retardo** de 220 ms: no redibuja en cada tecla y ya no pierde el foco.
- **Índices por búsqueda binaria y en caché**, en vez de recorrer todas las columnas por tarea.
- **Trackers de estadísticas perezosos**: se dibujan al asomar por la pantalla (IntersectionObserver).
- **`content-visibility`** en tarjetas y bloques: el navegador se salta lo que no se ve al desplazarse.
- **Guardado agrupado** (400 ms): marcar diez tareas seguidas escribe una sola vez.
- **Modo ligero** (Ajustes → Apariencia): se activa solo si el teléfono tiene pocos núcleos o poca
  RAM, y quita desenfoques, suaviza sombras y acorta animaciones. También respeta
  «reducir movimiento» del sistema.

## Compilar el APK

1. Sube todo este contenido a `valkyrcita/plots-and-dots` (rama `main`).
2. En **Settings → Secrets and variables → Actions → New repository secret** crea 4 secrets:
   `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` (la firma del APK; nunca va en el repo).
3. Cada push a `main` compila el APK firmado y lo publica en **Releases** con la etiqueta `v<versión>`.

Sin los secrets la compilación se **cancela a propósito**: un APK con otra firma no se instalaría encima del anterior y se perderían los datos.

### Versiones
Sube `version` en `package.json` en cada actualización (mayor/menor/parche según el cambio).
El workflow calcula `versionCode = mayor*10000 + menor*100 + parche`, así el APK se actualiza
encima sin desinstalar. Empieza en `0.0.0`.

### Local
```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

---

## Estructura

```
www/
  index.html
  css/style.css        clay (home) + neumorph (organigrama), claro y oscuro
  js/store.js          persistencia y modelos
  js/utils.js          fechas y generación de columnas de tiempo
  js/ui.js             modales, pantallas, tema
  js/listas.js         vista Listas
  js/proyectos.js      vista Proyectos
  js/gantt.js          organigrama
  js/habitos.js        vista Hábitos y tracker anual
  js/stats.js          estadísticas
  js/ajustes.js        ajustes
  js/app.js            arranque y navegación
```

### Demo en un solo archivo
```bash
./build-demo.sh salida.html            # la app entera inline, sin datos
./build-demo.sh salida.html seed.js    # con datos de prueba
```
Útil para abrir la app en el navegador del teléfono sin compilar el APK.
