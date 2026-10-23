#include "ScratchTarget.h"
#include <cassert>
int main() {
  ScratchTarget t;
  t.update(2,1000,2);
  const double end = t.goal(127,48000);
  t.advance(128);
  assert(t.goal(0,48000) == end + 2);
  t.update(4,2000,-2);
  assert(t.goal(0,48000) == 2000);
  const double backwardEnd = t.goal(127,48000);
  t.advance(128);
  assert(t.goal(0,48000) == backwardEnd - 2);
  t.advance(48000);
  assert(t.goal(0,48000) == 2000 - 2 * 1440);
}