#pragma once
#include <algorithm>
#include <cstdint>
// Audio-thread clock: a hand target continues across callbacks, but stale
// motion coasts for at most 30 ms before holding the platter stationary.
struct ScratchTarget {
  uint64_t revision = 0;
  uint64_t elapsed = 0;
  double position = 0;
  double velocity = 0;
  void update(uint64_t next, double pos, double vel) {
    if (revision == next) return;
    revision = next; elapsed = 0; position = pos; velocity = vel;
  }
  double goal(uint64_t offset, int sampleRate) const {
    return position + velocity * std::min(elapsed + offset, static_cast<uint64_t>(sampleRate * .03));
  }
  void advance(uint64_t frames) { elapsed += frames; }
};