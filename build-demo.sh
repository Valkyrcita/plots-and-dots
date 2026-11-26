#!/usr/bin/env bash
# Genera un único HTML con todo inline (para previsualizar o publicar como artefacto).
set -e
OUT="${1:-/home/claude/plots-and-dots-demo.html}"
SEED="${2:-}"
cd "$(dirname "$0")"
{
  sed -n '1,/<link rel="stylesheet"/p' www/index.html | sed '$d'
  echo "<style>"; cat www/css/style.css; echo "</style>"
  sed -n '/<\/head>/,/<script src="js\/store.js">/p' www/index.html | sed '$d'
  echo "<script>"
  for f in store utils ui reorden listas proyectos gantt habitos datos stats ajustes; do cat "www/js/$f.js"; echo; done
  cat www/js/app.js
  [ -n "$SEED" ] && cat "$SEED"
  echo "</script>"
  echo "</body></html>"
} > "$OUT"
echo "$OUT  ($(wc -c < "$OUT") bytes)"
