#!/usr/bin/env python3
"""Añade al AndroidManifest el permiso de escritura solo para Android 9 o anterior.
En Android 10+ el plugin Descargas usa MediaStore y no necesita permisos."""
import re, sys, pathlib

ruta = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'android/app/src/main/AndroidManifest.xml')
if not ruta.exists():
    print('No se encontró', ruta, '- se continúa sin tocar nada')
    sys.exit(0)

texto = ruta.read_text(encoding='utf-8')

# Copia de seguridad automática de Android: si se reinstala la app, restaura los datos.
if 'android:allowBackup' in texto:
    texto = re.sub(r'android:allowBackup="[^"]*"', 'android:allowBackup="true"', texto)
else:
    texto = re.sub(r'(<application\b)', r'\1 android:allowBackup="true"', texto, count=1)
ruta.write_text(texto, encoding='utf-8')
print('allowBackup=true asegurado')

if 'WRITE_EXTERNAL_STORAGE' in texto:
    print('El permiso ya estaba')
    sys.exit(0)

permiso = ('    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"'
           ' android:maxSdkVersion="28" />')
nuevo, n = re.subn(r'(<manifest\b[^>]*>)', lambda m: m.group(1) + '\n' + permiso, texto, count=1)
if n:
    ruta.write_text(nuevo, encoding='utf-8')
    print('Permiso añadido (solo Android 9 o anterior)')
else:
    print('No se encontró la etiqueta <manifest>; se continúa sin tocar nada')
