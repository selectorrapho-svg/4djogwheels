// Native track analysis for the Android build:
//  - 3-band (low/mid/high) RGB waveform summary, the full-spectrum colour
//    scheme used by pro DJ software (low=red, mid=green, high=blue)
//  - BPM detection via onset-envelope autocorrelation (60-200 BPM range)
// Written from scratch (no third-party DJ source), runs on a worker thread.
#include <jni.h>
#include <cmath>
#include <vector>
#include <algorithm>

namespace {
struct OnePole {
    float a = 0, z = 0;
    void set(float hz, float sr) { a = std::exp(-2.0f * float(M_PI) * hz / sr); }
    inline float lp(float x) { z = a * z + (1 - a) * x; return z; }
};

double detectBpm(const std::vector<float>& env, double envRate) {
    // Autocorrelate the onset envelope over the 60..200 BPM lag range.
    const int minLag = int(envRate * 60.0 / 200.0);
    const int maxLag = int(envRate * 60.0 / 60.0);
    const int n = int(env.size());
    if (n < maxLag * 2) return 0;
    double best = 0; int bestLag = 0;
    for (int lag = minLag; lag <= maxLag; ++lag) {
        double s = 0;
        for (int i = lag; i < n; ++i) s += env[i] * env[i - lag];
        // gentle preference toward 120 BPM, like most DJ analyzers
        double bpm = 60.0 * envRate / lag;
        double w = std::exp(-0.5 * std::pow(std::log2(bpm / 120.0) / 1.2, 2));
        s *= w;
        if (s > best) { best = s; bestLag = lag; }
    }
    if (!bestLag) return 0;
    double bpm = 60.0 * envRate / bestLag;
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    return std::round(bpm * 10.0) / 10.0;
}
}  // namespace

extern "C" {

// Returns float[bins*3 + 1]: interleaved low,mid,high peaks then BPM.
JNIEXPORT jfloatArray JNICALL
Java_app_lovable_djogpro_NativeDj_nAnalyze(JNIEnv* env, jclass, jfloatArray pcm, jint sampleRate, jint bins) {
    const jsize len = env->GetArrayLength(pcm);
    std::vector<float> x(len);
    env->GetFloatArrayRegion(pcm, 0, len, x.data());
    const float sr = float(sampleRate > 0 ? sampleRate : 44100);
    bins = std::max(1, int(bins));

    OnePole lo, hiSplit;
    lo.set(250.f, sr);
    hiSplit.set(3000.f, sr);
    std::vector<float> out(size_t(bins) * 3 + 1, 0.f);

    // onset envelope at ~172 Hz for tempo
    const int hop = std::max(1, int(sr / 172.0f));
    std::vector<float> onset;
    onset.reserve(len / hop + 1);
    float acc = 0, prev = 0;

    for (jsize i = 0; i < len; ++i) {
        const float s = x[i];
        const float l = lo.lp(s);
        const float belowHigh = hiSplit.lp(s);
        const float m = belowHigh - l;
        const float h = s - belowHigh;
        const size_t b = size_t((int64_t(i) * bins) / len);
        float* o = &out[b * 3];
        o[0] = std::max(o[0], std::fabs(l));
        o[1] = std::max(o[1], std::fabs(m));
        o[2] = std::max(o[2], std::fabs(h));
        acc += l * l + 0.5f * m * m;
        if ((i + 1) % hop == 0) {
            float e = std::sqrt(acc / hop);
            onset.push_back(std::max(0.f, e - prev));
            prev = e;
            acc = 0;
        }
    }
    out.back() = float(detectBpm(onset, sr / hop));

    jfloatArray res = env->NewFloatArray(jsize(out.size()));
    env->SetFloatArrayRegion(res, 0, jsize(out.size()), out.data());
    return res;
}
}
