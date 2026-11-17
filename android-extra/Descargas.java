package com.valkyrcita.plotsanddots;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;

/**
 * Guarda un archivo de texto en la carpeta Descargas del teléfono.
 * En Android 10+ usa MediaStore (no hace falta ningún permiso);
 * en versiones anteriores escribe directamente en Download/.
 */
@CapacitorPlugin(name = "Descargas")
public class Descargas extends Plugin {

    @PluginMethod
    public void guardar(PluginCall call) {
        String nombre = call.getString("filename", "plots-and-dots.json");
        String datos = call.getString("data", "");
        String tipo = call.getString("mime", "application/json");

        try {
            byte[] bytes = datos.getBytes(Charset.forName("UTF-8"));
            String uri;

            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues valores = new ContentValues();
                valores.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre);
                valores.put(MediaStore.MediaColumns.MIME_TYPE, tipo);
                valores.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                ContentResolver cr = getContext().getContentResolver();
                Uri destino = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, valores);
                if (destino == null) {
                    call.reject("No se pudo crear el archivo en Descargas");
                    return;
                }
                OutputStream salida = cr.openOutputStream(destino);
                if (salida == null) {
                    call.reject("No se pudo abrir el archivo en Descargas");
                    return;
                }
                salida.write(bytes);
                salida.flush();
                salida.close();
                uri = destino.toString();
            } else {
                File carpeta = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!carpeta.exists() && !carpeta.mkdirs()) {
                    call.reject("No se pudo abrir la carpeta Descargas");
                    return;
                }
                File archivo = new File(carpeta, nombre);
                FileOutputStream salida = new FileOutputStream(archivo);
                salida.write(bytes);
                salida.flush();
                salida.close();
                uri = Uri.fromFile(archivo).toString();
            }

            JSObject res = new JSObject();
            res.put("uri", uri);
            res.put("nombre", nombre);
            res.put("carpeta", "Descargas");
            call.resolve(res);
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "Error al guardar" : e.getMessage(), e);
        }
    }
}
