#include <thread>
#include <chrono>
// Native DJ audio engine: Oboe (AAudio on Android 8.1+, OpenSL ES fallback).
// 4 decks, signed-rate playback (real backwards scratching), per-sample rate
// smoothing, Hermite interpolation, click-free gain ramps. Lock-free control
// via atomics so the audio callback never blocks.
#include <oboe/Oboe.h>
#include <jni.h>
#include <atomic>
#include <cmath>
#include <algorithm>
#include <memory>
#include <mutex>
#include <vector>
#include "ScratchTarget.h"

namespace {

struct Deck {
  std::shared_ptr<std::vector<float>> pcm;  // interleaved stereo
  std::shared_ptr<std::vector<float>> pending;
  std::atomic<bool> swapPending{false};
  std::atomic<bool> playing{false};
  std::atomic<double> targetRate{0.0};
  std::atomic<double> seekTo{-1.0};
  std::atomic<float> volume{1.f};
  std::atomic<float> xfade{1.f};
  double pos = 0;    // frames
  double rate = 0;   // smoothed
  float gain = 0;    // smoothed out gain
  std::atomic<double> reportedPos{0.0};
  // Position-controlled scratch: the platter servos to the finger position.
  std::atomic<bool> follow{false};
  std::atomic<double> followPos{0.0};  // seconds
  std::atomic<double> followVel{0.0};
  std::atomic<uint64_t> followRevision{0};
  ScratchTarget scratchTarget;
};

class Engine : public oboe::AudioStreamDataCallback, public oboe::AudioStreamErrorCallback {
 public:
  Deck decks[4];
  std::shared_ptr<oboe::AudioStream> stream;
  int sampleRate = 48000;
  std::mutex streamMutex;

  bool start() {
    std::lock_guard<std::mutex> lock(streamMutex);
    if (stream && stream->getState() == oboe::StreamState::Started) return true;
    stream.reset();
    oboe::AudioStreamBuilder b;
    b.setDirection(oboe::Direction::Output)
        ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
        ->setSharingMode(oboe::SharingMode::Exclusive)
        ->setFormat(oboe::AudioFormat::Float)
        ->setChannelCount(2)
        ->setSampleRate(48000)
        ->setSampleRateConversionQuality(oboe::SampleRateConversionQuality::Medium)
        ->setUsage(oboe::Usage::Media)
        ->setDataCallback(this)
        ->setErrorCallback(this);
    // Exclusive low latency is not always available on wireless outputs.
    if (b.openStream(stream) != oboe::Result::OK) {
      b.setSharingMode(oboe::SharingMode::Shared);
      if (b.openStream(stream) != oboe::Result::OK) {
        // Bluetooth A2DP often rejects low-latency mode entirely.
        b.setPerformanceMode(oboe::PerformanceMode::None);
        if (b.openStream(stream) != oboe::Result::OK) return false;
      }
    }
    sampleRate = stream->getSampleRate();
    // Wireless/shared outputs need more headroom or they underrun and freeze.
    bool shared = stream->getSharingMode() == oboe::SharingMode::Shared;
    stream->setBufferSizeInFrames(stream->getFramesPerBurst() * (shared ? 6 : 2));
    return stream->requestStart() == oboe::Result::OK;
  }

  void onErrorAfterClose(oboe::AudioStream*, oboe::Result error) override {
    // Bluetooth/headset route changes close the stream: reopen on the new
    // device and keep every deck's position so playback carries on.
    (void)error;
    // Oboe forbids reopening from its own callback thread; retry on a worker
    // until the new route (e.g. Bluetooth) accepts the stream.
    std::thread([this] {
      for (int i = 0; i < 10; ++i) {
        std::this_thread::sleep_for(std::chrono::milliseconds(150 * (i + 1)));
        if (start()) return;
      }
    }).detach();
  }

  static inline float hermite(const float* d, long n, long i, float f, int c) {
    auto at = [&](long k) { k = k < 0 ? 0 : (k >= n ? n - 1 : k); return d[k * 2 + c]; };
    float p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    float c1 = 0.5f * (p2 - p0);
    float c2 = p0 - 2.5f * p1 + 2.f * p2 - 0.5f * p3;
    float c3 = 0.5f * (p3 - p0) + 1.5f * (p1 - p2);
    return ((c3 * f + c2) * f + c1) * f + p1;
  }

  oboe::DataCallbackResult onAudioReady(oboe::AudioStream*, void* audio, int32_t frames) override {
    float* out = static_cast<float*>(audio);
    std::fill(out, out + frames * 2, 0.f);
    const float kRate = 1.f - std::exp(-1.f / (0.0012f * sampleRate));
    const float kGain = 1.f - std::exp(-1.f / (0.004f * sampleRate));
    for (auto& d : decks) {
      if (d.swapPending.exchange(false)) { d.pcm = d.pending; d.pos = 0; d.rate = 0; }
      double s = d.seekTo.exchange(-1.0);
      if (s >= 0) d.pos = s * sampleRate;
      auto buf = d.pcm;
      if (!buf || buf->empty()) continue;
      const float* data = buf->data();
      long n = (long)(buf->size() / 2);
      double target = d.playing.load() ? d.targetRate.load() : 0.0;
      const bool follow = d.follow.load();
      // Alpha-beta tracker (same as the web engine): critically damped at
      // 45 Hz so the platter locks to the finger, reverses without overshoot
      // and never jumps, which is what causes clicks.
      const double abW = 2.0 * M_PI * 45.0 / sampleRate;
      const double abA = 2.0 * abW, abB = abW * abW;
      // Never spin on the UI writer from the real-time callback. Read one
      // consistent snapshot, or keep the last trajectory for this block.
      const auto revision = d.followRevision.load();
      if ((revision & 1) == 0) {
        const double pos = d.followPos.load() * sampleRate;
        const double vel = std::max(-24.0, std::min(24.0, d.followVel.load()));
        if (d.followRevision.load() == revision) d.scratchTarget.update(revision,pos,vel);
      }
      float gTarget = d.volume.load() * d.xfade.load();
      for (int i = 0; i < frames; ++i) {
        double prev = d.pos;
        if (follow) {
          double goal = d.scratchTarget.goal(i,sampleRate);
          double err = goal - (d.pos + d.rate);
          double step = std::max(-24.0, std::min(24.0, d.rate + abA * err));
          d.rate = std::max(-24.0, std::min(24.0, d.rate + abB * err));
          d.pos += step;
        } else {
          d.rate += (target - d.rate) * kRate;
          if (std::fabs(target - d.rate) < 0.0001) d.rate = target;
          d.pos += d.rate;
        }
        d.gain += (gTarget - d.gain) * kGain;
        if (d.pos < 0) { d.pos = 0; d.rate = 0; }
        if (d.pos > n - 2) { d.pos = n - 2; d.rate = 0; d.playing = false; }
        if (std::fabs(d.rate) < 1e-5) continue;
        long idx = (long)std::floor(prev);
        float f = (float)(prev - idx);
        // fade near-zero speeds like a real platter (no DC buzz)
        float slow = (float)std::min(1.0, std::fabs(d.rate) * 8.0);
        out[i * 2] += hermite(data, n, idx, f, 0) * d.gain * slow;
        out[i * 2 + 1] += hermite(data, n, idx, f, 1) * d.gain * slow;
      }
      if (follow) d.scratchTarget.advance(frames);
      d.reportedPos.store(d.pos / sampleRate);
    }
    for (int i = 0; i < frames * 2; ++i) out[i] = std::tanh(out[i]);  // soft limiter
    return oboe::DataCallbackResult::Continue;
  }
};

Engine* gEngine = nullptr;
}  // namespace

extern "C" {
JNIEXPORT jboolean JNICALL Java_app_lovable_djogpro_NativeDj_nStart(JNIEnv*, jclass) {
  if (!gEngine) gEngine = new Engine();
  return gEngine->start();
}
JNIEXPORT jint JNICALL Java_app_lovable_djogpro_NativeDj_nSampleRate(JNIEnv*, jclass) {
  return gEngine ? gEngine->sampleRate : 48000;
}
JNIEXPORT void JNICALL Java_app_lovable_djogpro_NativeDj_nLoad(JNIEnv* env, jclass, jint deck, jfloatArray pcm) {
  if (!gEngine) return;
  jsize len = env->GetArrayLength(pcm);
  auto v = std::make_shared<std::vector<float>>(len);
  env->GetFloatArrayRegion(pcm, 0, len, v->data());
  auto& d = gEngine->decks[deck & 3];
  d.playing = false;
  d.pending = v;
  d.swapPending = true;
}
JNIEXPORT void JNICALL Java_app_lovable_djogpro_NativeDj_nPlay(JNIEnv*, jclass, jint deck, jdouble pos, jdouble rate) {
  auto& d = gEngine->decks[deck & 3];
  d.follow = false; d.seekTo = pos; d.targetRate = rate; d.playing = true;
}
JNIEXPORT void JNICALL Java_app_lovable_djogpro_NativeDj_nTarget(JNIEnv*, jclass, jint deck, jdouble pos, jdouble vel) {
  auto& d = gEngine->decks[deck & 3];
  d.followRevision.fetch_add(1);
  d.followPos = pos; d.followVel = vel;
  d.followRevision.fetch_add(1);
  d.follow = true; d.playing = true;
}
JNIEXPORT void JNICALL Java_app_lovable_djogpro_NativeDj_nPause(JNIEnv*, jclass, jint deck) {
  gEngine->decks[deck & 3].follow = false;
  gEngine->decks[deck & 3].playing = false;
}
JNIEXPORT void JNICALL Java_app_lovable_djogpro_NativeDj_nSeek(JNIEnv*, jclass, jint deck, jdouble pos) {
  gEngine->decks[deck & 3].seekTo = pos;
}
JNIEXPORT void JNICALL Java_app_lovable_djogpro_NativeDj_nRate(JNIEnv*, jclass, jint deck, jdouble rate) {
  gEngine->decks[deck & 3].follow = false;
  gEngine->decks[deck & 3].targetRate = rate;  // signed: negative = backwards
}
JNIEXPORT void JNICALL Java_app_lovable_djogpro_NativeDj_nGain(JNIEnv*, jclass, jint deck, jfloat vol, jfloat x) {
  auto& d = gEngine->decks[deck & 3];
  if (vol >= 0) d.volume = vol;
  if (x >= 0) d.xfade = x;
}
JNIEXPORT jdouble JNICALL Java_app_lovable_djogpro_NativeDj_nPos(JNIEnv*, jclass, jint deck) {
  return gEngine ? gEngine->decks[deck & 3].reportedPos.load() : 0;
}
}
