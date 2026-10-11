package app.lovable.djogpro

import android.Manifest
import android.content.ContentUris
import android.os.Build
import android.provider.MediaStore
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Asks for music/video permission and lists every song and video on the phone
 * through MediaStore, so the library fills itself without picking files.
 */
@CapacitorPlugin(
    name = "NativeMedia",
    permissions = [
        Permission(alias = "audio", strings = [Manifest.permission.READ_MEDIA_AUDIO]),
        Permission(alias = "video", strings = [Manifest.permission.READ_MEDIA_VIDEO]),
        Permission(alias = "storage", strings = [Manifest.permission.READ_EXTERNAL_STORAGE]),
    ]
)
class NativeMediaPlugin : Plugin() {
    private fun aliases(): Array<String> =
        if (Build.VERSION.SDK_INT >= 33) arrayOf("audio", "video") else arrayOf("storage")

    private fun granted() = aliases().any { getPermissionState(it) == PermissionState.GRANTED }

    @PluginMethod
    fun scan(call: PluginCall) {
        if (granted()) list(call) else requestPermissionForAliases(aliases(), call, "afterPermission")
    }

    @PermissionCallback
    private fun afterPermission(call: PluginCall) {
        if (granted()) list(call) else call.reject("Permission to read music and videos was denied")
    }

    private fun list(call: PluginCall) {
        val out = JSArray()
        query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, "audio", out)
        query(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, "video", out)
        call.resolve(JSObject().put("items", out))
    }

    private fun query(base: android.net.Uri, kind: String, out: JSArray) {
        val cols = if (kind == "audio") arrayOf(
            MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.TITLE, MediaStore.MediaColumns.DURATION,
            MediaStore.Audio.Media.ALBUM_ID,
        ) else arrayOf(
            MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.TITLE, MediaStore.MediaColumns.DURATION,
        )
        val where = if (kind == "audio") "${MediaStore.Audio.Media.IS_MUSIC} != 0" else null
        context.contentResolver.query(base, cols, where, null, "${MediaStore.MediaColumns.TITLE} ASC")?.use { c ->
            val id = c.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
            val name = c.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
            val title = c.getColumnIndexOrThrow(MediaStore.MediaColumns.TITLE)
            val album = if (kind == "audio") c.getColumnIndex(MediaStore.Audio.Media.ALBUM_ID) else -1
            while (c.moveToNext()) {
                val mediaId = c.getLong(id)
                val artworkUri = if (kind == "audio" && album >= 0) {
                    "content://media/external/audio/albumart/${c.getLong(album)}"
                } else {
                    ContentUris.withAppendedId(base, mediaId).toString()
                }
                out.put(JSObject()
                    .put("uri", ContentUris.withAppendedId(base, mediaId).toString())
                    .put("artworkUri", artworkUri)
                    .put("filename", c.getString(name) ?: "")
                    .put("title", c.getString(title) ?: c.getString(name) ?: "Untitled")
                    .put("kind", kind))
            }
        }
    }
}
