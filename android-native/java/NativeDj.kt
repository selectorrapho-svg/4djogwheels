package app.lovable.djogpro

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.nio.ByteOrder
import kotlin.concurrent.thread

/** Capacitor bridge from the DJ UI to the Oboe engine (AAudio / OpenSL ES). */
@CapacitorPlugin(name = "NativeDj")
class NativeDj : Plugin() {
    companion object {
        init { System.loadLibrary("djengine") }
        @JvmStatic external fun nStart(): Boolean
        @JvmStatic external fun nSampleRate(): Int
        @JvmStatic external fun nLoad(deck: Int, pcm: FloatArray)
        @JvmStatic external fun nPlay(deck: Int, pos: Double, rate: Double)
        @JvmStatic external fun nPause(deck: Int)
        @JvmStatic external fun nSeek(deck: Int, pos: Double)
        @JvmStatic external fun nRate(deck: Int, rate: Double)
        @JvmStatic external fun nTarget(deck: Int, pos: Double, vel: Double)
        @JvmStatic external fun nGain(deck: Int, vol: Float, x: Float)
        @JvmStatic external fun nPos(deck: Int): Double
        @JvmStatic external fun nAnalyze(pcm: FloatArray, sampleRate: Int, bins: Int): FloatArray
    }

    override fun load() { nStart() }

    @PluginMethod fun available(call: PluginCall) {
        call.resolve(JSObject().put("ok", true).put("sampleRate", nSampleRate()))
    }

    /** data = base64 file bytes (mp3/aac/m4a/wav/mp4 audio track). Decoded with hardware MediaCodec. */
    @PluginMethod fun load(call: PluginCall) {
        val deck = call.getInt("deck", 0)!!
        val b64 = call.getString("data") ?: return call.reject("no data")
        thread {
            try {
                val tmp = File.createTempFile("deck$deck", ".bin", context.cacheDir)
                tmp.writeBytes(Base64.decode(b64, Base64.DEFAULT))
                val pcm = decode(tmp.absolutePath, nSampleRate())
                tmp.delete()
                nLoad(deck, pcm)
                call.resolve(JSObject().put("frames", pcm.size / 2))
            } catch (e: Exception) { call.reject(e.message) }
        }
    }

    @PluginMethod fun play(call: PluginCall) { nPlay(call.getInt("deck")!!, call.getDouble("pos") ?: 0.0, call.getDouble("rate") ?: 1.0); call.resolve() }
    @PluginMethod fun pause(call: PluginCall) { nPause(call.getInt("deck")!!); call.resolve() }
    @PluginMethod fun seek(call: PluginCall) { nSeek(call.getInt("deck")!!, call.getDouble("pos") ?: 0.0); call.resolve() }
    @PluginMethod fun rate(call: PluginCall) { nRate(call.getInt("deck")!!, call.getDouble("rate") ?: 1.0); call.resolve() }
    @PluginMethod fun target(call: PluginCall) { nTarget(call.getInt("deck")!!, call.getDouble("pos") ?: 0.0, call.getDouble("vel") ?: 0.0); call.resolve() }
    @PluginMethod fun gain(call: PluginCall) {
        nGain(call.getInt("deck")!!, (call.getDouble("vol") ?: -1.0).toFloat(), (call.getDouble("x") ?: -1.0).toFloat()); call.resolve()
    }
    @PluginMethod fun position(call: PluginCall) { call.resolve(JSObject().put("pos", nPos(call.getInt("deck")!!))) }

    private fun decode(path: String, outRate: Int): FloatArray {
        val ex = MediaExtractor(); ex.setDataSource(path)
        var track = -1; var fmt: MediaFormat? = null
        for (i in 0 until ex.trackCount) {
            val f = ex.getTrackFormat(i)
            if (f.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) { track = i; fmt = f; break }
        }
        if (track < 0 || fmt == null) throw Exception("No audio track")
        ex.selectTrack(track)
        val codec = MediaCodec.createDecoderByType(fmt.getString(MediaFormat.KEY_MIME)!!)
        codec.configure(fmt, null, null, 0); codec.start()
        var inRate = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        var ch = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        val stereo = ArrayList<Float>(1 shl 20)
        val info = MediaCodec.BufferInfo(); var inDone = false; var outDone = false
        while (!outDone) {
            if (!inDone) {
                val ii = codec.dequeueInputBuffer(5000)
                if (ii >= 0) {
                    val n = ex.readSampleData(codec.getInputBuffer(ii)!!, 0)
                    if (n < 0) { codec.queueInputBuffer(ii, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inDone = true }
                    else { codec.queueInputBuffer(ii, 0, n, ex.sampleTime, 0); ex.advance() }
                }
            }
            val oi = codec.dequeueOutputBuffer(info, 5000)
            if (oi == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                inRate = codec.outputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                ch = codec.outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            } else if (oi >= 0) {
                val sb = codec.getOutputBuffer(oi)!!.order(ByteOrder.nativeOrder()).asShortBuffer()
                val frames = sb.remaining() / ch
                for (f in 0 until frames) {
                    val l = sb.get(f * ch) / 32768f
                    val r = if (ch > 1) sb.get(f * ch + 1) / 32768f else l
                    stereo.add(l); stereo.add(r)
                }
                codec.releaseOutputBuffer(oi, false)
                if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outDone = true
            }
        }
        codec.stop(); codec.release(); ex.release()
        val src = stereo.toFloatArray()
        if (inRate == outRate) return src
        // linear resample to device rate (one-time, at load)
        val inFrames = src.size / 2
        val outFrames = (inFrames.toLong() * outRate / inRate).toInt()
        val out = FloatArray(outFrames * 2)
        val step = inRate.toDouble() / outRate
        for (i in 0 until outFrames) {
            val p = i * step; val k = p.toInt(); val t = (p - k).toFloat(); val k2 = minOf(k + 1, inFrames - 1)
            out[i * 2] = src[k * 2] + (src[k2 * 2] - src[k * 2]) * t
            out[i * 2 + 1] = src[k * 2 + 1] + (src[k2 * 2 + 1] - src[k * 2 + 1]) * t
        }
        return out
    }
}
