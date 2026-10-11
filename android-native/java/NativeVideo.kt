package app.lovable.djogpro

import android.graphics.SurfaceTexture
import android.media.MediaPlayer
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.view.Surface
import android.view.ViewGroup
import android.widget.FrameLayout
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

/**
 * OpenGL ES video mixer: decks A and B decoded by hardware (MediaPlayer ->
 * SurfaceTexture), composited on the GPU with the crossfader. Video is muted
 * and slaved to the Oboe audio clock (NativeDj.nPos) every frame.
 */
@CapacitorPlugin(name = "NativeVideo")
class NativeVideo : Plugin() {
    private var view: GLSurfaceView? = null
    private val renderer = Mixer()

    @PluginMethod fun show(call: PluginCall) {
        activity.runOnUiThread {
            if (view == null) {
                view = GLSurfaceView(context).apply {
                    setEGLContextClientVersion(2); setRenderer(renderer)
                    renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
                }
                (bridge.webView.parent as ViewGroup).addView(view, 0, FrameLayout.LayoutParams(-1, -1))
                bridge.webView.setBackgroundColor(0)
            }
            call.resolve()
        }
    }
    @PluginMethod fun load(call: PluginCall) {
        val deck = call.getInt("deck", 0)!! and 1
        val path = call.getString("path") ?: return call.reject("no path")
        renderer.pending[deck] = path; call.resolve()
    }
    @PluginMethod fun crossfade(call: PluginCall) { renderer.x = (call.getDouble("x") ?: 0.5).toFloat(); call.resolve() }

    class Mixer : GLSurfaceView.Renderer {
        val pending = arrayOfNulls<String>(2)
        val players = arrayOfNulls<MediaPlayer>(2)
        val tex = IntArray(2); val st = arrayOfNulls<SurfaceTexture>(2)
        @Volatile var x = 0.5f
        private var prog = 0
        private val quad = ByteBuffer.allocateDirect(64).order(ByteOrder.nativeOrder()).asFloatBuffer()
            .put(floatArrayOf(-1f,-1f,0f,1f, 1f,-1f,1f,1f, -1f,1f,0f,0f, 1f,1f,1f,0f)).also { it.position(0) }

        override fun onSurfaceCreated(gl: GL10?, c: EGLConfig?) {
            GLES20.glGenTextures(2, tex, 0)
            for (i in 0..1) {
                GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, tex[i])
                GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
                st[i] = SurfaceTexture(tex[i])
            }
            prog = link(
                "attribute vec2 p;attribute vec2 t;varying vec2 v;void main(){v=t;gl_Position=vec4(p,0.,1.);}",
                "#extension GL_OES_EGL_image_external : require\nprecision mediump float;varying vec2 v;" +
                "uniform samplerExternalOES a;uniform samplerExternalOES b;uniform float x;" +
                "void main(){gl_FragColor=mix(texture2D(a,v),texture2D(b,v),x);}")
        }
        override fun onSurfaceChanged(gl: GL10?, w: Int, h: Int) = GLES20.glViewport(0, 0, w, h)

        override fun onDrawFrame(gl: GL10?) {
            for (i in 0..1) {
                pending[i]?.let { path ->
                    pending[i] = null
                    players[i]?.release()
                    players[i] = MediaPlayer().apply {
                        setDataSource(path); setVolume(0f, 0f); setSurface(Surface(st[i])); prepare()
                    }
                }
                val mp = players[i] ?: continue
                // slave to the Oboe deck clock: rate-correct small drift, hard seek large drift
                val audio = NativeDj.nPos(i) * 1000.0
                val drift = audio - mp.currentPosition
                if (Math.abs(drift) > 250) mp.seekTo(audio.toLong(), MediaPlayer.SEEK_CLOSEST)
                else try {
                    mp.playbackParams = mp.playbackParams.setSpeed((1.0 + drift / 2000.0).toFloat().coerceIn(0.9f, 1.1f))
                } catch (_: Exception) {}
                st[i]?.updateTexImage()
            }
            GLES20.glUseProgram(prog)
            val ap = GLES20.glGetAttribLocation(prog, "p"); val at = GLES20.glGetAttribLocation(prog, "t")
            quad.position(0); GLES20.glVertexAttribPointer(ap, 2, GLES20.GL_FLOAT, false, 16, quad); GLES20.glEnableVertexAttribArray(ap)
            quad.position(2); GLES20.glVertexAttribPointer(at, 2, GLES20.GL_FLOAT, false, 16, quad); GLES20.glEnableVertexAttribArray(at)
            for (i in 0..1) {
                GLES20.glActiveTexture(GLES20.GL_TEXTURE0 + i)
                GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, tex[i])
                GLES20.glUniform1i(GLES20.glGetUniformLocation(prog, if (i == 0) "a" else "b"), i)
            }
            GLES20.glUniform1f(GLES20.glGetUniformLocation(prog, "x"), x)
            GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        }

        private fun link(vs: String, fs: String): Int {
            fun sh(t: Int, s: String) = GLES20.glCreateShader(t).also { GLES20.glShaderSource(it, s); GLES20.glCompileShader(it) }
            return GLES20.glCreateProgram().also {
                GLES20.glAttachShader(it, sh(GLES20.GL_VERTEX_SHADER, vs))
                GLES20.glAttachShader(it, sh(GLES20.GL_FRAGMENT_SHADER, fs)); GLES20.glLinkProgram(it)
            }
        }
    }
}
